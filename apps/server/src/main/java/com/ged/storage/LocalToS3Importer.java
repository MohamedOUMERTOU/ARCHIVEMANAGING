package com.ged.storage;

import com.ged.config.GedProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

/**
 * Passage du stockage local à S3 sans perte : au démarrage, chaque version connue de la base dont
 * l'objet manque dans le bucket est envoyée depuis l'ancien dossier ({@code ged.storage.import-dir}).
 * Les clés sont identiques dans les deux stockages. Sans effet une fois tout copié : on peut laisser
 * l'option active, ou la retirer avec l'ancien volume.
 */
@Component
@Order(0)
@ConditionalOnProperty(name = "ged.storage.type", havingValue = "s3")
public class LocalToS3Importer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LocalToS3Importer.class);

    private final GedProperties props;
    private final FileStorage storage;
    private final JdbcTemplate jdbc;

    public LocalToS3Importer(GedProperties props, FileStorage storage, JdbcTemplate jdbc) {
        this.props = props;
        this.storage = storage;
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        String dir = props.storage().importDir();
        if (!StringUtils.hasText(dir) || !(storage instanceof S3FileStorage s3)) return;
        Path root = Path.of(dir).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) return;

        int[] counts = new int[3]; // copiés, déjà présents, introuvables
        jdbc.query("""
                SELECT storage_key, mime_type, sha256 FROM document_versions
                UNION ALL
                SELECT searchable_key, 'application/pdf', searchable_sha256 FROM document_texts
                WHERE searchable_key IS NOT NULL""", rs -> {
            String key = rs.getString(1);
            if (s3.exists(key)) {
                counts[1]++;
                return;
            }
            Path file = root.resolve(key).normalize();
            if (!file.startsWith(root) || !Files.isRegularFile(file)) {
                counts[2]++;
                log.warn("Import S3 : fichier absent de l'ancien stockage pour la clé {}", key);
                return;
            }
            s3.put(key, file, rs.getString(2), rs.getString(3));
            counts[0]++;
        });
        if (counts[0] > 0 || counts[2] > 0) {
            log.info("Import vers le bucket « {} » : {} fichier(s) copié(s), {} déjà présent(s), {} introuvable(s)",
                    s3.bucket(), counts[0], counts[1], counts[2]);
        }
    }
}
