package com.ged.user;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, UUID> {

    @EntityGraph(attributePaths = {"organization", "roles"})
    Optional<User> findByEmail(String email);

    @EntityGraph(attributePaths = {"organization", "roles"})
    Optional<User> findWithRolesById(UUID id);
}
