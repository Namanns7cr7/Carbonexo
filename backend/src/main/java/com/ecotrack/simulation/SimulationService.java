package com.ecotrack.simulation;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.AIResult;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.carbon.ActivityLog;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AppProperties;
import com.ecotrack.credit.CreditRuleEngine;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.factors.CarbonTwinEngine;
import com.ecotrack.factors.CarbonTwinEngine.Side;
import com.ecotrack.factors.CarbonTwinEngine.SideStatus;
import com.ecotrack.factors.FactorLookup;
import com.ecotrack.factors.FactorRegistryService;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import com.ecotrack.simulation.dto.SimulationRequest;
import com.ecotrack.simulation.dto.SimulationResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * "Carbon twin" simulation engine for the Simulate screen. The arithmetic is
 * {@link CarbonTwinEngine}'s, the same code the AI coach's Carbon Twin tool uses, over the
 * Dataset V2 registry ({@link FactorRegistryService}), so the screen and the coach always agree.
 *
 * <ul>
 *   <li>An activity with no factor for the user's region is NOT_ESTIMATED and left out of the
 *       totals, never counted as zero (replacing a car with the metro used to show the whole car
 *       figure as a reduction).</li>
 *   <li>An unstated type (car without fuel/engine) gives a min-max range over the region's types.</li>
 *   <li>A custom rate the user typed is used as stated and labelled "user_supplied".</li>
 *   <li>Projected credits are shown only for exact results from an APPROVED dataset with no
 *       user-supplied rates; they are projections, never awarded.</li>
 * </ul>
 * Pure computation: never writes anything.
 */
@Service
public class SimulationService {

    private static final Logger log = LoggerFactory.getLogger(SimulationService.class);

    /** Default weekly reduction target when the user has no profile goal set yet. */
    private static final int DEFAULT_WEEKLY_GOAL_PCT = 15;

    private final ActivityLogRepository logRepo;
    private final CarbonTwinEngine engine;
    private final FactorRegistryService registry;
    private final CreditRuleEngine creditRuleEngine;
    private final UserProfileRepository profileRepo;
    private final AIProvider aiProvider;
    private final PromptRenderer promptRenderer;
    private final AppProperties props;

    public SimulationService(ActivityLogRepository logRepo,
                             CarbonTwinEngine engine,
                             FactorRegistryService registry,
                             CreditRuleEngine creditRuleEngine,
                             UserProfileRepository profileRepo,
                             AIProvider aiProvider,
                             PromptRenderer promptRenderer,
                             AppProperties props) {
        this.logRepo = logRepo;
        this.engine = engine;
        this.registry = registry;
        this.creditRuleEngine = creditRuleEngine;
        this.profileRepo = profileRepo;
        this.aiProvider = aiProvider;
        this.promptRenderer = promptRenderer;
        this.props = props;
    }

    /** One change's two sides, each from the registry or a user-supplied rate. */
    private record ItemResult(String key, Side baseline, Side projected, boolean userSupplied) {}

    @Transactional(readOnly = true)
    public SimulationResponse simulate(UUID userId, SimulationRequest request) {
        return simulate(userId, request, true);
    }

