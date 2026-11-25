package com.ged.physical;

import java.util.ArrayDeque;
import java.util.Collection;
import java.util.Deque;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Règle « qui peut contenir quoi » entre niveaux : un graphe parent → enfants autorisés.
 * Il ne doit jamais contenir de boucle (une boîte qui pourrait contenir un bâtiment qui contient la boîte).
 */
public final class LevelGraph {

    private LevelGraph() {}

    /**
     * Vrai si donner à {@code level} les enfants {@code newChildren} crée une boucle,
     * c'est-à-dire si {@code level} peut déjà être atteint depuis l'un de ces enfants.
     */
    public static boolean createsCycle(Map<UUID, ? extends Collection<UUID>> edges, UUID level, Collection<UUID> newChildren) {
        Deque<UUID> todo = new ArrayDeque<>(newChildren);
        Set<UUID> seen = new HashSet<>();
        while (!todo.isEmpty()) {
            UUID current = todo.pop();
            if (current.equals(level)) return true;
            if (!seen.add(current)) continue;
            Collection<UUID> next = edges.get(current);
            if (next != null) todo.addAll(next);
        }
        return false;
    }
}
