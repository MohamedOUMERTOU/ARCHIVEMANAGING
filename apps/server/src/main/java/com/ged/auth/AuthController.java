package com.ged.auth;

import com.ged.config.GedProperties;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import java.time.Duration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    static final String COOKIE = "ged_refresh";
    private static final String COOKIE_PATH = "/api/auth";

    private final AuthService auth;
    private final CurrentUserProvider currentUser;
    private final GedProperties props;

    public AuthController(AuthService auth, CurrentUserProvider currentUser, GedProperties props) {
        this.auth = auth;
        this.currentUser = currentUser;
        this.props = props;
    }

    public record LoginRequest(
            @NotBlank(message = "Saisissez votre adresse e-mail") @Email(message = "Adresse e-mail invalide") String email,
            @NotBlank(message = "Saisissez votre mot de passe") String password) {}

    @PostMapping("/login")
    ResponseEntity<AuthService.SessionDto> login(@Valid @RequestBody LoginRequest body, HttpServletRequest request) {
        return withCookie(auth.login(body.email(), body.password(), request.getRemoteAddr()));
    }

    @PostMapping("/refresh")
    ResponseEntity<AuthService.SessionDto> refresh(@CookieValue(name = COOKIE, required = false) String token) {
        return withCookie(auth.refresh(token));
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(@CookieValue(name = COOKIE, required = false) String token) {
        auth.logout(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO).toString()).build();
    }

    @GetMapping("/me")
    CurrentUser me() {
        return currentUser.get();
    }

    private ResponseEntity<AuthService.SessionDto> withCookie(AuthService.Issued issued) {
        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, cookie(issued.refreshToken(), props.jwt().refreshTokenTtl()).toString())
                .body(issued.session());
    }

    /** Cookie illisible par JavaScript, envoyé seulement aux routes d'authentification. */
    private ResponseCookie cookie(String value, Duration maxAge) {
        return ResponseCookie.from(COOKIE, value)
                .httpOnly(true)
                .secure(props.cookie().secure())
                .sameSite("Strict")
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}
