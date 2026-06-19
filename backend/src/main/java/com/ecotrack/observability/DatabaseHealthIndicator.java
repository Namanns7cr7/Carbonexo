package com.ecotrack.observability;

import org.springframework.boot.actuate.health.Health;
import org.springframework.boot.actuate.health.HealthIndicator;
import org.springframework.stereotype.Component;

import javax.sql.DataSource;
import java.sql.Connection;

/** Custom health indicator — verifies database connectivity. */
@Component("dbHealth")
public class DatabaseHealthIndicator implements HealthIndicator {

    private final DataSource dataSource;

    public DatabaseHealthIndicator(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Health health() {
        try (Connection conn = dataSource.getConnection()) {
            if (conn.isValid(3)) {
                return Health.up().withDetail("database", "PostgreSQL").build();
            }
            return Health.down().withDetail("reason", "Connection not valid").build();
        } catch (Exception e) {
            return Health.down().withException(e).build();
        }
    }
}
