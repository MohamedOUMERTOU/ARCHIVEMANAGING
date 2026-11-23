package com.ged.document;

import com.ged.storage.FileStorage;
import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.classification.ClassificationNode;
import com.ged.classification.ClassificationService;
import com.ged.common.ApiException;
import com.ged.common.Json;
import com.ged.document.DocumentDtos.*;
import com.ged.retention.RetentionPolicy;
import com.ged.retention.RetentionRule;
import com.ged.retention.RetentionRuleRepository;
import com.ged.user.User;
import com.ged.user.UserRepository;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
public class DocumentService {

    public static final String WRITE = "documents.write";
    public static final String RECLASSIFY = "documents.reclassify";
    private static final Duration CONSULT_DEDUP = Duration.ofMinutes(10);

    private final DocumentRepositories.Documents documents;
    private final DocumentRepositories.Versions versions;
    private final DocumentRepositories.Events events;
    private final DocumentRepositories.Types types;
    private final RetentionRuleRepository rules;
    private final UserRepository users;
    private final ClassificationService classification;
    private final FileStorage storage;
    private final CurrentUserProvider currentUser;
    private final AuditService audit;
    private final NamedParameterJdbcTemplate jdbc;
    private final Json json;
    private final ViewTokenService viewTokens;
    private final com.ged.physical.LocationPaths locationPaths;
    private final RetentionPolicy retention;

    public DocumentService(DocumentRepositories.Documents documents, DocumentRepositories.Versions versions,
                           DocumentRepositories.Events events, DocumentRepositories.Types types,
                           RetentionRuleRepository rules, UserRepository users, ClassificationService classification,
                           FileStorage storage, CurrentUserProvider currentUser, AuditService audit,
                           NamedParameterJdbcTemplate jdbc, Json json, ViewTokenService viewTokens,
                           com.ged.physical.LocationPaths locationPaths, RetentionPolicy retention) {
        this.retention = retention;
        this.viewTokens = viewTokens;
        this.locationPaths = locationPaths;
        this.documents = documents;
        this.versions = versions;
        this.events = events;
        this.types = types;
        this.rules = rules;
        this.users = users;
        this.classification = classification;
        this.storage = storage;
        this.currentUser = currentUser;
        this.audit = audit;
        this.jdbc = jdbc;
        this.json = json;
    }

    // ───────── Dépôt ─────────

    /** Dépose des fichiers dans « À classer ». Un fichier déjà archivé est signalé, pas refusé. */
    @Transactional
    public List<UploadResult> upload(List<MultipartFile> files) {
        CurrentUser user = currentUser.require(WRITE);
        if (files == null || files.isEmpty()) throw ApiException.badRequest("NO_FILE", "Ajoutez au moins un fichier");
        List<UploadResult> results = new ArrayList<>();
        for (MultipartFile file : files) {
            String filename = safeFilename(file.getOriginalFilename());
            Document doc = documents.save(new Document(user.organizationId(), titleFrom(filename), user.id()));
            DocumentVersion v = saveVersion(user, doc, 1, file, filename, null);
            record(user, doc, DocumentEventType.CREE, null, null, null,
                    Map.of("filename", filename, "sha256", v.getSha256(), "size", v.getSizeBytes()));
            audit.log(user.organizationId(), user.id(), "DOCUMENT_DEPOSE", "document", doc.getId().toString(),
                    Map.of("filename", filename, "sha256", v.getSha256()), null);
            results.add(new UploadResult(doc.getId(), doc.getTitle(), v.getSha256(), duplicateOf(user, doc.getId(), v.getSha256())));
        }
        return results;
    }

    // ───────── Classement ─────────

