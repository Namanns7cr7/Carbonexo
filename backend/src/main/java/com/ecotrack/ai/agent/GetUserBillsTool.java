package com.ecotrack.ai.agent;

import com.ecotrack.bill.BillService;
import com.ecotrack.bill.dto.BillResponse;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** The signed-in user's electricity bills and OCR processing status, backed by BillService. */
@Component
public class GetUserBillsTool implements CoachTool {

    public static final String NAME = "getUserBills";
    private static final int MAX_BILLS = 6;
    private final BillService billService;

    public GetUserBillsTool(BillService billService) {
        this.billService = billService;
    }

    @Override public String name() { return NAME; }

    @Override public String description() {
        return "Get the signed-in user's recent uploaded electricity bills, OCR scanning status, billing months, "
                + "units consumed (kWh), and billed amounts. Takes no arguments; only the current user's data.";
    }

    @Override public String parametersJson() { return "{\"type\":\"OBJECT\",\"properties\":{}}"; }

    @Override
    public Map<String, Object> execute(ToolContext ctx, Map<String, Object> args) {
        ToolArgs.onlyKeys(args, Set.of());
        List<BillResponse> bills = billService.listByUser(ctx.userId());
        List<Map<String, Object>> recent = new ArrayList<>();
        for (BillResponse b : bills.stream().limit(MAX_BILLS).toList()) {
            Map<String, Object> item = new LinkedHashMap<>();
            item.put("bill_id", b.id().toString());
            item.put("status", b.status());
            item.put("billing_month", b.billingMonth() != null ? b.billingMonth() : "unparsed");
            item.put("units_consumed_kwh", b.unitsConsumed());
            item.put("bill_amount", b.billAmount());
            item.put("currency", b.currency());
            item.put("created_at", b.createdAt());
            recent.add(item);
        }
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("status", "OK");
        m.put("total_bills_uploaded", bills.size());
        m.put("recent_bills", recent);
        if (bills.isEmpty()) {
            m.put("note", "No electricity bills uploaded yet. You can upload a bill on the Bill Upload page to auto-extract units and earn green credits.");
        }
        return m;
    }
}
