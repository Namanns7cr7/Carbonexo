package com.ecotrack.bill.dto;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;

import java.math.BigDecimal;

/** A user's correction of OCR output. Null fields mean "leave unchanged". */
public record BillCorrectionRequest(
        @Pattern(regexp = "\\d{4}-(0[1-9]|1[0-2])", message = "billingMonth must be formatted YYYY-MM")
        String billingMonth,
        @PositiveOrZero @DecimalMax("1000000") BigDecimal unitsConsumed,
        @PositiveOrZero @DecimalMax("100000000") BigDecimal billAmount
) {}
