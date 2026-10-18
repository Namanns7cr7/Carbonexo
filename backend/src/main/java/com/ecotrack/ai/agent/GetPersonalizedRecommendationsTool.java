package com.ecotrack.ai.agent;

import com.ecotrack.factors.CarbonTwinEngine;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Recommendations grounded in the user's own last 28 days of logs. Every estimate is a deterministic
 * hypothetical over the user's logged quantity; actions that cannot be estimated say so.
 * Legacy template savings (8.0, 6.4 kg/week ...) are never used.
 */
@Component
public class GetPersonalizedRecommendationsTool implements CoachTool {

    public static final String NAME = "getPersonalizedRecommendations";

    private final ActivityEvaluator evaluator;
    private final CarbonTwinEngine engine;

    public GetPersonalizedRecommendationsTool(ActivityEvaluator evaluator, CarbonTwinEngine engine) {
        this.evaluator = evaluator;
        this.engine = engine;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Suggest reduction actions based on the signed-in user's own logs from the last 28 days, each with a hypothetical "
                + "weekly estimate computed from their logged quantities, or NOT_ESTIMATED when no factor supports it.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "category":{"type":"STRING","enum":["travel","food","electricity","shopping","waste"]},
                  "max_results":{"type":"INTEGER"}}}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("category", "max_results"));
        String category = ToolArgs.oneOf(args, "category", Set.of("travel", "food", "electricity", "shopping", "waste"), "");
        int max = ToolArgs.integer(args, "max_results", 1, 5, 3);
        var logs = evaluator.evaluate(ctx.userId(), ctx.region(), ctx.today().minusDays(27), ctx.today(), ctx.approvedOnly());
        BigDecimal weeks = BigDecimal.valueOf(4);
        BigDecimal carKm = BigDecimal.ZERO, kwh = BigDecimal.ZERO;
        int foodItems = 0, shoppingItems = 0;
        for (var l : logs) {
            if ("attribution".equals(l.kind())) continue;
            if ("car_ride".equals(l.activity()) && l.quantity() != null) carKm = carKm.add(l.quantity());
            if ("home_electricity".equals(l.activity()) && l.quantity() != null) kwh = kwh.add(l.quantity());
            if ("food".equals(l.category())) foodItems++;
            if ("shopping".equals(l.category())) shoppingItems++;
        }
        List<Map<String, Object>> actions = new ArrayList<>();
        if (carKm.signum() > 0 && (category.isEmpty() || category.equals("travel"))) {
            BigDecimal weeklyKm = carKm.divide(weeks, 1, RoundingMode.HALF_UP);
            Map<String, Object> a = action("car_to_bus", "Take the city bus for some of your regular car trips",
                    "your logged car travel: about " + weeklyKm + " km/week over the last 28 days");
            a.put("car_side", FactorJson.side(engine, ctx, "car_ride", null, weeklyKm, null));
            a.put("bus_side", FactorJson.side(engine, ctx, "bus", null, weeklyKm, null));
            a.put("metro", FactorJson.side(engine, ctx, "metro_train", null, weeklyKm, null));
            a.put("quantity_kind", "hypothetical (if all of those km moved to the bus)");
            actions.add(a);
        }
        if (kwh.signum() > 0 && (category.isEmpty() || category.equals("electricity"))) {
            Map<String, Object> a = action("electricity_10kwh", "Reduce home electricity use",
                    "your logged electricity: about " + kwh.divide(weeks, 1, RoundingMode.HALF_UP) + " kWh/week");
            a.put("per_10_kwh_less", FactorJson.side(engine, ctx, "home_electricity", null, BigDecimal.TEN, null));
            a.put("quantity_kind", "hypothetical (per 10 kWh not used)");
            actions.add(a);
        }
        if (foodItems > 0 && (category.isEmpty() || category.equals("food"))) {
            Map<String, Object> a = action("food_by_weight", "Log meals by ingredient weight",
                    foodItems + " food entries could not be estimated because meals have no verified factor");
            a.put("status", "NOT_ESTIMATED");
            a.put("missing_information", "ingredient quantities (e.g. 150 g chicken, 200 g rice)");
            actions.add(a);
        }
        if (shoppingItems > 0 && (category.isEmpty() || category.equals("shopping"))) {
            Map<String, Object> a = action("shopping", "Shopping footprint", shoppingItems + " shopping entries");
            a.put("status", "NOT_ESTIMATED");
            a.put("missing_information", "a verified product-type factor (none in the dataset yet)");
            actions.add(a);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", actions.isEmpty() ? "NO_BASIS" : "OK");
        m.put("based_on", "the signed-in user's logs from " + ctx.today().minusDays(27) + " to " + ctx.today());
        m.put("actions", actions.subList(0, Math.min(max, actions.size())));
        if (actions.isEmpty()) m.put("missing_information", "logged activities with quantities in the last 28 days");
        return m;
    }

    private static Map<String, Object> action(String key, String title, String basis) {
        Map<String, Object> a = new LinkedHashMap<>();
        a.put("action_key", key);
        a.put("title", title);
        a.put("basis", basis);
        return a;
    }
}
