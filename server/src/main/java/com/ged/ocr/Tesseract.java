package com.ged.ocr;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Appel du programme Tesseract (installé dans l'image Docker du serveur). Aucune commande shell :
 * les arguments sont passés tels quels, le fichier lu est toujours une copie dans un dossier temporaire.
 */
@Component
public class Tesseract {

    private static final Logger log = LoggerFactory.getLogger(Tesseract.class);

    /** Langues proposées dans le paramétrage (codes Tesseract) ; installées dans l'image Docker. */
    public static final List<String> LANGUAGES = List.of("fra", "ara", "eng");

    public enum PdfOutput {
        /** Texte seul */
        NONE,
        /** PDF ne contenant que le texte, invisible : posé ensuite sur la page d'origine */
        TEXT_ONLY,
        /** PDF image + texte invisible : copie consultable d'une image */
        FULL
    }

    public record Output(TesseractTsv.Result text, Path pdf) {}

    private final OcrProperties props;
    private volatile Boolean available;

    public Tesseract(OcrProperties props) {
        this.props = props;
    }

    /** Vrai si le programme répond (vérifié une fois, puis mémorisé tant qu'il répond). */
    public boolean available() {
        Boolean a = available;
        if (a != null && a) return true;
        try {
            Process p = new ProcessBuilder(props.tesseract(), "--version").redirectErrorStream(true).start();
            p.getInputStream().readAllBytes();
            a = p.waitFor(20, TimeUnit.SECONDS) && p.exitValue() == 0;
        } catch (IOException e) {
            a = false;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            a = false;
        }
        if (!a) log.warn("Tesseract introuvable (commande « {} ») : les documents scannés ne peuvent pas être lus", props.tesseract());
        available = a;
        return a;
    }

    /**
     * @param image       image à lire (PNG, JPEG, TIFF multipage…)
     * @param workDir     dossier temporaire du traitement
     * @param orientation détecter les pages tournées (mode de découpage 1, avec détection d'orientation)
     */
    public Output run(Path image, Path workDir, String name, List<String> languages, boolean orientation,
                      PdfOutput pdf, Duration timeout) throws IOException {
        Path base = workDir.resolve(name);
        List<String> cmd = new ArrayList<>(List.of(props.tesseract(), image.toString(), base.toString(),
                "-l", String.join("+", languages), "--dpi", String.valueOf(props.dpi()),
                "--psm", orientation ? "1" : "3"));
        if (pdf == PdfOutput.TEXT_ONLY) cmd.addAll(List.of("-c", "textonly_pdf=1"));
        cmd.add("tsv");
        if (pdf != PdfOutput.NONE) cmd.add("pdf");

        Path err = workDir.resolve(name + ".log");
        ProcessBuilder pb = new ProcessBuilder(cmd).redirectErrorStream(true).redirectOutput(err.toFile());
        // Un seul cœur par page : les traitements parallèles ne se gênent pas
        pb.environment().put("OMP_THREAD_LIMIT", "1");
        Process p = pb.start();
        try {
            if (!p.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS)) {
                p.destroyForcibly();
                throw new IOException("Reconnaissance trop longue (plus de " + timeout.toMinutes() + " min pour une page)");
            }
        } catch (InterruptedException e) {
            p.destroyForcibly();
            Thread.currentThread().interrupt();
            throw new IOException("Traitement interrompu", e);
        }
        Path tsv = Path.of(base + ".tsv");
        if (p.exitValue() != 0 || !Files.exists(tsv)) {
            String detail = Files.exists(err) ? Files.readString(err, StandardCharsets.UTF_8).strip() : "";
            log.warn("Tesseract a échoué ({}) : {}", p.exitValue(), detail);
            throw new IOException("Le moteur de reconnaissance n'a pas pu lire l'image");
        }
        Path out = Path.of(base + ".pdf");
        return new Output(TesseractTsv.parse(Files.readString(tsv, StandardCharsets.UTF_8)),
                pdf != PdfOutput.NONE && Files.exists(out) ? out : null);
    }
}
