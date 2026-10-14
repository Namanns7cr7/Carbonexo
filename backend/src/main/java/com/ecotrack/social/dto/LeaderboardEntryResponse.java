package com.ecotrack.social.dto;

import java.util.UUID;

/** One ranked row in a group leaderboard. {@code value} is kg CO2 saved or credits, per the requested metric. */
public record LeaderboardEntryResponse(
        UUID userId,
        String displayName,
        int rank,
        double value
) {}
