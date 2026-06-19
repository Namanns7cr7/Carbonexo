package com.ecotrack.reward;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "rewards")
public class Reward extends BaseEntity {

    @Column(name = "reward_key", unique = true, nullable = false)
    private String rewardKey;

    @Column(nullable = false)
    private String title;

    private String description;

    @Column(name = "cost_credits", nullable = false)
    private int costCredits;

    private Integer stock;

    private String partner;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    public String getRewardKey() { return rewardKey; }
    public String getTitle() { return title; }
    public String getDescription() { return description; }
    public int getCostCredits() { return costCredits; }
    public Integer getStock() { return stock; }
    public void setStock(Integer stock) { this.stock = stock; }
    public String getPartner() { return partner; }
    public String getImageUrl() { return imageUrl; }
    public boolean isActive() { return active; }
    public Instant getDeletedAt() { return deletedAt; }
}
