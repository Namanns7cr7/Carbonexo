package com.ecotrack.embodied;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Thin client for the free, keyless Open Food Facts barcode database
 * (https://world.openfoodfacts.org/api/v2/product/{barcode}.json).
 *
 * <p>OFF is primarily a <em>food</em> product database with a messy,
 * crowd-sourced taxonomy ({@code categories_tags}). We map that taxonomy to
 * our own small, seeded set of embodied-carbon categories with simple
 * substring keyword matching, documented below. This is a best-effort guess,
 * not an authoritative classification — the frontend always offers a manual
 * category dropdown as a fallback when the guess is {@code null}.
 *
 * <p>Mapping order (first match wins — non-food categories are checked
 * before the generic "food" catch-all, since nearly every OFF tag set
 * contains some food-related term):
 * <ul>
 *   <li>"electronic" / "gadget" / "device" -&gt; {@code electronics}</li>
 *   <li>"cloth" / "apparel" / "textile" / "fashion" / "garment" -&gt; {@code clothing}</li>
 *   <li>"furniture" -&gt; {@code furniture}</li>
 *   <li>"appliance" -&gt; {@code appliances}</li>
 *   <li>"shoe" / "footwear" / "sneaker" -&gt; {@code footwear}</li>
 *   <li>"toy" / "boardgame" -&gt; {@code toys}</li>
 *   <li>"book" -&gt; {@code books}</li>
 *   <li>"food" / "beverage" / "snack" / "dairy" / "meat" / "drink" / "grocery" -&gt; {@code packaged_food}</li>
 *   <li>none of the above -&gt; {@code null} (unmapped; caller shows a manual picker)</li>
 * </ul>
 *
 * <p>Any failure (404, timeout, malformed JSON) is swallowed and logged as a
 * warning — this client never throws up to its caller.
 */
@Component
public class OpenFoodFactsClient {

    private static final Logger log = LoggerFactory.getLogger(OpenFoodFactsClient.class);

    // Ordered: first matching keyword set wins. LinkedHashMap preserves order.
    private static final Map<String, List<String>> CATEGORY_KEYWORDS = new LinkedHashMap<>();
    static {
        CATEGORY_KEYWORDS.put("electronics", List.of("electronic", "gadget", "device"));
        CATEGORY_KEYWORDS.put("clothing", List.of("cloth", "apparel", "textile", "fashion", "garment"));
        CATEGORY_KEYWORDS.put("furniture", List.of("furniture"));
        CATEGORY_KEYWORDS.put("appliances", List.of("appliance"));
        CATEGORY_KEYWORDS.put("footwear", List.of("shoe", "footwear", "sneaker"));
        CATEGORY_KEYWORDS.put("toys", List.of("toy", "boardgame"));
        CATEGORY_KEYWORDS.put("books", List.of("book"));
        CATEGORY_KEYWORDS.put("packaged_food", List.of("food", "beverage", "snack", "dairy", "meat", "drink", "grocery"));
    }

    private final RestClient restClient;

    public OpenFoodFactsClient(RestClient openFoodFactsRestClient) {
        this.restClient = openFoodFactsRestClient;
    }

    public OffProduct lookup(String barcode) {
        try {
            OffApiResponse response = restClient.get()
                    .uri("/api/v2/product/{barcode}.json", barcode)
                    .retrieve()
                    .body(OffApiResponse.class);

            if (response == null || response.status() != 1 || response.product() == null) {
                return OffProduct.notFound();
            }

            OffApiProduct product = response.product();
            String brand = firstBrand(product.brands());
            String categoryGuess = mapCategory(product.categoriesTags());
            return new OffProduct(true, product.productName(), brand, categoryGuess);
        } catch (Exception e) {
            log.warn("Open Food Facts lookup failed for barcode={}: {}", barcode, e.toString());
            return OffProduct.notFound();
        }
    }

    private static String firstBrand(String brands) {
        if (brands == null || brands.isBlank()) return null;
        String[] parts = brands.split(",");
        return parts[0].trim();
    }

    /** Package-visible for testing. */
    static String mapCategory(List<String> categoriesTags) {
        if (categoriesTags == null || categoriesTags.isEmpty()) return null;
        String joined = String.join(" ", categoriesTags).toLowerCase();
        for (Map.Entry<String, List<String>> entry : CATEGORY_KEYWORDS.entrySet()) {
            for (String keyword : entry.getValue()) {
                if (joined.contains(keyword)) {
                    return entry.getKey();
                }
            }
        }
        return null;
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OffApiResponse(int status, OffApiProduct product) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    record OffApiProduct(
            @JsonProperty("product_name") String productName,
            String brands,
            @JsonProperty("categories_tags") List<String> categoriesTags
    ) {}
}
