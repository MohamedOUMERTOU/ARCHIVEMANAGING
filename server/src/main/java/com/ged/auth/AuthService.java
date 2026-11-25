package com.ged.auth;

import com.ged.audit.AuditService;
import com.ged.common.ApiException;
import com.ged.config.GedProperties;
import com.ged.user.User;
import com.ged.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthService {

    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtEncoder jwtEncoder;
    private final AuditService audit;
    private final GedProperties props;
    // Empreinte bcrypt réelle : si l'e-mail n'existe pas, la vérification prend le même temps
    private final String dummyHash;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens, PasswordEncoder passwordEncoder,
                       JwtEncoder jwtEncoder, AuditService audit, GedProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtEncoder = jwtEncoder;
        this.audit = audit;
        this.props = props;
        this.dummyHash = passwordEncoder.encode(UUID.randomUUID().toString());
    }

    /** Session renvoyée au navigateur, plus le jeton de rafraîchissement à poser en cookie. */
    public record Issued(SessionDto session, String refreshToken) {}

    public record SessionDto(String accessToken, UserDto user) {}

    public record UserDto(UUID id, String email, String fullName, OrganizationDto organization,
                          List<String> roles, Set<String> permissions) {}

    public record OrganizationDto(UUID id, String code, String name) {}

    @Transactional(noRollbackFor = ApiException.class)
    public Issued login(String email, String password, String ip) {
        User user = users.findByEmail(email.toLowerCase().trim()).orElse(null);
        boolean passwordOk = passwordEncoder.matches(password, user == null ? dummyHash : user.getPasswordHash());
        if (user == null || !passwordOk || !user.isActive() || !user.getOrganization().isActive()) {
            audit.log(user == null ? null : user.getOrganization().getId(), null, "CONNEXION_REFUSEE", "user",
                    email, Map.of(), ip);
            // Même message dans tous les cas : on ne révèle pas si le compte existe
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_CREDENTIALS", "E-mail ou mot de passe incorrect");
        }
        audit.log(user.getOrganization().getId(), user.getId(), "CONNEXION", "user", user.getId().toString(), Map.of(), ip);
        return issue(user);
    }

    @Transactional(noRollbackFor = ApiException.class)
    public Issued refresh(String rawToken) {
        Instant now = Instant.now();
        RefreshToken token = rawToken == null ? null : refreshTokens.findByTokenHash(sha256(rawToken)).orElse(null);
        if (token == null) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_SESSION", "Session expirée, reconnectez-vous");
        }
        if (!token.isUsable(now)) {
            // Un jeton déjà utilisé qui revient peut avoir été volé : on ferme toutes les sessions de l'utilisateur
            refreshTokens.revokeAllForUser(token.getUserId(), now);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "NO_SESSION", "Session expirée, reconnectez-vous");
        }
        token.revoke(now);
        User user = users.findWithRolesById(token.getUserId())
                .filter(u -> u.isActive() && u.getOrganization().isActive())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "Compte désactivé"));
        return issue(user);
    }

    @Transactional
    public void logout(String rawToken) {
        if (rawToken == null) return;
        refreshTokens.findByTokenHash(sha256(rawToken)).ifPresent(t -> t.revoke(Instant.now()));
    }

    private Issued issue(User user) {
        Instant now = Instant.now();
        CurrentUser current = CurrentUserProvider.toCurrentUser(user);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("ged")
                .subject(user.getId().toString())
                .claim("org", user.getOrganization().getId().toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.jwt().accessTokenTtl()))
                .build();
        String accessToken = jwtEncoder
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims))
                .getTokenValue();

        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        refreshTokens.save(new RefreshToken(user.getId(), sha256(refresh), now.plus(props.jwt().refreshTokenTtl())));

        var org = new OrganizationDto(current.organizationId(), current.organizationCode(), current.organizationName());
        var dto = new UserDto(current.id(), current.email(), current.fullName(), org, current.roles(), current.permissions());
        return new Issued(new SessionDto(accessToken, dto), refresh);
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
