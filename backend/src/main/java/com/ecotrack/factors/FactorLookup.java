package com.ecotrack.factors;

/**
 * Result of a deterministic factor lookup. When {@code status == NOT_ESTIMATED}, {@code factor} is
 * null and {@code missingInformation} says what would be needed; callers must surface that instead
 * of a number.
 */
public record FactorLookup(
        Status status,
        String activityKey,
        String region,
        String variant,
        Authority authority,
        FactorRecord factor,
        boolean proxy,
        String quantityUnit,
        String occupancyRule,
        String accountingRule,
        Reason reason,
        String missingInformation
) {
    public enum Status { ESTIMATED, PROVISIONAL, NOT_ESTIMATED }

    /** APPROVED: reviewed dataset version. CANDIDATE: unreviewed (staging only). DEFINITION: e.g. walking = 0 operational. */
    public enum Authority { APPROVED, CANDIDATE, DEFINITION }

    public enum Reason {
        OK, REGION_UNCONFIRMED, NO_APPROVED_DATASET, NO_FACTOR_FOR_REGION, MAPPED_NOT_ESTIMATED,
        VARIANT_REQUIRED, NOT_APPLICABLE_TO_REGION, UNSUPPORTED_FACTOR, UNKNOWN_ACTIVITY
    }

    public boolean estimated() {
        return status != Status.NOT_ESTIMATED;
    }

    static FactorLookup notEstimated(String activity, String region, String variant, Reason reason, String missing) {
        return new FactorLookup(Status.NOT_ESTIMATED, activity, region, variant, null, null, false, null, null, null, reason, missing);
    }
}
