package com.ged;

import static org.assertj.core.api.Assertions.assertThat;

import com.ged.audit.AuditHasher;
import com.ged.common.CanonicalJson;
import com.ged.common.TreePaths;
import com.ged.document.MetadataValidator;
import com.ged.retention.RetentionCalculator;
import com.ged.retention.RetentionRule;
import com.ged.retention.RetentionRule.FinalAction;
import com.ged.retention.RetentionRule.StartEvent;
import java.time.Instant;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

/** Règles métier pures : aucune base, aucun contexte Spring. */
class UnitTests {

    @Nested
    class Canonical {
        @Test
        void trieLesClesPourUneEmpreinteStable() {
            Map<String, Object> a = new LinkedHashMap<>();
            a.put("b", 1);
            a.put("a", List.of("x", Map.of("z", true, "y", "q\"uote")));
            Map<String, Object> b = new LinkedHashMap<>();
            b.put("a", List.of("x", Map.of("y", "q\"uote", "z", true)));
            b.put("b", 1);
            assertThat(CanonicalJson.write(a)).isEqualTo(CanonicalJson.write(b))
                    .isEqualTo("{\"a\":[\"x\",{\"y\":\"q\\\"uote\",\"z\":true}],\"b\":1}");
        }
    }

    @Nested
    class Audit {
        private final AuditHasher.Entry entry = new AuditHasher.Entry(UUID.randomUUID(), null, "CONNEXION", "user",
                "42", Map.of("ip", "10.0.0.1"), null, Instant.parse("2026-11-22T10:00:00Z"));

        @Test
        void lEmpreinteDependDeLEntreePrecedente() {
            assertThat(AuditHasher.hash(null, entry)).hasSize(64)
                    .isNotEqualTo(AuditHasher.hash("abc", entry))
                    .isEqualTo(AuditHasher.hash(null, entry));
        }

        @Test
        void modifierUnDetailChangeLEmpreinte() {
            var altered = new AuditHasher.Entry(entry.organizationId(), null, "CONNEXION", "user", "42",
                    Map.of("ip", "10.0.0.2"), null, entry.at());
            assertThat(AuditHasher.hash(null, altered)).isNotEqualTo(AuditHasher.hash(null, entry));
        }
    }

    @Nested
    class Retention {
        private RetentionRule rule(Integer years, StartEvent start) {
            return new RetentionRule(UUID.randomUUID(), "r", years, start, FinalAction.VERSER, null);
        }

        @Test
        void courtJusquAu31DecembreDeLAnneeDEcheance() {
            var until = RetentionCalculator.retentionUntil(rule(10, StartEvent.CLOTURE_DOSSIER), LocalDate.of(2025, 3, 14),
                    LocalDate.of(2025, 12, 31), LocalDate.of(2025, 3, 16));
            assertThat(until).isEqualTo(LocalDate.of(2035, 12, 31));
        }

        @Test
        void attendLaClotureDuDossier() {
            assertThat(RetentionCalculator.retentionUntil(rule(10, StartEvent.CLOTURE_DOSSIER), LocalDate.of(2025, 3, 14),
                    null, LocalDate.of(2025, 3, 16))).isNull();
        }

        @Test
        void conservationIllimitee() {
            assertThat(RetentionCalculator.retentionUntil(rule(null, StartEvent.DATE_DOCUMENT), LocalDate.of(2025, 1, 1),
                    null, LocalDate.of(2025, 1, 1))).isNull();
        }
    }

    @Nested
    class Metadata {
        private final List<Map<String, Object>> schema = List.of(
                Map.of("key", "fournisseur", "type", "TEXT", "required", true),
                Map.of("key", "montant", "type", "AMOUNT", "required", true),
                Map.of("key", "devise", "type", "LIST", "required", false, "options", List.of("MAD", "EUR")),
                Map.of("key", "echeance", "type", "DATE", "required", false));

        @Test
        void accepteDesValeursValides() {
            assertThat(MetadataValidator.validate(schema,
                    Map.of("fournisseur", "ACME", "montant", "1 200,50", "devise", "MAD", "echeance", "2026-01-31"))).isEmpty();
        }

        @Test
        void signaleChaqueChampInvalide() {
            assertThat(MetadataValidator.validate(schema, Map.of("montant", "douze", "devise", "GBP", "echeance", "31/01/2026")))
                    .containsOnlyKeys("metadata.fournisseur", "metadata.montant", "metadata.devise", "metadata.echeance");
        }
    }

    @Nested
    class Paths {
        @Test
        void construitEtCompareLesChemins() {
            UUID f = UUID.randomUUID();
            UUID s = UUID.randomUUID();
            String fonds = TreePaths.build(null, f);
            String serie = TreePaths.build(fonds, s);
            assertThat(TreePaths.ancestorIds(serie)).containsExactly(f, s);
            assertThat(TreePaths.depth(serie)).isEqualTo(1);
            assertThat(TreePaths.isSelfOrDescendant(fonds, serie)).isTrue();
            assertThat(TreePaths.isSelfOrDescendant(serie, fonds)).isFalse();
        }
    }
}
