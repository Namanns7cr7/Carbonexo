package com.ecotrack.ai.service;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.ai.memory.CoachMemory;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AppProperties;
import com.ecotrack.credit.CreditLedgerRepository;
import com.ecotrack.profile.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Coach chat with pgvector memory: augmentation when available, exact legacy behaviour otherwise. */
class AIServiceMemoryTest {

    private static final UUID USER = UUID.randomUUID();
    private static final String LEGACY_PROMPT = "System Prompt\n\nUser: How can I cut my footprint?";

    private AIProvider aiProvider;
    private PromptRenderer renderer;
    private AppProperties props;
    private CoachMessageRepository coachRepo;
    private CoachMemory memory;

    @BeforeEach
    void setUp() {
        aiProvider = mock(AIProvider.class);
        renderer = mock(PromptRenderer.class);
        coachRepo = mock(CoachMessageRepository.class);
        memory = mock(CoachMemory.class);
        props = new AppProperties(null, null, null, null, null, new AppProperties.Carbon(0.45),
                new AppProperties.Ai("gemini", "gemini-2.5-pro", "gemini-2.0-flash", 30, true, null));
        when(coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(USER)).thenReturn(new ArrayList<>());
        when(renderer.render(eq("coach_system"), anyMap())).thenReturn("System Prompt");
        when(aiProvider.generateLive(anyString(), anyString())).thenReturn("Try the metro twice a week.");
        when(aiProvider.providerName()).thenReturn("gemini");
    }

    private AIService service(CoachMemory coachMemory) {
        return new AIService(aiProvider, renderer, props, mock(RecommendationRepository.class), coachRepo,
                mock(ActivityLogRepository.class), mock(UserProfileRepository.class),
                mock(CreditLedgerRepository.class), coachMemory);
    }

    @Test
    void legacyConstructorKeepsTheNonVectorPrompt() {
        var legacy = new AIService(aiProvider, renderer, props, mock(RecommendationRepository.class), coachRepo,
                mock(ActivityLogRepository.class), mock(UserProfileRepository.class),
                mock(CreditLedgerRepository.class));
        CoachResponse res = legacy.chat(USER, "How can I cut my footprint?");
        assertEquals(LEGACY_PROMPT, res.prompt());
        assertEquals("Try the metro twice a week.", res.result());
    }

    @Test
    void emptyRecallKeepsTheExactLegacyPrompt() {
        when(memory.recall(any(), any(), any())).thenReturn(Optional.empty());
        CoachResponse res = service(memory).chat(USER, "How can I cut my footprint?");
        assertEquals(LEGACY_PROMPT, res.prompt());
        verify(aiProvider).generateLive(LEGACY_PROMPT, "gemini-2.0-flash");
    }

    @Test
    void memoryBlockIsPlacedBetweenSystemPromptAndUserMessage() {
        when(memory.recall(any(), any(), any())).thenReturn(Optional.of("MEMORY+METRICS"));
        CoachResponse res = service(memory).chat(USER, "How can I cut my footprint?");
        assertEquals("System Prompt\n\nMEMORY+METRICS\n\nUser: How can I cut my footprint?", res.prompt());
        verify(aiProvider).generateLive(res.prompt(), "gemini-2.0-flash");
    }

    @Test
    void throwingMemoryFallsBackToLegacyPromptAndStillSavesBothMessages() {
        when(memory.recall(any(), any(), any())).thenThrow(new IllegalStateException("pgvector down"));
        doThrow(new IllegalStateException("pgvector down")).when(memory).remember(any(), any(), any(), any());

        CoachResponse res = service(memory).chat(USER, "How can I cut my footprint?");

        assertEquals(LEGACY_PROMPT, res.prompt());
        assertEquals("Try the metro twice a week.", res.result());
        verify(coachRepo, times(2)).save(any(CoachMessage.class));
    }

    @Test
    void recallIsScopedToUserAndOlderThanRecentHistoryWindow() {
        CoachMessage older = message("user", "earlier question", Instant.parse("2026-10-01T10:00:00Z"));
        CoachMessage newer = message("assistant", "earlier answer", Instant.parse("2026-10-01T10:00:05Z"));
        when(coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(USER)).thenReturn(new ArrayList<>(List.of(newer, older)));
        when(memory.recall(any(), any(), any())).thenReturn(Optional.empty());

        service(memory).chat(USER, "And what about food?");

        verify(memory).recall(USER, "And what about food?", Instant.parse("2026-10-01T10:00:00Z"));
    }

    @Test
    void completedExchangeIsRemembered() {
        when(memory.recall(any(), any(), any())).thenReturn(Optional.empty());
        service(memory).chat(USER, "I bought an e-bike");
        verify(memory).remember(eq(USER), any(), eq("I bought an e-bike"), eq("Try the metro twice a week."));
    }

    @Test
    void noneMemoryIsANoOp() {
        CoachResponse res = service(CoachMemory.NONE).chat(USER, "How can I cut my footprint?");
        assertEquals(LEGACY_PROMPT, res.prompt());
        ArgumentCaptor<CoachMessage> saved = ArgumentCaptor.forClass(CoachMessage.class);
        verify(coachRepo, times(2)).save(saved.capture());
        assertEquals("assistant", saved.getAllValues().get(1).getRole());
    }

    private static CoachMessage message(String role, String content, Instant createdAt) {
        CoachMessage m = mock(CoachMessage.class);
        when(m.getRole()).thenReturn(role);
        when(m.getContent()).thenReturn(content);
        when(m.getCreatedAt()).thenReturn(createdAt);
        return m;
    }
}