    @Transactional
    public DocumentDetail classify(UUID id, ClassifyCommand cmd) {
        CurrentUser user = currentUser.require(WRITE);
        Document doc = find(user, id);
        if (doc.getStatus() != DocumentStatus.A_CLASSER) {
            throw ApiException.conflict("ALREADY_CLASSIFIED", "Ce document est déjà classé : utilisez le reclassement");
        }
        ClassificationNode node = classification.find(user.organizationId(), cmd.nodeId());
        DocumentType type = types.findByIdAndOrganizationId(cmd.typeId(), user.organizationId())
                .orElseThrow(() -> ApiException.notFound("Type de document"));
        Map<String, Object> metadata = cmd.metadata() == null ? Map.of() : cmd.metadata();
        validateMetadata(type, metadata);

        doc.describe(cmd.title().trim(), cmd.documentDate(), json.write(metadata));
        String reference = nextReference(node);
        doc.classify(node.getId(), type.getId(), reference, retentionFor(doc, node));
        setTags(user, doc.getId(), cmd.tags());

        String path = classification.displayPath(node.getIdPath());
        record(user, doc, DocumentEventType.CLASSE, null, null, null,
                mapOf("reference", reference, "path", path, "type", type.getName()));
        audit.log(user.organizationId(), user.id(), "DOCUMENT_CLASSE", "document", id.toString(),
                Map.of("reference", reference, "path", path), null);
        return detail(user, doc, false);
    }

    /** Change le dossier d'un document classé : nouvelle cote, l'ancienne reste un alias. */
    @Transactional
    public DocumentDetail reclassify(UUID id, UUID nodeId, String reason) {
        CurrentUser user = currentUser.require(RECLASSIFY);
        Document doc = find(user, id);
        if (doc.getStatus() == DocumentStatus.A_CLASSER) {
            throw ApiException.conflict("NOT_CLASSIFIED", "Ce document n'est pas encore classé");
        }
        ensureModifiable(doc, "reclassement");
        ClassificationNode from = classification.find(user.organizationId(), doc.getNodeId());
        ClassificationNode to = classification.find(user.organizationId(), nodeId);
        if (from.getId().equals(to.getId())) return detail(user, doc, false);

        Map<String, Object> before = mapOf("path", classification.displayPath(from.getIdPath()),
                "reference", doc.getReference(), "retentionUntil", doc.getRetentionUntil());
        jdbc.update("INSERT INTO document_aliases (organization_id, old_reference, document_id) VALUES (:org, :ref, :doc)",
                new MapSqlParameterSource().addValue("org", user.organizationId()).addValue("ref", doc.getReference())
                        .addValue("doc", doc.getId()));
        String reference = nextReference(to);
        doc.classify(to.getId(), doc.getTypeId(), reference, retentionFor(doc, to));
        Map<String, Object> after = mapOf("path", classification.displayPath(to.getIdPath()),
                "reference", reference, "retentionUntil", doc.getRetentionUntil());

        record(user, doc, DocumentEventType.RECLASSE, null, reason, before, after);
        audit.log(user.organizationId(), user.id(), "DOCUMENT_RECLASSE", "document", id.toString(),
                Map.of("before", before, "after", after), null);
        return detail(user, doc, false);
    }

    @Transactional
    public DocumentDetail describe(UUID id, DescribeCommand cmd) {
        CurrentUser user = currentUser.require(WRITE);
        Document doc = find(user, id);
        ensureModifiable(doc, "modification");
        Map<String, Object> metadata = cmd.metadata() == null ? Map.of() : cmd.metadata();
        if (doc.getTypeId() != null) validateMetadata(types.findById(doc.getTypeId()).orElseThrow(), metadata);

        Map<String, Object> before = mapOf("title", doc.getTitle(), "documentDate", doc.getDocumentDate(),
                "metadata", json.readMap(doc.getMetadata()), "retentionUntil", doc.getRetentionUntil());
        doc.describe(cmd.title().trim(), cmd.documentDate(), json.write(metadata));
        // La date du document est souvent le point de départ de la durée de conservation
        if (doc.getNodeId() != null) {
            doc.applyRetention(retentionFor(doc, classification.find(user.organizationId(), doc.getNodeId())));
        }
        setTags(user, doc.getId(), cmd.tags());
        Map<String, Object> after = mapOf("title", doc.getTitle(), "documentDate", doc.getDocumentDate(), "metadata", metadata,
                "retentionUntil", doc.getRetentionUntil());
        record(user, doc, DocumentEventType.METADONNEES_MODIFIEES, null, null, before, after);
        audit.log(user.organizationId(), user.id(), "METADONNEES_MODIFIEES", "document", id.toString(), Map.of(), null);
        return detail(user, doc, false);
    }

    // ───────── Versions ─────────

