package com.ecotrack.social.dto;

import java.util.List;
import java.util.UUID;

public record GroupResponse(
        UUID id,
        String name,
        String inviteCode,
        UUID createdBy,
        List<GroupMemberResponse> members
) {}
