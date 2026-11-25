package com.ged.ocr;

import java.awt.image.BufferedImage;
import java.io.IOException;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Set;
import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.stream.ImageOutputStream;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.io.IOUtils;
import org.apache.pdfbox.multipdf.LayerUtility;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.encryption.InvalidPasswordException;
import org.apache.pdfbox.pdmodel.graphics.form.PDFormXObject;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.util.Matrix;
import org.springframework.stereotype.Component;
import org.w3c.dom.Element;

/**
 * Extraction du texte d'un fichier, page par page.
 * <ul>
 *   <li>PDF : le texte présent dans le fichier est repris tel quel ; seules les pages sans texte
 *       (scans) passent par la reconnaissance. Une copie du PDF reçoit le texte reconnu en couche
 *       invisible : même aspect, mais la recherche et la copie fonctionnent dans la visionneuse.</li>
 *   <li>Image (PNG, JPEG, TIFF…) : reconnaissance, et copie PDF (image + texte invisible).</li>
 *   <li>Texte brut : repris tel quel.</li>
 * </ul>
 * Le fichier d'origine n'est jamais modifié.
 */
@Component
public class TextExtractor {

    public static final Set<String> IMAGE_TYPES = Set.of("image/png", "image/jpeg", "image/tiff", "image/webp",
            "image/gif", "image/bmp");
    public static final Set<String> SUPPORTED;

    static {
        var s = new java.util.HashSet<>(IMAGE_TYPES);
        s.add("application/pdf");
        s.add("text/plain");
        SUPPORTED = Set.copyOf(s);
    }

    /** Une page « a du texte » à partir de 20 lettres ou chiffres ; en dessous, on la considère scannée. */
    private static final int MIN_NATIVE_CHARS = 20;
    private static final int MAX_PAGE_CHARS = 200_000;
    private static final long MAX_TEXT_BYTES = 5L * 1024 * 1024;
    /** Une page très grande (plan, affiche) est rendue moins finement : 50 millions de pixels au plus */
    private static final double MAX_PIXELS = 50e6;

    public enum Method { NATIF, OCR, MIXTE }

    /**
     * @param pages         texte de chaque page
     * @param confidence    lisibilité moyenne des pages reconnues (null si aucune page reconnue)
     * @param searchablePdf copie consultable, ou null si inutile (le fichier contient déjà son texte)
     */
    public record Extraction(List<String> pages, Method method, Double confidence, Path searchablePdf) {}

    public interface Progress {
        void update(int done, int total);
    }

    public record Options(List<String> languages, boolean orientation) {}

    /** Erreur compréhensible par l'utilisateur (affichée telle quelle). */
    public static class ExtractionException extends IOException {
        public ExtractionException(String message) {
            super(message);
        }
    }

    private final Tesseract tesseract;
    private final OcrProperties props;

    public TextExtractor(Tesseract tesseract, OcrProperties props) {
        this.tesseract = tesseract;
        this.props = props;
    }

    public Extraction extract(Path file, String mime, Options options, Path work, Progress progress) throws IOException {
        if ("application/pdf".equals(mime)) return pdf(file, options, work, progress);
        if ("text/plain".equals(mime)) return plain(file);
        if (IMAGE_TYPES.contains(mime)) return image(file, options, work, progress);
        throw new ExtractionException("Format non pris en charge");
    }

    // ───────── PDF ─────────

