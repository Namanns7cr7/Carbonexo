package com.ecotrack.factors;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.util.Locale;
import java.util.Map;

/**
 * Exact unit conversions for the coach (no approximations chosen by a model). A unit is a base unit
 * optionally divided by another: {@code kg}, {@code t/MWh}, {@code kg/week}, {@code g/km}.
 *
 * <p>Periods use the calendar: 1 year = 365 days, 1 month = 365/12 days, 1 quarter = 365/4 days,
 * 1 week = 7 days. (Carbon Twin horizons use the app's 4.33-week month and 52-week year instead;
 * see {@link CarbonTwinEngine}.)
 */
public final class Units {

    public enum Dimension { MASS, ENERGY, DISTANCE, TIME, POWER }

    record Unit(Dimension dim, BigDecimal toBase) {}

    private static final MathContext MC = MathContext.DECIMAL64;
    private static final Map<String, Unit> UNITS = Map.ofEntries(
            Map.entry("g", new Unit(Dimension.MASS, new BigDecimal("0.001"))),
            Map.entry("kg", new Unit(Dimension.MASS, BigDecimal.ONE)),
            Map.entry("t", new Unit(Dimension.MASS, new BigDecimal("1000"))),
            Map.entry("tonne", new Unit(Dimension.MASS, new BigDecimal("1000"))),
            Map.entry("tonnes", new Unit(Dimension.MASS, new BigDecimal("1000"))),
            Map.entry("wh", new Unit(Dimension.ENERGY, new BigDecimal("0.001"))),
            Map.entry("kwh", new Unit(Dimension.ENERGY, BigDecimal.ONE)),
            Map.entry("mwh", new Unit(Dimension.ENERGY, new BigDecimal("1000"))),
            Map.entry("gwh", new Unit(Dimension.ENERGY, new BigDecimal("1000000"))),
            Map.entry("w", new Unit(Dimension.POWER, new BigDecimal("0.001"))),
            Map.entry("kw", new Unit(Dimension.POWER, BigDecimal.ONE)),
            Map.entry("m", new Unit(Dimension.DISTANCE, new BigDecimal("0.001"))),
            Map.entry("km", new Unit(Dimension.DISTANCE, BigDecimal.ONE)),
            Map.entry("mi", new Unit(Dimension.DISTANCE, new BigDecimal("1.609344"))),
            Map.entry("mile", new Unit(Dimension.DISTANCE, new BigDecimal("1.609344"))),
            Map.entry("miles", new Unit(Dimension.DISTANCE, new BigDecimal("1.609344"))),
            Map.entry("hour", new Unit(Dimension.TIME, BigDecimal.ONE.divide(new BigDecimal("24"), MC))),
            Map.entry("h", new Unit(Dimension.TIME, BigDecimal.ONE.divide(new BigDecimal("24"), MC))),
            Map.entry("day", new Unit(Dimension.TIME, BigDecimal.ONE)),
            Map.entry("week", new Unit(Dimension.TIME, new BigDecimal("7"))),
            Map.entry("month", new Unit(Dimension.TIME, new BigDecimal("365").divide(new BigDecimal("12"), MC))),
            Map.entry("quarter", new Unit(Dimension.TIME, new BigDecimal("91.25"))),
            Map.entry("year", new Unit(Dimension.TIME, new BigDecimal("365"))));

    private Units() {}

    /** @throws IllegalArgumentException for an unknown unit or incompatible dimensions */
    public static BigDecimal convert(BigDecimal value, String from, String to) {
        String[] f = split(from), t = split(to);
        Unit fn = unit(f[0]), tn = unit(t[0]);
        if (fn.dim() != tn.dim()) throw new IllegalArgumentException("cannot convert " + from + " to " + to);
        BigDecimal ratio = fn.toBase().divide(tn.toBase(), MC);
        if (f.length != t.length) throw new IllegalArgumentException("cannot convert " + from + " to " + to);
        if (f.length == 2) {
            Unit fd = unit(f[1]), td = unit(t[1]);
            if (fd.dim() != td.dim()) throw new IllegalArgumentException("cannot convert " + from + " to " + to);
            ratio = ratio.multiply(td.toBase().divide(fd.toBase(), MC), MC);
        }
        return value.multiply(ratio, MC);
    }

    /** Dimension of a simple unit ("mi" -> DISTANCE), or null when unknown. */
    public static Dimension dimension(String unit) {
        Unit u = UNITS.get(norm(unit));
        return u == null ? null : u.dim();
    }

    /** Display rounding: up to 6 decimal places, trailing zeros removed. */
    public static BigDecimal tidy(BigDecimal v) {
        BigDecimal r = v.setScale(6, RoundingMode.HALF_UP).stripTrailingZeros();
        return r.scale() < 0 ? r.setScale(0) : r;
    }

    private static Unit unit(String u) {
        Unit unit = UNITS.get(norm(u));
        if (unit == null) throw new IllegalArgumentException("unknown unit '" + u + "'");
        return unit;
    }

    private static String[] split(String unit) {
        if (unit == null || unit.isBlank()) throw new IllegalArgumentException("unit is required");
        String u = unit.trim().toLowerCase(Locale.ROOT).replace(" per ", "/").replaceAll("\\bco2e?\\b|co₂e?", "").replace(" ", "");
        String[] parts = u.split("/");
        if (parts.length > 2 || parts[0].isEmpty()) throw new IllegalArgumentException("unsupported unit '" + unit + "'");
        return parts;
    }

    private static String norm(String u) {
        return u == null ? "" : u.trim().toLowerCase(Locale.ROOT);
    }
}
