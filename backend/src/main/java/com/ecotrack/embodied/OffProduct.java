package com.ecotrack.embodied;

/**
 * Result of an Open Food Facts lookup, already mapped to our own vocabulary.
 * {@code categoryGuess} is one of our seeded {@code embodied_carbon_factors}
 * categories, or {@code null} when OFF's taxonomy didn't confidently map to
 * one (see {@link OpenFoodFactsClient} for the mapping rules).
 */
public record OffProduct(
        boolean found,
        String productName,
        String brand,
        String categoryGuess
) {
    public static OffProduct notFound() {
        return new OffProduct(false, null, null, null);
    }
}
