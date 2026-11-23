package com.ged.retention;

import com.ged.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Table;
import java.util.UUID;

@Entity
@Table(name = "retention_rules")
public class RetentionRule extends BaseEntity {

    public enum StartEvent { DATE_DOCUMENT, CLOTURE_DOSSIER, DATE_CREATION }

    public enum FinalAction { CONSERVER, DETRUIRE, VERSER }

    @Column(name = "organization_id")
    private UUID organizationId;

    private String name;

    /** null = conservation illimitée */
    @Column(name = "duration_years")
    private Integer durationYears;

    @Enumerated(EnumType.STRING)
    @Column(name = "start_event")
    private StartEvent startEvent;

    @Enumerated(EnumType.STRING)
    @Column(name = "final_action")
    private FinalAction finalAction;

    @Column(name = "legal_basis")
    private String legalBasis;

    protected RetentionRule() {}

    public RetentionRule(UUID organizationId, String name, Integer durationYears, StartEvent startEvent,
                         FinalAction finalAction, String legalBasis) {
        this.organizationId = organizationId;
        this.name = name;
        this.durationYears = durationYears;
        this.startEvent = startEvent;
        this.finalAction = finalAction;
        this.legalBasis = legalBasis;
    }

    public void update(String name, Integer durationYears, StartEvent startEvent, FinalAction finalAction, String legalBasis) {
        this.name = name;
        this.durationYears = durationYears;
        this.startEvent = startEvent;
        this.finalAction = finalAction;
        this.legalBasis = legalBasis;
    }

    public UUID getOrganizationId() { return organizationId; }
    public String getName() { return name; }
    public Integer getDurationYears() { return durationYears; }
    public StartEvent getStartEvent() { return startEvent; }
    public FinalAction getFinalAction() { return finalAction; }
    public String getLegalBasis() { return legalBasis; }
}
