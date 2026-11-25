package com.ged.ocr;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.awt.geom.Point2D;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.util.Matrix;
import org.junit.jupiter.api.Test;

/** Règles pures de la lecture du texte : aucune base, aucun Tesseract. */
class OcrTextTest {

    private static String row(int page, int block, int par, int line, int word, String conf, String text) {
        return String.join("\t", "5", String.valueOf(page), String.valueOf(block), String.valueOf(par),
                String.valueOf(line), String.valueOf(word), "10", "10", "50", "20", conf, text);
    }

    @Test
    void reconstitueLignesEtParagraphes() {
        String tsv = String.join("\n",
                "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
                "1\t1\t0\t0\t0\t0\t0\t0\t2480\t3508\t-1\t",
                row(1, 1, 1, 1, 1, "96", "PROCES-VERBAL"),
                row(1, 1, 1, 1, 2, "94", "DE"),
                row(1, 1, 1, 2, 1, "90", "RECEPTION"),
                row(1, 2, 1, 1, 1, "40", "Signé"),
                row(2, 1, 1, 1, 1, "80", "Annexe"));

        TesseractTsv.Result r = TesseractTsv.parse(tsv);

        assertThat(r.pages()).containsExactly("PROCES-VERBAL DE\nRECEPTION\n\nSigné", "Annexe");
        assertThat(r.words()).isEqualTo(5);
        // Pondéré par la longueur des mots : un mot court peu lisible pèse peu
        double expected = (96 * 13 + 94 * 2 + 90 * 9 + 40 * 5 + 80 * 6) / 35.0;
        assertThat(r.confidence()).isCloseTo(expected, within(0.001));
    }

    @Test
    void pageSansMot() {
        TesseractTsv.Result r = TesseractTsv.parse("level\tpage_num\n1\t1\t0\t0\t0\t0\t0\t0\t10\t10\t-1\t\n");
        assertThat(r.pages()).isEmpty();
        assertThat(r.confidence()).isNull();
    }

    @Test
    void nettoieLeTexte() {
        assertThat(TextExtractor.clean("a\u0002b\r\n\r\n\r\n\r\nc  \nd\u0000")).isEqualTo("ab\n\nc\nd");
        assertThat(TextExtractor.meaningful("   12 .. ")).isFalse();
        assertThat(TextExtractor.meaningful("Facture n° 2025-0412 du 31 mars")).isTrue();
    }

    /** Coin bas-gauche et coin haut-droit de la page affichée, ramenés dans le repère du PDF. */
    private static Point2D[] corners(int rotation, PDRectangle crop, float w2, float h2) {
        Matrix m = TextExtractor.layerMatrix(crop, rotation, w2, h2);
        return new Point2D[] {m.transformPoint(0, 0), m.transformPoint(w2, h2)};
    }

    @Test
    void coucheDeTexteSurUnePageDroite() {
        Point2D[] c = corners(0, new PDRectangle(0, 0, 595, 842), 2480, 3508);
        assertThat(c[0].getX()).isCloseTo(0, within(0.01));
        assertThat(c[0].getY()).isCloseTo(0, within(0.01));
        assertThat(c[1].getX()).isCloseTo(595, within(0.01));
        assertThat(c[1].getY()).isCloseTo(842, within(0.01));
    }

    @Test
    void coucheDeTexteSurUnePageTournee() {
        // Page A4 portrait tournée de 90° : elle s'affiche en paysage (842 × 595)
        PDRectangle crop = new PDRectangle(10, 20, 595, 842);
        // Tournée dans le sens horaire : le coin bas-droit de la page devient le bas-gauche affiché
        Point2D[] c90 = corners(90, crop, 842, 595);
        assertThat(c90[0].getX()).isCloseTo(10 + 595, within(0.01));
        assertThat(c90[0].getY()).isCloseTo(20, within(0.01));
        assertThat(c90[1].getX()).isCloseTo(10, within(0.01));
        assertThat(c90[1].getY()).isCloseTo(20 + 842, within(0.01));

        Point2D[] c180 = corners(180, crop, 595, 842);
        assertThat(c180[0].getX()).isCloseTo(10 + 595, within(0.01));
        assertThat(c180[0].getY()).isCloseTo(20 + 842, within(0.01));

        Point2D[] c270 = corners(270, crop, 842, 595);
        assertThat(c270[0].getX()).isCloseTo(10, within(0.01));
        assertThat(c270[0].getY()).isCloseTo(20 + 842, within(0.01));
        assertThat(c270[1].getX()).isCloseTo(10 + 595, within(0.01));
        assertThat(c270[1].getY()).isCloseTo(20, within(0.01));
    }
}
