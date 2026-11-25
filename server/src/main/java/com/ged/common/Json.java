package com.ged.common;

import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

/** Conversion entre colonnes jsonb (stockées en texte côté entité) et objets Java. */
@Component
public class Json {

    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> LIST_OF_MAPS = new TypeReference<>() {};

    private final JsonMapper mapper;

    public Json(JsonMapper mapper) {
        this.mapper = mapper;
    }

    public String write(Object value) {
        return mapper.writeValueAsString(value);
    }

    public Map<String, Object> readMap(String json) {
        return json == null || json.isBlank() ? Map.of() : mapper.readValue(json, MAP);
    }

    public List<Map<String, Object>> readListOfMaps(String json) {
        return json == null || json.isBlank() ? List.of() : mapper.readValue(json, LIST_OF_MAPS);
    }
}
