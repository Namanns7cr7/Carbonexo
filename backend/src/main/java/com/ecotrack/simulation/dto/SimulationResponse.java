package com.ecotrack.simulation.dto;

import java.math.BigDecimal;
import java.util.List;

/**
 * Result of running a carbon twin simulation — read-only, nothing persisted.
 *
 * <p>{@code status}: ESTIMATED (every change has an exact figure), ESTIMATED_RANGE (a type was not
 * stated, so min/max over the dataset's types), PARTIAL (some changes are not estimated and are left
 * out of the totals), NOT_ESTIMATED (nothing could be estimated). The single-value totals are set
 * only when ESTIMATED; otherwise use the min/max fields.
 */
public record SimulationResponse(
        BigDecimal baselineCo2Kg,
        BigDecimal projectedCo2Kg,
        BigDecimal deltaCo2Kg,
        WeeklyGoalImpact weeklyGoalImpact,
        int projectedCreditsDelta,
        List<BreakdownItem> breakdown,
        String aiInsight,
        String status,
        BigDecimal deltaCo2KgMin,
        BigDecimal deltaCo2KgMax,
        String factorDatasetVersion,
        String factorAuthority
) {

    /** Impact of the simulated changes on the user's weekly reduction goal. */
    public record WeeklyGoalImpact(int currentProgressPct, int projectedProgressPct) {}

    /**
     * Per-change CO2 contribution, before and after, over the requested horizon. {@code baselineKg} and
     * {@code projectedKg} are null unless the change is ESTIMATED; {@code factorSource} is "registry" or
     * "user_supplied" (a custom rate the user typed).
     */
    public record BreakdownItem(String factorKey, BigDecimal baselineKg, BigDecimal projectedKg, String status,
                                BigDecimal baselineKgMin, BigDecimal baselineKgMax,
                                BigDecimal projectedKgMin, BigDecimal projectedKgMax,
                                String missingInformation, String factorSource) {}
}
