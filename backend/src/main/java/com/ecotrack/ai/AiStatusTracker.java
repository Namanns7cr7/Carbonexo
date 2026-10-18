package com.ecotrack.ai;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Last outcome per model, exposed at /actuator/health under "aiModels". Reports UP with details
 * (never DOWN: a model outage must not take the whole API out of Cloud Run's rotation), so the
 * dashboard and alerts can see "gemini-2.0-flash: MODEL_NOT_FOUND" instead of silent canned text.
 */
public class AiStatusTracker implements HealthIndicator {

    public record ModelStatus(String lastOutcome, Instant at, long successes, long failures) {}

    private final Map<String, ModelStatus> byModel = new ConcurrentHashMap<>();

    public void recordSuccess(String model) {
        byModel.merge(model, new ModelStatus("OK", Instant.now(), 1, 0),
                (a, b) -> new ModelStatus("OK", b.at(), a.successes() + 1, a.failures()));
    }

    public void recordFailure(String model, AIFailureKind kind) {
        byModel.merge(model, new ModelStatus(kind.name(), Instant.now(), 0, 1),
                (a, b) -> new ModelStatus(kind.name(), b.at(), a.successes(), a.failures() + 1));
    }

    public Map<String, ModelStatus> snapshot() {
        return Map.copyOf(byModel);
    }

    @Override
    public Health health() {
        return Health.up().withDetails(Map.of("models", snapshot())).build();
    }
}
