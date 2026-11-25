package com.ged.lifecycle;

import static com.ged.lifecycle.LifecycleSupport.APPROVE;
import static com.ged.lifecycle.LifecycleSupport.MANAGE;
import static com.ged.lifecycle.LifecycleSupport.params;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.common.ApiException;
import com.ged.document.DocumentEventType;
import com.ged.lifecycle.LifecycleDtos.CreateHold;
import com.ged.lifecycle.LifecycleDtos.HoldDetail;
import com.ged.lifecycle.LifecycleDtos.HoldDocument;
import com.ged.lifecycle.LifecycleDtos.HoldSummary;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Gels juridiques : tant qu'un document est dans un gel actif, aucun sort final ne peut lui être appliqué
 * (ni élimination, ni versement), et il ne peut être ni modifié ni reclassé. Poser et lever un gel est
 * ouvert aux archivistes (lifecycle.manage) comme aux juristes (lifecycle.approve).
 */
@Service
public class LegalHoldService {

    private static final String HOLD_SELECT = """
            SELECT h.id, h.name, h.case_reference, h.reason, cu.full_name AS created_by, h.created_at,
                   h.released_at, ru.full_name AS released_by, h.release_reason,
                   (SELECT count(*) FROM legal_hold_documents x WHERE x.hold_id = h.id) AS documents
            FROM legal_holds h
            JOIN users cu ON cu.id = h.created_by
            LEFT JOIN users ru ON ru.id = h.released_by
            """;

    private final LifecycleSupport support;
    private final NamedParameterJdbcTemplate jdbc;
    private final AuditService audit;

    public LegalHoldService(LifecycleSupport support, AuditService audit) {
        this.support = support;
        this.jdbc = support.jdbc();
        this.audit = audit;
    }

    @Transactional(readOnly = true)
    public List<HoldSummary> list() {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        return jdbc.query(HOLD_SELECT + " WHERE h.organization_id = :org ORDER BY h.released_at NULLS FIRST, h.created_at DESC",
                params("org", user.organizationId()), (rs, i) -> summary(rs));
    }

