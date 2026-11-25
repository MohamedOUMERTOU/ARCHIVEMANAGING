package com.ged.settings;

import com.ged.retention.RetentionInputsChanged;
import org.springframework.context.ApplicationEventPublisher;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.auth.RefreshTokenRepository;
import com.ged.common.ApiException;
import com.ged.common.Json;
import com.ged.document.DocumentRepositories;
import com.ged.document.DocumentType;
import com.ged.retention.RetentionRule;
import com.ged.retention.RetentionRuleRepository;
import com.ged.user.Permissions;
import com.ged.user.Role;
import com.ged.user.RoleRepository;
import com.ged.user.User;
import com.ged.user.UserRepository;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Paramétrage d'une société : règles de conservation, types de document, tags, utilisateurs et rôles.
 * Tout passe par la permission « settings.manage » et chaque modification est journalisée.
 */
@Service
@Transactional
public class SettingsService {

    private final CurrentUserProvider currentUser;
    private final RetentionRuleRepository rules;
    private final DocumentRepositories.Types types;
    private final UserRepository users;
    private final RoleRepository roles;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;
    private final NamedParameterJdbcTemplate jdbc;
    private final Json json;

    private final ApplicationEventPublisher events;

    public SettingsService(CurrentUserProvider currentUser, RetentionRuleRepository rules, DocumentRepositories.Types types,
                           UserRepository users, RoleRepository roles, RefreshTokenRepository refreshTokens,
                           PasswordEncoder passwordEncoder, AuditService audit, NamedParameterJdbcTemplate jdbc, Json json,
                           ApplicationEventPublisher events) {
        this.events = events;
        this.currentUser = currentUser;
        this.rules = rules;
        this.types = types;
        this.users = users;
        this.roles = roles;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.audit = audit;
        this.jdbc = jdbc;
        this.json = json;
    }

    private CurrentUser admin() {
        return currentUser.require(Permissions.SETTINGS);
    }

    private void log(CurrentUser u, String action, String entity, UUID id, Map<String, Object> details) {
        audit.log(u.organizationId(), u.id(), action, entity, id == null ? null : id.toString(), details, null);
    }

    private long count(String sql, UUID id) {
        Long n = jdbc.queryForObject(sql, Map.of("id", id), Long.class);
        return n == null ? 0 : n;
    }

    // ═════════ Règles de conservation ═════════

    public record RuleDto(UUID id, String name, Integer durationYears, RetentionRule.StartEvent startEvent,
                          RetentionRule.FinalAction finalAction, String legalBasis, long nodeCount, long typeCount) {}

    public record RuleInput(String name, Integer durationYears, RetentionRule.StartEvent startEvent,
                            RetentionRule.FinalAction finalAction, String legalBasis) {}

    /** Lecture ouverte à tous : les règles s'affichent dans les formulaires du plan de classement. */
    @Transactional(readOnly = true)
    public List<RuleDto> listRules() {
        CurrentUser u = currentUser.get();
        return rules.findByOrganizationIdOrderByName(u.organizationId()).stream().map(this::toDto).toList();
    }

    public RuleDto createRule(RuleInput in) {
        CurrentUser u = admin();
        checkRule(u, in, null);
        RetentionRule r = rules.save(new RetentionRule(u.organizationId(), in.name().trim(), in.durationYears(),
                in.startEvent(), in.finalAction(), blankToNull(in.legalBasis())));
        log(u, "REGLE_CREEE", "retention_rule", r.getId(), Map.of("name", r.getName()));
        return toDto(r);
    }

    public RuleDto updateRule(UUID id, RuleInput in) {
        CurrentUser u = admin();
        RetentionRule r = rules.findById(id).filter(x -> x.getOrganizationId().equals(u.organizationId()))
                .orElseThrow(() -> ApiException.notFound("Règle de conservation"));
        checkRule(u, in, id);
        String before = r.getName() + " · " + r.getDurationYears();
        r.update(in.name().trim(), in.durationYears(), in.startEvent(), in.finalAction(), blankToNull(in.legalBasis()));
        log(u, "REGLE_MODIFIEE", "retention_rule", id, Map.of("before", before, "after", r.getName() + " · " + r.getDurationYears()));
        events.publishEvent(new RetentionInputsChanged(u.organizationId(), "règle " + r.getName()));
        return toDto(r);
    }

