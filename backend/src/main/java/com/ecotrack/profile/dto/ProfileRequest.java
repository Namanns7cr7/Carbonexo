package com.ecotrack.profile;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record ProfileRequest(
        @Size(max = 120) String name,
        @Size(max = 40) String travelMode,
        Double dailyDistanceKm,
        @Size(max = 40) String diet,
        @Size(max = 40) String electricityUsage,
        @Size(max = 40) String shoppingHabit,
        @Min(0) @Max(100) Integer weeklyGoalPct,
        boolean onboarded
) {}
