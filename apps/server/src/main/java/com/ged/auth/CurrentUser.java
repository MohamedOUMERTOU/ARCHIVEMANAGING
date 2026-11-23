package com.ged.auth;

import java.util.List;
import java.util.Set;
import java.util.UUID;

/** Utilisateur connecté, tel que le voit le code métier. */
public record CurrentUser(
        UUID id,
        UUID organizationId,
        String organizationCode,
        String organizationName,
        String email,
        String fullName,
        List<String> roles,
        Set<String> permissions) {

    public boolean can(String permission) {
        return permissions.contains("*") || permissions.contains(permission);
    }
}
