package com.ecotrack.embodied;

import org.springframework.boot.web.client.ClientHttpRequestFactories;
import org.springframework.boot.web.client.ClientHttpRequestFactorySettings;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import java.time.Duration;

/** HTTP client config for the free, keyless Open Food Facts public API. */
@Configuration
public class OpenFoodFactsConfig {

    private static final String BASE_URL = "https://world.openfoodfacts.org";
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    @Bean
    public RestClient openFoodFactsRestClient(RestClient.Builder builder) {
        ClientHttpRequestFactorySettings settings = ClientHttpRequestFactorySettings.DEFAULTS
                .withConnectTimeout(TIMEOUT)
                .withReadTimeout(TIMEOUT);
        return builder
                .baseUrl(BASE_URL)
                .requestFactory(ClientHttpRequestFactories.get(settings))
                .build();
    }
}
