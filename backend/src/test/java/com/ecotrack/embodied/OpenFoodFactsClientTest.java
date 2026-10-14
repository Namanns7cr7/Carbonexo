package com.ecotrack.embodied;

import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.net.SocketTimeoutException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class OpenFoodFactsClientTest {

    private MockRestServiceServer server;
    private OpenFoodFactsClient client;

    private void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl("https://world.openfoodfacts.org");
        server = MockRestServiceServer.bindTo(builder).build();
        RestClient restClient = builder.build();
        client = new OpenFoodFactsClient(restClient);
    }

    @Test
    void lookupReturnsFoundProductWithMappedCategory() {
        setUp();
        server.expect(requestTo("https://world.openfoodfacts.org/api/v2/product/737628064502.json"))
                .andRespond(withSuccess("""
                        {
                          "status": 1,
                          "status_verbose": "product found",
                          "product": {
                            "product_name": "Choco Bar",
                            "brands": "YumCo, OtherBrand",
                            "categories_tags": ["en:snacks", "en:chocolates"]
                          }
                        }
                        """, MediaType.APPLICATION_JSON));

        OffProduct result = client.lookup("737628064502");

        assertTrue(result.found());
        assertEquals("Choco Bar", result.productName());
        assertEquals("YumCo", result.brand());
        assertEquals("packaged_food", result.categoryGuess());
        server.verify();
    }

    @Test
    void lookupReturnsNotFoundWhenOffStatusIsZero() {
        setUp();
        server.expect(requestTo("https://world.openfoodfacts.org/api/v2/product/000000000000.json"))
                .andRespond(withSuccess("""
                        { "status": 0, "status_verbose": "product not found" }
                        """, MediaType.APPLICATION_JSON));

        OffProduct result = client.lookup("000000000000");

        assertFalse(result.found());
        assertNull(result.productName());
        assertNull(result.categoryGuess());
    }

    @Test
    void lookupReturnsNotFoundOn404() {
        setUp();
        server.expect(requestTo("https://world.openfoodfacts.org/api/v2/product/404404404404.json"))
                .andRespond(withStatus(org.springframework.http.HttpStatus.NOT_FOUND));

        OffProduct result = client.lookup("404404404404");

        assertFalse(result.found());
    }

    @Test
    void lookupReturnsNotFoundOnMalformedJson() {
        setUp();
        server.expect(requestTo("https://world.openfoodfacts.org/api/v2/product/999999999999.json"))
                .andRespond(withSuccess("not valid json {{{", MediaType.APPLICATION_JSON));

        OffProduct result = client.lookup("999999999999");

        assertFalse(result.found());
    }

    @Test
    void lookupReturnsNotFoundOnTimeout() {
        // A request interceptor that always throws, simulating a network-level
        // failure (connect/read timeout) without any real network access.
        RestClient restClient = RestClient.builder()
                .baseUrl("https://world.openfoodfacts.org")
                .requestInterceptor((request, body, execution) -> {
                    throw new SocketTimeoutException("simulated timeout");
                })
                .build();
        OpenFoodFactsClient timeoutClient = new OpenFoodFactsClient(restClient);

        OffProduct result = timeoutClient.lookup("111111111111");

        assertFalse(result.found());
    }

    @Test
    void mapCategoryPicksFirstMatchingKeyword() {
        assertEquals("electronics", OpenFoodFactsClient.mapCategory(List.of("en:electronics", "en:gadgets")));
        assertEquals("clothing", OpenFoodFactsClient.mapCategory(List.of("en:clothing-accessories")));
        assertEquals("footwear", OpenFoodFactsClient.mapCategory(List.of("en:shoes")));
        assertEquals("books", OpenFoodFactsClient.mapCategory(List.of("en:books")));
        assertEquals("packaged_food", OpenFoodFactsClient.mapCategory(List.of("en:snacks", "en:beverages")));
        assertNull(OpenFoodFactsClient.mapCategory(List.of("en:something-unrelated")));
        assertNull(OpenFoodFactsClient.mapCategory(List.of()));
        assertNull(OpenFoodFactsClient.mapCategory(null));
    }
}
