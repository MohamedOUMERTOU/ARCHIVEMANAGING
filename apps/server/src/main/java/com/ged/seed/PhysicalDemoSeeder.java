package com.ged.seed;

import com.ged.config.GedProperties;
import com.ged.physical.PhysicalService;
import com.ged.physical.PhysicalService.LevelInput;
import com.ged.physical.PhysicalService.LoanInput;
import com.ged.physical.PhysicalService.LocationInput;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Archives physiques de démonstration pour la société EXSA, si elle n'a encore aucun niveau.
 * Séparé de DemoDataSeeder pour s'appliquer aussi aux bases déjà remplies avant cette fonctionnalité.
 * Passe par PhysicalService, sous l'identité de l'administrateur : historique et audit sont réels.
 */
@Component
@Order(2)
public class PhysicalDemoSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PhysicalDemoSeeder.class);

    private final GedProperties props;
    private final NamedParameterJdbcTemplate jdbc;
    private final PhysicalService physical;

    public PhysicalDemoSeeder(GedProperties props, NamedParameterJdbcTemplate jdbc, PhysicalService physical) {
        this.props = props;
        this.jdbc = jdbc;
        this.physical = physical;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.demoData().enabled()) return;
        List<UUID> orgs = jdbc.queryForList("SELECT id FROM organizations WHERE code = 'EXSA'", Map.of(), UUID.class);
        if (orgs.isEmpty()) return;
        UUID org = orgs.get(0);
        Long levels = jdbc.queryForObject("SELECT count(*) FROM location_levels WHERE organization_id = :o", Map.of("o", org), Long.class);
        if (levels != null && levels > 0) return;
        List<UUID> admins = jdbc.queryForList("""
                SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id JOIN roles r ON r.id = ur.role_id
                WHERE u.organization_id = :o AND u.active AND '*' = ANY(r.permissions) LIMIT 1
                """, Map.of("o", org), UUID.class);
        if (admins.isEmpty()) return;

        try {
            SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(Jwt.withTokenValue("seed")
                    .header("alg", "none").subject(admins.get(0).toString()).build()));
            seed(org);
            log.info("Archives physiques de démonstration créées.");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private void seed(UUID org) {
        UUID batiment = level("BATIMENT", "Bâtiment", true, false, null);
        UUID etage = level("ETAGE", "Étage", false, false, null);
        UUID salle = level("SALLE", "Salle", false, false, null);
        UUID armoire = level("ARMOIRE", "Armoire", false, false, null);
        UUID rayonnage = level("RAYONNAGE", "Rayonnage", false, false, null);
        UUID etagere = level("ETAGERE", "Étagère", false, false, null);
        UUID boite = level("BOITE", "Boîte", false, true, 40);
        physical.setChildren(batiment, List.of(etage, salle));
        physical.setChildren(etage, List.of(salle));
        physical.setChildren(salle, List.of(armoire, rayonnage));
        physical.setChildren(armoire, List.of(etagere));
        physical.setChildren(rayonnage, List.of(etagere));
        physical.setChildren(etagere, List.of(boite));

        UUID siege = loc(null, batiment, "SIEGE", "Siège", null);
        UUID e2 = loc(siege, etage, "SIEGE-E2", "Étage 2", null);
        UUID s204 = loc(e2, salle, "S-204", "Salle 204", null);
        UUID a3 = loc(s204, armoire, "ARM-A3", "Armoire A3", "LOC-000418");
        UUID et1 = loc(a3, etagere, "ARM-A3-E1", "Étagère 1", null);
        UUID et2 = loc(a3, etagere, "ARM-A3-E2", "Étagère 2", null);
        loc(et1, boite, "B-110", "Boîte B-110", "LOC-000510");
        UUID b111 = loc(et2, boite, "B-111", "Boîte B-111", "LOC-000511");
        UUID b112 = loc(et2, boite, "B-112", "Boîte B-112", "LOC-000512");
        UUID s205 = loc(e2, salle, "S-205", "Salle 205", null);
        UUID r2 = loc(s205, rayonnage, "RAY-R2", "Rayonnage R2", null);
        UUID r2e = loc(r2, etagere, "RAY-R2-E1", "Étagère 1", null);
        UUID j004 = loc(r2e, boite, "J-004", "Boîte J-004", "LOC-000604");
        UUID nord = loc(null, batiment, "NORD", "Entrepôt Zone Nord", null);
        loc(nord, salle, "NORD-AI", "Salle d'archives intermédiaires", null);

        // Rangement des originaux de démonstration
        place(org, "FIN/CPT/FF-2025-%", b112);
        place(org, "JUR/CTR-%", j004);
        physical.createLoan(new LoanInput(b111, null, "Cabinet d'audit externe", "PRET", "Audit annuel",
                LocalDate.now().plusDays(14)));
    }

    private UUID level(String code, String name, boolean root, boolean hold, Integer capacity) {
        return physical.createLevel(new LevelInput(code, name, root, hold, capacity)).id();
    }

    private UUID loc(UUID parent, UUID level, String code, String label, String barcode) {
        return physical.create(new LocationInput(parent, level, code, label, barcode, true)).location().id();
    }

    private void place(UUID org, String referencePattern, UUID box) {
        jdbc.queryForList("SELECT id FROM documents WHERE organization_id = :o AND reference LIKE :r",
                        Map.of("o", org, "r", referencePattern), UUID.class)
                .forEach(doc -> physical.placeDocument(doc, box));
    }
}
