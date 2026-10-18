package com.ecotrack.ai.agent;

import com.ecotrack.credit.CreditService;
import com.ecotrack.credit.dto.CreditHistoryResponse;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The signed-in user's Carbonexo green-credit balance and latest ledger entries, from the credit ledger. */
@Component
public class GetGreenCreditBalanceTool implements CoachTool {

    public static final String NAME = "getGreenCreditBalance";
    static final String KIND = "Carbonexo green credits: in-app reward points. Not certified carbon credits or offsets; "
            + "not tradable or sellable; redeemable only in the Carbonexo rewards catalogue.";
    private static final int RECENT = 5;

    private final CreditService credits;

    public GetGreenCreditBalanceTool(CreditService credits) {
        this.credits = credits;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's Carbonexo green-credit balance (in-app reward points) and their most recent credit "
                + "ledger entries. Takes no arguments; it always returns the current user only.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        int balance = credits.getBalance(ctx.userId()).balance();
        List<Map<String, Object>> recent = credits.getHistory(ctx.userId()).stream().limit(RECENT).map(GetGreenCreditBalanceTool::entry).toList();
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("balance", balance);
        m.put("unit", "Carbonexo green credits");
        m.put("kind", KIND);
        m.put("recent_entries", recent);
        if (recent.isEmpty()) m.put("note", "no credit ledger entries yet");
        return m;
    }

    private static Map<String, Object> entry(CreditHistoryResponse h) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("delta", h.delta());
        e.put("reason", h.reason());
        e.put("date", h.createdAt().length() >= 10 ? h.createdAt().substring(0, 10) : h.createdAt());
        return e;
    }
}
