package com.ged.document;

public enum DocumentStatus {
    /** Déposé, pas encore classé : visible seulement par son déposant et les archivistes */
    A_CLASSER,
    ACTIVE,
    INTERMEDIAIRE,
    DEFINITIF,
    A_ELIMINER,
    ELIMINE,
    VERSE
}
