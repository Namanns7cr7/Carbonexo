package com.ecotrack.carbon.dto;

import java.util.UUID;

public record ActivityLogResponse(
        UUID id,
        String category,
        String factorKey,
        String label,
        String emoji,
        Double quantity,
        String unit,
        double co2Kg,
        String note,
        String activityDate,
        String source
) {}
