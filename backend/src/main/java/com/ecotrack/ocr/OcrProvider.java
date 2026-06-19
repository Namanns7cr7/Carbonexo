package com.ecotrack.ocr;

/**
 * OCR provider interface. Implementations extract billing data from images/PDFs.
 * No provider-specific code should leak into business logic.
 */
public interface OcrProvider {

    /** Extract billing data from the given file bytes. */
    OcrExtraction extract(byte[] fileData, String contentType);

    /** Provider name for audit logging. */
    String providerName();
}
