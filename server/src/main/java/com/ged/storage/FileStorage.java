package com.ged.storage;

import java.io.InputStream;
import java.time.YearMonth;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.io.Resource;

/**
 * Stockage du contenu des documents. Deux implémentations, choisies par {@code ged.storage.type} :
 * {@link LocalFileStorage} (dossier sur disque) et {@link S3FileStorage} (MinIO ou service compatible S3).
 *
 * <p>Les clés sont générées ici ({@code société/année/mois/uuid}) : le nom d'origine du fichier n'est
 * jamais utilisé comme chemin. Les fichiers ne sont jamais modifiés ni supprimés par l'application :
 * une nouvelle version produit une nouvelle clé.
 */
public interface FileStorage {

    /** Résultat d'un enregistrement : clé, taille et empreinte SHA-256 calculées pendant la copie. */
    record Stored(String key, long size, String sha256) {}

    Stored store(UUID organizationId, InputStream content, String contentType);

    /** Contenu d'un fichier ; 404 s'il n'existe pas. */
    Resource load(String key);

    /**
     * Destruction définitive d'un fichier, toutes versions comprises. Appelée à l'exécution d'un bordereau
     * d'élimination visé, et pour remplacer une copie portant le texte reconnu (fichier produit par
     * l'application, jamais un fichier déposé) ; sans effet si le fichier n'existe plus.
     */
    void destroy(String key);

    /** Description affichée dans l'écran d'administration du stockage. */
    record Info(String type, String location, String endpoint, String bucket) {}

    Info info();

    /** Vérifie que le stockage répond ; lève une exception sinon. */
    void ping();

    /** Inventaire des fichiers dont la clé commence par {@code prefix} : clé → taille en octets. */
    Map<String, Long> list(String prefix);

    static String newKey(UUID organizationId) {
        YearMonth month = YearMonth.now();
        return "%s/%d/%02d/%s".formatted(organizationId, month.getYear(), month.getMonthValue(), UUID.randomUUID());
    }
}
