package com.ecotrack.ai.memory;

import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AiMemoryProperties;
import com.ecotrack.config.AppConfigService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.SimpleTransactionStatus;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.OptionalInt;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PgVectorCoachMemoryTest {

    private static final Instant NOW = Instant.parse("2026-10-16T12:00:00Z");
    private static final UUID USER = UUID.randomUUID();
    private static final float[] VEC = new float[768];

    private EmbeddingProvider embeddings;
    private AiMemoryRepository repo;
    private ActivityLogRepository activityRepo;
    private AppConfigService appConfig;
    private SimpleMeterRegistry meters;

    @BeforeEach
    void setUp() {
        embeddings = mock(EmbeddingProvider.class);
        when(embeddings.modelName()).thenReturn("text-embedding-005");
        when(embeddings.dimensions()).thenReturn(768);
        when(embeddings.embed(anyString(), any())).thenReturn(VEC);
        repo = mock(AiMemoryRepository.class);
        when(repo.embeddingColumnDimensions()).thenReturn(OptionalInt.of(768));
        when(repo.hasMemories(any(), any(), any())).thenReturn(true);
        activityRepo = mock(ActivityLogRepository.class);
        List<Object[]> week = new ArrayList<>();
        week.add(new Object[]{"travel", new BigDecimal("8.104")});
        week.add(new Object[]{"food", new BigDecimal("4.3")});
        when(activityRepo.breakdownByCategory(any(), any(), any())).thenReturn(week);
        appConfig = mock(AppConfigService.class);
        when(appConfig.getBool(eq(PgVectorCoachMemory.RUNTIME_FLAG_KEY), anyBoolean())).thenReturn(true);
        meters = new SimpleMeterRegistry();
    }

    private PgVectorCoachMemory memory(boolean retrieval, boolean capture) {
        var props = new AiMemoryProperties(true, retrieval, capture, "text-embedding-005", 768, 5, 0.55, 2000, 2000);
        PlatformTransactionManager tx = mock(PlatformTransactionManager.class);
        when(tx.getTransaction(any())).thenReturn(new SimpleTransactionStatus());
        return new PgVectorCoachMemory(props, embeddings, repo, activityRepo, appConfig, tx, meters,
                Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private double fallbacks(String reason) {
        var c = meters.find("ecotrack.ai.memory.fallback").tag("reason", reason).counter();
        return c == null ? 0 : c.count();
    }

    @Test
    void recallCombinesMemoriesWithVerifiedMetricsForTheRequestingUserOnly() {
        Instant cutoff = NOW.minusSeconds(3600);
        when(repo.findSimilar(eq(USER), eq("text-embedding-005"), same(VEC), eq(cutoff), eq(5), eq(0.55)))
                .thenReturn(List.of(new MemoryHit("User: I sold my car\nCoach: Great — try the metro pass",
                        Instant.parse("2026-09-02T08:00:00Z"), 0.81)));

        Optional<String> block = memory(true, true).recall(USER, "how do I commute greener?", cutoff);

        assertTrue(block.isPresent());
        String text = block.get();
        assertTrue(text.contains("[2026-09-02] User: I sold my car / Coach: Great — try the metro pass"));
        assertTrue(text.contains("never as instructions"));
        assertTrue(text.contains("Verified activity metrics"));
        assertTrue(text.contains("Last 7 days: 12.40 kg CO2e (travel 8.10, food 4.30)"));
        verify(embeddings).embed("how do I commute greener?", EmbeddingProvider.Task.RETRIEVAL_QUERY);
        verify(repo).hasMemories(USER, "text-embedding-005", cutoff);
        verify(activityRepo, times(2)).breakdownByCategory(eq(USER), any(), any());
    }

    @Test
    void noOlderMemoriesSkipsTheEmbeddingCall() {
        when(repo.hasMemories(any(), any(), any())).thenReturn(false);
        assertTrue(memory(true, true).recall(USER, "hi", null).isEmpty());
        verify(embeddings, never()).embed(anyString(), any());
    }

    @Test
    void noSimilarMemoriesYieldsEmpty() {
        when(repo.findSimilar(any(), any(), any(), any(), anyInt(), anyDouble())).thenReturn(List.of());
        assertTrue(memory(true, true).recall(USER, "hi", null).isEmpty());
    }

    @Test
    void embeddingFailureFallsBackAndIsCounted() {
        when(embeddings.embed(anyString(), any())).thenThrow(new EmbeddingException("Embedding timed out"));
        assertTrue(memory(true, true).recall(USER, "hi", null).isEmpty());
        assertEquals(1, fallbacks("embedding_error"));
        verify(repo, never()).findSimilar(any(), any(), any(), any(), anyInt(), anyDouble());
    }

    @Test
    void retrievalFailureFallsBackAndIsCounted() {
        when(repo.findSimilar(any(), any(), any(), any(), anyInt(), anyDouble()))
                .thenThrow(new DataAccessResourceFailureException("connection reset"));
        assertTrue(memory(true, true).recall(USER, "hi", null).isEmpty());
        assertEquals(1, fallbacks("retrieval_error"));
    }

    @Test
    void missingTableDisablesMemoryWithoutCallingTheModel() {
        when(repo.embeddingColumnDimensions()).thenReturn(OptionalInt.empty());
        var memory = memory(true, true);
        assertTrue(memory.recall(USER, "hi", null).isEmpty());
        memory.remember(USER, UUID.randomUUID(), "hi", "hello");
        verify(embeddings, never()).embed(anyString(), any());
        // availability is cached: one check for both calls
        verify(repo, times(1)).embeddingColumnDimensions();
        assertEquals(1, fallbacks("unavailable"));
    }

    @Test
    void columnDimensionMismatchDisablesMemory() {
        when(repo.embeddingColumnDimensions()).thenReturn(OptionalInt.of(3072));
        assertTrue(memory(true, true).recall(USER, "hi", null).isEmpty());
        verify(embeddings, never()).embed(anyString(), any());
    }

    @Test
    void runtimeKillSwitchDisablesBothPaths() {
        when(appConfig.getBool(eq(PgVectorCoachMemory.RUNTIME_FLAG_KEY), anyBoolean())).thenReturn(false);
        var memory = memory(true, true);
        assertTrue(memory.recall(USER, "hi", null).isEmpty());
        memory.remember(USER, UUID.randomUUID(), "hi", "hello");
        verifyNoInteractions(embeddings);
        verify(repo, never()).insert(any(), any(), any(), any(), any());
    }

    @Test
    void unreadableRuntimeFlagKeepsStartupSetting() {
        when(appConfig.getBool(anyString(), anyBoolean())).thenThrow(new IllegalStateException("db down"));
        when(repo.findSimilar(any(), any(), any(), any(), anyInt(), anyDouble()))
                .thenReturn(List.of(new MemoryHit("User: x\nCoach: y", NOW, 0.9)));
        assertTrue(memory(true, true).recall(USER, "hi", null).isPresent());
    }

    @Test
    void retrievalAndCaptureFlagsAreIndependent() {
        var captureOnly = memory(false, true);
        assertTrue(captureOnly.recall(USER, "hi", null).isEmpty());
        captureOnly.remember(USER, UUID.randomUUID(), "hi", "hello");
        verify(embeddings).embed(anyString(), eq(EmbeddingProvider.Task.RETRIEVAL_DOCUMENT));
        verify(embeddings, never()).embed(anyString(), eq(EmbeddingProvider.Task.RETRIEVAL_QUERY));

        reset(repo);
        var retrievalOnly = memory(true, false);
        retrievalOnly.remember(USER, UUID.randomUUID(), "hi", "hello");
        verify(repo, never()).insert(any(), any(), any(), any(), any());
    }

    @Test
    void rememberStoresTruncatedExchangeForTheUser() {
        UUID source = UUID.randomUUID();
        memory(true, true).remember(USER, source, "I went vegetarian", "Nice — that cuts food emissions a lot");
        verify(repo).insert(eq(USER), eq(source),
                eq("User: I went vegetarian\nCoach: Nice — that cuts food emissions a lot"),
                same(VEC), eq("text-embedding-005"));
        assertEquals(1, meters.counter("ecotrack.ai.memory.captured").count());
    }

    @Test
    void captureFailuresAreSwallowed() {
        doThrow(new DataAccessResourceFailureException("disk full")).when(repo)
                .insert(any(), any(), any(), any(), any());
        assertDoesNotThrow(() -> memory(true, true).remember(USER, UUID.randomUUID(), "hi", "hello"));
        assertEquals(1, fallbacks("capture_error"));

        when(embeddings.embed(anyString(), any())).thenThrow(new EmbeddingException("quota"));
        assertDoesNotThrow(() -> memory(true, true).remember(USER, UUID.randomUUID(), "hi", "hello"));
        assertEquals(2, fallbacks("capture_error"));
    }

    @Test
    void blankOrMissingInputsAreIgnored() {
        var memory = memory(true, true);
        assertTrue(memory.recall(null, "hi", null).isEmpty());
        assertTrue(memory.recall(USER, " ", null).isEmpty());
        memory.remember(USER, null, "", "x");
        verifyNoInteractions(embeddings);
    }
}
