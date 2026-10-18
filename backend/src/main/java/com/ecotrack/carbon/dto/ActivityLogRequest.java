package com.ecotrack.carbon.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

/**
 * One logged activity. Limits mirror the activity_logs columns, so bad input
 * is a 400 with a field error rather than a database failure. Zero kg is
 * valid: a walk, a bike ride or a zero-emission custom item is still a log.
 */
public record ActivityLogRequest(
        @NotBlank @Pattern(regexp = "travel|food|electricity|shopping|waste") String category,
        @Size(max = 60) String factorKey,
        @NotBlank @Size(max = 120) String label,
        @Size(max = 16) String emoji,
        @PositiveOrZero @DecimalMax("1000000") Double quantity,
        @Pattern(regexp = "km|kWh|item") String unit,
        @NotNull @PositiveOrZero @DecimalMax("100000") Double co2Kg,
        @Size(max = 200) String note,
        @NotBlank String activityDate  // YYYY-MM-DD
) {}
