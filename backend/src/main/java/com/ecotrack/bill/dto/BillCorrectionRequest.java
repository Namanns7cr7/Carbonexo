package com.ecotrack.bill.dto;

import java.math.BigDecimal;

public record BillCorrectionRequest(
        String billingMonth,     // YYYY-MM format
        BigDecimal unitsConsumed,
        BigDecimal billAmount
) {}
