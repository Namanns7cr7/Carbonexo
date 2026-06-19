package com.ecotrack.storage;

import com.ecotrack.config.AppProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Selects the blob storage implementation based on {@code ecotrack.storage.provider}.
 * "gcs" → Google Cloud Storage; anything else → local stub (dev fallback).
 */
@Configuration
public class StorageConfig {

    private static final Logger log = LoggerFactory.getLogger(StorageConfig.class);

    @Bean
    public BlobStorageService blobStorageService(AppProperties props) {
        String provider = props.storage().provider();
        log.info("Storage provider selected: {}", provider);
        if ("gcs".equalsIgnoreCase(provider)) {
            return new GoogleCloudStorageService(props);
        }
        return new LocalStubStorageService(props);
    }
}
