package com.ecotrack.carbon;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CarbonCalculationServiceTest {

    private EmissionFactorRepository factorRepo;
    private AppConfigService appConfig;
    private ActivityLogRepository logRepo;

    private CarbonCalculationService build() {
        factorRepo = mock(EmissionFactorRepository.class);
        logRepo = mock(ActivityLogRepository.class);
        appConfig = mock(AppConfigService.class);
        var props = new AppProperties(null, null, null, null, null,
                new AppProperties.Carbon(0.45), null);
        return new CarbonCalculationService(factorRepo, logRepo, appConfig, props);
    }

    @Test
    void usesTheDatabaseFactorWhenPresent() {
        CarbonCalculationService svc = build();
        EmissionFactor f = mock(EmissionFactor.class);
        when(f.getFactorKgPerUnit()).thenReturn(new BigDecimal("0.18"));
        when(factorRepo.findActiveByKeyAndRegion("car_ride", "GLOBAL")).thenReturn(Optional.of(f));

        BigDecimal co2 = svc.calculateCo2("car_ride", new BigDecimal("10"), "GLOBAL");

        assertEquals(new BigDecimal("1.800"), co2); // 10 km * 0.18
    }

    @Test
    void fallsBackToConfigDefaultForElectricity() {
        CarbonCalculationService svc = build();
        when(factorRepo.findActiveByKeyAndRegion(anyString(), anyString())).thenReturn(Optional.empty());
        when(appConfig.getDouble(anyString(), anyDouble())).thenReturn(0.45);

        BigDecimal co2 = svc.calculateCo2("home_electricity", new BigDecimal("4"), "GLOBAL");

        assertEquals(new BigDecimal("1.800"), co2); // 4 kWh * 0.45
    }

    @Test
    void returnsZeroWhenNoFactorAndNotElectricity() {
        CarbonCalculationService svc = build();
        when(factorRepo.findActiveByKeyAndRegion(anyString(), anyString())).thenReturn(Optional.empty());

        assertEquals(BigDecimal.ZERO, svc.calculateCo2("unknown_key", new BigDecimal("5"), "GLOBAL"));
    }

    // ---- currentStreak (promoted from DashboardService.computeStreak) ----

    @Test
    void currentStreakCountsConsecutiveDaysBackwardFromToday() {
        CarbonCalculationService svc = build();
        UUID userId = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        LocalDate dayBefore = today.minusDays(2);
        LocalDate gapDay = today.minusDays(4);

        List<LocalDate> dates = Arrays.asList(today, yesterday, dayBefore, gapDay);
        when(logRepo.findDistinctDatesByUser(userId)).thenReturn(dates);

        assertEquals(3, svc.currentStreak(userId));
    }

    @Test
    void currentStreakIsZeroWhenNoActivityToday() {
        CarbonCalculationService svc = build();
        UUID userId = UUID.randomUUID();
        LocalDate twoDaysAgo = LocalDate.now().minusDays(2);

        when(logRepo.findDistinctDatesByUser(userId)).thenReturn(List.of(twoDaysAgo));

        assertEquals(0, svc.currentStreak(userId));
    }

    @Test
    void currentStreakIsZeroWhenNoDatesAtAll() {
        CarbonCalculationService svc = build();
        UUID userId = UUID.randomUUID();

        when(logRepo.findDistinctDatesByUser(userId)).thenReturn(List.of());

        assertEquals(0, svc.currentStreak(userId));
    }
}