    @Transactional(readOnly = true)
    public SimulationResponse simulate(UUID userId, SimulationRequest request, boolean includeInsight) {
        if (request.changes() == null || request.changes().isEmpty()) {
            throw new BadRequestException("At least one simulated change is required");
        }

        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        String region = profile != null && profile.getRegion() != null ? profile.getRegion() : "GLOBAL";
        int weeklyGoalPct = profile != null && profile.getWeeklyGoalPct() != null
                ? profile.getWeeklyGoalPct() : DEFAULT_WEEKLY_GOAL_PCT;
        CarbonTwinEngine.Horizon horizon = CarbonTwinEngine.Horizon.valueOf(request.horizon().name());
        BigDecimal horizonWeeks = CarbonTwinEngine.horizonWeeks(horizon);

        // Real weekly footprint (the dashboard's 7-day window), used ONLY as the goal-bar denominator.
        LocalDate today = LocalDate.now();
        BigDecimal weeklyActualCo2 = logRepo.findByUserIdAndDateRange(userId, today.minusDays(6), today).stream()
                .map(ActivityLog::getCo2Kg)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<ItemResult> items = new ArrayList<>();
        for (SimulationRequest.SimulationItem item : request.changes()) {
            validateItemHasAFactor(item);
            items.add(evaluate(item, horizon, region));
        }

        List<SimulationResponse.BreakdownItem> breakdown = new ArrayList<>();
        BigDecimal deltaMin = BigDecimal.ZERO, deltaMax = BigDecimal.ZERO, baseSum = BigDecimal.ZERO, projSum = BigDecimal.ZERO;
        int estimated = 0;
        boolean ranges = false, userSupplied = false;
        for (ItemResult r : items) {
            CarbonTwinEngine.Delta d = CarbonTwinEngine.delta(r.baseline(), r.projected());
            boolean exact = d.status() == SideStatus.ESTIMATED;
            String missing = d.status() == SideStatus.NOT_ESTIMATED ? d.missingInformation() : null;
            breakdown.add(new SimulationResponse.BreakdownItem(r.key(),
                    exact ? r.baseline().kgMin() : null, exact ? r.projected().kgMin() : null, d.status().name(),
                    r.baseline().kgMin(), r.baseline().kgMax(), r.projected().kgMin(), r.projected().kgMax(),
                    missing, r.userSupplied() ? "user_supplied" : "registry"));
            if (d.status() == SideStatus.NOT_ESTIMATED) continue;
            estimated++;
            ranges |= !exact;
            userSupplied |= r.userSupplied();
            deltaMin = deltaMin.add(d.min());
            deltaMax = deltaMax.add(d.max());
            if (exact) {
                baseSum = baseSum.add(r.baseline().kgMin());
                projSum = projSum.add(r.projected().kgMin());
            }
        }

        String status = estimated == 0 ? "NOT_ESTIMATED" : estimated < items.size() ? "PARTIAL" : ranges ? "ESTIMATED_RANGE" : "ESTIMATED";
        boolean allExact = "ESTIMATED".equals(status);
        BigDecimal baselineCo2Kg = allExact ? scale(baseSum) : null;
        BigDecimal projectedCo2Kg = allExact ? scale(projSum) : null;
        BigDecimal deltaCo2Kg = allExact ? scale(projSum.subtract(baseSum)) : null;
        String authority = registry.authority().map(Enum::name).orElse("NONE");

        SimulationResponse.WeeklyGoalImpact goal = allExact
                ? weeklyGoalImpact(weeklyActualCo2, weeklyGoalPct, deltaCo2Kg, horizonWeeks)
                : new SimulationResponse.WeeklyGoalImpact(0, 0);
        int credits = 0;
        if (allExact && !userSupplied && FactorLookup.Authority.APPROVED.name().equals(authority)) {
            credits = creditRuleEngine.creditsForKgSaved(baseSum.subtract(projSum).max(BigDecimal.ZERO).doubleValue());
        }

        String insight = includeInsight
                ? insight(status, deltaCo2Kg, deltaMin, deltaMax, goal.projectedProgressPct(), credits, request.horizon(), breakdown)
                : null;
        return new SimulationResponse(baselineCo2Kg, projectedCo2Kg, deltaCo2Kg, goal, credits, breakdown, insight, status,
                estimated == 0 ? null : scale(deltaMin), estimated == 0 ? null : scale(deltaMax), registry.datasetVersion(), authority);
    }

    private ItemResult evaluate(SimulationRequest.SimulationItem item, CarbonTwinEngine.Horizon horizon, String region) {
        BigDecimal weekly = weeklyOccurrences(item.frequency());
        BigDecimal qty = item.quantity().multiply(weekly).multiply(CarbonTwinEngine.horizonWeeks(horizon));
        boolean custom = item.factorKey() == null || item.factorKey().isBlank();
        Side baseline = custom ? userSupplied(item.customLabel(), qty, item.customFactorKgPerUnit())
                : side(item.factorKey(), item.variant(), qty, region);
        Side projected;
        boolean customReplacement = false;
        if (item.deltaType() == SimulationRequest.DeltaType.REPLACE_WITH) {
            boolean hasCatalog = item.replacementFactorKey() != null && !item.replacementFactorKey().isBlank();
            boolean hasCustom = item.customReplacementLabel() != null && !item.customReplacementLabel().isBlank()
                    && item.customReplacementFactorKgPerUnit() != null && item.customReplacementFactorKgPerUnit().signum() >= 0;
            if (hasCatalog) {
                projected = side(item.replacementFactorKey(), item.replacementVariant(), qty, region);
            } else if (hasCustom) {
                projected = userSupplied(item.customReplacementLabel(), qty, item.customReplacementFactorKgPerUnit());
                customReplacement = true;
            } else {
                throw new BadRequestException(
                        "REPLACE_WITH needs replacementFactorKey or both customReplacementLabel and customReplacementFactorKgPerUnit");
            }
        } else {
            // REDUCE_BY: cut the per-occurrence quantity by `amount` (never below zero), same factor.
            BigDecimal amount = item.amount() != null ? item.amount() : BigDecimal.ZERO;
            BigDecimal reduced = item.quantity().subtract(amount).max(BigDecimal.ZERO)
                    .multiply(weekly).multiply(CarbonTwinEngine.horizonWeeks(horizon));
            projected = custom ? userSupplied(item.customLabel(), reduced, item.customFactorKgPerUnit())
                    : side(item.factorKey(), item.variant(), reduced, region);
        }
        String key = custom ? item.customLabel() : item.factorKey();
        return new ItemResult(key, baseline, projected, custom || customReplacement);
    }

