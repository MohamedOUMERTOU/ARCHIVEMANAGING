package com.ged.lifecycle;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * Documents classés avant le module cycle de vie : leur règle et leur sort final n'étaient pas
 * enregistrés. Ils sont renseignés au démarrage (sans événement d'historique : rien ne change pour eux).
 */
@Component
@Order(0)
public class LifecycleInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(LifecycleInitializer.class);

    private final NamedParameterJdbcTemplate jdbc;
    private final LifecycleService lifecycle;

    public LifecycleInitializer(NamedParameterJdbcTemplate jdbc, LifecycleService lifecycle) {
        this.jdbc = jdbc;
        this.lifecycle = lifecycle;
    }

    @Override
    public void run(ApplicationArguments args) {
        List<UUID> orgs = jdbc.queryForList("""
                SELECT DISTINCT organization_id FROM documents
                WHERE status IN ('ACTIVE', 'INTERMEDIAIRE') AND node_id IS NOT NULL AND retention_rule_id IS NULL""",
                Map.of(), UUID.class);
        for (UUID org : orgs) {
            int changed = lifecycle.initialize(org);
            if (changed > 0) log.info("Cycle de vie : règle et sort final renseignés pour {} document(s)", changed);
        }
    }
}
