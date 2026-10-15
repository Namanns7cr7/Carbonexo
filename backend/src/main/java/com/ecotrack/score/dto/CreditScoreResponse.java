package com.ecotrack.score.dto;

public record CreditScoreResponse(
        int score,
        String tier,
        int balancePoints,
        int streakPoints,
        int consistencyPoints,
        int balance,
        int streak,
        int daysActiveLast30
) {
}
