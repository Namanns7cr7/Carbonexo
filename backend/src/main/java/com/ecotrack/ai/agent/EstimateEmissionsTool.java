package com.ecotrack.ai.agent;

import com.ecotrack.factors.CarbonTwinEngine;
import com.ecotrack.factors.FactorRegistryService;
import com.ecotrack.factors.Units;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * Emissions of ONE described activity (250 kWh, 20 miles by car, 300 g chicken), with the quantity
 * converted to the factor's unit first. Same engine as comparisons and Carbon Twin. A unit of the
 * wrong kind (kWh for a car) is rejected rather than multiplied.
 */
@Component
public class EstimateEmissionsTool implements CoachTool {

    public static final String NAME = "estimateEmissions";

    private final CarbonTwinEngine engine;
    private final FactorRegistryService registry;

    public EstimateEmissionsTool(CarbonTwinEngine engine, FactorRegistryService registry) {
        this.engine = engine;
        this.registry = registry;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Emissions of one activity the user describes, e.g. home_electricity 250 kWh, car_ride 20 mi, food:poultry_meat 300 g. "
                + "Converts the unit to the factor's unit, applies the region's factor (or a range over types when the type is "
                + "unknown) and returns kg with a receipt, or NOT_ESTIMATED. occupancy divides a per-vehicle factor only.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "activity":{"type":"STRING"},"variant":{"type":"STRING"},
                  "quantity":{"type":"NUMBER"},
                  "unit":{"type":"STRING","description":"unit of quantity, e.g. kWh, MWh, km, mi, g, kg"},
                  "occupancy":{"type":"INTEGER","description":"people sharing a vehicle; only if the user said so"}},
                 "required":["activity","quantity"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("activity", "variant", "quantity", "unit", "occupancy"));
        String activity = ToolArgs.str(args, "activity", true, 60);
        String variant = ToolArgs.str(args, "variant", false, 60);
        BigDecimal q = ToolArgs.num(args, "quantity", true, 0, 1e9, null);
        String unit = ToolArgs.str(args, "unit", false, 20);
        Integer occ = ToolArgs.integer(args, "occupancy", 1, 60, null);

        Map<String, Object> m = new LinkedHashMap<>();
        Optional<String> factorUnit = registry.quantityUnit(activity, ctx.region());
        BigDecimal quantity = q;
        if (unit != null && factorUnit.isPresent() && !unit.equalsIgnoreCase(factorUnit.get())) {
            Units.Dimension have = Units.dimension(unit), want = Units.dimension(factorUnit.get());
            if (have == null || want == null || have != want) {
                throw new ToolArgs.ToolArgumentException(activity + " is estimated per " + factorUnit.get() + ", not per " + unit);
            }
            quantity = Units.tidy(Units.convert(q, unit, factorUnit.get()));
            m.put("converted", Map.of("from", q + " " + unit, "to", quantity + " " + factorUnit.get()));
        }
        try {
            CarbonTwinEngine.Side side = engine.side(activity, variant, quantity, occ, ctx.region(), ctx.approvedOnly());
            m.put("quantity_kind", "estimate of the described activity");
            m.putAll(FactorJson.render(side, ctx));
        } catch (IllegalArgumentException e) {
            throw new ToolArgs.ToolArgumentException(e.getMessage());
        }
        return m;
    }
}
