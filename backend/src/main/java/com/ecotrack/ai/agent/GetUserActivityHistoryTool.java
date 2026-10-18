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
import java.util.TreeMap;

/** The signed-in user's logged activities for a period, with what could and could not be estimated. */
@Component
public class GetUserActivityHistoryTool implements CoachTool {

    public static final String NAME = "getUserActivityHistory";

    static final Set<String> PERIODS = Set.of("today", "last_7_days", "previous_7_days", "this_month", "last_30_days");
    private final ActivityEvaluator evaluator;

    public GetUserActivityHistoryTool(ActivityEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's logged activities and their estimated emissions for a period, by category, with logging coverage and the entries that could not be estimated. Only the current user's data.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "period":{"type":"STRING","enum":["today","last_7_days","previous_7_days","this_month","last_30_days"]},
                  "category":{"type":"STRING","enum":["travel","food","electricity","shopping","waste"]}},
                 "required":["period"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("period", "category"));
        String period = ToolArgs.oneOf(args, "period", PERIODS, null);
        String category = ToolArgs.oneOf(args, "category", Set.of("travel", "food", "electricity", "shopping", "waste"), "");
        LocalDate[] range = range(period, ctx.today());
        List<ActivityEvaluator.Evaluated> logs = evaluator.evaluate(ctx.userId(), ctx.region(), range[0], range[1], ctx.approvedOnly());
        if (!category.isEmpty()) logs = logs.stream().filter(l -> category.equals(l.category())).toList();

        Map<String, Map<String, Object>> byCat = new TreeMap<>();
        Map<String, Map<String, Object>> byActivity = new TreeMap<>();
        Set<LocalDate> days = new HashSet<>();
        for (var l : logs) {
            days.add(l.date());
            var c = byCat.computeIfAbsent(l.category(), k -> new LinkedHashMap<>(Map.of(
                    "estimated_kg", BigDecimal.ZERO, "measured_kg", BigDecimal.ZERO, "entries", 0,
                    "not_estimated_entries", 0, "attribution_entries", 0)));
            c.merge("entries", 1, (a, b) -> (Integer) a + (Integer) b);
            switch (l.kind()) {
                case "attribution" -> c.merge("attribution_entries", 1, (a, b) -> (Integer) a + (Integer) b);
                case "not_estimated" -> c.merge("not_estimated_entries", 1, (a, b) -> (Integer) a + (Integer) b);
                case "measured" -> c.merge("measured_kg", l.kg(), (a, b) -> ((BigDecimal) a).add((BigDecimal) b));
                default -> c.merge("estimated_kg", l.kg(), (a, b) -> ((BigDecimal) a).add((BigDecimal) b));
            }
            String key = (l.activity() == null ? "unknown" : l.activity()) + "|" + (l.unit() == null ? "" : l.unit());
            var a = byActivity.computeIfAbsent(key, k -> new LinkedHashMap<>(Map.of("activity", l.activity() == null ? "unknown" : l.activity(),
                    "unit", l.unit() == null ? "" : l.unit(), "quantity", BigDecimal.ZERO, "entries", 0, "kg", BigDecimal.ZERO, "kind", l.kind())));
            a.merge("entries", 1, (x, y) -> (Integer) x + (Integer) y);
            if (l.quantity() != null) a.merge("quantity", l.quantity(), (x, y) -> ((BigDecimal) x).add((BigDecimal) y));
            if (l.kg() != null && !"attribution".equals(l.kind())) a.merge("kg", l.kg(), (x, y) -> ((BigDecimal) x).add((BigDecimal) y));
            if (l.lookup() != null && l.lookup().estimated() && l.lookup().factor() != null) {
                a.put("cite", FactorJson.lookup(l.lookup(), ctx.sources()).get("cite"));
            }
        }
        BigDecimal total = byCat.values().stream().map(c -> ((BigDecimal) c.get("estimated_kg")).add((BigDecimal) c.get("measured_kg")))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", logs.isEmpty() ? "NO_LOGS" : "OK");
        m.put("period", period);
        m.put("from", range[0].toString());
        m.put("to", range[1].toString());
        m.put("quantity_kind", "logged_estimate (measured where marked)");
        m.put("total_estimated_kg", FactorJson.round(total));
        m.put("by_category", byCat);
        m.put("activities", new ArrayList<>(byActivity.values()));
        m.put("days_with_logs", days.size());
        m.put("days_in_period", range[1].toEpochDay() - range[0].toEpochDay() + 1);
        m.put("notes", List.of(
                "not_estimated entries have no supported factor and are excluded from kg (unknown, not zero)",
                "attribution entries are shares of a meter/bill total and are not added",
                "re_estimated means a legacy log recalculated with the current dataset factor (the stored log is unchanged)"));
        return m;
    }

    static LocalDate[] range(String period, LocalDate today) {
        return switch (period) {
            case "today" -> new LocalDate[]{today, today};
            case "previous_7_days" -> new LocalDate[]{today.minusDays(13), today.minusDays(7)};
            case "this_month" -> new LocalDate[]{today.withDayOfMonth(1), today};
            case "last_30_days" -> new LocalDate[]{today.minusDays(29), today};
            default -> new LocalDate[]{today.minusDays(6), today};
        };
    }
}
