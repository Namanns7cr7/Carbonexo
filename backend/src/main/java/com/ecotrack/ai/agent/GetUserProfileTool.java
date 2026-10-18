package com.ecotrack.ai.agent;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The signed-in user's region and stated habits. No name, email or ids are returned. */
@Component
public class GetUserProfileTool implements CoachTool {

    public static final String NAME = "getUserProfile";

    private final JdbcTemplate jdbc;

    public GetUserProfileTool(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's region (and whether they confirmed it), travel mode, typical daily distance, diet and weekly goal. Takes no arguments; it always returns the current user only.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        List<Map<String, Object>> rows = jdbc.queryForList("""
                SELECT region, region_confirmed, travel_mode, daily_distance_km, diet, weekly_goal_pct, onboarded
                FROM user_profiles WHERE user_id = ? AND deleted_at IS NULL""", ctx.userId());
        Map<String, Object> m = new LinkedHashMap<>();
        if (rows.isEmpty()) {
            m.put("status", "NO_PROFILE");
            m.put("region", ctx.region());
            return m;
        }
        Map<String, Object> r = rows.get(0);
        m.put("status", "OK");
        m.put("region", r.get("region"));
        m.put("region_confirmed", r.get("region_confirmed"));
        m.put("travel_mode", r.get("travel_mode"));
        m.put("daily_distance_km", r.get("daily_distance_km"));
        m.put("diet", r.get("diet"));
        m.put("weekly_goal_pct", r.get("weekly_goal_pct"));
        m.put("onboarded", r.get("onboarded"));
        if (!Boolean.TRUE.equals(r.get("region_confirmed"))) {
            m.put("note", "region not confirmed by the user: ask them to confirm it under Profile > Region for emission estimates before estimating");
        }
        return m;
    }
}
