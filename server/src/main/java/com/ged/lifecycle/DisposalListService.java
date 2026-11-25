package com.ged.lifecycle;

import static com.ged.lifecycle.LifecycleSupport.APPROVE;
import static com.ged.lifecycle.LifecycleSupport.MANAGE;
import static com.ged.lifecycle.LifecycleSupport.params;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.common.ApiException;
import com.ged.document.DocumentEventType;
import com.ged.lifecycle.LifecycleDtos.CreateList;
import com.ged.lifecycle.LifecycleDtos.ListDetail;
import com.ged.lifecycle.LifecycleDtos.ListItem;
import com.ged.lifecycle.LifecycleDtos.ListSummary;
import com.ged.storage.FileStorage;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.Year;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

/**
 * Bordereaux d'élimination et de versement.
 *
 * <pre>
 * BROUILLON ──soumettre──► SOUMIS ──viser──► APPROUVE ──exécuter──► EXECUTE
 *     │                      │ refuser            │
 *     └──────annuler─────────┴──► REFUSE / ANNULE ◄┘
 * </pre>
 *
 * <ul>
 *   <li>Seuls des documents échus, dont le sort final correspond au bordereau, hors gel et hors autre
 *       bordereau en cours, peuvent y figurer.</li>
 *   <li>Le visa est donné par une autre personne que l'auteur et que celle qui a soumis (quatre yeux).</li>
 *   <li>L'exécution est refusée si un document a été gelé entre-temps ou si son original papier est prêté.</li>
 *   <li>Élimination : le contenu est détruit (toutes versions) après validation de la transaction ;
 *       la notice et l'historique du document sont conservés, le bordereau sert de procès-verbal.</li>
 * </ul>
 */
@Service
public class DisposalListService {

    private static final Logger log = LoggerFactory.getLogger(DisposalListService.class);

    static final String SUMMARY_SELECT = """
            SELECT l.id, l.number, l.kind, l.status, l.title, l.destination, cu.full_name AS created_by,
                   l.created_by AS created_by_id, l.created_at, l.submitted_at, du.full_name AS decided_by,
                   l.decided_at, l.executed_at,
                   (SELECT count(*) FROM disposal_list_items i WHERE i.list_id = l.id) AS documents,
                   (SELECT coalesce(sum(i.bytes), 0) FROM disposal_list_items i WHERE i.list_id = l.id) AS bytes
            FROM disposal_lists l
            JOIN users cu ON cu.id = l.created_by
            LEFT JOIN users du ON du.id = l.decided_by
            """;

    private final LifecycleSupport support;
    private final NamedParameterJdbcTemplate jdbc;
    private final AuditService audit;
    private final FileStorage storage;

    public DisposalListService(LifecycleSupport support, AuditService audit, FileStorage storage) {
        this.support = support;
        this.jdbc = support.jdbc();
        this.audit = audit;
        this.storage = storage;
    }

    // ───────── Lecture ─────────

