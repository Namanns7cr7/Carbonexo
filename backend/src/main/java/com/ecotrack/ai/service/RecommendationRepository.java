package com.ecotrack.ai.service;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface RecommendationRepository extends JpaRepository<Recommendation, UUID> {
    List<Recommendation> findByUserIdAndTypeOrderByCreatedAtDesc(UUID userId, String type);
    List<Recommendation> findByUserIdOrderByCreatedAtDesc(UUID userId);
}
