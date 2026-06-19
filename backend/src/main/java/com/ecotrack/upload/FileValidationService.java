package com.ecotrack.upload;

import com.ecotrack.config.AppProperties;
import com.ecotrack.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

/**
 * Validates uploaded files: content-type whitelist, file-size limit, and
 * magic-bytes validation (virus-safe check for file type spoofing).
 */
@Service
public class FileValidationService {

    private final long maxBytes;
    private final List<String> allowedContentTypes;

    // Magic bytes for PDF, PNG, JPEG
    private static final byte[] PDF_MAGIC = { 0x25, 0x50, 0x44, 0x46 };        // %PDF
    private static final byte[] PNG_MAGIC = { (byte)0x89, 0x50, 0x4E, 0x47 };  // .PNG
    private static final byte[] JPEG_MAGIC = { (byte)0xFF, (byte)0xD8, (byte)0xFF };

    public FileValidationService(AppProperties props) {
        this.maxBytes = props.upload().maxBytes();
        this.allowedContentTypes = props.upload().allowedContentTypes();
    }

    /** Validates content type, file size, and magic bytes. Throws BadRequestException on failure. */
    public void validate(byte[] data, String contentType, String originalFilename) {
        // Content type check
        if (contentType == null || !allowedContentTypes.contains(contentType.toLowerCase())) {
            throw new BadRequestException("Unsupported file type: " + contentType +
                    ". Allowed: " + String.join(", ", allowedContentTypes));
        }

        // File size check
        if (data.length > maxBytes) {
            throw new BadRequestException("File too large: " + data.length +
                    " bytes. Maximum: " + maxBytes + " bytes (" + (maxBytes / 1024 / 1024) + " MB)");
        }

        // Empty file check
        if (data.length == 0) {
            throw new BadRequestException("File is empty");
        }

        // Magic bytes validation (virus-safe — prevent spoofed content types)
        validateMagicBytes(data, contentType);
    }

    /** Compute SHA-256 hash of file bytes for deduplication and integrity. */
    public String sha256(byte[] data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(data));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private void validateMagicBytes(byte[] data, String contentType) {
        switch (contentType.toLowerCase()) {
            case "application/pdf":
                if (!startsWith(data, PDF_MAGIC)) {
                    throw new BadRequestException("File content does not match PDF format");
                }
                break;
            case "image/png":
                if (!startsWith(data, PNG_MAGIC)) {
                    throw new BadRequestException("File content does not match PNG format");
                }
                break;
            case "image/jpeg":
            case "image/jpg":
                if (!startsWith(data, JPEG_MAGIC)) {
                    throw new BadRequestException("File content does not match JPEG format");
                }
                break;
            default:
                break;
        }
    }

    private boolean startsWith(byte[] data, byte[] prefix) {
        if (data.length < prefix.length) return false;
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) return false;
        }
        return true;
    }
}
