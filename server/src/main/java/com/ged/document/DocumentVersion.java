package com.ged.document;

import com.ged.storage.FileStorage;
import com.ged.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

/** Une version n'est jamais écrasée : un remplacement crée la version suivante. */
@Entity
@Table(name = "document_versions")
public class DocumentVersion extends BaseEntity {

    @Column(name = "document_id")
    private UUID documentId;

    @Column(name = "version_no")
    private int versionNo;

    @Column(name = "storage_key")
    private String storageKey;

    private String filename;

    @Column(name = "mime_type")
    private String mimeType;

    @Column(name = "size_bytes")
    private long sizeBytes;

    private String sha256;

    @Column(name = "replace_reason")
    private String replaceReason;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at")
    private Instant createdAt = Instant.now();

    protected DocumentVersion() {}

    public DocumentVersion(UUID documentId, int versionNo, FileStorage.Stored stored, String filename, String mimeType,
                           String replaceReason, UUID createdBy) {
        this.documentId = documentId;
        this.versionNo = versionNo;
        this.storageKey = stored.key();
        this.sizeBytes = stored.size();
        this.sha256 = stored.sha256();
        this.filename = filename;
        this.mimeType = mimeType;
        this.replaceReason = replaceReason;
        this.createdBy = createdBy;
    }

    public UUID getDocumentId() { return documentId; }
    public int getVersionNo() { return versionNo; }
    public String getStorageKey() { return storageKey; }
    public String getFilename() { return filename; }
    public String getMimeType() { return mimeType; }
    public long getSizeBytes() { return sizeBytes; }
    public String getSha256() { return sha256; }
    public String getReplaceReason() { return replaceReason; }
    public UUID getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
}
