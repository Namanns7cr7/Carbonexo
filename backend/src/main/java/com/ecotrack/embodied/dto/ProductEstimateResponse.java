package com.ecotrack.embodied.dto;

import java.math.BigDecimal;

public record ProductEstimateResponse(
        String category,
        BigDecimal estimatedKgCo2e,
        String factorSource,
        AlternativeSuggestion alternativeSuggestion
) {
    public record AlternativeSuggestion(
            String type,
            String text,
            BigDecimal estimatedKgCo2e
    ) {}
}
