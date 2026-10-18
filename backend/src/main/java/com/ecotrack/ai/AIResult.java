package com.ecotrack.ai;

/**
 * One generation outcome with honest attribution. {@code live=false} means the text did NOT come
 * from the named model (canned fallback, rate limit, open circuit): callers must label it so and
 * must never store or display it as that model's answer.
 */
public record AIResult(
        String text,
        String provider,          // "gemini" | "canned-fallback" | ...
        String model,             // the model that actually produced the text, or "none"
        boolean live,
        AIFailureKind failure,    // why the live model did not answer (null when live)
        Integer inputTokens,
        Integer outputTokens,
        long latencyMs
) {
    public static AIResult live(String text, String provider, String model, Integer inTokens, Integer outTokens, long latencyMs) {
        return new AIResult(text, provider, model, true, null, inTokens, outTokens, latencyMs);
    }

    public static AIResult fallback(String text, AIFailureKind why, long latencyMs) {
        return new AIResult(text, CannedFallbackProvider.PROVIDER_NAME, "none", false, why, null, null, latencyMs);
    }
}
