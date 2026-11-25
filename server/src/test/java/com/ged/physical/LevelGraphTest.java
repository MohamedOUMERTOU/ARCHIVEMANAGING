package com.ged.physical;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class LevelGraphTest {

    private final UUID batiment = UUID.randomUUID();
    private final UUID salle = UUID.randomUUID();
    private final UUID armoire = UUID.randomUUID();
    private final UUID boite = UUID.randomUUID();
    // Bâtiment → Salle → Armoire → Boîte
    private final Map<UUID, List<UUID>> edges = Map.of(batiment, List.of(salle), salle, List.of(armoire), armoire, List.of(boite));

    @Test
    void accepteUnNouveauLienSansBoucle() {
        assertThat(LevelGraph.createsCycle(edges, salle, List.of(armoire, boite))).isFalse();
        assertThat(LevelGraph.createsCycle(edges, batiment, List.of(salle, boite))).isFalse();
    }

    @Test
    void refuseUnLienQuiFermeUneBoucle() {
        // Une boîte qui pourrait contenir un bâtiment, qui contient déjà la boîte
        assertThat(LevelGraph.createsCycle(edges, boite, List.of(batiment))).isTrue();
        assertThat(LevelGraph.createsCycle(edges, armoire, List.of(salle))).isTrue();
    }
}
