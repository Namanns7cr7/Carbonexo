package com.ecotrack.ai.agent;

import com.ecotrack.factors.Units;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/** Exact unit and rate conversion (t/MWh to kg/kWh, kg/week to t/year, miles to km) with stated conventions. */
@Component
public class ConvertUnitsTool implements CoachTool {

    public static final String NAME = "convertUnits";

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Convert a value between units or rates: g/kg/t, Wh/kWh/MWh, m/km/mi, and per hour/day/week/month/quarter/year, "
                + "including ratios such as t/MWh -> kg/kWh or kg/week -> t/year. Calendar conventions: 1 year = 365 days, "
                + "1 month = 365/12 days.";
    }

    @Override public String parametersJson() {
        return """
                {"type":"OBJECT","properties":{
                  "value":{"type":"NUMBER"},
                  "from_unit":{"type":"STRING","description":"e.g. t/MWh, kg/week, mi"},
                  "to_unit":{"type":"STRING","description":"e.g. kg/kWh, t/year, km"}},
                 "required":["value","from_unit","to_unit"]}""";
    }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of("value", "from_unit", "to_unit"));
        BigDecimal value = ToolArgs.num(args, "value", true, -1e12, 1e12, null);
        String from = ToolArgs.str(args, "from_unit", true, 30);
        String to = ToolArgs.str(args, "to_unit", true, 30);
        if (!ctx.numbers().contains(value)) {
            throw new ToolArgs.ToolArgumentException(value.toPlainString() + " is not in the user's message or any tool result. "
                    + "Look it up with a tool first; do not use remembered values.");
        }
        BigDecimal out;
        try {
            out = Units.convert(value, from, to);
        } catch (IllegalArgumentException e) {
            throw new ToolArgs.ToolArgumentException(e.getMessage());
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("value", value);
        m.put("from_unit", from);
        m.put("result", Units.tidy(out));
        m.put("to_unit", to);
        m.put("conventions", "1 year = 365 days; 1 month = 365/12 days; 1 mile = 1.609344 km");
        return m;
    }
}
