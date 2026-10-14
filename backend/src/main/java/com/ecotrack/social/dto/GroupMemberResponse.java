package com.ecotrack.social.dto;

import java.util.UUID;

public record GroupMemberResponse(
        UUID userId,
        String displayName,
        String role,
        String joinedAt
) {}
