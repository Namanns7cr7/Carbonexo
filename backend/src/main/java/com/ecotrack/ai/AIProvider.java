package com.ecotrack.ai;

/** AI provider interface. No provider-specific code in business services. */
public interface AIProvider {

    /** Generate text completion from a prompt. */
    String generate(String prompt, String model);

    /**
     * Generate from a live model only — never a canned stand-in. Throws when no live
     * model answers, so a caller with its own fallback (the coach) can use it instead
     * of presenting a static stub as the AI's reply.
     */
    default String generateLive(String prompt, String model) {
        return generate(prompt, model);
    }

    /**
     * Generate with honest attribution: which provider/model actually produced the text, and
     * whether it is live. Implementations that can fall back MUST return {@code live=false}
     * for fallback text (see {@link AIResult}).
     */
    default AIResult generateResult(String prompt, String model) {
        long t0 = System.nanoTime();
        String text = generate(prompt, model);
        return AIResult.live(text, providerName(), model, null, null, (System.nanoTime() - t0) / 1_000_000);
    }

    /** Provider name for audit logging. */
    String providerName();
}
