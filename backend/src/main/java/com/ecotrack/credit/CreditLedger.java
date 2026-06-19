package com.ecotrack.credit;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.UUID;

/** Append-only credit ledger (table: credit_ledger). Immutable — no update/delete/soft-delete. */
@Entity
@Table(name = "credit_ledger")
public class CreditLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private int delta;              // +earn / -spend

    @Column(name = "balance_after", nullable = false)
    private int balanceAfter;

    @Column(nullable = false)
    private String reason;

    @Column(name = "rule_key")
    private String ruleKey;

    @Column(name = "ref_type")
    private String refType;

    @Column(name = "ref_id")
    private UUID refId;

    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "created_by")
    private UUID createdBy;

    // --- getters / setters ---
    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public int getDelta() { return delta; }
    public void setDelta(int delta) { this.delta = delta; }
    public int getBalanceAfter() { return balanceAfter; }
    public void setBalanceAfter(int balanceAfter) { this.balanceAfter = balanceAfter; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getRuleKey() { return ruleKey; }
    public void setRuleKey(String ruleKey) { this.ruleKey = ruleKey; }
    public String getRefType() { return refType; }
    public void setRefType(String refType) { this.refType = refType; }
    public UUID getRefId() { return refId; }
    public void setRefId(UUID refId) { this.refId = refId; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedBy(UUID createdBy) { this.createdBy = createdBy; }
}
