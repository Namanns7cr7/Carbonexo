package com.ecotrack.carbon;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** One tracked activity on a given day (table: activity_logs). */
@Entity
@Table(name = "activity_logs")
public class ActivityLog extends BaseEntity {

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String category;

    @Column(name = "factor_key")
    private String factorKey;

    @Column(nullable = false)
    private String label;

    private String emoji;

    private BigDecimal quantity;

    private String unit;

    @Column(name = "co2_kg", nullable = false)
    private BigDecimal co2Kg;

    private String note;

    @Column(name = "activity_date", nullable = false)
    private LocalDate activityDate;

    @Column(nullable = false)
    private String source = "manual";

    @Column(name = "bill_id")
    private UUID billId;

    @Column(name = "deleted_at")
    private Instant deletedAt;

    // --- getters / setters ---
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getFactorKey() { return factorKey; }
    public void setFactorKey(String factorKey) { this.factorKey = factorKey; }
    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getEmoji() { return emoji; }
    public void setEmoji(String emoji) { this.emoji = emoji; }
    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public BigDecimal getCo2Kg() { return co2Kg; }
    public void setCo2Kg(BigDecimal co2Kg) { this.co2Kg = co2Kg; }
    public String getNote() { return note; }
    public void setNote(String note) { this.note = note; }
    public LocalDate getActivityDate() { return activityDate; }
    public void setActivityDate(LocalDate activityDate) { this.activityDate = activityDate; }
    public String getSource() { return source; }
    public void setSource(String source) { this.source = source; }
    public UUID getBillId() { return billId; }
    public void setBillId(UUID billId) { this.billId = billId; }
    public Instant getDeletedAt() { return deletedAt; }
    public void setDeletedAt(Instant deletedAt) { this.deletedAt = deletedAt; }
}
