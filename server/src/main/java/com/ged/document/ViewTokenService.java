package com.ged.document;

import com.ged.common.ApiException;
import com.ged.config.GedProperties;
import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/**
 * Jeton de visualisation : permet à un &lt;iframe&gt; ou une &lt;img&gt; (qui ne peuvent pas envoyer
 * l'en-tête Authorization) d'afficher UNE version d'UN document, pour UN utilisateur, pendant 10 minutes.
 * Format : base64url(documentId:version:userId:expiration) "." base64url(HMAC-SHA256).
 */
@Service
public class ViewTokenService {

    public static final Duration TTL = Duration.ofMinutes(10);

    public record Claims(UUID documentId, int versionNo, UUID userId, Instant expiresAt) {}

    private final byte[] key;
    private final Clock clock;

    @Autowired
    public ViewTokenService(GedProperties props) {
        this(props.jwt().secret(), Clock.systemUTC());
    }

    ViewTokenService(String secret, Clock clock) {
        // Clé dérivée : un jeton de visualisation ne peut jamais servir de jeton JWT, et inversement
        this.key = hmac(secret.getBytes(StandardCharsets.UTF_8), "ged-view-token-v1".getBytes(StandardCharsets.UTF_8));
        this.clock = clock;
    }

    public String create(UUID documentId, int versionNo, UUID userId) {
        Instant exp = clock.instant().plus(TTL);
        String payload = documentId + ":" + versionNo + ":" + userId + ":" + exp.getEpochSecond();
        String body = b64(payload.getBytes(StandardCharsets.UTF_8));
        return body + "." + b64(hmac(key, body.getBytes(StandardCharsets.UTF_8)));
    }

    public Instant expiresAt(String token) {
        return verify(token).expiresAt();
    }

    public Claims verify(String token) {
        ApiException invalid = new ApiException(HttpStatus.UNAUTHORIZED, "BAD_VIEW_TOKEN", "Lien de visualisation invalide ou expiré");
        if (token == null) throw invalid;
        int dot = token.indexOf('.');
        if (dot <= 0) throw invalid;
        String body = token.substring(0, dot);
        byte[] expected = hmac(key, body.getBytes(StandardCharsets.UTF_8));
        byte[] given;
        try {
            given = Base64.getUrlDecoder().decode(token.substring(dot + 1));
        } catch (IllegalArgumentException e) {
            throw invalid;
        }
        // Comparaison en temps constant
        if (!MessageDigest.isEqual(expected, given)) throw invalid;

        String[] parts;
        try {
            parts = new String(Base64.getUrlDecoder().decode(body), StandardCharsets.UTF_8).split(":");
        } catch (IllegalArgumentException e) {
            throw invalid;
        }
        if (parts.length != 4) throw invalid;
        Claims claims = new Claims(UUID.fromString(parts[0]), Integer.parseInt(parts[1]), UUID.fromString(parts[2]),
                Instant.ofEpochSecond(Long.parseLong(parts[3])));
        if (!claims.expiresAt().isAfter(clock.instant())) throw invalid;
        return claims;
    }

    private static String b64(byte[] bytes) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static byte[] hmac(byte[] key, byte[] data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data);
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException(e);
        }
    }
}
