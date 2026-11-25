package com.ged.storage;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.config.GedProperties;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Administration du stockage des fichiers : état de la connexion, volume occupé par la société et
 * contrôle d'intégrité entre la base (versions de documents) et le stockage (objets).
 * Lecture seule : aucun fichier n'est supprimé ni modifié depuis cet écran.
 */
@Service
public class StorageAdminService {

    static final String PERMISSION = "settings.manage";
    private static final int MAX_LISTED = 100;

    private final FileStorage storage;
    private final GedProperties props;
    private final JdbcTemplate jdbc;
    private final CurrentUserProvider currentUser;
    private final AuditService audit;

    public StorageAdminService(FileStorage storage, GedProperties props, JdbcTemplate jdbc,
                               CurrentUserProvider currentUser, AuditService audit) {
        this.storage = storage;
        this.props = props;
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.audit = audit;
    }

    public record Usage(long documents, long versions, long bytes, Map<String, Long> bytesByType) {}

    public record Status(String type, String location, String endpoint, String bucket, String consoleUrl,
                         boolean reachable, Long latencyMs, String error, Usage usage) {}

    public record MissingFile(String key, UUID documentId, String reference, String title, int versionNo,
                              long expectedBytes) {}

    public record SizeMismatch(String key, UUID documentId, String reference, String title, int versionNo,
                               long expectedBytes, long actualBytes) {}

    public record CheckResult(Instant checkedAt, long durationMs, int expected, int ok, int missingCount,
                              int mismatchCount, int orphanCount, List<MissingFile> missing,
                              List<SizeMismatch> mismatches, List<String> orphans,
                              int residualCount, List<String> residual, boolean healthy) {}

    @Transactional(readOnly = true)
    public Status status() {
        CurrentUser user = currentUser.require(PERMISSION);
        FileStorage.Info info = storage.info();
        boolean reachable;
        Long latency = null;
        String error = null;
        long start = System.nanoTime();
        try {
            storage.ping();
            reachable = true;
            latency = Duration.ofNanos(System.nanoTime() - start).toMillis();
        } catch (RuntimeException e) {
            reachable = false;
            error = e.getMessage();
        }
        String console = props.storage().s3() == null ? null : props.storage().s3().consoleUrl();
        return new Status(info.type(), info.location(), info.endpoint(), info.bucket(),
                info.type().equals("s3") ? console : null, reachable, latency, error, usage(user.organizationId()));
    }

    private Usage usage(UUID orgId) {
        Map<String, Object> totals = jdbc.queryForMap("""
                SELECT count(DISTINCT d.id) AS documents, count(v.id) AS versions, coalesce(sum(v.size_bytes), 0) AS bytes
                FROM documents d JOIN document_versions v ON v.document_id = d.id
                WHERE d.organization_id = ? AND d.status <> 'ELIMINE'""", orgId);
        Map<String, Long> byType = new LinkedHashMap<>();
        jdbc.query("""
                SELECT v.mime_type, sum(v.size_bytes) FROM documents d
                JOIN document_versions v ON v.document_id = d.id
                WHERE d.organization_id = ? AND d.status <> 'ELIMINE' GROUP BY v.mime_type ORDER BY 2 DESC""",
                rs -> {
                    byType.put(rs.getString(1), rs.getLong(2));
                }, orgId);
        return new Usage(((Number) totals.get("documents")).longValue(), ((Number) totals.get("versions")).longValue(),
                ((Number) totals.get("bytes")).longValue(), byType);
    }

    private record Expected(String key, UUID documentId, String reference, String title, int versionNo, long size) {}

    /**
     * Compare les versions enregistrées en base avec les fichiers présents dans le stockage, pour la société
     * de l'utilisateur : fichiers manquants, tailles différentes, fichiers orphelins (sans version en base).
     */
    @Transactional
    public CheckResult check() {
        CurrentUser user = currentUser.require(PERMISSION);
        long start = System.nanoTime();
        List<Expected> expected = jdbc.query("""
                SELECT v.storage_key, d.id, d.reference, d.title, v.version_no, v.size_bytes
                FROM documents d JOIN document_versions v ON v.document_id = d.id
                WHERE d.organization_id = ? AND d.status <> 'ELIMINE'
                ORDER BY d.reference NULLS LAST, v.version_no""",
                (rs, i) -> new Expected(rs.getString(1), rs.getObject(2, UUID.class), rs.getString(3),
                        rs.getString(4), rs.getInt(5), rs.getLong(6)),
                user.organizationId());
        Map<String, Long> actual = new HashMap<>(storage.list(user.organizationId() + "/"));

        List<MissingFile> missing = new ArrayList<>();
        List<SizeMismatch> mismatches = new ArrayList<>();
        int ok = 0;
        int missingCount = 0;
        int mismatchCount = 0;
        for (Expected e : expected) {
            Long size = actual.remove(e.key());
            if (size == null) {
                missingCount++;
                if (missing.size() < MAX_LISTED) {
                    missing.add(new MissingFile(e.key(), e.documentId(), e.reference(), e.title(), e.versionNo(), e.size()));
                }
            } else if (size != e.size()) {
                mismatchCount++;
                if (mismatches.size() < MAX_LISTED) {
                    mismatches.add(new SizeMismatch(e.key(), e.documentId(), e.reference(), e.title(), e.versionNo(),
                            e.size(), size));
                }
            } else {
                ok++;
            }
        }
        // Copies portant le texte reconnu : fichiers produits par l'application, ni attendus ni orphelins
        jdbc.queryForList("""
                SELECT t.searchable_key FROM document_texts t JOIN documents d ON d.id = t.document_id
                WHERE t.organization_id = ? AND t.searchable_key IS NOT NULL AND d.status <> 'ELIMINE'""",
                String.class, user.organizationId()).forEach(actual::remove);
        // Fichiers de documents éliminés encore présents : la destruction n'a pas abouti
        List<String> eliminated = jdbc.queryForList("""
                SELECT v.storage_key FROM documents d JOIN document_versions v ON v.document_id = d.id
                WHERE d.organization_id = ? AND d.status = 'ELIMINE'
                UNION ALL
                SELECT t.searchable_key FROM document_texts t JOIN documents d ON d.id = t.document_id
                WHERE t.organization_id = ? AND d.status = 'ELIMINE' AND t.searchable_key IS NOT NULL""",
                String.class, user.organizationId(), user.organizationId());
        List<String> residualAll = eliminated.stream().filter(actual::containsKey).sorted().toList();
        residualAll.forEach(actual::remove);
        List<String> residual = residualAll.stream().limit(MAX_LISTED).toList();
        List<String> orphans = actual.keySet().stream().sorted().limit(MAX_LISTED).toList();
        long duration = Duration.ofNanos(System.nanoTime() - start).toMillis();
        boolean healthy = missingCount == 0 && mismatchCount == 0 && residualAll.isEmpty();

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("attendus", expected.size());
        details.put("conformes", ok);
        details.put("manquants", missingCount);
        details.put("tailleDifferente", mismatchCount);
        details.put("orphelins", actual.size());
        details.put("eliminesEncorePresents", residualAll.size());
        audit.log(user.organizationId(), user.id(), "STOCKAGE_VERIFIE", "storage", storage.info().location(),
                details, null);

        return new CheckResult(Instant.now(), duration, expected.size(), ok, missingCount, mismatchCount,
                actual.size(), missing, mismatches, orphans, residualAll.size(), residual, healthy);
    }
}
