package com.ged.settings;

import static org.assertj.core.api.Assertions.assertThat;

import com.ged.settings.FieldSchema.Field;
import java.util.List;
import org.junit.jupiter.api.Test;

class FieldSchemaTest {

    @Test
    void accepteUnSchemaValideEtLeNormalise() {
        var fields = List.of(
                new Field("fournisseur", " Fournisseur ", "TEXT", true, null),
                new Field("devise", "Devise", "LIST", false, List.of("MAD", " EUR ", "", "MAD")));
        assertThat(FieldSchema.validate(fields)).isEmpty();
        var stored = FieldSchema.normalize(fields);
        assertThat(stored.get(0)).containsEntry("label", "Fournisseur").doesNotContainKey("options");
        assertThat(stored.get(1).get("options")).isEqualTo(List.of("MAD", "EUR"));
    }

    @Test
    void signaleChaqueErreurParPosition() {
        var errors = FieldSchema.validate(List.of(
                new Field("numero", "N°", "TEXT", true, null),
                new Field("numero", "", "COULEUR", false, null),
                new Field("Mauvaise Clé", "Liste", "LIST", false, List.of(" "))));
        assertThat(errors).containsOnlyKeys("fields[1].key", "fields[1].label", "fields[1].type",
                "fields[2].key", "fields[2].options");
    }
}
