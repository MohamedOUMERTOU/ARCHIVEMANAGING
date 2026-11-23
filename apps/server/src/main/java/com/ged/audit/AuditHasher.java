package com.ged.audit;

import com.ged.common.CanonicalJson;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

/**
 * Empreinte d'une entrée du journal, liée à celle de l'entrée précédente :
 * modifier ou supprimer une entrée casse toutes les empreintes qui suivent.
 */
public final class AuditHasher {

    private AuditHasher() {}

    public record Entry(
            UUID organizationId,
            UUID userId,
            String action,
            String entity,
            String entityId,
            Map<String, Object> details,
            String ip,
            Instant at) {}

    public static String hash(String prevHash, Entry e) {
        String payload = String.join("|",
                prevHash == null ? "GENESIS" : prevHash,
                String.valueOf(e.organizationId()),
                String.valueOf(e.userId()),
                e.action(),
                e.entity(),
                String.valueOf(e.entityId()),
                CanonicalJson.write(e.details()),
                String.valueOf(e.ip()),
                e.at().toString());
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(payload.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
