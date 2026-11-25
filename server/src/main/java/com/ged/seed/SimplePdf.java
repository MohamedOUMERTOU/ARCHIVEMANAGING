package com.ged.seed;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

/** Génère un PDF d'une page avec quelques lignes de texte (documents de démonstration). */
final class SimplePdf {

    private SimplePdf() {}

    static byte[] page(List<String> lines) {
        StringBuilder content = new StringBuilder("BT /F1 13 Tf 60 770 Td 18 TL\n");
        for (String line : lines) {
            content.append('(').append(escape(line)).append(") Tj T*\n");
        }
        content.append("ET");
        byte[] stream = content.toString().getBytes(StandardCharsets.ISO_8859_1);

        List<String> objects = List.of(
                "<< /Type /Catalog /Pages 2 0 R >>",
                "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
                "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
                "<< /Length " + stream.length + " >>\nstream\n" + new String(stream, StandardCharsets.ISO_8859_1) + "\nendstream",
                "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        List<Integer> offsets = new ArrayList<>();
        write(out, "%PDF-1.4\n");
        for (int i = 0; i < objects.size(); i++) {
            offsets.add(out.size());
            write(out, (i + 1) + " 0 obj\n" + objects.get(i) + "\nendobj\n");
        }
        int xref = out.size();
        StringBuilder table = new StringBuilder("xref\n0 " + (objects.size() + 1) + "\n0000000000 65535 f \n");
        offsets.forEach(o -> table.append("%010d 00000 n \n".formatted(o)));
        write(out, table + "trailer\n<< /Size " + (objects.size() + 1) + " /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
        return out.toByteArray();
    }

    private static String escape(String s) {
        return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)");
    }

    private static void write(ByteArrayOutputStream out, String s) {
        byte[] b = s.getBytes(StandardCharsets.ISO_8859_1);
        out.write(b, 0, b.length);
    }
}
