package com.ged.lifecycle;

import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.common.ApiException;
import com.ged.common.Json;
import com.ged.document.DocumentEvent;
import com.ged.document.DocumentEventType;
import com.ged.document.DocumentRepositories;
import com.ged.physical.LocationPaths;
import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Outils communs aux services du cycle de vie. */
@Component
class LifecycleSupport {

    static final String MANAGE = com.ged.user.Permissions.LIFECYCLE_MANAGE;
    static final String APPROVE = com.ged.user.Permissions.LIFECYCLE_APPROVE;

    /** Statuts d'un document classé dont le sort final n'est pas encore appliqué. */
    static final List<String> LIVE = List.of("ACTIVE", "INTERMEDIAIRE");

    private final CurrentUserProvider currentUser;
    private final DocumentRepositories.Events events;
    private final NamedParameterJdbcTemplate jdbc;
    private final Json json;
    private final LocationPaths locationPaths;

    LifecycleSupport(CurrentUserProvider currentUser, DocumentRepositories.Events events,
                     NamedParameterJdbcTemplate jdbc, Json json, LocationPaths locationPaths) {
        this.currentUser = currentUser;
        this.events = events;
        this.jdbc = jdbc;
        this.json = json;
        this.locationPaths = locationPaths;
    }

    /** Utilisateur courant, s'il a au moins une des permissions. */
    CurrentUser requireAny(String... permissions) {
        CurrentUser user = currentUser.get();
        if (Arrays.stream(permissions).noneMatch(user::can)) {
            throw ApiException.forbidden("Vous n'avez pas les droits nécessaires sur le cycle de vie");
        }
        return user;
    }

    void event(CurrentUser user, UUID documentId, DocumentEventType type, String reason, Map<String, Object> before,
               Map<String, Object> after) {
        events.save(new DocumentEvent(user.organizationId(), documentId, type, user.id(), null,
                reason == null || reason.isBlank() ? null : reason.trim(),
                before == null ? null : json.write(before), after == null ? null : json.write(after)));
    }

    /** Recalcule la synthèse documents.legal_hold : vrai si le document figure dans au moins un gel actif. */
    void syncHoldFlags(Collection<UUID> documentIds) {
        if (documentIds.isEmpty()) return;
        jdbc.update("""
                UPDATE documents d SET legal_hold = EXISTS (
                    SELECT 1 FROM legal_hold_documents x JOIN legal_holds h ON h.id = x.hold_id
                    WHERE x.document_id = d.id AND h.released_at IS NULL)
                WHERE d.id IN (:ids)""", new MapSqlParameterSource("ids", documentIds));
    }

    /** Chemin lisible de l'emplacement de l'original papier, ou null. */
    String paperPath(String idPath) {
        return idPath == null ? null : locationPaths.display(idPath);
    }

    String required(String value, String field, String message) {
        if (value == null || value.isBlank()) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "VALIDATION", message,
                    Map.of(field, message));
        }
        return value.trim();
    }

    NamedParameterJdbcTemplate jdbc() {
        return jdbc;
    }

    static MapSqlParameterSource params(Object... kv) {
        MapSqlParameterSource p = new MapSqlParameterSource();
        for (int i = 0; i < kv.length; i += 2) p.addValue((String) kv[i], kv[i + 1]);
        return p;
    }
}
