package com.ecotrack;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * EcoTrack (Carbonexo) backend entry point.
 *
 * Layered architecture: controllers -> services -> repositories -> entities,
 * with DTOs at the boundary, provider abstractions for OCR/AI/storage, and all
 * configurable values externalized (env + app_config table). Schema is owned by
 * Flyway (see ../database/migrations).
 */
@SpringBootApplication
@ConfigurationPropertiesScan("com.ecotrack.config")
public class EcotrackApplication {
    public static void main(String[] args) {
        SpringApplication.run(EcotrackApplication.class, args);
    }
}
