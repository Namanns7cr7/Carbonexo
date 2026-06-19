package com.ecotrack.carbon;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Carbon calculation engine — reads emission factors from the database (never
 * hardcoded). Computes electricity carbon, transport carbon, monthly/yearly
 * totals, and carbon saved.
 */
@Service
public class CarbonCalculationService {

    private static final Logger log = LoggerFactory.getLogger(CarbonCalculationService.class);

    private final EmissionFactorRepository factorRepo;
    private final ActivityLogRepository logRepo;
    private final AppConfigService appConfig;
    private final double defaultElectricityFactor;

    public CarbonCalculationService(EmissionFactorRepository factorRepo,
                                     ActivityLogRepository logRepo,
                                     AppConfigService appConfig,
                                     AppProperties props) {
        this.factorRepo = factorRepo;
        this.logRepo = logRepo;
        this.appConfig = appConfig;
        this.defaultElectricityFactor = props.carbon().electricityFactorDefault();
    }

    /**
     * Calculate CO2 for a given quantity and factor key.
     * Reads the factor from the database; falls back to the config default for electricity.
     */
    public BigDecimal calculateCo2(String factorKey, BigDecimal quantity, String region) {
        Optional<EmissionFactor> factor = factorRepo.findActiveByKeyAndRegion(factorKey, region);
        if (factor.isPresent()) {
            return quantity.multiply(factor.get().getFactorKgPerUnit()).setScale(3, RoundingMode.HALF_UP);
        }
        // fallback for electricity if no factor found
        if (factorKey != null && factorKey.contains("electricity")) {
            double fallback = appConfig.getDouble("carbon.electricity_factor_default", defaultElectricityFactor);
            return quantity.multiply(BigDecimal.valueOf(fallback)).setScale(3, RoundingMode.HALF_UP);
        }
        log.warn("No emission factor found for key={}, region={}", factorKey, region);
        return BigDecimal.ZERO;
    }

    /** Electricity carbon from kWh consumed. */
    public BigDecimal electricityCarbon(BigDecimal kWh, String region) {
        return calculateCo2("home_electricity", kWh, region);
    }

    /** Transport carbon from km and mode factor key. */
    public BigDecimal transportCarbon(String modeFactorKey, BigDecimal km, String region) {
        return calculateCo2(modeFactorKey, km, region);
    }

    /** Total CO2 for a user in a given month. */
    public BigDecimal monthlyCo2(UUID userId, int year, int month) {
        LocalDate start = LocalDate.of(year, month, 1);
        LocalDate end = start.with(TemporalAdjusters.lastDayOfMonth());
        return logRepo.findByUserIdAndDateRange(userId, start, end).stream()
                .map(ActivityLog::getCo2Kg)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(1, RoundingMode.HALF_UP);
    }

    /** Total CO2 for a user in a given year. */
    public BigDecimal yearlyCo2(UUID userId, int year) {
        LocalDate start = LocalDate.of(year, 1, 1);
        LocalDate end = LocalDate.of(year, 12, 31);
        return logRepo.findByUserIdAndDateRange(userId, start, end).stream()
                .map(ActivityLog::getCo2Kg)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(1, RoundingMode.HALF_UP);
    }

    /**
     * Carbon saved = difference between a user's baseline and actual.
     * Baseline is estimated from their profile (daily distance, diet, electricity usage).
     */
    public BigDecimal carbonSaved(UUID userId, LocalDate from, LocalDate to,
                                   BigDecimal baselineDailyKg) {
        long days = from.datesUntil(to.plusDays(1)).count();
        BigDecimal baselineTotal = baselineDailyKg.multiply(BigDecimal.valueOf(days));
        BigDecimal actual = logRepo.findByUserIdAndDateRange(userId, from, to).stream()
                .map(ActivityLog::getCo2Kg)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        BigDecimal saved = baselineTotal.subtract(actual);
        return saved.max(BigDecimal.ZERO).setScale(1, RoundingMode.HALF_UP);
    }

    /** Get all active emission factors for a region. */
    public List<EmissionFactor> getActiveFactors(String region) {
        return factorRepo.findActiveByRegion(region);
    }

    /** Get all active emission factors (all regions). */
    public List<EmissionFactor> getAllActiveFactors() {
        return factorRepo.findAllActive();
    }
}
