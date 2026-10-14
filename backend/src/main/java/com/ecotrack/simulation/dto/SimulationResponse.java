package com.ecotrack.simulation.dto;

import java.math.BigDecimal;
import java.util.List;

/** Result of running a carbon twin simulation — read-only, nothing persisted. */
public record SimulationResponse(
        BigDecimal baselineCo2Kg,
        BigDecimal projectedCo2Kg,
        BigDecimal deltaCo2Kg,
        WeeklyGoalImpact weeklyGoalImpact,
        int projectedCreditsDelta,
        List<BreakdownItem> breakdown
) {

    /** Impact of the simulated changes on the user's weekly reduction goal. */
    public record WeeklyGoalImpact(int currentProgressPct, int projectedProgressPct) {}

    /** Per-change CO2 contribution, before and after, over the requested horizon. */
    public record BreakdownItem(String factorKey, BigDecimal baselineKg, BigDecimal projectedKg) {}
}