    /** Remplace le fichier : l'ancienne version est conservée, jamais écrasée. */
    @Transactional
    public DocumentDetail addVersion(UUID id, MultipartFile file, String reason) {
        CurrentUser user = currentUser.require(WRITE);
        Document doc = find(user, id);
        ensureModifiable(doc, "remplacement du fichier");
        if (reason == null || reason.isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Indiquez le motif du remplacement",
                    Map.of("reason", "Motif obligatoire"));
        }
        DocumentVersion previous = versions.findFirstByDocumentIdOrderByVersionNoDesc(id).orElseThrow();
        String filename = safeFilename(file.getOriginalFilename());
        DocumentVersion next = saveVersion(user, doc, previous.getVersionNo() + 1, file, filename, reason.trim());

        record(user, doc, DocumentEventType.VERSION_REMPLACEE, null, reason.trim(),
                Map.of("version", previous.getVersionNo(), "sha256", previous.getSha256(), "filename", previous.getFilename()),
                Map.of("version", next.getVersionNo(), "sha256", next.getSha256(), "filename", next.getFilename()));
        audit.log(user.organizationId(), user.id(), "VERSION_AJOUTEE", "document", id.toString(),
                Map.of("version", next.getVersionNo(), "sha256", next.getSha256()), null);
        return detail(user, doc, false);
    }

    public record Download(DocumentVersion version, org.springframework.core.io.Resource resource) {}

    @Transactional
    public Download download(UUID id, int versionNo) {
        CurrentUser user = currentUser.get();
        Document doc = find(user, id);
        ensureContentAvailable(doc);
        DocumentVersion version = versions.findByDocumentIdAndVersionNo(id, versionNo)
                .orElseThrow(() -> ApiException.notFound("Version"));
        record(user, doc, DocumentEventType.TELECHARGE, null, null, null, Map.of("version", versionNo));
        audit.log(user.organizationId(), user.id(), "DOCUMENT_TELECHARGE", "document", id.toString(),
                Map.of("version", versionNo), null);
        return new Download(version, storage.load(version.getStorageKey()));
    }

    // ───────── Visualisation ─────────

    /** Formats qu'un navigateur affiche sans risque ; les autres ne sont proposés qu'en téléchargement. */
    public static final Set<String> PREVIEWABLE = Set.of("application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp");

    /** Lien d'aperçu à durée limitée, vérifié contre les droits de l'utilisateur au moment de la demande. */
    @Transactional(readOnly = true)
    public ViewLink viewLink(UUID id, int versionNo) {
        CurrentUser user = currentUser.get();
        ensureContentAvailable(find(user, id));
        DocumentVersion version = versions.findByDocumentIdAndVersionNo(id, versionNo)
                .orElseThrow(() -> ApiException.notFound("Version"));
        boolean previewable = PREVIEWABLE.contains(version.getMimeType());
        if (!previewable) return new ViewLink(null, version.getMimeType(), false, null);
        String token = viewTokens.create(id, versionNo, user.id());
        return new ViewLink("/api/documents/%s/versions/%d/view?token=%s".formatted(id, versionNo, token),
                version.getMimeType(), true, viewTokens.expiresAt(token));
    }

    /**
     * Ouvre le contenu d'un lien d'aperçu. Les droits sont revérifiés : un compte désactivé
     * ou un document devenu inaccessible entre-temps est refusé même avec un jeton valide.
     */
    @Transactional
    public Download openView(UUID id, int versionNo, String token) {
        ViewTokenService.Claims claims = viewTokens.verify(token);
        if (!claims.documentId().equals(id) || claims.versionNo() != versionNo) {
            throw new ApiException(HttpStatus.UNAUTHORIZED, "BAD_VIEW_TOKEN", "Lien de visualisation invalide ou expiré");
        }
        User account = users.findWithRolesById(claims.userId())
                .filter(u -> u.isActive() && u.getOrganization().isActive())
                .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "ACCOUNT_DISABLED", "Compte désactivé"));
        CurrentUser user = CurrentUserProvider.toCurrentUser(account);
        Document doc = find(user, id);
        ensureContentAvailable(doc);
        DocumentVersion version = versions.findByDocumentIdAndVersionNo(id, versionNo)
                .orElseThrow(() -> ApiException.notFound("Version"));
        if (!PREVIEWABLE.contains(version.getMimeType())) {
            throw ApiException.badRequest("NOT_PREVIEWABLE", "Ce format ne peut pas être affiché : téléchargez-le");
        }
        // Le visualiseur PDF du navigateur envoie plusieurs requêtes (pages, défilement) : une seule trace par 10 minutes
        if (!events.existsByDocumentIdAndActorIdAndTypeAndAtAfter(id, user.id(), DocumentEventType.CONSULTE,
                Instant.now().minus(CONSULT_DEDUP))) {
            record(user, doc, DocumentEventType.CONSULTE, null, null, null, Map.of("version", versionNo, "mode", "aperçu"));
            audit.log(user.organizationId(), user.id(), "DOCUMENT_VISUALISE", "document", id.toString(),
                    Map.of("version", versionNo), null);
        }
        return new Download(version, storage.load(version.getStorageKey()));
    }

    public record ViewLink(String url, String mimeType, boolean previewable, Instant expiresAt) {}

    // ───────── Demandes ─────────

    @Transactional
    public List<EventDto> request(UUID id, RequestKind kind, String onBehalfOf, String reason) {
        CurrentUser user = currentUser.get();
        Document doc = find(user, id);
        if (kind == RequestKind.ORIGINAL && doc.getStatus() == DocumentStatus.A_CLASSER) {
            throw ApiException.conflict("NOT_CLASSIFIED", "Ce document n'est pas encore classé");
        }
        DocumentEventType type = kind == RequestKind.ORIGINAL ? DocumentEventType.ORIGINAL_DEMANDE : DocumentEventType.COPIE_DEMANDEE;
        String who = onBehalfOf == null || onBehalfOf.isBlank() ? null : onBehalfOf.trim();
        record(user, doc, type, who, reason, null, Map.of("kind", kind.name(), "status", "DEMANDEE"));
        audit.log(user.organizationId(), user.id(), type.name(), "document", id.toString(),
                mapOf("kind", kind.name(), "onBehalfOf", who), null);
        return history(id);
    }

    // ───────── Lecture ─────────

    /** Fiche d'un document ; la consultation est tracée (une fois par 10 minutes et par personne). */
    @Transactional
    public DocumentDetail get(UUID id) {
        CurrentUser user = currentUser.get();
        Document doc = find(user, id);
        if (!events.existsByDocumentIdAndActorIdAndTypeAndAtAfter(id, user.id(), DocumentEventType.CONSULTE,
                Instant.now().minus(CONSULT_DEDUP))) {
            record(user, doc, DocumentEventType.CONSULTE, null, null, null, null);
        }
        return detail(user, doc, true);
    }

    @Transactional(readOnly = true)
    public List<EventDto> history(UUID id) {
        CurrentUser user = currentUser.get();
        find(user, id);
        List<DocumentEvent> list = events.findByDocumentIdOrderByAtDesc(id);
        Map<UUID, String> names = userNames(list.stream().map(DocumentEvent::getActorId).toList());
        return list.stream().map(e -> new EventDto(e.getId(), e.getType(), names.get(e.getActorId()), e.getOnBehalfOf(),
                e.getReason(), nullableMap(e.getBeforeData()), nullableMap(e.getAfterData()), e.getAt())).toList();
    }

    @Transactional(readOnly = true)
    public PageDto<DocumentSummary> search(SearchQuery query) {
        CurrentUser user = currentUser.get();
        var params = new MapSqlParameterSource()
                .addValue("org", user.organizationId())
                .addValue("me", user.id())
                .addValue("seeAllInbox", user.can(RECLASSIFY));
        StringBuilder where = new StringBuilder(" WHERE d.organization_id = :org");
        // Un document « à classer » n'est visible que par son déposant et les archivistes
        where.append(" AND (d.status <> 'A_CLASSER' OR d.created_by = :me OR :seeAllInbox)");
        if (query.status() != null) {
            where.append(" AND d.status = :status");
            params.addValue("status", query.status().name());
        } else {
            where.append(" AND d.status <> 'A_CLASSER'");
        }
        if (query.typeId() != null) {
            where.append(" AND d.type_id = :type");
            params.addValue("type", query.typeId());
        }
        if (query.nodeId() != null) {
            ClassificationNode node = classification.find(user.organizationId(), query.nodeId());
            where.append(" AND n.id_path LIKE :prefix");
            params.addValue("prefix", node.getIdPath() + "%");
        }
        if (query.q() != null && !query.q().isBlank()) {
            where.append("""
                     AND (d.title ILIKE :q OR d.reference ILIKE :q OR d.metadata::text ILIKE :q
                          OR EXISTS (SELECT 1 FROM document_aliases a WHERE a.document_id = d.id AND a.old_reference ILIKE :q))
                    """);
            params.addValue("q", "%" + escapeLike(query.q().trim()) + "%");
        }
        if (query.from() != null) {
            where.append(" AND d.document_date >= :from");
            params.addValue("from", query.from());
        }
        if (query.to() != null) {
            where.append(" AND d.document_date <= :to");
            params.addValue("to", query.to());
        }
        if (query.locationId() != null) {
            // L'emplacement et tout ce qu'il contient (une salle → ses armoires → leurs boîtes)
            where.append("""
                     AND d.physical_location_id IN (SELECT x.id FROM physical_locations x
                         WHERE x.organization_id = :org AND x.id_path LIKE
                           (SELECT y.id_path FROM physical_locations y WHERE y.id = :loc AND y.organization_id = :org) || '%')
                    """);
            params.addValue("loc", query.locationId());
        }
        if (query.tag() != null && !query.tag().isBlank()) {
            where.append(" AND EXISTS (SELECT 1 FROM document_tags dt JOIN tags tg ON tg.id = dt.tag_id WHERE dt.document_id = d.id AND tg.name = :tag)");
            params.addValue("tag", query.tag());
        }

        String from = " FROM documents d LEFT JOIN classification_nodes n ON n.id = d.node_id LEFT JOIN document_types t ON t.id = d.type_id";
        Long total = jdbc.queryForObject("SELECT count(*)" + from + where, params, Long.class);
        int size = Math.min(Math.max(query.size(), 1), 100);
        int page = Math.max(query.page(), 0);
        String order = switch (query.sort() == null ? "" : query.sort()) {
            case "title" -> "d.title ASC";
            case "reference" -> "d.reference ASC NULLS LAST";
            case "created" -> "d.created_at DESC";
            default -> "d.document_date DESC NULLS LAST, d.created_at DESC";
        };
        params.addValue("limit", size).addValue("offset", page * size);
        List<DocumentSummary> content = jdbc.query("""
                SELECT d.id, d.reference, d.title, d.status, d.document_date, d.type_id, t.name AS type_name,
                       d.node_id, n.title AS node_title, d.retention_until, d.legal_hold, d.created_at,
                       (SELECT count(*) FROM document_versions v WHERE v.document_id = d.id) AS version_count,
                       lv.filename, lv.mime_type, lv.size_bytes,
                       COALESCE((SELECT array_agg(tg.name ORDER BY tg.name) FROM document_tags dt
                                 JOIN tags tg ON tg.id = dt.tag_id WHERE dt.document_id = d.id), '{}') AS tags
                """ + from + """
                 LEFT JOIN LATERAL (SELECT filename, mime_type, size_bytes FROM document_versions v
                                    WHERE v.document_id = d.id ORDER BY version_no DESC LIMIT 1) lv ON true
                """ + where + " ORDER BY " + order + " LIMIT :limit OFFSET :offset",
                params, (rs, i) -> summary(rs));
        long totalElements = total == null ? 0 : total;
        return new PageDto<>(content, totalElements, (int) Math.ceil(totalElements / (double) size), page, size);
    }

    @Transactional(readOnly = true)
    public List<TypeRef> listTypes() {
        CurrentUser user = currentUser.get();
        return types.findByOrganizationIdOrderByName(user.organizationId()).stream()
                .map(t -> new TypeRef(t.getId(), t.getCode(), t.getName(), json.readListOfMaps(t.getMetadataSchema())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<String> listTags() {
        return jdbc.queryForList("SELECT name FROM tags WHERE organization_id = :org ORDER BY name",
                Map.of("org", currentUser.get().organizationId()), String.class);
    }

    // ───────── Interne ─────────

    private Document find(CurrentUser user, UUID id) {
        Document doc = documents.findByIdAndOrganizationId(id, user.organizationId())
                .orElseThrow(() -> ApiException.notFound("Document"));
        if (doc.getStatus() == DocumentStatus.A_CLASSER && !doc.getCreatedBy().equals(user.id()) && !user.can(RECLASSIFY)) {
            throw ApiException.notFound("Document");
        }
        return doc;
    }

    private DocumentVersion saveVersion(CurrentUser user, Document doc, int no, MultipartFile file, String filename,
                                        String reason) {
        if (file == null || file.isEmpty()) throw ApiException.badRequest("EMPTY_FILE", "Le fichier « " + filename + " » est vide");
        FileStorage.Stored stored;
        try {
            stored = storage.store(user.organizationId(), file.getInputStream(), file.getContentType());
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        String mime = file.getContentType() == null ? "application/octet-stream" : file.getContentType();
        return versions.save(new DocumentVersion(doc.getId(), no, stored, filename, mime, reason, user.id()));
    }

    private void record(CurrentUser user, Document doc, DocumentEventType type, String onBehalfOf, String reason,
                        Map<String, Object> before, Map<String, Object> after) {
        events.save(new DocumentEvent(user.organizationId(), doc.getId(), type, user.id(), onBehalfOf,
                reason == null || reason.isBlank() ? null : reason.trim(),
                before == null ? null : json.write(before), after == null ? null : json.write(after)));
    }

    /** Cote suivante du dossier, ex. « FIN/CPT/FF-2025-0007 » ; le compteur est atomique. */
    private String nextReference(ClassificationNode node) {
        Integer n = jdbc.queryForObject("""
                INSERT INTO reference_counters (node_id, last_value) VALUES (:node, 1)
                ON CONFLICT (node_id) DO UPDATE SET last_value = reference_counters.last_value + 1
                RETURNING last_value
                """, Map.of("node", node.getId()), Integer.class);
        return "%s-%04d".formatted(node.getCode(), Objects.requireNonNull(n));
    }

    private RetentionPolicy.Result retentionFor(Document doc, ClassificationNode node) {
        return retention.evaluate(node, doc.getTypeId(), doc.getDocumentDate(), doc.getCreatedAt());
    }

    /**
     * Un document gelé, proposé au sort final, éliminé ou versé est figé : ni reclassement,
     * ni modification, ni nouvelle version.
     */
    private static void ensureModifiable(Document doc, String action) {
        switch (doc.getStatus()) {
            case ELIMINE -> throw ApiException.conflict("DISPOSED", "Document éliminé : " + action + " impossible");
            case VERSE -> throw ApiException.conflict("DISPOSED", "Document versé aux archives : " + action + " impossible");
            case A_ELIMINER -> throw ApiException.conflict("PENDING_DISPOSAL",
                    "Document proposé à l'élimination : " + action + " impossible tant que le bordereau est en cours");
            default -> {
            }
        }
        if (doc.isLegalHold()) {
            throw ApiException.conflict("LEGAL_HOLD", "Document sous gel juridique : " + action + " impossible");
        }
    }

    /** Le contenu d'un document éliminé a été détruit : seule sa notice reste consultable. */
    private static void ensureContentAvailable(Document doc) {
        if (doc.getStatus() == DocumentStatus.ELIMINE) {
            throw new ApiException(HttpStatus.GONE, "DISPOSED",
                    "Document éliminé : son contenu a été détruit, seule sa notice est conservée");
        }
    }

    private void validateMetadata(DocumentType type, Map<String, Object> metadata) {
        Map<String, String> errors = MetadataValidator.validate(json.readListOfMaps(type.getMetadataSchema()), metadata);
        if (!errors.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Certaines métadonnées sont invalides", errors);
        }
    }

    private void setTags(CurrentUser user, UUID documentId, List<String> tags) {
        jdbc.update("DELETE FROM document_tags WHERE document_id = :doc", Map.of("doc", documentId));
        if (tags == null) return;
        Set<String> names = tags.stream().map(String::trim).filter(s -> !s.isEmpty()).map(s -> s.toLowerCase())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        for (String name : names) {
            var p = new MapSqlParameterSource().addValue("id", UUID.randomUUID()).addValue("org", user.organizationId())
                    .addValue("name", name).addValue("doc", documentId);
            jdbc.update("INSERT INTO tags (id, organization_id, name) VALUES (:id, :org, :name) ON CONFLICT (organization_id, name) DO NOTHING", p);
            jdbc.update("""
                    INSERT INTO document_tags (document_id, tag_id)
                    SELECT :doc, id FROM tags WHERE organization_id = :org AND name = :name
                    ON CONFLICT DO NOTHING
                    """, p);
        }
    }

    private DuplicateRef duplicateOf(CurrentUser user, UUID documentId, String sha256) {
        List<DuplicateRef> found = jdbc.query("""
                SELECT d.id, d.reference, d.title FROM document_versions v JOIN documents d ON d.id = v.document_id
                WHERE v.sha256 = :sha AND d.organization_id = :org AND d.id <> :doc LIMIT 1
                """, new MapSqlParameterSource().addValue("sha", sha256).addValue("org", user.organizationId())
                        .addValue("doc", documentId),
                (rs, i) -> new DuplicateRef(rs.getObject("id", UUID.class), rs.getString("reference"), rs.getString("title")));
        return found.isEmpty() ? null : found.get(0);
    }

    private DocumentDetail detail(CurrentUser user, Document doc, boolean withDuplicate) {
        List<DocumentVersion> vs = versions.findByDocumentIdOrderByVersionNoDesc(doc.getId());
        Set<UUID> userIds = new HashSet<>();
        userIds.add(doc.getCreatedBy());
        vs.forEach(v -> userIds.add(v.getCreatedBy()));
        Map<UUID, String> names = userNames(userIds);

        TypeRef type = doc.getTypeId() == null ? null : types.findById(doc.getTypeId())
                .map(t -> new TypeRef(t.getId(), t.getCode(), t.getName(), json.readListOfMaps(t.getMetadataSchema())))
                .orElse(null);
        NodeRef node = null;
        ClassificationService.RetentionDto retention = null;
        if (doc.getNodeId() != null) {
            ClassificationNode n = classification.find(user.organizationId(), doc.getNodeId());
            node = new NodeRef(n.getId(), n.getCode(), n.getTitle(), classification.displayPath(n.getIdPath()));
            retention = classification.effectiveRetention(n).orElse(null);
        }
        List<String> tags = jdbc.queryForList("""
                SELECT tg.name FROM document_tags dt JOIN tags tg ON tg.id = dt.tag_id
                WHERE dt.document_id = :doc ORDER BY tg.name
                """, Map.of("doc", doc.getId()), String.class);
        DuplicateRef duplicate = withDuplicate && !vs.isEmpty() ? duplicateOf(user, doc.getId(), vs.get(0).getSha256()) : null;

        // Original papier : où il est rangé, et s'il est en prêt (seul ou avec sa boîte)
        LocationRef location = null;
        LoanRef loan = null;
        List<Map<String, Object>> loc = jdbc.queryForList("""
                SELECT pl.id, pl.code, pl.label, pl.id_path FROM documents d
                JOIN physical_locations pl ON pl.id = d.physical_location_id WHERE d.id = :doc
                """, Map.of("doc", doc.getId()));
        String locPath = loc.isEmpty() ? null : (String) loc.get(0).get("id_path");
        if (!loc.isEmpty()) {
            location = new LocationRef((UUID) loc.get(0).get("id"), (String) loc.get(0).get("code"),
                    (String) loc.get(0).get("label"), locationPaths.display(locPath));
        }
        List<LoanRef> loans = jdbc.query("""
                SELECT lo.id, lo.borrower, lo.due_at, lo.location_id IS NOT NULL AS via_box FROM loans lo
                LEFT JOIN physical_locations box ON box.id = lo.location_id
                WHERE lo.returned_at IS NULL AND lo.organization_id = :org
                  AND (lo.document_id = :doc OR (:path IS NOT NULL AND CAST(:path AS text) LIKE box.id_path || '%'))
                ORDER BY lo.out_at DESC LIMIT 1
                """, new MapSqlParameterSource().addValue("org", user.organizationId()).addValue("doc", doc.getId())
                        .addValue("path", locPath, java.sql.Types.VARCHAR),
                (rs, i) -> new LoanRef(rs.getObject("id", UUID.class), rs.getString("borrower"),
                        rs.getObject("due_at", LocalDate.class), rs.getBoolean("via_box")));
        if (!loans.isEmpty()) loan = loans.get(0);

        return new DocumentDetail(doc.getId(), doc.getReference(), doc.getTitle(), doc.getStatus(), doc.getDocumentDate(),
                json.readMap(doc.getMetadata()), type, node, retention, doc.getRetentionUntil(), doc.isLegalHold(),
                names.get(doc.getCreatedBy()), doc.getCreatedAt(), doc.getUpdatedAt(), tags,
                vs.stream().map(v -> new VersionDto(v.getVersionNo(), v.getFilename(), v.getMimeType(), v.getSizeBytes(),
                        v.getSha256(), v.getReplaceReason(), names.get(v.getCreatedBy()), v.getCreatedAt())).toList(),
                duplicate, location, loan, lifecycle(doc));
    }

    private DocumentDtos.LifecycleRef lifecycle(Document doc) {
        MapSqlParameterSource p = new MapSqlParameterSource("doc", doc.getId());
        List<DocumentDtos.HoldRef> holds = jdbc.query("""
                SELECT h.id, h.name, h.case_reference FROM legal_holds h
                JOIN legal_hold_documents x ON x.hold_id = h.id
                WHERE x.document_id = :doc AND h.released_at IS NULL ORDER BY h.created_at""", p,
                (rs, i) -> new DocumentDtos.HoldRef(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3)));
        DocumentDtos.ListRef pending = jdbc.query("""
                SELECT l.id, l.number, l.kind, l.status FROM disposal_lists l
                JOIN disposal_list_items i ON i.list_id = l.id
                WHERE i.document_id = :doc AND l.status IN ('BROUILLON', 'SOUMIS', 'APPROUVE')
                ORDER BY l.created_at DESC LIMIT 1""", p,
                (rs, i) -> new DocumentDtos.ListRef(rs.getObject(1, UUID.class), rs.getString(2), rs.getString(3),
                        rs.getString(4))).stream().findFirst().orElse(null);
        return new DocumentDtos.LifecycleRef(doc.getFinalAction() == null ? null : doc.getFinalAction().name(),
                doc.getDisposedAt(), holds, pending);
    }

    private Map<UUID, String> userNames(Collection<UUID> ids) {
        List<UUID> nonNull = ids.stream().filter(Objects::nonNull).distinct().toList();
        return users.findAllById(nonNull).stream().collect(Collectors.toMap(User::getId, User::getFullName, (a, b) -> a));
    }

    private Map<String, Object> nullableMap(String jsonText) {
        return jsonText == null ? null : json.readMap(jsonText);
    }

    private static DocumentSummary summary(ResultSet rs) throws SQLException {
        Array tags = rs.getArray("tags");
        Long size = rs.getObject("size_bytes", Long.class);
        return new DocumentSummary(rs.getObject("id", UUID.class), rs.getString("reference"), rs.getString("title"),
                DocumentStatus.valueOf(rs.getString("status")), rs.getObject("document_date", LocalDate.class),
                rs.getObject("type_id", UUID.class), rs.getString("type_name"), rs.getObject("node_id", UUID.class),
                rs.getString("node_title"), rs.getObject("retention_until", LocalDate.class), rs.getBoolean("legal_hold"),
                rs.getTimestamp("created_at").toInstant(), rs.getInt("version_count"), rs.getString("filename"),
                rs.getString("mime_type"), size,
                tags == null ? List.of() : Arrays.asList((String[]) tags.getArray()));
    }

    /** Map acceptant les valeurs null (Map.of les refuse) ; dates et UUID passent en texte, comme en JSON. */
    private static Map<String, Object> mapOf(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            Object v = kv[i + 1];
            m.put((String) kv[i], v instanceof LocalDate || v instanceof UUID ? v.toString() : v);
        }
        return m;
    }

    static String escapeLike(String s) {
        return s.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    static String safeFilename(String name) {
        if (name == null || name.isBlank()) return "fichier";
        String base = name.replace('\\', '/');
        base = base.substring(base.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}]", "").trim();
        return base.isEmpty() ? "fichier" : (base.length() > 200 ? base.substring(base.length() - 200) : base);
    }

    private static String titleFrom(String filename) {
        int dot = filename.lastIndexOf('.');
        return (dot > 0 ? filename.substring(0, dot) : filename).replace('_', ' ').trim();
    }
}
