package com.ecotrack.ai.agent;

import java.util.Map;

/**
 * A bounded, READ-ONLY tool the coach model may call. Implementations must:
 * <ul>
 *   <li>take the user only from {@link ToolContext#userId()} (never from args);</li>
 *   <li>validate args with {@link ToolArgs} (unknown keys are rejected);</li>
 *   <li>compute numbers deterministically (FactorRegistryService), never accept a factor from args.</li>
 * </ul>
 */
public interface CoachTool {

    String name();

    String description();

    /** Gemini function-declaration parameter schema (UPPERCASE types). */
    String parametersJson();

    Map<String, Object> execute(ToolContext ctx, Map<String, Object> args);
}
