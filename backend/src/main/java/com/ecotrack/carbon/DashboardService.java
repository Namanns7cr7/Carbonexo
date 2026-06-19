package com.ecotrack.carbon;

import com.ecotrack.carbon.dto.*;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Dashboard aggregation service — builds the summary shown on the main
 * dashboard: today total, delta, week chart, streak, biggest source, saved.
 */
@Service
public class DashboardService {

    private final ActivityLogRepository logRepo;
    private final CarbonCalculationService carbonService;
    private final UserProfileRepository profileRepo;

    public DashboardService(ActivityLogRepository logRepo,
                             CarbonCalculationService carbonService,
                             UserProfileRepository profileRepo) {
        this.logRepo = logRepo;
        this.carbonService = carbonService;
        this.profileRepo = profileRepo;
    }

    @Transactional(readOnly = true)
    public DashboardResponse getDashboard(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate yesterday = today.minusDays(1);
        LocalDate weekStart = today.minusDays(6);

        // Today / yesterday totals
        BigDecimal todayTotal = logRepo.sumCo2ByUserAndDate(userId, today);
        BigDecimal yesterdayTotal = logRepo.sumCo2ByUserAndDate(userId, yesterday);

        // Delta percentage
        int deltaPct = 0;
        if (yesterdayTotal.compareTo(BigDecimal.ZERO) > 0) {
            deltaPct = todayTotal.subtract(yesterdayTotal)
                    .divide(yesterdayTotal, 2, RoundingMode.HALF_UP)
                    .multiply(BigDecimal.valueOf(100))
                    .intValue();
        }

        // Week chart
        List<DashboardResponse.DayTotal> weekTotals = new ArrayList<>();
        for (int i = 6; i >= 0; i--) {
            LocalDate d = today.minusDays(i);
            BigDecimal total = logRepo.sumCo2ByUserAndDate(userId, d);
            weekTotals.add(new DashboardResponse.DayTotal(d.toString(), scale1(total)));
        }

        // Category breakdown (today)
        Map<String, Double> todayBreakdown = new LinkedHashMap<>();
        for (Object[] row : logRepo.breakdownByCategory(userId, today, today)) {
            todayBreakdown.put((String) row[0], ((BigDecimal) row[1]).doubleValue());
        }

        // Week breakdown
        Map<String, Double> weekBreakdown = new LinkedHashMap<>();
        for (Object[] row : logRepo.breakdownByCategory(userId, weekStart, today)) {
            weekBreakdown.put((String) row[0], ((BigDecimal) row[1]).doubleValue());
        }

        // Biggest source this week
        String biggestCategory = null;
        double biggestValue = 0;
        for (var entry : weekBreakdown.entrySet()) {
            if (entry.getValue() > biggestValue) {
                biggestCategory = entry.getKey();
                biggestValue = entry.getValue();
            }
        }

        // Streak
        int streak = computeStreak(userId);

        // Total saved (estimate based on profile baseline)
        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        BigDecimal baselineDaily = BigDecimal.valueOf(8.0); // fallback ~ average person
        double totalSaved = 0;
        if (profile != null) {
            LocalDate monthStart = today.withDayOfMonth(1);
            totalSaved = carbonService.carbonSaved(userId, monthStart, today, baselineDaily).doubleValue();
        }

        // Today logs
        List<ActivityLog> todayLogs = logRepo.findByUserIdAndActivityDateAndDeletedAtIsNull(userId, today);
        List<ActivityLogResponse> todayLogResponses = todayLogs.stream()
                .map(this::toLogResponse).collect(Collectors.toList());

        return new DashboardResponse(
                scale1(todayTotal), scale1(yesterdayTotal), deltaPct,
                todayBreakdown, weekBreakdown, weekTotals,
                biggestCategory, biggestValue, streak, totalSaved,
                todayLogResponses
        );
    }

    private int computeStreak(UUID userId) {
        List<LocalDate> dates = logRepo.findDistinctDatesByUser(userId);
        if (dates.isEmpty()) return 0;
        Set<LocalDate> dateSet = new HashSet<>(dates);
        int streak = 0;
        LocalDate check = LocalDate.now();
        while (dateSet.contains(check)) {
            streak++;
            check = check.minusDays(1);
        }
        return streak;
    }

    private double scale1(BigDecimal v) {
        return v.setScale(1, RoundingMode.HALF_UP).doubleValue();
    }

    private ActivityLogResponse toLogResponse(ActivityLog a) {
        return new ActivityLogResponse(
                a.getId(), a.getCategory(), a.getFactorKey(), a.getLabel(), a.getEmoji(),
                a.getQuantity() != null ? a.getQuantity().doubleValue() : null,
                a.getUnit(), a.getCo2Kg().doubleValue(), a.getNote(),
                a.getActivityDate().toString(), a.getSource()
        );
    }
}
