package com.ecotrack.simulation;

import com.ecotrack.ai.AIFailureKind;
import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.AIResult;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.ai.agent.RunCarbonTwinScenarioTool;
import com.ecotrack.ai.agent.SourceLedger;
import com.ecotrack.ai.agent.ToolContext;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.config.AppProperties;
import com.ecotrack.credit.CreditRuleEngine;
import com.ecotrack.credit.CreditRuleRepository;
import com.ecotrack.exception.BadRequestException;
import com.ecotrack.factors.CarbonTwinEngine;
import com.ecotrack.factors.FactorRegistryRepository;
import com.ecotrack.factors.FactorRegistryService;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import com.ecotrack.simulation.dto.SimulationRequest;
import com.ecotrack.simulation.dto.SimulationRequest.DeltaType;
import com.ecotrack.simulation.dto.SimulationRequest.Horizon;
import com.ecotrack.simulation.dto.SimulationResponse;
import com.ecotrack.support.RegistryTestDb;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * The Simulate screen on the real Dataset V2 registry. The central guarantee: for the same scenario
 * the Simulate screen and the coach's Carbon Twin tool return the same numbers.
 */
@Testcontainers(disabledWithoutDocker = true)
class SimulationServiceTest {

    private final UUID userId = UUID.randomUUID();
    private JdbcTemplate jdbc;
    private AppConfigService config;
    private FactorRegistryService registry;
    private CarbonTwinEngine engine;
    private ActivityLogRepository logRepo;
    private AIProvider aiProvider;
    private PromptRenderer promptRenderer;
    private CreditRuleEngine credits;
    private SimulationService svc;

