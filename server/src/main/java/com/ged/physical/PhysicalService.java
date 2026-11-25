package com.ged.physical;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.auth.CurrentUserProvider;
import com.ged.common.ApiException;
import com.ged.common.Json;
import com.ged.common.TreePaths;
import com.ged.document.DocumentEvent;
import com.ged.document.DocumentEventType;
import com.ged.document.DocumentRepositories;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Archives physiques d'une société : niveaux (définis par la société), emplacements en arbre,
 * rangement des originaux papier et prêts.
 */
@Service
@Transactional
public class PhysicalService {

    public static final String MANAGE = "physical.manage";

    private final NamedParameterJdbcTemplate jdbc;
    private final CurrentUserProvider currentUser;
    private final AuditService audit;
    private final DocumentRepositories.Events events;
    private final LocationPaths paths;
    private final Json json;

    public PhysicalService(NamedParameterJdbcTemplate jdbc, CurrentUserProvider currentUser, AuditService audit,
                           DocumentRepositories.Events events, LocationPaths paths, Json json) {
        this.jdbc = jdbc;
        this.currentUser = currentUser;
        this.audit = audit;
        this.events = events;
        this.paths = paths;
        this.json = json;
    }

    private CurrentUser manager() {
        return currentUser.require(MANAGE);
    }

    private void log(CurrentUser u, String action, String entity, UUID id, Map<String, Object> details) {
        audit.log(u.organizationId(), u.id(), action, entity, id.toString(), details, null);
    }

    private static MapSqlParameterSource p(Object... kv) {
        MapSqlParameterSource s = new MapSqlParameterSource();
        for (int i = 0; i < kv.length; i += 2) s.addValue((String) kv[i], kv[i + 1]);
        return s;
    }

    private long count(String sql, MapSqlParameterSource params) {
        Long n = jdbc.queryForObject(sql, params, Long.class);
        return n == null ? 0 : n;
    }

    private static ApiException invalid(String field, String message) {
        return new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION", message, Map.of(field, message));
    }

    // ═════════ Niveaux ═════════

    public record LevelDto(UUID id, String code, String name, boolean isRoot, boolean canHoldDocuments, Integer capacity,
                           List<UUID> childLevelIds, long locationCount, String icon) {}

    public record LevelInput(String code, String name, boolean isRoot, boolean canHoldDocuments, Integer capacity,
                             String icon) {
        public LevelInput(String code, String name, boolean isRoot, boolean canHoldDocuments, Integer capacity) {
            this(code, name, isRoot, canHoldDocuments, capacity, null);
        }
    }

    /** Icônes proposées pour un niveau ; même catalogue que l'interface. */
    public static final java.util.Set<String> LEVEL_ICONS = java.util.Set.of("site", "building", "warehouse", "floor",
            "room", "cabinet", "shelving", "shelf", "drawer", "box", "binder", "folder");

