package com.ecotrack.factors;

import java.math.BigDecimal;
import java.util.List;

/** One registry record (V12 factor_records joined with factor_sources). */
public record FactorRecord(
        String factorId,
        String datasetVersion,
        BigDecimal value,
        String unit,
        String region,
        List<String> appliesToRegions,
        List<String> proxyRegions,
        String applicableYear,
        String scope,
        String systemBoundary,
        String gases,
        String statistic,
        String sourceId,
        String sourcePublisher,
        String sourceTitle,
        String sourceUrl,
        String sourceLocator,
        String verificationStatus,
        String scientificStatus,
        String uncertaintyLevel,
        String uncertaintyNotes
) {}
