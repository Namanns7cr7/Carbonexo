package com.ecotrack.reward;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface RewardRepository extends JpaRepository<Reward, UUID> {
    List<Reward> findByActiveIsTrueAndDeletedAtIsNullOrderByTitleAsc();

    /**
     * Atomically takes one unit of limited stock. Returns 0 when the reward is out of stock; a
     * read-modify-write on the entity would let two users redeem the last unit. Unlimited
     * rewards (null stock) are never touched.
     */
    @Modifying
    @Query("UPDATE Reward r SET r.stock = r.stock - 1 WHERE r.id = :id AND r.stock IS NOT NULL AND r.stock > 0")
    int takeOneFromStock(@Param("id") UUID id);
}
