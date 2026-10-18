package com.ecotrack.ai.agent;

import com.ecotrack.factors.CarbonTwinEngine;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Carbon Twin what-if: replace a recurring activity with another over a month (4.33 weeks) or a year
 * (52 weeks). The arithmetic is {@link CarbonTwinEngine}'s, the same as the Simulate screen's.
 * Read-only; nothing is logged; no credits.
 */
@Component
public class RunCarbonTwinScenarioTool implements CoachTool {

    public static final String NAME = "runCarbonTwinScenario";

    private static final Set<String> FREQUENCIES = Set.of("per_day", "per_week", "per_month");
    private static final Set<String> HORIZONS = Set.of("MONTH", "YEAR");
    private final CarbonTwinEngine engine;

    public RunCarbonTwinScenarioTool(CarbonTwinEngine engine) {
        this.engine = engine;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Carbon Twin scenario: what would happen over a MONTH or YEAR if a recurring activity (e.g. 20 km car_ride per_day) were "
                + "replaced by another (e.g. bus). Hypothetical; nothing is saved or awarded.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "baseline_activity":{"type":"STRING"},"baseline_variant":{"type":"STRING"},
                  "replacement_activity":{"type":"STRING"},"replacement_variant":{"type":"STRING"},
                  "quantity":{"type":"NUMBER","description":"per occurrence (km, kWh, kg)"},
                  "frequency":{"type":"STRING","enum":["per_day","per_week","per_month"]},
                  "horizon":{"type":"STRING","enum":["MONTH","YEAR"]}},
                 "required":["baseline_activity","replacement_activity","quantity","frequency","horizon"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("baseline_activity", "baseline_variant", "replacement_activity", "replacement_variant",
                "quantity", "frequency", "horizon"));
        String freq = ToolArgs.oneOf(args, "frequency", FREQUENCIES, null);
        CarbonTwinEngine.Horizon horizon = CarbonTwinEngine.Horizon.valueOf(ToolArgs.oneOf(args, "horizon", HORIZONS, null));
        BigDecimal q = ToolArgs.num(args, "quantity", true, 0, 100000, null);
        BigDecimal total = CarbonTwinEngine.horizonQuantity(q, freq, horizon);
        CarbonTwinEngine.Side base, repl;
        try {
            base = engine.side(ToolArgs.str(args, "baseline_activity", true, 60), ToolArgs.str(args, "baseline_variant", false, 60),
                    total, null, ctx.region(), ctx.approvedOnly());
            repl = engine.side(ToolArgs.str(args, "replacement_activity", true, 60), ToolArgs.str(args, "replacement_variant", false, 60),
                    total, null, ctx.region(), ctx.approvedOnly());
        } catch (IllegalArgumentException e) {
            throw new ToolArgs.ToolArgumentException(e.getMessage());
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("quantity_kind", "hypothetical");
        m.put("horizon", horizon.name());
        m.put("horizon_weeks", CarbonTwinEngine.horizonWeeks(horizon));
        m.put("total_quantity", FactorJson.round(total));
        m.put("baseline", FactorJson.render(base, ctx));
        m.put("replacement", FactorJson.render(repl, ctx));
        FactorJson.putDelta(m, "delta", CarbonTwinEngine.delta(base, repl));
        if (!"NOT_ESTIMATED".equals(m.get("status"))) m.put("credits", "projected credits are not awarded for scenarios");
        return m;
    }
}
