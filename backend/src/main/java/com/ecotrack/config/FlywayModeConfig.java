package com.ecotrack.config;

import org.flywaydb.core.Flyway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.flyway.FlywayMigrationStrategy;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * {@code ecotrack.flyway.mode}: {@code migrate} (default, local dev) applies pending migrations on
 * startup; {@code validate} (Cloud Run) never changes the schema and refuses to start while any
 * migration is pending or modified. Cloud Run revisions start against the database even with
 * --no-traffic, so production schema changes run only through the explicit migration job
 * ({@link com.ecotrack.MigrateOnly}).
 */
@Configuration
public class FlywayModeConfig {

    private static final Logger log = LoggerFactory.getLogger(FlywayModeConfig.class);

    @Bean
    public FlywayMigrationStrategy flywayMigrationStrategy(@Value("${ecotrack.flyway.mode:migrate}") String mode) {
        if ("validate".equalsIgnoreCase(mode)) {
            return flyway -> {
                flyway.validate();
                log.info("Flyway validate-only: schema version {}", flyway.info().current().getVersion());
            };
        }
        return Flyway::migrate;
    }
}
