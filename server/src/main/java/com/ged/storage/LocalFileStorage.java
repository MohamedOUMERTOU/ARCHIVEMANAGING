package com.ged.storage;

import com.ged.common.ApiException;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Map;
import java.util.TreeMap;
import java.util.UUID;
import java.util.stream.Stream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;

/** Fichiers dans un dossier local (volume Docker). Utilisé en développement et par les tests. */
public class LocalFileStorage implements FileStorage {

    private final Path root;

    public LocalFileStorage(Path root) {
        this.root = root.toAbsolutePath().normalize();
        try {
            Files.createDirectories(this.root);
        } catch (IOException e) {
            throw new UncheckedIOException("Impossible de créer le dossier de stockage " + this.root, e);
        }
    }

    @Override
    public Stored store(UUID organizationId, InputStream content, String contentType) {
        String key = FileStorage.newKey(organizationId);
        Path target = resolve(key);
        try {
            Files.createDirectories(target.getParent());
            Path tmp = Files.createTempFile(target.getParent(), "upload-", ".tmp");
            try {
                Hashing.Copied copied = Hashing.copyTo(content, tmp);
                Files.move(tmp, target, StandardCopyOption.ATOMIC_MOVE);
                return new Stored(key, copied.size(), copied.sha256());
            } finally {
                Files.deleteIfExists(tmp);
            }
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de l'enregistrement du fichier", e);
        }
    }

    @Override
    public Resource load(String key) {
        Path path = resolve(key);
        if (!Files.isRegularFile(path)) throw ApiException.notFound("Fichier");
        return new FileSystemResource(path);
    }

    @Override
    public void destroy(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException("Échec de la destruction du fichier " + key, e);
        }
    }

    @Override
    public Info info() {
        return new Info("local", root.toString(), null, null);
    }

    @Override
    public void ping() {
        if (!Files.isDirectory(root) || !Files.isWritable(root)) {
            throw new IllegalStateException("Dossier de stockage inaccessible : " + root);
        }
    }

    @Override
    public Map<String, Long> list(String prefix) {
        Path start = resolve(prefix);
        Map<String, Long> result = new TreeMap<>();
        if (!Files.isDirectory(start)) return result;
        try (Stream<Path> files = Files.walk(start)) {
            files.filter(Files::isRegularFile)
                    .filter(p -> !p.getFileName().toString().endsWith(".tmp"))
                    .forEach(p -> {
                        try {
                            result.put(root.relativize(p).toString().replace('\\', '/'), Files.size(p));
                        } catch (IOException e) {
                            throw new UncheckedIOException(e);
                        }
                    });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return result;
    }

    private Path resolve(String key) {
        Path path = root.resolve(key).normalize();
        // Protection contre les chemins du type « ../../etc/passwd »
        if (!path.startsWith(root)) throw ApiException.badRequest("BAD_KEY", "Clé de stockage invalide");
        return path;
    }
}
