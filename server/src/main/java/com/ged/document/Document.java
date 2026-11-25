package com.ged.document;

import com.ged.common.BaseEntity;
import com.ged.retention.RetentionPolicy;
import com.ged.retention.RetentionRule;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;

@Entity
@Table(name = "documents")
public class Document extends BaseEntity {

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "node_id")
    private UUID nodeId;

    @Column(name = "type_id")
    private UUID typeId;

    private String title;

    /** Cote : attribuée au classement */
    private String reference;

    @Column(name = "document_date")
    private LocalDate documentDate;

    @ColumnTransformer(write = "?::jsonb")
    private String metadata = "{}";

    @Enumerated(EnumType.STRING)
    private DocumentStatus status = DocumentStatus.A_CLASSER;

    @Column(name = "retention_until")
    private LocalDate retentionUntil;

    @Column(name = "retention_rule_id")
    private UUID retentionRuleId;

    @Enumerated(EnumType.STRING)
    @Column(name = "final_action")
    private RetentionRule.FinalAction finalAction;

    // Tenus par le cycle de vie (gels, bordereaux) en SQL : jamais réécrits par JPA
    @Column(name = "legal_hold", insertable = false, updatable = false)
    private boolean legalHold;

    @Column(name = "disposed_at", insertable = false, updatable = false)
    private Instant disposedAt;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at")
    private Instant updatedAt = Instant.now();

    protected Document() {}

    public Document(UUID organizationId, String title, UUID createdBy) {
        this.organizationId = organizationId;
        this.title = title;
        this.createdBy = createdBy;
    }

    @PreUpdate
    void touch() {
        this.updatedAt = Instant.now();
    }

    void classify(UUID nodeId, UUID typeId, String reference, RetentionPolicy.Result retention) {
        this.nodeId = nodeId;
        this.typeId = typeId;
        this.reference = reference;
        applyRetention(retention);
        if (this.status == DocumentStatus.A_CLASSER) this.status = DocumentStatus.ACTIVE;
    }

    void applyRetention(RetentionPolicy.Result retention) {
        this.retentionUntil = retention.retentionUntil();
        this.retentionRuleId = retention.ruleId();
        this.finalAction = retention.finalAction();
    }

    void describe(String title, LocalDate documentDate, String metadataJson) {
        this.title = title;
        this.documentDate = documentDate;
        this.metadata = metadataJson;
    }

    public UUID getOrganizationId() { return organizationId; }
    public UUID getNodeId() { return nodeId; }
    public UUID getTypeId() { return typeId; }
    public String getTitle() { return title; }
    public String getReference() { return reference; }
    public LocalDate getDocumentDate() { return documentDate; }
    public String getMetadata() { return metadata; }
    public DocumentStatus getStatus() { return status; }
    public LocalDate getRetentionUntil() { return retentionUntil; }
    public boolean isLegalHold() { return legalHold; }
    public UUID getRetentionRuleId() { return retentionRuleId; }
    public RetentionRule.FinalAction getFinalAction() { return finalAction; }
    public Instant getDisposedAt() { return disposedAt; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
