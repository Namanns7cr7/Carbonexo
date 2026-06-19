package com.ecotrack.reward;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "redemptions")
public class Redemption extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "reward_id", nullable = false)
    private UUID rewardId;

    @Column(name = "cost_credits", nullable = false)
    private int costCredits;

    @Column(nullable = false)
    private String status = "PENDING";

    @Column(name = "ledger_id")
    private UUID ledgerId;

    @Column(name = "fulfilled_at")
    private Instant fulfilledAt;

    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public UUID getRewardId() { return rewardId; }
    public void setRewardId(UUID rewardId) { this.rewardId = rewardId; }
    public int getCostCredits() { return costCredits; }
    public void setCostCredits(int costCredits) { this.costCredits = costCredits; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public UUID getLedgerId() { return ledgerId; }
    public void setLedgerId(UUID ledgerId) { this.ledgerId = ledgerId; }
    public Instant getFulfilledAt() { return fulfilledAt; }
    public void setFulfilledAt(Instant fulfilledAt) { this.fulfilledAt = fulfilledAt; }
}
