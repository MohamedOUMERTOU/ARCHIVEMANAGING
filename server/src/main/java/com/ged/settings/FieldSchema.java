package com.ged.settings;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

/** Définition des champs de métadonnées d'un type de document : validation et normalisation. */
public final class FieldSchema {

    private FieldSchema() {}

    public static final Set<String> TYPES = Set.of("TEXT", "NUMBER", "AMOUNT", "DATE", "LIST", "BOOLEAN");
    private static final Pattern KEY = Pattern.compile("^[a-z][a-z0-9_]{0,39}$");

    public record Field(String key, String label, String type, boolean required, List<String> options) {}

    /** Erreurs par position : { "fields[2].key": "Clé déjà utilisée" }. */
    public static Map<String, String> validate(List<Field> fields) {
        Map<String, String> errors = new LinkedHashMap<>();
        if (fields.size() > 50) errors.put("fields", "50 champs au maximum");
        Set<String> keys = new HashSet<>();
        for (int i = 0; i < fields.size(); i++) {
            Field f = fields.get(i);
            String p = "fields[" + i + "].";
            if (f.label() == null || f.label().isBlank()) errors.put(p + "label", "Libellé obligatoire");
            if (f.key() == null || !KEY.matcher(f.key()).matches()) {
                errors.put(p + "key", "Clé en minuscules, chiffres et _ (ex. numero_facture)");
            } else if (!keys.add(f.key())) {
                errors.put(p + "key", "Clé déjà utilisée par un autre champ");
            }
            if (f.type() == null || !TYPES.contains(f.type())) errors.put(p + "type", "Type de champ inconnu");
            if ("LIST".equals(f.type()) && (f.options() == null || f.options().stream().noneMatch(o -> o != null && !o.isBlank()))) {
                errors.put(p + "options", "Une liste demande au moins une valeur");
            }
        }
        return errors;
    }

    /** Forme stockée en JSON (options seulement pour les listes, valeurs nettoyées). */
    public static List<Map<String, Object>> normalize(List<Field> fields) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Field f : fields) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("key", f.key());
            m.put("label", f.label().trim());
            m.put("type", f.type());
            m.put("required", f.required());
            if ("LIST".equals(f.type())) {
                m.put("options", f.options().stream().filter(o -> o != null && !o.isBlank()).map(String::trim).distinct().toList());
            }
            out.add(m);
        }
        return out;
    }
}
