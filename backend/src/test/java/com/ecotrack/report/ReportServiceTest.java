package com.ecotrack.report;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.credit.CreditLedgerRepository;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.report.dto.EsgSummaryResponse;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ReportServiceTest {

    private UserRepository userRepository;
    private ActivityLogRepository activityLogRepository;
    private CreditLedgerRepository creditLedgerRepository;
    private CarbonCalculationService carbonCalculationService;
    private ReportService service;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        activityLogRepository = mock(ActivityLogRepository.class);
        creditLedgerRepository = mock(CreditLedgerRepository.class);
        carbonCalculationService = mock(CarbonCalculationService.class);
        service = new ReportService(userRepository, activityLogRepository, creditLedgerRepository, carbonCalculationService);
    }

    private void stubFixture() {
        User user = mock(User.class);
        Instant createdAt = LocalDate.of(2024, 3, 10).atStartOfDay(ZoneOffset.UTC).toInstant();
        when(user.getCreatedAt()).thenReturn(createdAt);
        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));

        when(carbonCalculationService.carbonSaved(eq(userId), any(LocalDate.class), any(LocalDate.class), any(BigDecimal.class)))
                .thenReturn(new BigDecimal("123.4"));
        when(carbonCalculationService.monthlyCo2(eq(userId), anyInt(), anyInt()))
                .thenReturn(new BigDecimal("45.6"));
        when(carbonCalculationService.currentStreak(userId)).thenReturn(7);

        List<Object[]> breakdown = new ArrayList<>();
        breakdown.add(new Object[]{"transport", new BigDecimal("80.0")});
        breakdown.add(new Object[]{"food", new BigDecimal("43.4")});
        when(activityLogRepository.breakdownByCategory(eq(userId), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(breakdown);

        when(activityLogRepository.findByUserIdAndDeletedAtIsNullOrderByActivityDateDescCreatedAtDesc(userId))
                .thenReturn(List.of(mock(com.ecotrack.carbon.ActivityLog.class), mock(com.ecotrack.carbon.ActivityLog.class), mock(com.ecotrack.carbon.ActivityLog.class)));

        when(creditLedgerRepository.sumDeltaByUserId(userId)).thenReturn(250);
    }

    @Test
    void getEsgSummaryAggregatesFromMockedDependencies() {
        stubFixture();

        EsgSummaryResponse res = service.getEsgSummary(userId);

        assertEquals(new BigDecimal("123.4"), res.lifetimeCo2SavedKg());
        assertEquals(new BigDecimal("45.6"), res.currentMonthCo2Kg());
        assertEquals(250, res.creditsEarned());
        assertEquals(7, res.currentStreak());
        assertEquals(3, res.totalActivitiesLogged());
        assertEquals(LocalDate.of(2024, 3, 10), res.accountStartDate());
        assertEquals(2, res.categoryBreakdown().size());
        assertEquals(new BigDecimal("80.0"), res.categoryBreakdown().get("transport"));
        assertEquals(new BigDecimal("43.4"), res.categoryBreakdown().get("food"));
        assertNotNull(res.generatedAt());
    }

    @Test
    void getEsgSummaryThrowsWhenUserNotFound() {
        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.getEsgSummary(userId));
    }

    @Test
    void toCsvContainsExpectedHeadersAndValues() {
        stubFixture();
        EsgSummaryResponse res = service.getEsgSummary(userId);

        String csv = service.toCsv(res);

        assertTrue(csv.contains("Metric,Value"));
        assertTrue(csv.contains("Lifetime CO2 Saved (kg),123.4"));
        assertTrue(csv.contains("Current Month CO2 (kg),45.6"));
        assertTrue(csv.contains("Credits Earned,250"));
        assertTrue(csv.contains("Current Streak (days),7"));
        assertTrue(csv.contains("Total Activities Logged,3"));
        assertTrue(csv.contains("Category Breakdown"));
        assertTrue(csv.contains("Category,CO2 (kg)"));
        assertTrue(csv.contains("transport,80.0"));
        assertTrue(csv.contains("food,43.4"));
    }

    @Test
    void toCsvEscapesCategoryNamesContainingCommas() {
        EsgSummaryResponse summary = new EsgSummaryResponse(
                BigDecimal.ZERO, BigDecimal.ZERO,
                java.util.Map.of("food, misc", new BigDecimal("1.0")),
                0, 0, 0L, LocalDate.of(2024, 1, 1), Instant.now()
        );

        String csv = service.toCsv(summary);

        assertTrue(csv.contains("\"food, misc\",1.0"));
    }
}
