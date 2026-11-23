package com.ged.document;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Dépôts JPA du domaine « documents ». */
public final class DocumentRepositories {

    private DocumentRepositories() {}

    public interface Documents extends JpaRepository<Document, UUID> {
        Optional<Document> findByIdAndOrganizationId(UUID id, UUID organizationId);
    }

    public interface Versions extends JpaRepository<DocumentVersion, UUID> {
        List<DocumentVersion> findByDocumentIdOrderByVersionNoDesc(UUID documentId);

        Optional<DocumentVersion> findByDocumentIdAndVersionNo(UUID documentId, int versionNo);

        Optional<DocumentVersion> findFirstByDocumentIdOrderByVersionNoDesc(UUID documentId);
    }

    public interface Events extends JpaRepository<DocumentEvent, UUID> {
        List<DocumentEvent> findByDocumentIdOrderByAtDesc(UUID documentId);

        boolean existsByDocumentIdAndActorIdAndTypeAndAtAfter(UUID documentId, UUID actorId, DocumentEventType type,
                                                              Instant after);
    }

    public interface Types extends JpaRepository<DocumentType, UUID> {
        List<DocumentType> findByOrganizationIdOrderByName(UUID organizationId);

        Optional<DocumentType> findByIdAndOrganizationId(UUID id, UUID organizationId);
    }
}
