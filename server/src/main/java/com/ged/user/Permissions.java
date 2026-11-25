package com.ged.user;

import java.util.LinkedHashMap;
import java.util.Map;

/** Catalogue des permissions générales qu'un rôle peut recevoir. */
public final class Permissions {

    private Permissions() {}

    public static final String ALL = "*";
    public static final String SETTINGS = "settings.manage";
    public static final String LIFECYCLE_MANAGE = "lifecycle.manage";
    public static final String LIFECYCLE_APPROVE = "lifecycle.approve";

    /** Code → libellé, dans l'ordre d'affichage. */
    public static final Map<String, String> CATALOG;

    static {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(ALL, "Tous les droits (administrateur)");
        m.put(SETTINGS, "Modifier le paramétrage (types, règles, tags, utilisateurs)");
        m.put("classification.manage", "Gérer le plan de classement");
        m.put("documents.write", "Déposer, classer et modifier des documents");
        m.put("documents.reclassify", "Reclasser des documents et voir tous les documents à classer");
        m.put("audit.read", "Consulter le journal d'audit");
        m.put("physical.manage", "Gérer les archives physiques");
        m.put(LIFECYCLE_MANAGE, "Préparer les éliminations et versements, poser et lever les gels juridiques");
        m.put(LIFECYCLE_APPROVE, "Viser les bordereaux d'élimination et de versement, poser et lever les gels juridiques");
        CATALOG = java.util.Collections.unmodifiableMap(m);
    }
}
