package com.ecotrack.score;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.credit.CreditLedgerRepository;
import com.ecotrack.score.dto.CreditScoreResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class CreditScoreServiceTest {

    private CreditLedgerRepository creditLedgerRepository;
    private CarbonCalculationService carbonCalculationService;
    private ActivityLogRepository activityLogRepository;
    private CreditScoreService service;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        creditLedgerRepository = mock(CreditLedgerRepository.class);
        carbonCalculationService = mock(CarbonCalculationService.class);
        activityLogRepository = mock(ActivityLogRepository.class);
        service = new CreditScoreService(creditLedgerRepository, carbonCalculationService, activityLogRepository);
    }

    private void stub(int balance, int streak, int daysActiveLast30) {
        when(creditLedgerRepository.sumDeltaByUserId(userId)).thenReturn(balance);
        when(carbonCalculationService.currentStreak(userId)).thenReturn(streak);
        when(activityLogRepository.countDistinctDatesByUserSince(eq(userId), any(LocalDate.class)))
                .thenReturn(daysActiveLast30);
    }

    // ---- component cap behavior ----

    @Test
    void balancePointsCapAt300EvenForALargeBalance() {
        stub(1000, 0, 0);

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(300, res.balancePoints()); // not 1000/2 = 500
        assertEquals(1000, res.balance());
        assertEquals(600, res.score()); // 300 base + 300 balance points
    }

    @Test
    void balancePointsFloorAtZeroForNegativeBalance() {
        stub(-50, 0, 0);

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(0, res.balancePoints());
        assertEquals(300, res.score());
    }

    @Test
    void streakPointsCapAt150EvenForALongStreak() {
        stub(0, 30, 0);

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(150, res.streakPoints()); // not 30*10 = 300
        assertEquals(30, res.streak());
        assertEquals(450, res.score()); // 300 base + 150 streak points
    }

    @Test
    void consistencyPointsCapAt100ForManyActiveDays() {
        stub(0, 0, 40);

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(100, res.consistencyPoints()); // not 40*3 = 120
        assertEquals(40, res.daysActiveLast30());
        assertEquals(400, res.score()); // 300 base + 100 consistency points
    }

    // ---- overall score clamp ----

    @Test
    void scoreClampsAt850EvenWhenAllThreeCapsAreHitSimultaneously() {
        stub(600, 15, 34);

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(300, res.balancePoints());
        assertEquals(150, res.streakPoints());
        assertEquals(100, res.consistencyPoints());
        assertEquals(850, res.score());
    }

    @Test
    void scoreNeverExceeds850EvenIfComponentsWereHypotheticallyLarger() {
        // Even an absurd balance (which would blow past 300 if not capped
        // per-component) must not push the final score past 850 thanks to the
        // explicit Math.min(850, ...) safety clamp.
        stub(Integer.MAX_VALUE / 4, 999, 999);

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(850, res.score());
    }

    // ---- tier boundaries ----

    @Test
    void tierIsSeedlingJustBelow450() {
        stub(298, 0, 0); // balancePoints = 149 -> score 449

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(449, res.score());
        assertEquals("Seedling", res.tier());
    }

    @Test
    void tierIsSproutAt450() {
        stub(300, 0, 0); // balancePoints = 150 -> score 450

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(450, res.score());
        assertEquals("Sprout", res.tier());
    }

    @Test
    void tierIsSproutJustBelow600() {
        stub(598, 0, 0); // balancePoints = 299 -> score 599

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(599, res.score());
        assertEquals("Sprout", res.tier());
    }

    @Test
    void tierIsSaplingAt600() {
        stub(600, 0, 0); // balancePoints capped at 300 -> score 600

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(600, res.score());
        assertEquals("Sapling", res.tier());
    }

    @Test
    void tierIsSaplingJustBelow750() {
        stub(600, 14, 3); // 300 + 140 + 9 -> score 749

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(749, res.score());
        assertEquals("Sapling", res.tier());
    }

    @Test
    void tierIsForestGuardianAt750() {
        stub(600, 15, 0); // 300 + 150 + 0 -> score 750

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(750, res.score());
        assertEquals("Forest Guardian", res.tier());
    }

    @Test
    void tierIsForestGuardianAtMaxScore() {
        stub(600, 15, 34); // all caps hit -> score 850

        CreditScoreResponse res = service.getScore(userId);

        assertEquals(850, res.score());
        assertEquals("Forest Guardian", res.tier());
    }
}
