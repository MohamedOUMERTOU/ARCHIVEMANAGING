package com.ged.document;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ged.common.ApiException;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class ViewTokenTest {

    private static final String SECRET = "secret-de-test-secret-de-test-secret-de-test";
    private final Instant now = Instant.parse("2026-11-22T10:00:00Z");
    private final ViewTokenService service = new ViewTokenService(SECRET, Clock.fixed(now, ZoneOffset.UTC));
    private final UUID doc = UUID.randomUUID();
    private final UUID user = UUID.randomUUID();

    @Test
    void unJetonValideRedonneSesInformations() {
        var claims = service.verify(service.create(doc, 2, user));
        assertThat(claims.documentId()).isEqualTo(doc);
        assertThat(claims.versionNo()).isEqualTo(2);
        assertThat(claims.userId()).isEqualTo(user);
        assertThat(claims.expiresAt()).isEqualTo(now.plus(ViewTokenService.TTL));
    }

    @Test
    void unJetonModifieEstRefuse() {
        String token = service.create(doc, 1, user);
        String autreVersion = service.create(doc, 2, user);
        // Corps d'un jeton + signature d'un autre
        String forged = autreVersion.substring(0, autreVersion.indexOf('.')) + token.substring(token.indexOf('.'));
        assertThatThrownBy(() -> service.verify(forged)).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.verify("n'importe.quoi")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> service.verify(null)).isInstanceOf(ApiException.class);
    }

    @Test
    void unJetonExpireEstRefuse() {
        String token = service.create(doc, 1, user);
        var later = new ViewTokenService(SECRET, Clock.fixed(now.plus(ViewTokenService.TTL).plusSeconds(1), ZoneOffset.UTC));
        assertThatThrownBy(() -> later.verify(token)).isInstanceOf(ApiException.class);
    }

    @Test
    void unAutreSecretNeValidePasLeJeton() {
        String token = service.create(doc, 1, user);
        var other = new ViewTokenService("autre-secret-autre-secret-autre-secret-xx", Clock.fixed(now, ZoneOffset.UTC));
        assertThatThrownBy(() -> other.verify(token)).isInstanceOf(ApiException.class);
    }
}
