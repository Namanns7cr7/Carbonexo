package com.ecotrack.carbon;

import com.ecotrack.carbon.dto.DashboardResponse;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DashboardServiceTest {

    private ActivityLogRepository logRepo;
    private CarbonCalculationService carbonService;
    private UserProfileRepository profileRepo;
    private com.ecotrack.credit.CreditService creditService;
    private DashboardService service;

    @BeforeEach
    void setUp() {
        logRepo = mock(ActivityLogRepository.class);
        carbonService = mock(CarbonCalculationService.class);
        profileRepo = mock(UserProfileRepository.class);
        creditService = mock(com.ecotrack.credit.CreditService.class);
        service = new DashboardService(logRepo, carbonService, profileRepo, creditService);
    }

    @Test
    void getDashboardComputesCorrectTotalsAndDelta() {
        UUID userId = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        when(logRepo.sumCo2ByUserAndDate(eq(userId), any(LocalDate.class))).thenReturn(BigDecimal.ZERO);
        when(logRepo.sumCo2ByUserAndDate(userId, today)).thenReturn(new BigDecimal("10.00"));
        when(logRepo.sumCo2ByUserAndDate(userId, yesterday)).thenReturn(new BigDecimal("8.00"));
        when(logRepo.breakdownByCategory(any(), any(), any())).thenReturn(new ArrayList<>());
        when(logRepo.findDistinctDatesByUser(userId)).thenReturn(new ArrayList<>());
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        when(logRepo.findByUserIdAndActivityDateAndDeletedAtIsNull(eq(userId), eq(today))).thenReturn(new ArrayList<>());

        DashboardResponse resp = service.getDashboard(userId);

        assertNotNull(resp);
        assertEquals(10.0, resp.todayTotal());
        assertEquals(8.0, resp.yesterdayTotal());
        // Delta = ((10 - 8) / 8) * 100 = 25%
        assertEquals(25, resp.deltaPct());
    }

    @Test
    void getDashboardComputesNegativeDeltaCorrectly() {
        UUID userId = UUID.randomUUID();
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);

        when(logRepo.sumCo2ByUserAndDate(eq(userId), any(LocalDate.class))).thenReturn(BigDecimal.ZERO);
        when(logRepo.sumCo2ByUserAndDate(userId, today)).thenReturn(new BigDecimal("6.00"));
        when(logRepo.sumCo2ByUserAndDate(userId, yesterday)).thenReturn(new BigDecimal("8.00"));
        when(logRepo.breakdownByCategory(any(), any(), any())).thenReturn(new ArrayList<>());
        when(logRepo.findDistinctDatesByUser(userId)).thenReturn(new ArrayList<>());
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        when(logRepo.findByUserIdAndActivityDateAndDeletedAtIsNull(eq(userId), eq(today))).thenReturn(new ArrayList<>());

        DashboardResponse resp = service.getDashboard(userId);

        assertNotNull(resp);
        assertEquals(6.0, resp.todayTotal());
        assertEquals(8.0, resp.yesterdayTotal());
        // Delta = ((6 - 8) / 8) * 100 = -25%
        assertEquals(-25, resp.deltaPct());
    }

    @Test
    void computeStreakCorrectlyCountsConsecutiveDays() {
        // The streak-walking algorithm itself now lives on CarbonCalculationService
        // (currentStreak) — see CarbonCalculationServiceTest for coverage of the
        // actual day-walking logic. Here we just verify DashboardService wires the
        // promoted method's result straight through into the response.
        UUID userId = UUID.randomUUID();
        LocalDate today = LocalDate.now();

        when(carbonService.currentStreak(userId)).thenReturn(3);
        when(logRepo.sumCo2ByUserAndDate(any(), any())).thenReturn(BigDecimal.ZERO);
        when(logRepo.breakdownByCategory(any(), any(), any())).thenReturn(new ArrayList<>());
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        when(logRepo.findByUserIdAndActivityDateAndDeletedAtIsNull(eq(userId), any())).thenReturn(new ArrayList<>());

        DashboardResponse resp = service.getDashboard(userId);

        assertEquals(3, resp.streak());
        verify(carbonService).currentStreak(userId);
    }

    @Test
    void passportCountsComeFromTheUsersOwnHistory() {
        UUID userId = UUID.randomUUID();
        when(logRepo.sumCo2ByUserAndDate(any(), any(LocalDate.class))).thenReturn(BigDecimal.ZERO);
        when(logRepo.breakdownByCategory(any(), any(), any())).thenReturn(new ArrayList<>());
        when(logRepo.findDistinctDatesByUser(userId)).thenReturn(List.of(LocalDate.now(), LocalDate.now().minusDays(3), LocalDate.now().minusDays(9)));
        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.empty());
        when(logRepo.findByUserIdAndActivityDateAndDeletedAtIsNull(any(), any())).thenReturn(new ArrayList<>());
        when(creditService.completedActionCount(userId)).thenReturn(2);

        DashboardResponse resp = service.getDashboard(userId);

        assertEquals(3, resp.daysTracked());
        assertEquals(2, resp.actionsCompleted());
    }
}
