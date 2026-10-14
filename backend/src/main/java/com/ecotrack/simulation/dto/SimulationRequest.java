package com.ecotrack.simulation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.util.List;

/**
 * A "carbon twin" what-if request: a set of hypothetical changes to the
 * user's habits, projected over a horizon. Pure input for computation —
 * nothing here is persisted.
 */
public record SimulationRequest(
        @NotEmpty @Valid List<SimulationItem> changes,
        @NotNull Horizon horizon
) {

    /** How far out to project the hypothetical changes. */
    public enum Horizon { MONTH, YEAR }

    /** Whether a change swaps one activity for another, or just reduces it. */
    public enum DeltaType { REPLACE_WITH, REDUCE_BY }

    /**
     * One hypothetical change, e.g. "replace 20 km/week of car_ride with
     * public_transport" or "reduce home_electricity by 2 kWh per occurrence,
     * per_week".
     */
    public record SimulationItem(
            @NotBlank String factorKey,
            @NotBlank String category,
            @NotNull @Positive BigDecimal quantity,
            @NotBlank String frequency,
            @NotNull DeltaType deltaType,
            String replacementFactorKey,
            BigDecimal amount
    ) {}
}
