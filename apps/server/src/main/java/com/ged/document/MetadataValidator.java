package com.ged.document;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Vérifie les métadonnées d'un document d'après les champs définis par son type.
 * Renvoie les erreurs par champ : { "fournisseur": "Champ obligatoire" }.
 */
public final class MetadataValidator {

    private MetadataValidator() {}

    public static Map<String, String> validate(List<Map<String, Object>> schema, Map<String, Object> values) {
        Map<String, String> errors = new LinkedHashMap<>();
        for (Map<String, Object> field : schema) {
            String key = String.valueOf(field.get("key"));
            String type = String.valueOf(field.getOrDefault("type", "TEXT"));
            boolean required = Boolean.TRUE.equals(field.get("required"));
            Object raw = values.get(key);
            String value = raw == null ? "" : raw.toString().trim();

            if (value.isEmpty()) {
                if (required) errors.put("metadata." + key, "Champ obligatoire");
                continue;
            }
            String error = switch (type) {
                case "NUMBER", "AMOUNT" -> isNumber(value) ? null : "Saisissez un nombre";
                case "DATE" -> isDate(value) ? null : "Saisissez une date au format AAAA-MM-JJ";
                case "BOOLEAN" -> raw instanceof Boolean || value.equals("true") || value.equals("false")
                        ? null : "Choisissez oui ou non";
                case "LIST" -> field.get("options") instanceof List<?> options && options.contains(value)
                        ? null : "Choisissez une valeur de la liste";
                default -> value.length() > 500 ? "500 caractères au maximum" : null;
            };
            if (error != null) errors.put("metadata." + key, error);
        }
        return errors;
    }

    private static boolean isNumber(String v) {
        try {
            new BigDecimal(v.replace(',', '.').replace(" ", ""));
            return true;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    private static boolean isDate(String v) {
        try {
            LocalDate.parse(v);
            return true;
        } catch (DateTimeParseException e) {
            return false;
        }
    }
}
