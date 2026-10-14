package com.ecotrack.social.dto;

import jakarta.validation.constraints.NotBlank;

public record JoinGroupRequest(
        @NotBlank String inviteCode
) {}
