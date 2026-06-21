package com.ecotrack.ai.service;

/**
 * AI Coach response containing the generated result and the compiled prompt.
 */
public record CoachResponse(String result, String prompt) {}
