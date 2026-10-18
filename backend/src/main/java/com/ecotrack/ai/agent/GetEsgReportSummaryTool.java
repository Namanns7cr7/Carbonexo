package com.ecotrack.ai.agent;

import com.ecotrack.report.ReportService;
import com.ecotrack.report.dto.EsgSummaryResponse;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** ESG / Sustainability export summary for the signed-in user, backed by ReportService. */
@Component
public class GetEsgReportSummaryTool implements CoachTool {

    public static final String NAME = "getEsgReportSummary";
    private final ReportService reportService;

    public GetEsgReportSummaryTool(ReportService reportService) {
        this.reportService = reportService;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's official ESG and sustainability report summary (CSRD/BRSR-aligned metrics), "
                + "including lifetime CO2 saved, current month footprint, category breakdown, credits earned, and logging streak. "
                + "Takes no arguments; it always returns the current user only.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        EsgSummaryResponse r = reportService.getEsgSummary(ctx.userId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("lifetime_co2_saved_kg", r.lifetimeCo2SavedKg() != null ? r.lifetimeCo2SavedKg().doubleValue() : 0.0);
        m.put("current_month_co2_kg", r.currentMonthCo2Kg() != null ? r.currentMonthCo2Kg().doubleValue() : 0.0);
        m.put("category_breakdown_kg", r.categoryBreakdown());
        m.put("credits_earned", r.creditsEarned());
        m.put("current_streak", r.currentStreak());
        m.put("total_activities_logged", r.totalActivitiesLogged());
        m.put("account_start_date", r.accountStartDate() != null ? r.accountStartDate().toString() : "unknown");
        m.put("generated_at", r.generatedAt() != null ? r.generatedAt().toString() : null);
        return m;
    }
}
