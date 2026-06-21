package com.ecotrack.ai;

import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Selects the AI provider based on {@code ecotrack.ai.provider}.
 * "gemini" → Google Gemini via Vertex AI; "canned" → static fallback.
 * Falls back to canned if configured or if Gemini init fails.
 */
@Configuration
public class AIConfig {

    private static final Logger log = LoggerFactory.getLogger(AIConfig.class);

    @Bean
    public AIProvider aiProvider(AppProperties props) {
        String provider = props.ai().provider();
        log.info("AI provider selected: {}", provider);

        AIProvider primaryProvider;
        if ("gemini".equalsIgnoreCase(provider)) {
            try {
                primaryProvider = new GeminiAIProvider(props);
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

        if (props.ai().fallbackToCanned()) {
            return new AIProvider() {
                private final CannedFallbackProvider canned = new CannedFallbackProvider();

                @Override
                public String generate(String prompt, String model) {
                    try {
                        return primaryProvider.generate(prompt, model);
                    } catch (Exception e) {
                        log.warn("Primary AI provider failed during generation, falling back to canned provider", e);
                        return canned.generate(prompt, model);
                    }
                }

                @Override
                public String providerName() {
                    return primaryProvider.providerName();
                }
            };
        }

        return primaryProvider;
    }
}
