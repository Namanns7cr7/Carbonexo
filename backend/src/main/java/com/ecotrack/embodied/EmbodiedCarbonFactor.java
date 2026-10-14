package com.ecotrack.embodied;

import com.ecotrack.common.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Embodied-carbon factor row — DATA not code. Read by EmbodiedCarbonService.
 * {@code alternativeCategory}, when present, points at another row's
 * {@code category} in this same table representing a natural lower-carbon
 * substitute (e.g. "electronics" -> "refurbished_electronics").
 */
@Entity
@Table(name = "embodied_carbon_factors")
public class EmbodiedCarbonFactor extends BaseEntity {

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String label;

    @Column(name = "kg_co2e_per_unit", nullable = false)
    private BigDecimal kgCo2ePerUnit;

    @Column(nullable = false)
    private String unit;

    private String source;

    @Column(name = "alternative_category")
    private String alternativeCategory;

    @Column(name = "effective_from", nullable = false)
    private LocalDate effectiveFrom;

    @Column(name = "effective_to")
    private LocalDate effectiveTo;

    @Column(nullable = false)
    private boolean active = true;

    // --- getters ---
    public String getCategory() { return category; }
    public String getLabel() { return label; }
    public BigDecimal getKgCo2ePerUnit() { return kgCo2ePerUnit; }
    public String getUnit() { return unit; }
    public String getSource() { return source; }
    public String getAlternativeCategory() { return alternativeCategory; }
    public LocalDate getEffectiveFrom() { return effectiveFrom; }
    public LocalDate getEffectiveTo() { return effectiveTo; }
    public boolean isActive() { return active; }
}
