package com.ged.classification;

import com.ged.common.BaseEntity;
import com.ged.common.TreePaths;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "classification_nodes")
public class ClassificationNode extends BaseEntity {

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "parent_id")
    private UUID parentId;

    @Enumerated(EnumType.STRING)
    private NodeType type;

    private String code;
    private String title;
    private String description;

    @Column(name = "id_path")
    private String idPath;

    private int depth;

    @Column(name = "retention_rule_id")
    private UUID retentionRuleId;

    @Column(name = "closed_at")
    private LocalDate closedAt;

    protected ClassificationNode() {}

    public ClassificationNode(UUID organizationId, ClassificationNode parent, NodeType type, String code, String title,
                              String description, UUID retentionRuleId) {
        this.organizationId = organizationId;
        this.parentId = parent == null ? null : parent.getId();
        this.type = type;
        this.code = code;
        this.title = title;
        this.description = description;
        this.retentionRuleId = retentionRuleId;
        this.idPath = TreePaths.build(parent == null ? null : parent.getIdPath(), id);
        this.depth = TreePaths.depth(idPath);
    }

    public void update(String code, String title, String description, UUID retentionRuleId, LocalDate closedAt) {
        if (code != null) this.code = code;
        if (title != null) this.title = title;
        this.description = description;
        this.retentionRuleId = retentionRuleId;
        this.closedAt = closedAt;
    }

    void moveUnder(UUID newParentId) {
        this.parentId = newParentId;
    }

    public UUID getOrganizationId() { return organizationId; }
    public UUID getParentId() { return parentId; }
    public NodeType getType() { return type; }
    public String getCode() { return code; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public String getIdPath() { return idPath; }
    public int getDepth() { return depth; }
    public UUID getRetentionRuleId() { return retentionRuleId; }
    public LocalDate getClosedAt() { return closedAt; }
}
