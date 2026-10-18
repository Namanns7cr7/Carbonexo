package com.ecotrack.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Agentic coach model settings (ecotrack.agent.*). Kept separate from {@code ecotrack.ai} so the
 * agent model can be changed (e.g. a Gemini 3 preview on location "global") without touching the
 * legacy surfaces. Runtime behaviour flags live in app_config (V16), not here.
 */
@ConfigurationProperties(prefix = "ecotrack.agent")
public record AgentProperties(
        @DefaultValue("gemini-2.5-flash") String model,
        @DefaultValue("asia-south1") String location,
        @DefaultValue("text-embedding-005") String embeddingModel,
        @DefaultValue("asia-south1") String embeddingLocation,
        @DefaultValue("3000") long embeddingTimeoutMs,
        @DefaultValue("true") boolean embeddingsEnabled
) {}
