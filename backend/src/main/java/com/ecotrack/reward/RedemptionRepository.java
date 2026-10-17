package com.ecotrack.reward;

import com.ecotrack.reward.dto.RedemptionResponse;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface RedemptionRepository extends JpaRepository<Redemption, UUID> {

    List<Redemption> findByUserIdOrderByCreatedAtDesc(UUID userId);

    /**
     * Single JOIN projection query to eliminate N+1 loops when loading redemption history.
     */
    @Query("""
        SELECT new com.ecotrack.reward.dto.RedemptionResponse(
            r.id,
            r.rewardId,
            COALESCE(w.title, 'Unknown'),
            r.costCredits,
            r.status,
            r.createdAt
        )
        FROM Redemption r
        LEFT JOIN Reward w ON r.rewardId = w.id
        WHERE r.userId = :userId
        ORDER BY r.createdAt DESC
    """)
    List<RedemptionResponse> findRedemptionResponsesByUserId(@Param("userId") UUID userId);
}
