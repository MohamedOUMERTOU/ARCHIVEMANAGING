package com.ged.storage;

import com.ged.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.AbstractResource;
import org.springframework.core.io.Resource;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.HeadObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchBucketException;
import software.amazon.awssdk.services.s3.model.ObjectIdentifier;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * Fichiers dans un bucket S3 (MinIO en déploiement Docker).
 *
 * <p>Le flux reçu est d'abord copié dans un fichier temporaire : l'empreinte SHA-256 est ainsi
 * calculée une seule fois sur le contenu réel, et le SDK peut renvoyer le fichier en cas de
 * nouvelle tentative réseau sans fausser l'empreinte.
 */
public class S3FileStorage implements FileStorage {

    private static final Logger log = LoggerFactory.getLogger(S3FileStorage.class);

    private final S3Client s3;
    /** Client réservé aux destructions (compte distinct, seul autorisé à supprimer) ; à défaut, le client principal. */
    private final S3Client disposal;
    private final String bucket;
    private final String endpoint;

    public S3FileStorage(S3Client s3, String bucket, String endpoint) {
        this(s3, null, bucket, endpoint);
    }

    public S3FileStorage(S3Client s3, S3Client disposal, String bucket, String endpoint) {
        this.s3 = s3;
        this.disposal = disposal == null ? s3 : disposal;
        this.bucket = bucket;
        this.endpoint = endpoint;
    }

    /**
     * Supprime toutes les versions de l'objet et ses marqueurs de suppression : avec le versionnage
     * du bucket, une simple suppression laisserait le contenu récupérable.
     */
    @Override
    public void destroy(String key) {
        List<ObjectIdentifier> targets = new ArrayList<>();
        disposal.listObjectVersionsPaginator(r -> r.bucket(bucket).prefix(key)).forEach(page -> {
            page.versions().stream().filter(v -> v.key().equals(key))
                    .forEach(v -> targets.add(ObjectIdentifier.builder().key(key).versionId(v.versionId()).build()));
            page.deleteMarkers().stream().filter(m -> m.key().equals(key))
                    .forEach(m -> targets.add(ObjectIdentifier.builder().key(key).versionId(m.versionId()).build()));
        });
        if (targets.isEmpty()) return;
        for (int i = 0; i < targets.size(); i += 1000) {
            List<ObjectIdentifier> batch = targets.subList(i, Math.min(i + 1000, targets.size()));
            var res = disposal.deleteObjects(d -> d.bucket(bucket).delete(del -> del.objects(batch).quiet(true)));
            if (res.hasErrors() && !res.errors().isEmpty()) {
                throw new IllegalStateException("Destruction incomplète de " + key + " : " + res.errors().get(0).message());
            }
        }
    }

    @Override
    public Info info() {
        return new Info("s3", "s3://" + bucket, endpoint, bucket);
    }

    @Override
    public void ping() {
        s3.headBucket(b -> b.bucket(bucket));
    }

    @Override
    public Map<String, Long> list(String prefix) {
        Map<String, Long> result = new TreeMap<>();
        s3.listObjectsV2Paginator(r -> r.bucket(bucket).prefix(prefix))
                .contents()
                .forEach(o -> result.put(o.key(), o.size()));
        return result;
    }

    /** Ferme le client de destruction s'il est distinct (le client principal est un bean géré par Spring). */
    public void close() {
        if (disposal != s3) disposal.close();
    }

    /** Crée le bucket s'il n'existe pas encore (premier démarrage). Il reste privé : aucun accès anonyme. */
    public void ensureBucket() {
        try {
            s3.headBucket(b -> b.bucket(bucket));
        } catch (NoSuchBucketException e) {
            create();
        } catch (S3Exception e) {
            if (e.statusCode() != 404) throw e;
            create();
        }
    }

    private void create() {
        s3.createBucket(b -> b.bucket(bucket));
        log.info("Bucket « {} » créé", bucket);
    }

    public String bucket() {
        return bucket;
    }

    @Override
    public Stored store(UUID organizationId, InputStream content, String contentType) {
        String key = FileStorage.newKey(organizationId);
        Path tmp = null;
        try {
            tmp = Files.createTempFile("ged-upload-", ".tmp");
            Hashing.Copied copied = Hashing.copyTo(content, tmp);
            put(key, tmp, contentType, copied.sha256());
            return new Stored(key, copied.size(), copied.sha256());
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de l'enregistrement du fichier", e);
        } finally {
            if (tmp != null) {
                try {
                    Files.deleteIfExists(tmp);
                } catch (IOException ignored) {
                    // fichier temporaire : le système le nettoiera
                }
            }
        }
    }

    /** Envoi d'un fichier sous une clé donnée ; sert aussi à l'import depuis l'ancien stockage local. */
    void put(String key, Path file, String contentType, String sha256) {
        PutObjectRequest.Builder req = PutObjectRequest.builder()
                .bucket(bucket)
                .key(key)
                .contentType(contentType == null ? "application/octet-stream" : contentType);
        // Empreinte rangée avec l'objet : permet un contrôle d'intégrité indépendant de la base
        if (sha256 != null) req.metadata(Map.of("sha256", sha256));
        s3.putObject(req.build(), RequestBody.fromFile(file));
    }

    boolean exists(String key) {
        return head(key) != null;
    }

    @Override
    public Resource load(String key) {
        HeadObjectResponse head = head(key);
        if (head == null) throw ApiException.notFound("Fichier");
        return new S3ObjectResource(key, head.contentLength());
    }

    private HeadObjectResponse head(String key) {
        try {
            return s3.headObject(h -> h.bucket(bucket).key(key));
        } catch (S3Exception e) {
            if (e.statusCode() == 404) return null;
            throw e;
        }
    }

    /**
     * Objet S3 vu comme une {@link Resource} Spring : le contenu est lu en flux, sans passer en mémoire.
     * La taille connue permet à Spring de répondre aux requêtes partielles (Range) du lecteur PDF.
     */
    private final class S3ObjectResource extends AbstractResource {
        private final String key;
        private final long length;

        S3ObjectResource(String key, long length) {
            this.key = key;
            this.length = length;
        }

        @Override
        public InputStream getInputStream() {
            return s3.getObject(GetObjectRequest.builder().bucket(bucket).key(key).build());
        }

        @Override
        public long contentLength() {
            return length;
        }

        @Override
        public boolean exists() {
            return true;
        }

        @Override
        public String getDescription() {
            return "s3://" + bucket + "/" + key;
        }

        @Override
        public boolean equals(Object other) {
            return other instanceof S3ObjectResource r && r.key.equals(key);
        }

        @Override
        public int hashCode() {
            return key.hashCode();
        }
    }
}