    @Transactional(readOnly = true)
    public List<LevelDto> levels() {
        CurrentUser u = currentUser.get();
        Map<UUID, List<UUID>> children = edges(u.organizationId());
        return jdbc.query("""
                SELECT l.id, l.code, l.name, l.is_root, l.can_hold_documents, l.capacity, l.icon,
                       (SELECT count(*) FROM physical_locations pl WHERE pl.level_id = l.id) AS n
                FROM location_levels l WHERE l.organization_id = :org ORDER BY l.is_root DESC, l.name
                """, p("org", u.organizationId()),
                (rs, i) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    return new LevelDto(id, rs.getString("code"), rs.getString("name"), rs.getBoolean("is_root"),
                            rs.getBoolean("can_hold_documents"), (Integer) rs.getObject("capacity"),
                            children.getOrDefault(id, List.of()), rs.getLong("n"), rs.getString("icon"));
                });
    }

    public LevelDto createLevel(LevelInput in) {
        CurrentUser u = manager();
        String code = checkLevel(u, in, null);
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO location_levels (id, organization_id, code, name, is_root, can_hold_documents, capacity, icon)
                VALUES (:id, :org, :code, :name, :root, :hold, :cap, :icon)
                """, p("id", id, "org", u.organizationId(), "code", code, "name", in.name().trim(), "root", in.isRoot(),
                "hold", in.canHoldDocuments(), "cap", in.canHoldDocuments() ? in.capacity() : null,
                "icon", icon(in, code)));
        log(u, "NIVEAU_CREE", "location_level", id, Map.of("name", in.name().trim()));
        return level(u, id);
    }

    public LevelDto updateLevel(UUID id, LevelInput in) {
        CurrentUser u = manager();
        level(u, id);
        String code = checkLevel(u, in, id);
        if (!in.canHoldDocuments() && count("SELECT count(*) FROM documents d JOIN physical_locations pl ON pl.id = d.physical_location_id WHERE pl.level_id = :id", p("id", id)) > 0) {
            throw ApiException.conflict("LEVEL_HOLDS_DOCUMENTS", "Des documents sont rangés à ce niveau : il doit continuer à recevoir des documents");
        }
        if (!in.isRoot() && count("SELECT count(*) FROM physical_locations WHERE level_id = :id AND parent_id IS NULL", p("id", id)) > 0) {
            throw ApiException.conflict("LEVEL_HAS_ROOTS", "Des emplacements de ce niveau sont en haut de l'arbre : il doit rester un niveau racine");
        }
        jdbc.update("""
                UPDATE location_levels SET code = :code, name = :name, is_root = :root, can_hold_documents = :hold, capacity = :cap,
                    icon = :icon
                WHERE id = :id
                """, p("id", id, "code", code, "name", in.name().trim(), "root", in.isRoot(), "hold", in.canHoldDocuments(),
                "cap", in.canHoldDocuments() ? in.capacity() : null, "icon", icon(in, code)));
        log(u, "NIVEAU_MODIFIE", "location_level", id, Map.of("name", in.name().trim()));
        return level(u, id);
    }

    public void deleteLevel(UUID id) {
        CurrentUser u = manager();
        LevelDto l = level(u, id);
        if (l.locationCount() > 0) {
            throw ApiException.conflict("LEVEL_IN_USE", l.locationCount() + " emplacement(s) utilisent ce niveau : suppression impossible");
        }
        jdbc.update("DELETE FROM location_levels WHERE id = :id", p("id", id));
        log(u, "NIVEAU_SUPPRIME", "location_level", id, Map.of("name", l.name()));
    }

    /** Fixe les niveaux que {@code id} peut contenir ; refuse toute boucle. */
    public LevelDto setChildren(UUID id, List<UUID> childIds) {
        CurrentUser u = manager();
        level(u, id);
        List<UUID> children = childIds == null ? List.of() : childIds.stream().distinct().toList();
        for (UUID c : children) {
            if (c.equals(id)) throw ApiException.badRequest("SELF_CHILD", "Un niveau ne peut pas se contenir lui-même");
            level(u, c);
        }
        Map<UUID, List<UUID>> graph = edges(u.organizationId());
        if (LevelGraph.createsCycle(graph, id, children)) {
            throw ApiException.badRequest("LEVEL_CYCLE", "Ce choix créerait une boucle (un niveau qui finirait par se contenir lui-même)");
        }
        // Un lien retiré ne doit pas rendre invalides des emplacements existants
        for (UUID removed : graph.getOrDefault(id, List.of())) {
            if (!children.contains(removed) && count("""
                    SELECT count(*) FROM physical_locations c JOIN physical_locations pa ON pa.id = c.parent_id
                    WHERE pa.level_id = :parent AND c.level_id = :child
                    """, p("parent", id, "child", removed)) > 0) {
                throw ApiException.conflict("LINK_IN_USE", "Des emplacements existants utilisent ce lien : déplacez-les avant de le retirer");
            }
        }
        jdbc.update("DELETE FROM location_level_children WHERE parent_level_id = :id", p("id", id));
        for (UUID c : children) {
            jdbc.update("INSERT INTO location_level_children (parent_level_id, child_level_id) VALUES (:p, :c)", p("p", id, "c", c));
        }
        log(u, "NIVEAU_ENFANTS_MODIFIES", "location_level", id, Map.of("children", children.size()));
        return level(u, id);
    }

    private Map<UUID, List<UUID>> edges(UUID org) {
        Map<UUID, List<UUID>> m = new HashMap<>();
        jdbc.query("""
                SELECT c.parent_level_id, c.child_level_id FROM location_level_children c
                JOIN location_levels l ON l.id = c.parent_level_id WHERE l.organization_id = :org
                """, p("org", org),
                rs -> { m.computeIfAbsent(rs.getObject(1, UUID.class), k -> new ArrayList<>()).add(rs.getObject(2, UUID.class)); });
        return m;
    }

    /** Icône choisie, sinon devinée d'après le code (mêmes règles que la migration V5). */
    private static String icon(LevelInput in, String code) {
        if (in.icon() != null && !in.icon().isBlank()) {
            if (!LEVEL_ICONS.contains(in.icon())) throw invalid("icon", "Icône inconnue");
            return in.icon();
        }
        String[][] rules = {
                {"ETAGERE", "shelf"}, {"BAT", "building"}, {"IMMEUBLE", "building"}, {"SITE", "site"}, {"ENTREPOT", "warehouse"},
                {"DEPOT", "warehouse"}, {"ETAGE", "floor"}, {"NIVEAU", "floor"}, {"SALLE", "room"}, {"MAGASIN", "room"},
                {"LOCAL", "room"}, {"ARMOIRE", "cabinet"}, {"RAYON", "shelving"}, {"TRAVEE", "shelving"},
                {"TABLETTE", "shelf"}, {"TIROIR", "drawer"}, {"CLASSEUR", "binder"},
                {"CHEMISE", "folder"}, {"DOSSIER", "folder"}};
        for (String[] r : rules) if (code.startsWith(r[0])) return r[1];
        return in.canHoldDocuments() ? "box" : "room";
    }

    private LevelDto level(CurrentUser u, UUID id) {
        return levels().stream().filter(l -> l.id().equals(id)).findFirst().orElseThrow(() -> ApiException.notFound("Niveau"));
    }

    private String checkLevel(CurrentUser u, LevelInput in, UUID self) {
        String code = in.code() == null ? "" : in.code().trim().toUpperCase();
        if (!code.matches("^[A-Z][A-Z0-9_]{0,39}$")) throw invalid("code", "Majuscules, chiffres et _ (ex. BOITE)");
        if (in.name() == null || in.name().isBlank()) throw invalid("name", "Saisissez un nom");
        if (in.capacity() != null && (in.capacity() < 1 || in.capacity() > 100_000)) throw invalid("capacity", "Entre 1 et 100 000");
        boolean taken = count("SELECT count(*) FROM location_levels WHERE organization_id = :org AND code = :code AND id <> :self",
                p("org", u.organizationId(), "code", code, "self", self == null ? UUID.randomUUID() : self)) > 0;
        if (taken) throw new ApiException(HttpStatus.CONFLICT, "CODE_TAKEN", "Code déjà utilisé", Map.of("code", "Code déjà utilisé"));
        return code;
    }

    // ═════════ Emplacements ═════════

    public record LocationDto(UUID id, UUID parentId, UUID levelId, String levelName, String code, String label,
                              String barcode, int depth, boolean active, boolean canHoldDocuments, Integer capacity,
                              long documentCount, long childCount, boolean onLoan, String levelIcon) {}

    public record LocationDetail(LocationDto location, String path, List<UUID> allowedChildLevelIds, LoanDto openLoan) {}

    public record LocationInput(UUID parentId, UUID levelId, String code, String label, String barcode, Boolean active) {}

    private static final String LOCATION_SELECT = """
            SELECT pl.id, pl.parent_id, pl.level_id, l.name AS level_name, l.icon AS level_icon, pl.code, pl.label,
                   pl.barcode, pl.depth, pl.active, l.can_hold_documents, l.capacity,
                   (SELECT count(*) FROM documents d WHERE d.physical_location_id = pl.id) AS docs,
                   (SELECT count(*) FROM physical_locations c WHERE c.parent_id = pl.id) AS children,
                   EXISTS (SELECT 1 FROM loans lo WHERE lo.location_id = pl.id AND lo.returned_at IS NULL) AS on_loan
            FROM physical_locations pl JOIN location_levels l ON l.id = pl.level_id
            """;

    private static LocationDto location(ResultSet rs) throws SQLException {
        return new LocationDto(rs.getObject("id", UUID.class), rs.getObject("parent_id", UUID.class),
                rs.getObject("level_id", UUID.class), rs.getString("level_name"), rs.getString("code"), rs.getString("label"),
                rs.getString("barcode"), rs.getInt("depth"), rs.getBoolean("active"), rs.getBoolean("can_hold_documents"),
                (Integer) rs.getObject("capacity"), rs.getLong("docs"), rs.getLong("children"), rs.getBoolean("on_loan"),
                rs.getString("level_icon"));
    }

    @Transactional(readOnly = true)
    public List<LocationDto> tree() {
        CurrentUser u = currentUser.get();
        return jdbc.query(LOCATION_SELECT + " WHERE pl.organization_id = :org ORDER BY pl.depth, pl.code",
                p("org", u.organizationId()), (rs, i) -> location(rs));
    }

    @Transactional(readOnly = true)
    public LocationDetail get(UUID id) {
        CurrentUser u = currentUser.get();
        LocationDto loc = find(u, id);
        String idPath = idPath(id);
        List<UUID> allowed = edges(u.organizationId()).getOrDefault(loc.levelId(), List.of());
        LoanDto loan = loans(u, "open").stream().filter(l -> id.equals(l.locationId())).findFirst().orElse(null);
        return new LocationDetail(loc, paths.display(idPath), allowed, loan);
    }

    public LocationDetail create(LocationInput in) {
        CurrentUser u = manager();
        LevelDto lvl = level(u, in.levelId());
        String idPathParent = null;
        if (in.parentId() == null) {
            if (!lvl.isRoot()) throw invalid("levelId", "Le niveau « " + lvl.name() + " » ne peut pas être en haut de l'arbre");
        } else {
            LocationDto parent = find(u, in.parentId());
            if (!edges(u.organizationId()).getOrDefault(parent.levelId(), List.of()).contains(lvl.id())) {
                throw invalid("levelId", "« " + parent.levelName() + " » ne peut pas contenir de « " + lvl.name() + " »");
            }
            idPathParent = idPath(parent.id());
        }
        String code = checkLocation(u, in, null);
        UUID id = UUID.randomUUID();
        String path = TreePaths.build(idPathParent, id);
        jdbc.update("""
                INSERT INTO physical_locations (id, organization_id, level_id, parent_id, code, label, barcode, id_path, depth)
                VALUES (:id, :org, :lvl, :parent, :code, :label, :barcode, :path, :depth)
                """, p("id", id, "org", u.organizationId(), "lvl", lvl.id(), "parent", in.parentId(), "code", code,
                "label", in.label().trim(), "barcode", blank(in.barcode()), "path", path, "depth", TreePaths.depth(path)));
        log(u, "EMPLACEMENT_CREE", "physical_location", id, Map.of("code", code, "path", paths.display(path)));
        return get(id);
    }

    public LocationDetail update(UUID id, LocationInput in) {
        CurrentUser u = manager();
        LocationDto before = find(u, id);
        String code = checkLocation(u, in, id);
        boolean active = in.active() == null ? before.active() : in.active();
        jdbc.update("UPDATE physical_locations SET code = :code, label = :label, barcode = :barcode, active = :active WHERE id = :id",
                p("id", id, "code", code, "label", in.label().trim(), "barcode", blank(in.barcode()), "active", active));
        log(u, "EMPLACEMENT_MODIFIE", "physical_location", id, Map.of("before", before.label(), "after", in.label().trim()));
        return get(id);
    }

    /** Déplace un emplacement et tout ce qu'il contient ; le chemin avant/après est journalisé. */
    public LocationDetail move(UUID id, UUID newParentId) {
        CurrentUser u = manager();
        LocationDto loc = find(u, id);
        LocationDto parent = find(u, newParentId);
        String oldPrefix = idPath(id);
        String parentPath = idPath(newParentId);
        if (TreePaths.isSelfOrDescendant(oldPrefix, parentPath)) {
            throw ApiException.badRequest("MOVE_INTO_SELF", "Impossible de déplacer un emplacement dans ce qu'il contient");
        }
        if (!edges(u.organizationId()).getOrDefault(parent.levelId(), List.of()).contains(loc.levelId())) {
            throw ApiException.badRequest("LEVEL_NOT_ALLOWED", "« " + parent.levelName() + " » ne peut pas contenir de « " + loc.levelName() + " »");
        }
        if (newParentId.equals(loc.parentId())) return get(id);
        String fromPath = paths.display(oldPrefix);
        String newPrefix = TreePaths.build(parentPath, id);
        int delta = TreePaths.depth(newPrefix) - loc.depth();
        jdbc.update("UPDATE physical_locations SET parent_id = :parent WHERE id = :id", p("parent", newParentId, "id", id));
        jdbc.update("""
                UPDATE physical_locations SET id_path = :np || substring(id_path FROM :len), depth = depth + :delta
                WHERE organization_id = :org AND id_path LIKE :op
                """, p("np", newPrefix, "len", oldPrefix.length() + 1, "delta", delta, "org", u.organizationId(), "op", oldPrefix + "%"));
        String toPath = paths.display(newPrefix);
        long docs = count("SELECT count(*) FROM documents WHERE physical_location_id IN (SELECT id FROM physical_locations WHERE id_path LIKE :p)",
                p("p", newPrefix + "%"));
        log(u, "EMPLACEMENT_DEPLACE", "physical_location", id, Map.of("from", fromPath, "to", toPath, "documents", docs));
        // Chaque document concerné garde la trace de son nouvel emplacement
        recordForDocumentsUnder(u, newPrefix, DocumentEventType.DEPLACE, null, Map.of("path", fromPath), Map.of("path", toPath));
        return get(id);
    }

    public void delete(UUID id) {
        CurrentUser u = manager();
        LocationDto loc = find(u, id);
        if (loc.childCount() > 0 || loc.documentCount() > 0) {
            throw ApiException.conflict("LOCATION_NOT_EMPTY", "L'emplacement contient des emplacements ou des documents : videz-le d'abord");
        }
        if (count("SELECT count(*) FROM loans WHERE location_id = :id", p("id", id)) > 0) {
            throw ApiException.conflict("LOCATION_HAS_LOANS", "Cet emplacement a un historique de prêts : désactivez-le plutôt que de le supprimer");
        }
        jdbc.update("DELETE FROM physical_locations WHERE id = :id", p("id", id));
        log(u, "EMPLACEMENT_SUPPRIME", "physical_location", id, Map.of("code", loc.code()));
    }

    private LocationDto find(CurrentUser u, UUID id) {
        List<LocationDto> found = jdbc.query(LOCATION_SELECT + " WHERE pl.organization_id = :org AND pl.id = :id",
                p("org", u.organizationId(), "id", id), (rs, i) -> location(rs));
        if (found.isEmpty()) throw ApiException.notFound("Emplacement");
        return found.get(0);
    }

    private String idPath(UUID id) {
        return jdbc.queryForObject("SELECT id_path FROM physical_locations WHERE id = :id", p("id", id), String.class);
    }

    private String checkLocation(CurrentUser u, LocationInput in, UUID self) {
        String code = in.code() == null ? "" : in.code().trim();
        if (code.isEmpty() || code.length() > 80) throw invalid("code", "Saisissez un code (80 caractères au maximum)");
        if (in.label() == null || in.label().isBlank()) throw invalid("label", "Saisissez un libellé");
        UUID other = self == null ? UUID.randomUUID() : self;
        if (count("SELECT count(*) FROM physical_locations WHERE organization_id = :org AND code = :code AND id <> :self",
                p("org", u.organizationId(), "code", code, "self", other)) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "CODE_TAKEN", "Code déjà utilisé", Map.of("code", "Code déjà utilisé"));
        }
        String barcode = blank(in.barcode());
        if (barcode != null && count("SELECT count(*) FROM physical_locations WHERE organization_id = :org AND barcode = :b AND id <> :self",
                p("org", u.organizationId(), "b", barcode, "self", other)) > 0) {
            throw new ApiException(HttpStatus.CONFLICT, "BARCODE_TAKEN", "Code-barres déjà utilisé", Map.of("barcode", "Code-barres déjà utilisé"));
        }
        return code;
    }

    // ═════════ Rangement des originaux ═════════

    /** Range l'original papier d'un document (ou le retire si locationId est null). */
    public LocationDetail placeDocument(UUID documentId, UUID locationId) {
        CurrentUser u = currentUser.get();
        if (!u.can(MANAGE) && !u.can("documents.write")) throw ApiException.forbidden("Vous ne pouvez pas ranger de documents");
        Map<String, Object> doc = jdbc.queryForList("SELECT id, physical_location_id, status FROM documents WHERE id = :id AND organization_id = :org",
                p("id", documentId, "org", u.organizationId())).stream().findFirst().orElseThrow(() -> ApiException.notFound("Document"));
        if (java.util.List.of("ELIMINE", "VERSE").contains((String) doc.get("status"))) {
            throw ApiException.conflict("DISPOSED", "Document éliminé ou versé : son original n'est plus géré ici");
        }
        UUID previous = (UUID) doc.get("physical_location_id");
        if (java.util.Objects.equals(previous, locationId)) return locationId == null ? null : get(locationId);

        String after = null;
        if (locationId != null) {
            LocationDto box = find(u, locationId);
            if (!box.canHoldDocuments()) throw ApiException.badRequest("CANNOT_HOLD", "« " + box.levelName() + " » ne reçoit pas de documents : choisissez une boîte");
            if (!box.active()) throw ApiException.badRequest("INACTIVE", "Cet emplacement est désactivé");
            if (box.capacity() != null && box.documentCount() >= box.capacity()) {
                throw ApiException.conflict("FULL", "« " + box.label() + " » est pleine (" + box.capacity() + " documents)");
            }
            after = paths.display(idPath(locationId));
        }
        String before = previous == null ? null : paths.display(idPath(previous));
        jdbc.update("UPDATE documents SET physical_location_id = :loc, updated_at = now() WHERE id = :id", p("loc", locationId, "id", documentId));
        DocumentEventType type = previous == null ? DocumentEventType.RANGE : DocumentEventType.DEPLACE;
        record(u, documentId, type, null, before == null ? null : Map.of("path", before),
                after == null ? Map.of("path", "Retiré de son emplacement") : Map.of("path", after));
        Map<String, Object> details = new LinkedHashMap<>();
        details.put("from", before);
        details.put("to", after);
        audit.log(u.organizationId(), u.id(), "ORIGINAL_RANGE", "document", documentId.toString(), details, null);
        return locationId == null ? null : get(locationId);
    }

    // ═════════ Prêts ═════════

    public record LoanDto(UUID id, UUID locationId, String locationLabel, String locationPath, UUID documentId,
                          String documentTitle, String documentReference, String borrower, String kind, String reason,
                          Instant outAt, LocalDate dueAt, Instant returnedAt, boolean overdue, long documentCount) {}

    public record LoanInput(UUID locationId, UUID documentId, String borrower, String kind, String reason, LocalDate dueAt) {}

    @Transactional(readOnly = true)
    public List<LoanDto> loans(String filter) {
        return loans(currentUser.get(), filter);
    }

    private List<LoanDto> loans(CurrentUser u, String filter) {
        String where = switch (filter == null ? "open" : filter) {
            case "overdue" -> " AND lo.returned_at IS NULL AND lo.due_at < current_date";
            case "returned" -> " AND lo.returned_at IS NOT NULL";
            case "all" -> "";
            default -> " AND lo.returned_at IS NULL";
        };
        return jdbc.query("""
                SELECT lo.*, pl.label AS loc_label, pl.id_path AS loc_path, d.title AS doc_title, d.reference AS doc_ref,
                       CASE WHEN lo.location_id IS NULL THEN 1 ELSE
                         (SELECT count(*) FROM documents dd JOIN physical_locations x ON x.id = dd.physical_location_id
                          WHERE x.id_path LIKE pl.id_path || '%') END AS doc_count
                FROM loans lo
                LEFT JOIN physical_locations pl ON pl.id = lo.location_id
                LEFT JOIN documents d ON d.id = lo.document_id
                WHERE lo.organization_id = :org""" + where + " ORDER BY lo.returned_at NULLS FIRST, lo.due_at",
                p("org", u.organizationId()),
                (rs, i) -> {
                    LocalDate due = rs.getObject("due_at", LocalDate.class);
                    java.sql.Timestamp ret = rs.getTimestamp("returned_at");
                    String locPath = rs.getString("loc_path");
                    return new LoanDto(rs.getObject("id", UUID.class), rs.getObject("location_id", UUID.class),
                            rs.getString("loc_label"), locPath == null ? null : paths.display(locPath),
                            rs.getObject("document_id", UUID.class), rs.getString("doc_title"), rs.getString("doc_ref"),
                            rs.getString("borrower"), rs.getString("kind"), rs.getString("reason"),
                            rs.getTimestamp("out_at").toInstant(), due, ret == null ? null : ret.toInstant(),
                            ret == null && due.isBefore(LocalDate.now()), rs.getLong("doc_count"));
                });
    }

    public LoanDto createLoan(LoanInput in) {
        CurrentUser u = manager();
        if ((in.locationId() == null) == (in.documentId() == null)) {
            throw ApiException.badRequest("LOAN_TARGET", "Choisissez une boîte ou un document à prêter");
        }
        if (in.borrower() == null || in.borrower().isBlank()) throw invalid("borrower", "Indiquez l'emprunteur");
        if (in.dueAt() == null || in.dueAt().isBefore(LocalDate.now())) throw invalid("dueAt", "Date de retour à venir obligatoire");
        String kind = "CONSULTATION".equals(in.kind()) ? "CONSULTATION" : "PRET";
        String path;
        if (in.locationId() != null) {
            LocationDto loc = find(u, in.locationId());
            path = idPath(loc.id());
            if (count("SELECT count(*) FROM loans WHERE location_id = :id AND returned_at IS NULL", p("id", loc.id())) > 0) {
                throw ApiException.conflict("ALREADY_ON_LOAN", "« " + loc.label() + " » est déjà en prêt");
            }
        } else {
            path = null;
            if (count("SELECT count(*) FROM documents WHERE id = :id AND organization_id = :org", p("id", in.documentId(), "org", u.organizationId())) == 0) {
                throw ApiException.notFound("Document");
            }
            if (count("SELECT count(*) FROM loans WHERE document_id = :id AND returned_at IS NULL", p("id", in.documentId())) > 0) {
                throw ApiException.conflict("ALREADY_ON_LOAN", "Cet original est déjà en prêt");
            }
        }
        UUID id = UUID.randomUUID();
        jdbc.update("""
                INSERT INTO loans (id, organization_id, location_id, document_id, borrower, kind, reason, due_at, created_by)
                VALUES (:id, :org, :loc, :doc, :borrower, :kind, :reason, :due, :by)
                """, p("id", id, "org", u.organizationId(), "loc", in.locationId(), "doc", in.documentId(),
                "borrower", in.borrower().trim(), "kind", kind, "reason", blank(in.reason()), "due", in.dueAt(), "by", u.id()));
        Map<String, Object> after = Map.of("loan", id.toString(), "borrower", in.borrower().trim(), "dueAt", in.dueAt().toString());
        if (path != null) recordForDocumentsUnder(u, path, DocumentEventType.ORIGINAL_SORTI, in.reason(), null, after);
        else record(u, in.documentId(), DocumentEventType.ORIGINAL_SORTI, in.reason(), null, after);
        log(u, "PRET_CREE", "loan", id, Map.of("borrower", in.borrower().trim(), "dueAt", in.dueAt().toString()));
        return loans(u, "all").stream().filter(l -> l.id().equals(id)).findFirst().orElseThrow();
    }

    public LoanDto returnLoan(UUID id) {
        CurrentUser u = manager();
        LoanDto loan = loans(u, "all").stream().filter(l -> l.id().equals(id)).findFirst().orElseThrow(() -> ApiException.notFound("Prêt"));
        if (loan.returnedAt() != null) throw ApiException.conflict("ALREADY_RETURNED", "Ce prêt est déjà rendu");
        jdbc.update("UPDATE loans SET returned_at = now(), returned_by = :by WHERE id = :id", p("id", id, "by", u.id()));
        Map<String, Object> after = Map.of("loan", id.toString(), "borrower", loan.borrower());
        if (loan.locationId() != null) recordForDocumentsUnder(u, idPath(loan.locationId()), DocumentEventType.ORIGINAL_RENDU, null, null, after);
        else record(u, loan.documentId(), DocumentEventType.ORIGINAL_RENDU, null, null, after);
        log(u, "PRET_RENDU", "loan", id, Map.of("borrower", loan.borrower()));
        return loans(u, "all").stream().filter(l -> l.id().equals(id)).findFirst().orElseThrow();
    }

    // ═════════ Interne ═════════

    private void recordForDocumentsUnder(CurrentUser u, String idPrefix, DocumentEventType type, String reason,
                                         Map<String, Object> before, Map<String, Object> after) {
        List<UUID> docs = jdbc.queryForList("""
                SELECT d.id FROM documents d JOIN physical_locations pl ON pl.id = d.physical_location_id
                WHERE pl.id_path LIKE :p
                """, p("p", idPrefix + "%"), UUID.class);
        docs.forEach(d -> record(u, d, type, reason, before, after));
    }

    private void record(CurrentUser u, UUID documentId, DocumentEventType type, String reason,
                        Map<String, Object> before, Map<String, Object> after) {
        events.save(new DocumentEvent(u.organizationId(), documentId, type, u.id(), null, blank(reason),
                before == null ? null : json.write(before), after == null ? null : json.write(after)));
    }

    private static String blank(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
