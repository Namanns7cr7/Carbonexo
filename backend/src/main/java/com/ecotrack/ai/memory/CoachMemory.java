package com.ecotrack.ai.memory;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Long-term memory for the AI coach. Implementations must never throw: any
 * failure yields {@link Optional#empty()} so the coach keeps its non-vector
 * workflow.
 */
public interface CoachMemory {

    /** No-op memory: the coach behaves exactly as it did before memory existed. */
    CoachMemory NONE = new CoachMemory() {
        @Override
        public Optional<String> recall(UUID userId, String message, Instant olderThan) {
            return Optional.empty();
        }

        @Override
        public void remember(UUID userId, UUID sourceMessageId, String userMessage, String assistantReply) {
        }
    };

    /**
     * Prompt block combining relevant past exchanges with verified activity
     * metrics, or empty when memory is off, unavailable, failing, or has nothing
     * relevant.
     *
     * @param olderThan only memories created before this instant (exchanges in the
     *                  recent-history window are already in the prompt); null = no bound
     */
    Optional<String> recall(UUID userId, String message, Instant olderThan);

    /** Store a completed exchange. Best effort; deferred until the caller's transaction commits. */
    void remember(UUID userId, UUID sourceMessageId, String userMessage, String assistantReply);
}
