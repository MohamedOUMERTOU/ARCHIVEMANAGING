package com.ged.physical;

import com.ged.physical.PhysicalService.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class PhysicalController {

    private final PhysicalService service;

    public PhysicalController(PhysicalService service) {
        this.service = service;
    }

    // ───────── Niveaux ─────────

    public record LevelRequest(@Size(max = 40) String code, @NotBlank(message = "Saisissez un nom") @Size(max = 120) String name,
                               boolean isRoot, boolean canHoldDocuments, Integer capacity, @Size(max = 30) String icon) {
        LevelInput input() {
            return new LevelInput(code, name, isRoot, canHoldDocuments, capacity, icon);
        }
    }

    public record ChildrenRequest(List<UUID> childLevelIds) {}

    @GetMapping("/physical/levels")
    List<LevelDto> levels() {
        return service.levels();
    }

    @PostMapping("/physical/levels")
    @ResponseStatus(HttpStatus.CREATED)
    LevelDto createLevel(@Valid @RequestBody LevelRequest r) {
        return service.createLevel(r.input());
    }

    @PutMapping("/physical/levels/{id}")
    LevelDto updateLevel(@PathVariable UUID id, @Valid @RequestBody LevelRequest r) {
        return service.updateLevel(id, r.input());
    }

    @PutMapping("/physical/levels/{id}/children")
    LevelDto setChildren(@PathVariable UUID id, @RequestBody ChildrenRequest r) {
        return service.setChildren(id, r.childLevelIds());
    }

    @DeleteMapping("/physical/levels/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteLevel(@PathVariable UUID id) {
        service.deleteLevel(id);
    }

    // ───────── Emplacements ─────────

    public record LocationRequest(UUID parentId, UUID levelId,
                                  @NotBlank(message = "Saisissez un code") @Size(max = 80) String code,
                                  @NotBlank(message = "Saisissez un libellé") @Size(max = 255) String label,
                                  @Size(max = 80) String barcode, Boolean active) {
        LocationInput input() {
            return new LocationInput(parentId, levelId, code, label, barcode, active);
        }
    }

    public record MoveRequest(@NotNull UUID newParentId) {}

    public record PlaceRequest(UUID locationId) {}

    @GetMapping("/physical/locations")
    List<LocationDto> tree() {
        return service.tree();
    }

    @GetMapping("/physical/locations/{id}")
    LocationDetail get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping("/physical/locations")
    @ResponseStatus(HttpStatus.CREATED)
    LocationDetail create(@Valid @RequestBody LocationRequest r) {
        if (r.levelId() == null) throw com.ged.common.ApiException.badRequest("VALIDATION", "Choisissez un niveau");
        return service.create(r.input());
    }

    @PutMapping("/physical/locations/{id}")
    LocationDetail update(@PathVariable UUID id, @Valid @RequestBody LocationRequest r) {
        return service.update(id, r.input());
    }

    @PostMapping("/physical/locations/{id}/move")
    LocationDetail move(@PathVariable UUID id, @Valid @RequestBody MoveRequest r) {
        return service.move(id, r.newParentId());
    }

    @DeleteMapping("/physical/locations/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    /** Range l'original d'un document dans une boîte ({"locationId": null} pour le retirer). */
    @PutMapping("/documents/{id}/location")
    LocationDetail place(@PathVariable UUID id, @RequestBody PlaceRequest r) {
        return service.placeDocument(id, r.locationId());
    }

    // ───────── Prêts ─────────

    public record LoanRequest(UUID locationId, UUID documentId,
                              @NotBlank(message = "Indiquez l'emprunteur") @Size(max = 255) String borrower,
                              String kind, @Size(max = 500) String reason,
                              @NotNull(message = "Choisissez la date de retour") LocalDate dueAt) {}

    @GetMapping("/physical/loans")
    List<LoanDto> loans(@RequestParam(defaultValue = "open") String status) {
        return service.loans(status);
    }

    @PostMapping("/physical/loans")
    @ResponseStatus(HttpStatus.CREATED)
    LoanDto createLoan(@Valid @RequestBody LoanRequest r) {
        return service.createLoan(new LoanInput(r.locationId(), r.documentId(), r.borrower(), r.kind(), r.reason(), r.dueAt()));
    }

    @PostMapping("/physical/loans/{id}/return")
    LoanDto returnLoan(@PathVariable UUID id) {
        return service.returnLoan(id);
    }
}
