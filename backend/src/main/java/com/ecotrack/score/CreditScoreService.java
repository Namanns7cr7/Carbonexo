package com.ecotrack.score;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.credit.CreditLedgerRepository;
import com.ecotrack.score.dto.CreditScoreResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Carbon Credit Score — a derived, shareable 300-850 score (BFSI-style,
 * think "credit score for sustainability behavior"). Entirely computed from
 * existing, already-trustworthy data (credit ledger + activity logs); no new
 * tables, no AI, no external calls. Every component is deterministic and
 * explainable, which is the point — the frontend can show exactly how the
 * score breaks down.
 */
@Service
public class CreditScoreService {

    /** 30-day "consistency" window is inclusive of today, so it starts 29 days back. */
    private static final int CONSISTENCY_WINDOW_DAYS = 30;

    private final CreditLedgerRepository creditLedgerRepository;
    private final CarbonCalculationService carbonCalculationService;
    private final ActivityLogRepository activityLogRepository;

    public CreditScoreService(CreditLedgerRepository creditLedgerRepository,
                               CarbonCalculationService carbonCalculationService,
                               ActivityLogRepository activityLogRepository) {
        this.creditLedgerRepository = creditLedgerRepository;
        this.carbonCalculationService = carbonCalculationService;
        this.activityLogRepository = activityLogRepository;
    }

    @Transactional(readOnly = true)
    public CreditScoreResponse getScore(UUID userId) {
        int balance = creditLedgerRepository.sumDeltaByUserId(userId);
        int streak = carbonCalculationService.currentStreak(userId);
        LocalDate since = LocalDate.now().minusDays(CONSISTENCY_WINDOW_DAYS - 1);
        int daysActiveLast30 = activityLogRepository.countDistinctDatesByUserSince(userId, since);

        // Balance points: 0-300. Negative balances contribute nothing (floored at 0
        // before halving). Integer division is intentional — it's the simplest,
        // most explainable rule (every 2 lifetime credits = 1 score point) and the
        // min() cap means the floor-vs-round distinction never matters near the cap.
        int balancePoints = Math.min(300, Math.max(0, balance) / 2);

        // Streak points: 0-150, 10 points per consecutive day logged, capped at 15 days.
        int streakPoints = Math.min(150, streak * 10);

        // Consistency points: 0-100, 3 points per distinct active day in the last
        // 30 days (inclusive window), capped at ~34 active days (i.e. maxed well
        // before the window could even be exceeded).
        int consistencyPoints = Math.min(100, daysActiveLast30 * 3);

        // Base 300 (the score floor) + the three components, explicitly re-clamped
        // at 850 as a safety net regardless of how the component caps are tuned.
        int score = Math.min(850, 300 + balancePoints + streakPoints + consistencyPoints);

        String tier = tierFor(score);

        return new CreditScoreResponse(score, tier, balancePoints, streakPoints,
                consistencyPoints, balance, streak, daysActiveLast30);
    }

    private String tierFor(int score) {
        if (score >= 750) return "Forest Guardian";
        if (score >= 600) return "Sapling";
        if (score >= 450) return "Sprout";
        return "Seedling";
    }
}
