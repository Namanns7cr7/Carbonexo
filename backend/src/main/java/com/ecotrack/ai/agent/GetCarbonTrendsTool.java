package com.ecotrack.ai.agent;

import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Logged-emission time series for the signed-in user (same evaluation rules as the history tool). */
@Component
public class GetCarbonTrendsTool implements CoachTool {

    public static final String NAME = "getCarbonTrends";

    private final ActivityEvaluator evaluator;

    public GetCarbonTrendsTool(ActivityEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's estimated logged emissions over recent days, weeks or months (oldest first), with days logged per period.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "granularity":{"type":"STRING","enum":["day","week","month"]},
                  "periods":{"type":"INTEGER","description":"1-12"}},
                 "required":["granularity","periods"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("granularity", "periods"));
        String g = ToolArgs.oneOf(args, "granularity", Set.of("day", "week", "month"), null);
        int n = ToolArgs.integer(args, "periods", 1, 12, 4);
        List<Map<String, Object>> series = new ArrayList<>();
        for (int i = n - 1; i >= 0; i--) {
            LocalDate start, end;
            switch (g) {
                case "day" -> { start = ctx.today().minusDays(i); end = start; }
                case "month" -> { start = ctx.today().withDayOfMonth(1).minusMonths(i); end = i == 0 ? ctx.today() : start.plusMonths(1).minusDays(1); }
                default -> { end = ctx.today().minusDays(7L * i); start = end.minusDays(6); }
            }
            var logs = evaluator.evaluate(ctx.userId(), ctx.region(), start, end, ctx.approvedOnly());
            BigDecimal kg = BigDecimal.ZERO;
            int notEst = 0;
            Set<LocalDate> days = new HashSet<>();
            for (var l : logs) {
                days.add(l.date());
                if ("not_estimated".equals(l.kind())) notEst++;
                else if (l.kg() != null && !"attribution".equals(l.kind())) kg = kg.add(l.kg());
            }
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("period_start", start.toString());
            p.put("period_end", end.toString());
            p.put("estimated_kg", FactorJson.round(kg));
            p.put("days_with_logs", days.size());
            p.put("not_estimated_entries", notEst);
            series.add(p);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("quantity_kind", "logged_estimate");
        m.put("granularity", g);
        m.put("series", series);
        m.put("note", "changes in logged estimates reflect what was logged, not measured savings");
        return m;
    }
}
