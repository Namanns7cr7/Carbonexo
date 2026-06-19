package com.ecotrack.carbon.dto;

import java.util.List;
import java.util.Map;

public record DashboardResponse(
        double todayTotal,
        double yesterdayTotal,
        int deltaPct,
        Map<String, Double> todayBreakdown,
        Map<String, Double> weekBreakdown,
        List<DayTotal> weekTotals,
        String biggestCategory,
        double biggestValue,
        int streak,
        double totalSaved,
        List<ActivityLogResponse> todayLogs
) {
    public record DayTotal(String date, double total) {}
}
