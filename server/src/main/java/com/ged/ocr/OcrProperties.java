package com.ged.ocr;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Réglages techniques de la reconnaissance de texte (préfixe « ged.ocr »). Les choix fonctionnels
 * (langues, traitement au dépôt…) sont dans {@code ocr_settings}, par société.
 *
 * @param enabled       false : aucun traitement n'est lancé (les demandes restent en attente)
 * @param tesseract     commande Tesseract
 * @param dpi           résolution de rendu des pages scannées (300 : bon compromis qualité / vitesse)
 * @param maxPages      au-delà, le document n'est pas traité (protection contre les fichiers démesurés)
 * @param pageTimeout   durée maximale de reconnaissance d'une page
 * @param lowConfidence lisibilité moyenne (en %) sous laquelle le résultat est signalé « peu lisible »
 * @param pollMs        intervalle de recherche de nouvelles demandes
 */
@ConfigurationProperties(prefix = "ged.ocr")
public record OcrProperties(
        @DefaultValue("true") boolean enabled,
        @DefaultValue("tesseract") String tesseract,
        @DefaultValue("300") int dpi,
        @DefaultValue("500") int maxPages,
        @DefaultValue("3m") Duration pageTimeout,
        @DefaultValue("65") int lowConfidence,
        @DefaultValue("5000") long pollMs) {}
