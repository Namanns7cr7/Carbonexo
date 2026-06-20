package com.ecotrack.auth.dto;

import jakarta.validation.constraints.NotBlank;

/** Body for {@code POST /api/auth/google}: the Google Identity Services ID token. */
public record GoogleLoginRequest(@NotBlank String idToken) {}
