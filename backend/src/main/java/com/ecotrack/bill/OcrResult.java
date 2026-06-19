package com.ecotrack.bill;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/** OCR result for a bill (table: ocr_results). */
@Entity
@Table(name = "ocr_results")
public class OcrResult extends BaseEntity {

    @Column(name = "bill_id", nullable = false)
    private UUID billId;

    @Column(nullable = false)
    private String provider;

    @Column(name = "raw_json", columnDefinition = "jsonb")
    private String rawJson;

    @Column(name = "parsed_billing_month")
    private LocalDate parsedBillingMonth;

    @Column(name = "parsed_units")
    private BigDecimal parsedUnits;

    @Column(name = "parsed_amount")
    private BigDecimal parsedAmount;

    private BigDecimal confidence;

    @Column(nullable = false)
    private boolean corrected = false;

    @Column(name = "corrected_by")
    private UUID correctedBy;

    @Column(name = "corrected_at")
    private Instant correctedAt;

    // --- getters / setters ---
    public UUID getBillId() { return billId; }
    public void setBillId(UUID billId) { this.billId = billId; }
    public String getProvider() { return provider; }
    public void setProvider(String provider) { this.provider = provider; }
    public String getRawJson() { return rawJson; }
    public void setRawJson(String rawJson) { this.rawJson = rawJson; }
    public LocalDate getParsedBillingMonth() { return parsedBillingMonth; }
    public void setParsedBillingMonth(LocalDate parsedBillingMonth) { this.parsedBillingMonth = parsedBillingMonth; }
    public BigDecimal getParsedUnits() { return parsedUnits; }
    public void setParsedUnits(BigDecimal parsedUnits) { this.parsedUnits = parsedUnits; }
    public BigDecimal getParsedAmount() { return parsedAmount; }
    public void setParsedAmount(BigDecimal parsedAmount) { this.parsedAmount = parsedAmount; }
    public BigDecimal getConfidence() { return confidence; }
    public void setConfidence(BigDecimal confidence) { this.confidence = confidence; }
    public boolean isCorrected() { return corrected; }
    public void setCorrected(boolean corrected) { this.corrected = corrected; }
    public UUID getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(UUID correctedBy) { this.correctedBy = correctedBy; }
    public Instant getCorrectedAt() { return correctedAt; }
    public void setCorrectedAt(Instant correctedAt) { this.correctedAt = correctedAt; }
}
