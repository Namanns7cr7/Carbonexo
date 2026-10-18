package com.ecotrack.ai.agent;

import com.ecotrack.factors.FactorLookup;
import com.ecotrack.factors.FactorRegistryService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Evaluates the signed-in user's activity logs under Dataset V2 rules, without rewriting history:
 * <ul>
 *   <li>V2 logs (factor_record_id set): stored kg; "measured" when backed by a confirmed bill.</li>
 *   <li>Legacy logs: re-estimated with the region's V2 factor when the activity is estimable
 *       ("re_estimated"); otherwise NOT_ESTIMATED (the legacy factor is unsupported).</li>
 *   <li>Appliance attribution rows (attribution_of set) never add to totals.</li>
 * </ul>
 * Every query is scoped by the principal's user id.
 */
@Component
public class ActivityEvaluator {

    public record Evaluated(String category, String activity, LocalDate date, BigDecimal quantity, String unit,
                            BigDecimal kg, String kind, FactorLookup lookup) {}

    private final JdbcTemplate jdbc;
    private final FactorRegistryService registry;

    public ActivityEvaluator(JdbcTemplate jdbc, FactorRegistryService registry) {
        this.jdbc = jdbc;
        this.registry = registry;
    }

    public List<Evaluated> evaluate(UUID userId, String region, LocalDate from, LocalDate to) {
        return evaluate(userId, region, from, to, false);
    }

    /** {@code approvedOnly}: legacy logs are re-estimated only with an APPROVED dataset (safe_limited mode). */
    public List<Evaluated> evaluate(UUID userId, String region, LocalDate from, LocalDate to, boolean approvedOnly) {
        if (userId == null) throw new IllegalArgumentException("userId required");
        Map<String, FactorLookup> cache = new HashMap<>();
        List<Evaluated> out = new ArrayList<>();
        jdbc.query("""
                SELECT category, factor_key, quantity, unit, co2_kg, activity_date, factor_record_id, estimate_status,
                       attribution_of, verified_by_bill_id
                FROM activity_logs WHERE user_id = ? AND deleted_at IS NULL AND activity_date BETWEEN ? AND ?
                ORDER BY activity_date""", rs -> {
            String activity = rs.getString("factor_key");
            BigDecimal qty = rs.getBigDecimal("quantity");
            String kind;
            BigDecimal kg = null;
            FactorLookup lookup = null;
            if (rs.getObject("attribution_of") != null) {
                kind = "attribution";
            } else if (rs.getString("factor_record_id") != null) {
                String st = rs.getString("estimate_status");
                if ("not_estimated".equals(st)) {
                    kind = "not_estimated";
                } else {
                    kg = rs.getBigDecimal("co2_kg");
                    kind = rs.getObject("verified_by_bill_id") != null ? "measured" : "logged_estimate";
                }
            } else if (activity != null && qty != null) {
                lookup = cache.computeIfAbsent(activity, a -> registry.lookup(a, region, null, approvedOnly));
                if (lookup.estimated()) {
                    kg = registry.calculate(lookup, qty, null).kg();
                    kind = "re_estimated";
                } else {
                    kind = "not_estimated";
                }
            } else {
                kind = "not_estimated";
            }
            out.add(new Evaluated(rs.getString("category"), activity, rs.getDate("activity_date").toLocalDate(), qty,
                    rs.getString("unit"), kg, kind, lookup));
        }, userId, from, to);
        return out;
    }
}
