package com.ecotrack.ai.service;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface CoachMessageRepository extends JpaRepository<CoachMessage, UUID> {
    List<CoachMessage> findByUserIdOrderByCreatedAtAsc(UUID userId);
    List<CoachMessage> findTop20ByUserIdOrderByCreatedAtDesc(UUID userId);
}
