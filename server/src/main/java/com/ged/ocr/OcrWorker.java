package com.ged.ocr;

import com.ged.storage.FileStorage;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Configuration;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.core.namedparam.SqlParameterSource;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Traitement en arrière-plan des demandes de lecture, une à la fois, dans l'ordre d'arrivée.
 * Plusieurs serveurs peuvent tourner ensemble : chaque demande est réservée (SKIP LOCKED) par un seul.
 * Une demande dont le traitement ne donne plus signe de vie (serveur arrêté) est remise en attente,
 * trois fois au plus.
 */
@Component
public class OcrWorker {

    private static final Logger log = LoggerFactory.getLogger(OcrWorker.class);
    private static final int MAX_ATTEMPTS = 3;

    @Configuration
    @EnableScheduling
    static class Scheduling {}

    private record Job(UUID id, UUID organizationId, UUID documentId, UUID versionId, String previousCopy,
                       String storageKey, String mime) {}

    private final NamedParameterJdbcTemplate jdbc;
    private final TransactionTemplate tx;
    private final FileStorage storage;
    private final TextExtractor extractor;
    private final OcrQueue queue;
    private final OcrProperties props;

    public OcrWorker(NamedParameterJdbcTemplate jdbc, TransactionTemplate tx, FileStorage storage,
                     TextExtractor extractor, OcrQueue queue, OcrProperties props) {
        this.jdbc = jdbc;
        this.tx = tx;
        this.storage = storage;
        this.extractor = extractor;
        this.queue = queue;
        this.props = props;
    }

    @Scheduled(fixedDelayString = "${ged.ocr.poll-ms:5000}", initialDelayString = "${ged.ocr.initial-delay-ms:15000}")
    public void poll() {
        if (!props.enabled()) return;
        try {
            recoverStalled();
            Job job;
            while ((job = claim()) != null) process(job);
        } catch (RuntimeException e) {
            log.error("Reconnaissance de texte : erreur inattendue", e);
        }
    }

    /** Demandes « en cours » sans nouvelles : remises en attente, ou en échec après trois tentatives. */
    void recoverStalled() {
        Duration stale = props.pageTimeout().multipliedBy(5).plusMinutes(1);
        var p = new MapSqlParameterSource().addValue("stale", stale.toSeconds()).addValue("max", MAX_ATTEMPTS);
        jdbc.update("""
                UPDATE document_texts SET status = CASE WHEN attempts >= :max THEN 'ECHEC' ELSE 'EN_ATTENTE' END,
                       error = CASE WHEN attempts >= :max THEN 'Traitement interrompu à plusieurs reprises' END,
                       finished_at = CASE WHEN attempts >= :max THEN now() END
                WHERE status = 'EN_COURS' AND coalesce(heartbeat_at, started_at) < now() - make_interval(secs => :stale)""", p);
    }

    private Job claim() {
        List<Job> jobs = jdbc.query("""
                UPDATE document_texts t SET status = 'EN_COURS', started_at = now(), heartbeat_at = now(),
                       attempts = t.attempts + 1, pages_done = 0, pages_total = NULL, error = NULL
                FROM document_versions v
                WHERE v.id = t.version_id AND t.id = (
                    SELECT x.id FROM document_texts x
                    JOIN documents d ON d.id = x.document_id
                    LEFT JOIN ocr_settings s ON s.organization_id = x.organization_id
                    WHERE x.status = 'EN_ATTENTE' AND d.status <> 'ELIMINE' AND NOT coalesce(s.paused, false)
                    ORDER BY x.requested_at LIMIT 1
                    FOR UPDATE OF x SKIP LOCKED)
                RETURNING t.id, t.organization_id, t.document_id, t.version_id, t.searchable_key, v.storage_key, v.mime_type""",
                new MapSqlParameterSource(),
                (rs, i) -> new Job(rs.getObject(1, UUID.class), rs.getObject(2, UUID.class), rs.getObject(3, UUID.class),
                        rs.getObject(4, UUID.class), rs.getString(5), rs.getString(6), rs.getString(7)));
        return jobs.isEmpty() ? null : jobs.get(0);
    }