    private Side side(String activity, String variant, BigDecimal qty, String region) {
        try {
            return engine.side(activity, variant, qty, null, region, false);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(e.getMessage());
        }
    }

    /** A rate the user typed for something not in the dataset: used as stated, read-only, labelled. */
    private static Side userSupplied(String label, BigDecimal qty, BigDecimal kgPerUnit) {
        if (kgPerUnit == null || kgPerUnit.signum() < 0) throw new BadRequestException("customFactorKgPerUnit must be >= 0");
        BigDecimal kg = qty.multiply(kgPerUnit).setScale(3, RoundingMode.HALF_UP);
        return new Side(SideStatus.ESTIMATED, label, null, qty, kg, kg, null, null, List.of(), FactorLookup.Reason.OK, null);
    }

    /**
     * Wording is deterministic unless the result is exact and a live model answers; fallback text is
     * never presented as AI output, and a not-estimated result is never described with numbers.
     */
    private String insight(String status, BigDecimal delta, BigDecimal min, BigDecimal max, int progressPct, int credits,
                           SimulationRequest.Horizon horizon, List<SimulationResponse.BreakdownItem> breakdown) {
        String period = horizon.name().toLowerCase();
        String missing = breakdown.stream().filter(b -> "NOT_ESTIMATED".equals(b.status()))
                .map(b -> b.factorKey() + ": " + b.missingInformation()).reduce((a, b) -> a + "; " + b).orElse("");
        switch (status) {
            case "NOT_ESTIMATED":
                return "Not estimated: " + missing + ".";
            case "PARTIAL":
                return "Partly estimated. Over one " + period + " the estimated changes would shift emissions by " + scale(min)
                        + (min.compareTo(max) == 0 ? "" : " to " + scale(max)) + " kg CO2e. Not estimated: " + missing + ".";
            case "ESTIMATED_RANGE":
                return "Over one " + period + " this would shift emissions by " + scale(min) + " to " + scale(max)
                        + " kg CO2e, depending on the vehicle or product type. Choose the type to narrow the range.";
            default:
                break;
        }
        try {
            String prompt = promptRenderer.render("simulation_insight", Map.of(
                    "delta_kg", delta.toString(),
                    "projected_progress_pct", String.valueOf(progressPct),
                    "projected_credits", String.valueOf(credits),
                    "horizon", period));
            AIResult r = aiProvider.generateResult(prompt, props.ai().fastModel());
            if (r.live() && r.text() != null && !r.text().isBlank()) return r.text();
        } catch (Exception e) {
            log.warn("AI simulation-insight generation failed: {}", e.toString());
        }
        return "Over the next " + period + ", this change would shift emissions by " + delta + " kg CO2e (hypothetical)"
                + (progressPct > 0 ? ", about " + progressPct + "% of your weekly goal" : "") + ".";
    }

    /** A custom activity must supply both a label and a rate. */
    private void validateItemHasAFactor(SimulationRequest.SimulationItem item) {
        boolean hasCatalogFactor = item.factorKey() != null && !item.factorKey().isBlank();
        boolean hasCustomFactor = item.customLabel() != null && !item.customLabel().isBlank()
                && item.customFactorKgPerUnit() != null;
        if (!hasCatalogFactor && !hasCustomFactor) {
            throw new BadRequestException(
                    "Each change needs either factorKey or both customLabel and customFactorKgPerUnit");
        }
    }

    /**
     * Goal-bar target = weekly CO2 x goal % (as on the action-plan screen); projected progress is how
     * much of that weekly target the simulated weekly change would cover.
     */
    private SimulationResponse.WeeklyGoalImpact weeklyGoalImpact(BigDecimal weeklyActualCo2, int weeklyGoalPct,
                                                                 BigDecimal deltaCo2Kg, BigDecimal horizonWeeks) {
        BigDecimal weeklyGoalTargetKg = weeklyActualCo2
                .multiply(BigDecimal.valueOf(weeklyGoalPct))
                .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        BigDecimal weeklyChange = deltaCo2Kg.negate().divide(horizonWeeks, 4, RoundingMode.HALF_UP).max(BigDecimal.ZERO);
        int projectedProgressPct = 0;
        if (weeklyGoalTargetKg.compareTo(BigDecimal.ZERO) > 0) {
            projectedProgressPct = weeklyChange
                    .divide(weeklyGoalTargetKg, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .min(BigDecimal.valueOf(100))
                    .setScale(0, RoundingMode.HALF_UP)
                    .intValue();
        }
        return new SimulationResponse.WeeklyGoalImpact(0, projectedProgressPct);
    }

    private static BigDecimal weeklyOccurrences(String frequency) {
        try {
            return CarbonTwinEngine.weeklyOccurrences(frequency);
        } catch (IllegalArgumentException e) {
            throw new BadRequestException(e.getMessage());
        }
    }

    private static BigDecimal scale(BigDecimal v) {
        return v.setScale(3, RoundingMode.HALF_UP);
    }
}
