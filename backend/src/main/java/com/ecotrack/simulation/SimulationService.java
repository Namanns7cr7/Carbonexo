package com.ecotrack.simulation;

import com.ecotrack.carbon.ActivityLog;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.credit.CreditRuleEngine;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import com.ecotrack.simulation.dto.SimulationRequest;
import com.ecotrack.simulation.dto.SimulationResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * "Carbon twin" simulation engine. Given a set of hypothetical habit changes,
 * projects their CO2 impact over a horizon (month/year) using the SAME
 * emission-factor lookup and CO2 math real activity logging uses
 * ({@link CarbonCalculationService#calculateCo2}), so simulated and real
 * numbers never drift.
 *
 * Pure computation: reads the user's recent {@code activity_logs} and the
 * {@code emission_factors} table, and never writes anything — no activity
 * log is created, no credits are actually awarded.
 */
@Service
public class SimulationService {

    /** Default weekly reduction target when the user has no profile goal set yet. */
    private static final int DEFAULT_WEEKLY_GOAL_PCT = 15;

    /**
     * Horizon-scaling convention: reused from the ratio the rest of the app
     * already uses when turning a weekly figure into a longer one (the
     * dashboard's week window is 7 days; there a month ~ 4.33 weeks and a
     * year is exactly 52 weeks). No such constant existed yet in the
     * codebase, so this is the one judgment call in this feature — documented
     * here rather than invented silently.
     */
    private static final BigDecimal WEEKS_PER_MONTH = new BigDecimal("4.33");
    private static final BigDecimal WEEKS_PER_YEAR = new BigDecimal("52");

    private final ActivityLogRepository logRepo;
    private final CarbonCalculationService carbonService;
    private final CreditRuleEngine creditRuleEngine;
    private final UserProfileRepository profileRepo;

    public SimulationService(ActivityLogRepository logRepo,
                              CarbonCalculationService carbonService,
                              CreditRuleEngine creditRuleEngine,
                              UserProfileRepository profileRepo) {
        this.logRepo = logRepo;
        this.carbonService = carbonService;
        this.creditRuleEngine = creditRuleEngine;
        this.profileRepo = profileRepo;
    }

    @Transactional(readOnly = true)
    public SimulationResponse simulate(UUID userId, SimulationRequest request) {
        if (request.changes() == null || request.changes().isEmpty()) {
            throw new BadRequestException("At least one simulated change is required");
        }

        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        String region = profile != null && profile.getRegion() != null ? profile.getRegion() : "GLOBAL";
        int weeklyGoalPct = profile != null && profile.getWeeklyGoalPct() != null
                ? profile.getWeeklyGoalPct() : DEFAULT_WEEKLY_GOAL_PCT;

        BigDecimal horizonWeeks = horizonWeeks(request.horizon());

        // Real weekly footprint, derived from the same 7-day window DashboardService
        // uses for its week chart — read-only, used ONLY as context for the goal-bar
        // target denominator below. It must NOT be mixed into baselineCo2Kg/
        // projectedCo2Kg: those represent the simulated items themselves (what the
        // user describes as their current rate for each change), which is a
        // different, unrelated number from their actual historical logs — a new
        // user with zero logged history can still run a meaningful simulation.
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);
        BigDecimal weeklyActualCo2 = logRepo.findByUserIdAndDateRange(userId, weekStart, today).stream()
                .map(ActivityLog::getCo2Kg)
                .reduce(BigDecimal.ZERO, BigDecimal::add);

        List<SimulationResponse.BreakdownItem> breakdown = new ArrayList<>();
        BigDecimal baselineChangesKg = BigDecimal.ZERO;
        BigDecimal projectedChangesKg = BigDecimal.ZERO;

        for (SimulationRequest.SimulationItem item : request.changes()) {
            BigDecimal weeklyOccurrences = weeklyOccurrences(item.frequency());
            BigDecimal horizonQuantity = item.quantity()
                    .multiply(weeklyOccurrences)
                    .multiply(horizonWeeks);

            BigDecimal itemBaselineKg = carbonService.calculateCo2(item.factorKey(), horizonQuantity, region);
            BigDecimal itemProjectedKg = projectedKgForItem(item, weeklyOccurrences, horizonWeeks, region);

            baselineChangesKg = baselineChangesKg.add(itemBaselineKg);
            projectedChangesKg = projectedChangesKg.add(itemProjectedKg);
            breakdown.add(new SimulationResponse.BreakdownItem(item.factorKey(), itemBaselineKg, itemProjectedKg));
        }

        BigDecimal baselineCo2Kg = baselineChangesKg.setScale(3, RoundingMode.HALF_UP);
        BigDecimal projectedCo2Kg = projectedChangesKg.max(BigDecimal.ZERO).setScale(3, RoundingMode.HALF_UP);
        BigDecimal deltaCo2Kg = projectedCo2Kg.subtract(baselineCo2Kg).setScale(3, RoundingMode.HALF_UP);

        SimulationResponse.WeeklyGoalImpact weeklyGoalImpact =
                weeklyGoalImpact(weeklyActualCo2, weeklyGoalPct, deltaCo2Kg, horizonWeeks);

        BigDecimal kgSavedForCredits = baselineCo2Kg.subtract(projectedCo2Kg).max(BigDecimal.ZERO);
        int projectedCreditsDelta = creditRuleEngine.creditsForKgSaved(kgSavedForCredits.doubleValue());

        return new SimulationResponse(
                baselineCo2Kg, projectedCo2Kg, deltaCo2Kg,
                weeklyGoalImpact, projectedCreditsDelta, breakdown
        );
    }

    private BigDecimal projectedKgForItem(SimulationRequest.SimulationItem item,
                                           BigDecimal weeklyOccurrences,
                                           BigDecimal horizonWeeks,
                                           String region) {
        if (item.deltaType() == SimulationRequest.DeltaType.REPLACE_WITH) {
            String replacementKey = item.replacementFactorKey();
            if (replacementKey == null || replacementKey.isBlank()) {
                throw new BadRequestException("replacementFactorKey is required for REPLACE_WITH changes");
            }
            BigDecimal horizonQuantity = item.quantity().multiply(weeklyOccurrences).multiply(horizonWeeks);
            return carbonService.calculateCo2(replacementKey, horizonQuantity, region);
        }

        // REDUCE_BY: cut the per-occurrence quantity by `amount` (never below zero).
        BigDecimal amount = item.amount() != null ? item.amount() : BigDecimal.ZERO;
        BigDecimal reducedQuantity = item.quantity().subtract(amount).max(BigDecimal.ZERO);
        BigDecimal reducedHorizonQuantity = reducedQuantity.multiply(weeklyOccurrences).multiply(horizonWeeks);
        return carbonService.calculateCo2(item.factorKey(), reducedHorizonQuantity, region);
    }

    /**
     * Judgment call: the goal-bar target is the same "weekly CO2 * goal %"
     * figure the frontend action-plan screen already uses
     * (app/app/actions/page.tsx: {@code goalKg = weekTotal * weeklyGoalPct / 100}).
     * "currentProgressPct" is 0 because the simulation only evaluates
     * hypothetical, not-yet-adopted changes; "projectedProgressPct" is how
     * much of that weekly target the simulated weekly saving would cover.
     */
    private SimulationResponse.WeeklyGoalImpact weeklyGoalImpact(BigDecimal weeklyActualCo2,
                                                                   int weeklyGoalPct,
                                                                   BigDecimal deltaCo2Kg,
                                                                   BigDecimal horizonWeeks) {
        BigDecimal weeklyGoalTargetKg = weeklyActualCo2
                .multiply(BigDecimal.valueOf(weeklyGoalPct))
                .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);

        BigDecimal weeklySavingFromChange = deltaCo2Kg.negate()
                .divide(horizonWeeks, 4, RoundingMode.HALF_UP)
                .max(BigDecimal.ZERO);

        int projectedProgressPct = 0;
        if (weeklyGoalTargetKg.compareTo(BigDecimal.ZERO) > 0) {
            projectedProgressPct = weeklySavingFromChange
                    .divide(weeklyGoalTargetKg, 4, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .min(BigDecimal.valueOf(100))
                    .setScale(0, RoundingMode.HALF_UP)
                    .intValue();
        }
        return new SimulationResponse.WeeklyGoalImpact(0, projectedProgressPct);
    }

    private BigDecimal horizonWeeks(SimulationRequest.Horizon horizon) {
        return horizon == SimulationRequest.Horizon.YEAR ? WEEKS_PER_YEAR : WEEKS_PER_MONTH;
    }

    /** Normalizes a change's frequency string to an equivalent weekly occurrence count. */
    private BigDecimal weeklyOccurrences(String frequency) {
        if (frequency == null) return BigDecimal.ONE;
        return switch (frequency) {
            case "per_day" -> BigDecimal.valueOf(7);
            case "per_week" -> BigDecimal.ONE;
            case "per_month" -> BigDecimal.ONE.divide(WEEKS_PER_MONTH, 6, RoundingMode.HALF_UP);
            default -> BigDecimal.ONE;
        };
    }
}
