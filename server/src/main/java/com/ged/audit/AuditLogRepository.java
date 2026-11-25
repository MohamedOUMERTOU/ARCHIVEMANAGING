package com.ged.audit;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Optional<AuditLog> findFirstByOrganizationIdOrderByIdDesc(UUID organizationId);

    Optional<AuditLog> findFirstByOrganizationIdIsNullOrderByIdDesc();

    List<AuditLog> findByOrganizationIdOrderByIdAsc(UUID organizationId);

    @Query("select a from AuditLog a where a.organizationId = :org and (:before is null or a.id < :before) order by a.id desc")
    List<AuditLog> page(UUID org, Long before, Pageable pageable);
}
