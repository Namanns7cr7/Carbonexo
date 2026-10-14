package com.ecotrack.embodied.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;

public record ProductEstimateRequest(
        @NotBlank String category,
        @NotNull @Positive BigDecimal quantity,
        String productName
) {}
