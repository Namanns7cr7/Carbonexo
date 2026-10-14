package com.ecotrack.embodied;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.config.AppProperties;
import com.ecotrack.embodied.dto.ProductEstimateResponse;
import com.ecotrack.embodied.dto.ProductEstimateResponse.AlternativeSuggestion;
import com.ecotrack.embodied.dto.ProductLookupResponse;
import com.ecotrack.exception.BadRequestException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Map;
import java.util.Optional;

/**
 * Embodied-carbon-for-purchases: barcode -&gt; product lookup (Open Food
 * Facts) and category -&gt; embodied CO2e estimate (DB-driven factors).
 *
 * <p>Alternative-suggestion strategy: we chose seeded "alternative" rows
 * (e.g. electronics -&gt; refurbished_electronics, see V7 migration) over an
 * AI call as the <em>primary</em> mechanism, because it is deterministic,
 * free, instant, and trivially testable — every category we ship a factor
 * for also ships a lower-carbon counterpart row. We still wire up
 * {@link AIProvider} (via a DB-stored prompt template, same pattern as the
 * rest of the AI features) as a fallback for any category that has no
 * mapped alternative, so the feature degrades gracefully instead of simply
 * omitting the suggestion.
 */
@Service
public class EmbodiedCarbonService {

    private static final Logger log = LoggerFactory.getLogger(EmbodiedCarbonService.class);

    private final OpenFoodFactsClient offClient;
    private final EmbodiedCarbonFactorRepository factorRepo;
    private final AIProvider aiProvider;
    private final PromptRenderer promptRenderer;
    private final AppProperties props;

    public EmbodiedCarbonService(OpenFoodFactsClient offClient,
                                  EmbodiedCarbonFactorRepository factorRepo,
                                  AIProvider aiProvider,
                                  PromptRenderer promptRenderer,
                                  AppProperties props) {
        this.offClient = offClient;
        this.factorRepo = factorRepo;
        this.aiProvider = aiProvider;
        this.promptRenderer = promptRenderer;
        this.props = props;
    }

    public ProductLookupResponse lookupProduct(String barcode) {
        OffProduct product = offClient.lookup(barcode);
        return new ProductLookupResponse(
                product.found(), product.productName(), product.brand(), product.categoryGuess());
    }

    public ProductEstimateResponse estimateEmbodiedCarbon(String category, BigDecimal quantity, String productName) {
        if (quantity == null || quantity.signum() <= 0) {
            throw new BadRequestException("quantity must be positive");
        }
        String normalizedCategory = category == null ? "" : category.trim().toLowerCase();

        EmbodiedCarbonFactor factor = factorRepo.findActiveByCategory(normalizedCategory)
                .orElseThrow(() -> new BadRequestException("Unknown embodied-carbon category: " + category));

        BigDecimal estimated = factor.getKgCo2ePerUnit().multiply(quantity);
        AlternativeSuggestion suggestion = buildAlternativeSuggestion(factor, quantity, productName);

        return new ProductEstimateResponse(factor.getCategory(), estimated, factor.getSource(), suggestion);
    }

    private AlternativeSuggestion buildAlternativeSuggestion(EmbodiedCarbonFactor factor, BigDecimal quantity, String productName) {
        String altCategory = factor.getAlternativeCategory();
        if (altCategory != null) {
            Optional<EmbodiedCarbonFactor> altFactorOpt = factorRepo.findActiveByCategory(altCategory);
            if (altFactorOpt.isPresent()) {
                EmbodiedCarbonFactor altFactor = altFactorOpt.get();
                BigDecimal altEstimated = altFactor.getKgCo2ePerUnit().multiply(quantity);
                String text = "Consider " + altFactor.getLabel().toLowerCase()
                        + " instead — roughly " + altEstimated + " kg CO2e, saving about "
                        + factor.getKgCo2ePerUnit().multiply(quantity).subtract(altEstimated) + " kg CO2e.";
                return new AlternativeSuggestion("seed_alternative", text, altEstimated);
            }
        }
        // No seeded alternative for this category — fall back to an AI-generated tip.
        return buildAiSuggestion(factor.getCategory(), productName);
    }

    private AlternativeSuggestion buildAiSuggestion(String category, String productName) {
        String productHint = (productName == null || productName.isBlank())
                ? "" : " (\"" + productName + "\")";
        try {
            String prompt = promptRenderer.render("embodied_carbon_alt_tip", Map.of(
                    "category", category,
                    "product_hint", productHint
            ));
            String text = aiProvider.generate(prompt, props.ai().fastModel());
            return new AlternativeSuggestion("ai_tip", text, null);
        } catch (Exception e) {
            log.warn("AI alternative-suggestion generation failed for category={}: {}", category, e.toString());
            return new AlternativeSuggestion("ai_tip",
                    "Look for a secondhand, refurbished, or minimal-packaging option in this category when you can.",
                    null);
        }
    }
}
