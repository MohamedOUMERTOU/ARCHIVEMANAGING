package com.ged.retention;

import com.ged.classification.ClassificationNode;
import com.ged.classification.ClassificationService;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Règle de conservation applicable à un document et ce qui en découle : échéance et sort final.
 *
 * <p>La règle vient du nœud du plan de classement (ou du plus proche parent qui en a une), à défaut
 * du type de document. C'est le seul endroit où ce choix est fait : classement, reclassement,
 * modification de la date du document et recalcul des échéances passent tous par ici.
 */
@Component
public class RetentionPolicy {

    /** Résultat : règle retenue (ou null), échéance (null si illimitée ou point de départ inconnu), sort final. */
    public record Result(UUID ruleId, String ruleName, LocalDate retentionUntil, RetentionRule.FinalAction finalAction) {
        public static final Result NONE = new Result(null, null, null, null);
    }

    private final ClassificationService classification;
    private final RetentionRuleRepository rules;
    private final NamedParameterJdbcTemplate jdbc;

    public RetentionPolicy(ClassificationService classification, RetentionRuleRepository rules,
                           NamedParameterJdbcTemplate jdbc) {
        this.classification = classification;
        this.rules = rules;
        this.jdbc = jdbc;
    }

    public Result evaluate(ClassificationNode node, UUID typeId, LocalDate documentDate, Instant createdAt) {
        UUID ruleId = classification.effectiveRetention(node).map(ClassificationService.RetentionDto::id)
                .orElseGet(() -> typeDefaultRule(typeId));
        if (ruleId == null) return Result.NONE;
        RetentionRule rule = rules.findById(ruleId).orElse(null);
        if (rule == null) return Result.NONE;
        LocalDate until = RetentionCalculator.retentionUntil(rule, documentDate, node.getClosedAt(),
                createdAt.atZone(ZoneOffset.UTC).toLocalDate());
        return new Result(rule.getId(), rule.getName(), until, rule.getFinalAction());
    }

    private UUID typeDefaultRule(UUID typeId) {
        if (typeId == null) return null;
        List<UUID> ids = jdbc.queryForList("SELECT default_retention_rule_id FROM document_types WHERE id = :id",
                Map.of("id", typeId), UUID.class);
        return ids.isEmpty() ? null : ids.get(0);
    }
}
