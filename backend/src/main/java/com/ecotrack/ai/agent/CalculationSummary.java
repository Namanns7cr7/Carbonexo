package com.ecotrack.ai.agent;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * The arithmetic behind an answer, rendered from tool results (never by the model), appended after
 * verification. Users see exactly what was multiplied, with which factor, and which side could not
 * be estimated.
 */
final class CalculationSummary {

    private CalculationSummary() {}

    static String render(List<Map<String, Object>> results, String datasetVersion, boolean candidate) {
        List<String> lines = new ArrayList<>();
        for (Map<String, Object> r : results) {
            Object alt = r.containsKey("alternative") ? r.get("alternative") : r.get("replacement");
            if (r.get("baseline") instanceof Map<?, ?> b && alt instanceof Map<?, ?> a) {
                String period = r.containsKey("horizon") ? " over one " + String.valueOf(r.get("horizon")).toLowerCase() : "";
                lines.add(side(b, "now") + period);
                lines.add(side(a, "instead") + period);
                lines.add(delta(r));
            } else if (String.valueOf(r.get("quantity_kind")).startsWith("estimate")) {
                if (r.get("converted") instanceof Map<?, ?> c) lines.add("Converted " + c.get("from") + " to " + c.get("to"));
                lines.add(side(r, null));
            }
        }
        if (lines.isEmpty()) return "";
        String header = "Calculation (factor dataset " + datasetVersion + (candidate ? ", provisional factors not yet reviewed" : "") + "):";
        return header + "\n- " + String.join("\n- ", lines);
    }

    private static String side(Map<?, ?> s, String role) {
        String name = s.get("activity") + (s.get("variant") != null ? " (" + s.get("variant") + ")" : "");
        String prefix = role == null ? "" : role + ": ";
        String qty = s.get("quantity") instanceof BigDecimal q ? q.stripTrailingZeros().toPlainString() : String.valueOf(s.get("quantity"));
        return switch (String.valueOf(s.get("status"))) {
            case "NOT_ESTIMATED" -> prefix + name + ": not estimated (" + s.get("missing_information") + ")";
            case "ESTIMATED_RANGE" -> prefix + name + ", type not stated: " + s.get("kg_min") + " to " + s.get("kg_max")
                    + " kg across the dataset's types (quantity " + qty + ")";
            default -> prefix + name + ": " + s.get("formula") + " = " + s.get("kg") + " kg";
        };
    }

    private static String delta(Map<String, Object> r) {
        String key = r.containsKey("difference_kg_min") ? "difference" : "delta";
        if ("NOT_ESTIMATED".equals(r.get("status"))) return "difference: not estimated";
        Object min = r.get(key + "_kg_min"), max = r.get(key + "_kg_max");
        String range = String.valueOf(min).equals(String.valueOf(max)) ? min + " kg" : min + " to " + max + " kg";
        return "difference: " + range + " (hypothetical; negative means lower emissions)";
    }
}
