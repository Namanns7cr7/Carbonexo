package com.ecotrack.reward.dto;

import java.util.UUID;

public record RedemptionResponse(
        UUID id, UUID rewardId, String rewardTitle,
        int costCredits, String status, String createdAt
) {}
