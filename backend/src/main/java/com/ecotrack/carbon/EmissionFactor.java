package com.ecotrack.carbon;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Emission factor row — DATA not code. Read by CarbonCalculationService. */
@Entity
@Table(name = "emission_factors")
public class EmissionFactor extends BaseEntity {

    @Column(nullable = false)
    private String category;

    @Column(name = "factor_key", nullable = false)
    private String factorKey;

    @Column(nullable = false)
    private String label;

    private String emoji;

    @Column(nullable = false)
    private String unit;

    @Column(name = "factor_kg_per_unit", nullable = false)
    private BigDecimal factorKgPerUnit;

    @Column(name = "default_qty")
    private BigDecimal defaultQty;

    @Column(nullable = false)
    private String region;

    private String source;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(nullable = false)
    private boolean active = true;

    // --- getters ---
    public String getCategory() { return category; }
    public String getFactorKey() { return factorKey; }
    public String getLabel() { return label; }
    public String getEmoji() { return emoji; }
    public String getUnit() { return unit; }
    public BigDecimal getFactorKgPerUnit() { return factorKgPerUnit; }
    public BigDecimal getDefaultQty() { return defaultQty; }
    public String getRegion() { return region; }
    public String getSource() { return source; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public boolean isActive() { return active; }
}
