package com.ecotrack.credit.dto;

import java.util.UUID;

public record CreditHistoryResponse(
        UUID id, int delta, int balanceAfter, String reason,
        String ruleKey, String refType, String createdAt
) {}