    @Transactional(readOnly = true)
    public List<ListSummary> list(String status) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        String filter = status == null || status.isBlank() ? "" : switch (status) {
            case "open" -> " AND l.status IN ('BROUILLON', 'SOUMIS', 'APPROUVE')";
            case "closed" -> " AND l.status IN ('EXECUTE', 'REFUSE', 'ANNULE')";
            default -> throw ApiException.badRequest("BAD_STATUS", "Filtre inconnu");
        };
        return jdbc.query(SUMMARY_SELECT + " WHERE l.organization_id = :org" + filter + " ORDER BY l.created_at DESC",
                params("org", user.organizationId()), (rs, i) -> summary(rs));
    }

    @Transactional(readOnly = true)
    public ListDetail get(UUID id) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        return detail(user, id);
    }

    // ───────── Préparation ─────────

    @Transactional
    public ListDetail create(CreateList in) {
        CurrentUser user = support.requireAny(MANAGE);
        String kind = in.kind() == null ? "" : in.kind();
        if (!kind.equals("ELIMINATION") && !kind.equals("VERSEMENT")) {
            throw ApiException.badRequest("BAD_KIND", "Type de bordereau inconnu");
        }
        String title = support.required(in.title(), "title", "Donnez un intitulé au bordereau");
        if (kind.equals("VERSEMENT")) support.required(in.destination(), "destination", "Indiquez le service d'archives destinataire");
        UUID id = UUID.randomUUID();
        String number = nextNumber(user.organizationId(), kind);
        jdbc.update("""
                INSERT INTO disposal_lists (id, organization_id, number, kind, status, title, destination, notes, created_by)
                VALUES (:id, :org, :number, :kind, 'BROUILLON', :title, :destination, :notes, :user)""",
                params("id", id, "org", user.organizationId(), "number", number, "kind", kind, "title", title,
                        "destination", blankToNull(in.destination()), "notes", blankToNull(in.notes()), "user", user.id()));
        if (in.documentIds() != null && !in.documentIds().isEmpty()) addItems(user, id, kind, in.documentIds());
        audit.log(user.organizationId(), user.id(), "BORDEREAU_CREE", "disposal_list", id.toString(),
                Map.of("number", number, "kind", kind), null);
        return detail(user, id);
    }

    @Transactional
    public ListDetail addDocuments(UUID id, List<UUID> documentIds) {
        CurrentUser user = support.requireAny(MANAGE);
        Map<String, Object> list = load(user, id);
        expectStatus(list, "BROUILLON");
        addItems(user, id, (String) list.get("kind"), documentIds);
        return detail(user, id);
    }

    @Transactional
    public ListDetail removeDocument(UUID id, UUID documentId) {
        CurrentUser user = support.requireAny(MANAGE);
        expectStatus(load(user, id), "BROUILLON");
        int n = jdbc.update("DELETE FROM disposal_list_items WHERE list_id = :id AND document_id = :doc",
                params("id", id, "doc", documentId));
        if (n == 0) throw ApiException.notFound("Document du bordereau");
        return detail(user, id);
    }

    private void addItems(CurrentUser user, UUID listId, String kind, List<UUID> documentIds) {
        if (documentIds == null || documentIds.isEmpty()) throw ApiException.badRequest("EMPTY", "Sélectionnez des documents");
        LinkedHashSet<UUID> ids = new LinkedHashSet<>(documentIds);
        String expectedAction = kind.equals("ELIMINATION") ? "DETRUIRE" : "VERSER";
        List<Map<String, Object>> docs = jdbc.queryForList("""
                SELECT d.id, d.reference, d.title, d.status, d.document_date, d.retention_until, d.final_action, d.legal_hold,
                       t.name AS type_name, r.name AS rule_name,
                       (SELECT count(*) FROM document_versions v WHERE v.document_id = d.id) AS versions,
                       (SELECT coalesce(sum(v.size_bytes), 0) FROM document_versions v WHERE v.document_id = d.id) AS bytes,
                       (SELECT l.number FROM disposal_lists l JOIN disposal_list_items i ON i.list_id = l.id
                        WHERE i.document_id = d.id AND l.id <> :list AND l.status IN ('BROUILLON', 'SOUMIS', 'APPROUVE')
                        LIMIT 1) AS other_list
                FROM documents d
                LEFT JOIN document_types t ON t.id = d.type_id
                LEFT JOIN retention_rules r ON r.id = d.retention_rule_id
                WHERE d.organization_id = :org AND d.id IN (:ids)""",
                params("org", user.organizationId(), "ids", ids, "list", listId));
        if (docs.size() != ids.size()) throw ApiException.notFound("Document");

        List<String> problems = new ArrayList<>();
        LocalDate today = LocalDate.now();
        for (Map<String, Object> d : docs) {
            String ref = String.valueOf(d.get("reference"));
            LocalDate until = date(d.get("retention_until"));
            if (!LifecycleSupport.LIVE.contains((String) d.get("status"))) problems.add(ref + " : statut " + d.get("status"));
            else if (until == null || until.isAfter(today)) problems.add(ref + " : pas encore échu");
            else if (!expectedAction.equals(d.get("final_action"))) {
                problems.add(ref + " : sort final « " + label(d.get("final_action")) + " »");
            } else if (Boolean.TRUE.equals(d.get("legal_hold"))) problems.add(ref + " : sous gel juridique");
            else if (d.get("other_list") != null) problems.add(ref + " : déjà sur le bordereau " + d.get("other_list"));
        }
        if (!problems.isEmpty()) {
            throw ApiException.conflict("NOT_ELIGIBLE", "Documents refusés pour ce bordereau — "
                    + String.join(" ; ", problems.subList(0, Math.min(problems.size(), 10)))
                    + (problems.size() > 10 ? " ; et " + (problems.size() - 10) + " autre(s)" : ""));
        }
        for (Map<String, Object> d : docs) {
            jdbc.update("""
                    INSERT INTO disposal_list_items (list_id, document_id, reference, title, type_name, document_date,
                        retention_until, rule_name, version_count, bytes, prior_status)
                    VALUES (:list, :doc, :ref, :title, :type, :date, :until, :rule, :versions, :bytes, :status)
                    ON CONFLICT DO NOTHING""",
                    params("list", listId, "doc", d.get("id"), "ref", d.get("reference"), "title", d.get("title"),
                            "type", d.get("type_name"), "date", d.get("document_date"), "until", d.get("retention_until"),
                            "rule", d.get("rule_name"), "versions", ((Number) d.get("versions")).intValue(),
                            "bytes", ((Number) d.get("bytes")).longValue(), "status", d.get("status")));
        }
    }

    // ───────── Circuit de validation ─────────

    @Transactional
    public ListDetail submit(UUID id) {
        CurrentUser user = support.requireAny(MANAGE);
        Map<String, Object> list = load(user, id);
        expectStatus(list, "BROUILLON");
        List<UUID> docs = itemIds(id);
        if (docs.isEmpty()) throw ApiException.conflict("EMPTY", "Le bordereau est vide");
        List<String> blockers = blockers(id, (String) list.get("kind"), "BROUILLON", false);
        if (!blockers.isEmpty()) throw ApiException.conflict("BLOCKED", String.join(" ; ", blockers));

        jdbc.update("UPDATE disposal_lists SET status = 'SOUMIS', submitted_by = :user, submitted_at = now() WHERE id = :id",
                params("user", user.id(), "id", id));
        boolean elimination = "ELIMINATION".equals(list.get("kind"));
        if (elimination) {
            // Le document est figé pendant le visa : plus de modification, de reclassement ni de nouvelle version
            jdbc.update("UPDATE documents SET status = 'A_ELIMINER', updated_at = now() WHERE id IN (:ids)", params("ids", docs));
        }
        for (UUID doc : docs) {
            support.event(user, doc, DocumentEventType.SORT_PROPOSE, null, null, listRef(list));
        }
        audit.log(user.organizationId(), user.id(), "BORDEREAU_SOUMIS", "disposal_list", id.toString(),
                Map.of("number", list.get("number"), "documents", docs.size()), null);
        return detail(user, id);
    }

    @Transactional
    public ListDetail approve(UUID id, String comment) {
        CurrentUser user = support.requireAny(APPROVE);
        Map<String, Object> list = load(user, id);
        expectStatus(list, "SOUMIS");
        fourEyes(user, list);
        List<String> blockers = blockers(id, (String) list.get("kind"), "SOUMIS", false);
        if (!blockers.isEmpty()) throw ApiException.conflict("BLOCKED", String.join(" ; ", blockers));
        jdbc.update("""
                UPDATE disposal_lists SET status = 'APPROUVE', decided_by = :user, decided_at = now(), decision_comment = :c
                WHERE id = :id""", params("user", user.id(), "c", blankToNull(comment), "id", id));
        audit.log(user.organizationId(), user.id(), "BORDEREAU_VISE", "disposal_list", id.toString(),
                Map.of("number", list.get("number")), null);
        return detail(user, id);
    }

    @Transactional
    public ListDetail reject(UUID id, String comment) {
        CurrentUser user = support.requireAny(APPROVE);
        Map<String, Object> list = load(user, id);
        expectStatus(list, "SOUMIS");
        fourEyes(user, list);
        String why = support.required(comment, "comment", "Indiquez le motif du refus");
        jdbc.update("""
                UPDATE disposal_lists SET status = 'REFUSE', decided_by = :user, decided_at = now(), decision_comment = :c
                WHERE id = :id""", params("user", user.id(), "c", why, "id", id));
        restoreDocuments(user, id, list, "Bordereau refusé : " + why);
        audit.log(user.organizationId(), user.id(), "BORDEREAU_REFUSE", "disposal_list", id.toString(),
                Map.of("number", list.get("number"), "reason", why), null);
        return detail(user, id);
    }

    @Transactional
    public ListDetail cancel(UUID id, String reason) {
        CurrentUser user = support.requireAny(MANAGE);
        Map<String, Object> list = load(user, id);
        expectStatus(list, "BROUILLON", "SOUMIS", "APPROUVE");
        String why = support.required(reason, "reason", "Indiquez pourquoi le bordereau est annulé");
        jdbc.update("UPDATE disposal_lists SET status = 'ANNULE', decision_comment = :c WHERE id = :id",
                params("c", why, "id", id));
        if (!"BROUILLON".equals(list.get("status"))) restoreDocuments(user, id, list, "Bordereau annulé : " + why);
        audit.log(user.organizationId(), user.id(), "BORDEREAU_ANNULE", "disposal_list", id.toString(),
                Map.of("number", list.get("number"), "reason", why), null);
        return detail(user, id);
    }

    /** Remet les documents dans leur statut d'avant la proposition. */
    private void restoreDocuments(CurrentUser user, UUID id, Map<String, Object> list, String reason) {
        jdbc.update("""
                UPDATE documents d SET status = i.prior_status, updated_at = now()
                FROM disposal_list_items i WHERE i.list_id = :id AND i.document_id = d.id AND d.status = 'A_ELIMINER'""",
                params("id", id));
        for (UUID doc : itemIds(id)) {
            support.event(user, doc, DocumentEventType.SORT_ABANDONNE, reason, listRef(list), null);
        }
    }

    // ───────── Exécution ─────────

    @Transactional
    public ListDetail execute(UUID id, String confirmNumber) {
        CurrentUser user = support.requireAny(MANAGE);
        Map<String, Object> list = load(user, id);
        expectStatus(list, "APPROUVE");
        String number = (String) list.get("number");
        if (!number.equals(confirmNumber == null ? null : confirmNumber.trim())) {
            throw new ApiException(org.springframework.http.HttpStatus.BAD_REQUEST, "CONFIRMATION",
                    "Recopiez le numéro du bordereau pour confirmer", Map.of("confirmNumber", "Saisissez " + number));
        }
        String kind = (String) list.get("kind");
        List<String> blockers = blockers(id, kind, "APPROUVE", true);
        if (!blockers.isEmpty()) throw ApiException.conflict("BLOCKED", String.join(" ; ", blockers));

        boolean elimination = kind.equals("ELIMINATION");
        List<Map<String, Object>> docs = jdbc.queryForList("""
                SELECT d.id, loc.id_path AS loc_path FROM disposal_list_items i JOIN documents d ON d.id = i.document_id
                LEFT JOIN physical_locations loc ON loc.id = d.physical_location_id WHERE i.list_id = :id""", params("id", id));
        List<UUID> ids = docs.stream().map(d -> (UUID) d.get("id")).toList();
        // Fichiers à détruire : chaque version, et sa copie portant le texte reconnu
        List<String> keys = elimination
                ? jdbc.queryForList("""
                        SELECT storage_key FROM document_versions WHERE document_id IN (:ids)
                        UNION ALL
                        SELECT searchable_key FROM document_texts WHERE document_id IN (:ids) AND searchable_key IS NOT NULL""",
                        params("ids", ids), String.class)
                : List.of();
        if (elimination) {
            // Le texte lu dans les fichiers fait partie du contenu : détruit avec lui (la demande reste, sans texte)
            jdbc.update("""
                    DELETE FROM document_text_pages WHERE text_id IN (SELECT id FROM document_texts WHERE document_id IN (:ids))""",
                    params("ids", ids));
        }

        jdbc.update("""
                UPDATE documents SET status = :status, disposed_at = now(), physical_location_id = NULL, updated_at = now()
                WHERE id IN (:ids)""", params("status", elimination ? "ELIMINE" : "VERSE", "ids", ids));
        for (Map<String, Object> d : docs) {
            Map<String, Object> after = new LinkedHashMap<>(listRef(list));
            if (!elimination) after.put("destination", list.get("destination"));
            String paper = support.paperPath((String) d.get("loc_path"));
            if (paper != null) after.put("originalPapier", paper);
            support.event(user, (UUID) d.get("id"), elimination ? DocumentEventType.ELIMINE : DocumentEventType.VERSE,
                    null, null, after);
        }
        jdbc.update("UPDATE disposal_lists SET status = 'EXECUTE', executed_by = :user, executed_at = now() WHERE id = :id",
                params("user", user.id(), "id", id));
        Long bytes = jdbc.queryForObject("SELECT coalesce(sum(bytes), 0) FROM disposal_list_items WHERE list_id = :id",
                params("id", id), Long.class);
        audit.log(user.organizationId(), user.id(), elimination ? "ELIMINATION_EXECUTEE" : "VERSEMENT_EXECUTE",
                "disposal_list", id.toString(),
                Map.of("number", number, "documents", ids.size(), "octets", bytes == null ? 0 : bytes,
                        "fichiersDetruits", keys.size()), null);

        // La destruction des fichiers n'est pas annulable : seulement une fois la transaction validée.
        // Un échec est visible dans Paramétrage › Stockage (« éliminés encore présents »).
        if (!keys.isEmpty()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    int failed = 0;
                    for (String key : keys) {
                        try {
                            storage.destroy(key);
                        } catch (RuntimeException e) {
                            failed++;
                            log.error("Bordereau {} : destruction impossible de {}", number, key, e);
                        }
                    }
                    log.info("Bordereau {} exécuté : {} fichier(s) détruit(s), {} échec(s)", number, keys.size() - failed, failed);
                }
            });
        }
        return detail(user, id);
    }

    // ───────── Contrôles ─────────

    /**
     * Ce qui empêche le bordereau d'avancer : document gelé, statut inattendu, original papier prêté
     * (contrôlé à l'exécution seulement : il faut l'avoir physiquement pour le détruire ou le verser).
     */
    List<String> blockers(UUID id, String kind, String listStatus, boolean checkLoans) {
        String expected = "ELIMINATION".equals(kind) && !"BROUILLON".equals(listStatus) ? "'A_ELIMINER'" : "'ACTIVE', 'INTERMEDIAIRE'";
        List<String> out = new ArrayList<>();
        jdbc.query("""
                SELECT coalesce(d.reference, d.title) AS ref, d.legal_hold, d.status IN (%s) AS status_ok,
                       EXISTS (SELECT 1 FROM loans l WHERE l.returned_at IS NULL
                               AND (l.document_id = d.id
                                    OR (d.physical_location_id IS NOT NULL AND l.location_id = d.physical_location_id))) AS on_loan
                FROM disposal_list_items i JOIN documents d ON d.id = i.document_id
                WHERE i.list_id = :id ORDER BY d.reference""".formatted(expected), params("id", id), rs -> {
            String ref = rs.getString("ref");
            if (rs.getBoolean("legal_hold")) out.add(ref + " est sous gel juridique");
            else if (!rs.getBoolean("status_ok")) out.add(ref + " a changé de statut");
            else if (checkLoans && rs.getBoolean("on_loan")) out.add("l'original de " + ref + " est sorti (prêt en cours)");
        });
        return out;
    }

    private static void fourEyes(CurrentUser user, Map<String, Object> list) {
        if (user.id().equals(list.get("created_by")) || user.id().equals(list.get("submitted_by"))) {
            throw ApiException.conflict("FOUR_EYES", "Le visa doit être donné par une autre personne que l'auteur du bordereau");
        }
    }

    private Map<String, Object> load(CurrentUser user, UUID id) {
        return jdbc.queryForList("SELECT * FROM disposal_lists WHERE id = :id AND organization_id = :org",
                params("id", id, "org", user.organizationId())).stream().findFirst()
                .orElseThrow(() -> ApiException.notFound("Bordereau"));
    }

    private static void expectStatus(Map<String, Object> list, String... allowed) {
        if (!List.of(allowed).contains((String) list.get("status"))) {
            throw ApiException.conflict("BAD_STATUS", "Action impossible : le bordereau est « " + list.get("status") + " »");
        }
    }

    private List<UUID> itemIds(UUID id) {
        return jdbc.queryForList("SELECT document_id FROM disposal_list_items WHERE list_id = :id", params("id", id), UUID.class);
    }

    private String nextNumber(UUID org, String kind) {
        String prefix = (kind.equals("ELIMINATION") ? "ELIM-" : "VERS-") + Year.now().getValue() + "-";
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(:k))", params("k", "disposal-" + org));
        Integer n = jdbc.queryForObject("""
                SELECT coalesce(max(substring(number FROM '(\\d+)$')::int), 0) + 1 FROM disposal_lists
                WHERE organization_id = :org AND number LIKE :prefix""", params("org", org, "prefix", prefix + "%"), Integer.class);
        return prefix + "%03d".formatted(n == null ? 1 : n);
    }

    private ListDetail detail(CurrentUser user, UUID id) {
        ListSummary summary = jdbc.query(SUMMARY_SELECT + " WHERE l.id = :id AND l.organization_id = :org",
                params("id", id, "org", user.organizationId()), (rs, i) -> summary(rs))
                .stream().findFirst().orElseThrow(() -> ApiException.notFound("Bordereau"));
        Map<String, Object> extra = jdbc.queryForMap("""
                SELECT l.notes, su.full_name AS submitted_by, l.decision_comment, eu.full_name AS executed_by
                FROM disposal_lists l LEFT JOIN users su ON su.id = l.submitted_by LEFT JOIN users eu ON eu.id = l.executed_by
                WHERE l.id = :id""", params("id", id));
        List<ListItem> items = jdbc.query("""
                SELECT i.document_id, i.reference, i.title, i.type_name, i.document_date, i.retention_until, i.rule_name,
                       i.version_count, i.bytes, d.status, d.legal_hold, loc.id_path AS loc_path,
                       EXISTS (SELECT 1 FROM loans l WHERE l.returned_at IS NULL
                               AND (l.document_id = d.id
                                    OR (d.physical_location_id IS NOT NULL AND l.location_id = d.physical_location_id))) AS on_loan
                FROM disposal_list_items i JOIN documents d ON d.id = i.document_id
                LEFT JOIN physical_locations loc ON loc.id = d.physical_location_id
                WHERE i.list_id = :id ORDER BY i.reference""", params("id", id),
                (rs, n) -> new ListItem(rs.getObject("document_id", UUID.class), rs.getString("reference"),
                        rs.getString("title"), rs.getString("type_name"), rs.getObject("document_date", LocalDate.class),
                        rs.getObject("retention_until", LocalDate.class), rs.getString("rule_name"),
                        rs.getInt("version_count"), rs.getLong("bytes"), rs.getString("status"),
                        rs.getBoolean("legal_hold"), support.paperPath(rs.getString("loc_path")), rs.getBoolean("on_loan")));
        String status = summary.status();
        List<String> blockers = List.of("BROUILLON", "SOUMIS", "APPROUVE").contains(status)
                ? blockers(id, summary.kind(), status, "APPROUVE".equals(status))
                : List.of();
        return new ListDetail(summary, (String) extra.get("notes"), (String) extra.get("submitted_by"),
                (String) extra.get("decision_comment"), (String) extra.get("executed_by"), items, blockers);
    }

    static ListSummary summary(ResultSet rs) throws SQLException {
        return new ListSummary(rs.getObject("id", UUID.class), rs.getString("number"), rs.getString("kind"),
                rs.getString("status"), rs.getString("title"), rs.getString("destination"), rs.getString("created_by"),
                rs.getObject("created_by_id", UUID.class), rs.getTimestamp("created_at").toInstant(),
                LegalHoldService.instant(rs, "submitted_at"), rs.getString("decided_by"),
                LegalHoldService.instant(rs, "decided_at"), LegalHoldService.instant(rs, "executed_at"),
                rs.getLong("documents"), rs.getLong("bytes"));
    }

    private static Map<String, Object> listRef(Map<String, Object> list) {
        return Map.of("bordereau", list.get("number"), "type", list.get("kind"));
    }

    private static LocalDate date(Object value) {
        return value == null ? null : ((java.sql.Date) value).toLocalDate();
    }

    private static String label(Object action) {
        if (action == null) return "aucun";
        return switch (action.toString()) {
            case "DETRUIRE" -> "détruire";
            case "VERSER" -> "verser";
            case "CONSERVER" -> "conserver";
            default -> action.toString();
        };
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
