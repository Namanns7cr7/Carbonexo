package com.ecotrack.ai.agent;

import com.ecotrack.carbon.ActivityLogRepository;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Category-level footprint breakdown (travel, electricity, food, shopping, waste) for the signed-in user. */
@Component
public class GetActivityCategoryBreakdownTool implements CoachTool {

    public static final String NAME = "getActivityCategoryBreakdown";
    static final Set<String> PERIODS = Set.of("today", "last_7_days", "this_month", "last_30_days");

    private final ActivityLogRepository logRepo;

    public GetActivityCategoryBreakdownTool(ActivityLogRepository logRepo) {
        this.logRepo = logRepo;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's total carbon emissions broken down by category (travel, electricity, food, "
                + "shopping, waste) for a given time period. Uses authoritative logged activity data.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "period":{"type":"STRING","enum":["today","last_7_days","this_month","last_30_days"]}},
                 "required":["period"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("period"));
        String period = ToolArgs.oneOf(args, "period", PERIODS, "last_7_days");
        LocalDate start, end = ctx.today();
        switch (period) {
            case "today" -> start = end;
            case "this_month" -> start = end.withDayOfMonth(1);
            case "last_30_days" -> start = end.minusDays(29);
            default -> start = end.minusDays(6);
        }

        List<Object[]> rows = logRepo.breakdownByCategory(ctx.userId(), start, end);
        Map<String, BigDecimal> breakdown = new LinkedHashMap<>();
        BigDecimal total = BigDecimal.ZERO;
        for (Object[] r : rows) {
            String cat = (String) r[0];
            BigDecimal kg = ((BigDecimal) r[1]).setScale(2, RoundingMode.HALF_UP);
            breakdown.put(cat, kg);
            total = total.add(kg);
        }

        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("period", period);
        m.put("start_date", start.toString());
        m.put("end_date", end.toString());
        m.put("total_co2_kg", total);
        m.put("category_breakdown_co2_kg", breakdown);
        if (breakdown.isEmpty()) {
            m.put("note", "No activities logged for " + period + ".");
        }
        return m;
    }
}
