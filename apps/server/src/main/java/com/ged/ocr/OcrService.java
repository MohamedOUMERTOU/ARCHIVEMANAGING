package com.ged.ocr;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.common.ApiException;
import com.ged.document.DocumentEventType;
import com.ged.document.DocumentService;
import com.ged.storage.FileStorage;
import com.ged.user.Permissions;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Texte des documents (consultation, relance) et paramétrage de la reconnaissance. */
@Service
public class OcrService {

    /**
     * État du texte d'une version. {@code status} vaut AUCUN si la version n'a jamais été lue
     * (traitement automatique désactivé, ou document déposé avant l'OCR).
     */
    public record TextStatus(int versionNo, boolean supported, String status, String method, List<String> languages,
                             Integer pagesTotal, int pagesDone, Double confidence, String error, Instant requestedAt,
                             Instant finishedAt, Integer queuePosition, boolean searchableCopy,
                             boolean copyDownloadable, boolean hasText) {}

    public record PageText(int page, String content) {}

    public record SettingsDto(boolean autoOnUpload, List<String> languages, boolean detectOrientation,
                              boolean searchablePdfDownload, boolean paused, List<String> availableLanguages,
                              boolean engineAvailable) {}

    public record SettingsInput(boolean autoOnUpload, List<String> languages, boolean detectOrientation,
                                boolean searchablePdfDownload) {}

    /** Avancement pour la société : version actuelle de chaque document dont le format peut être lu. */
    public record Progress(long eligible, long done, long pending, long running, long failed, long lowQuality,
                           long notRequested, boolean paused) {}

    public record Job(UUID documentId, String reference, String title, int versionNo, String status,
                      Integer pagesTotal, int pagesDone, Double confidence, String error, Instant requestedAt,
                      Instant finishedAt) {}

    public record Overview(Progress progress, List<Job> recent) {}

    public record Copy(Resource resource, String filename, long size, String sha256) {}

    private final DocumentService documents;
    private final OcrQueue queue;
    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentUserProvider currentUser;
    private final AuditService audit;
    private final FileStorage storage;
    private final Tesseract tesseract;

    public OcrService(DocumentService documents, OcrQueue queue, NamedParameterJdbcTemplate jdbc,
                      CurrentUserProvider currentUser, AuditService audit, FileStorage storage, Tesseract tesseract) {
        this.documents = documents;
        this.queue = queue;
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.audit = audit;
        this.storage = storage;
        this.tesseract = tesseract;
    }

    // ───────── Texte d'un document ─────────

    @Transactional(readOnly = true)
    public TextStatus status(UUID documentId, Integer versionNo) {
        return status(documents.readableVersion(documentId, versionNo));
    }

    private TextStatus status(DocumentService.ReadableVersion r) {
        UUID versionId = r.version().getId();
        boolean supported = OcrQueue.supports(r.version().getMimeType());
        boolean downloadable = queue.settings(r.user().organizationId()).searchablePdfDownload();
        List<TextStatus> found = jdbc.query("""
                SELECT t.status, t.method, t.languages, t.pages_total, t.pages_done, t.confidence, t.error,
                       t.requested_at, t.finished_at, t.searchable_key IS NOT NULL AS copy,
                       EXISTS (SELECT 1 FROM document_text_pages p WHERE p.text_id = t.id AND p.content <> '') AS has_text,
                       CASE WHEN t.status = 'EN_ATTENTE' THEN
                         (SELECT count(*) FROM document_texts x WHERE x.status = 'EN_ATTENTE' AND x.requested_at < t.requested_at)
                       END AS ahead
                FROM document_texts t WHERE t.version_id = :v""", new MapSqlParameterSource("v", versionId),
                (rs, i) -> new TextStatus(r.version().getVersionNo(), supported, rs.getString("status"),
                        rs.getString("method"), OcrQueue.languages(rs.getArray("languages")),
                        (Integer) rs.getObject("pages_total"), rs.getInt("pages_done"), decimal(rs, "confidence"),
                        rs.getString("error"), instant(rs, "requested_at"), instant(rs, "finished_at"),
                        rs.getObject("ahead") == null ? null : rs.getInt("ahead"), rs.getBoolean("copy"),
                        rs.getBoolean("copy") && downloadable, rs.getBoolean("has_text")));
        if (!found.isEmpty()) return found.get(0);
        return new TextStatus(r.version().getVersionNo(), supported, "AUCUN", null, List.of(), null, 0, null, null,
                null, null, null, false, false, false);
    }

    /** Texte page par page ; la lecture du texte est tracée comme une consultation du document. */
    @Transactional
    public List<PageText> pages(UUID documentId, Integer versionNo) {
        DocumentService.ReadableVersion r = documents.readableVersion(documentId, versionNo);
        List<PageText> pages = jdbc.query("""
                SELECT p.page_no, p.content FROM document_text_pages p JOIN document_texts t ON t.id = p.text_id
                WHERE t.version_id = :v ORDER BY p.page_no""", new MapSqlParameterSource("v", r.version().getId()),
                (rs, i) -> new PageText(rs.getInt(1), rs.getString(2)));
        documents.traceAccess(r, DocumentEventType.CONSULTE, "texte reconnu", "TEXTE_CONSULTE");
        return pages;
    }

