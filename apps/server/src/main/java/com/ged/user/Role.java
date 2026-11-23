package com.ged.user;

import com.ged.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.List;
import java.util.UUID;

@Entity
@Table(name = "roles")
public class Role extends BaseEntity {

    @Column(name = "organization_id")
    private UUID organizationId;

    private String name;

    /** Permissions générales ; « * » donne tous les droits. */
    @Column(columnDefinition = "text[]")
    private String[] permissions = new String[0];

    private String description;

    protected Role() {}

    public void update(String name, String description, List<String> permissions) {
        this.name = name;
        this.description = description;
        this.permissions = permissions.toArray(String[]::new);
    }

    public String getDescription() {
        return description;
    }

    public Role(UUID organizationId, String name, List<String> permissions) {
        this.organizationId = organizationId;
        this.name = name;
        this.permissions = permissions.toArray(String[]::new);
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public String getName() {
        return name;
    }

    public List<String> getPermissions() {
        return List.of(permissions);
    }
}
