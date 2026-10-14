package com.ecotrack.social.dto;

import java.util.UUID;

public record GoalProgressResponse(
        UUID groupId,
        double combinedCurrentKg,
        double combinedGoalKg,
        double progressPct,
        int memberCount
) {}
