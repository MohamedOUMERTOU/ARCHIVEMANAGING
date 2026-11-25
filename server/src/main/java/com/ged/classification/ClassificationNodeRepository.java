package com.ged.classification;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ClassificationNodeRepository extends JpaRepository<ClassificationNode, UUID> {

    Optional<ClassificationNode> findByIdAndOrganizationId(UUID id, UUID organizationId);

    List<ClassificationNode> findByIdIn(Collection<UUID> ids);

    boolean existsByParentId(UUID parentId);

    boolean existsByOrganizationIdAndCode(UUID organizationId, String code);
}
