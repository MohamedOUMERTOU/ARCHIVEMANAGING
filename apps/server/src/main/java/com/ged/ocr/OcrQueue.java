package com.ged.ocr;

import java.sql.Array;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * File d'attente de la reconnaissance de texte et réglages par société. Utilisée par le dépôt de
 * documents (demande automatique) et par le traitement en arrière-plan ({@link OcrWorker}).
 */
@Component
public class OcrQueue {

    /** Réglages d'une société ; valeurs par défaut tant qu'ils n'ont jamais été modifiés. */
    public record Settings(boolean autoOnUpload, List<String> languages, boolean detectOrientation,
                           boolean searchablePdfDownload, boolean paused) {
        static final Settings DEFAULT = new Settings(true, List.of("fra", "ara"), true, false, false);
    }

    /** Copie PDF consultable d'une version (texte reconnu en couche invisible). */
    public record Copy(String key, long size, String sha256) {}

    private final NamedParameterJdbcTemplate jdbc;

    public OcrQueue(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public static boolean supports(String mime) {
        return mime != null && TextExtractor.SUPPORTED.contains(mime);
    }

    public Settings settings(UUID organizationId) {
        List<Settings> found = jdbc.query("""
                SELECT auto_on_upload, languages, detect_orientation, searchable_pdf_download, paused
                FROM ocr_settings WHERE organization_id = :org""", new MapSqlParameterSource("org", organizationId),
                (rs, i) -> new Settings(rs.getBoolean(1), languages(rs.getArray(2)), rs.getBoolean(3),
                        rs.getBoolean(4), rs.getBoolean(5)));
        return found.isEmpty() ? Settings.DEFAULT : found.get(0);
    }

    /** Au dépôt d'un fichier : demande de lecture, si la société l'a activée et si le format s'y prête. */
    public void onNewVersion(UUID organizationId, UUID documentId, UUID versionId, String mime) {
        if (supports(mime) && settings(organizationId).autoOnUpload()) request(organizationId, documentId, versionId);
    }

    /**
     * (Re)met une version dans la file. Sans effet si elle est déjà en attente ou en cours.
     * @return true si une demande a été créée ou relancée
     */
    public boolean request(UUID organizationId, UUID documentId, UUID versionId) {
        int n = jdbc.update("""
                INSERT INTO document_texts (id, organization_id, document_id, version_id, status)
                VALUES (:id, :org, :doc, :version, 'EN_ATTENTE')
                ON CONFLICT (version_id) DO UPDATE
                   SET status = 'EN_ATTENTE', requested_at = now(), error = NULL, pages_done = 0,
                       started_at = NULL, finished_at = NULL
                 WHERE document_texts.status NOT IN ('EN_ATTENTE', 'EN_COURS')""",
                new MapSqlParameterSource().addValue("id", UUID.randomUUID()).addValue("org", organizationId)
                        .addValue("doc", documentId).addValue("version", versionId));
        return n > 0;
    }

    public Optional<Copy> copyOf(UUID versionId) {
        return jdbc.query("""
                SELECT searchable_key, searchable_size, searchable_sha256 FROM document_texts
                WHERE version_id = :v AND searchable_key IS NOT NULL""", new MapSqlParameterSource("v", versionId),
                (rs, i) -> new Copy(rs.getString(1), rs.getLong(2), rs.getString(3))).stream().findFirst();
    }

    /** Littéral de tableau PostgreSQL ; les codes de langue viennent d'une liste fermée. */
    static String pgArray(List<String> values) {
        return "{" + String.join(",", values) + "}";
    }

    static List<String> languages(Array array) throws SQLException {
        return array == null ? List.of() : Arrays.asList((String[]) array.getArray());
    }
}
