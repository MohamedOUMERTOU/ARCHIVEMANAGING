package com.ged.retention;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface RetentionRuleRepository extends JpaRepository<RetentionRule, UUID> {

    List<RetentionRule> findByOrganizationIdOrderByName(UUID organizationId);
}
