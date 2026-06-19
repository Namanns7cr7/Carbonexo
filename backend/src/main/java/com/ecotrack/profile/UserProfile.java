package com.ecotrack.profile;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

/** User profile (table: user_profiles). */
@Entity
@Table(name = "user_profiles")
public class UserProfile extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    private String name;

    @Column(name = "travel_mode")
    private String travelMode;

    @Column(name = "daily_distance_km")
    private Double dailyDistanceKm;

    private String diet;

    @Column(name = "electricity_usage")
    private String electricityUsage;

    @Column(name = "shopping_habit")
    private String shoppingHabit;

    @Column(name = "weekly_goal_pct")
    private Integer weeklyGoalPct;

    @Column(nullable = false)
    private String region = "GLOBAL";

    @Column(nullable = false)
    private boolean onboarded = false;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // --- getters / setters ---
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTravelMode() { return travelMode; }
    public void setTravelMode(String travelMode) { this.travelMode = travelMode; }
    public Double getDailyDistanceKm() { return dailyDistanceKm; }
    public void setDailyDistanceKm(Double dailyDistanceKm) { this.dailyDistanceKm = dailyDistanceKm; }
    public String getDiet() { return diet; }
    public void setDiet(String diet) { this.diet = diet; }
    public String getElectricityUsage() { return electricityUsage; }
    public void setElectricityUsage(String electricityUsage) { this.electricityUsage = electricityUsage; }
    public String getShoppingHabit() { return shoppingHabit; }
    public void setShoppingHabit(String shoppingHabit) { this.shoppingHabit = shoppingHabit; }
    public Integer getWeeklyGoalPct() { return weeklyGoalPct; }
    public void setWeeklyGoalPct(Integer weeklyGoalPct) { this.weeklyGoalPct = weeklyGoalPct; }
    public String getRegion() { return region; }
    public void setRegion(String region) { this.region = region; }
    public boolean isOnboarded() { return onboarded; }
    public void setOnboarded(boolean onboarded) { this.onboarded = onboarded; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
