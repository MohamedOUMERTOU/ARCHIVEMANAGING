package com.ged.classification;

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
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/classification")
public class ClassificationController {

    private final ClassificationService service;

    public ClassificationController(ClassificationService service) {
        this.service = service;
    }

    public record CreateRequest(
            UUID parentId,
            @NotNull(message = "Choisissez un niveau") NodeType type,
            @NotBlank(message = "Saisissez une cote") @Size(max = 80) String code,
            @NotBlank(message = "Saisissez un intitulé") @Size(max = 255) String title,
            String description,
            UUID retentionRuleId) {}

    public record UpdateRequest(@Size(max = 80) String code, @Size(max = 255) String title, String description,
                                UUID retentionRuleId, LocalDate closedAt) {}

    public record MoveRequest(@NotNull UUID newParentId) {}

    @GetMapping("/tree")
    List<ClassificationService.TreeNodeDto> tree() {
        return service.tree();
    }

    @GetMapping("/{id}")
    ClassificationService.NodeDetailDto get(@PathVariable UUID id) {
        return service.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ClassificationService.NodeDetailDto create(@Valid @RequestBody CreateRequest r) {
        return service.create(new ClassificationService.CreateNode(r.parentId(), r.type(), r.code(), r.title(),
                r.description(), r.retentionRuleId()));
    }

    @PatchMapping("/{id}")
    ClassificationService.NodeDetailDto update(@PathVariable UUID id, @Valid @RequestBody UpdateRequest r) {
        return service.update(id, new ClassificationService.UpdateNode(r.code(), r.title(), r.description(),
                r.retentionRuleId(), r.closedAt()));
    }

    @PostMapping("/{id}/move")
    ClassificationService.NodeDetailDto move(@PathVariable UUID id, @Valid @RequestBody MoveRequest r) {
        return service.move(id, r.newParentId());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@PathVariable UUID id) {
        service.delete(id);
    }
}
