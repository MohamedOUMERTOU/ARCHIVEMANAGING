package com.ged.ocr;

import java.util.ArrayList;
import java.util.List;
import java.util.TreeMap;

/**
 * Lecture de la sortie « tsv » de Tesseract : un mot par ligne, avec sa position dans la page, son
 * paragraphe, sa ligne et sa confiance (0 à 100, -1 pour les lignes qui ne sont pas des mots).
 * On en tire le texte de chaque page (lignes et paragraphes respectés) et la lisibilité moyenne.
 */
public final class TesseractTsv {

    private TesseractTsv() {}

    /**
     * @param pages      texte de chaque page, dans l'ordre (page 1 en premier)
     * @param confidence lisibilité moyenne pondérée par la longueur des mots, null si aucun mot
     */
    public record Result(List<String> pages, Double confidence, int words) {}

    public static Result parse(String tsv) {
        TreeMap<Integer, StringBuilder> pages = new TreeMap<>();
        double weighted = 0;
        long weight = 0;
        int words = 0;
        int lastPage = -1;
        String lastPar = null;
        String lastLine = null;
        for (String row : tsv.split("\r?\n")) {
            String[] c = row.split("\t", 12);
            // level page block par line word left top width height conf text ; level 5 = un mot
            if (c.length < 12 || !"5".equals(c[0])) continue;
            String text = c[11].strip();
            if (text.isEmpty()) continue;
            int page;
            double conf;
            try {
                page = Integer.parseInt(c[1]);
                conf = Double.parseDouble(c[10]);
            } catch (NumberFormatException e) {
                continue;
            }
            StringBuilder sb = pages.computeIfAbsent(page, p -> new StringBuilder());
            String par = c[2] + "/" + c[3];
            String line = par + "/" + c[4];
            if (page == lastPage && !sb.isEmpty()) {
                if (!par.equals(lastPar)) sb.append("\n\n");
                else if (!line.equals(lastLine)) sb.append('\n');
                else sb.append(' ');
            }
            sb.append(text);
            lastPage = page;
            lastPar = par;
            lastLine = line;
            words++;
            if (conf >= 0) {
                weighted += conf * text.length();
                weight += text.length();
            }
        }
        List<String> out = new ArrayList<>();
        if (!pages.isEmpty()) {
            for (int p = 1; p <= pages.lastKey(); p++) {
                StringBuilder sb = pages.get(p);
                out.add(sb == null ? "" : sb.toString());
            }
        }
        return new Result(out, weight == 0 ? null : weighted / weight, words);
    }
}