    private Extraction pdf(Path file, Options options, Path work, Progress progress) throws IOException {
        PDDocument pdf;
        try {
            pdf = Loader.loadPDF(file.toFile(), "", null, null, IOUtils.createTempFileOnlyStreamCache());
        } catch (InvalidPasswordException e) {
            throw new ExtractionException("PDF protégé par un mot de passe : son contenu ne peut pas être lu");
        } catch (IOException e) {
            throw new ExtractionException("Fichier PDF illisible ou abîmé");
        }
        List<PDDocument> layers = new ArrayList<>();
        try (pdf) {
            int total = pdf.getNumberOfPages();
            if (total > props.maxPages()) {
                throw new ExtractionException("Document trop long : " + total + " pages (limite : " + props.maxPages() + ")");
            }
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            PDFRenderer renderer = new PDFRenderer(pdf);
            List<String> pages = new ArrayList<>(total);
            Path[] textLayers = new Path[total];
            int recognized = 0;
            int nativePages = 0;
            double weighted = 0;
            int weight = 0;

            for (int i = 0; i < total; i++) {
                stripper.setStartPage(i + 1);
                stripper.setEndPage(i + 1);
                String text = clean(stripper.getText(pdf));
                if (meaningful(text)) {
                    pages.add(text);
                    nativePages++;
                } else {
                    requireEngine();
                    Path jpg = work.resolve("page-" + (i + 1) + ".jpg");
                    PDRectangle box = pdf.getPage(i).getCropBox();
                    int dpi = dpiFor(box);
                    BufferedImage img = renderer.renderImageWithDPI(i, dpi, ImageType.RGB);
                    writeJpeg(img, jpg, dpi);
                    img.flush();
                    Tesseract.Output out = tesseract.run(jpg, work, "page-" + (i + 1), options.languages(),
                            options.orientation(), pdf.isEncrypted() ? Tesseract.PdfOutput.NONE : Tesseract.PdfOutput.TEXT_ONLY,
                            props.pageTimeout());
                    Files.deleteIfExists(jpg);
                    String recognizedText = out.text().pages().isEmpty() ? "" : clean(out.text().pages().get(0));
                    pages.add(recognizedText);
                    textLayers[i] = out.pdf();
                    recognized++;
                    if (out.text().confidence() != null) {
                        weighted += out.text().confidence() * Math.max(1, recognizedText.length());
                        weight += Math.max(1, recognizedText.length());
                    }
                }
                progress.update(i + 1, total);
            }

            Path copy = null;
            if (recognized > 0 && !pdf.isEncrypted()) {
                for (int i = 0; i < total; i++) {
                    if (textLayers[i] == null) continue;
                    PDDocument layer = Loader.loadPDF(textLayers[i].toFile());
                    layers.add(layer);
                    overlay(pdf, pdf.getPage(i), layer);
                }
                copy = work.resolve("texte-reconnu.pdf");
                pdf.save(copy.toFile());
            }
            Method method = recognized == 0 ? Method.NATIF : nativePages == 0 ? Method.OCR : Method.MIXTE;
            return new Extraction(pages, method, weight == 0 ? null : weighted / weight, copy);
        } finally {
            for (PDDocument l : layers) l.close();
        }
    }

    /**
     * Pose la page de texte invisible produite par Tesseract sur la page d'origine. Tesseract a lu la page
     * telle qu'elle s'affiche (rotation comprise) : on ramène ses coordonnées dans le repère de la page.
     */
    static void overlay(PDDocument target, PDPage page, PDDocument layer) throws IOException {
        PDFormXObject form = new LayerUtility(target).importPageAsForm(layer, 0);
        PDRectangle src = layer.getPage(0).getMediaBox();
        try (PDPageContentStream cs = new PDPageContentStream(target, page, PDPageContentStream.AppendMode.APPEND,
                true, true)) {
            cs.saveGraphicsState();
            cs.transform(layerMatrix(page.getCropBox(), page.getRotation(), src.getWidth(), src.getHeight()));
            cs.drawForm(form);
            cs.restoreGraphicsState();
        }
    }

    /**
     * Matrice qui envoie le repère de la page affichée (largeur w2 × hauteur h2, origine en bas à gauche)
     * dans le repère de la page PDF (zone visible {@code crop}, tournée de {@code rotation} degrés à l'affichage).
     */
    static Matrix layerMatrix(PDRectangle crop, int rotation, float w2, float h2) {
        float x0 = crop.getLowerLeftX();
        float y0 = crop.getLowerLeftY();
        float w = crop.getWidth();
        float h = crop.getHeight();
        int r = ((rotation % 360) + 360) % 360;
        boolean quarter = r == 90 || r == 270;
        float sx = (quarter ? h : w) / w2;
        float sy = (quarter ? w : h) / h2;
        // (u, v) : point de la page affichée ; x = a·u + c·v + e ; y = b·u + d·v + f
        float a, b, c, d, e, f;
        switch (r) {
            case 90 -> { a = 0; b = 1; c = -1; d = 0; e = x0 + w; f = y0; }
            case 180 -> { a = -1; b = 0; c = 0; d = -1; e = x0 + w; f = y0 + h; }
            case 270 -> { a = 0; b = -1; c = 1; d = 0; e = x0; f = y0 + h; }
            default -> { a = 1; b = 0; c = 0; d = 1; e = x0; f = y0; }
        }
        return new Matrix(a * sx, b * sx, c * sy, d * sy, e, f);
    }

