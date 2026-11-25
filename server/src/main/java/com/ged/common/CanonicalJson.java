package com.ged.common;

import java.util.Collection;
import java.util.Map;
import java.util.TreeMap;

/**
 * JSON avec les clés triées : une même donnée donne toujours le même texte,
 * donc la même empreinte. Gère les types issus d'un JSON (Map, liste, texte, nombre, booléen, null).
 */
public final class CanonicalJson {

    private CanonicalJson() {}

    public static String write(Object value) {
        StringBuilder sb = new StringBuilder();
        append(sb, value);
        return sb.toString();
    }

    private static void append(StringBuilder sb, Object value) {
        if (value == null) {
            sb.append("null");
        } else if (value instanceof Map<?, ?> map) {
            TreeMap<String, Object> sorted = new TreeMap<>();
            map.forEach((k, v) -> {
                if (v != null) sorted.put(String.valueOf(k), v);
            });
            sb.append('{');
            boolean first = true;
            for (var e : sorted.entrySet()) {
                if (!first) sb.append(',');
                first = false;
                appendString(sb, e.getKey());
                sb.append(':');
                append(sb, e.getValue());
            }
            sb.append('}');
        } else if (value instanceof Collection<?> list) {
            sb.append('[');
            boolean first = true;
            for (Object item : list) {
                if (!first) sb.append(',');
                first = false;
                append(sb, item);
            }
            sb.append(']');
        } else if (value instanceof Number || value instanceof Boolean) {
            sb.append(value);
        } else {
            appendString(sb, value.toString());
        }
    }

    private static void appendString(StringBuilder sb, String s) {
        sb.append('"');
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
                }
            }
        }
        sb.append('"');
    }
}