    /** Lance ou relance la lecture d'une version (bouton « Relancer » de la fiche). */
    @Transactional
    public TextStatus retry(UUID documentId, Integer versionNo) {
        currentUser.require(DocumentService.WRITE);
        DocumentService.ReadableVersion r = documents.readableVersion(documentId, versionNo);
        if (!OcrQueue.supports(r.version().getMimeType())) {
            throw ApiException.badRequest("NOT_SUPPORTED", "Le texte de ce format de fichier ne peut pas être lu");
        }
        if (queue.request(r.user().organizationId(), documentId, r.version().getId())) {
            audit.log(r.user().organizationId(), r.user().id(), "OCR_RELANCE", "document", documentId.toString(),
                    Map.of("version", r.version().getVersionNo()), null);
        }
        return status(r);
    }

    /** Copie PDF avec le texte reconnu, si le paramétrage autorise son téléchargement. */
    @Transactional
    public Copy downloadCopy(UUID documentId, int versionNo) {
        DocumentService.ReadableVersion r = documents.readableVersion(documentId, versionNo);
        if (!queue.settings(r.user().organizationId()).searchablePdfDownload()) {
            throw ApiException.forbidden("Le téléchargement des copies avec texte reconnu n'est pas activé");
        }
        OcrQueue.Copy copy = queue.copyOf(r.version().getId())
                .orElseThrow(() -> ApiException.notFound("Copie avec texte reconnu"));
        documents.traceAccess(r, DocumentEventType.TELECHARGE, "copie avec texte reconnu", "DOCUMENT_TELECHARGE");
        return new Copy(storage.load(copy.key()), DocumentService.pdfName(r.version().getFilename()), copy.size(),
                copy.sha256());
    }

    // ───────── Paramétrage ─────────

    @Transactional(readOnly = true)
    public SettingsDto settings() {
        CurrentUser user = currentUser.require(Permissions.SETTINGS);
        return dto(queue.settings(user.organizationId()));
    }

