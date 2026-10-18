package com.ecotrack.ai.agent;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Numbers that may feed arithmetic in one coach turn: the user's own message, earlier tool results,
 * and a few conventions (days, weeks, months, unit prefixes). {@code calculate} and {@code convertUnits}
 * reject any other operand, so a factor recalled from memory cannot be laundered into a "tool result".
 */
public final class GroundedNumbers {

    private static final Pattern NUMBER = Pattern.compile("\\d+(?:,\\d{3})*(?:\\.\\d+)?");
    /** Calendar, Carbon Twin and unit conventions, plus small counts (people, trips, hours). */
    private static final Set<BigDecimal> CONVENTIONS = Set.of(new BigDecimal("4.33"), new BigDecimal("7"), new BigDecimal("12"),
            new BigDecimal("24"), new BigDecimal("52"), new BigDecimal("100"), new BigDecimal("365"), new BigDecimal("1000"),
            new BigDecimal("30"), new BigDecimal("31"), new BigDecimal("1000000"), new BigDecimal("1.609344"));

    private final List<BigDecimal> pool = new CopyOnWriteArrayList<>();

    public void addText(String text) {
        if (text == null) return;
        Matcher m = NUMBER.matcher(text);
        while (m.find()) {
            try {
                pool.add(new BigDecimal(m.group().replace(",", "")));
            } catch (NumberFormatException ignored) {
                // not a number after all
            }
        }
    }

    /**
     * True when {@code v} is a convention, a whole number up to 10 (counts such as "4 of us"), or a
     * pool number written at the same or coarser precision (0.0152 for 0.015161).
     */
    public boolean contains(BigDecimal v) {
        BigDecimal a = v.abs().stripTrailingZeros();
        if (a.compareTo(BigDecimal.TEN) <= 0 && a.scale() <= 0) return true;
        if (CONVENTIONS.stream().anyMatch(c -> c.compareTo(a) == 0)) return true;
        int scale = Math.max(a.scale(), 0);
        for (BigDecimal p : pool) {
            if (p.compareTo(a) == 0) return true;
            if (p.scale() > scale && p.setScale(scale, RoundingMode.HALF_UP).compareTo(a) == 0) return true;
        }
        return false;
    }

    /** Every numeric literal in {@code expression} that is not grounded. */
    public List<String> ungroundedOperands(String expression) {
        List<String> bad = new java.util.ArrayList<>();
        Matcher m = NUMBER.matcher(expression);
        while (m.find()) {
            if (!contains(new BigDecimal(m.group().replace(",", "")))) bad.add(m.group());
        }
        return bad;
    }
}
