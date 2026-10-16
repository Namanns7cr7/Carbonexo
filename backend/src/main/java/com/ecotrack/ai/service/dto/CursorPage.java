package com.ecotrack.ai.service.dto;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Generic container for cursor-based pagination responses.
 */
public record CursorPage<T>(
        List<T> items,
        Instant nextCursorCreatedAt,
        UUID nextCursorId,
        boolean hasMore
) {}
