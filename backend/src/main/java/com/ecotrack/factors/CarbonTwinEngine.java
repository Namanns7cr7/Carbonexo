package com.ecotrack.factors;

import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;

/**
 * The one Carbon Twin calculation, shared by the Simulate screen ({@code SimulationService}) and the
 * coach's tools, so the two can never disagree. Every number comes from {@link FactorRegistryService}:
 * <ul>
 *   <li>an unknown or unsupported activity is NOT_ESTIMATED, never zero;</li>
 *   <li>an activity whose type is not stated (car without fuel/engine) becomes a min-max range over
 *       the dataset's types, never an average invented here;</li>
 *   <li>horizons: a month is 4.33 weeks and a year 52 weeks; per_month frequency is 1/4.33 per week.</li>
 * </ul>
 * Results are hypothetical: nothing is logged and no credits are awarded.
 */
@Service
public class CarbonTwinEngine {

    public static final BigDecimal WEEKS_PER_MONTH = new BigDecimal("4.33");
    public static final BigDecimal WEEKS_PER_YEAR = new BigDecimal("52");

    public enum Horizon { MONTH, YEAR }

    public enum SideStatus { ESTIMATED, ESTIMATED_RANGE, NOT_ESTIMATED }

    public record Variant(FactorLookup lookup, FactorRegistryService.Calculation calculation) {}

    /** One side of a scenario. For ESTIMATED, kgMin == kgMax and {@code calculation} holds the receipt. */
    public record Side(SideStatus status, String activity, String variant, BigDecimal quantity, BigDecimal kgMin,
                       BigDecimal kgMax, FactorLookup lookup, FactorRegistryService.Calculation calculation,
                       List<Variant> variants, FactorLookup.Reason reason, String missingInformation) {
        public boolean estimated() { return status != SideStatus.NOT_ESTIMATED; }
    }

    /** alternative - baseline; negative means the alternative would emit less. */
    public record Delta(SideStatus status, BigDecimal min, BigDecimal max, String missingInformation) {}

    private final FactorRegistryService registry;

    public CarbonTwinEngine(FactorRegistryService registry) {
        this.registry = registry;
    }

    /** @throws IllegalArgumentException on misuse (negative quantity, occupancy on a per-passenger factor) */
    public Side side(String activity, String variant, BigDecimal quantity, Integer occupancy, String region, boolean approvedOnly) {
        FactorLookup l = registry.lookup(activity, region, variant, approvedOnly);
        if (l.estimated()) {
            FactorRegistryService.Calculation c = registry.calculate(l, quantity, occupancy);
            return new Side(SideStatus.ESTIMATED, activity, variant, quantity, c.kg(), c.kg(), l, c, List.of(), FactorLookup.Reason.OK, null);
        }
        List<FactorLookup> vs = registry.estimableVariants(activity, region, approvedOnly);
        if (l.reason() == FactorLookup.Reason.VARIANT_REQUIRED && !vs.isEmpty()) {
            BigDecimal min = null, max = null;
            List<Variant> rows = new ArrayList<>();
            for (FactorLookup v : vs) {
                FactorRegistryService.Calculation c = registry.calculate(v, quantity, occupancy);
                min = min == null || c.kg().compareTo(min) < 0 ? c.kg() : min;
                max = max == null || c.kg().compareTo(max) > 0 ? c.kg() : max;
                rows.add(new Variant(v, c));
            }
            return new Side(SideStatus.ESTIMATED_RANGE, activity, variant, quantity, min, max, l, null, rows, l.reason(), l.missingInformation());
        }
        String missing = l.missingInformation();
        if (variant != null && !vs.isEmpty()) {   // a type that does not exist in this region (e.g. an Indian car class for a UK user)
            missing = "a known type of " + activity + " in " + region + "; available: "
                    + String.join(", ", vs.stream().map(FactorLookup::variant).toList());
        }
        return new Side(SideStatus.NOT_ESTIMATED, activity, variant, quantity, null, null, l, null, List.of(), l.reason(), missing);
    }

    public static Delta delta(Side baseline, Side alternative) {
        if (!baseline.estimated() || !alternative.estimated()) {
            Side missing = baseline.estimated() ? alternative : baseline;
            return new Delta(SideStatus.NOT_ESTIMATED, null, null, missing.missingInformation());
        }
        boolean exact = baseline.status() == SideStatus.ESTIMATED && alternative.status() == SideStatus.ESTIMATED;
        return new Delta(exact ? SideStatus.ESTIMATED : SideStatus.ESTIMATED_RANGE,
                round(alternative.kgMin().subtract(baseline.kgMax())), round(alternative.kgMax().subtract(baseline.kgMin())), null);
    }

    public static BigDecimal weeklyOccurrences(String frequency) {
        if (frequency == null) throw new IllegalArgumentException("frequency is required");
        return switch (frequency) {
            case "per_day" -> BigDecimal.valueOf(7);
            case "per_week" -> BigDecimal.ONE;
            case "per_month" -> BigDecimal.ONE.divide(WEEKS_PER_MONTH, 6, RoundingMode.HALF_UP);
            default -> throw new IllegalArgumentException("frequency must be per_day, per_week or per_month");
        };
    }

    public static BigDecimal horizonWeeks(Horizon horizon) {
        return horizon == Horizon.YEAR ? WEEKS_PER_YEAR : WEEKS_PER_MONTH;
    }

    /** Per-occurrence quantity x occurrences per week x weeks in the horizon. */
    public static BigDecimal horizonQuantity(BigDecimal perOccurrence, String frequency, Horizon horizon) {
        return perOccurrence.multiply(weeklyOccurrences(frequency)).multiply(horizonWeeks(horizon));
    }

    public static BigDecimal round(BigDecimal v) {
        return v.setScale(3, RoundingMode.HALF_UP);
    }
}