    @Transactional
    public SettingsDto updateSettings(SettingsInput in) {
        CurrentUser user = currentUser.require(Permissions.SETTINGS);
        List<String> languages = in.languages() == null ? List.of()
                : Tesseract.LANGUAGES.stream().filter(in.languages()::contains).toList();
        if (languages.isEmpty()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION",
                    "Choisissez au moins une langue", Map.of("languages", "Choisissez au moins une langue"));
        }
        jdbc.update("""
                INSERT INTO ocr_settings (organization_id, auto_on_upload, languages, detect_orientation, searchable_pdf_download)
                VALUES (:org, :auto, CAST(:langs AS text[]), :orient, :dl)
                ON CONFLICT (organization_id) DO UPDATE SET auto_on_upload = :auto, languages = CAST(:langs AS text[]),
                    detect_orientation = :orient, searchable_pdf_download = :dl, updated_at = now()""",
                new MapSqlParameterSource().addValue("org", user.organizationId()).addValue("auto", in.autoOnUpload())
                        .addValue("langs", OcrQueue.pgArray(languages)).addValue("orient", in.detectOrientation())
                        .addValue("dl", in.searchablePdfDownload()));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("auDepot", in.autoOnUpload());
        details.put("langues", languages);
        details.put("orientation", in.detectOrientation());
        details.put("telechargementCopie", in.searchablePdfDownload());
        audit.log(user.organizationId(), user.id(), "OCR_PARAMETRAGE_MODIFIE", "ocr_settings",
                user.organizationId().toString(), details, null);
        return dto(queue.settings(user.organizationId()));
    }

    @Transactional
    public SettingsDto pause(boolean paused) {
        CurrentUser user = currentUser.require(Permissions.SETTINGS);
        jdbc.update("""
                INSERT INTO ocr_settings (organization_id, paused) VALUES (:org, :paused)
                ON CONFLICT (organization_id) DO UPDATE SET paused = :paused, updated_at = now()""",
                new MapSqlParameterSource().addValue("org", user.organizationId()).addValue("paused", paused));
        audit.log(user.organizationId(), user.id(), paused ? "OCR_SUSPENDU" : "OCR_REPRIS", "ocr_settings",
                user.organizationId().toString(), Map.of(), null);
        return dto(queue.settings(user.organizationId()));
    }

    @Transactional(readOnly = true)
    public Overview overview() {
        CurrentUser user = currentUser.require(Permissions.SETTINGS);
        MapSqlParameterSource p = latestParams(user.organizationId());
        Progress progress = jdbc.queryForObject(LATEST + """
                SELECT count(*) AS eligible,
                       count(*) FILTER (WHERE t.status IN ('TERMINE', 'PEU_LISIBLE')) AS done,
                       count(*) FILTER (WHERE t.status = 'EN_ATTENTE') AS pending,
                       count(*) FILTER (WHERE t.status = 'EN_COURS') AS running,
                       count(*) FILTER (WHERE t.status = 'ECHEC') AS failed,
                       count(*) FILTER (WHERE t.status = 'PEU_LISIBLE') AS low,
                       count(*) FILTER (WHERE t.id IS NULL) AS not_requested
                FROM latest l LEFT JOIN document_texts t ON t.version_id = l.id""", p,
                (rs, i) -> new Progress(rs.getLong("eligible"), rs.getLong("done"), rs.getLong("pending"),
                        rs.getLong("running"), rs.getLong("failed"), rs.getLong("low"), rs.getLong("not_requested"),
                        queue.settings(user.organizationId()).paused()));
        // Les plus récentes de la société ; les demandes « en cours » et « en attente » d'abord
        List<Job> recent = jdbc.query("""
                SELECT t.document_id, d.reference, d.title, v.version_no, t.status, t.pages_total, t.pages_done,
                       t.confidence, t.error, t.requested_at, t.finished_at
                FROM document_texts t JOIN documents d ON d.id = t.document_id JOIN document_versions v ON v.id = t.version_id
                WHERE t.organization_id = :org AND d.status <> 'ELIMINE'
                ORDER BY CASE t.status WHEN 'EN_COURS' THEN 0 WHEN 'EN_ATTENTE' THEN 1 ELSE 2 END,
                         coalesce(t.finished_at, t.requested_at) DESC
                LIMIT 20""", p,
                (rs, i) -> new Job(rs.getObject("document_id", UUID.class), rs.getString("reference"),
                        rs.getString("title"), rs.getInt("version_no"), rs.getString("status"),
                        (Integer) rs.getObject("pages_total"), rs.getInt("pages_done"), decimal(rs, "confidence"),
                        rs.getString("error"), instant(rs, "requested_at"), instant(rs, "finished_at")));
        return new Overview(progress, recent);
    }

    /** Demande la lecture de tous les documents qui ne l'ont jamais eue (déposés avant l'OCR). */
    @Transactional
    public Overview backfill() {
        CurrentUser user = currentUser.require(Permissions.SETTINGS);
        MapSqlParameterSource p = latestParams(user.organizationId());
        int n = jdbc.update(LATEST + """
                INSERT INTO document_texts (id, organization_id, document_id, version_id, status)
                SELECT gen_random_uuid(), :org, l.document_id, l.id, 'EN_ATTENTE' FROM latest l
                WHERE NOT EXISTS (SELECT 1 FROM document_texts t WHERE t.version_id = l.id)
                ON CONFLICT (version_id) DO NOTHING""", p);
        audit.log(user.organizationId(), user.id(), "OCR_RATTRAPAGE_LANCE", "ocr_settings",
                user.organizationId().toString(), Map.of("documents", n), null);
        return overview();
    }

    @Transactional
    public Overview retryFailed() {
        CurrentUser user = currentUser.require(Permissions.SETTINGS);
        int n = jdbc.update("""
                UPDATE document_texts SET status = 'EN_ATTENTE', requested_at = now(), error = NULL, attempts = 0,
                       finished_at = NULL, pages_done = 0
                WHERE organization_id = :org AND status = 'ECHEC'""", new MapSqlParameterSource("org", user.organizationId()));
        audit.log(user.organizationId(), user.id(), "OCR_RELANCE", "ocr_settings", user.organizationId().toString(),
                Map.of("documents", n), null);
        return overview();
    }

    // ───────── Interne ─────────

    /** Version actuelle de chaque document de la société, non éliminé, dans un format lisible. */
    private static final String LATEST = """
            WITH latest AS (
                SELECT * FROM (SELECT DISTINCT ON (v.document_id) v.id, v.document_id, v.mime_type
                               FROM document_versions v JOIN documents d ON d.id = v.document_id
                               WHERE d.organization_id = :org AND d.status <> 'ELIMINE'
                               ORDER BY v.document_id, v.version_no DESC) x
                WHERE x.mime_type IN (:mimes))
            """;

    private static MapSqlParameterSource latestParams(UUID org) {
        return new MapSqlParameterSource().addValue("org", org).addValue("mimes", List.copyOf(TextExtractor.SUPPORTED));
    }

    private SettingsDto dto(OcrQueue.Settings s) {
        return new SettingsDto(s.autoOnUpload(), s.languages(), s.detectOrientation(), s.searchablePdfDownload(),
                s.paused(), Tesseract.LANGUAGES, tesseract.available());
    }

    private static Double decimal(ResultSet rs, String column) throws SQLException {
        BigDecimal d = rs.getBigDecimal(column);
        return d == null ? null : d.doubleValue();
    }

    private static Instant instant(ResultSet rs, String column) throws SQLException {
        Timestamp t = rs.getTimestamp(column);
        return t == null ? null : t.toInstant();
    }
}
