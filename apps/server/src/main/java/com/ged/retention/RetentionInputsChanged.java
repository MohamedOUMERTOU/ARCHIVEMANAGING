package com.ged.retention;

import java.util.UUID;

/**
 * Une donnée qui détermine les échéances a changé (règle de conservation, règle d'un nœud ou d'un type,
 * clôture ou déplacement d'un dossier) : les échéances des documents de la société sont recalculées
 * dans la même transaction.
 */
public record RetentionInputsChanged(UUID organizationId, String cause) {}
