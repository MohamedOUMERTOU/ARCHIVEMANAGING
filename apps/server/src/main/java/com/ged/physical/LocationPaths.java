package com.ged.physical;

import com.ged.common.TreePaths;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/** Chemin lisible d'un emplacement (« Siège › Étage 2 › Salle 204 »), recalculé à chaque lecture. */
@Component
public class LocationPaths {

    private final NamedParameterJdbcTemplate jdbc;

    public LocationPaths(NamedParameterJdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public String display(String idPath) {
        List<UUID> ids = TreePaths.ancestorIds(idPath);
        Map<UUID, String> labels = new HashMap<>();
        jdbc.query("SELECT id, label FROM physical_locations WHERE id IN (:ids)", Map.of("ids", ids),
                rs -> { labels.put(rs.getObject("id", UUID.class), rs.getString("label")); });
        return ids.stream().map(i -> labels.getOrDefault(i, "?")).collect(Collectors.joining(" › "));
    }
}
