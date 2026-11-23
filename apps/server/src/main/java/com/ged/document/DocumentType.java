package com.ged.document;

import com.ged.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;

@Entity
@Table(name = "document_types")
public class DocumentType extends BaseEntity {

    @Column(name = "organization_id")
    private UUID organizationId;

    private String code;
    private String name;

    /** Liste des champs, en JSON : [{ key, label, type, required, options? }] */
    @Column(name = "metadata_schema")
    @ColumnTransformer(write = "?::jsonb")
    private String metadataSchema;

    @Column(name = "default_retention_rule_id")
    private UUID defaultRetentionRuleId;

    protected DocumentType() {}

    public DocumentType(UUID organizationId, String code, String name, String metadataSchema, UUID defaultRetentionRuleId) {
        this.organizationId = organizationId;
        this.code = code;
        this.name = name;
        this.metadataSchema = metadataSchema;
        this.defaultRetentionRuleId = defaultRetentionRuleId;
    }

    public void update(String name, String metadataSchema, UUID defaultRetentionRuleId) {
        this.name = name;
        this.metadataSchema = metadataSchema;
        this.defaultRetentionRuleId = defaultRetentionRuleId;
    }

    public UUID getOrganizationId() { return organizationId; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getMetadataSchema() { return metadataSchema; }
    public UUID getDefaultRetentionRuleId() { return defaultRetentionRuleId; }
}