    public void deleteRule(UUID id) {
        CurrentUser u = admin();
        RetentionRule r = rules.findById(id).filter(x -> x.getOrganizationId().equals(u.organizationId()))
                .orElseThrow(() -> ApiException.notFound("Règle de conservation"));
        RuleDto dto = toDto(r);
        if (dto.nodeCount() + dto.typeCount() > 0) {
            throw ApiException.conflict("RULE_IN_USE", "Règle utilisée par %d nœud(s) et %d type(s) : retirez-la d'abord"
                    .formatted(dto.nodeCount(), dto.typeCount()));
        }
        rules.delete(r);
        log(u, "REGLE_SUPPRIMEE", "retention_rule", id, Map.of("name", r.getName()));
    }

    private void checkRule(CurrentUser u, RuleInput in, UUID self) {
        if (in.durationYears() != null && (in.durationYears() < 1 || in.durationYears() > 200)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Durée invalide",
                    Map.of("durationYears", "Entre 1 et 200 ans, ou illimitée"));
        }
        boolean taken = rules.findByOrganizationIdOrderByName(u.organizationId()).stream()
                .anyMatch(r -> r.getName().equalsIgnoreCase(in.name().trim()) && !r.getId().equals(self));
        if (taken) throw new ApiException(HttpStatus.CONFLICT, "NAME_TAKEN", "Ce nom est déjà utilisé", Map.of("name", "Nom déjà utilisé"));
    }

    private RuleDto toDto(RetentionRule r) {
        return new RuleDto(r.getId(), r.getName(), r.getDurationYears(), r.getStartEvent(), r.getFinalAction(), r.getLegalBasis(),
                count("SELECT count(*) FROM classification_nodes WHERE retention_rule_id = :id", r.getId()),
                count("SELECT count(*) FROM document_types WHERE default_retention_rule_id = :id", r.getId()));
    }

    // ═════════ Types de document ═════════

    public record TypeDto(UUID id, String code, String name, UUID defaultRetentionRuleId,
                          List<Map<String, Object>> metadataSchema, long documentCount) {}

    public record TypeInput(String code, String name, UUID defaultRetentionRuleId, List<FieldSchema.Field> fields) {}

    @Transactional(readOnly = true)
    public List<TypeDto> listTypes() {
        CurrentUser u = admin();
        return types.findByOrganizationIdOrderByName(u.organizationId()).stream().map(this::toDto).toList();
    }

    public TypeDto createType(TypeInput in) {
        CurrentUser u = admin();
        String code = in.code() == null ? "" : in.code().trim().toUpperCase();
        if (!code.matches("^[A-Z][A-Z0-9_]{1,39}$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Code invalide",
                    Map.of("code", "Majuscules, chiffres et _ (ex. FACTURE)"));
        }
        if (types.findByOrganizationIdOrderByName(u.organizationId()).stream().anyMatch(t -> t.getCode().equals(code))) {
            throw new ApiException(HttpStatus.CONFLICT, "CODE_TAKEN", "Ce code est déjà utilisé", Map.of("code", "Code déjà utilisé"));
        }
        String schema = checkedSchema(in.fields());
        checkRuleBelongs(u, in.defaultRetentionRuleId());
        DocumentType t = types.save(new DocumentType(u.organizationId(), code, in.name().trim(), schema, in.defaultRetentionRuleId()));
        log(u, "TYPE_CREE", "document_type", t.getId(), Map.of("code", code, "name", t.getName()));
        return toDto(t);
    }

    public TypeDto updateType(UUID id, TypeInput in) {
        CurrentUser u = admin();
        DocumentType t = types.findByIdAndOrganizationId(id, u.organizationId()).orElseThrow(() -> ApiException.notFound("Type de document"));
        String schema = checkedSchema(in.fields());
        checkRuleBelongs(u, in.defaultRetentionRuleId());
        boolean ruleChanged = !java.util.Objects.equals(t.getDefaultRetentionRuleId(), in.defaultRetentionRuleId());
        t.update(in.name().trim(), schema, in.defaultRetentionRuleId());
        if (ruleChanged) events.publishEvent(new RetentionInputsChanged(u.organizationId(), "type " + t.getName()));
        log(u, "TYPE_MODIFIE", "document_type", id, Map.of("name", t.getName(), "fields", in.fields().size()));
        return toDto(t);
    }

    public void deleteType(UUID id) {
        CurrentUser u = admin();
        DocumentType t = types.findByIdAndOrganizationId(id, u.organizationId()).orElseThrow(() -> ApiException.notFound("Type de document"));
        long docs = count("SELECT count(*) FROM documents WHERE type_id = :id", id);
        if (docs > 0) throw ApiException.conflict("TYPE_IN_USE", "Type utilisé par " + docs + " document(s) : suppression impossible");
        types.delete(t);
        log(u, "TYPE_SUPPRIME", "document_type", id, Map.of("code", t.getCode()));
    }

    private String checkedSchema(List<FieldSchema.Field> fields) {
        List<FieldSchema.Field> list = fields == null ? List.of() : fields;
        Map<String, String> errors = FieldSchema.validate(list);
        if (!errors.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Certains champs sont invalides", errors);
        return json.write(FieldSchema.normalize(list));
    }

    private void checkRuleBelongs(CurrentUser u, UUID ruleId) {
        if (ruleId != null && rules.findById(ruleId).filter(r -> r.getOrganizationId().equals(u.organizationId())).isEmpty()) {
            throw ApiException.notFound("Règle de conservation");
        }
    }

    private TypeDto toDto(DocumentType t) {
        return new TypeDto(t.getId(), t.getCode(), t.getName(), t.getDefaultRetentionRuleId(),
                json.readListOfMaps(t.getMetadataSchema()), count("SELECT count(*) FROM documents WHERE type_id = :id", t.getId()));
    }

    // ═════════ Tags ═════════

    public record TagDto(UUID id, String name, String color, String description, long documentCount) {}

    public record TagInput(String name, String color, String description) {}

    @Transactional(readOnly = true)
    public List<TagDto> listTags() {
        CurrentUser u = admin();
        return jdbc.query("""
                SELECT t.id, t.name, t.color, t.description,
                       (SELECT count(*) FROM document_tags dt WHERE dt.tag_id = t.id) AS n
                FROM tags t WHERE t.organization_id = :org ORDER BY t.name
                """, Map.of("org", u.organizationId()),
                (rs, i) -> new TagDto(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("color"),
                        rs.getString("description"), rs.getLong("n")));
    }

    public TagDto createTag(TagInput in) {
        CurrentUser u = admin();
        UUID id = UUID.randomUUID();
        String name = tagName(u, in.name(), null);
        jdbc.update("INSERT INTO tags (id, organization_id, name, color, description) VALUES (:id, :org, :name, :color, :d)",
                new MapSqlParameterSource().addValue("id", id).addValue("org", u.organizationId()).addValue("name", name)
                        .addValue("color", color(in.color())).addValue("d", blankToNull(in.description())));
        log(u, "TAG_CREE", "tag", id, Map.of("name", name));
        return tag(u, id);
    }

    public TagDto updateTag(UUID id, TagInput in) {
        CurrentUser u = admin();
        TagDto before = tag(u, id);
        String name = tagName(u, in.name(), id);
        jdbc.update("UPDATE tags SET name = :name, color = :color, description = :d WHERE id = :id",
                new MapSqlParameterSource().addValue("id", id).addValue("name", name).addValue("color", color(in.color()))
                        .addValue("d", blankToNull(in.description())));
        log(u, "TAG_MODIFIE", "tag", id, Map.of("before", before.name(), "after", name));
        return tag(u, id);
    }

    /** Fusion : les documents du tag source reçoivent le tag cible, puis le tag source disparaît. */
    public TagDto mergeTags(UUID sourceId, UUID targetId) {
        CurrentUser u = admin();
        if (sourceId.equals(targetId)) throw ApiException.badRequest("SAME_TAG", "Choisissez deux tags différents");
        TagDto source = tag(u, sourceId);
        TagDto target = tag(u, targetId);
        var p = new MapSqlParameterSource().addValue("s", sourceId).addValue("t", targetId);
        jdbc.update("INSERT INTO document_tags (document_id, tag_id) SELECT document_id, :t FROM document_tags WHERE tag_id = :s ON CONFLICT DO NOTHING", p);
        jdbc.update("DELETE FROM tags WHERE id = :s", p);
        log(u, "TAGS_FUSIONNES", "tag", targetId, Map.of("source", source.name(), "target", target.name(),
                "documents", source.documentCount()));
        return tag(u, targetId);
    }

    public void deleteTag(UUID id) {
        CurrentUser u = admin();
        TagDto t = tag(u, id);
        jdbc.update("DELETE FROM tags WHERE id = :id", Map.of("id", id));
        log(u, "TAG_SUPPRIME", "tag", id, Map.of("name", t.name(), "documents", t.documentCount()));
    }

    private TagDto tag(CurrentUser u, UUID id) {
        return listTagsUnchecked(u).stream().filter(t -> t.id().equals(id)).findFirst().orElseThrow(() -> ApiException.notFound("Tag"));
    }

    private List<TagDto> listTagsUnchecked(CurrentUser u) {
        return jdbc.query("""
                SELECT t.id, t.name, t.color, t.description,
                       (SELECT count(*) FROM document_tags dt WHERE dt.tag_id = t.id) AS n
                FROM tags t WHERE t.organization_id = :org
                """, Map.of("org", u.organizationId()),
                (rs, i) -> new TagDto(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("color"),
                        rs.getString("description"), rs.getLong("n")));
    }

    private String tagName(CurrentUser u, String raw, UUID self) {
        String name = raw == null ? "" : raw.trim().toLowerCase();
        if (name.isEmpty() || name.length() > 80) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Nom invalide", Map.of("name", "Entre 1 et 80 caractères"));
        }
        boolean taken = listTagsUnchecked(u).stream().anyMatch(t -> t.name().equals(name) && !t.id().equals(self));
        if (taken) throw new ApiException(HttpStatus.CONFLICT, "NAME_TAKEN", "Ce tag existe déjà", Map.of("name", "Tag déjà existant : fusionnez-les plutôt"));
        return name;
    }

    private static String color(String c) {
        return c != null && c.matches("^#[0-9a-fA-F]{6}$") ? c : "#566170";
    }

    // ═════════ Utilisateurs et rôles ═════════

    public record UserDto(UUID id, String email, String fullName, boolean active, List<UUID> roleIds,
                          List<String> roleNames, Instant createdAt) {}

    public record UserInput(String email, String fullName, String password, Boolean active, List<UUID> roleIds) {}

    public record RoleDto(UUID id, String name, String description, List<String> permissions, long userCount) {}

    public record RoleInput(String name, String description, List<String> permissions) {}

    public record PermissionDto(String code, String label) {}

    @Transactional(readOnly = true)
    public List<PermissionDto> permissions() {
        admin();
        return Permissions.CATALOG.entrySet().stream().map(e -> new PermissionDto(e.getKey(), e.getValue())).toList();
    }

    @Transactional(readOnly = true)
    public List<UserDto> listUsers() {
        CurrentUser u = admin();
        List<UUID> ids = jdbc.queryForList("SELECT id FROM users WHERE organization_id = :org ORDER BY full_name",
                Map.of("org", u.organizationId()), UUID.class);
        return ids.stream().map(id -> toDto(users.findWithRolesById(id).orElseThrow())).toList();
    }

    public UserDto createUser(UserInput in) {
        CurrentUser u = admin();
        String email = in.email() == null ? "" : in.email().trim().toLowerCase();
        if (!email.matches("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$")) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Adresse e-mail invalide", Map.of("email", "Adresse e-mail invalide"));
        }
        if (users.findByEmail(email).isPresent()) {
            throw new ApiException(HttpStatus.CONFLICT, "EMAIL_TAKEN", "Cette adresse est déjà utilisée", Map.of("email", "Adresse déjà utilisée"));
        }
        checkPassword(in.password());
        var org = users.findWithRolesById(u.id()).orElseThrow().getOrganization();
        User created = users.save(new User(org, email, passwordEncoder.encode(in.password()), in.fullName().trim(), rolesOf(u, in.roleIds())));
        log(u, "UTILISATEUR_CREE", "user", created.getId(), Map.of("email", email));
        return toDto(users.findWithRolesById(created.getId()).orElseThrow());
    }

    public UserDto updateUser(UUID id, UserInput in) {
        CurrentUser u = admin();
        User target = userOf(u, id);
        boolean active = in.active() == null ? target.isActive() : in.active();
        if (id.equals(u.id()) && !active) throw ApiException.badRequest("SELF_DISABLE", "Vous ne pouvez pas désactiver votre propre compte");
        Set<Role> newRoles = rolesOf(u, in.roleIds());
        target.update(in.fullName().trim(), active, newRoles);
        users.flush();
        ensureAnAdminRemains(u);
        if (!active) refreshTokens.revokeAllForUser(id, Instant.now());
        log(u, "UTILISATEUR_MODIFIE", "user", id, Map.of("active", active,
                "roles", newRoles.stream().map(Role::getName).sorted().toList()));
        return toDto(target);
    }

    public void resetPassword(UUID id, String password) {
        CurrentUser u = admin();
        User target = userOf(u, id);
        checkPassword(password);
        target.changePassword(passwordEncoder.encode(password));
        // Les sessions ouvertes avec l'ancien mot de passe sont fermées
        refreshTokens.revokeAllForUser(id, Instant.now());
        log(u, "MOT_DE_PASSE_REINITIALISE", "user", id, Map.of());
    }

    @Transactional(readOnly = true)
    public List<RoleDto> listRoles() {
        CurrentUser u = admin();
        return jdbc.query("""
                SELECT r.id, r.name, r.description, r.permissions,
                       (SELECT count(*) FROM user_roles ur WHERE ur.role_id = r.id) AS n
                FROM roles r WHERE r.organization_id = :org ORDER BY r.name
                """, Map.of("org", u.organizationId()),
                (rs, i) -> new RoleDto(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"),
                        List.of((String[]) rs.getArray("permissions").getArray()), rs.getLong("n")));
    }

    public RoleDto createRole(RoleInput in) {
        CurrentUser u = admin();
        checkRole(u, in, null);
        Role r = roles.save(new Role(u.organizationId(), in.name().trim(), cleanPermissions(in.permissions())));
        r.update(r.getName(), blankToNull(in.description()), r.getPermissions());
        log(u, "ROLE_CREE", "role", r.getId(), Map.of("name", r.getName(), "permissions", r.getPermissions()));
        return role(u, r.getId());
    }

    public RoleDto updateRole(UUID id, RoleInput in) {
        CurrentUser u = admin();
        Role r = roles.findById(id).filter(x -> x.getOrganizationId().equals(u.organizationId())).orElseThrow(() -> ApiException.notFound("Rôle"));
        checkRole(u, in, id);
        r.update(in.name().trim(), blankToNull(in.description()), cleanPermissions(in.permissions()));
        roles.flush();
        ensureAnAdminRemains(u);
        log(u, "ROLE_MODIFIE", "role", id, Map.of("name", r.getName(), "permissions", r.getPermissions()));
        return role(u, id);
    }

    public void deleteRole(UUID id) {
        CurrentUser u = admin();
        RoleDto r = role(u, id);
        if (r.userCount() > 0) throw ApiException.conflict("ROLE_IN_USE", "Rôle attribué à " + r.userCount() + " utilisateur(s) : retirez-le d'abord");
        roles.deleteById(id);
        log(u, "ROLE_SUPPRIME", "role", id, Map.of("name", r.name()));
    }

    /** Il doit toujours rester au moins un compte actif qui a tous les droits, sinon la société serait bloquée. */
    private void ensureAnAdminRemains(CurrentUser u) {
        long admins = count("""
                SELECT count(DISTINCT us.id) FROM users us
                JOIN user_roles ur ON ur.user_id = us.id JOIN roles r ON r.id = ur.role_id
                WHERE us.organization_id = :id AND us.active AND '*' = ANY(r.permissions)
                """, u.organizationId());
        if (admins == 0) {
            throw ApiException.conflict("LAST_ADMIN", "Il doit rester au moins un administrateur actif (permission « Tous les droits »)");
        }
    }

    private void checkRole(CurrentUser u, RoleInput in, UUID self) {
        if (in.name() == null || in.name().isBlank()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Nom obligatoire", Map.of("name", "Nom obligatoire"));
        }
        boolean taken = listRoles().stream().anyMatch(r -> r.name().equalsIgnoreCase(in.name().trim()) && !r.id().equals(self));
        if (taken) throw new ApiException(HttpStatus.CONFLICT, "NAME_TAKEN", "Ce rôle existe déjà", Map.of("name", "Nom déjà utilisé"));
    }

    private static List<String> cleanPermissions(List<String> permissions) {
        List<String> list = permissions == null ? List.of() : permissions.stream().distinct().toList();
        List<String> unknown = list.stream().filter(p -> !Permissions.CATALOG.containsKey(p)).toList();
        if (!unknown.isEmpty()) throw ApiException.badRequest("UNKNOWN_PERMISSION", "Permission inconnue : " + String.join(", ", unknown));
        return list;
    }

    private RoleDto role(CurrentUser u, UUID id) {
        return listRoles().stream().filter(r -> r.id().equals(id)).findFirst().orElseThrow(() -> ApiException.notFound("Rôle"));
    }

    private Set<Role> rolesOf(CurrentUser u, List<UUID> ids) {
        Set<Role> set = new HashSet<>();
        for (UUID rid : ids == null ? List.<UUID>of() : ids) {
            set.add(roles.findById(rid).filter(r -> r.getOrganizationId().equals(u.organizationId()))
                    .orElseThrow(() -> ApiException.notFound("Rôle")));
        }
        return set;
    }

    private User userOf(CurrentUser u, UUID id) {
        return users.findWithRolesById(id).filter(x -> x.getOrganization().getId().equals(u.organizationId()))
                .orElseThrow(() -> ApiException.notFound("Utilisateur"));
    }

    private static void checkPassword(String password) {
        if (password == null || password.length() < 10) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", "Mot de passe trop court",
                    Map.of("password", "10 caractères au minimum"));
        }
    }

    private UserDto toDto(User x) {
        var sorted = x.getRoles().stream().sorted((a, b) -> a.getName().compareTo(b.getName())).toList();
        java.sql.Timestamp ts = jdbc.queryForObject("SELECT created_at FROM users WHERE id = :id", Map.of("id", x.getId()),
                java.sql.Timestamp.class);
        Instant created = ts == null ? null : ts.toInstant();
        return new UserDto(x.getId(), x.getEmail(), x.getFullName(), x.isActive(), sorted.stream().map(Role::getId).toList(),
                sorted.stream().map(Role::getName).toList(), created);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
