package com.ecotrack.ai.agent;

import com.ecotrack.factors.CarbonTwinEngine;
import com.ecotrack.factors.FactorLookup;
import com.ecotrack.factors.FactorRecord;
import com.ecotrack.factors.FactorRegistryService;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Renders registry lookups for the model: value, unit, region, year, source, boundary, status, uncertainty. */
final class FactorJson {

    private FactorJson() {}

    static Map<String, Object> lookup(FactorLookup l, SourceLedger ledger) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activity", l.activityKey());
        m.put("variant", l.variant());
        m.put("region", l.region());
        if (!l.estimated()) {
            m.put("status", "NOT_ESTIMATED");
            m.put("reason", String.valueOf(l.reason()));
            m.put("missing_information", l.missingInformation());
            return m;
        }
        m.put("status", l.status().name());
        m.put("authority", l.authority().name());
        if (l.authority() == FactorLookup.Authority.CANDIDATE) {
            m.put("review_note", "candidate factor: not yet reviewed by a person; call it provisional");
        }
        FactorRecord f = l.factor();
        if (f == null) {
            m.put("factor_value", 0);
            m.put("unit", "kg/km");
            m.put("boundary", "operational emissions only (definition); manufacturing and food energy excluded");
            return m;
        }
        m.put("factor_id", f.factorId());
        m.put("factor_value", f.value());
        m.put("unit", f.unit());
        m.put("measured_region", f.region());
        if (l.proxy()) m.put("proxy_note", "global average used as a proxy for " + l.region() + "; uncertainty " + f.uncertaintyLevel());
        m.put("applicable_year", f.applicableYear());
        m.put("gases", f.gases());
        m.put("boundary", f.systemBoundary());
        m.put("scope", f.scope());
        m.put("uncertainty", f.uncertaintyLevel() + (f.uncertaintyNotes() == null ? "" : ": " + f.uncertaintyNotes()));
        m.put("verification", f.verificationStatus());
        if (l.accountingRule() != null) m.put("accounting_rule", l.accountingRule());
        m.put("source", f.sourcePublisher() + ", " + f.sourceLocator());
        m.put("cite", ledger.cite("factor:" + f.factorId(), "factor_source", f.sourceId(), f.sourcePublisher() + " — " + f.sourceTitle(),
                f.sourceUrl(), f.sourceLocator(), l.authority().name()));
        return m;
    }

    /** Renders one side computed by the shared {@link CarbonTwinEngine}: exact kg, a range over types, or NOT_ESTIMATED. */
    static Map<String, Object> side(CarbonTwinEngine engine, ToolContext ctx, String activity, String variant,
                                    BigDecimal quantity, Integer occupancy) {
        return render(engine.side(activity, variant, quantity, occupancy, ctx.region(), ctx.approvedOnly()), ctx);
    }

    static Map<String, Object> render(CarbonTwinEngine.Side sd, ToolContext ctx) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("activity", sd.activity());
        if (sd.variant() != null) m.put("variant", sd.variant());
        m.put("quantity", sd.quantity());
        switch (sd.status()) {
            case ESTIMATED -> {
                m.put("status", sd.lookup().status().name());
                m.put("kg", sd.kgMin());
                m.put("formula", sd.calculation().formula());
                m.put("factor", lookup(sd.lookup(), ctx.sources()));
                m.put("receipt", sd.calculation().receipt());
            }
            case ESTIMATED_RANGE -> {
                List<Map<String, Object>> rows = new java.util.ArrayList<>();
                for (CarbonTwinEngine.Variant v : sd.variants()) {
                    rows.add(Map.of("variant", v.lookup().variant(), "kg", v.calculation().kg(),
                            "cite", lookup(v.lookup(), ctx.sources()).getOrDefault("cite", "")));
                }
                m.put("status", "ESTIMATED_RANGE");
                m.put("assumption", "type not stated, so the range covers all " + rows.size()
                        + " types in the dataset; ask the user for the type to narrow it");
                m.put("kg_min", sd.kgMin());
                m.put("kg_max", sd.kgMax());
                m.put("by_variant", rows);
            }
            case NOT_ESTIMATED -> {
                m.put("status", "NOT_ESTIMATED");
                m.put("reason", String.valueOf(sd.reason()));
                m.put("missing_information", sd.missingInformation());
            }
        }
        return m;
    }

    /** Puts the engine's alternative-minus-baseline delta under {@code prefix}_kg_min/max, or "not estimated". */
    static void putDelta(Map<String, Object> m, String prefix, CarbonTwinEngine.Delta d) {
        if (d.status() == CarbonTwinEngine.SideStatus.NOT_ESTIMATED) {
            m.put("status", "NOT_ESTIMATED");
            m.put(prefix, "not estimated: " + d.missingInformation());
        } else {
            m.put("status", d.status().name());
            m.put(prefix + "_kg_min", d.min());
            m.put(prefix + "_kg_max", d.max());
        }
    }

    static BigDecimal round(BigDecimal v) {
        return v.setScale(3, RoundingMode.HALF_UP);
    }
}
