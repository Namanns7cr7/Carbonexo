package com.ecotrack.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Typed binding for the {@code ecotrack.*} configuration tree (application.yml +
 * env overrides). GOOGLE CLOUD ONLY — no Azure/Anthropic/OpenAI references.
 * Runtime-editable business values (emission factors, credit rules, provider
 * switches) live in the {@code app_config} table and are read via
 * {@link com.ecotrack.config.AppConfigService}.
 */
@ConfigurationProperties(prefix = "ecotrack")
public record AppProperties(
        Cors cors,
        Security security,
        Storage storage,
        Upload upload,
        Ocr ocr,
        Carbon carbon,
        Ai ai
) {
    public record Cors(List<String> allowedOrigins) {}

    public record Security(Jwt jwt) {
        public record Jwt(
                String secret,
                long accessTokenTtlSeconds,
                long refreshTokenTtlSeconds,
                String issuer
        ) {}
    }

    public record Storage(String provider, Gcs gcs, String localStubDir) {
        public record Gcs(String projectId, String bucket) {}
    }

    public record Upload(long maxBytes, List<String> allowedContentTypes) {}

    public record Ocr(String provider, Google google, Tesseract tesseract) {
        public record Google(String projectId) {}
        public record Tesseract(String dataPath) {}
    }

    public record Carbon(double electricityFactorDefault) {}

    public record Ai(
            String provider,
            String defaultModel,
            String fastModel,
            int timeoutSeconds,
            boolean fallbackToCanned,
            Gemini gemini
    ) {
        public record Gemini(String projectId, String location) {}
    }
}
