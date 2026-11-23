package com.ged.document;

import com.ged.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;

/** Événement de l'historique d'un document : en ajout seul (un trigger interdit toute modification). */
@Entity
@Table(name = "document_events")
public class DocumentEvent extends BaseEntity {

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "document_id")
    private UUID documentId;

    @Enumerated(EnumType.STRING)
    private DocumentEventType type;

    @Column(name = "actor_id")
    private UUID actorId;

    @Column(name = "on_behalf_of")
    private String onBehalfOf;

    private String reason;

    @Column(name = "before_data")
    @ColumnTransformer(write = "?::jsonb")
    private String beforeData;

    @Column(name = "after_data")
    @ColumnTransformer(write = "?::jsonb")
    private String afterData;

    private Instant at = Instant.now();

    protected DocumentEvent() {}

    public DocumentEvent(UUID organizationId, UUID documentId, DocumentEventType type, UUID actorId, String onBehalfOf,
                         String reason, String beforeData, String afterData) {
        this.organizationId = organizationId;
        this.documentId = documentId;
        this.type = type;
        this.actorId = actorId;
        this.onBehalfOf = onBehalfOf;
        this.reason = reason;
        this.beforeData = beforeData;
        this.afterData = afterData;
    }

    public UUID getDocumentId() { return documentId; }
    public DocumentEventType getType() { return type; }
    public UUID getActorId() { return actorId; }
    public String getOnBehalfOf() { return onBehalfOf; }
    public String getReason() { return reason; }
    public String getBeforeData() { return beforeData; }
    public String getAfterData() { return afterData; }
    public Instant getAt() { return at; }
}
