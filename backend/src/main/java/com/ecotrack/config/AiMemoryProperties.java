package com.ecotrack.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Feature flags and tuning for the pgvector-backed AI coach memory
 * ({@code ecotrack.ai.memory.*}). Kept separate from {@link AppProperties.Ai}
 * so memory can be switched off without touching any other AI feature.
 *
 * <p>{@code enabled} is the startup master switch (no Vertex embedding client is
 * created when false). At runtime the {@code ai.memory.enabled} row in
 * {@code app_config} can additionally turn memory off without a redeploy.
 */
@ConfigurationProperties(prefix = "ecotrack.ai.memory")
public record AiMemoryProperties(
        @DefaultValue("false") boolean enabled,
        /** Read path: retrieve similar memories into the coach prompt. */
        @DefaultValue("true") boolean retrievalEnabled,
        /** Write path: embed and store each completed coach exchange. */
        @DefaultValue("true") boolean captureEnabled,
        @DefaultValue("text-embedding-005") String embeddingModel,
        /** Must equal the ai_memory.embedding column size (checked at runtime). */
        @DefaultValue("768") int dimensions,
        @DefaultValue("5") int topK,
        /** Cosine similarity floor (0..1) for a memory to be included. */
        @DefaultValue("0.55") double minSimilarity,
        @DefaultValue("2000") long embeddingTimeoutMs,
        @DefaultValue("2000") int maxContentChars
) {}
