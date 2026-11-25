package com.ged.seed;

import com.ged.config.GedProperties;
import com.ged.document.DocumentDtos.ClassifyCommand;
import com.ged.document.DocumentDtos.UploadResult;
import com.ged.document.DocumentService;
import com.ged.lifecycle.DisposalListService;
import com.ged.lifecycle.LegalHoldService;
import com.ged.lifecycle.LifecycleDtos.CreateHold;
import com.ged.lifecycle.LifecycleDtos.CreateList;
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
 * Cycle de vie de démonstration pour EXSA, si aucun gel ni bordereau n'existe encore :
 * contrats et dossiers du personnel anciens (donc échus), un gel juridique, et un bordereau
 * d'élimination préparé par l'archiviste, en attente du visa d'une autre personne.
 * Les rôles Archiviste et Juriste reçoivent les nouveaux droits du cycle de vie.
 */
@Component
@Order(3)
public class LifecycleDemoSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LifecycleDemoSeeder.class);

    private final GedProperties props;
    private final NamedParameterJdbcTemplate jdbc;
    private final DocumentService documents;
    private final LegalHoldService holds;
    private final DisposalListService lists;

    public LifecycleDemoSeeder(GedProperties props, NamedParameterJdbcTemplate jdbc, DocumentService documents,
                               LegalHoldService holds, DisposalListService lists) {
        this.props = props;
        this.jdbc = jdbc;
        this.documents = documents;
        this.holds = holds;
        this.lists = lists;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.demoData().enabled()) return;
        List<UUID> orgs = jdbc.queryForList("SELECT id FROM organizations WHERE code = 'EXSA'", Map.of(), UUID.class);
        if (orgs.isEmpty()) return;
        UUID org = orgs.get(0);
        Map<String, Object> o = Map.of("o", org);
        Long existing = jdbc.queryForObject("""
                SELECT (SELECT count(*) FROM legal_holds WHERE organization_id = :o)
                     + (SELECT count(*) FROM disposal_lists WHERE organization_id = :o)""", o, Long.class);
        if (existing != null && existing > 0) return;

        grant(org, "Archiviste", "lifecycle.manage");
        grant(org, "Juriste", "lifecycle.approve");
        UUID admin = user(org, "admin@exemple.com");
        UUID archiviste = user(org, "s.amrani@exemple.com");
        Map<String, UUID> nodes = ids("SELECT code, id FROM classification_nodes WHERE organization_id = :o", o);
        Map<String, UUID> types = ids("SELECT code, id FROM document_types WHERE organization_id = :o", o);
        if (admin == null || archiviste == null || !nodes.containsKey("JUR/CTR") || !nodes.containsKey("RH/DP")) return;

        try {
            as(admin);
            UUID ctr = nodes.get("JUR/CTR");
            UUID rh = nodes.get("RH/DP");
            UUID contrat = types.get("CONTRAT");
            UUID courrier = types.get("COURRIER");
            UUID nettoyage = doc("contrat_nettoyage_2016.pdf", ctr, contrat, "Contrat de nettoyage des locaux",
                    LocalDate.of(2016, 3, 1), Map.of("cocontractant", "Net Services Exemple"));
            UUID copieurs = doc("contrat_location_copieurs.pdf", ctr, contrat, "Contrat de location de photocopieurs",
                    LocalDate.of(2017, 5, 15), Map.of("cocontractant", "Bureautique Exemple"));
            doc("contrat_gardiennage_2018.pdf", ctr, contrat, "Contrat de gardiennage du site",
                    LocalDate.of(2018, 1, 10), Map.of("cocontractant", "Sécurité Exemple"));
            UUID energie = doc("contrat_energie_2018.pdf", ctr, contrat, "Contrat de fourniture d'énergie",
                    LocalDate.of(2018, 9, 1), Map.of("cocontractant", "Énergie Exemple"));
            doc("contrat_ascenseurs_2021.pdf", ctr, contrat, "Contrat de maintenance des ascenseurs",
                    LocalDate.of(2021, 2, 1), Map.of("cocontractant", "Ascenseurs Exemple"));
            doc("dossier_depart_2015.pdf", rh, courrier, "Dossier de départ - agent administratif",
                    LocalDate.of(2015, 6, 30), Map.of("expediteur", "Service RH"));
            doc("dossier_depart_2017.pdf", rh, courrier, "Dossier de départ - technicien de maintenance",
                    LocalDate.of(2017, 9, 30), Map.of("expediteur", "Service RH"));

            holds.create(new CreateHold("Litige fournisseur d'énergie", "TC-2026-0412",
                    "Contestation de la facturation 2019-2021 : conserver le contrat et ses annexes jusqu'au jugement",
                    List.of(energie)));

            // L'archiviste prépare et soumet ; le visa revient à une autre personne (administrateur ou juriste)
            as(archiviste);
            UUID list = lists.create(new CreateList("ELIMINATION", "Contrats de prestations échus (2016-2017)", null,
                    "Contrats arrivés au terme de leur durée de conservation, sans contentieux en cours.",
                    List.of(nettoyage, copieurs))).list().id();
            lists.submit(list);
            log.info("Cycle de vie de démonstration créé.");
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private UUID doc(String filename, UUID node, UUID type, String title, LocalDate date, Map<String, Object> metadata) {
        byte[] pdf = SimplePdf.page(List.of("SOCIETE EXEMPLE SA - document de demonstration", "", title, date.toString()));
        List<UploadResult> res = documents.upload(List.of(new BytesMultipartFile("files", filename, "application/pdf", pdf)));
        UUID id = res.get(0).id();
        documents.classify(id, new ClassifyCommand(node, type, title, date, metadata, List.of()));
        return id;
    }

    private void grant(UUID org, String role, String permission) {
        jdbc.update("""
                UPDATE roles SET permissions = array_append(permissions, :p)
                WHERE organization_id = :o AND name = :r AND NOT (:p = ANY(permissions))""",
                Map.of("o", org, "r", role, "p", permission));
    }

    private UUID user(UUID org, String email) {
        return jdbc.queryForList("SELECT id FROM users WHERE organization_id = :o AND email = :e AND active",
                Map.of("o", org, "e", email), UUID.class).stream().findFirst().orElse(null);
    }

    private Map<String, UUID> ids(String sql, Map<String, Object> params) {
        Map<String, UUID> out = new java.util.HashMap<>();
        jdbc.query(sql, params, rs -> {
            out.put(rs.getString(1), rs.getObject(2, UUID.class));
        });
        return out;
    }

    private static void as(UUID userId) {
        SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(Jwt.withTokenValue("seed")
                .header("alg", "none").subject(userId.toString()).build()));
    }
}
