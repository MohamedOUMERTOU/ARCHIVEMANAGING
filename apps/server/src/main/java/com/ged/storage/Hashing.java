package com.ged.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Copie d'un flux dans un fichier en calculant son empreinte SHA-256 au passage. */
final class Hashing {

    record Copied(long size, String sha256) {}

    private Hashing() {}

    static Copied copyTo(InputStream in, Path target) throws IOException {
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
        try (InputStream hashing = new DigestInputStream(in, digest)) {
            long size = Files.copy(hashing, target, StandardCopyOption.REPLACE_EXISTING);
            return new Copied(size, HexFormat.of().formatHex(digest.digest()));
        }
    }
}
