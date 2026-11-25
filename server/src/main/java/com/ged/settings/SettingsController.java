package com.ged.settings;

import com.ged.retention.RetentionRule;
import com.ged.settings.SettingsService.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
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
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/settings")
public class SettingsController {

    private final SettingsService service;

    public SettingsController(SettingsService service) {
        this.service = service;
    }

    // ───────── Règles de conservation ─────────

    public record RuleRequest(
            @NotBlank(message = "Saisissez un nom") @Size(max = 120) String name,
            Integer durationYears,
            @NotNull(message = "Choisissez un point de départ") RetentionRule.StartEvent startEvent,
            @NotNull(message = "Choisissez un sort final") RetentionRule.FinalAction finalAction,
            @Size(max = 255) String legalBasis) {

        RuleInput input() {
            return new RuleInput(name, durationYears, startEvent, finalAction, legalBasis);
        }
    }

    @GetMapping("/retention-rules")
    List<RuleDto> rules() {
        return service.listRules();
    }

    @PostMapping("/retention-rules")
    @ResponseStatus(HttpStatus.CREATED)
    RuleDto createRule(@Valid @RequestBody RuleRequest r) {
        return service.createRule(r.input());
    }

    @PutMapping("/retention-rules/{id}")
    RuleDto updateRule(@PathVariable UUID id, @Valid @RequestBody RuleRequest r) {
        return service.updateRule(id, r.input());
    }

    @DeleteMapping("/retention-rules/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRule(@PathVariable UUID id) {
        service.deleteRule(id);
    }

    // ───────── Types de document ─────────

    public record TypeRequest(
            @Size(max = 40) String code,
            @NotBlank(message = "Saisissez un nom") @Size(max = 120) String name,
            UUID defaultRetentionRuleId,
            List<FieldSchema.Field> fields) {

        TypeInput input() {
            return new TypeInput(code, name, defaultRetentionRuleId, fields);
        }
    }

    @GetMapping("/document-types")
    List<TypeDto> types() {
        return service.listTypes();
    }

    @PostMapping("/document-types")
    @ResponseStatus(HttpStatus.CREATED)
    TypeDto createType(@Valid @RequestBody TypeRequest r) {
        return service.createType(r.input());
    }

    @PutMapping("/document-types/{id}")
    TypeDto updateType(@PathVariable UUID id, @Valid @RequestBody TypeRequest r) {
        return service.updateType(id, r.input());
    }

    @DeleteMapping("/document-types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteType(@PathVariable UUID id) {
        service.deleteType(id);
    }

    // ───────── Tags ─────────

    public record TagRequest(@NotBlank(message = "Saisissez un nom") @Size(max = 80) String name,
                             @Size(max = 9) String color, @Size(max = 255) String description) {}

    public record MergeRequest(@NotNull UUID sourceId, @NotNull UUID targetId) {}

    @GetMapping("/tags")
    List<TagDto> tags() {
        return service.listTags();
    }

    @PostMapping("/tags")
    @ResponseStatus(HttpStatus.CREATED)
    TagDto createTag(@Valid @RequestBody TagRequest r) {
        return service.createTag(new TagInput(r.name(), r.color(), r.description()));
    }

    @PutMapping("/tags/{id}")
    TagDto updateTag(@PathVariable UUID id, @Valid @RequestBody TagRequest r) {
        return service.updateTag(id, new TagInput(r.name(), r.color(), r.description()));
    }

    @PostMapping("/tags/merge")
    TagDto mergeTags(@Valid @RequestBody MergeRequest r) {
        return service.mergeTags(r.sourceId(), r.targetId());
    }

    @DeleteMapping("/tags/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteTag(@PathVariable UUID id) {
        service.deleteTag(id);
    }

    // ───────── Utilisateurs et rôles ─────────

    public record UserRequest(
            @Size(max = 255) String email,
            @NotBlank(message = "Saisissez le nom") @Size(max = 255) String fullName,
            @Size(max = 200) String password,
            Boolean active,
            List<UUID> roleIds) {}

    public record PasswordRequest(@NotBlank(message = "Saisissez un mot de passe") @Size(max = 200) String password) {}

    public record RoleRequest(@NotBlank(message = "Saisissez un nom") @Size(max = 80) String name,
                              @Size(max = 255) String description, List<String> permissions) {}

    @GetMapping("/permissions")
    List<PermissionDto> permissions() {
        return service.permissions();
    }

    @GetMapping("/users")
    List<UserDto> users() {
        return service.listUsers();
    }

    @PostMapping("/users")
    @ResponseStatus(HttpStatus.CREATED)
    UserDto createUser(@Valid @RequestBody UserRequest r) {
        return service.createUser(new UserInput(r.email(), r.fullName(), r.password(), true, r.roleIds()));
    }

    @PutMapping("/users/{id}")
    UserDto updateUser(@PathVariable UUID id, @Valid @RequestBody UserRequest r) {
        return service.updateUser(id, new UserInput(null, r.fullName(), null, r.active(), r.roleIds()));
    }

    @PostMapping("/users/{id}/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void resetPassword(@PathVariable UUID id, @Valid @RequestBody PasswordRequest r) {
        service.resetPassword(id, r.password());
    }

    @GetMapping("/roles")
    List<RoleDto> roles() {
        return service.listRoles();
    }

    @PostMapping("/roles")
    @ResponseStatus(HttpStatus.CREATED)
    RoleDto createRole(@Valid @RequestBody RoleRequest r) {
        return service.createRole(new RoleInput(r.name(), r.description(), r.permissions()));
    }

    @PutMapping("/roles/{id}")
    RoleDto updateRole(@PathVariable UUID id, @Valid @RequestBody RoleRequest r) {
        return service.updateRole(id, new RoleInput(r.name(), r.description(), r.permissions()));
    }

    @DeleteMapping("/roles/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void deleteRole(@PathVariable UUID id) {
        service.deleteRole(id);
    }
}
