package com.ecotrack.carbon.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ActivityLogRequest(
        @NotBlank String category,
        String factorKey,
        @NotBlank String label,
        String emoji,
        Double quantity,
        String unit,
        @NotNull @Positive Double co2Kg,
        String note,
        @NotBlank String activityDate  // YYYY-MM-DD
) {}
