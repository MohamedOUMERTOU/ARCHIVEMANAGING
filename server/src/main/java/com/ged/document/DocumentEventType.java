package com.ged.document;

public enum DocumentEventType {
    CREE,
    CLASSE,
    CONSULTE,
    TELECHARGE,
    COPIE_DEMANDEE,
    COPIE_REMISE,
    ORIGINAL_DEMANDE,
    ORIGINAL_SORTI,
    ORIGINAL_RENDU,
    RECLASSE,
    VERSION_REMPLACEE,
    METADONNEES_MODIFIEES,
    RANGE,
    DEPLACE,
    GEL_POSE,
    GEL_LEVE,
    VERSE,
    /** Échéance recalculée (règle, date du document ou clôture du dossier modifiées) */
    ECHEANCE_RECALCULEE,
    /** Inscrit sur un bordereau soumis au visa */
    SORT_PROPOSE,
    /** Bordereau refusé ou annulé : le document reprend son statut */
    SORT_ABANDONNE,
    /** Sort final « conserver » : passage en conservation définitive */
    CONSERVATION_DEFINITIVE,
    ELIMINE
}
