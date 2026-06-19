package com.ecotrack.credit.dto;

import java.util.UUID;

public record CreditBalanceResponse(UUID userId, int balance) {}
