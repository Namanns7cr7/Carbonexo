package com.ecotrack.ai.agent;

import com.ecotrack.ai.AIFailureKind;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;

/**
 * In-process circuit breaker for the agent model. Configuration failures (404 model, wrong endpoint,
 * auth) open it for 5 minutes at once; transient failures (quota, unavailable, timeout) open it for
 * 30 seconds after 3 in a row. While open, the coach answers immediately with a labelled fallback
 * instead of spending a slow failing call (and money) per message.
 */
@Component
public class ModelCircuitBreaker {

    private final Clock clock;
    private Instant openUntil = Instant.EPOCH;
    private int consecutiveTransient = 0;
    private AIFailureKind lastFailure;

    public ModelCircuitBreaker() {
        this(Clock.systemUTC());
    }

    ModelCircuitBreaker(Clock clock) {
        this.clock = clock;
    }

    public synchronized boolean isOpen() {
        return clock.instant().isBefore(openUntil);
    }

    public synchronized AIFailureKind lastFailure() {
        return lastFailure;
    }

    public synchronized void recordSuccess() {
        consecutiveTransient = 0;
        openUntil = Instant.EPOCH;
    }

    public synchronized void recordFailure(AIFailureKind kind) {
        lastFailure = kind;
        if (kind.isConfiguration()) {
            openUntil = clock.instant().plus(Duration.ofMinutes(5));
        } else if (++consecutiveTransient >= 3) {
            openUntil = clock.instant().plus(Duration.ofSeconds(30));
            consecutiveTransient = 0;
        }
    }
}
