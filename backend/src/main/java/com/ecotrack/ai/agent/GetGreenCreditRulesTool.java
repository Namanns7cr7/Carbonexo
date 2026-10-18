package com.ecotrack.ai.agent;

import com.ecotrack.reward.RewardService;
import com.ecotrack.reward.dto.RewardResponse;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** How Carbonexo green credits are earned (active credit rules) and what they can be redeemed for (rewards catalogue). */
@Component
public class GetGreenCreditRulesTool implements CoachTool {

    public static final String NAME = "getGreenCreditRules";

    /**
     * Rules the application actually awards today, and where. A rule row without an entry here exists
     * in the table but no code path awards it, so the coach must not promise it.
     */
    static final Map<String, String> AWARDED_BY = Map.of(
            "signup_bonus", "once, when the account is created",
            "action_done", "marking a plan action as done on the Actions page (once per action)",
            "bill_upload", "uploading and confirming an electricity bill on the Bills page");

    private final JdbcTemplate jdbc;
    private final RewardService rewards;

    public GetGreenCreditRulesTool(JdbcTemplate jdbc, RewardService rewards) {
        this.jdbc = jdbc;
        this.rewards = rewards;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get how Carbonexo green credits are earned (the active earning rules and whether the app awards each one today) "
                + "and the in-app rewards catalogue they can be redeemed for, with costs. Takes no arguments.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        List<Map<String, Object>> rules = jdbc.queryForList("""
                SELECT rule_key, description, credits_per_unit, unit FROM credit_rules
                WHERE active AND valid_from <= CURRENT_DATE AND (valid_to IS NULL OR valid_to >= CURRENT_DATE)
                ORDER BY rule_key""").stream().map(r -> {
            Map<String, Object> m = new LinkedHashMap<>();
            String key = (String) r.get("rule_key");
            m.put("rule", key);
            m.put("description", r.get("description"));
            m.put("credits", r.get("credits_per_unit"));
            m.put("per", r.get("unit"));
            m.put("awarded_by_app_today", AWARDED_BY.containsKey(key));
            m.put("how", AWARDED_BY.getOrDefault(key, "not awarded by the app yet; do not promise it"));
            return m;
        }).toList();
        List<Map<String, Object>> catalogue = rewards.getCatalog().stream().map(GetGreenCreditRulesTool::reward).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("earning_rules", rules);
        m.put("rewards_catalogue", catalogue);
        m.put("redeem_where", "Rewards page in the app. The coach cannot redeem for the user.");
        m.put("kind", GetGreenCreditBalanceTool.KIND);
        return m;
    }

    private static Map<String, Object> reward(RewardResponse r) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("title", r.title());
        m.put("cost_credits", r.costCredits());
        m.put("in_stock", r.stock() == null || r.stock() > 0);
        m.put("partner", r.partner());
        return m;
    }
}
