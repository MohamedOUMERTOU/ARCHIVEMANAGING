package com.ged.ocr;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class OcrController {

    private final OcrService service;

    public OcrController(OcrService service) {
        this.service = service;
    }

    @GetMapping("/documents/{id}/text")
    OcrService.TextStatus status(@PathVariable UUID id, @RequestParam(required = false) Integer version) {
        return service.status(id, version);
    }

    @GetMapping("/documents/{id}/text/pages")
    List<OcrService.PageText> pages(@PathVariable UUID id, @RequestParam(required = false) Integer version) {
        return service.pages(id, version);
    }

    @PostMapping("/documents/{id}/text/retry")
    OcrService.TextStatus retry(@PathVariable UUID id, @RequestParam(required = false) Integer version) {
        return service.retry(id, version);
    }

    @GetMapping("/documents/{id}/versions/{versionNo}/searchable")
    ResponseEntity<Resource> searchable(@PathVariable UUID id, @PathVariable int versionNo) {
        OcrService.Copy copy = service.downloadCopy(id, versionNo);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(copy.filename(), StandardCharsets.UTF_8).build().toString())
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(copy.size())
                .header("X-Content-SHA256", copy.sha256())
                .body(copy.resource());
    }

    @GetMapping("/settings/ocr")
    OcrService.SettingsDto settings() {
        return service.settings();
    }

    @PutMapping("/settings/ocr")
    OcrService.SettingsDto update(@RequestBody OcrService.SettingsInput input) {
        return service.updateSettings(input);
    }

    public record PauseRequest(boolean paused) {}

    @PostMapping("/settings/ocr/pause")
    OcrService.SettingsDto pause(@RequestBody PauseRequest r) {
        return service.pause(r.paused());
    }

    @GetMapping("/settings/ocr/overview")
    OcrService.Overview overview() {
        return service.overview();
    }

    @PostMapping("/settings/ocr/backfill")
    OcrService.Overview backfill() {
        return service.backfill();
    }

    @PostMapping("/settings/ocr/retry-failed")
    OcrService.Overview retryFailed() {
        return service.retryFailed();
    }
}
