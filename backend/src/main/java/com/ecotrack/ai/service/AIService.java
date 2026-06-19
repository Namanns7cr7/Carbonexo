package com.ecotrack.ai.service;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AppProperties;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;

/**
 * Unified AI service — handles all AI features: recommendations, electricity
 * analysis, transport insights, tips, monthly reports, and coach chat.
 * Prompt templates come from the database, never hardcoded.
 */
@Service
public class AIService {

    private static final Logger log = LoggerFactory.getLogger(AIService.class);

    private final AIProvider aiProvider;
    private final PromptRenderer renderer;
    private final AppProperties props;
    private final RecommendationRepository recRepo;
    private final CoachMessageRepository coachRepo;
    private final ActivityLogRepository logRepo;
    private final UserProfileRepository profileRepo;

    public AIService(AIProvider aiProvider, PromptRenderer renderer, AppProperties props,
                     RecommendationRepository recRepo, CoachMessageRepository coachRepo,
                     ActivityLogRepository logRepo, UserProfileRepository profileRepo) {
        this.aiProvider = aiProvider;
        this.renderer = renderer;
        this.props = props;
        this.recRepo = recRepo;
        this.coachRepo = coachRepo;
        this.logRepo = logRepo;
        this.profileRepo = profileRepo;
    }

    /** Carbon reduction recommendations. */
    @Transactional
    public String getRecommendations(UUID userId) {
        Map<String, Double> breakdown = getWeekBreakdown(userId);
        String biggest = breakdown.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey).orElse("unknown");

        String prompt = renderer.render("reduction_recs", Map.of(
                "breakdown", breakdown.toString(),
                "biggest_source", biggest
        ));

        String response = aiProvider.generate(prompt, props.ai().defaultModel());
        persist(userId, "reduction", "Carbon reduction recommendations", response);
        return response;
    }

    /** Electricity consumption analysis. */
    @Transactional
    public String analyzeElectricity(UUID userId, double units, String billingMonth) {
        String prompt = renderer.render("electricity_analysis", Map.of(
                "units", String.valueOf(units),
                "billing_month", billingMonth,
                "history", "[]",
                "factor", String.valueOf(props.carbon().electricityFactorDefault())
        ));

        String response = aiProvider.generate(prompt, props.ai().fastModel());
        persist(userId, "electricity", "Electricity analysis", response);
        return response;
    }

    /** Transportation insights. */
    @Transactional
    public String getTransportInsights(UUID userId) {
        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        String mode = profile != null ? profile.getTravelMode() : "Car";
        double distance = profile != null && profile.getDailyDistanceKm() != null
                ? profile.getDailyDistanceKm() : 10.0;

        String prompt = renderer.render("transport_insights", Map.of(
                "travel_logs", "[]",
                "travel_mode", mode,
                "daily_distance", String.valueOf(distance)
        ));

        String response = aiProvider.generate(prompt, props.ai().fastModel());
        persist(userId, "transport", "Transport insights", response);
        return response;
    }

    /** Personalized daily sustainability tip. */
    @Transactional
    public String getDailyTip(UUID userId) {
        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        String diet = profile != null ? profile.getDiet() : "Mixed";
        Map<String, Double> breakdown = getWeekBreakdown(userId);
        String biggest = breakdown.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey).orElse("travel");

        String prompt = renderer.render("sustainability_tip", Map.of(
                "diet", diet,
                "biggest_source", biggest
        ));

        String response = aiProvider.generate(prompt, props.ai().fastModel());
        persist(userId, "tip", "Daily tip", response);
        return response;
    }

    /** Monthly sustainability report. */
    @Transactional
    public String getMonthlyReport(UUID userId, String period) {
        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        String name = profile != null && profile.getName() != null ? profile.getName() : "User";

        String prompt = renderer.render("monthly_report", Map.of(
                "name", name,
                "period", period,
                "monthly_total", "45.2",
                "delta_pct", "-8",
                "credits", "150",
                "actions", "5"
        ));

        String response = aiProvider.generate(prompt, props.ai().defaultModel());
        Recommendation rec = new Recommendation();
        rec.setUserId(userId);
        rec.setType("monthly_report");
        rec.setTitle("Monthly report — " + period);
        rec.setBody(response);
        rec.setProvider(aiProvider.providerName());
        rec.setModel(props.ai().defaultModel());
        rec.setPeriod(period);
        recRepo.save(rec);
        return response;
    }

    /** AI coach chat — context-aware, multi-turn. */
    @Transactional
    public String chat(UUID userId, String userMessage) {
        // Save user message
        CoachMessage userMsg = new CoachMessage();
        userMsg.setUserId(userId);
        userMsg.setRole("user");
        userMsg.setContent(userMessage);
        coachRepo.save(userMsg);

        // Build context from recent messages
        List<CoachMessage> history = coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId);
        Collections.reverse(history);
        StringBuilder contextBuilder = new StringBuilder();
        for (CoachMessage msg : history) {
            contextBuilder.append(msg.getRole()).append(": ").append(msg.getContent()).append("\n");
        }

        String systemPrompt = renderer.render("coach_system", Map.of(
                "context", contextBuilder.toString()
        ));

        String fullPrompt = systemPrompt + "\n\nUser: " + userMessage;
        String response = aiProvider.generate(fullPrompt, props.ai().fastModel());

        // Save assistant message
        CoachMessage assistantMsg = new CoachMessage();
        assistantMsg.setUserId(userId);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(response);
        assistantMsg.setProvider(aiProvider.providerName());
        assistantMsg.setModel(props.ai().fastModel());
        coachRepo.save(assistantMsg);

        return response;
    }

    /** Get chat history for a user. */
    public List<CoachMessage> getChatHistory(UUID userId) {
        return coachRepo.findByUserIdOrderByCreatedAtAsc(userId);
    }

    private void persist(UUID userId, String type, String title, String body) {
        Recommendation rec = new Recommendation();
        rec.setUserId(userId);
        rec.setType(type);
        rec.setTitle(title);
        rec.setBody(body);
        rec.setProvider(aiProvider.providerName());
        rec.setModel(props.ai().defaultModel());
        recRepo.save(rec);
    }

    private Map<String, Double> getWeekBreakdown(UUID userId) {
        LocalDate today = LocalDate.now();
        LocalDate weekStart = today.minusDays(6);
        Map<String, Double> breakdown = new LinkedHashMap<>();
        for (Object[] row : logRepo.breakdownByCategory(userId, weekStart, today)) {
            breakdown.put((String) row[0], ((BigDecimal) row[1]).doubleValue());
        }
        return breakdown;
    }
}
