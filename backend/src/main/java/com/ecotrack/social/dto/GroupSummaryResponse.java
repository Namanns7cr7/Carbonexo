package com.ecotrack.social.dto;

import java.util.UUID;

/** Lighter group view for "my groups" lists — no full member roster. */
public record GroupSummaryResponse(
        UUID id,
        String name,
        String inviteCode,
        long memberCount
) {}
