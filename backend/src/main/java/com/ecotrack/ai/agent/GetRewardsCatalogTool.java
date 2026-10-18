package com.ecotrack.ai.agent;

import com.ecotrack.reward.RewardService;
import com.ecotrack.reward.dto.RewardResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The active rewards catalogue that green credits can be redeemed for, backed by RewardService. */
@Component
public class GetRewardsCatalogTool implements CoachTool {

    public static final String NAME = "getRewardsCatalog";
    private final RewardService rewardService;

    public GetRewardsCatalogTool(RewardService rewardService) {
        this.rewardService = rewardService;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the active rewards catalogue showing items available for green-credit redemption, their partners, "
                + "and credit costs. Takes no arguments.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        List<RewardResponse> rewards = rewardService.getCatalog();
        List<Map<String, Object>> list = new ArrayList<>();
        for (RewardResponse r : rewards) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("title", r.title());
            item.put("description", r.description());
            item.put("cost_credits", r.costCredits());
            item.put("partner", r.partner());
            item.put("in_stock", r.stock() == null || r.stock() > 0);
            list.add(item);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("rewards_count", rewards.size());
        m.put("rewards", list);
        return m;
    }
}
