package com.ecotrack.profile.dto;

import java.util.UUID;

public record ProfileResponse(
        UUID id,
        UUID userId,
        String name,
        String travelMode,
        Double dailyDistanceKm,
        String diet,
        String electricityUsage,
        String shoppingHabit,
        Integer weeklyGoalPct,
        String region,
        boolean onboarded
) {}
