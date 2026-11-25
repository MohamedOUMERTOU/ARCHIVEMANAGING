package com.ged.lifecycle;

import static com.ged.lifecycle.LifecycleSupport.APPROVE;
import static com.ged.lifecycle.LifecycleSupport.MANAGE;
import static com.ged.lifecycle.LifecycleSupport.params;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.classification.ClassificationNode;
import com.ged.classification.ClassificationService;
import com.ged.common.ApiException;
import com.ged.document.DocumentEventType;
import com.ged.lifecycle.LifecycleDtos.ActionCount;
import com.ged.lifecycle.LifecycleDtos.DueItem;
import com.ged.lifecycle.LifecycleDtos.RecalcResult;
import com.ged.lifecycle.LifecycleDtos.Summary;
import com.ged.retention.RetentionInputsChanged;
import com.ged.retention.RetentionPolicy;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.context.event.EventListener;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Échéancier du cycle de vie : documents arrivés (ou arrivant) au terme de leur durée de conservation,
 * recalcul des échéances, et passage en conservation définitive pour le sort final « conserver ».
 */
@Service
public class LifecycleService {

    /** Colonnes communes à l'échéancier et aux bordereaux : document, échéance, blocages éventuels. */
    static final String DOCUMENT_SELECT = """
            SELECT d.id, d.reference, d.title, t.name AS type_name, n.id_path AS node_path, d.status,
                   d.document_date, d.retention_until, d.final_action, r.name AS rule_name, d.legal_hold,
                   pl.number AS list_number, pl.id AS list_id, loc.id_path AS loc_path,
                   EXISTS (SELECT 1 FROM loans l WHERE l.returned_at IS NULL
                           AND (l.document_id = d.id
                                OR (d.physical_location_id IS NOT NULL AND l.location_id = d.physical_location_id))) AS on_loan,
                   (SELECT count(*) FROM document_versions v WHERE v.document_id = d.id) AS versions,
                   (SELECT coalesce(sum(v.size_bytes), 0) FROM document_versions v WHERE v.document_id = d.id) AS bytes
            FROM documents d
            LEFT JOIN document_types t ON t.id = d.type_id
            LEFT JOIN classification_nodes n ON n.id = d.node_id
            LEFT JOIN retention_rules r ON r.id = d.retention_rule_id
            LEFT JOIN physical_locations loc ON loc.id = d.physical_location_id
            LEFT JOIN LATERAL (
                SELECT l.id, l.number FROM disposal_lists l JOIN disposal_list_items i ON i.list_id = l.id
                WHERE i.document_id = d.id AND l.status IN ('BROUILLON', 'SOUMIS', 'APPROUVE')
                ORDER BY l.created_at DESC LIMIT 1) pl ON true
            """;

    private final LifecycleSupport support;
    private final NamedParameterJdbcTemplate jdbc;
    private final ClassificationService classification;
    private final RetentionPolicy policy;
    private final AuditService audit;
    private final CurrentUserProvider currentUser;

    public LifecycleService(LifecycleSupport support, ClassificationService classification, RetentionPolicy policy,
                            AuditService audit, CurrentUserProvider currentUser) {
        this.support = support;
        this.jdbc = support.jdbc();
        this.classification = classification;
        this.policy = policy;
        this.audit = audit;
        this.currentUser = currentUser;
    }

    // ───────── Échéancier ─────────

    @Transactional(readOnly = true)
    public Summary summary() {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        LocalDate today = LocalDate.now();
        MapSqlParameterSource p = params("org", user.organizationId(), "today", today, "horizon", today.plusYears(1));
        List<ActionCount> byAction = jdbc.query("""
                SELECT d.final_action,
                       count(*) FILTER (WHERE d.retention_until <= :today),
                       count(*) FILTER (WHERE d.retention_until > :today AND d.retention_until <= :horizon)
                FROM documents d
                WHERE d.organization_id = :org AND d.status IN ('ACTIVE', 'INTERMEDIAIRE', 'A_ELIMINER')
                  AND d.final_action IS NOT NULL AND d.retention_until IS NOT NULL
                GROUP BY d.final_action ORDER BY d.final_action""", p,
                (rs, i) -> new ActionCount(rs.getString(1), rs.getLong(2), rs.getLong(3)));
        long onHold = count("""
                SELECT count(*) FROM documents WHERE organization_id = :org AND legal_hold
                AND status IN ('ACTIVE', 'INTERMEDIAIRE', 'A_ELIMINER', 'DEFINITIF')""", p);
        long awaiting = count("""
                SELECT count(*) FROM documents d JOIN retention_rules r ON r.id = d.retention_rule_id
                WHERE d.organization_id = :org AND d.status IN ('ACTIVE', 'INTERMEDIAIRE')
                  AND d.retention_until IS NULL AND r.duration_years IS NOT NULL""", p);
        long open = count("""
                SELECT count(*) FROM disposal_lists WHERE organization_id = :org
                AND status IN ('BROUILLON', 'SOUMIS', 'APPROUVE')""", p);
        long visa = count("SELECT count(*) FROM disposal_lists WHERE organization_id = :org AND status = 'SOUMIS'", p);
        long holds = count("SELECT count(*) FROM legal_holds WHERE organization_id = :org AND released_at IS NULL", p);
        return new Summary(byAction, onHold, awaiting, open, visa, holds, today);
    }

