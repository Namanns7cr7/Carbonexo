package com.ecotrack.ocr;

import com.google.cloud.vision.v1.*;
import com.google.protobuf.ByteString;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Google Cloud Vision OCR implementation. Uses the TEXT_DETECTION feature to
 * extract text from bill images, then parses billing month, units consumed,
 * and bill amount using regex patterns.
 */
public class GoogleVisionOcrProvider implements OcrProvider {

    private static final Logger log = LoggerFactory.getLogger(GoogleVisionOcrProvider.class);

    // Regex patterns for common Indian electricity bill formats
    private static final Pattern UNITS_PATTERN = Pattern.compile(
            "(?i)(?:units?\\s*(?:consumed|used)?|consumption)\\s*[:\\-]?\\s*(\\d+(?:\\.\\d+)?)", Pattern.MULTILINE);
    private static final Pattern AMOUNT_PATTERN = Pattern.compile(
            "(?i)(?:total\\s*(?:amount|charges?|bill)?|amount\\s*(?:payable|due)|net\\s*amount)\\s*[:\\-]?\\s*(?:₹|Rs\\.?|INR)?\\s*(\\d+(?:,\\d{3})*(?:\\.\\d{2})?)", Pattern.MULTILINE);
    private static final Pattern MONTH_PATTERN = Pattern.compile(
            "(?i)(?:billing?\\s*(?:period|month)|month|period)\\s*[:\\-]?\\s*([A-Za-z]+\\s*'?\\d{2,4}|\\d{2}[/\\-]\\d{2,4})", Pattern.MULTILINE);

    @Override
    public OcrExtraction extract(byte[] fileData, String contentType) {
        try (ImageAnnotatorClient client = ImageAnnotatorClient.create()) {
            ByteString imgBytes = ByteString.copyFrom(fileData);
            Image image = Image.newBuilder().setContent(imgBytes).build();
            Feature feature = Feature.newBuilder().setType(Feature.Type.TEXT_DETECTION).build();
            AnnotateImageRequest request = AnnotateImageRequest.newBuilder()
                    .addFeatures(feature).setImage(image).build();

            BatchAnnotateImagesResponse response = client.batchAnnotateImages(List.of(request));
            AnnotateImageResponse imgResponse = response.getResponses(0);

            if (imgResponse.hasError()) {
                log.error("Vision API error: {}", imgResponse.getError().getMessage());
                return new OcrExtraction(null, null, null, BigDecimal.ZERO,
                        imgResponse.getError().getMessage());
            }

            String fullText = imgResponse.getFullTextAnnotation().getText();
            log.debug("OCR extracted {} chars", fullText.length());

            // Parse extracted text
            BigDecimal units = extractDecimal(UNITS_PATTERN, fullText);
            BigDecimal amount = extractAmount(AMOUNT_PATTERN, fullText);
            LocalDate month = extractMonth(MONTH_PATTERN, fullText);

            // Confidence based on how many fields were extracted
            int found = (units != null ? 1 : 0) + (amount != null ? 1 : 0) + (month != null ? 1 : 0);
            BigDecimal confidence = BigDecimal.valueOf(found / 3.0);

            return new OcrExtraction(month, units, amount, confidence, fullText);

        } catch (Exception e) {
            log.error("Google Vision OCR failed", e);
            return new OcrExtraction(null, null, null, BigDecimal.ZERO, "Error: " + e.getMessage());
        }
    }

    @Override
    public String providerName() {
        return "google";
    }

    private BigDecimal extractDecimal(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        if (m.find()) {
            try {
                return new BigDecimal(m.group(1).replace(",", ""));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private BigDecimal extractAmount(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        if (m.find()) {
            try {
                return new BigDecimal(m.group(1).replace(",", ""));
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private LocalDate extractMonth(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        if (m.find()) {
            String raw = m.group(1).trim();
            try {
                // Try "MMM yyyy" or "MMMM yyyy"
                for (String fmt : List.of("MMM yyyy", "MMMM yyyy", "MMM yy", "MMMM yy", "MM/yyyy", "MM-yyyy")) {
                    try {
                        return LocalDate.parse("01 " + raw,
                                DateTimeFormatter.ofPattern("dd " + fmt));
                    } catch (Exception ignored) {}
                }
            } catch (Exception ignored) {}
        }
        return null;
    }
}
