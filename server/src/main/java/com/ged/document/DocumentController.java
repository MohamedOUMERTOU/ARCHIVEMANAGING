package com.ged.document;

import com.ged.document.DocumentDtos.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api")
public class DocumentController {

    private final DocumentService service;

    public DocumentController(DocumentService service) {
        this.service = service;
    }

    public record ClassifyRequest(
            @NotNull(message = "Choisissez un dossier") UUID nodeId,
            @NotNull(message = "Choisissez un type de document") UUID typeId,
            @NotBlank(message = "Saisissez un titre") @Size(max = 500) String title,
            LocalDate documentDate,
            Map<String, Object> metadata,
            List<String> tags) {}

    public record DescribeRequest(@NotBlank(message = "Saisissez un titre") @Size(max = 500) String title,
                                  LocalDate documentDate, Map<String, Object> metadata, List<String> tags) {}

    public record ReclassifyRequest(@NotNull(message = "Choisissez un dossier") UUID nodeId,
                                    @NotBlank(message = "Indiquez le motif du reclassement") String reason) {}

    public record DemandRequest(@NotNull RequestKind kind, @Size(max = 255) String onBehalfOf,
                                @NotBlank(message = "Indiquez le motif de la demande") String reason) {}

    @GetMapping("/documents")
    PageDto<DocumentSummary> search(
            @RequestParam(required = false) String q,
            @RequestParam(required = false) DocumentStatus status,
            @RequestParam(required = false) UUID typeId,
            @RequestParam(required = false) UUID nodeId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String tag,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size,
            @RequestParam(required = false) String sort,
            @RequestParam(required = false) UUID locationId,
            @RequestParam(required = false) String in) {
        return service.search(new SearchQuery(q, status, typeId, nodeId, from, to, tag, page, size, sort, locationId, in));
    }

    @PostMapping(path = "/documents", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    List<UploadResult> upload(@RequestPart("files") List<MultipartFile> files) {
        return service.upload(files);
    }

    @GetMapping("/documents/{id}")
    DocumentDetail get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/documents/{id}/classify")
    DocumentDetail classify(@PathVariable UUID id, @Valid @RequestBody ClassifyRequest r) {
        return service.classify(id, new ClassifyCommand(r.nodeId(), r.typeId(), r.title(), r.documentDate(), r.metadata(), r.tags()));
    }

    @PatchMapping("/documents/{id}")
    DocumentDetail describe(@PathVariable UUID id, @Valid @RequestBody DescribeRequest r) {
        return service.describe(id, new DescribeCommand(r.title(), r.documentDate(), r.metadata(), r.tags()));
    }

    @PostMapping("/documents/{id}/reclassify")
    DocumentDetail reclassify(@PathVariable UUID id, @Valid @RequestBody ReclassifyRequest r) {
        return service.reclassify(id, r.nodeId(), r.reason());
    }

    @PostMapping(path = "/documents/{id}/versions", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    DocumentDetail addVersion(@PathVariable UUID id, @RequestPart("file") MultipartFile file,
                              @RequestPart(name = "reason", required = false) String reason) {
        return service.addVersion(id, file, reason);
    }

    @GetMapping("/documents/{id}/versions/{versionNo}/content")
    ResponseEntity<Resource> download(@PathVariable UUID id, @PathVariable int versionNo,
                                      @RequestParam(defaultValue = "false") boolean inline) {
        DocumentService.Download d = service.download(id, versionNo);
        String mime = d.version().getMimeType();
        boolean showInline = inline && DocumentService.PREVIEWABLE.contains(mime);
        ContentDisposition disposition = (showInline ? ContentDisposition.inline() : ContentDisposition.attachment())
                .filename(d.version().getFilename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .contentType(showInline ? MediaType.parseMediaType(mime) : MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(d.version().getSizeBytes())
                .header("X-Content-SHA256", d.version().getSha256())
                .body(d.resource());
    }

    /** Lien d'aperçu signé (10 minutes) : à utiliser comme src d'un &lt;iframe&gt; ou d'une &lt;img&gt;. */
    @PostMapping("/documents/{id}/versions/{versionNo}/view-link")
    DocumentService.ViewLink viewLink(@PathVariable UUID id, @PathVariable int versionNo) {
        return service.viewLink(id, versionNo);
    }

    /** Contenu affichable dans le navigateur ; accès par jeton (pas d'en-tête Authorization possible). */
    @GetMapping("/documents/{id}/versions/{versionNo}/view")
    ResponseEntity<Resource> view(@PathVariable UUID id, @PathVariable int versionNo, @RequestParam String token) {
        DocumentService.View d = service.openView(id, versionNo, token);
        ContentDisposition disposition = ContentDisposition.inline()
                .filename(d.filename(), StandardCharsets.UTF_8).build();
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition.toString())
                .header(HttpHeaders.CACHE_CONTROL, "private, no-store")
                .header("X-Content-Type-Options", "nosniff")
                .contentType(MediaType.parseMediaType(d.mimeType()))
                // Resource en corps de réponse : Spring gère les requêtes partielles (Range) du lecteur PDF
                .body(d.resource());
    }

    @GetMapping("/documents/{id}/events")
    List<EventDto> history(@PathVariable UUID id) {
        return service.history(id);
    }

    @PostMapping("/documents/{id}/requests")
    @ResponseStatus(HttpStatus.CREATED)
    List<EventDto> request(@PathVariable UUID id, @Valid @RequestBody DemandRequest r) {
        return service.request(id, r.kind(), r.onBehalfOf(), r.reason());
    }

    @GetMapping("/document-types")
    List<TypeRef> types() {
        return service.listTypes();
    }

    @GetMapping("/tags")
    List<String> tags() {
        return service.listTags();
    }
}
