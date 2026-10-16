package com.ecotrack.simulation;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.carbon.EmissionFactor;
import com.ecotrack.carbon.EmissionFactorRepository;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import com.ecotrack.credit.CreditRuleEngine;
import com.ecotrack.credit.CreditRuleRepository;
import com.ecotrack.profile.UserProfileRepository;
import com.ecotrack.simulation.dto.SimulationRequest;
import com.ecotrack.simulation.dto.SimulationResponse;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class SimulationServiceTest {

    private final UUID userId = UUID.randomUUID();
    private ActivityLogRepository logRepo;
    private EmissionFactorRepository factorRepo;
    private AIProvider aiProvider;
    private PromptRenderer promptRenderer;

    private SimulationService build() {
        factorRepo = mock(EmissionFactorRepository.class);
        logRepo = mock(ActivityLogRepository.class);
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        CreditRuleRepository ruleRepo = mock(CreditRuleRepository.class);
        AppConfigService appConfig = mock(AppConfigService.class);
        aiProvider = mock(AIProvider.class);
        promptRenderer = mock(PromptRenderer.class);
        var aiConfig = new AppProperties.Ai("canned", "model-default", "model-fast", 5, true, null);
        var props = new AppProperties(null, null, null, null, null,
                new AppProperties.Carbon(0.45), aiConfig);

        CarbonCalculationService carbonService = new CarbonCalculationService(factorRepo, logRepo, appConfig, props);
        CreditRuleEngine creditRuleEngine = new CreditRuleEngine(ruleRepo);

        when(logRepo.findByUserIdAndDateRange(eq(userId), any(), any())).thenReturn(List.of());
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        when(promptRenderer.render(anyString(), anyMap())).thenReturn("Rendered prompt");
        when(aiProvider.generate(anyString(), anyString())).thenReturn("You're on track for a greener month!");

        return new SimulationService(logRepo, carbonService, creditRuleEngine, profileRepo, aiProvider, promptRenderer, props);
    }

    private void stubFactor(String key, String kgPerUnit) {
        EmissionFactor f = mock(EmissionFactor.class);
        when(f.getFactorKgPerUnit()).thenReturn(new BigDecimal(kgPerUnit));
        when(factorRepo.findActiveByKeyAndRegion(key, "GLOBAL")).thenReturn(Optional.of(f));
    }

    @Test
    void replaceWithScenarioUsesReplacementFactorForTheProjectedSide() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");
        stubFactor("public_transport", "0.05");

        var item = new SimulationRequest.SimulationItem(
                "car_ride", "transport", new BigDecimal("20"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, "public_transport", null, null, null);
        var req = new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH);

        SimulationResponse res = svc.simulate(userId, req);

        // 20 km/week * 4.33 weeks/month = 86.6 km
        BigDecimal expectedBaseline = new BigDecimal("86.6").multiply(new BigDecimal("0.18")).setScale(3, RoundingMode.HALF_UP);
        BigDecimal expectedProjected = new BigDecimal("86.6").multiply(new BigDecimal("0.05")).setScale(3, RoundingMode.HALF_UP);

        assertEquals("car_ride", res.breakdown().get(0).factorKey());
        assertEquals(expectedBaseline, res.breakdown().get(0).baselineKg());
        assertEquals(expectedProjected, res.breakdown().get(0).projectedKg());
        assertTrue(res.deltaCo2Kg().compareTo(BigDecimal.ZERO) < 0, "replacing with a cleaner factor should reduce projected CO2");
        assertTrue(res.projectedCreditsDelta() >= 0);
    }

    @Test
    void replaceWithACustomReplacementUsesItsStatedRate() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");

        var item = new SimulationRequest.SimulationItem(
                "car_ride", "travel", new BigDecimal("20"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, null, null, null, null,
                "Electric cycle", new BigDecimal("0.01"));
        SimulationResponse res = svc.simulate(userId, new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH));

        BigDecimal expectedProjected = new BigDecimal("86.6").multiply(new BigDecimal("0.01")).setScale(3, RoundingMode.HALF_UP);
        assertEquals(expectedProjected, res.breakdown().get(0).projectedKg());
        assertTrue(res.deltaCo2Kg().compareTo(BigDecimal.ZERO) < 0);
    }

    @Test
    void replaceWithNeedsSomeReplacement() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");
        var item = new SimulationRequest.SimulationItem(
                "car_ride", "travel", new BigDecimal("20"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, null, null, null, null, "Half-specified", null);
        assertThrows(com.ecotrack.exception.BadRequestException.class,
                () -> svc.simulate(userId, new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH)));
    }

    @Test
    void reduceByScenarioLowersTheQuantityBeforeApplyingTheSameFactor() {
        SimulationService svc = build();
        stubFactor("home_electricity", "0.45");

        var item = new SimulationRequest.SimulationItem(
                "home_electricity", "electricity", new BigDecimal("10"), "per_week",
                SimulationRequest.DeltaType.REDUCE_BY, null, new BigDecimal("4"), null, null);
        var req = new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH);

        SimulationResponse res = svc.simulate(userId, req);

        BigDecimal expectedBaseline = new BigDecimal("43.3").multiply(new BigDecimal("0.45")).setScale(3, RoundingMode.HALF_UP); // 10 * 4.33
        BigDecimal expectedProjected = new BigDecimal("25.98").multiply(new BigDecimal("0.45")).setScale(3, RoundingMode.HALF_UP); // (10-4) * 4.33

        assertEquals(expectedBaseline, res.breakdown().get(0).baselineKg());
        assertEquals(expectedProjected, res.breakdown().get(0).projectedKg());
    }

    @Test
    void yearHorizonScalesByFifyTwoWeeksVsMonthsFourPointThreeThree() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");
        stubFactor("public_transport", "0.00");

        var item = new SimulationRequest.SimulationItem(
                "car_ride", "transport", new BigDecimal("10"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, "public_transport", null, null, null);

        SimulationResponse month = svc.simulate(userId, new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH));
        SimulationResponse year = svc.simulate(userId, new SimulationRequest(List.of(item), SimulationRequest.Horizon.YEAR));

        BigDecimal ratio = year.breakdown().get(0).baselineKg()
                .divide(month.breakdown().get(0).baselineKg(), 4, RoundingMode.HALF_UP);
        BigDecimal expectedRatio = new BigDecimal("52").divide(new BigDecimal("4.33"), 4, RoundingMode.HALF_UP);

        assertEquals(expectedRatio.setScale(2, RoundingMode.HALF_UP), ratio.setScale(2, RoundingMode.HALF_UP));
    }

    @Test
    void neverWritesToActivityLogs() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");
        stubFactor("public_transport", "0.05");

        var item = new SimulationRequest.SimulationItem(
                "car_ride", "transport", new BigDecimal("20"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, "public_transport", null, null, null);
        svc.simulate(userId, new SimulationRequest(List.of(item), SimulationRequest.Horizon.YEAR));

        verify(logRepo, never()).save(any());
        verify(logRepo, never()).saveAll(any());
        verify(logRepo, never()).delete(any());
        verify(logRepo, never()).deleteAll();
    }

    // ---- Custom (not-in-the-catalog) activity ----

    @Test
    void customActivityComputesFromTheGivenRateWithoutAnyCatalogLookup() {
        SimulationService svc = build();
        // deliberately no stubFactor() call — the catalog repo should never be consulted

        var item = new SimulationRequest.SimulationItem(
                null, "shopping", new BigDecimal("1"), "per_week",
                SimulationRequest.DeltaType.REDUCE_BY, null, new BigDecimal("0.4"),
                "Artisan coffee habit", new BigDecimal("2.5"));
        var req = new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH);

        SimulationResponse res = svc.simulate(userId, req);

        // baseline: 1 * 1(week) * 4.33 * 2.5 = 10.825; projected: (1-0.4) * 4.33 * 2.5 = 6.495
        BigDecimal expectedBaseline = new BigDecimal("4.33").multiply(new BigDecimal("2.5")).setScale(3, RoundingMode.HALF_UP);
        BigDecimal expectedProjected = new BigDecimal("0.6").multiply(new BigDecimal("4.33")).multiply(new BigDecimal("2.5")).setScale(3, RoundingMode.HALF_UP);

        assertEquals("Artisan coffee habit", res.breakdown().get(0).factorKey());
        assertEquals(expectedBaseline, res.breakdown().get(0).baselineKg());
        assertEquals(expectedProjected, res.breakdown().get(0).projectedKg());
        verifyNoInteractions(factorRepo);
    }

    @Test
    void itemWithNeitherFactorKeyNorCustomRateIsRejected() {
        SimulationService svc = build();

        var item = new SimulationRequest.SimulationItem(
                null, "shopping", new BigDecimal("1"), "per_week",
                SimulationRequest.DeltaType.REDUCE_BY, null, new BigDecimal("0.4"),
                null, null);
        var req = new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH);

        assertThrows(com.ecotrack.exception.BadRequestException.class, () -> svc.simulate(userId, req));
    }

    // ---- AI-generated insight ----

    @Test
    void simulateReturnsAiGeneratedInsightOnHappyPath() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");
        stubFactor("public_transport", "0.05");

        var item = new SimulationRequest.SimulationItem(
                "car_ride", "transport", new BigDecimal("20"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, "public_transport", null, null, null);
        var req = new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH);

        SimulationResponse res = svc.simulate(userId, req);

        assertEquals("You're on track for a greener month!", res.aiInsight());
        verify(promptRenderer).render(eq("simulation_insight"), anyMap());
        verify(aiProvider).generate(eq("Rendered prompt"), eq("model-fast"));
    }

    @Test
    void simulateFallsBackToStaticInsightWhenAiProviderThrows() {
        SimulationService svc = build();
        stubFactor("car_ride", "0.18");
        stubFactor("public_transport", "0.05");
        when(promptRenderer.render(anyString(), anyMap())).thenThrow(new RuntimeException("boom"));

        var item = new SimulationRequest.SimulationItem(
                "car_ride", "transport", new BigDecimal("20"), "per_week",
                SimulationRequest.DeltaType.REPLACE_WITH, "public_transport", null, null, null);
        var req = new SimulationRequest(List.of(item), SimulationRequest.Horizon.MONTH);

        SimulationResponse res = svc.simulate(userId, req);

        assertNotNull(res.aiInsight());
        assertTrue(res.aiInsight().contains(res.deltaCo2Kg().toString()));
        verifyNoInteractions(aiProvider);
    }
}
