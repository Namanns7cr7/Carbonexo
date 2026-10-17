package com.ecotrack.ai.service;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface CoachMessageRepository extends JpaRepository<CoachMessage, UUID> {

    List<CoachMessage> findByUserIdOrderByCreatedAtAsc(UUID userId);

    List<CoachMessage> findTop20ByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Cursor-based pagination using (createdAt, id) tuple comparison for sub-50ms infinite scroll.
     * Backed by composite index: ix_coach_messages_user_created_id (user_id, created_at DESC, id DESC).
     */
    @Query("""
        SELECT m FROM CoachMessage m
        WHERE m.userId = :userId
          AND (m.createdAt < :beforeCreatedAt OR (m.createdAt = :beforeCreatedAt AND m.id < :beforeId))
        ORDER BY m.createdAt DESC, m.id DESC
    """)
    List<CoachMessage> findPagedBeforeCursor(
            @Param("userId") UUID userId,
            @Param("beforeCreatedAt") Instant beforeCreatedAt,
            @Param("beforeId") UUID beforeId,
            Pageable pageable
    );

    /**
     * Initial page of cursor-based pagination starting from latest messages.
     */
    @Query("""
        SELECT m FROM CoachMessage m
        WHERE m.userId = :userId
        ORDER BY m.createdAt DESC, m.id DESC
    """)
    List<CoachMessage> findInitialCursorPage(
            @Param("userId") UUID userId,
            Pageable pageable
    );
}
