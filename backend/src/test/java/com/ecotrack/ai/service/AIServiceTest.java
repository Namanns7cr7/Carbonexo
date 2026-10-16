package com.ecotrack.ai.service;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AppProperties;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AIServiceTest {

    private AIProvider aiProvider;
    private PromptRenderer renderer;
    private AppProperties props;
    private RecommendationRepository recRepo;
    private CoachMessageRepository coachRepo;
    private ActivityLogRepository logRepo;
    private UserProfileRepository profileRepo;
    private com.ecotrack.credit.CreditLedgerRepository creditLedgerRepo;
    private AIService service;

    @BeforeEach
    void setUp() {
        aiProvider = mock(AIProvider.class);
        renderer = mock(PromptRenderer.class);
        recRepo = mock(RecommendationRepository.class);
        coachRepo = mock(CoachMessageRepository.class);
        logRepo = mock(ActivityLogRepository.class);
        profileRepo = mock(UserProfileRepository.class);
        creditLedgerRepo = mock(com.ecotrack.credit.CreditLedgerRepository.class);

        var aiConfig = new AppProperties.Ai("gemini", "gemini-2.5-pro", "gemini-2.0-flash", 30, true, null);
        var carbonConfig = new AppProperties.Carbon(0.45);
        props = new AppProperties(null, null, null, null, null, carbonConfig, aiConfig);

        service = new AIService(
                aiProvider,
                renderer,
                props,
                recRepo,
                coachRepo,
                logRepo,
                profileRepo,
                creditLedgerRepo
        );
    }

    @Test
    void getRecommendationsRendersAndCallsModel() {
        UUID userId = UUID.randomUUID();
        when(logRepo.breakdownByCategory(any(), any(), any())).thenReturn(new ArrayList<>());
        when(renderer.render(eq("reduction_recs"), anyMap())).thenReturn("Rendered Prompt");
        when(aiProvider.generate(eq("Rendered Prompt"), anyString())).thenReturn("AI Recommendations");

        String res = service.getRecommendations(userId);

        assertEquals("AI Recommendations", res);
        verify(recRepo).save(any(Recommendation.class));
    }

    @Test
    void chatSavesMessagesAndReturnsResponse() {
        UUID userId = UUID.randomUUID();
        String userMsg = "Hello Coach";
        
        when(coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId)).thenReturn(new ArrayList<>());
        when(renderer.render(eq("coach_system"), anyMap())).thenReturn("System Prompt");
        when(aiProvider.generate(anyString(), anyString())).thenReturn("Hello human");

        var response = service.chat(userId, userMsg);

        assertNotNull(response);
        assertEquals("Hello human", response.result());
        assertTrue(response.prompt().contains("System Prompt"));
        verify(coachRepo, times(2)).save(any(CoachMessage.class));
    }

    @Test
    void dailyTipUsesDietFromProfile() {
        UUID userId = UUID.randomUUID();
        UserProfile profile = new UserProfile();
        profile.setDiet("Vegan");
        profile.setTravelMode("Bike");

        when(profileRepo.findByUserIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(profile));
        when(logRepo.breakdownByCategory(any(), any(), any())).thenReturn(new ArrayList<>());
        when(renderer.render(eq("sustainability_tip"), anyMap())).thenReturn("Tip Prompt");
        when(aiProvider.generate(anyString(), anyString())).thenReturn("Eat more greens");

        String tip = service.getDailyTip(userId);

        assertEquals("Eat more greens", tip);
        verify(renderer).render(eq("sustainability_tip"), argThat(map -> "Vegan".equals(map.get("diet"))));
    }

    @Test
    void chatFallsBackGracefullyWhenProviderThrows() {
        UUID userId = UUID.randomUUID();
        when(coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId)).thenReturn(new ArrayList<>());
        when(renderer.render(eq("coach_system"), anyMap())).thenReturn("System Prompt");
        when(aiProvider.generate(anyString(), anyString())).thenThrow(new RuntimeException("Vertex AI timeout"));

        var response = service.chat(userId, "What should I eat?");

        assertNotNull(response);
        assertNotNull(response.result());
        assertTrue(response.result().contains("optimizing my climate intelligence"));
        verify(coachRepo, times(2)).save(any(CoachMessage.class));
    }

    @Test
    void getChatHistoryPagedFetchesInitialPage() {
        UUID userId = UUID.randomUUID();
        CoachMessage msg = new CoachMessage();
        msg.setUserId(userId);
        msg.setContent("Test message");

        when(coachRepo.findInitialCursorPage(eq(userId), any())).thenReturn(List.of(msg));

        var page = service.getChatHistoryPaged(userId, null, null, 10);

        assertNotNull(page);
        assertEquals(1, page.items().size());
        assertEquals("Test message", page.items().get(0).getContent());
        verify(coachRepo).findInitialCursorPage(eq(userId), any());
    }

    @Test
    void getChatHistoryPagedFetchesBeforeCursor() {
        UUID userId = UUID.randomUUID();
        java.time.Instant cursorTime = java.time.Instant.now();
        UUID cursorId = UUID.randomUUID();

        CoachMessage msg = new CoachMessage();
        msg.setUserId(userId);
        msg.setContent("Older message");

        when(coachRepo.findPagedBeforeCursor(eq(userId), eq(cursorTime), eq(cursorId), any())).thenReturn(List.of(msg));

        var page = service.getChatHistoryPaged(userId, cursorTime, cursorId, 10);

        assertNotNull(page);
        assertEquals(1, page.items().size());
        assertEquals("Older message", page.items().get(0).getContent());
        verify(coachRepo).findPagedBeforeCursor(eq(userId), eq(cursorTime), eq(cursorId), any());
    }
}
