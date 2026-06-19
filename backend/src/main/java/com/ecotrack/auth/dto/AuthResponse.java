package com.ecotrack.auth.dto;

import java.util.UUID;

/** Returned by register/login/refresh. */
public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresInSeconds,
        UserSummary user
) {
    public record UserSummary(UUID id, String email, String displayName, String role) {}
}
