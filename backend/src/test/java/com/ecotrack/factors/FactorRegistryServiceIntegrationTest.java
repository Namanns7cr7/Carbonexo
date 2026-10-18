package com.ecotrack.factors;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.factors.FactorLookup.Authority;
import com.ecotrack.factors.FactorLookup.Reason;
import com.ecotrack.factors.FactorLookup.Status;
import com.ecotrack.support.RegistryTestDb;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Real registry (V12 + Dataset V2 seed) on pgvector/pg16. */
@Testcontainers(disabledWithoutDocker = true)
class FactorRegistryServiceIntegrationTest {

    JdbcTemplate jdbc;
    AppConfigService config;
    FactorRegistryService service;

    @BeforeEach
    void setUp() {
        jdbc = RegistryTestDb.jdbc();
        jdbc.update("UPDATE factor_dataset_versions SET status='draft', approved_by=NULL, approved_at=NULL WHERE version=?", RegistryTestDb.DATASET);
        config = mock(AppConfigService.class);
        when(config.getOrDefault(eq("factors.dataset_version"), anyString())).thenReturn(RegistryTestDb.DATASET);
        allowCandidate(true);
        service = new FactorRegistryService(new FactorRegistryRepository(jdbc), config);
    }

    void allowCandidate(boolean allow) {
        when(config.getBool(eq("factors.allow_candidate"), anyBoolean())).thenReturn(allow);
    }

    @Test
    void unreviewedDatasetIsNotAuthoritativeUnlessExplicitlyAllowed() {
        allowCandidate(false);
        FactorLookup l = service.lookup("home_electricity", "IN", null);
        assertEquals(Status.NOT_ESTIMATED, l.status());
        assertEquals(Reason.NO_APPROVED_DATASET, l.reason());
    }

    @Test
    void approvedDatasetIsAuthoritativeWithoutTheCandidateFlag() {
        allowCandidate(false);
        jdbc.update("UPDATE factor_dataset_versions SET status='approved', approved_by='test-reviewer', approved_at=now() WHERE version=?", RegistryTestDb.DATASET);
        try {
            assertEquals(Authority.APPROVED, service.lookup("home_electricity", "IN", null).authority());
        } finally {
            jdbc.update("UPDATE factor_dataset_versions SET status='draft', approved_by=NULL, approved_at=NULL WHERE version=?", RegistryTestDb.DATASET);
        }
    }

    @Test
    void indianGridFactorCarriesFullProvenance() {
        FactorLookup l = service.lookup("home_electricity", "IN", null);
        assertEquals(Status.ESTIMATED, l.status());
        assertEquals(Authority.CANDIDATE, l.authority());
        FactorRecord f = l.factor();
        assertEquals(0, new BigDecimal("0.710").compareTo(f.value()));
        assertEquals("kg/kWh", f.unit());
        assertEquals("IN", f.region());
        assertEquals("FY2024-25", f.applicableYear());
        assertEquals("niti-2026-power", f.sourceId());
        assertTrue(f.systemBoundary().contains("excludes T&D losses"));
        assertEquals("CO2", f.gases());
        assertNotNull(f.sourceLocator());
        assertEquals("low", f.uncertaintyLevel());
    }

    @Test
    void indianMetroAndFlightsAreNotEstimatedNeverSubstitutedWithUkFactors() {
        for (String activity : List.of("metro_train", "flight")) {
            FactorLookup l = service.lookup(activity, "IN", null);
            assertEquals(Status.NOT_ESTIMATED, l.status(), activity);
            assertNotNull(l.missingInformation(), activity);
            assertNull(l.factor(), activity);
        }
        assertEquals(Status.NOT_ESTIMATED, service.lookup("metro_train", "IN", "underground").status());
        assertEquals("rail.gb.underground.y2026", service.lookup("metro_train", "GB", "underground").factor().factorId());
    }

    @Test
    void noMappedIndianFactorComesFromTheUkOrUs() {
        for (String activity : service.knownActivities("IN")) {
            for (FactorLookup l : service.estimableVariants(activity, "IN")) {
                assertFalse(List.of("GB", "US").contains(l.factor().region()), activity + " -> " + l.factor().factorId());
            }
        }
    }

    @Test
    void carWithoutTypeAsksForTheVariantAndOffersRegionalVariants() {
        FactorLookup l = service.lookup("car_ride", "IN", null);
        assertEquals(Status.NOT_ESTIMATED, l.status());
        assertEquals(Reason.VARIANT_REQUIRED, l.reason());
        List<FactorLookup> variants = service.estimableVariants("car_ride", "IN");
        assertEquals(7, variants.size());
        assertTrue(variants.stream().allMatch(v -> v.factor().factorId().startsWith("road.in.car.")));
    }

    @Test
    void globalFoodFactorIsALabelledProxyForIndia() {
        FactorLookup l = service.lookup("food:beef_herd", "IN", null);
        assertEquals(Status.PROVISIONAL, l.status());
        assertTrue(l.proxy());
        assertEquals("GLOBAL", l.factor().region());
    }

    @Test
    void unconfirmedOrGlobalRegionIsNotEstimated() {
        assertEquals(Reason.REGION_UNCONFIRMED, service.lookup("home_electricity", "GLOBAL", null).reason());
        assertEquals(Reason.REGION_UNCONFIRMED, service.lookup("home_electricity", null, null).reason());
    }

    @Test
    void walkingIsADefinitionalZeroNotARegistryFactor() {
        FactorLookup l = service.lookup("walk", "IN", null);
        assertEquals(Authority.DEFINITION, l.authority());
        assertEquals(0, BigDecimal.ZERO.compareTo(service.calculate(l, BigDecimal.TEN, null).kg()));
    }

    @Test
    void calculationIsDeterministicAndAttestable() {
        FactorLookup grid = service.lookup("home_electricity", "IN", null);
        FactorRegistryService.Calculation c = service.calculate(grid, new BigDecimal("250"), null);
        assertEquals(0, new BigDecimal("177.500").compareTo(c.kg()));
        assertTrue(service.attest(c.receipt()));
        Map<String, Object> tampered = new HashMap<>(c.receipt());
        tampered.put("factor_value", new BigDecimal("0.45"));
        assertFalse(service.attest(tampered));
        tampered = new HashMap<>(c.receipt());
        tampered.put("result_kg", new BigDecimal("112.5"));
        assertFalse(service.attest(tampered));
    }

    @Test
    void occupancyDividesOnlyPerVehicleFactors() {
        FactorLookup car = service.lookup("car_ride", "IN", "petrol_hatch_lt1400cc");
        assertEquals(0, new BigDecimal("1.300").compareTo(service.calculate(car, new BigDecimal("40"), 4).kg()));
        FactorLookup bus = service.lookup("bus", "IN", null);
        assertThrows(IllegalArgumentException.class, () -> service.calculate(bus, BigDecimal.TEN, 4));
    }
}
