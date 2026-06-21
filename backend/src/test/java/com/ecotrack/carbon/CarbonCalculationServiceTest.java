package com.ecotrack.carbon;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CarbonCalculationServiceTest {

    private EmissionFactorRepository factorRepo;
    private AppConfigService appConfig;

    private CarbonCalculationService build() {
        factorRepo = mock(EmissionFactorRepository.class);
        ActivityLogRepository logRepo = mock(ActivityLogRepository.class);
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
}