    /**
     * Documents dont l'échéance tombe au plus tard {@code horizonDays} jours après aujourd'hui.
     * {@code awaiting} : à la place, les documents dont l'échéance attend un événement (dossier non clos…).
     */
    @Transactional(readOnly = true)
    public List<DueItem> due(int horizonDays, String finalAction, UUID nodeId, boolean awaiting) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        if (horizonDays < 0 || horizonDays > 3660) throw ApiException.badRequest("BAD_HORIZON", "Horizon invalide");
        MapSqlParameterSource p = params("org", user.organizationId(),
                "limit", LocalDate.now().plusDays(horizonDays));
        StringBuilder sql = new StringBuilder(DOCUMENT_SELECT).append(" WHERE d.organization_id = :org");
        if (awaiting) {
            sql.append(" AND d.status IN ('ACTIVE', 'INTERMEDIAIRE') AND d.retention_until IS NULL AND r.duration_years IS NOT NULL");
        } else {
            sql.append(" AND d.status IN ('ACTIVE', 'INTERMEDIAIRE', 'A_ELIMINER') AND d.retention_until <= :limit");
        }
        if (finalAction != null && !finalAction.isBlank()) {
            sql.append(" AND d.final_action = :action");
            p.addValue("action", finalAction);
        }
        if (nodeId != null) {
            ClassificationNode node = classification.find(user.organizationId(), nodeId);
            sql.append(" AND n.id_path LIKE :prefix");
            p.addValue("prefix", node.getIdPath() + "%");
        }
        sql.append(" ORDER BY d.retention_until NULLS LAST, d.reference LIMIT 2000");
        Map<String, String> paths = new HashMap<>();
        return jdbc.query(sql.toString(), p, (rs, i) -> dueItem(rs, paths));
    }

    private DueItem dueItem(ResultSet rs, Map<String, String> paths) throws SQLException {
        String nodePath = rs.getString("node_path");
        return new DueItem(rs.getObject("id", UUID.class), rs.getString("reference"), rs.getString("title"),
                rs.getString("type_name"),
                nodePath == null ? null : paths.computeIfAbsent(nodePath, classification::displayPath),
                rs.getString("status"), rs.getObject("document_date", LocalDate.class),
                rs.getObject("retention_until", LocalDate.class), rs.getString("final_action"),
                rs.getString("rule_name"), rs.getBoolean("legal_hold"), rs.getString("list_number"),
                rs.getObject("list_id", UUID.class), support.paperPath(rs.getString("loc_path")),
                rs.getBoolean("on_loan"), rs.getInt("versions"), rs.getLong("bytes"));
    }

    // ───────── Conservation définitive ─────────

    /** Sort final « conserver » arrivé à échéance : le document passe en conservation définitive. */
    @Transactional
    public int keepDefinitively(List<UUID> documentIds) {
        CurrentUser user = support.requireAny(MANAGE);
        if (documentIds == null || documentIds.isEmpty()) throw ApiException.badRequest("EMPTY", "Sélectionnez des documents");
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT d.id, d.reference, d.status, d.final_action, d.retention_until FROM documents d
                WHERE d.organization_id = :org AND d.id IN (:ids)""",
                params("org", user.organizationId(), "ids", documentIds));
        if (rows.size() != documentIds.size()) throw ApiException.notFound("Document");
        List<String> refused = new ArrayList<>();
        for (Map<String, Object> r : rows) {
            LocalDate until = r.get("retention_until") == null ? null : ((java.sql.Date) r.get("retention_until")).toLocalDate();
            boolean ok = LifecycleSupport.LIVE.contains((String) r.get("status")) && "CONSERVER".equals(r.get("final_action"))
                    && until != null && !until.isAfter(LocalDate.now());
            if (!ok) refused.add(String.valueOf(r.get("reference")));
        }
        if (!refused.isEmpty()) {
            throw ApiException.conflict("NOT_ELIGIBLE", "Pas encore échus ou sort final différent de « conserver » : "
                    + String.join(", ", refused));
        }
        jdbc.update("UPDATE documents SET status = 'DEFINITIF', disposed_at = now(), updated_at = now() WHERE id IN (:ids)",
                params("ids", documentIds));
        for (Map<String, Object> r : rows) {
            support.event(user, (UUID) r.get("id"), DocumentEventType.CONSERVATION_DEFINITIVE, null,
                    Map.of("status", r.get("status")), Map.of("status", "DEFINITIF"));
        }
        audit.log(user.organizationId(), user.id(), "CONSERVATION_DEFINITIVE", "document", null,
                Map.of("documents", rows.stream().map(r -> String.valueOf(r.get("reference"))).toList()), null);
        return rows.size();
    }

    // ───────── Recalcul des échéances ─────────

    /** Recalcul demandé depuis l'écran (après une correction de règles, par exemple). */
    @Transactional
    public RecalcResult recalculate() {
        CurrentUser user = support.requireAny(MANAGE);
        RecalcResult result = recalculate(user.organizationId(), user);
        audit.log(user.organizationId(), user.id(), "ECHEANCES_RECALCULEES", "organization",
                user.organizationId().toString(),
                Map.of("examines", result.examined(), "modifies", result.changed()), null);
        return result;
    }

    /** Initialisation au démarrage (documents classés avant ce module) : sans événement d'historique. */
    @Transactional
    public int initialize(UUID orgId) {
        return recalculate(orgId, null).changed();
    }

    /** Recalcul automatique, dans la transaction qui a modifié une règle, un nœud ou un type. */
    @EventListener
    public void onRetentionInputsChanged(RetentionInputsChanged event) {
        CurrentUser user = currentUser.get();
        RecalcResult result = recalculate(event.organizationId(), user);
        if (result.changed() > 0) {
            audit.log(event.organizationId(), user.id(), "ECHEANCES_RECALCULEES", "organization",
                    event.organizationId().toString(),
                    Map.of("cause", event.cause(), "modifies", result.changed()), null);
        }
    }

    /**
     * Recalcule règle, échéance et sort final des documents classés non encore traités.
     * Les documents inscrits sur un bordereau soumis ou visé ne bougent pas.
     *
     * @param user auteur des événements d'historique ; null pour l'initialisation (aucun événement)
     */
    RecalcResult recalculate(UUID orgId, CurrentUser user) {
        List<Map<String, Object>> docs = jdbc.queryForList("""
                SELECT id, node_id, type_id, document_date, created_at, reference, retention_until,
                       retention_rule_id, final_action
                FROM documents WHERE organization_id = :org AND status IN ('ACTIVE', 'INTERMEDIAIRE')
                  AND node_id IS NOT NULL""", params("org", orgId));
        Map<UUID, ClassificationNode> nodes = new HashMap<>();
        List<String> changedRefs = new ArrayList<>();
        int changed = 0;
        for (Map<String, Object> d : docs) {
            UUID nodeId = (UUID) d.get("node_id");
            ClassificationNode node = nodes.computeIfAbsent(nodeId, id -> classification.find(orgId, id));
            LocalDate docDate = d.get("document_date") == null ? null : ((java.sql.Date) d.get("document_date")).toLocalDate();
            RetentionPolicy.Result r = policy.evaluate(node, (UUID) d.get("type_id"), docDate,
                    ((Timestamp) d.get("created_at")).toInstant());
            LocalDate before = d.get("retention_until") == null ? null : ((java.sql.Date) d.get("retention_until")).toLocalDate();
            String action = r.finalAction() == null ? null : r.finalAction().name();
            if (Objects.equals(before, r.retentionUntil()) && Objects.equals(d.get("retention_rule_id"), r.ruleId())
                    && Objects.equals(d.get("final_action"), action)) {
                continue;
            }
            jdbc.update("""
                    UPDATE documents SET retention_until = :until, retention_rule_id = :rule, final_action = :action,
                    updated_at = now() WHERE id = :id""",
                    params("until", r.retentionUntil(), "rule", r.ruleId(), "action", action, "id", d.get("id")));
            changed++;
            if (changedRefs.size() < 50) changedRefs.add(String.valueOf(d.get("reference")));
            if (user != null && !Objects.equals(before, r.retentionUntil())) {
                Map<String, Object> b = new LinkedHashMap<>();
                b.put("retentionUntil", before);
                b.put("finalAction", d.get("final_action"));
                Map<String, Object> a = new LinkedHashMap<>();
                a.put("retentionUntil", r.retentionUntil());
                a.put("finalAction", action);
                a.put("rule", r.ruleName());
                support.event(user, (UUID) d.get("id"), DocumentEventType.ECHEANCE_RECALCULEE, null, b, a);
            }
        }
        return new RecalcResult(docs.size(), changed, changedRefs);
    }

    private long count(String sql, MapSqlParameterSource p) {
        Long n = jdbc.queryForObject(sql, p, Long.class);
        return n == null ? 0 : n;
    }
}
