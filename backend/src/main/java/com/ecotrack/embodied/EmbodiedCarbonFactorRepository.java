package com.ecotrack.embodied;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmbodiedCarbonFactorRepository extends JpaRepository<EmbodiedCarbonFactor, UUID> {

    @Query("SELECT f FROM EmbodiedCarbonFactor f WHERE f.active = true " +
           "AND f.category = :category AND f.effectiveFrom <= CURRENT_DATE " +
           "AND (f.effectiveTo IS NULL OR f.effectiveTo >= CURRENT_DATE) " +
           "ORDER BY f.effectiveFrom DESC")
    List<EmbodiedCarbonFactor> findActiveByCategoryList(String category);

    default Optional<EmbodiedCarbonFactor> findActiveByCategory(String category) {
        List<EmbodiedCarbonFactor> rows = findActiveByCategoryList(category);
        return rows.isEmpty() ? Optional.empty() : Optional.of(rows.get(0));
    }

    @Query("SELECT f FROM EmbodiedCarbonFactor f WHERE f.active = true " +
           "AND f.effectiveFrom <= CURRENT_DATE " +
           "AND (f.effectiveTo IS NULL OR f.effectiveTo >= CURRENT_DATE) " +
           "ORDER BY f.category")
    List<EmbodiedCarbonFactor> findAllActive();
}
