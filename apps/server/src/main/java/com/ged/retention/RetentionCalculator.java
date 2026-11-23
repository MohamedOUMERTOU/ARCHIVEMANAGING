package com.ged.retention;

import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;

/** Date de fin de conservation (DUA) d'un document. */
public final class RetentionCalculator {

    private RetentionCalculator() {}

    /**
     * La durée court jusqu'au 31 décembre de l'année d'échéance, comme le veut l'usage archivistique.
     *
     * @return null si la conservation est illimitée ou si le point de départ n'est pas encore connu
     *         (dossier pas encore clos, document sans date)
     */
    public static LocalDate retentionUntil(RetentionRule rule, LocalDate documentDate, LocalDate folderClosedAt,
                                           LocalDate createdAt) {
        if (rule == null || rule.getDurationYears() == null) return null;
        LocalDate start = switch (rule.getStartEvent()) {
            case DATE_DOCUMENT -> documentDate;
            case CLOTURE_DOSSIER -> folderClosedAt;
            case DATE_CREATION -> createdAt;
        };
        if (start == null) return null;
        return start.plusYears(rule.getDurationYears()).with(TemporalAdjusters.lastDayOfYear());
    }
}
