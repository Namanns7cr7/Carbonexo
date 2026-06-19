package com.ecotrack.ocr;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Result of OCR extraction from a bill image/PDF. */
public record OcrExtraction(
        LocalDate billingMonth,
        BigDecimal unitsConsumed,
        BigDecimal billAmount,
        BigDecimal confidence,   // 0.0 – 1.0
        String rawJson           // full provider response for auditing
) {}
