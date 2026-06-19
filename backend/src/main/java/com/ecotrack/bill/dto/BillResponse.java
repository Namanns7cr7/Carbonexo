package com.ecotrack.bill.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record BillResponse(
        UUID id,
        UUID userId,
        String blobUrl,
        String originalFilename,
        String contentType,
        long sizeBytes,
        String status,
        String billingMonth,
        BigDecimal unitsConsumed,
        BigDecimal billAmount,
        String currency,
        String createdAt
) {}
