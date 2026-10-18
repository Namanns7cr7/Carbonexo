package com.ecotrack.ai;

import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Selects the AI provider based on {@code ecotrack.ai.provider}.
 * "gemini" → Google Gemini via Vertex AI; "canned" → static fallback.
 * Falls back to canned if configured or if Gemini init fails. Fallback text is always attributed
 * to {@link CannedFallbackProvider#PROVIDER_NAME} with the failure reason, never to the model.
 */
@Configuration
public class AIConfig {

    private static final Logger log = LoggerFactory.getLogger(AIConfig.class);

    @Bean
    public AiStatusTracker aiModelsHealthIndicator() {
        return new AiStatusTracker();
    }

    @Bean
    public AIProvider aiProvider(AppProperties props, AiStatusTracker status) {
        String provider = props.ai().provider();
        log.info("AI provider selected: {} (defaultModel={}, fastModel={}, location={})", provider,
                props.ai().defaultModel(), props.ai().fastModel(),
                props.ai().gemini() != null ? props.ai().gemini().location() : null);

        AIProvider primaryProvider;
        if ("gemini".equalsIgnoreCase(provider)) {
            try {
                primaryProvider = new GeminiAIProvider(props, status);
            } catch (Exception e) {
                if (props.ai().fallbackToCanned()) {
                    log.warn("Gemini initialization failed, falling back to canned provider", e);
                    return new CannedFallbackProvider();
                }
                throw e;
            }
        } else {
            primaryProvider = new CannedFallbackProvider();
        }

        return props.ai().fallbackToCanned() ? withCannedFallback(primaryProvider) : primaryProvider;
    }

    /** Wraps a live provider: on failure, return canned text attributed to the fallback with the reason. */
    static AIProvider withCannedFallback(AIProvider primaryProvider) {
        return new AIProvider() {
            private final CannedFallbackProvider canned = new CannedFallbackProvider();

            @Override
            public String generate(String prompt, String model) {
                return generateResult(prompt, model).text();
            }

            @Override
            public AIResult generateResult(String prompt, String model) {
                long t0 = System.nanoTime();
                try {
                    return primaryProvider.generateResult(prompt, model);
                } catch (Exception e) {
                    AIFailureKind kind = AIFailureKind.classify(e);
                    log.warn("Primary AI provider failed ({}), returning labelled canned fallback", kind);
                    return AIResult.fallback(canned.generate(prompt, model), kind, (System.nanoTime() - t0) / 1_000_000);
                }
            }

            @Override
            public String generateLive(String prompt, String model) {
                return primaryProvider.generateLive(prompt, model);
            }

            @Override
            public String providerName() {
                return primaryProvider.providerName();
            }
        };
    }
}
