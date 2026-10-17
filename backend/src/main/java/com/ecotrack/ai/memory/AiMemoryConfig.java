package com.ecotrack.ai.memory;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AiMemoryProperties;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;

import java.time.Clock;

/**
 * Wires the coach memory. With {@code ecotrack.ai.memory.enabled=false} (the
 * default), or when the Vertex embedding client cannot be created, the coach
 * gets {@link CoachMemory#NONE} and runs exactly as before.
 */
@Configuration
public class AiMemoryConfig {

    private static final Logger log = LoggerFactory.getLogger(AiMemoryConfig.class);

    @Bean
    public CoachMemory coachMemory(AiMemoryProperties memoryProps, AppProperties props, AiMemoryRepository repo,
                                   ActivityLogRepository activityRepo, AppConfigService appConfig,
                                   PlatformTransactionManager txManager, ObjectProvider<MeterRegistry> meters) {
        if (!memoryProps.enabled()) {
            log.info("AI coach memory (pgvector) disabled by ecotrack.ai.memory.enabled");
            return CoachMemory.NONE;
        }
        EmbeddingProvider embeddings;
        try {
            embeddings = new VertexEmbeddingProvider(props.ai().gemini().projectId(), props.ai().gemini().location(),
                    memoryProps.embeddingModel(), memoryProps.dimensions(), memoryProps.embeddingTimeoutMs());
        } catch (Exception e) {
            log.warn("AI coach memory disabled: Vertex AI embedding client could not be created", e);
            return CoachMemory.NONE;
        }
        log.info("AI coach memory (pgvector) enabled — model={}, topK={}", memoryProps.embeddingModel(),
                memoryProps.topK());
        warmUp(embeddings);
        return new PgVectorCoachMemory(memoryProps, embeddings, repo, activityRepo, appConfig, txManager,
                meters.getIfAvailable(SimpleMeterRegistry::new), Clock.systemUTC());
    }

    /**
     * The first call on a fresh gRPC channel pays TLS + ADC token setup (observed &gt;2 s),
     * which would exceed the embedding timeout and drop memory for the first coach
     * request after every (Cloud Run cold) start. Warm it off the startup path.
     */
    private static void warmUp(EmbeddingProvider embeddings) {
        Thread t = new Thread(() -> {
            try {
                embeddings.embed("warm-up", EmbeddingProvider.Task.RETRIEVAL_QUERY);
                log.debug("AI memory embedding channel warmed up");
            } catch (Exception e) {
                // Expected on a cold channel: the timeout fires but channel setup still completes.
                log.info("AI memory embedding warm-up did not finish in time ({}); channel setup continues",
                        e.toString());
            }
        }, "ai-memory-warmup");
        t.setDaemon(true);
        t.start();
    }
}