    @BeforeEach
    void setUp() {
        jdbc = RegistryTestDb.jdbc();
        jdbc.update("UPDATE factor_dataset_versions SET status='draft', approved_by=NULL, approved_at=NULL WHERE version=?", RegistryTestDb.DATASET);
        config = mock(AppConfigService.class);
        when(config.getOrDefault(eq("factors.dataset_version"), anyString())).thenReturn(RegistryTestDb.DATASET);
        allowCandidate(true);
        registry = new FactorRegistryService(new FactorRegistryRepository(jdbc), config);
        engine = new CarbonTwinEngine(registry);

        logRepo = mock(ActivityLogRepository.class);
        when(logRepo.findByUserIdAndDateRange(eq(userId), any(), any())).thenReturn(List.of());
        UserProfileRepository profileRepo = mock(UserProfileRepository.class);
        UserProfile profile = mock(UserProfile.class);
        when(profile.getRegion()).thenReturn("IN");
        when(profile.getWeeklyGoalPct()).thenReturn(15);
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(profile));
        aiProvider = mock(AIProvider.class);
        when(aiProvider.generateResult(anyString(), anyString())).thenReturn(AIResult.live("A greener month ahead.", "gemini", "model-fast", 10, 10, 1));
        promptRenderer = mock(PromptRenderer.class);
        when(promptRenderer.render(anyString(), anyMap())).thenReturn("Rendered prompt");
        credits = mock(CreditRuleEngine.class);
        when(credits.creditsForKgSaved(anyDouble())).thenReturn(7);
        var props = new AppProperties(null, null, null, null, null, null,
                new AppProperties.Ai("canned", "model-default", "model-fast", 5, true, null));
        svc = new SimulationService(logRepo, engine, registry, credits, profileRepo, aiProvider, promptRenderer, props);
    }

    void allowCandidate(boolean allow) {
        when(config.getBool(eq("factors.allow_candidate"), anyBoolean())).thenReturn(allow);
    }

    static SimulationRequest.SimulationItem replace(String key, String variant, String replacement, String replacementVariant,
                                                    String qty, String freq) {
        return new SimulationRequest.SimulationItem(key, "travel", new BigDecimal(qty), freq, DeltaType.REPLACE_WITH, replacement,
                null, null, null, null, null, variant, replacementVariant);
    }

    SimulationResponse run(Horizon h, SimulationRequest.SimulationItem... items) {
        return svc.simulate(userId, new SimulationRequest(List.of(items), h));
    }

    @Test
    void exactCarToBusUsesRegistryFactors() {
        SimulationResponse r = run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"));
        // 20 km/week x 4.33 = 86.6 km; car 0.13 kg/vkm, intracity bus 0.015161 kg/pkm
        assertEquals("ESTIMATED", r.status());
        assertEquals(new BigDecimal("11.258"), r.breakdown().get(0).baselineKg());
        assertEquals(new BigDecimal("1.313"), r.breakdown().get(0).projectedKg());
        assertEquals(new BigDecimal("-9.945"), r.deltaCo2Kg());
        assertEquals("registry", r.breakdown().get(0).factorSource());
        assertEquals("CANDIDATE", r.factorAuthority());
        assertEquals(0, r.projectedCreditsDelta(), "no projected credits on unreviewed factors");
    }

    @Test
    void simulateScreenAndCoachCarbonTwinToolAgree() {
        SimulationResponse screen = run(Horizon.YEAR, replace("car_ride", "diesel_hatch_lt1400cc", "bus", null, "12", "per_day"));
        ToolContext ctx = new ToolContext(userId, "IN", true, LocalDate.now(), new SourceLedger());
        Map<String, Object> tool = new RunCarbonTwinScenarioTool(engine).execute(ctx, Map.of(
                "baseline_activity", "car_ride", "baseline_variant", "diesel_hatch_lt1400cc", "replacement_activity", "bus",
                "quantity", 12, "frequency", "per_day", "horizon", "YEAR"));
        assertEquals("ESTIMATED", tool.get("status"));
        assertEquals(0, screen.deltaCo2Kg().compareTo((BigDecimal) tool.get("delta_kg_min")));
        assertEquals(0, screen.breakdown().get(0).baselineKg().compareTo((BigDecimal) ((Map<?, ?>) tool.get("baseline")).get("kg")));

        // a range (type not stated) agrees too
        SimulationResponse range = run(Horizon.MONTH, replace("car_ride", null, "bus", null, "20", "per_day"));
        Map<String, Object> toolRange = new RunCarbonTwinScenarioTool(engine).execute(ctx, Map.of(
                "baseline_activity", "car_ride", "replacement_activity", "bus", "quantity", 20, "frequency", "per_day", "horizon", "MONTH"));
        assertEquals(0, range.deltaCo2KgMin().compareTo((BigDecimal) toolRange.get("delta_kg_min")));
        assertEquals(0, range.deltaCo2KgMax().compareTo((BigDecimal) toolRange.get("delta_kg_max")));
    }

    @Test
    void unknownCarTypeIsARangeNotAnInventedAverage() {
        SimulationResponse r = run(Horizon.MONTH, replace("car_ride", null, "bus", null, "20", "per_week"));
        assertEquals("ESTIMATED_RANGE", r.status());
        assertNull(r.deltaCo2Kg());
        assertNull(r.breakdown().get(0).baselineKg());
        assertTrue(r.deltaCo2KgMin().compareTo(r.deltaCo2KgMax()) < 0);
        assertTrue(r.aiInsight().contains("depending on the vehicle"), r.aiInsight());
        verifyNoInteractions(aiProvider);
    }

    @Test
    void metroWithoutAnIndianFactorIsNotEstimatedNeverZero() {
        SimulationResponse r = run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "metro_train", null, "20", "per_day"));
        assertEquals("NOT_ESTIMATED", r.status());
        assertNull(r.deltaCo2Kg());
        assertNull(r.deltaCo2KgMin());
        assertEquals(0, r.projectedCreditsDelta());
        assertTrue(r.aiInsight().startsWith("Not estimated"), r.aiInsight());
        assertTrue(r.breakdown().get(0).missingInformation().contains("metro"), r.breakdown().get(0).missingInformation());
    }

    @Test
    void mixedChangesArePartialAndTheMissingOneIsLeftOutOfTotals() {
        SimulationResponse r = run(Horizon.MONTH,
                replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"),
                replace("car_ride", "petrol_hatch_lt1400cc", "metro_train", null, "10", "per_week"));
        assertEquals("PARTIAL", r.status());
        assertEquals(new BigDecimal("-9.945"), r.deltaCo2KgMin());
        assertNull(r.deltaCo2Kg());
        assertTrue(r.aiInsight().contains("Not estimated"));
    }

    @Test
    void withoutAnApprovedDatasetNothingIsEstimatedInProduction() {
        allowCandidate(false);
        SimulationResponse r = run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"));
        assertEquals("NOT_ESTIMATED", r.status());
        assertEquals("NONE", r.factorAuthority());
        assertTrue(r.breakdown().get(0).missingInformation().contains("approved"));
    }

    @Test
    void projectedCreditsOnlyForExactApprovedResults() {
        jdbc.update("UPDATE factor_dataset_versions SET status='approved', approved_by='test-reviewer', approved_at=now() WHERE version=?", RegistryTestDb.DATASET);
        try {
            SimulationResponse r = run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"));
            assertEquals("APPROVED", r.factorAuthority());
            assertEquals(7, r.projectedCreditsDelta());
            SimulationResponse range = run(Horizon.MONTH, replace("car_ride", null, "bus", null, "20", "per_week"));
            assertEquals(0, range.projectedCreditsDelta());
        } finally {
            jdbc.update("UPDATE factor_dataset_versions SET status='draft', approved_by=NULL, approved_at=NULL WHERE version=?", RegistryTestDb.DATASET);
        }
    }

    @Test
    void reduceElectricityUsesTheGridFactor() {
        var item = new SimulationRequest.SimulationItem("home_electricity", "electricity", new BigDecimal("10"), "per_week",
                DeltaType.REDUCE_BY, null, new BigDecimal("2"), null, null);
        SimulationResponse r = run(Horizon.MONTH, item);
        // 10 x 4.33 = 43.3 kWh x 0.710 = 30.743; 8 x 4.33 = 34.64 kWh x 0.710 = 24.594
        assertEquals(new BigDecimal("30.743"), r.breakdown().get(0).baselineKg());
        assertEquals(new BigDecimal("24.594"), r.breakdown().get(0).projectedKg());
    }

    @Test
    void yearIsFiftyTwoWeeksAndMonthIsFourPointThreeThree() {
        var item = replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "10", "per_week");
        BigDecimal month = run(Horizon.MONTH, item).breakdown().get(0).baselineKg();
        BigDecimal year = run(Horizon.YEAR, item).breakdown().get(0).baselineKg();
        assertEquals(new BigDecimal("5.629"), month);   // 43.3 km x 0.13
        assertEquals(new BigDecimal("67.600"), year);    // 520 km x 0.13
    }

    @Test
    void customRatesAreUsedAsStatedAndLabelled() {
        var item = new SimulationRequest.SimulationItem(null, "shopping", new BigDecimal("1"), "per_week", DeltaType.REDUCE_BY, null,
                new BigDecimal("0.4"), "Artisan coffee habit", new BigDecimal("2.5"));
        SimulationResponse r = run(Horizon.MONTH, item);
        assertEquals(new BigDecimal("10.825"), r.breakdown().get(0).baselineKg());
        assertEquals(new BigDecimal("6.495"), r.breakdown().get(0).projectedKg());
        assertEquals("user_supplied", r.breakdown().get(0).factorSource());
        assertEquals(0, r.projectedCreditsDelta());
    }

    @Test
    void invalidRequestsAreRejected() {
        var noReplacement = new SimulationRequest.SimulationItem("car_ride", "travel", new BigDecimal("20"), "per_week",
                DeltaType.REPLACE_WITH, null, null, null, null, "Half-specified", null);
        assertThrows(BadRequestException.class, () -> run(Horizon.MONTH, noReplacement));
        var nothing = new SimulationRequest.SimulationItem(null, "shopping", new BigDecimal("1"), "per_week",
                DeltaType.REDUCE_BY, null, new BigDecimal("0.4"), null, null);
        assertThrows(BadRequestException.class, () -> run(Horizon.MONTH, nothing));
        assertThrows(BadRequestException.class, () -> run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "1", "hourly")));
    }

    @Test
    void neverWritesAnything() {
        run(Horizon.YEAR, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"));
        verify(logRepo, never()).save(any());
        verify(logRepo, never()).saveAll(any());
        verify(logRepo, never()).delete(any());
    }

    @Test
    void liveInsightOnlyWhenTheModelReallyAnswered() {
        SimulationResponse live = run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"));
        assertEquals("A greener month ahead.", live.aiInsight());

        when(aiProvider.generateResult(anyString(), anyString()))
                .thenReturn(AIResult.fallback("Offline guidance text", AIFailureKind.MODEL_NOT_FOUND, 3));
        SimulationResponse offline = run(Horizon.MONTH, replace("car_ride", "petrol_hatch_lt1400cc", "bus", null, "20", "per_week"));
        assertFalse(offline.aiInsight().contains("Offline guidance"), "canned text must not be shown as the insight");
        assertTrue(offline.aiInsight().contains("-9.945"), offline.aiInsight());
    }
}
