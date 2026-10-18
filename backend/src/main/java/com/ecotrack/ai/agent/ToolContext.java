package com.ecotrack.ai.agent;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Execution context for one coach turn. {@code userId} is ALWAYS the authenticated principal
 * (SecurityUtils.currentUserId() in the controller); no tool argument can change it.
 * {@code approvedOnly} (safe_limited mode): factor lookups ignore candidate datasets.
 * {@code numbers}: operands that arithmetic tools may use this turn (user message + tool results).
 */
public record ToolContext(UUID userId, String region, boolean regionConfirmed, LocalDate today, SourceLedger sources,
                          boolean approvedOnly, GroundedNumbers numbers) {
    public ToolContext {
        if (userId == null) throw new IllegalArgumentException("ToolContext requires an authenticated user");
    }

    public ToolContext(UUID userId, String region, boolean regionConfirmed, LocalDate today, SourceLedger sources) {
        this(userId, region, regionConfirmed, today, sources, false, new GroundedNumbers());
    }
}
