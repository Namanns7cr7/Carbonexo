package com.ecotrack.credit;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Credit rule — editable without code deploy (table: credit_rules). */
@Entity
@Table(name = "credit_rules")
public class CreditRule extends BaseEntity {

    @Column(name = "rule_key", unique = true, nullable = false)
    private String ruleKey;

    @Column(name = "rule_type", nullable = false)
    private String ruleType;

    private String description;

    @Column(name = "credits_per_unit", nullable = false)
    private BigDecimal creditsPerUnit;

    private String unit;

    @Column(nullable = false)
    private boolean active = true;

    @Column(name = "valid_from", nullable = false)
    private LocalDate validFrom;

    @Column(name = "valid_to")
    private LocalDate validTo;

    public String getRuleKey() { return ruleKey; }
    public String getRuleType() { return ruleType; }
    public String getDescription() { return description; }
    public BigDecimal getCreditsPerUnit() { return creditsPerUnit; }
    public String getUnit() { return unit; }
    public boolean isActive() { return active; }
    public LocalDate getValidFrom() { return validFrom; }
    public LocalDate getValidTo() { return validTo; }
}
