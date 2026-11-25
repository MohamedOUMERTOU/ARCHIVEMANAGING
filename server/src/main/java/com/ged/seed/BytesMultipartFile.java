package com.ged.seed;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import org.springframework.web.multipart.MultipartFile;

/** Fichier en mémoire, pour passer les documents de démonstration par le même code que les dépôts réels. */
record BytesMultipartFile(String name, String originalFilename, String contentType, byte[] bytes) implements MultipartFile {

    @Override public String getName() { return name; }
    @Override public String getOriginalFilename() { return originalFilename; }
    @Override public String getContentType() { return contentType; }
    @Override public boolean isEmpty() { return bytes.length == 0; }
    @Override public long getSize() { return bytes.length; }
    @Override public byte[] getBytes() { return bytes.clone(); }
    @Override public InputStream getInputStream() { return new ByteArrayInputStream(bytes); }

    @Override
    public void transferTo(java.io.File dest) throws IOException {
        Files.write(dest.toPath(), bytes);
    }

    @Override
    public void transferTo(Path dest) throws IOException {
        Files.write(dest, bytes);
    }
}
