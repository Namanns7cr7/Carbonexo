package com.ecotrack.support;

import org.flywaydb.core.Flyway;
import org.springframework.core.io.FileSystemResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ScriptUtils;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.util.UUID;

/**
 * One pgvector/pg16 container per JVM with all Flyway migrations (V1..V17) and the Dataset V2
 * registry seed (datasets/v2/build/registry_seed.*.sql, produced by scripts/dataset_v2/export_sql.py).
 */
public final class RegistryTestDb {

    public static final String DATASET = "2.0.0-candidate.2";
    private static PostgreSQLContainer<?> pg;
    private static DriverManagerDataSource ds;

    private RegistryTestDb() {}

    public static synchronized DriverManagerDataSource dataSource() {
        if (ds == null) {
            pg = new PostgreSQLContainer<>(DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));
            pg.start();
            ds = new DriverManagerDataSource(pg.getJdbcUrl(), pg.getUsername(), pg.getPassword());
            Flyway.configure().dataSource(ds).locations("filesystem:../database/migrations").load().migrate();
            Path seed = Path.of("../datasets/v2/build/registry_seed." + DATASET + ".sql");
            if (!Files.exists(seed)) {
                throw new IllegalStateException("Missing " + seed + " - run: python -I scripts/dataset_v2/export_sql.py");
            }
            try (Connection c = ds.getConnection()) {
                ScriptUtils.executeSqlScript(c, new FileSystemResource(seed));
            } catch (Exception e) {
                throw new IllegalStateException("registry seed failed", e);
            }
        }
        return ds;
    }

    public static JdbcTemplate jdbc() {
        return new JdbcTemplate(dataSource());
    }

    public static String jdbcUrl() { dataSource(); return pg.getJdbcUrl(); }
    public static String username() { dataSource(); return pg.getUsername(); }
    public static String password() { dataSource(); return pg.getPassword(); }

    public static UUID newUser(JdbcTemplate jdbc, String region, boolean confirmed) {
        UUID id = jdbc.queryForObject("INSERT INTO users (email, password_hash) VALUES (?, 'x') RETURNING id",
                UUID.class, UUID.randomUUID() + "@example.com");
        jdbc.update("INSERT INTO user_profiles (user_id, name, region, region_confirmed, region_source, onboarded) VALUES (?, ?, ?, ?, ?, true)",
                id, "Test " + id.toString().substring(0, 4), region, confirmed, confirmed ? "user_confirmed" : "legacy_default");
        return id;
    }
}
