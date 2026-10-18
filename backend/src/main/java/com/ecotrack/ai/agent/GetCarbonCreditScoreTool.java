package com.ecotrack.ai.agent;

import com.ecotrack.score.CreditScoreService;
import com.ecotrack.score.dto.CreditScoreResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The signed-in user's Carbon Credit Score from {@link CreditScoreService} (the only score formula),
 * with each component's points and cap so the coach can say which inputs move it.
 */
@Component
public class GetCarbonCreditScoreTool implements CoachTool {

    public static final String NAME = "getCarbonCreditScore";
    // Caps and base mirror CreditScoreService; CoachSecurityIntegrationTest.creditScoreCapsMatchTheScoreService fails if they drift.
    static final int BASE = 300, MAX = 850, BALANCE_CAP = 300, STREAK_CAP = 150, CONSISTENCY_CAP = 100;
    /** 3 points x 30-day window: the consistency cap of 100 cannot be reached, so the highest reachable score is 840. */
    static final int CONSISTENCY_REACHABLE = 90;

    private final CreditScoreService scores;

    public GetCarbonCreditScoreTool(CreditScoreService scores) {
        this.scores = scores;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's Carbonexo Carbon Credit Score (an in-app engagement score, 300-850), its tier, and the "
                + "points from each input (green-credit balance, tracking streak, active days in the last 30) with their caps. "
                + "Takes no arguments; it always returns the current user only.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        CreditScoreResponse s = scores.getScore(ctx.userId());
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("score", s.score());
        m.put("scale", BASE + "-" + MAX);
        m.put("highest_reachable", BASE + BALANCE_CAP + STREAK_CAP + CONSISTENCY_REACHABLE);
        m.put("tier", s.tier());
        m.put("what_it_is", "In-app engagement score. Not a financial credit score and not a rating of carbon credits.");
        List<Map<String, Object>> components = List.of(
                component("green_credit_balance", s.balancePoints(), BALANCE_CAP, "1 point per 2 green credits in the balance",
                        Map.of("balance", s.balance())),
                component("tracking_streak", s.streakPoints(), STREAK_CAP, "10 points per consecutive day with a log",
                        Map.of("streak_days", s.streak())),
                component("consistency", s.consistencyPoints(), CONSISTENCY_REACHABLE, "3 points per distinct day with a log in the last 30 days",
                        Map.of("active_days_last_30", s.daysActiveLast30())));
        m.put("base_points", BASE);
        m.put("components", components);
        List<String> improve = new ArrayList<>();
        for (Map<String, Object> c : components) {
            if (Boolean.FALSE.equals(c.get("at_cap"))) improve.add(c.get("name") + ": " + c.get("rule"));
        }
        m.put("can_still_improve", improve);
        m.put("history", "Score history is not stored, so a change between two dates cannot be attributed exactly.");
        return m;
    }

    private static Map<String, Object> component(String name, int points, int cap, String rule, Map<String, Object> input) {
        Map<String, Object> c = new LinkedHashMap<>();
        c.put("name", name);
        c.put("points", points);
        c.put("cap", cap);
        c.put("at_cap", points >= cap);
        c.put("rule", rule);
        c.put("input", input);
        return c;
    }
}
