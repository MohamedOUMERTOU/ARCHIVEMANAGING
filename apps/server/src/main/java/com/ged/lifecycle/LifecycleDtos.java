package com.ged.lifecycle;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** Objets échangés par l'API du cycle de vie. */
public final class LifecycleDtos {

    private LifecycleDtos() {}

    // ───────── Échéancier ─────────

    /** Document classé, avec son échéance et ce qui empêche, le cas échéant, d'appliquer son sort final. */
    public record DueItem(UUID id, String reference, String title, String typeName, String nodePath, String status,
                          LocalDate documentDate, LocalDate retentionUntil, String finalAction, String ruleName,
                          boolean legalHold, String pendingListNumber, UUID pendingListId, String paperLocation,
                          boolean originalOnLoan, int versionCount, long bytes) {}

    public record ActionCount(String finalAction, long due, long upcoming) {}

    /**
     * Synthèse : documents échus et à venir par sort final, gels, bordereaux ouverts,
     * documents dont l'échéance attend un événement (dossier pas encore clos, date manquante).
     */
    public record Summary(List<ActionCount> byAction, long onHold, long awaitingStart, long openLists,
                          long awaitingVisa, long activeHolds, LocalDate today) {}

    public record DocumentIds(List<UUID> documentIds) {}

    public record RecalcResult(int examined, int changed, List<String> changedReferences) {}

    // ───────── Gels juridiques ─────────

    public record HoldSummary(UUID id, String name, String caseReference, String reason, String createdBy,
                              Instant createdAt, Instant releasedAt, String releasedBy, String releaseReason,
                              long documentCount) {}

    public record HoldDocument(UUID id, String reference, String title, String status, LocalDate retentionUntil,
                               String finalAction, String addedBy, Instant addedAt) {}

    public record HoldDetail(HoldSummary hold, List<HoldDocument> documents) {}

    public record CreateHold(String name, String caseReference, String reason, List<UUID> documentIds) {}

    public record Reason(String reason) {}

    // ───────── Bordereaux ─────────

    public record ListSummary(UUID id, String number, String kind, String status, String title, String destination,
                              String createdBy, UUID createdById, Instant createdAt, Instant submittedAt,
                              String decidedBy, Instant decidedAt, Instant executedAt, long documentCount,
                              long bytes) {}

    public record ListItem(UUID documentId, String reference, String title, String typeName, LocalDate documentDate,
                           LocalDate retentionUntil, String ruleName, int versionCount, long bytes,
                           String currentStatus, boolean legalHold, String paperLocation, boolean originalOnLoan) {}

    /** Bordereau complet ; {@code blockers} : ce qui empêche, à l'instant, de le viser ou de l'exécuter. */
    public record ListDetail(ListSummary list, String notes, String submittedBy, String decisionComment,
                             String executedBy, List<ListItem> items, List<String> blockers) {}

    public record CreateList(String kind, String title, String destination, String notes, List<UUID> documentIds) {}

    public record Decision(String comment) {}

    public record Execute(String confirmNumber) {}
}
