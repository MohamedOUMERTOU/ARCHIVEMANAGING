package com.ged.audit;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import org.hibernate.annotations.ColumnTransformer;

/** Entrée du journal général : jamais modifiée ni supprimée (un trigger l'interdit en base). */
@Entity
@Table(name = "audit_log")
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organization_id")
    private UUID organizationId;

    @Column(name = "user_id")
    private UUID userId;

    private String action;
    private String entity;

    @Column(name = "entity_id")
    private String entityId;

    @ColumnTransformer(write = "?::jsonb")
    private String details;

    private String ip;
    private Instant at;

    @Column(name = "prev_hash")
    private String prevHash;

    private String hash;

    protected AuditLog() {}

    AuditLog(AuditHasher.Entry e, String detailsJson, String prevHash, String hash) {
        this.organizationId = e.organizationId();
        this.userId = e.userId();
        this.action = e.action();
        this.entity = e.entity();
        this.entityId = e.entityId();
        this.details = detailsJson;
        this.ip = e.ip();
        this.at = e.at();
        this.prevHash = prevHash;
        this.hash = hash;
    }

    public Long getId() { return id; }
    public UUID getOrganizationId() { return organizationId; }
    public UUID getUserId() { return userId; }
    public String getAction() { return action; }
    public String getEntity() { return entity; }
    public String getEntityId() { return entityId; }
    public String getDetails() { return details; }
    public String getIp() { return ip; }
    public Instant getAt() { return at; }
    public String getPrevHash() { return prevHash; }
    public String getHash() { return hash; }
}
