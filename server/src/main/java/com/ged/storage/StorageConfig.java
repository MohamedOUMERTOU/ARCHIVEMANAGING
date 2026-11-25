package com.ged.storage;

import com.ged.config.GedProperties;
import java.net.URI;
import java.nio.file.Path;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/** Choix du stockage selon {@code ged.storage.type} : {@code local} (par défaut) ou {@code s3}. */
@Configuration
public class StorageConfig {

    @Bean
    @ConditionalOnProperty(name = "ged.storage.type", havingValue = "local", matchIfMissing = true)
    FileStorage localFileStorage(GedProperties props) {
        String dir = props.storage().dir();
        if (!StringUtils.hasText(dir)) throw new IllegalStateException("ged.storage.dir est obligatoire en stockage local");
        return new LocalFileStorage(Path.of(dir));
    }

    @Bean(destroyMethod = "close")
    @ConditionalOnProperty(name = "ged.storage.type", havingValue = "s3")
    S3Client s3Client(GedProperties props) {
        GedProperties.S3 cfg = props.storage().s3();
        if (cfg == null || !StringUtils.hasText(cfg.bucket()) || !StringUtils.hasText(cfg.accessKey())
                || !StringUtils.hasText(cfg.secretKey())) {
            throw new IllegalStateException("Stockage s3 : bucket, access-key et secret-key sont obligatoires");
        }
        return client(cfg, cfg.accessKey(), cfg.secretKey());
    }

    @Bean
    @ConditionalOnProperty(name = "ged.storage.type", havingValue = "s3")
    FileStorage s3FileStorage(S3Client s3, GedProperties props) {
        GedProperties.S3 cfg = props.storage().s3();
        // Compte de destruction distinct (facultatif) : le compte courant de l'application ne peut rien supprimer
        S3Client disposal = StringUtils.hasText(cfg.disposalAccessKey()) && StringUtils.hasText(cfg.disposalSecretKey())
                ? client(cfg, cfg.disposalAccessKey(), cfg.disposalSecretKey())
                : null;
        S3FileStorage storage = new S3FileStorage(s3, disposal, cfg.bucket(), cfg.endpoint());
        storage.ensureBucket();
        return storage;
    }

    private static S3Client client(GedProperties.S3 cfg, String accessKey, String secretKey) {
        var builder = S3Client.builder()
                .region(Region.of(StringUtils.hasText(cfg.region()) ? cfg.region() : "us-east-1"))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKey, secretKey)))
                .forcePathStyle(cfg.pathStyle())
                // Sommes de contrôle seulement quand l'API l'exige : compatibilité avec MinIO et les autres S3
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED);
        if (StringUtils.hasText(cfg.endpoint())) builder.endpointOverride(URI.create(cfg.endpoint()));
        return builder.build();
    }
}
