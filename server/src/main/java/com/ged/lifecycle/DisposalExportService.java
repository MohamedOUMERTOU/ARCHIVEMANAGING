package com.ged.lifecycle;

import static com.ged.lifecycle.LifecycleSupport.APPROVE;
import static com.ged.lifecycle.LifecycleSupport.MANAGE;
import static com.ged.lifecycle.LifecycleSupport.params;

import com.ged.audit.AuditService;
import com.ged.auth.CurrentUser;
import com.ged.common.ApiException;
import com.ged.common.Json;
import com.ged.lifecycle.LifecycleDtos.ListDetail;
import com.ged.lifecycle.LifecycleDtos.ListItem;
import com.ged.storage.FileStorage;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Exports d'un bordereau : liste CSV (pièce jointe au procès-verbal) et, pour un versement visé,
 * paquet ZIP remis au service d'archives : fichiers de toutes les versions et manifeste JSON
 * (notices, métadonnées, empreintes SHA-256 pour le contrôle à réception).
 */
@Service
public class DisposalExportService {

    /** Contenu d'un paquet, préparé dans la transaction puis écrit en flux vers le client. */
    public record Package(String fileName, byte[] manifest, List<Entry> files) {}

    public record Entry(String path, String storageKey) {}

    private final LifecycleSupport support;
    private final DisposalListService lists;
    private final NamedParameterJdbcTemplate jdbc;
    private final Json json;
    private final AuditService audit;
    private final FileStorage storage;

    public DisposalExportService(LifecycleSupport support, DisposalListService lists, Json json, AuditService audit,
                                 FileStorage storage) {
        this.support = support;
        this.lists = lists;
        this.jdbc = support.jdbc();
        this.json = json;
        this.audit = audit;
        this.storage = storage;
    }

    @Transactional(readOnly = true)
    public byte[] csv(UUID id) {
        ListDetail d = lists.get(id);
        StringBuilder sb = new StringBuilder("﻿"); // BOM : Excel lit l'UTF-8 correctement
        sb.append("Bordereau;").append(cell(d.list().number())).append('\n');
        sb.append("Type;").append(d.list().kind().equals("ELIMINATION") ? "Élimination" : "Versement").append('\n');
        sb.append("Intitulé;").append(cell(d.list().title())).append('\n');
        if (d.list().destination() != null) sb.append("Destinataire;").append(cell(d.list().destination())).append('\n');
        sb.append("Statut;").append(d.list().status()).append('\n');
        sb.append("Préparé par;").append(cell(d.list().createdBy())).append('\n');
        if (d.list().decidedBy() != null) sb.append("Visé par;").append(cell(d.list().decidedBy())).append('\n');
        if (d.executedBy() != null) sb.append("Exécuté par;").append(cell(d.executedBy())).append(';')
                .append(d.list().executedAt()).append('\n');
        sb.append('\n');
        sb.append("Cote;Titre;Type;Date du document;Échéance;Règle;Versions;Octets;Statut actuel;Original papier\n");
        for (ListItem i : d.items()) {
            sb.append(cell(i.reference())).append(';').append(cell(i.title())).append(';').append(cell(i.typeName()))
                    .append(';').append(i.documentDate() == null ? "" : i.documentDate()).append(';')
                    .append(i.retentionUntil() == null ? "" : i.retentionUntil()).append(';').append(cell(i.ruleName()))
                    .append(';').append(i.versionCount()).append(';').append(i.bytes()).append(';')
                    .append(i.currentStatus()).append(';').append(cell(i.paperLocation())).append('\n');
        }
        return sb.toString().getBytes(StandardCharsets.UTF_8);
    }

