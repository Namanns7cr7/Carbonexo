package com.ecotrack.ai.agent;

import com.ecotrack.factors.FactorLookup;
import com.ecotrack.factors.FactorRegistryService;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Deterministic factor lookup for the user's region. The only way the model learns a factor. */
@Component
public class GetEmissionFactorsTool implements CoachTool {

    public static final String NAME = "getEmissionFactors";

    private final FactorRegistryService registry;

    public GetEmissionFactorsTool(FactorRegistryService registry) {
        this.registry = registry;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Look up the verified emission factor for an activity in the user's region. Activities: home_electricity, air_conditioning, "
                + "car_ride, motorbike, auto_rickshaw, bus, metro_train, flight, taxi, walk, bike, food:<item> per kg (e.g. food:beef_herd, "
                + "food:other_pulses, food:rice, food:poultry_meat, food:milk), lifestyle_target_2030 / _2040 / _2050 (1.5 C-compatible "
                + "per-person consumption footprint targets, kg CO2e per person per year; whole-lifestyle scope, not comparable with "
                + "partial tracking), and logged items like clothing_item. Variants DEPEND ON THE REGION: call without a variant "
                + "to get the region's list (India car_ride: petrol_hatch_lt1400cc, petrol_sedan_lt1400cc, diesel_hatch_lt1400cc, "
                + "cng_small_lt800cc, ...; UK car_ride: petrol, bev). Returns NOT_ESTIMATED with missing_information when no factor exists.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "activity":{"type":"STRING"},
                  "variant":{"type":"STRING"}},
                 "required":["activity"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("activity", "variant"));
        String activity = ToolArgs.str(args, "activity", true, 60);
        String variant = ToolArgs.str(args, "variant", false, 60);
        FactorLookup l = registry.lookup(activity, ctx.region(), variant, ctx.approvedOnly());
        Map<String, Object> m = new LinkedHashMap<>(FactorJson.lookup(l, ctx.sources()));
        if (l.reason() == FactorLookup.Reason.VARIANT_REQUIRED) {
            List<Map<String, Object>> vs = registry.estimableVariants(activity, ctx.region(), ctx.approvedOnly()).stream()
                    .map(v -> FactorJson.lookup(v, ctx.sources())).toList();
            m.put("variants", vs);
        } else if (!l.estimated() && variant != null) {
            // e.g. an Indian car class asked for a UK user: say which types do exist here
            List<String> available = registry.estimableVariants(activity, ctx.region(), ctx.approvedOnly()).stream()
                    .map(FactorLookup::variant).toList();
            if (!available.isEmpty()) m.put("available_variants", available);
            else {
                FactorLookup dflt = registry.lookup(activity, ctx.region(), null, ctx.approvedOnly());
                if (dflt.estimated()) m.put("default_factor", FactorJson.lookup(dflt, ctx.sources()));
            }
        }
        return m;
    }
}
