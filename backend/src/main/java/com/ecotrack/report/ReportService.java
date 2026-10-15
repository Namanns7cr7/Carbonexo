package com.ecotrack.report;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.carbon.CarbonCalculationService;
import com.ecotrack.credit.CreditLedgerRepository;
import com.ecotrack.exception.ResourceNotFoundException;
import com.ecotrack.report.dto.EsgSummaryResponse;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * ESG / sustainability report aggregation — builds a single summary by
 * reusing existing repository/service methods only (no new aggregation
 * logic). Used for both the JSON summary endpoint and the CSV export.
 */
@Service
public class ReportService {

    /** Same fallback baseline used by DashboardService/GroupService when no profile exists. */
    private static final BigDecimal FALLBACK_BASELINE_DAILY_KG = BigDecimal.valueOf(8.0);

    private final UserRepository userRepository;
    private final ActivityLogRepository activityLogRepository;
    private final CreditLedgerRepository creditLedgerRepository;
    private final CarbonCalculationService carbonCalculationService;

    public ReportService(UserRepository userRepository,
                          ActivityLogRepository activityLogRepository,
                          CreditLedgerRepository creditLedgerRepository,
                          CarbonCalculationService carbonCalculationService) {
        this.userRepository = userRepository;
        this.activityLogRepository = activityLogRepository;
        this.creditLedgerRepository = creditLedgerRepository;
        this.carbonCalculationService = carbonCalculationService;
    }

    @Transactional(readOnly = true)
    public EsgSummaryResponse getEsgSummary(UUID userId) {
        User user = userRepository.findByIdAndDeletedAtIsNull(userId)
                .orElseThrow(() -> ResourceNotFoundException.of("User", userId));

        LocalDate accountStartDate = user.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
        LocalDate today = LocalDate.now();

        BigDecimal lifetimeCo2SavedKg = carbonCalculationService.carbonSaved(
                userId, accountStartDate, today, FALLBACK_BASELINE_DAILY_KG);

        BigDecimal currentMonthCo2Kg = carbonCalculationService.monthlyCo2(
                userId, today.getYear(), today.getMonthValue());

        Map<String, BigDecimal> categoryBreakdown = new LinkedHashMap<>();
        for (Object[] row : activityLogRepository.breakdownByCategory(userId, accountStartDate, today)) {
            BigDecimal kg = ((BigDecimal) row[1]).setScale(1, RoundingMode.HALF_UP);
            categoryBreakdown.put((String) row[0], kg);
        }

        int creditsEarned = creditLedgerRepository.sumDeltaByUserId(userId);
        int currentStreak = carbonCalculationService.currentStreak(userId);
        long totalActivitiesLogged = activityLogRepository
                .findByUserIdAndDeletedAtIsNullOrderByActivityDateDescCreatedAtDesc(userId).size();

        return new EsgSummaryResponse(
                lifetimeCo2SavedKg, currentMonthCo2Kg, categoryBreakdown,
                creditsEarned, currentStreak, totalActivitiesLogged,
                accountStartDate, Instant.now()
        );
    }

    /** Hand-rolled CSV — no library needed for this simple, flat shape. */
    public String toCsv(EsgSummaryResponse summary) {
        StringBuilder sb = new StringBuilder();
        sb.append("Carbonexo ESG / Sustainability Report\n");
        sb.append("Generated At,").append(summary.generatedAt()).append("\n");
        sb.append("Account Start Date,").append(summary.accountStartDate()).append("\n");
        sb.append("\n");
        sb.append("Metric,Value\n");
        sb.append("Lifetime CO2 Saved (kg),").append(summary.lifetimeCo2SavedKg()).append("\n");
        sb.append("Current Month CO2 (kg),").append(summary.currentMonthCo2Kg()).append("\n");
        sb.append("Credits Earned,").append(summary.creditsEarned()).append("\n");
        sb.append("Current Streak (days),").append(summary.currentStreak()).append("\n");
        sb.append("Total Activities Logged,").append(summary.totalActivitiesLogged()).append("\n");
        sb.append("\n");
        sb.append("Category Breakdown\n");
        sb.append("Category,CO2 (kg)\n");
        for (Map.Entry<String, BigDecimal> entry : summary.categoryBreakdown().entrySet()) {
            sb.append(csvEscape(entry.getKey())).append(",").append(entry.getValue()).append("\n");
        }
        return sb.toString();
    }

    private String csvEscape(String value) {
        if (value == null) return "";
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }
}
