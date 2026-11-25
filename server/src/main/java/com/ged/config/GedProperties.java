package com.ged.config;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Configuration propre à la GED (préfixe « ged » dans application.yml). */
@Validated
@ConfigurationProperties(prefix = "ged")
public record GedProperties(Jwt jwt, Cookie cookie, Storage storage, DemoData demoData) {

    public record Jwt(@NotBlank @Size(min = 32) String secret, Duration accessTokenTtl, Duration refreshTokenTtl) {}

    public record Cookie(boolean secure) {}

    /**
     * Stockage des fichiers.
     *
     * @param type      {@code local} (dossier sur disque) ou {@code s3} (MinIO ou tout service compatible S3)
     * @param dir       dossier des fichiers en mode local
     * @param importDir en mode s3 : ancien dossier local dont les fichiers absents du bucket sont copiés au démarrage
     */
    public record Storage(String type, String dir, String importDir, S3 s3) {
        public boolean isS3() {
            return "s3".equalsIgnoreCase(type);
        }
    }

    /**
     * Connexion S3. {@code pathStyle} doit valoir true pour MinIO (URL http://minio:9000/bucket/clé).
     * {@code consoleUrl} : adresse de la console d'administration (MinIO), affichée aux administrateurs.
     * {@code disposalAccessKey}/{@code disposalSecretKey} : compte distinct, seul autorisé à supprimer,
     * utilisé uniquement pour exécuter un bordereau d'élimination visé (facultatif).
     */
    public record S3(String endpoint, String region, String bucket, String accessKey, String secretKey,
                     boolean pathStyle, String consoleUrl, String disposalAccessKey, String disposalSecretKey) {}

    public record DemoData(boolean enabled) {}
}
