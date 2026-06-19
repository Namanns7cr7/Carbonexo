package com.ecotrack.ocr;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;

/**
 * Tesseract OCR fallback — local/free OCR using Tess4j.
 * Requires tessdata installed locally. Returns partial results.
 */
public class TesseractOcrProvider implements OcrProvider {

    private static final Logger log = LoggerFactory.getLogger(TesseractOcrProvider.class);

    private final String dataPath;

    public TesseractOcrProvider(String dataPath) {
        this.dataPath = dataPath;
    }

    @Override
    public OcrExtraction extract(byte[] fileData, String contentType) {
        try {
            net.sourceforge.tess4j.Tesseract tesseract = new net.sourceforge.tess4j.Tesseract();
            if (dataPath != null && !dataPath.isBlank()) {
                tesseract.setDatapath(dataPath);
            }
            tesseract.setLanguage("eng");

            // Convert bytes to a temp file for Tesseract
            java.nio.file.Path tempFile = java.nio.file.Files.createTempFile("ocr-", getSuffix(contentType));
            java.nio.file.Files.write(tempFile, fileData);

            String text = tesseract.doOCR(tempFile.toFile());
            java.nio.file.Files.deleteIfExists(tempFile);

            log.debug("Tesseract extracted {} chars", text.length());

            // Use the same regex parsing as Google Vision
            BigDecimal units = parseUnits(text);
            BigDecimal amount = parseAmount(text);

            int found = (units != null ? 1 : 0) + (amount != null ? 1 : 0);
            BigDecimal confidence = BigDecimal.valueOf(found / 3.0);

            return new OcrExtraction(null, units, amount, confidence, text);

        } catch (Exception e) {
            log.error("Tesseract OCR failed", e);
            return new OcrExtraction(null, null, null, BigDecimal.ZERO, "Error: " + e.getMessage());
        }
    }

    @Override
    public String providerName() {
        return "tesseract";
    }

    private String getSuffix(String contentType) {
        return switch (contentType.toLowerCase()) {
            case "image/png" -> ".png";
            case "image/jpeg", "image/jpg" -> ".jpg";
            case "application/pdf" -> ".pdf";
            default -> ".tmp";
        };
    }

    private BigDecimal parseUnits(String text) {
        var m = java.util.regex.Pattern.compile("(?i)units?\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)").matcher(text);
        if (m.find()) {
            try { return new BigDecimal(m.group(1)); } catch (Exception ignored) {}
        }
        return null;
    }

    private BigDecimal parseAmount(String text) {
        var m = java.util.regex.Pattern.compile("(?i)(?:total|amount)\\s*[:\\-]?\\s*(?:₹|Rs\\.?)?\\s*(\\d+(?:,\\d{3})*(?:\\.\\d{2})?)").matcher(text);
        if (m.find()) {
            try { return new BigDecimal(m.group(1).replace(",", "")); } catch (Exception ignored) {}
        }
        return null;
    }
}
