package com.ecotrack.social.dto;

import java.util.List;

/**
 * Wraps the ranked leaderboard entries (deterministic, DB-driven) together
 * with a short AI-generated encouraging summary sentence for the group.
 * {@code aiSummary} is nullable — it is never required for the leaderboard
 * itself to render.
 */
public record LeaderboardResponse(
        List<LeaderboardEntryResponse> entries,
        String aiSummary
) {}
