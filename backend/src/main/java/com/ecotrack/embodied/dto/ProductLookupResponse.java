package com.ecotrack.embodied.dto;

public record ProductLookupResponse(
        boolean found,
        String productName,
        String brand,
        String categoryGuess
) {}
