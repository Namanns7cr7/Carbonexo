package com.ecotrack.credit.dto;

import java.util.UUID;

public record CreditHistoryResponse(
        UUID id, int delta, int balanceAfter, String reason,
        String ruleKey, String refType, String createdAt,
        /** What the entry refers to (an action, a bill…). Lets clients count distinct completions. */
        UUID refId
) {}
