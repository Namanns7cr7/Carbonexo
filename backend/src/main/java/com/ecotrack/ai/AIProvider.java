package com.ecotrack.ai;

/** AI provider interface. No provider-specific code in business services. */
public interface AIProvider {

    /** Generate text completion from a prompt. */
    String generate(String prompt, String model);

    /** Provider name for audit logging. */
    String providerName();
}
