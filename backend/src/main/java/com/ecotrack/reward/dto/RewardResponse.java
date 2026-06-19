package com.ecotrack.reward.dto;

import java.util.UUID;

public record RewardResponse(
        UUID id, String rewardKey, String title, String description,
        int costCredits, Integer stock, String partner, String imageUrl
) {}
