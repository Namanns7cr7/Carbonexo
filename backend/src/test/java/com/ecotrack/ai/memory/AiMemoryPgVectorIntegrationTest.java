package com.ecotrack.ai.memory;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AiMemoryProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Real PostgreSQL 16 + pgvector: V1..V10 migrations, user isolation, similarity
 * ordering, and transaction isolation of memory failures.
 */
@Testcontainers(disabledWithoutDocker = true)
class AiMemoryPgVectorIntegrationTest {

    static final String MODEL = "text-embedding-005";

    @Container
    static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>(
            DockerImageName.parse("pgvector/pgvector:pg16").asCompatibleSubstituteFor("postgres"));

    static DriverManagerDataSource ds;
    static JdbcTemplate jdbc;
    static AiMemoryRepository repo;

    @BeforeAll
    static void migrate() {
        ds = new DriverManagerDataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword());
        jdbc = new JdbcTemplate(ds);
        repo = new AiMemoryRepository(jdbc);
        MigrationSupport.flyway(ds).migrate();
    }

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM ai_memory");
    }

    // ---------------------------------------------------------------- migrations

    @Test
    void v10CreatesVectorExtensionAndAiMemoryWith768Dims() {
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM pg_extension WHERE extname = 'vector'", Integer.class));
        assertEquals(768, repo.embeddingColumnDimensions().orElseThrow());
        assertEquals(Boolean.TRUE, jdbc.queryForObject(
                "SELECT success FROM flyway_schema_history WHERE version = '10'", Boolean.class));
        // No ANN index (see database/benchmarks/ai_memory_hnsw.md)
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM pg_indexes WHERE tablename = 'ai_memory' AND indexdef ILIKE '%hnsw%'", Integer.class));
    }

    @Test
    void existingTablesAreUntouchedAndMigrationIsIdempotent() {
        assertEquals(List.of("id", "user_id", "role", "content", "provider", "model", "tokens", "created_at"),
                jdbc.queryForList("SELECT column_name FROM information_schema.columns "
                        + "WHERE table_name = 'coach_messages' ORDER BY ordinal_position", String.class));
        for (String t : List.of("activity_logs", "rewards", "redemptions", "credit_ledger", "coach_messages")) {
            assertNotNull(jdbc.queryForObject("SELECT to_regclass(?)::text", String.class, t), t);
        }
        assertEquals(0, MigrationSupport.flyway(ds).migrate().migrationsExecuted);
        assertTrue(MigrationSupport.flyway(ds).validateWithResult().validationSuccessful);
    }

    @Test
    void wrongDimensionIsRejectedByTheColumn() {
        UUID user = MigrationSupport.newUser(jdbc);
        assertThrows(Exception.class, () -> repo.insert(user, UUID.randomUUID(), "x", new float[3], MODEL));
    }

    // ---------------------------------------------------------------- retrieval

    @Test
    void retrievalIsIsolatedPerUser() {
        UUID alice = MigrationSupport.newUser(jdbc);
        UUID bob = MigrationSupport.newUser(jdbc);
        repo.insert(alice, UUID.randomUUID(), "alice: I drive daily", unit(0), MODEL);
        repo.insert(bob, UUID.randomUUID(), "bob: I drive daily", unit(0), MODEL);

        List<MemoryHit> aliceHits = repo.findSimilar(alice, MODEL, unit(0), null, 10, 0.0);
        assertEquals(List.of("alice: I drive daily"), aliceHits.stream().map(MemoryHit::content).toList());

        UUID stranger = MigrationSupport.newUser(jdbc);
        assertTrue(repo.findSimilar(stranger, MODEL, unit(0), null, 10, 0.0).isEmpty());
        assertFalse(repo.hasMemories(stranger, MODEL, null));
        assertThrows(NullPointerException.class, () -> repo.findSimilar(null, MODEL, unit(0), null, 10, 0.0));
    }

    @Test
    void retrievalOrdersBySimilarityAndAppliesThresholdLimitCutoffAndModel() {
        UUID user = MigrationSupport.newUser(jdbc);
        repo.insert(user, UUID.randomUUID(), "exact", unit(0), MODEL);
        repo.insert(user, UUID.randomUUID(), "close", mix(0, 1, 0.9f), MODEL);       // cos ≈ 0.99
        repo.insert(user, UUID.randomUUID(), "far", mix(0, 1, 0.3f), MODEL);         // cos ≈ 0.29
        repo.insert(user, UUID.randomUUID(), "orthogonal", unit(1), MODEL);           // cos = 0
        repo.insert(user, UUID.randomUUID(), "other model", unit(0), "gemini-embedding-001");

        List<MemoryHit> hits = repo.findSimilar(user, MODEL, unit(0), null, 10, 0.5);
        assertEquals(List.of("exact", "close"), hits.stream().map(MemoryHit::content).toList());
        assertEquals(1.0, hits.get(0).similarity(), 1e-5);
        assertTrue(hits.get(0).similarity() > hits.get(1).similarity());

        assertEquals(1, repo.findSimilar(user, MODEL, unit(0), null, 1, 0.0).size());
        assertTrue(repo.findSimilar(user, MODEL, unit(0), Instant.now().minusSeconds(3600), 10, 0.0).isEmpty());
        assertTrue(repo.hasMemories(user, MODEL, Instant.now().plusSeconds(60)));
        assertFalse(repo.hasMemories(user, MODEL, Instant.now().minusSeconds(3600)));
    }

    @Test
    void duplicateSourceIsIgnoredAndUserDeletionCascades() {
        UUID user = MigrationSupport.newUser(jdbc);
        UUID source = UUID.randomUUID();
        repo.insert(user, source, "first", unit(0), MODEL);
        repo.insert(user, source, "retry", unit(0), MODEL);
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM ai_memory WHERE user_id = ?", Integer.class, user));

        jdbc.update("DELETE FROM users WHERE id = ?", user);
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM ai_memory WHERE user_id = ?", Integer.class, user));
    }

    // ---------------------------------------------------------------- fallback / transactions

    @Test
    void memoryErrorDoesNotAbortTheCoachTransaction() {
        UUID user = MigrationSupport.newUser(jdbc);
        repo.insert(user, UUID.randomUUID(), "User: hi\nCoach: hello", unit(0), MODEL);
        var txManager = new DataSourceTransactionManager(ds);
        // Embedding with the wrong size makes Postgres raise inside the memory query.
        var memory = memory(txManager, new float[3]);

        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            insertCoachMessage(user, "before");
            assertTrue(memory.recall(user, "anything", null).isEmpty());
            insertCoachMessage(user, "after"); // would fail with "current transaction is aborted" without isolation
        });

        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM coach_messages WHERE user_id = ?", Integer.class, user));
    }

    @Test
    void rememberWritesOnlyAfterTheCoachTurnCommits() {
        UUID user = MigrationSupport.newUser(jdbc);
        var txManager = new DataSourceTransactionManager(ds);
        var memory = memory(txManager, unit(0));
        var tx = new TransactionTemplate(txManager);

        tx.executeWithoutResult(status -> {
            memory.remember(user, insertCoachMessage(user, "q1"), "q1", "a1");
            assertEquals(0, countMemories(user), "not visible before commit");
        });
        assertEquals(1, countMemories(user));

        tx.executeWithoutResult(status -> {
            memory.remember(user, insertCoachMessage(user, "q2"), "q2", "a2");
            status.setRollbackOnly();
        });
        assertEquals(1, countMemories(user), "rolled-back turn leaves no memory");

        assertTrue(memory.recall(user, "q1 again", null).orElseThrow().contains("User: q1 / Coach: a1"));
    }

    // ---------------------------------------------------------------- helpers

    private PgVectorCoachMemory memory(DataSourceTransactionManager txManager, float[] embedding) {
        EmbeddingProvider embeddings = mock(EmbeddingProvider.class);
        when(embeddings.modelName()).thenReturn(MODEL);
        when(embeddings.dimensions()).thenReturn(768);
        when(embeddings.embed(any(), any())).thenReturn(embedding);
        ActivityLogRepository activity = mock(ActivityLogRepository.class);
        var props = new AiMemoryProperties(true, true, true, MODEL, 768, 5, 0.5, 2000, 2000);
        return new PgVectorCoachMemory(props, embeddings, repo, activity, null, txManager,
                new SimpleMeterRegistry(), Clock.systemUTC());
    }

    private UUID insertCoachMessage(UUID user, String content) {
        return jdbc.queryForObject("INSERT INTO coach_messages (user_id, role, content) VALUES (?, 'user', ?) RETURNING id",
                UUID.class, user, content);
    }

    private int countMemories(UUID user) {
        return jdbc.queryForObject("SELECT count(*) FROM ai_memory WHERE user_id = ?", Integer.class, user);
    }

    static float[] unit(int axis) {
        float[] v = new float[768];
        v[axis] = 1f;
        return v;
    }

    static float[] mix(int a, int b, float weightA) {
        float[] v = new float[768];
        v[a] = weightA;
        v[b] = (float) Math.sqrt(1 - weightA * weightA);
        return v;
    }

    /** Shared Flyway + fixture helpers (also used by the plain-Postgres test). */
    static final class MigrationSupport {
        static Flyway flyway(javax.sql.DataSource dataSource) {
            // Same single source of truth as application.yml (filesystem:../database/migrations).
            return Flyway.configure().dataSource(dataSource)
                    .locations("filesystem:../database/migrations")
                    .load();
        }

        static UUID newUser(JdbcTemplate jdbc) {
            return jdbc.queryForObject("INSERT INTO users (email, password_hash) VALUES (?, 'x') RETURNING id",
                    UUID.class, UUID.randomUUID() + "@test.local");
        }
    }
}
