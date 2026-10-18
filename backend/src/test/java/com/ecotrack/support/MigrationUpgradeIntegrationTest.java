package com.ecotrack.support;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.flywaydb.core.api.MigrationState;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The deploy path, on its own clean database: V1..V5, legacy rows, then V6..V17. Production
 * (carbonexo / carbonexo-db) reports schema version 5 in its Cloud Run startup logs as of
 * 2026-10-18, so V5 - not V11 - is the real starting point. History must be byte-identical
 * afterwards (Decision 2), and the versions must be unique and contiguous in the only location
 * the image ships (database/migrations).
 */
@Testcontainers(disabledWithoutDocker = true)
class MigrationUpgradeIntegrationTest {

    static final String LOCATION = "filesystem:../database/migrations";
    /** Schema version the production backend image (built 2026-08-08) ships and runs against. */
    static final int PRODUCTION_VERSION = 5;

    static final String HISTORY_ACTIVITY = "SELECT md5(string_agg(concat_ws('|', id, user_id, category, factor_key, label, quantity, unit, "
            + "co2_kg, activity_date, source, created_at), ',' ORDER BY id)) FROM activity_logs";
    static final String HISTORY_CREDITS = "SELECT md5(string_agg(concat_ws('|', id, user_id, delta, balance_after, reason, rule_key, created_at), "
            + "',' ORDER BY id)) FROM credit_ledger";
    static final String HISTORY_REGIONS = "SELECT md5(string_agg(concat_ws('|', user_id, region), ',' ORDER BY user_id)) FROM user_profiles";

    @Test
    void versionsAreUniqueAndContiguousInTheShippedLocation() throws Exception {
        List<Integer> versions;
        try (Stream<Path> files = Files.list(Path.of("../database/migrations"))) {
            versions = files.map(p -> p.getFileName().toString()).filter(n -> n.matches("V\\d+__.+\\.sql"))
                    .map(n -> Integer.parseInt(n.substring(1, n.indexOf("__")))).sorted().toList();
        }
        assertEquals(new HashSet<>(versions).size(), versions.size(), "duplicate Flyway version: " + versions);
        for (int i = 0; i < versions.size(); i++) assertEquals(i + 1, versions.get(i), "gap in versions: " + versions);
        assertFalse(Files.exists(Path.of("src/main/resources/db/migration")), "a second migration location would shadow versions");
    }

    @Test
    void upgradeFromProductionSchemaKeepsHistoryAndValidates() {
        try (PostgreSQLContainer<?> pg = new PostgreSQLContainer<>(
                DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"))) {
            pg.start();
            DriverManagerDataSource ds = new DriverManagerDataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
            JdbcTemplate jdbc = new JdbcTemplate(ds);

            Flyway.configure().dataSource(ds).locations(LOCATION).target(String.valueOf(PRODUCTION_VERSION)).load().migrate();
            UUID u = jdbc.queryForObject("INSERT INTO users (email, password_hash) VALUES ('legacy@example.com', 'x') RETURNING id", UUID.class);
            jdbc.update("INSERT INTO user_profiles (user_id, name, region, onboarded) VALUES (?, 'L', 'GLOBAL', true)", u);
            jdbc.update("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date) VALUES "
                    + "(?, 'electricity', 'home_electricity', 'Home electricity', 200, 'kWh', 164.0, DATE '2026-05-01'), "
                    + "(?, 'travel', 'metro_train', 'Metro', 20, 'km', 0.6, DATE '2026-05-02')", u, u);
            jdbc.update("INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key) VALUES "
                    + "(?, 10, 10, 'Logged activity', 'log'), (?, 25, 35, 'Metro day', 'metro')", u, u);
            String a = jdbc.queryForObject(HISTORY_ACTIVITY, String.class);
            String c = jdbc.queryForObject(HISTORY_CREDITS, String.class);
            String r = jdbc.queryForObject(HISTORY_REGIONS, String.class);

            Flyway flyway = Flyway.configure().dataSource(ds).locations(LOCATION).load();
            assertEquals(17 - PRODUCTION_VERSION, flyway.migrate().migrationsExecuted);
            flyway.validate();

            assertEquals(a, jdbc.queryForObject(HISTORY_ACTIVITY, String.class), "historical emissions were rewritten");
            assertEquals(c, jdbc.queryForObject(HISTORY_CREDITS, String.class), "credit ledger was modified");
            assertEquals(r, jdbc.queryForObject(HISTORY_REGIONS, String.class), "a region was silently reassigned");
            assertEquals(Boolean.FALSE, jdbc.queryForObject("SELECT region_confirmed FROM user_profiles WHERE user_id = ?", Boolean.class, u));

            MigrationInfo[] applied = flyway.info().applied();
            assertEquals(17, applied.length);
            assertTrue(Arrays.stream(applied).allMatch(m -> m.getState() == MigrationState.SUCCESS));
            // Production-safe defaults: the new coach is off and candidate factors are not served.
            assertEquals("legacy", jdbc.queryForObject("SELECT config_value FROM app_config WHERE config_key = 'ai.coach.mode'", String.class));
            assertEquals("false", jdbc.queryForObject("SELECT config_value FROM app_config WHERE config_key = 'factors.allow_candidate'", String.class));
            Set<String> tables = new HashSet<>(jdbc.queryForList(
                    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'", String.class));
            assertTrue(tables.containsAll(Set.of("factor_records", "sci_chunks", "ai_responses", "ai_feedback")), tables.toString());
        }
    }

    /**
     * Rollback safety: after V6..V17 are applied, the previous image (which ships only V1..V5 and
     * runs Flyway on startup with baseline-on-migrate) must still start, and its writes must work.
     */
    @Test
    void previousImageStillStartsAgainstUpgradedSchema(@TempDir Path oldImageMigrations) throws Exception {
        try (Stream<Path> files = Files.list(Path.of("../database/migrations"))) {
            for (Path p : files.filter(p -> p.getFileName().toString().matches("V\\d+__.+\\.sql")).toList()) {
                String n = p.getFileName().toString();
                if (Integer.parseInt(n.substring(1, n.indexOf("__"))) <= PRODUCTION_VERSION) {
                    Files.copy(p, oldImageMigrations.resolve(n));
                }
            }
        }
        try (PostgreSQLContainer<?> pg = new PostgreSQLContainer<>(
                DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"))) {
            pg.start();
            DriverManagerDataSource ds = new DriverManagerDataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
            Flyway.configure().dataSource(ds).locations(LOCATION).load().migrate();

            Flyway previous = Flyway.configure().dataSource(ds).baselineOnMigrate(true)
                    .locations("filesystem:" + oldImageMigrations.toAbsolutePath()).load();
            assertDoesNotThrow(previous::validate, "previous image would fail Flyway validation on startup");
            assertEquals(0, previous.migrate().migrationsExecuted);

            // the previous image's insert shapes (no V13 columns) must still be accepted
            JdbcTemplate jdbc = new JdbcTemplate(ds);
            UUID u = jdbc.queryForObject("INSERT INTO users (email, password_hash) VALUES ('old@example.com', 'x') RETURNING id", UUID.class);
            jdbc.update("INSERT INTO user_profiles (user_id, name, region, onboarded) VALUES (?, 'O', 'IN', true)", u);
            jdbc.update("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date) VALUES "
                    + "(?, 'travel', 'bus', 'Bus', 10, 'km', 0.8, DATE '2026-10-01')", u);
            jdbc.update("INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key) VALUES (?, 5, 5, 'Logged activity', 'log')", u);
        }
    }
}
