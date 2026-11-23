package com.ged.common;

import java.util.Arrays;
import java.util.List;
import java.util.UUID;

/**
 * Chemins d'ID des arbres : "/&lt;id racine&gt;/&lt;…&gt;/&lt;id&gt;/".
 * Le chemin lisible n'est jamais stocké : renommer un nœud ne touche à aucun chemin.
 */
public final class TreePaths {

    private TreePaths() {}

    public static String build(String parentPath, UUID id) {
        return (parentPath == null ? "/" : parentPath) + id + "/";
    }

    public static List<UUID> ancestorIds(String idPath) {
        return Arrays.stream(idPath.split("/")).filter(s -> !s.isEmpty()).map(UUID::fromString).toList();
    }

    public static int depth(String idPath) {
        return ancestorIds(idPath).size() - 1;
    }

    /** Vrai si candidate est le nœud path lui-même ou l'un de ses descendants. */
    public static boolean isSelfOrDescendant(String path, String candidate) {
        return candidate.startsWith(path);
    }
}