    @Transactional
    public Package prepare(UUID id) {
        CurrentUser user = support.requireAny(MANAGE, APPROVE);
        ListDetail d = lists.get(id);
        if (!d.list().kind().equals("VERSEMENT")) throw ApiException.badRequest("NOT_TRANSFER", "Paquet réservé aux versements");
        if (!List.of("APPROUVE", "EXECUTE").contains(d.list().status())) {
            throw ApiException.conflict("NOT_APPROVED", "Le paquet de versement n'est disponible qu'une fois le bordereau visé");
        }
        List<Entry> files = new ArrayList<>();
        List<Map<String, Object>> documents = new ArrayList<>();
        for (ListItem item : d.items()) {
            String folder = "documents/" + safe(item.reference() == null ? item.documentId().toString() : item.reference());
            Map<String, Object> doc = new LinkedHashMap<>();
            Map<String, Object> row = jdbc.queryForMap("SELECT metadata::text AS metadata FROM documents WHERE id = :id",
                    params("id", item.documentId()));
            doc.put("reference", item.reference());
            doc.put("titre", item.title());
            doc.put("type", item.typeName());
            doc.put("dateDocument", item.documentDate());
            doc.put("echeance", item.retentionUntil());
            doc.put("regle", item.ruleName());
            doc.put("metadonnees", json.readMap((String) row.get("metadata")));
            List<Map<String, Object>> versions = new ArrayList<>();
            jdbc.query("""
                    SELECT version_no, filename, mime_type, size_bytes, sha256, storage_key, created_at
                    FROM document_versions WHERE document_id = :id ORDER BY version_no""",
                    params("id", item.documentId()), rs -> {
                        String path = folder + "/v" + rs.getInt("version_no") + "_" + safe(rs.getString("filename"));
                        files.add(new Entry(path, rs.getString("storage_key")));
                        Map<String, Object> v = new LinkedHashMap<>();
                        v.put("version", rs.getInt("version_no"));
                        v.put("fichier", path);
                        v.put("nomOrigine", rs.getString("filename"));
                        v.put("format", rs.getString("mime_type"));
                        v.put("octets", rs.getLong("size_bytes"));
                        v.put("sha256", rs.getString("sha256"));
                        v.put("deposeLe", rs.getTimestamp("created_at").toInstant().toString());
                        versions.add(v);
                    });
            doc.put("versions", versions);
            documents.add(doc);
        }
        Map<String, Object> manifest = new LinkedHashMap<>();
        Map<String, Object> head = new LinkedHashMap<>();
        head.put("numero", d.list().number());
        head.put("intitule", d.list().title());
        head.put("destinataire", d.list().destination());
        head.put("statut", d.list().status());
        head.put("preparePar", d.list().createdBy());
        head.put("visePar", d.list().decidedBy());
        head.put("viseLe", d.list().decidedAt() == null ? null : d.list().decidedAt().toString());
        head.put("genereLe", Instant.now().toString());
        manifest.put("bordereau", head);
        manifest.put("documents", documents);
        audit.log(user.organizationId(), user.id(), "VERSEMENT_EXPORTE", "disposal_list", id.toString(),
                Map.of("number", d.list().number(), "fichiers", files.size()), null);
        return new Package(d.list().number() + ".zip", json.write(manifest).getBytes(StandardCharsets.UTF_8), files);
    }

    /** Écrit le paquet en flux : les fichiers ne passent jamais entièrement en mémoire. */
    public void write(Package pkg, OutputStream out) throws IOException {
        try (ZipOutputStream zip = new ZipOutputStream(out, StandardCharsets.UTF_8)) {
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(pkg.manifest());
            zip.closeEntry();
            for (Entry e : pkg.files()) {
                zip.putNextEntry(new ZipEntry(e.path()));
                try (InputStream in = storage.load(e.storageKey()).getInputStream()) {
                    in.transferTo(zip);
                }
                zip.closeEntry();
            }
        }
    }

    private static String cell(String value) {
        if (value == null) return "";
        // Neutralise les formules (=, +, -, @) qu'un tableur exécuterait à l'ouverture
        String v = (value.matches("^[=+\\-@\\t\\r].*") ? "'" + value : value).replace("\"", "\"\"");
        return v.contains(";") || v.contains("\n") || v.contains("\"") ? "\"" + v + "\"" : v;
    }

    private static String safe(String name) {
        return name.replaceAll("[^\\p{L}\\p{N}._-]+", "_");
    }
}
