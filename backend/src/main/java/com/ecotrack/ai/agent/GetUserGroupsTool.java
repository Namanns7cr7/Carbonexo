package com.ecotrack.ai.agent;

import com.ecotrack.social.GroupService;
import com.ecotrack.social.dto.GroupSummaryResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The signed-in user's community and household groups, backed by GroupService. */
@Component
public class GetUserGroupsTool implements CoachTool {

    public static final String NAME = "getUserGroups";
    private final GroupService groupService;

    public GetUserGroupsTool(GroupService groupService) {
        this.groupService = groupService;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's joined community and household groups, including group names, invite codes, "
                + "and member counts. Takes no arguments; it always returns the current user's groups only.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        List<GroupSummaryResponse> groups = groupService.getMyGroups(ctx.userId());
        List<Map<String, Object>> list = new ArrayList<>();
        for (GroupSummaryResponse g : groups) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("group_id", g.id().toString());
            item.put("name", g.name());
            item.put("invite_code", g.inviteCode());
            item.put("member_count", g.memberCount());
            list.add(item);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("groups_count", groups.size());
        m.put("groups", list);
        if (groups.isEmpty()) {
            m.put("note", "You are not currently in any community groups. You can join or create one on the Social page.");
        }
        return m;
    }
}
