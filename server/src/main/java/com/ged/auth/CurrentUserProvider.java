package com.ged.auth;

import com.ged.common.ApiException;
import com.ged.user.Role;
import com.ged.user.User;
import com.ged.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Comparator;
import java.util.TreeSet;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

/**
 * Charge l'utilisateur du jeton à chaque requête (une seule fois par requête).
 * Les rôles sont relus en base : un retrait de droit prend effet immédiatement.
 */
@Component
public class CurrentUserProvider {

    private static final String ATTRIBUTE = CurrentUser.class.getName();

    private final UserRepository users;

    public CurrentUserProvider(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public CurrentUser get() {
        HttpServletRequest request = currentRequest();
        if (request != null && request.getAttribute(ATTRIBUTE) instanceof CurrentUser cached) {
            return cached;
        }
        if (!(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken jwt)) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentification requise");
        }
        User user = users.findWithRolesById(UUID.fromString(jwt.getToken().getSubject()))
                .filter(u -> u.isActive() && u.getOrganization().isActive())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "Compte désactivé"));
        CurrentUser current = toCurrentUser(user);
        if (request != null) request.setAttribute(ATTRIBUTE, current);
        return current;
    }

    public CurrentUser require(String permission) {
        CurrentUser user = get();
        if (!user.can(permission)) {
            throw ApiException.forbidden("Vous n'avez pas les droits nécessaires pour cette action");
        }
        return user;
    }

    public static CurrentUser toCurrentUser(User user) {
        var roles = user.getRoles().stream().sorted(Comparator.comparing(Role::getName)).toList();
        var permissions = new TreeSet<String>();
        roles.forEach(r -> permissions.addAll(r.getPermissions()));
        return new CurrentUser(user.getId(), user.getOrganization().getId(), user.getOrganization().getCode(),
                user.getOrganization().getName(), user.getEmail(), user.getFullName(),
                roles.stream().map(Role::getName).toList(), permissions);
    }

    private static HttpServletRequest currentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attrs
                ? attrs.getRequest()
                : null;
    }
}
