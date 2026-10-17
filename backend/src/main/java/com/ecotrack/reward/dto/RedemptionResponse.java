package com.ecotrack.reward.dto;

import java.time.Instant;
import java.util.UUID;

public record RedemptionResponse(
        UUID id, UUID rewardId, String rewardTitle,
        int costCredits, String status, String createdAt
) {
    /**
     * Projection constructor for JPQL/DTO single-join queries mapping Instant createdAt.
     */
    public RedemptionResponse(UUID id, UUID rewardId, String rewardTitle,
                              int costCredits, String status, Instant createdAt) {
        this(id, rewardId, rewardTitle, costCredits, status, createdAt != null ? createdAt.toString() : null);
    }
}