    private int dpiFor(PDRectangle box) {
        double inches = (box.getWidth() / 72.0) * (box.getHeight() / 72.0);
        int dpi = props.dpi();
        if (inches > 0 && inches * dpi * dpi > MAX_PIXELS) dpi = (int) Math.max(72, Math.sqrt(MAX_PIXELS / inches));
        return dpi;
    }

    // ───────── Images ─────────

    private Extraction image(Path file, Options options, Path work, Progress progress) throws IOException {
        requireEngine();
        progress.update(0, 1);
        Tesseract.Output out = tesseract.run(file, work, "image", options.languages(), options.orientation(),
                Tesseract.PdfOutput.FULL, props.pageTimeout().multipliedBy(4));
        List<String> pages = out.text().pages().stream().map(TextExtractor::clean).toList();
        if (pages.isEmpty()) pages = List.of("");
        if (pages.size() > props.maxPages()) {
            throw new ExtractionException("Document trop long : " + pages.size() + " pages (limite : " + props.maxPages() + ")");
        }
        progress.update(pages.size(), pages.size());
        return new Extraction(pages, Method.OCR, out.text().confidence(), out.pdf());
    }

    // ───────── Texte brut ─────────

    private static Extraction plain(Path file) throws IOException {
        if (Files.size(file) > MAX_TEXT_BYTES) throw new ExtractionException("Fichier texte trop volumineux");
        byte[] bytes = Files.readAllBytes(file);
        String text;
        try {
            text = StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT)
                    .decode(java.nio.ByteBuffer.wrap(bytes)).toString();
        } catch (CharacterCodingException e) {
            text = new String(bytes, StandardCharsets.ISO_8859_1);
        }
        return new Extraction(List.of(clean(text)), Method.NATIF, null, null);
    }

    // ───────── Outils ─────────

    private void requireEngine() throws ExtractionException {
        if (!tesseract.available()) {
            throw new ExtractionException("Moteur de reconnaissance indisponible sur le serveur");
        }
    }

    static boolean meaningful(String text) {
        int n = 0;
        for (int i = 0; i < text.length() && n < MIN_NATIVE_CHARS; i++) {
            if (Character.isLetterOrDigit(text.charAt(i))) n++;
        }
        return n >= MIN_NATIVE_CHARS;
    }

    /** Retire les caractères de contrôle, normalise les fins de ligne, limite les lignes vides. */
    static String clean(String text) {
        if (text == null) return "";
        String s = text.replace("\r\n", "\n").replace('\r', '\n')
                .replaceAll("[\\p{Cntrl}&&[^\n\t]]", "")
                .replaceAll("[ \t]+\n", "\n")
                .replaceAll("\n{3,}", "\n\n")
                .strip();
        return s.length() > MAX_PAGE_CHARS ? s.substring(0, MAX_PAGE_CHARS) : s;
    }

    /** JPEG avec sa résolution inscrite (JFIF) : Tesseract en déduit la taille réelle de la page. */
    private static void writeJpeg(BufferedImage img, Path out, int dpi) throws IOException {
        Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) throw new IOException("Encodeur JPEG absent");
        ImageWriter writer = writers.next();
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out.toFile())) {
            writer.setOutput(ios);
            ImageWriteParam param = writer.getDefaultWriteParam();
            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            param.setCompressionQuality(0.85f);
            IIOMetadata meta = writer.getDefaultImageMetadata(ImageTypeSpecifier.createFromRenderedImage(img), param);
            try {
                Element tree = (Element) meta.getAsTree("javax_imageio_jpeg_image_1.0");
                Element jfif = (Element) tree.getElementsByTagName("app0JFIF").item(0);
                if (jfif != null) {
                    jfif.setAttribute("resUnits", "1");
                    jfif.setAttribute("Xdensity", String.valueOf(dpi));
                    jfif.setAttribute("Ydensity", String.valueOf(dpi));
                    meta.setFromTree("javax_imageio_jpeg_image_1.0", tree);
                }
            } catch (RuntimeException ignored) {
                // Résolution non inscrite : Tesseract utilise --dpi
            }
            writer.write(null, new IIOImage(img, null, meta), param);
        } finally {
            writer.dispose();
        }
    }
}
