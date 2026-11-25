package com.ged.document;

import com.ged.classification.ClassificationService;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Objets échangés avec le front-end pour les documents. */
public final class DocumentDtos {

    private DocumentDtos() {}

    public record PageDto<T>(List<T> content, long totalElements, int totalPages, int number, int size) {}

    public record DocumentSummary(UUID id, String reference, String title, DocumentStatus status, LocalDate documentDate,
                                  UUID typeId, String typeName, UUID nodeId, String nodeTitle, LocalDate retentionUntil,
                                  boolean legalHold, Instant createdAt, int versionCount, String filename,
                                  String mimeType, Long sizeBytes, List<String> tags, List<TextHit> hits) {
        public DocumentSummary withHits(List<TextHit> h) {
            return new DocumentSummary(id, reference, title, status, documentDate, typeId, typeName, nodeId, nodeTitle,
                    retentionUntil, legalHold, createdAt, versionCount, filename, mimeType, sizeBytes, tags, h);
        }
    }

    /** Page où le mot cherché a été trouvé, avec un extrait (mots trouvés entre U+0002 et U+0003). */
    public record TextHit(int page, String snippet) {}

    public record TypeRef(UUID id, String code, String name, List<Map<String, Object>> metadataSchema) {}

    public record NodeRef(UUID id, String code, String title, String path) {}

    public record VersionDto(int versionNo, String filename, String mimeType, long sizeBytes, String sha256,
                             String replaceReason, String createdBy, Instant createdAt) {}

    public record DocumentDetail(UUID id, String reference, String title, DocumentStatus status, LocalDate documentDate,
                                 Map<String, Object> metadata, TypeRef type, NodeRef node,
                                 ClassificationService.RetentionDto retentionRule, LocalDate retentionUntil,
                                 boolean legalHold, String createdBy, Instant createdAt, Instant updatedAt,
                                 List<String> tags, List<VersionDto> versions, DuplicateRef duplicateOf,
                                 LocationRef physicalLocation, LoanRef openLoan, LifecycleRef lifecycle) {}

    /** Cycle de vie : sort final prévu, gels juridiques actifs, bordereau en cours, date du sort exécuté. */
    public record LifecycleRef(String finalAction, Instant disposedAt, List<HoldRef> holds, ListRef pendingList) {}

    public record HoldRef(UUID id, String name, String caseReference) {}

    public record ListRef(UUID id, String number, String kind, String status) {}

    /** Emplacement de l'original papier. */
    public record LocationRef(UUID id, String code, String label, String path) {}

    /** Prêt en cours de l'original (directement, ou parce que sa boîte est prêtée). */
    public record LoanRef(UUID id, String borrower, LocalDate dueAt, boolean viaBox) {}

    public record DuplicateRef(UUID id, String reference, String title) {}

    public record EventDto(UUID id, DocumentEventType type, String actor, String onBehalfOf, String reason,
                           Map<String, Object> before, Map<String, Object> after, Instant at) {}

    public record UploadResult(UUID id, String title, String sha256, DuplicateRef duplicateOf) {}

    public record ClassifyCommand(UUID nodeId, UUID typeId, String title, LocalDate documentDate,
                                  Map<String, Object> metadata, List<String> tags) {}

    public record DescribeCommand(String title, LocalDate documentDate, Map<String, Object> metadata, List<String> tags) {}

    public enum RequestKind { COPIE_SIMPLE, COPIE_CERTIFIEE, ORIGINAL }

    public record SearchQuery(String q, DocumentStatus status, UUID typeId, UUID nodeId, LocalDate from, LocalDate to,
                              String tag, int page, int size, String sort, UUID locationId, String in) {}
}
