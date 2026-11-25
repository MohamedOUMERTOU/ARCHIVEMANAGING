package com.ged.seed;

import com.ged.classification.ClassificationService;
import com.ged.classification.NodeType;
import com.ged.config.GedProperties;
import com.ged.document.DocumentDtos.ClassifyCommand;
import com.ged.document.DocumentDtos.RequestKind;
import com.ged.document.DocumentDtos.UploadResult;
import com.ged.document.DocumentService;
import com.ged.document.DocumentType;
import com.ged.document.DocumentRepositories;
import com.ged.org.Organization;
import com.ged.org.OrganizationRepository;
import com.ged.retention.RetentionRule;
import com.ged.retention.RetentionRule.FinalAction;
import com.ged.retention.RetentionRule.StartEvent;
import com.ged.retention.RetentionRuleRepository;
import com.ged.user.Role;
import com.ged.user.RoleRepository;
import com.ged.user.User;
import com.ged.user.UserRepository;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Données de démonstration, créées au premier démarrage si la base est vide (DEMO_DATA=true).
 * Les documents passent par DocumentService, sous l'identité de l'administrateur :
 * cotes, durées de conservation, historique et journal d'audit sont donc réels.
 */
@Component
@org.springframework.core.annotation.Order(1)
public class DemoDataSeeder implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DemoDataSeeder.class);
    public static final String DEMO_PASSWORD = "demo1234";

    private final GedProperties props;
    private final OrganizationRepository organizations;
    private final RoleRepository roles;
    private final UserRepository users;
    private final RetentionRuleRepository rules;
    private final DocumentRepositories.Types types;
    private final ClassificationService classification;
    private final DocumentService documents;
    private final PasswordEncoder passwordEncoder;
    private final TransactionTemplate tx;

    public DemoDataSeeder(GedProperties props, OrganizationRepository organizations, RoleRepository roles,
                          UserRepository users, RetentionRuleRepository rules, DocumentRepositories.Types types,
                          ClassificationService classification, DocumentService documents,
                          PasswordEncoder passwordEncoder, TransactionTemplate tx) {
        this.props = props;
        this.organizations = organizations;
        this.roles = roles;
        this.users = users;
        this.rules = rules;
        this.types = types;
        this.classification = classification;
        this.documents = documents;
        this.passwordEncoder = passwordEncoder;
        this.tx = tx;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (!props.demoData().enabled() || organizations.count() > 0) return;
        log.warn("Base vide : création des données de démonstration (comptes « @exemple.com », mot de passe « {} »). "
                + "Désactivez DEMO_DATA en production.", DEMO_PASSWORD);

        Base base = tx.execute(status -> createBase());
        try {
            SecurityContextHolder.getContext().setAuthentication(new JwtAuthenticationToken(Jwt.withTokenValue("seed")
                    .header("alg", "none").subject(base.adminId().toString()).build()));
            createTreeAndDocuments(base);
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private record Base(UUID adminId, Map<String, UUID> rules, Map<String, UUID> types) {}

    private Base createBase() {
        Organization org = organizations.save(new Organization("EXSA", "Société Exemple SA"));
        UUID o = org.getId();

        Role admin = roles.save(new Role(o, "Administrateur", List.of("*")));
        Role archiviste = roles.save(new Role(o, "Archiviste",
                List.of("documents.write", "documents.reclassify", "classification.manage", "audit.read")));
        Role comptable = roles.save(new Role(o, "Comptable", List.of("documents.write")));
        Role juriste = roles.save(new Role(o, "Juriste", List.of("documents.write")));
        roles.save(new Role(o, "Auditeur", List.of("audit.read")));

        String hash = passwordEncoder.encode(DEMO_PASSWORD);
        User adminUser = users.save(new User(org, "admin@exemple.com", hash, "Administrateur", Set.of(admin)));
        users.save(new User(org, "s.amrani@exemple.com", hash, "S. Amrani", Set.of(archiviste)));
        users.save(new User(org, "k.benali@exemple.com", hash, "K. Benali", Set.of(comptable)));
        users.save(new User(org, "y.tazi@exemple.com", hash, "Y. Tazi", Set.of(juriste)));

        Map<String, UUID> r = new LinkedHashMap<>();
        r.put("compta", rules.save(new RetentionRule(o, "Pièces comptables", 10, StartEvent.CLOTURE_DOSSIER, FinalAction.VERSER, "[RÉFÉRENCE DU TEXTE]")).getId());
        r.put("paie", rules.save(new RetentionRule(o, "Bulletins de paie", 50, StartEvent.DATE_DOCUMENT, FinalAction.CONSERVER, null)).getId());
        r.put("personnel", rules.save(new RetentionRule(o, "Dossiers du personnel", 5, StartEvent.DATE_DOCUMENT, FinalAction.VERSER, null)).getId());
        r.put("contrats", rules.save(new RetentionRule(o, "Contrats commerciaux", 5, StartEvent.DATE_DOCUMENT, FinalAction.DETRUIRE, null)).getId());
        r.put("pv", rules.save(new RetentionRule(o, "Procès-verbaux d'AG", null, StartEvent.DATE_DOCUMENT, FinalAction.CONSERVER, null)).getId());
        r.put("courrier", rules.save(new RetentionRule(o, "Courrier courant", 2, StartEvent.DATE_CREATION, FinalAction.DETRUIRE, null)).getId());

        Map<String, UUID> t = new LinkedHashMap<>();
        t.put("FACTURE", types.save(new DocumentType(o, "FACTURE", "Facture", """
                [{"key":"fournisseur","label":"Fournisseur","type":"TEXT","required":true},
                 {"key":"numero","label":"N° de facture","type":"TEXT","required":true},
                 {"key":"montant_ttc","label":"Montant TTC","type":"AMOUNT","required":true},
                 {"key":"devise","label":"Devise","type":"LIST","required":true,"options":["MAD","EUR","USD"]}]
                """, r.get("compta"))).getId());
        t.put("CONTRAT", types.save(new DocumentType(o, "CONTRAT", "Contrat", """
                [{"key":"cocontractant","label":"Cocontractant","type":"TEXT","required":true},
                 {"key":"date_fin","label":"Date de fin","type":"DATE","required":false},
                 {"key":"montant","label":"Montant annuel","type":"AMOUNT","required":false}]
                """, r.get("contrats"))).getId());
        t.put("PV", types.save(new DocumentType(o, "PV", "Procès-verbal", """
                [{"key":"instance","label":"Instance","type":"TEXT","required":true}]
                """, r.get("pv"))).getId());
        t.put("COURRIER", types.save(new DocumentType(o, "COURRIER", "Courrier entrant", """
                [{"key":"expediteur","label":"Expéditeur","type":"TEXT","required":true},
                 {"key":"objet","label":"Objet","type":"TEXT","required":false}]
                """, r.get("courrier"))).getId());
        return new Base(adminUser.getId(), r, t);
    }

    private void createTreeAndDocuments(Base b) {
        UUID fin = node(null, NodeType.FONDS, "FIN", "Direction financière", null);
        UUID cpt = node(fin, NodeType.SERIE, "FIN/CPT", "Comptabilité", b.rules().get("compta"));
        UUID ff25 = node(cpt, NodeType.DOSSIER, "FIN/CPT/FF-2025", "Factures fournisseurs 2025", null);
        UUID ff24 = node(cpt, NodeType.DOSSIER, "FIN/CPT/FF-2024", "Factures fournisseurs 2024", null);
        classification.update(ff24, new ClassificationService.UpdateNode(null, null, null, null, LocalDate.of(2024, 12, 31)));
        node(cpt, NodeType.DOSSIER, "FIN/CPT/FC-2025", "Factures clients 2025", null);
        node(fin, NodeType.SERIE, "FIN/PAIE", "Paie", b.rules().get("paie"));
        UUID rh = node(null, NodeType.FONDS, "RH", "Ressources humaines", null);
        node(rh, NodeType.SERIE, "RH/DP", "Dossiers du personnel", b.rules().get("personnel"));
        UUID jur = node(null, NodeType.FONDS, "JUR", "Juridique", null);
        UUID ctr = node(jur, NodeType.SERIE, "JUR/CTR", "Contrats", b.rules().get("contrats"));
        UUID pv = node(jur, NodeType.SERIE, "JUR/PV", "Procès-verbaux", b.rules().get("pv"));

        UUID f1 = classify(upload("scan_facture_fournitures.pdf", "FACTURE", "Fournitures de bureau", "Total TTC : 4 820,00 MAD"),
                ff24, b.types().get("FACTURE"), "Facture - fournitures de bureau", LocalDate.of(2025, 3, 14),
                Map.of("fournisseur", "Papeterie Exemple", "numero", "F-2025-118", "montant_ttc", "4820.00", "devise", "MAD"),
                List.of("fournitures", "original papier"));
        classify(upload("facture_maintenance_climatisation.pdf", "FACTURE", "Maintenance climatisation", "Total TTC : 12 600,00 MAD"),
                ff25, b.types().get("FACTURE"), "Facture - maintenance climatisation", LocalDate.of(2025, 3, 2),
                Map.of("fournisseur", "Clim Services Exemple", "numero", "CS-0398", "montant_ttc", "12600", "devise", "MAD"),
                List.of("maintenance"));
        UUID c1 = classify(upload("contrat_maintenance_cvc.pdf", "CONTRAT", "Maintenance des equipements CVC", "Duree : 3 ans"),
                ctr, b.types().get("CONTRAT"), "Contrat de maintenance des équipements CVC", LocalDate.of(2023, 1, 10),
                Map.of("cocontractant", "Clim Services Exemple", "date_fin", "2026-01-09", "montant", "48000"),
                List.of("maintenance", "signé"));
        classify(upload("pv_reception_climatisation.pdf", "PROCES-VERBAL", "Reception climatisation salle serveurs", "Sans reserve"),
                pv, b.types().get("PV"), "PV de réception - climatisation salle serveurs", LocalDate.of(2024, 6, 18),
                Map.of("instance", "Comité technique"), List.of());
        // Un document laissé dans « À classer »
        upload("courrier_demande_devis.pdf", "COURRIER", "Demande de devis", "Objet : renouvellement du parc informatique");

        // Erreur d'exercice : la facture est reclassée de 2024 vers 2025 (l'ancienne cote reste trouvable)
        documents.reclassify(f1, ff25, "Facture rattachée au mauvais exercice");
        documents.request(f1, RequestKind.COPIE_CERTIFIEE, "Direction générale", "Dossier de financement bancaire");
        documents.request(c1, RequestKind.ORIGINAL, null, "Contrôle fiscal : présentation de l'original exigée");
        log.info("Données de démonstration créées.");
    }

    private UUID node(UUID parent, NodeType type, String code, String title, UUID ruleId) {
        return classification.create(new ClassificationService.CreateNode(parent, type, code, title, null, ruleId)).id();
    }

    private UUID upload(String filename, String kind, String subject, String detail) {
        byte[] pdf = SimplePdf.page(List.of("SOCIETE EXEMPLE SA - document de demonstration", "", kind, subject, detail));
        List<UploadResult> res = documents.upload(List.of(new BytesMultipartFile("files", filename, "application/pdf", pdf)));
        return res.get(0).id();
    }

    private UUID classify(UUID id, UUID nodeId, UUID typeId, String title, LocalDate date, Map<String, Object> metadata,
                          List<String> tags) {
        documents.classify(id, new ClassifyCommand(nodeId, typeId, title, date, metadata, tags));
        return id;
    }
}