    private void process(Job job) {
        long start = System.nanoTime();
        Path work = null;
        FileStorage.Stored copy = null;
        try {
            work = Files.createTempDirectory("ged-ocr-");
            Path source = work.resolve("source");
            try (InputStream in = storage.load(job.storageKey()).getInputStream()) {
                Files.copy(in, source);
            }
            OcrQueue.Settings settings = queue.settings(job.organizationId());
            List<String> languages = settings.languages().isEmpty() ? List.of("fra") : settings.languages();
            TextExtractor.Extraction x = extractor.extract(source, job.mime(),
                    new TextExtractor.Options(languages, settings.detectOrientation()), work,
                    (done, total) -> jdbc.update("""
                            UPDATE document_texts SET pages_done = :done, pages_total = :total, heartbeat_at = now()
                            WHERE id = :id""", new MapSqlParameterSource().addValue("done", done)
                            .addValue("total", total).addValue("id", job.id())));
            if (x.searchablePdf() != null) {
                try (InputStream in = Files.newInputStream(x.searchablePdf())) {
                    copy = storage.store(job.organizationId(), in, "application/pdf");
                }
            }
            FileStorage.Stored stored = copy;
            boolean saved = Boolean.TRUE.equals(tx.execute(s -> save(job, x, languages, stored)));
            if (!saved && copy != null) destroyQuietly(copy.key());
            log.info("Texte lu : document {} (version {}), {} page(s), méthode {}, {} ms", job.documentId(), job.versionId(),
                    x.pages().size(), x.method(), Duration.ofNanos(System.nanoTime() - start).toMillis());
        } catch (IOException | RuntimeException e) {
            if (copy != null) destroyQuietly(copy.key());
            String message = e instanceof TextExtractor.ExtractionException ? e.getMessage()
                    : "Le fichier n'a pas pu être lu";
            if (!(e instanceof TextExtractor.ExtractionException)) {
                log.warn("Lecture impossible : document {} (demande {})", job.documentId(), job.id(), e);
            }
            jdbc.update("""
                    UPDATE document_texts SET status = 'ECHEC', error = :error, finished_at = now()
                    WHERE id = :id AND status = 'EN_COURS'""",
                    new MapSqlParameterSource().addValue("error", truncate(message)).addValue("id", job.id()));
        } finally {
            if (work != null) deleteTree(work);
        }
    }

    /** Enregistre le texte ; ignoré si le document a été éliminé ou la demande relancée entre-temps. */
    private boolean save(Job job, TextExtractor.Extraction x, List<String> languages, FileStorage.Stored copy) {
        Integer still = jdbc.queryForObject("""
                SELECT count(*) FROM document_texts t JOIN documents d ON d.id = t.document_id
                WHERE t.id = :id AND t.status = 'EN_COURS' AND d.status <> 'ELIMINE'""",
                new MapSqlParameterSource("id", job.id()), Integer.class);
        if (still == null || still == 0) return false;

        jdbc.update("DELETE FROM document_text_pages WHERE text_id = :id", new MapSqlParameterSource("id", job.id()));
        List<SqlParameterSource> rows = new ArrayList<>();
        for (int i = 0; i < x.pages().size(); i++) {
            rows.add(new MapSqlParameterSource().addValue("id", job.id()).addValue("page", i + 1)
                    .addValue("content", x.pages().get(i)));
        }
        jdbc.batchUpdate("INSERT INTO document_text_pages (text_id, page_no, content) VALUES (:id, :page, :content)",
                rows.toArray(SqlParameterSource[]::new));
        // Index du document entier ; un très long texte est indexé sans la position des mots (taille limitée)
        long chars = x.pages().stream().mapToLong(String::length).sum();
        jdbc.update("""
                UPDATE document_texts SET tsv = (SELECT %s FROM document_text_pages WHERE text_id = :id)
                WHERE id = :id""".formatted(chars > 300_000
                        ? "strip(to_tsvector('ged_fr', coalesce(string_agg(content, E'\\n' ORDER BY page_no), '')))"
                        : "to_tsvector('ged_fr', coalesce(string_agg(content, E'\\n' ORDER BY page_no), ''))"),
                new MapSqlParameterSource("id", job.id()));

        boolean low = x.confidence() != null && x.confidence() < props.lowConfidence();
        jdbc.update("""
                UPDATE document_texts SET status = :status, method = :method, languages = CAST(:languages AS text[]),
                       pages_total = :pages, pages_done = :pages, confidence = :confidence, error = NULL,
                       searchable_key = :key, searchable_size = :size, searchable_sha256 = :sha, finished_at = now()
                WHERE id = :id""", new MapSqlParameterSource()
                .addValue("status", low ? "PEU_LISIBLE" : "TERMINE")
                .addValue("method", x.method().name())
                .addValue("languages", x.method() == TextExtractor.Method.NATIF ? null : OcrQueue.pgArray(languages))
                .addValue("pages", x.pages().size())
                .addValue("confidence", x.confidence() == null ? null : Math.round(x.confidence() * 100) / 100.0)
                .addValue("key", copy == null ? null : copy.key())
                .addValue("size", copy == null ? null : copy.size())
                .addValue("sha", copy == null ? null : copy.sha256())
                .addValue("id", job.id()));

        // L'ancienne copie (relance) n'est plus référencée : supprimée une fois l'enregistrement validé
        String previous = job.previousCopy();
        if (previous != null && (copy == null || !previous.equals(copy.key()))) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    destroyQuietly(previous);
                }
            });
        }
        return true;
    }

    private void destroyQuietly(String key) {
        try {
            storage.destroy(key);
        } catch (RuntimeException e) {
            log.warn("Copie consultable {} non supprimée : {}", key, e.getMessage());
        }
    }

    private static String truncate(String s) {
        return s == null ? null : s.length() > 500 ? s.substring(0, 500) : s;
    }

    private static void deleteTree(Path dir) {
        try (Stream<Path> files = Files.walk(dir)) {
            files.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException e) {
                    throw new UncheckedIOException(e);
                }
            });
        } catch (IOException | UncheckedIOException e) {
            log.warn("Dossier temporaire non supprimé : {}", dir);
        }
    }
}
