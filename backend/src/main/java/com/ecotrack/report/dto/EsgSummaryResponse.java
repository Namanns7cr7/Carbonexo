package com.ecotrack.report.dto;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Map;

/**
 * Aggregate ESG / sustainability summary for one user — built entirely from
 * existing, already-trustworthy data (no new aggregation logic). Used for
 * both the JSON report view and the CSV export.
 */
public record EsgSummaryResponse(
        BigDecimal lifetimeCo2SavedKg,
        BigDecimal currentMonthCo2Kg,
        Map<String, BigDecimal> categoryBreakdown,
        int creditsEarned,
        int currentStreak,
        long totalActivitiesLogged,
        LocalDate accountStartDate,
        Instant generatedAt
) {
}
