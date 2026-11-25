package com.ged.classification;

import com.ged.retention.RetentionInputsChanged;
import org.springframework.context.ApplicationEventPublisher;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.common.ApiException;
import com.ged.common.TreePaths;
import com.ged.retention.RetentionRule;
import com.ged.retention.RetentionRuleRepository;
import jakarta.persistence.EntityManager;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClassificationService {

    public static final String MANAGE = "classification.manage";

    private final ClassificationNodeRepository nodes;
    private final RetentionRuleRepository rules;
    private final CurrentUserProvider currentUser;
    private final AuditService audit;
    private final JdbcTemplate jdbc;
    private final EntityManager em;

    private final ApplicationEventPublisher events;

    public ClassificationService(ClassificationNodeRepository nodes, RetentionRuleRepository rules,
                                 CurrentUserProvider currentUser, AuditService audit, JdbcTemplate jdbc,
                                 EntityManager em, ApplicationEventPublisher events) {
        this.events = events;
        this.nodes = nodes;
        this.rules = rules;
        this.currentUser = currentUser;
        this.audit = audit;
        this.jdbc = jdbc;
        this.em = em;
    }

    public record TreeNodeDto(UUID id, UUID parentId, NodeType type, String code, String title, int depth,
                              long documentCount) {}

    public record NodeDetailDto(UUID id, UUID parentId, NodeType type, String code, String title, String description,
                                int depth, String path, LocalDate closedAt, UUID retentionRuleId,
                                RetentionDto effectiveRetention) {}

    public record RetentionDto(UUID id, String name, Integer durationYears, RetentionRule.StartEvent startEvent,
                               RetentionRule.FinalAction finalAction, boolean inherited) {}

    public record CreateNode(UUID parentId, NodeType type, String code, String title, String description,
                             UUID retentionRuleId) {}

    public record UpdateNode(String code, String title, String description, UUID retentionRuleId, LocalDate closedAt) {}

    /** Tout l'arbre de la société, à plat ; le client le remet en arbre grâce à parentId. */
    @Transactional(readOnly = true)
    public List<TreeNodeDto> tree() {
        CurrentUser user = currentUser.get();
        return jdbc.query("""
                SELECT n.id, n.parent_id, n.type, n.code, n.title, n.depth,
                       (SELECT count(*) FROM documents d WHERE d.node_id = n.id) AS document_count
                FROM classification_nodes n
                WHERE n.organization_id = ?
                ORDER BY n.depth, n.code
                """,
                (rs, i) -> new TreeNodeDto(rs.getObject("id", UUID.class), rs.getObject("parent_id", UUID.class),
                        NodeType.valueOf(rs.getString("type")), rs.getString("code"), rs.getString("title"),
                        rs.getInt("depth"), rs.getLong("document_count")),
                user.organizationId());
    }

    @Transactional(readOnly = true)
    public NodeDetailDto get(UUID id) {
        ClassificationNode node = find(currentUser.get().organizationId(), id);
        return toDetail(node);
    }

    @Transactional
    public NodeDetailDto create(CreateNode input) {
        CurrentUser user = currentUser.require(MANAGE);
        ClassificationNode parent = input.parentId() == null ? null : find(user.organizationId(), input.parentId());
        if (parent == null && input.type() != NodeType.FONDS) {
            throw ApiException.badRequest("ROOT_MUST_BE_FONDS", "Seul un fonds peut être placé à la racine du plan de classement");
        }
        if (parent != null && input.type() == NodeType.FONDS) {
            throw ApiException.badRequest("FONDS_AT_ROOT", "Un fonds ne peut pas être placé sous un autre nœud");
        }
        String code = input.code().trim();
        if (nodes.existsByOrganizationIdAndCode(user.organizationId(), code)) {
            throw ApiException.conflict("NODE_CODE_TAKEN", "La cote « " + code + " » est déjà utilisée");
        }
        validateRule(user, input.retentionRuleId());
        ClassificationNode node = nodes.save(new ClassificationNode(user.organizationId(), parent, input.type(), code,
                input.title().trim(), input.description(), input.retentionRuleId()));
        audit.log(user.organizationId(), user.id(), "NOEUD_CREE", "classification_node", node.getId().toString(),
                Map.of("code", node.getCode(), "title", node.getTitle()), null);
        return toDetail(node);
    }

    @Transactional
    public NodeDetailDto update(UUID id, UpdateNode input) {
        CurrentUser user = currentUser.require(MANAGE);
        ClassificationNode node = find(user.organizationId(), id);
        if (input.code() != null && !input.code().equals(node.getCode())
                && nodes.existsByOrganizationIdAndCode(user.organizationId(), input.code())) {
            throw ApiException.conflict("NODE_CODE_TAKEN", "La cote « " + input.code() + " » est déjà utilisée");
        }
        validateRule(user, input.retentionRuleId());
        String before = node.getTitle();
        boolean retentionInputs = !java.util.Objects.equals(node.getRetentionRuleId(), input.retentionRuleId())
                || !java.util.Objects.equals(node.getClosedAt(), input.closedAt());
        node.update(input.code(), input.title(), input.description(), input.retentionRuleId(), input.closedAt());
        // Règle ou clôture du dossier modifiée : les échéances des documents concernés sont recalculées
        if (retentionInputs) events.publishEvent(new RetentionInputsChanged(user.organizationId(), "nœud " + node.getCode()));
        audit.log(user.organizationId(), user.id(), "NOEUD_MODIFIE", "classification_node", id.toString(),
                Map.of("before", before, "after", node.getTitle()), null);
        return toDetail(node);
    }

    /** Déplace un nœud et tout son sous-arbre en une seule requête ; les documents suivent leur nœud. */
    @Transactional
    public NodeDetailDto move(UUID id, UUID newParentId) {
        CurrentUser user = currentUser.require(MANAGE);
        ClassificationNode node = find(user.organizationId(), id);
        ClassificationNode newParent = find(user.organizationId(), newParentId);
        if (node.getType() == NodeType.FONDS) {
            throw ApiException.badRequest("FONDS_AT_ROOT", "Un fonds reste à la racine");
        }
        if (TreePaths.isSelfOrDescendant(node.getIdPath(), newParent.getIdPath())) {
            throw ApiException.badRequest("MOVE_INTO_SELF", "Impossible de déplacer un nœud dans son propre sous-arbre");
        }
        String fromPath = displayPath(node.getIdPath());
        String oldPrefix = node.getIdPath();
        String newPrefix = TreePaths.build(newParent.getIdPath(), node.getId());
        int deltaDepth = TreePaths.depth(newPrefix) - node.getDepth();

        node.moveUnder(newParent.getId());
        nodes.flush();
        jdbc.update("""
                UPDATE classification_nodes
                SET id_path = ? || substring(id_path FROM ?), depth = depth + ?
                WHERE organization_id = ? AND id_path LIKE ?
                """, newPrefix, oldPrefix.length() + 1, deltaDepth, user.organizationId(), oldPrefix + "%");

        // La requête SQL a changé le chemin en base : on recharge l'entité gardée en mémoire par Hibernate
        em.refresh(node);
        ClassificationNode moved = node;
        audit.log(user.organizationId(), user.id(), "NOEUD_DEPLACE", "classification_node", id.toString(),
                Map.of("from", fromPath, "to", displayPath(moved.getIdPath())), null);
        // La règle héritée peut changer avec le nouveau parent
        events.publishEvent(new RetentionInputsChanged(user.organizationId(), "déplacement de " + moved.getCode()));
        return toDetail(moved);
    }

    @Transactional
    public void delete(UUID id) {
        CurrentUser user = currentUser.require(MANAGE);
        ClassificationNode node = find(user.organizationId(), id);
        Long documents = jdbc.queryForObject("SELECT count(*) FROM documents WHERE node_id = ?", Long.class, id);
        if (nodes.existsByParentId(id) || (documents != null && documents > 0)) {
            throw ApiException.conflict("NODE_NOT_EMPTY", "Le nœud contient des sous-nœuds ou des documents : videz-le avant de le supprimer");
        }
        nodes.delete(node);
        audit.log(user.organizationId(), user.id(), "NOEUD_SUPPRIME", "classification_node", id.toString(),
                Map.of("code", node.getCode(), "title", node.getTitle()), null);
    }

    // ───────── Utilitaires réutilisés par les documents ─────────

    public ClassificationNode find(UUID organizationId, UUID id) {
        return nodes.findByIdAndOrganizationId(id, organizationId).orElseThrow(() -> ApiException.notFound("Nœud"));
    }

    /** Chemin lisible, recalculé à chaque lecture : un renommage est visible tout de suite. */
    @Transactional(readOnly = true)
    public String displayPath(String idPath) {
        List<UUID> ids = TreePaths.ancestorIds(idPath);
        Map<UUID, String> titles = nodes.findByIdIn(ids).stream()
                .collect(Collectors.toMap(ClassificationNode::getId, ClassificationNode::getTitle));
        return ids.stream().map(i -> titles.getOrDefault(i, "?")).collect(Collectors.joining(" › "));
    }

    /** Règle du nœud ou, à défaut, celle de l'ancêtre le plus proche qui en a une. */
    @Transactional(readOnly = true)
    public Optional<RetentionDto> effectiveRetention(ClassificationNode node) {
        List<UUID> chain = new ArrayList<>(TreePaths.ancestorIds(node.getIdPath()));
        java.util.Collections.reverse(chain);
        Map<UUID, ClassificationNode> byId = nodes.findByIdIn(chain).stream()
                .collect(Collectors.toMap(ClassificationNode::getId, Function.identity()));
        for (UUID nodeId : chain) {
            ClassificationNode n = byId.get(nodeId);
            if (n != null && n.getRetentionRuleId() != null) {
                return rules.findById(n.getRetentionRuleId()).map(r -> new RetentionDto(r.getId(), r.getName(),
                        r.getDurationYears(), r.getStartEvent(), r.getFinalAction(), !nodeId.equals(node.getId())));
            }
        }
        return Optional.empty();
    }

    private NodeDetailDto toDetail(ClassificationNode n) {
        return new NodeDetailDto(n.getId(), n.getParentId(), n.getType(), n.getCode(), n.getTitle(), n.getDescription(),
                n.getDepth(), displayPath(n.getIdPath()), n.getClosedAt(), n.getRetentionRuleId(),
                effectiveRetention(n).orElse(null));
    }

    private void validateRule(CurrentUser user, UUID ruleId) {
        if (ruleId != null && rules.findById(ruleId).filter(r -> r.getOrganizationId().equals(user.organizationId())).isEmpty()) {
            throw ApiException.notFound("Règle de conservation");
        }
    }
}
