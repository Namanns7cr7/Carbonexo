package com.ecotrack.ai.service;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * AI Coach response. {@code result} and {@code prompt} keep the original contract (an empty result
 * means "no live answer": the client shows its labelled offline library). The remaining fields are
 * additive and describe who actually answered and on what basis.
 *
 * @param provider   provider that produced {@code result} ("gemini", "canned-fallback", ...), null when empty
 * @param model      model that actually produced {@code result}
 * @param live       true only for a live model answer
 * @param failure    why no live answer was produced (AIFailureKind name), null when live
 * @param responseId ai_responses id, for feedback
 * @param citations  only sources that tool results contained AND the answer cites ([S#] markers)
 * @param toolsUsed  tool names executed for this answer
 * @param checks     verification outcomes (numeric_check, citation_check, retrieval_confidence, ...)
 */
public record CoachResponse(String result, String prompt, String provider, String model, Boolean live, String failure,
                            UUID responseId, List<Map<String, Object>> citations, List<String> toolsUsed,
                            Map<String, Object> checks) {

    public CoachResponse(String result, String prompt) {
        this(result, prompt, null, null, null, null, null, List.of(), List.of(), Map.of());
    }
}