    @Transactional(readOnly = true)
    public HoldDetail get(UUID id) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        return detail(user, id);
    }

    @Transactional
    public HoldDetail create(CreateHold in) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        String name = support.required(in.name(), "name", "Donnez un nom au gel (l'affaire concernée)");
        String reason = support.required(in.reason(), "reason", "Indiquez le motif du gel");
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO legal_holds (id, organization_id, name, case_reference, reason, created_by)
                VALUES (:id, :org, :name, :case, :reason, :user)""",
                params("id", id, "org", user.organizationId(), "name", name,
                        "case", in.caseReference() == null || in.caseReference().isBlank() ? null : in.caseReference().trim(),
                        "reason", reason, "user", user.id()));
        audit.log(user.organizationId(), user.id(), "GEL_CREE", "legal_hold", id.toString(),
                Map.of("name", name, "reason", reason), null);
        if (in.documentIds() != null && !in.documentIds().isEmpty()) addDocuments(user, id, in.documentIds());
        return detail(user, id);
    }

    @Transactional
    public HoldDetail addDocuments(UUID holdId, List<UUID> documentIds) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        addDocuments(user, holdId, documentIds);
        return detail(user, holdId);
    }

    private void addDocuments(CurrentUser user, UUID holdId, List<UUID> documentIds) {
        Map<String, Object> hold = activeHold(user, holdId);
        if (documentIds == null || documentIds.isEmpty()) throw ApiException.badRequest("EMPTY", "Sélectionnez des documents");
        List<Map<String, Object>> docs = jdbc.queryForList("""
                SELECT id, reference, status FROM documents WHERE organization_id = :org AND id IN (:ids)""",
                params("org", user.organizationId(), "ids", new LinkedHashSet<>(documentIds)));
        if (docs.size() != new LinkedHashSet<>(documentIds).size()) throw ApiException.notFound("Document");
        List<String> refused = docs.stream()
                .filter(d -> List.of("A_CLASSER", "ELIMINE", "VERSE").contains((String) d.get("status")))
                .map(d -> String.valueOf(d.get("reference") == null ? "document à classer" : d.get("reference"))).toList();
        if (!refused.isEmpty()) {
            throw ApiException.conflict("NOT_HOLDABLE", "Seuls les documents classés encore conservés peuvent être gelés : "
                    + String.join(", ", refused));
        }
        List<UUID> added = new ArrayList<>();
        for (Map<String, Object> d : docs) {
            int n = jdbc.update("""
                    INSERT INTO legal_hold_documents (hold_id, document_id, added_by) VALUES (:hold, :doc, :user)
                    ON CONFLICT DO NOTHING""", params("hold", holdId, "doc", d.get("id"), "user", user.id()));
            if (n == 1) {
                added.add((UUID) d.get("id"));
                support.event(user, (UUID) d.get("id"), DocumentEventType.GEL_POSE, (String) hold.get("reason"), null,
                        holdInfo(hold));
            }
        }
        support.syncHoldFlags(added);
        if (!added.isEmpty()) {
            audit.log(user.organizationId(), user.id(), "GEL_DOCUMENTS_AJOUTES", "legal_hold", holdId.toString(),
                    Map.of("documents", added.size()), null);
        }
    }

    /** Retire un document d'un gel actif (erreur de périmètre) : motif obligatoire. */
    @Transactional
    public HoldDetail removeDocument(UUID holdId, UUID documentId, String reason) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        Map<String, Object> hold = activeHold(user, holdId);
        String why = support.required(reason, "reason", "Indiquez pourquoi le document sort du gel");
        int n = jdbc.update("DELETE FROM legal_hold_documents WHERE hold_id = :hold AND document_id = :doc",
                params("hold", holdId, "doc", documentId));
        if (n == 0) throw ApiException.notFound("Document du gel");
        support.event(user, documentId, DocumentEventType.GEL_LEVE, why, holdInfo(hold), null);
        support.syncHoldFlags(List.of(documentId));
        audit.log(user.organizationId(), user.id(), "GEL_DOCUMENT_RETIRE", "legal_hold", holdId.toString(),
                Map.of("document", documentId.toString(), "reason", why), null);
        return detail(user, holdId);
    }

    /** Lève le gel (affaire close) : les documents reprennent leur cycle de vie, sauf s'ils sont dans un autre gel. */
    @Transactional
    public HoldDetail release(UUID holdId, String reason) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        Map<String, Object> hold = activeHold(user, holdId);
        String why = support.required(reason, "reason", "Indiquez pourquoi le gel est levé (affaire close, jugement…)");
        jdbc.update("""
                UPDATE legal_holds SET released_at = now(), released_by = :user, release_reason = :reason
                WHERE id = :id""", params("user", user.id(), "reason", why, "id", holdId));
        List<UUID> docs = jdbc.queryForList("SELECT document_id FROM legal_hold_documents WHERE hold_id = :id",
                params("id", holdId), UUID.class);
        for (UUID doc : docs) support.event(user, doc, DocumentEventType.GEL_LEVE, why, holdInfo(hold), null);
        support.syncHoldFlags(docs);
        audit.log(user.organizationId(), user.id(), "GEL_LEVE", "legal_hold", holdId.toString(),
                Map.of("name", hold.get("name"), "reason", why, "documents", docs.size()), null);
        return detail(user, holdId);
    }

    private Map<String, Object> activeHold(CurrentUser user, UUID holdId) {
        Map<String, Object> hold = jdbc.queryForList("""
                SELECT id, name, case_reference, reason, released_at FROM legal_holds
                WHERE id = :id AND organization_id = :org""", params("id", holdId, "org", user.organizationId()))
                .stream().findFirst().orElseThrow(() -> ApiException.notFound("Gel juridique"));
        if (hold.get("released_at") != null) throw ApiException.conflict("RELEASED", "Ce gel a déjà été levé");
        return hold;
    }

    private static Map<String, Object> holdInfo(Map<String, Object> hold) {
        return hold.get("case_reference") == null
                ? Map.of("gel", hold.get("name"))
                : Map.of("gel", hold.get("name"), "affaire", hold.get("case_reference"));
    }

    private HoldDetail detail(CurrentUser user, UUID id) {
        HoldSummary summary = jdbc.query(HOLD_SELECT + " WHERE h.id = :id AND h.organization_id = :org",
                params("id", id, "org", user.organizationId()), (rs, i) -> summary(rs))
                .stream().findFirst().orElseThrow(() -> ApiException.notFound("Gel juridique"));
        List<HoldDocument> docs = jdbc.query("""
                SELECT d.id, d.reference, d.title, d.status, d.retention_until, d.final_action, u.full_name, x.added_at
                FROM legal_hold_documents x JOIN documents d ON d.id = x.document_id JOIN users u ON u.id = x.added_by
                WHERE x.hold_id = :id ORDER BY d.reference""", params("id", id),
                (rs, i) -> new HoldDocument(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3), rs.getString(4),
                        rs.getObject(5, LocalDate.class), rs.getString(6), rs.getString(7),
                        rs.getTimestamp(8).toInstant()));
        return new HoldDetail(summary, docs);
    }

    private static HoldSummary summary(ResultSet rs) throws SQLException {
        return new HoldSummary(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("case_reference"),
                rs.getString("reason"), rs.getString("created_by"), rs.getTimestamp("created_at").toInstant(),
                instant(rs, "released_at"), rs.getString("released_by"), rs.getString("release_reason"),
                rs.getLong("documents"));
    }

    static Instant instant(ResultSet rs, String column) throws SQLException {
        java.sql.Timestamp t = rs.getTimestamp(column);
        return t == null ? null : t.toInstant();
    }
}
