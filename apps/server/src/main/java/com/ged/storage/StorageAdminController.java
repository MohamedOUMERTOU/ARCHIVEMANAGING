package com.ged.storage;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Écran « Paramétrage › Stockage » : réservé aux détenteurs de settings.manage. */
@RestController
@RequestMapping("/api/settings/storage")
public class StorageAdminController {

    private final StorageAdminService service;

    public StorageAdminController(StorageAdminService service) {
        this.service = service;
    }

    @GetMapping
    StorageAdminService.Status status() {
        return service.status();
    }

    @PostMapping("/check")
    StorageAdminService.CheckResult check() {
        return service.check();
    }
}
