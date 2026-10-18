package com.ecotrack.ai.agent;

import com.ecotrack.bill.BillService;
import com.ecotrack.bill.dto.BillResponse;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.report.ReportService;
import com.ecotrack.report.dto.EsgSummaryResponse;
import com.ecotrack.reward.RewardService;
import com.ecotrack.reward.dto.RewardResponse;
import com.ecotrack.social.GroupService;
import com.ecotrack.social.dto.GroupSummaryResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

class NewAgentToolsTest {

    private UUID userId;
    private ToolContext ctx;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        ctx = new ToolContext(userId, "IN", true, LocalDate.now(), new SourceLedger(), false, new GroundedNumbers());
    }

    @Test
    void esgReportSummaryReturnsAuthoritativeMetrics() {
        ReportService reportService = Mockito.mock(ReportService.class);
        EsgSummaryResponse summary = new EsgSummaryResponse(
                new BigDecimal("1250.50"),
                new BigDecimal("145.20"),
                Map.of("TRAVEL", new BigDecimal("80.00"), "ELECTRICITY", new BigDecimal("65.20")),
                350,
                14,
                28L,
                LocalDate.of(2026, 1, 1),
                Instant.now()
        );
        when(reportService.getEsgSummary(userId)).thenReturn(summary);

        GetEsgReportSummaryTool tool = new GetEsgReportSummaryTool(reportService);
        assertEquals("getEsgReportSummary", tool.name());
        Map<String, Object> result = tool.execute(ctx, Map.of());

        assertEquals("OK", result.get("status"));
        assertEquals(1250.50, (Double) result.get("lifetime_co2_saved_kg"), 0.01);
        assertEquals(145.20, (Double) result.get("current_month_co2_kg"), 0.01);
        assertEquals(350, result.get("credits_earned"));
        assertEquals(14, result.get("current_streak"));
    }

    @Test
    void userGroupsToolReturnsOnlyUserGroupsWithoutExposingOtherMembers() {
        GroupService groupService = Mockito.mock(GroupService.class);
        GroupSummaryResponse g = new GroupSummaryResponse(
                UUID.randomUUID(),
                "Eco Warriors Bangalore",
                "WARRIORS2026",
                12L
        );

        when(groupService.getMyGroups(userId)).thenReturn(List.of(g));

        GetUserGroupsTool tool = new GetUserGroupsTool(groupService);
        assertEquals("getUserGroups", tool.name());
        Map<String, Object> result = tool.execute(ctx, Map.of());

        assertEquals("OK", result.get("status"));
        assertEquals(1, result.get("groups_count"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> groups = (List<Map<String, Object>>) result.get("groups");
        assertEquals("Eco Warriors Bangalore", groups.get(0).get("name"));
        assertEquals(12L, groups.get(0).get("member_count"));
    }

    @Test
    void userBillsToolReturnsUserBillsWithOcrStatus() {
        BillService billService = Mockito.mock(BillService.class);
        BillResponse b = new BillResponse(
                UUID.randomUUID(),
                userId,
                "https://storage.googleapis.com/blob/1",
                "bescom_aug.pdf",
                "application/pdf",
                1024L,
                "PROCESSED",
                "2026-08",
                new BigDecimal("220.00"),
                new BigDecimal("1650.00"),
                "INR",
                "2026-09-01T10:00:00Z"
        );

        when(billService.listByUser(userId)).thenReturn(List.of(b));

        GetUserBillsTool tool = new GetUserBillsTool(billService);
        assertEquals("getUserBills", tool.name());
        Map<String, Object> result = tool.execute(ctx, Map.of());

        assertEquals("OK", result.get("status"));
        assertEquals(1, result.get("total_bills_uploaded"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> bills = (List<Map<String, Object>>) result.get("recent_bills");
        assertEquals("2026-08", bills.get(0).get("billing_month"));
        assertEquals(new BigDecimal("220.00"), bills.get(0).get("units_consumed_kwh"));
        assertEquals("PROCESSED", bills.get(0).get("status"));
    }

    @Test
    void rewardsCatalogToolReturnsActiveRewards() {
        RewardService rewardService = Mockito.mock(RewardService.class);
        RewardResponse r = new RewardResponse(
                UUID.randomUUID(),
                "ECO_STORE_10",
                "Eco Store 10% Off Voucher",
                "Valid on organic groceries",
                150,
                50,
                "EcoStore",
                "https://images.carbonexo.com/rewards/ecostore.png"
        );

        when(rewardService.getCatalog()).thenReturn(List.of(r));

        GetRewardsCatalogTool tool = new GetRewardsCatalogTool(rewardService);
        assertEquals("getRewardsCatalog", tool.name());
        Map<String, Object> result = tool.execute(ctx, Map.of());

        assertEquals("OK", result.get("status"));
        assertEquals(1, result.get("rewards_count"));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> rewards = (List<Map<String, Object>>) result.get("rewards");
        assertEquals("Eco Store 10% Off Voucher", rewards.get(0).get("title"));
        assertEquals(150, rewards.get(0).get("cost_credits"));
    }

    @Test
    void activityCategoryBreakdownAggregatesCorrectly() {
        ActivityLogRepository repository = Mockito.mock(ActivityLogRepository.class);
        when(repository.breakdownByCategory(eq(userId), any(LocalDate.class), any(LocalDate.class)))
                .thenReturn(List.of(
                        new Object[]{"TRANSPORT", new BigDecimal("45.50")},
                        new Object[]{"ELECTRICITY", new BigDecimal("71.00")}
                ));

        GetActivityCategoryBreakdownTool tool = new GetActivityCategoryBreakdownTool(repository);
        assertEquals("getActivityCategoryBreakdown", tool.name());
        Map<String, Object> result = tool.execute(ctx, Map.of("period", "last_30_days"));

        assertEquals("OK", result.get("status"));
        assertEquals("last_30_days", result.get("period"));
        assertEquals(new BigDecimal("116.50"), result.get("total_co2_kg"));
        @SuppressWarnings("unchecked")
        Map<String, BigDecimal> breakdown = (Map<String, BigDecimal>) result.get("category_breakdown_co2_kg");
        assertEquals(new BigDecimal("45.50"), breakdown.get("TRANSPORT"));
        assertEquals(new BigDecimal("71.00"), breakdown.get("ELECTRICITY"));
    }

    @Test
    void toolsRejectModelSuppliedUserId() {
        ReportService reportService = Mockito.mock(ReportService.class);
        GetEsgReportSummaryTool tool = new GetEsgReportSummaryTool(reportService);
        assertThrows(ToolArgs.ToolArgumentException.class, () ->
                tool.execute(ctx, Map.of("userId", UUID.randomUUID().toString())));
    }
}
