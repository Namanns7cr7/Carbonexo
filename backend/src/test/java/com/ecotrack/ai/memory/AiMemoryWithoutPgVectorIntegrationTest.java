package com.ecotrack.ai.memory;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AiMemoryProperties;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Clock;
import java.util.UUID;

import static com.ecotrack.ai.memory.AiMemoryPgVectorIntegrationTest.MigrationSupport;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Plain postgres:16-alpine (no pgvector) — the image in database/docker-compose.yml.
 * V10 must be a logged no-op and the coach memory must stay off without errors.
 */
@Testcontainers(disabledWithoutDocker = true)
class AiMemoryWithoutPgVectorIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> PG = new PostgreSQLContainer<>("postgres:16-alpine");

    static DriverManagerDataSource ds;
    static JdbcTemplate jdbc;

    @BeforeAll
    static void migrate() {
        ds = new DriverManagerDataSource(PG.getJdbcUrl(), PG.getUsername(), PG.getPassword());
        jdbc = new JdbcTemplate(ds);
        MigrationSupport.flyway(ds).migrate();
    }

    @Test
    void v10SucceedsAsNoOpWhenPgVectorIsUnavailable() {
        assertEquals(0, jdbc.queryForObject(
                "SELECT count(*) FROM pg_available_extensions WHERE name = 'vector'", Integer.class));
        assertEquals(Boolean.TRUE, jdbc.queryForObject(
                "SELECT success FROM flyway_schema_history WHERE version = '10'", Boolean.class));
        assertNull(jdbc.queryForObject("SELECT to_regclass('public.ai_memory')::text", String.class));
        assertTrue(new AiMemoryRepository(jdbc).embeddingColumnDimensions().isEmpty());
    }

    @Test
    void enabledMemoryFallsBackWithoutTouchingTheCoachTransaction() {
        EmbeddingProvider embeddings = mock(EmbeddingProvider.class);
        when(embeddings.modelName()).thenReturn("text-embedding-005");
        when(embeddings.dimensions()).thenReturn(768);
        var txManager = new DataSourceTransactionManager(ds);
        var props = new AiMemoryProperties(true, true, true, "text-embedding-005", 768, 5, 0.55, 2000, 2000);
        var memory = new PgVectorCoachMemory(props, embeddings, new AiMemoryRepository(jdbc),
                mock(ActivityLogRepository.class), null, txManager, new SimpleMeterRegistry(), Clock.systemUTC());
        UUID user = MigrationSupport.newUser(jdbc);

        new TransactionTemplate(txManager).executeWithoutResult(status -> {
            jdbc.update("INSERT INTO coach_messages (user_id, role, content) VALUES (?, 'user', 'hi')", user);
            assertTrue(memory.recall(user, "hi", null).isEmpty());
            memory.remember(user, UUID.randomUUID(), "hi", "hello");
            jdbc.update("INSERT INTO coach_messages (user_id, role, content) VALUES (?, 'assistant', 'hello')", user);
        });

        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM coach_messages WHERE user_id = ?", Integer.class, user));
        verify(embeddings, never()).embed(any(), any());
    }
}
