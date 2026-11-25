package com.ged.lifecycle;

import com.ged.lifecycle.LifecycleDtos.CreateHold;
import com.ged.lifecycle.LifecycleDtos.CreateList;
import com.ged.lifecycle.LifecycleDtos.Decision;
import com.ged.lifecycle.LifecycleDtos.DocumentIds;
import com.ged.lifecycle.LifecycleDtos.DueItem;
import com.ged.lifecycle.LifecycleDtos.Execute;
import com.ged.lifecycle.LifecycleDtos.HoldDetail;
import com.ged.lifecycle.LifecycleDtos.HoldSummary;
import com.ged.lifecycle.LifecycleDtos.ListDetail;
import com.ged.lifecycle.LifecycleDtos.ListSummary;
import com.ged.lifecycle.LifecycleDtos.Reason;
import com.ged.lifecycle.LifecycleDtos.RecalcResult;
import com.ged.lifecycle.LifecycleDtos.Summary;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

/** API du cycle de vie : échéancier, gels juridiques, bordereaux d'élimination et de versement. */
@RestController
@RequestMapping("/api/lifecycle")
public class LifecycleController {

    private final LifecycleService lifecycle;
    private final LegalHoldService holds;
    private final DisposalListService lists;
    private final DisposalExportService exports;

    public LifecycleController(LifecycleService lifecycle, LegalHoldService holds, DisposalListService lists,
                               DisposalExportService exports) {
        this.lifecycle = lifecycle;
        this.holds = holds;
        this.lists = lists;
        this.exports = exports;
    }

    // ───────── Échéancier ─────────

    @GetMapping("/summary")
    Summary summary() {
        return lifecycle.summary();
    }

    @GetMapping("/due")
    List<DueItem> due(@RequestParam(defaultValue = "0") int horizonDays, @RequestParam(required = false) String finalAction,
                      @RequestParam(required = false) UUID nodeId, @RequestParam(defaultValue = "false") boolean awaiting) {
        return lifecycle.due(horizonDays, finalAction, nodeId, awaiting);
    }

    @PostMapping("/recalculate")
    RecalcResult recalculate() {
        return lifecycle.recalculate();
    }

    @PostMapping("/definitive")
    Map<String, Integer> keepDefinitively(@RequestBody DocumentIds body) {
        return Map.of("documents", lifecycle.keepDefinitively(body.documentIds()));
    }

    // ───────── Gels juridiques ─────────

    @GetMapping("/holds")
    List<HoldSummary> holds() {
        return holds.list();
    }

    @PostMapping("/holds")
    @ResponseStatus(HttpStatus.CREATED)
    HoldDetail createHold(@RequestBody CreateHold body) {
        return holds.create(body);
    }

    @GetMapping("/holds/{id}")
    HoldDetail hold(@PathVariable UUID id) {
        return holds.get(id);
    }

    @PostMapping("/holds/{id}/documents")
    HoldDetail addToHold(@PathVariable UUID id, @RequestBody DocumentIds body) {
        return holds.addDocuments(id, body.documentIds());
    }

    @PostMapping("/holds/{id}/documents/{documentId}/remove")
    HoldDetail removeFromHold(@PathVariable UUID id, @PathVariable UUID documentId, @RequestBody Reason body) {
        return holds.removeDocument(id, documentId, body.reason());
    }

    @PostMapping("/holds/{id}/release")
    HoldDetail releaseHold(@PathVariable UUID id, @RequestBody Reason body) {
        return holds.release(id, body.reason());
    }

    // ───────── Bordereaux ─────────

    @GetMapping("/lists")
    List<ListSummary> lists(@RequestParam(required = false) String status) {
        return lists.list(status);
    }

    @PostMapping("/lists")
    @ResponseStatus(HttpStatus.CREATED)
    ListDetail createList(@RequestBody CreateList body) {
        return lists.create(body);
    }

    @GetMapping("/lists/{id}")
    ListDetail list(@PathVariable UUID id) {
        return lists.get(id);
    }

    @PostMapping("/lists/{id}/documents")
    ListDetail addToList(@PathVariable UUID id, @RequestBody DocumentIds body) {
        return lists.addDocuments(id, body.documentIds());
    }

    @DeleteMapping("/lists/{id}/documents/{documentId}")
    ListDetail removeFromList(@PathVariable UUID id, @PathVariable UUID documentId) {
        return lists.removeDocument(id, documentId);
    }

    @PostMapping("/lists/{id}/submit")
    ListDetail submit(@PathVariable UUID id) {
        return lists.submit(id);
    }

    @PostMapping("/lists/{id}/approve")
    ListDetail approve(@PathVariable UUID id, @RequestBody(required = false) Decision body) {
        return lists.approve(id, body == null ? null : body.comment());
    }

    @PostMapping("/lists/{id}/reject")
    ListDetail reject(@PathVariable UUID id, @RequestBody Decision body) {
        return lists.reject(id, body.comment());
    }

    @PostMapping("/lists/{id}/cancel")
    ListDetail cancel(@PathVariable UUID id, @RequestBody Reason body) {
        return lists.cancel(id, body.reason());
    }

    @PostMapping("/lists/{id}/execute")
    ListDetail execute(@PathVariable UUID id, @RequestBody Execute body) {
        return lists.execute(id, body.confirmNumber());
    }

    @GetMapping("/lists/{id}/export.csv")
    ResponseEntity<byte[]> csv(@PathVariable UUID id) {
        ListDetail d = lists.get(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(d.list().number() + ".csv", StandardCharsets.UTF_8).build().toString())
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .body(exports.csv(id));
    }

    @GetMapping("/lists/{id}/package.zip")
    ResponseEntity<StreamingResponseBody> transferPackage(@PathVariable UUID id) {
        DisposalExportService.Package pkg = exports.prepare(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment()
                        .filename(pkg.fileName(), StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.parseMediaType("application/zip"))
                .body(out -> exports.write(pkg, out));
    }
}
