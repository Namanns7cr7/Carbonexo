package com.ecotrack.carbon.dto;

import java.math.BigDecimal;
import java.util.UUID;

public record EmissionFactorResponse(
        UUID id,
        String category,
        String factorKey,
        String label,
        String emoji,
        String unit,
        double factorKgPerUnit,
        double defaultQty
) {}
