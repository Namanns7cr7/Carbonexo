package com.ecotrack.ai.agent;

import com.ecotrack.factors.CarbonTwinEngine;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Deterministic A-vs-B comparison. The result is a HYPOTHETICAL difference, never a saving. */
@Component
public class CalculateEmissionComparisonTool implements CoachTool {

    public static final String NAME = "calculateEmissionComparison";

    private final CarbonTwinEngine engine;

    public CalculateEmissionComparisonTool(CarbonTwinEngine engine) {
        this.engine = engine;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Compare the emissions of two activities for the same trip or use, e.g. 20 km by car_ride vs by bus, per occurrence and "
                + "over occurrences_per_week x weeks. Uses verified factors for the user's region; if a car/bike type is unknown it returns a "
                + "range over types. Returns NOT_ESTIMATED for a side with no factor. Results are hypothetical.";
    }

    @Override public String parametersJson() {
        String side = """
                {"type":"OBJECT","properties":{
                  "activity":{"type":"STRING"},"variant":{"type":"STRING"},
                  "quantity":{"type":"NUMBER","description":"per occurrence, in the activity's unit (km, kWh, kg)"},
                  "occupancy":{"type":"INTEGER","description":"people sharing a vehicle; only if the user said so"}},
                 "required":["activity","quantity"]}""";
        return "{\"type\":\"OBJECT\",\"properties\":{\"baseline\":" + side + ",\"alternative\":" + side
                + ",\"occurrences_per_week\":{\"type\":\"NUMBER\"},\"weeks\":{\"type\":\"NUMBER\"}},\"required\":[\"baseline\",\"alternative\"]}";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("baseline", "alternative", "occurrences_per_week", "weeks"));
        BigDecimal perWeek = ToolArgs.num(args, "occurrences_per_week", false, 0, 50, 1.0);
        BigDecimal weeks = ToolArgs.num(args, "weeks", false, 0, 52, 1.0);
        BigDecimal mult = perWeek.multiply(weeks);
        CarbonTwinEngine.Side base = side(ctx, ToolArgs.obj(args, "baseline"), mult);
        CarbonTwinEngine.Side alt = side(ctx, ToolArgs.obj(args, "alternative"), mult);
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("quantity_kind", "hypothetical");
        m.put("occurrences_per_week", perWeek);
        m.put("weeks", weeks);
        m.put("baseline", FactorJson.render(base, ctx));
        m.put("alternative", FactorJson.render(alt, ctx));
        FactorJson.putDelta(m, "difference", CarbonTwinEngine.delta(base, alt));
        if (!"NOT_ESTIMATED".equals(m.get("status"))) {
            m.put("note", "difference = alternative - baseline over the whole period; negative means the alternative would emit less (hypothetical)");
        }
        return m;
    }

    private CarbonTwinEngine.Side side(ToolContext ctx, Map<String, Object> a, BigDecimal mult) {
        ToolArgs.onlyKeys(a, Set.of("activity", "variant", "quantity", "occupancy"));
        String activity = ToolArgs.str(a, "activity", true, 60);
        String variant = ToolArgs.str(a, "variant", false, 60);
        BigDecimal q = ToolArgs.num(a, "quantity", true, 0, 100000, null);
        Integer occ = ToolArgs.integer(a, "occupancy", 1, 60, null);
        try {
            return engine.side(activity, variant, q.multiply(mult), occ, ctx.region(), ctx.approvedOnly());
        } catch (IllegalArgumentException e) {
            throw new ToolArgs.ToolArgumentException(e.getMessage());
        }
    }
}
