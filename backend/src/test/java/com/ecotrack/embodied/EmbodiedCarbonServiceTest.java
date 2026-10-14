package com.ecotrack.embodied;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.config.AppProperties;
import com.ecotrack.embodied.dto.ProductEstimateResponse;
import com.ecotrack.embodied.dto.ProductLookupResponse;
import com.ecotrack.exception.BadRequestException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmbodiedCarbonServiceTest {

    private OpenFoodFactsClient offClient;
    private EmbodiedCarbonFactorRepository factorRepo;
    private AIProvider aiProvider;
    private PromptRenderer promptRenderer;
    private EmbodiedCarbonService service;

    @BeforeEach
    void setUp() {
        offClient = mock(OpenFoodFactsClient.class);
        factorRepo = mock(EmbodiedCarbonFactorRepository.class);
        aiProvider = mock(AIProvider.class);
        promptRenderer = mock(PromptRenderer.class);
        var aiConfig = new AppProperties.Ai("canned", "model-default", "model-fast", 5, true, null);
        var props = new AppProperties(null, null, null, null, null, null, aiConfig);

        service = new EmbodiedCarbonService(offClient, factorRepo, aiProvider, promptRenderer, props);
    }

    private EmbodiedCarbonFactor factor(String category, String label, String kgPerUnit, String alternativeCategory) {
        EmbodiedCarbonFactor f = mock(EmbodiedCarbonFactor.class);
        when(f.getCategory()).thenReturn(category);
        when(f.getLabel()).thenReturn(label);
        when(f.getKgCo2ePerUnit()).thenReturn(new BigDecimal(kgPerUnit));
        when(f.getSource()).thenReturn("Representative default");
        when(f.getAlternativeCategory()).thenReturn(alternativeCategory);
        return f;
    }

    // ---- lookupProduct ----

    @Test
    void lookupProductDelegatesToOffClientAndMapsFields() {
        when(offClient.lookup("123")).thenReturn(new OffProduct(true, "Choco Bar", "YumCo", "packaged_food"));

        ProductLookupResponse res = service.lookupProduct("123");

        assertTrue(res.found());
        assertEquals("Choco Bar", res.productName());
        assertEquals("YumCo", res.brand());
        assertEquals("packaged_food", res.categoryGuess());
    }

    @Test
    void lookupProductReturnsNotFoundWhenOffHasNothing() {
        when(offClient.lookup("000")).thenReturn(OffProduct.notFound());

        ProductLookupResponse res = service.lookupProduct("000");

        assertFalse(res.found());
        assertNull(res.productName());
        assertNull(res.categoryGuess());
    }

    @Test
    void lookupProductWithUnmappedCategoryStillReturnsFoundButNullGuess() {
        // Product exists in OFF but its category tags don't match any of our
        // keyword buckets — found stays true, categoryGuess is null so the
        // frontend falls back to a manual category dropdown.
        when(offClient.lookup("555")).thenReturn(new OffProduct(true, "Mystery Item", "Acme", null));

        ProductLookupResponse res = service.lookupProduct("555");

        assertTrue(res.found());
        assertEquals("Mystery Item", res.productName());
        assertNull(res.categoryGuess());
    }

    // ---- estimateEmbodiedCarbon: math ----

    @Test
    void estimateComputesFactorTimesQuantity() {
        EmbodiedCarbonFactor electronics = factor("electronics", "Electronics", "85.0000", "refurbished_electronics");
        EmbodiedCarbonFactor refurb = factor("refurbished_electronics", "Refurbished electronics", "15.0000", null);
        when(factorRepo.findActiveByCategory("electronics")).thenReturn(Optional.of(electronics));
        when(factorRepo.findActiveByCategory("refurbished_electronics")).thenReturn(Optional.of(refurb));

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("electronics", new BigDecimal("2"), "Phone");

        assertEquals("electronics", res.category());
        assertEquals(new BigDecimal("170.0000"), res.estimatedKgCo2e());
        assertEquals("Representative default", res.factorSource());
    }

    @Test
    void estimateIsCaseInsensitiveAndTrimmed() {
        EmbodiedCarbonFactor books = factor("books", "Book", "2.5000", "secondhand_books");
        EmbodiedCarbonFactor secondhand = factor("secondhand_books", "Secondhand book", "0.3000", null);
        when(factorRepo.findActiveByCategory("books")).thenReturn(Optional.of(books));
        when(factorRepo.findActiveByCategory("secondhand_books")).thenReturn(Optional.of(secondhand));

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("  BOOKS  ", new BigDecimal("1"), null);

        assertEquals("books", res.category());
        assertEquals(new BigDecimal("2.5000"), res.estimatedKgCo2e());
    }

    @Test
    void estimateRejectsNonPositiveQuantity() {
        assertThrows(BadRequestException.class,
                () -> service.estimateEmbodiedCarbon("electronics", BigDecimal.ZERO, null));
        assertThrows(BadRequestException.class,
                () -> service.estimateEmbodiedCarbon("electronics", new BigDecimal("-1"), null));
        verifyNoInteractions(factorRepo);
    }

    @Test
    void estimateThrowsForUnknownCategory() {
        when(factorRepo.findActiveByCategory("spaceship_parts")).thenReturn(Optional.empty());

        assertThrows(BadRequestException.class,
                () -> service.estimateEmbodiedCarbon("spaceship_parts", BigDecimal.ONE, null));
    }

    // ---- alternative-suggestion logic ----

    @Test
    void estimateUsesSeedAlternativeWhenMappedAndGeneratesPersuasionTextViaAi() {
        EmbodiedCarbonFactor electronics = factor("electronics", "Electronics", "85.0000", "refurbished_electronics");
        EmbodiedCarbonFactor refurb = factor("refurbished_electronics", "Refurbished electronics", "15.0000", null);
        when(factorRepo.findActiveByCategory("electronics")).thenReturn(Optional.of(electronics));
        when(factorRepo.findActiveByCategory("refurbished_electronics")).thenReturn(Optional.of(refurb));
        when(promptRenderer.render(eq("embodied_carbon_persuasion"), anyMap())).thenReturn("Rendered prompt");
        when(aiProvider.generate(eq("Rendered prompt"), anyString()))
                .thenReturn("Go refurbished and save 70 kg CO2e instantly.");

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("electronics", BigDecimal.ONE, null);

        assertEquals("seed_alternative", res.alternativeSuggestion().type());
        assertEquals(new BigDecimal("15.0000"), res.alternativeSuggestion().estimatedKgCo2e());
        assertEquals("Go refurbished and save 70 kg CO2e instantly.", res.alternativeSuggestion().text());
        verify(aiProvider).generate(eq("Rendered prompt"), anyString());
    }

    @Test
    void estimateFallsBackToStaticPersuasionTextWhenAiProviderThrowsForSeedAlternative() {
        EmbodiedCarbonFactor electronics = factor("electronics", "Electronics", "85.0000", "refurbished_electronics");
        EmbodiedCarbonFactor refurb = factor("refurbished_electronics", "Refurbished electronics", "15.0000", null);
        when(factorRepo.findActiveByCategory("electronics")).thenReturn(Optional.of(electronics));
        when(factorRepo.findActiveByCategory("refurbished_electronics")).thenReturn(Optional.of(refurb));
        when(promptRenderer.render(eq("embodied_carbon_persuasion"), anyMap())).thenThrow(new RuntimeException("boom"));

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("electronics", BigDecimal.ONE, null);

        assertEquals("seed_alternative", res.alternativeSuggestion().type());
        assertEquals(new BigDecimal("15.0000"), res.alternativeSuggestion().estimatedKgCo2e());
        assertTrue(res.alternativeSuggestion().text().toLowerCase().contains("refurbished"));
        verifyNoInteractions(aiProvider);
    }

    @Test
    void estimateFallsBackToAiWhenNoAlternativeCategoryMapped() {
        EmbodiedCarbonFactor factor = factor("packaged_food", "Packaged food", "1.5000", null);
        when(factorRepo.findActiveByCategory("packaged_food")).thenReturn(Optional.of(factor));
        when(promptRenderer.render(eq("embodied_carbon_alt_tip"), anyMap())).thenReturn("Rendered prompt");
        when(aiProvider.generate(eq("Rendered prompt"), anyString())).thenReturn("Buy it unpackaged next time.");

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("packaged_food", BigDecimal.ONE, "Chips");

        assertEquals("ai_tip", res.alternativeSuggestion().type());
        assertEquals("Buy it unpackaged next time.", res.alternativeSuggestion().text());
        assertNull(res.alternativeSuggestion().estimatedKgCo2e());
        verify(aiProvider).generate(eq("Rendered prompt"), anyString());
    }

    @Test
    void estimateFallsBackToAiWhenMappedAlternativeCategoryHasNoActiveFactor() {
        EmbodiedCarbonFactor factor = factor("electronics", "Electronics", "85.0000", "refurbished_electronics");
        when(factorRepo.findActiveByCategory("electronics")).thenReturn(Optional.of(factor));
        when(factorRepo.findActiveByCategory("refurbished_electronics")).thenReturn(Optional.empty());
        when(promptRenderer.render(eq("embodied_carbon_alt_tip"), anyMap())).thenReturn("Rendered prompt");
        when(aiProvider.generate(anyString(), anyString())).thenReturn("Try a refurbished option.");

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("electronics", BigDecimal.ONE, null);

        assertEquals("ai_tip", res.alternativeSuggestion().type());
    }

    @Test
    void estimateFallsBackToStaticTextWhenAiProviderThrows() {
        EmbodiedCarbonFactor factor = factor("packaged_food", "Packaged food", "1.5000", null);
        when(factorRepo.findActiveByCategory("packaged_food")).thenReturn(Optional.of(factor));
        when(promptRenderer.render(anyString(), anyMap())).thenThrow(new RuntimeException("boom"));

        ProductEstimateResponse res = service.estimateEmbodiedCarbon("packaged_food", BigDecimal.ONE, null);

        assertEquals("ai_tip", res.alternativeSuggestion().type());
        assertNotNull(res.alternativeSuggestion().text());
        assertNull(res.alternativeSuggestion().estimatedKgCo2e());
    }
}
