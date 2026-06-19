package com.ecotrack.carbon;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface EmissionFactorRepository extends JpaRepository<EmissionFactor, UUID> {

    @Query("SELECT ef FROM EmissionFactor ef WHERE ef.active = true " +
           "AND ef.region = :region AND ef.effectiveFrom <= CURRENT_DATE " +
           "AND (ef.effectiveTo IS NULL OR ef.effectiveTo >= CURRENT_DATE) " +
           "ORDER BY ef.category, ef.label")
    List<EmissionFactor> findActiveByRegion(String region);

    @Query("SELECT ef FROM EmissionFactor ef WHERE ef.active = true " +
           "AND ef.factorKey = :factorKey AND ef.region = :region " +
           "AND ef.effectiveFrom <= CURRENT_DATE " +
           "AND (ef.effectiveTo IS NULL OR ef.effectiveTo >= CURRENT_DATE)")
    Optional<EmissionFactor> findActiveByKeyAndRegion(String factorKey, String region);

    @Query("SELECT ef FROM EmissionFactor ef WHERE ef.active = true " +
           "AND ef.effectiveFrom <= CURRENT_DATE " +
           "AND (ef.effectiveTo IS NULL OR ef.effectiveTo >= CURRENT_DATE) " +
           "ORDER BY ef.category, ef.label")
    List<EmissionFactor> findAllActive();
}
