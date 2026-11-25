package com.ged.audit;

import com.ged.common.Json;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditService {

    private final AuditLogRepository repository;
    private final JdbcTemplate jdbc;
    private final Json json;

    public AuditService(AuditLogRepository repository, JdbcTemplate jdbc, Json json) {
        this.repository = repository;
        this.jdbc = jdbc;
        this.json = json;
    }

    /**
     * Ajoute une entrée au journal. S'exécute dans la transaction de l'appelant :
     * si l'action échoue, l'entrée disparaît avec elle.
     */
    @Transactional(propagation = Propagation.REQUIRED)
    public void log(UUID organizationId, UUID userId, String action, String entity, String entityId,
                    Map<String, Object> details, String ip) {
        // Verrou par société jusqu'à la fin de la transaction : deux écritures ne prennent pas le même « précédent »
        String chainKey = organizationId == null ? "platform" : organizationId.toString();
        jdbc.queryForList("SELECT pg_advisory_xact_lock(hashtext(?))", chainKey);

        String prevHash = (organizationId == null
                        ? repository.findFirstByOrganizationIdIsNullOrderByIdDesc()
                        : repository.findFirstByOrganizationIdOrderByIdDesc(organizationId))
                .map(AuditLog::getHash)
                .orElse(null);

        // PostgreSQL garde les microsecondes : on tronque avant de calculer l'empreinte
        var entry = new AuditHasher.Entry(organizationId, userId, action, entity, entityId,
                details == null ? Map.of() : details, ip, Instant.now().truncatedTo(ChronoUnit.MICROS));
        repository.save(new AuditLog(entry, json.write(entry.details()), prevHash, AuditHasher.hash(prevHash, entry)));
    }

    @Transactional(readOnly = true)
    public List<AuditEntryDto> list(UUID organizationId, Long before, int size) {
        List<AuditLog> rows = repository.page(organizationId, before, PageRequest.of(0, Math.min(Math.max(size, 1), 500)));
        Map<UUID, String> names = new java.util.HashMap<>();
        List<UUID> ids = rows.stream().map(AuditLog::getUserId).filter(java.util.Objects::nonNull).distinct().toList();
        if (!ids.isEmpty()) {
            jdbc.query("SELECT id, full_name FROM users WHERE id = ANY(?)",
                    ps -> ps.setArray(1, ps.getConnection().createArrayOf("uuid", ids.toArray())),
                    rs -> { names.put(rs.getObject("id", UUID.class), rs.getString("full_name")); });
        }
        return rows.stream()
                .map(a -> new AuditEntryDto(a.getId(), a.getUserId(), names.get(a.getUserId()), a.getAction(),
                        a.getEntity(), a.getEntityId(), json.readMap(a.getDetails()), a.getIp(), a.getAt()))
                .toList();
    }

    /** Recalcule toute la chaîne ; indique la première entrée dont l'empreinte ne correspond plus. */
    @Transactional(readOnly = true)
    public ChainVerification verify(UUID organizationId) {
        List<AuditLog> rows = repository.findByOrganizationIdOrderByIdAsc(organizationId);
        String prev = null;
        for (AuditLog a : rows) {
            var entry = new AuditHasher.Entry(a.getOrganizationId(), a.getUserId(), a.getAction(), a.getEntity(),
                    a.getEntityId(), json.readMap(a.getDetails()), a.getIp(), a.getAt());
            boolean linked = prev == null ? a.getPrevHash() == null : prev.equals(a.getPrevHash());
            if (!linked || !AuditHasher.hash(prev, entry).equals(a.getHash())) {
                return new ChainVerification(rows.size(), false, a.getId());
            }
            prev = a.getHash();
        }
        return new ChainVerification(rows.size(), true, null);
    }

    public record AuditEntryDto(Long id, UUID userId, String userName, String action, String entity, String entityId,
                                Map<String, Object> details, String ip, Instant at) {}

    public record ChainVerification(int entries, boolean valid, Long brokenAt) {}
}
