package com.ecotrack.ocr;

import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Selects the OCR provider based on {@code ecotrack.ocr.provider}.
 * "google" → Google Cloud Vision; "tesseract" → local Tess4j.
 */
@Configuration
public class OcrConfig {

    private static final Logger log = LoggerFactory.getLogger(OcrConfig.class);

    @Bean
    public OcrProvider ocrProvider(AppProperties props) {
        String provider = props.ocr().provider();
        log.info("OCR provider selected: {}", provider);
        if ("google".equalsIgnoreCase(provider)) {
            return new GoogleVisionOcrProvider();
        }
        return new TesseractOcrProvider(props.ocr().tesseract().dataPath());
    }
}
