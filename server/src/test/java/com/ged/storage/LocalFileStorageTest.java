package com.ged.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.ged.common.ApiException;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class LocalFileStorageTest {

    @TempDir
    Path dir;

    @Test
    void enregistreRelitEtInventorieParSociete() throws Exception {
        LocalFileStorage storage = new LocalFileStorage(dir);
        UUID org = UUID.randomUUID();
        byte[] content = "facture".getBytes(StandardCharsets.UTF_8);

        FileStorage.Stored stored = storage.store(org, new ByteArrayInputStream(content), "application/pdf");
        storage.store(UUID.randomUUID(), new ByteArrayInputStream(new byte[] {1}), null);

        assertThat(stored.key()).startsWith(org + "/");
        assertThat(stored.size()).isEqualTo(content.length);
        assertThat(stored.sha256())
                .isEqualTo(HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content)));
        try (var in = storage.load(stored.key()).getInputStream()) {
            assertThat(in.readAllBytes()).isEqualTo(content);
        }
        // L'inventaire ne voit que la société demandée, sans fichiers temporaires
        assertThat(storage.list(org + "/")).containsExactly(java.util.Map.entry(stored.key(), (long) content.length));
        storage.ping();
    }

    @Test
    void refuseLesClesQuiSortentDuDossier() {
        LocalFileStorage storage = new LocalFileStorage(dir);
        assertThatThrownBy(() -> storage.load("../../etc/passwd")).isInstanceOf(ApiException.class);
        assertThatThrownBy(() -> storage.load(UUID.randomUUID() + "/absent")).isInstanceOf(ApiException.class);
    }
}
