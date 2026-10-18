package com.ecotrack.ai.service;

import com.ecotrack.ai.AIProvider;
import com.ecotrack.ai.AIResult;
import com.ecotrack.ai.PromptRenderer;
import com.ecotrack.ai.memory.CoachMemory;
import com.ecotrack.ai.service.dto.CursorPage;
import com.ecotrack.carbon.ActivityLogRepository;
import com.ecotrack.config.AppProperties;
import com.ecotrack.profile.UserProfile;
import com.ecotrack.profile.UserProfileRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
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
    private final com.ecotrack.credit.CreditLedgerRepository creditLedgerRepo;
    private final CoachMemory coachMemory;

    /** Coach without long-term memory (pre-pgvector behaviour). */
    public AIService(AIProvider aiProvider, PromptRenderer renderer, AppProperties props,
                     RecommendationRepository recRepo, CoachMessageRepository coachRepo,
                     ActivityLogRepository logRepo, UserProfileRepository profileRepo,
                     com.ecotrack.credit.CreditLedgerRepository creditLedgerRepo) {
        this(aiProvider, renderer, props, recRepo, coachRepo, logRepo, profileRepo, creditLedgerRepo,
                CoachMemory.NONE);
    }

    @Autowired
    public AIService(AIProvider aiProvider, PromptRenderer renderer, AppProperties props,
                     RecommendationRepository recRepo, CoachMessageRepository coachRepo,
                     ActivityLogRepository logRepo, UserProfileRepository profileRepo,
                     com.ecotrack.credit.CreditLedgerRepository creditLedgerRepo,
                     CoachMemory coachMemory) {
        this.coachMemory = coachMemory != null ? coachMemory : CoachMemory.NONE;
        this.aiProvider = aiProvider;
        this.renderer = renderer;
        this.props = props;
        this.recRepo = recRepo;
        this.coachRepo = coachRepo;
        this.logRepo = logRepo;
        this.profileRepo = profileRepo;
        this.creditLedgerRepo = creditLedgerRepo;
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

        AIResult result = aiProvider.generateResult(prompt, props.ai().defaultModel());
        String response = result.text();
        persist(result, userId, "reduction", "Carbon reduction recommendations", response);
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

        AIResult result = aiProvider.generateResult(prompt, props.ai().fastModel());
        String response = result.text();
        persist(result, userId, "electricity", "Electricity analysis", response);
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

        AIResult result = aiProvider.generateResult(prompt, props.ai().fastModel());
        String response = result.text();
        persist(result, userId, "transport", "Transport insights", response);
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

        AIResult result = aiProvider.generateResult(prompt, props.ai().fastModel());
        String response = result.text();
        persist(result, userId, "tip", "Daily tip", response);
        return response;
    }

    /** Monthly sustainability report. */
    @Transactional
    public String getMonthlyReport(UUID userId, String period) {
        UserProfile profile = profileRepo.findByUserIdAndDeletedAtIsNull(userId).orElse(null);
        String name = profile != null && profile.getName() != null ? profile.getName() : "User";

        // Real figures only (previously hardcoded 45.2 kg / -8% / 150 credits / 5 actions for every user).
        LocalDate today = LocalDate.now();
        LocalDate monthStart = today.withDayOfMonth(1);
        LocalDate prevStart = monthStart.minusMonths(1);
        double monthKg = sumKg(userId, monthStart, today);
        double prevKg = sumKg(userId, prevStart, monthStart.minusDays(1));
        String delta = prevKg > 0 ? String.valueOf(Math.round((monthKg - prevKg) / prevKg * 1000) / 10.0) : "not available (no logs last month)";
        String prompt = renderer.render("monthly_report", Map.of(
                "name", name,
                "period", period,
                "monthly_total", String.valueOf(Math.round(monthKg * 10) / 10.0),
                "delta_pct", delta,
                "credits", String.valueOf(creditLedgerRepo != null ? creditLedgerRepo.sumDeltaByUserId(userId) : 0),
                "actions", "not tracked in this report"
        ));

        AIResult result = aiProvider.generateResult(prompt, props.ai().defaultModel());
        String response = result.text();
        Recommendation rec = new Recommendation();
        rec.setUserId(userId);
        rec.setType("monthly_report");
        rec.setTitle("Monthly report — " + period);
        rec.setBody(response);
        rec.setProvider(result.provider());
        rec.setModel(result.model());
        rec.setPeriod(period);
        recRepo.save(rec);
        return response;
    }

    /**
     * AI coach chat — context-aware, multi-turn.
     *
     * Only a live model answers here. If none does, the reply is empty and nothing is
     * stored: the client then answers from its cited reference library, instead of a
     * keyword-matched canned stub being shown (and remembered) as the coach's words.
     */
    @Transactional
    public CoachResponse chat(UUID userId, String userMessage) {
        // Context from earlier messages only — the new one is appended once, below.
        List<CoachMessage> history = coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId);
        Collections.reverse(history);
        StringBuilder contextBuilder = new StringBuilder();
        for (CoachMessage msg : history) {
            contextBuilder.append(msg.getRole()).append(": ").append(msg.getContent()).append("\n");
        }

        String systemPrompt = renderer.render("coach_system", Map.of(
                "context", contextBuilder.toString()
        ));

        // Long-term memory: only exchanges older than the recent-history window above.
        // Empty (memory off / failing / nothing relevant) keeps the original prompt exactly.
        Instant memoryCutoff = history.isEmpty() ? null : history.get(0).getCreatedAt();
        String memoryBlock = recallSafely(userId, userMessage, memoryCutoff);

        String fullPrompt = memoryBlock == null
                ? systemPrompt + "\n\nUser: " + userMessage
                : systemPrompt + "\n\n" + memoryBlock + "\n\nUser: " + userMessage;

        String response;
        try {
            response = aiProvider.generateLive(fullPrompt, props.ai().fastModel());
        } catch (RuntimeException e) {
            log.warn("Coach: no live AI reply — client will use its reference library: {}", e.toString());
            return new CoachResponse("", null);
        }
        if (response == null || response.isBlank()) {
            return new CoachResponse("", null);
        }

        CoachMessage userMsg = new CoachMessage();
        userMsg.setUserId(userId);
        userMsg.setRole("user");
        userMsg.setContent(userMessage);
        coachRepo.save(userMsg);

        CoachMessage assistantMsg = new CoachMessage();
        assistantMsg.setUserId(userId);
        assistantMsg.setRole("assistant");
        assistantMsg.setContent(response);
        assistantMsg.setProvider(aiProvider.providerName());
        assistantMsg.setModel(props.ai().fastModel());
        coachRepo.save(assistantMsg);

        try {
            coachMemory.remember(userId, userMsg.getId(), userMessage, response);
        } catch (RuntimeException e) {
            log.warn("Coach memory capture failed — reply unaffected: {}", e.toString());
        }

        return new CoachResponse(response, fullPrompt);
    }

    /** CoachMemory implementations must not throw; guard anyway so chat never depends on it. */
    private String recallSafely(UUID userId, String userMessage, Instant cutoff) {
        try {
            return coachMemory.recall(userId, userMessage, cutoff).orElse(null);
        } catch (RuntimeException e) {
            log.warn("Coach memory recall failed — using non-vector coach prompt: {}", e.toString());
            return null;
        }
    }

    /** Get chat history for a user (legacy unpaged). */
    /** Persists a deterministic small-talk exchange so it appears in history like any other turn. */
    @Transactional
    public void saveSmallTalk(UUID userId, String userMessage, String reply) {
        CoachMessage u = new CoachMessage();
        u.setUserId(userId);
        u.setRole("user");
        u.setContent(userMessage);
        coachRepo.save(u);
        CoachMessage a = new CoachMessage();
        a.setUserId(userId);
        a.setRole("assistant");
        a.setContent(reply);
        a.setProvider(SMALLTALK_PROVIDER);
        coachRepo.save(a);
    }

    public static final String SMALLTALK_PROVIDER = "carbonexo-smalltalk";

    public List<CoachMessage> getChatHistory(UUID userId) {
        return coachRepo.findByUserIdOrderByCreatedAtAsc(userId);
    }

    /**
     * Sub-50ms cursor-based pagination for AI coach chat history using (createdAt, id) tuple comparison.
     */
    public CursorPage<CoachMessage> getChatHistoryPaged(UUID userId, Instant cursorCreatedAt, UUID cursorId, int limit) {
        int pageSize = Math.min(Math.max(limit, 1), 100);
        Pageable pageable = PageRequest.of(0, pageSize);
        List<CoachMessage> messages;
        try {
            if (cursorCreatedAt != null && cursorId != null) {
                messages = coachRepo.findPagedBeforeCursor(userId, cursorCreatedAt, cursorId, pageable);
            } else {
                messages = coachRepo.findInitialCursorPage(userId, pageable);
            }
        } catch (Exception ex) {
            log.warn("Cursor pagination query failed, falling back to top 20: {}", ex.getMessage());
            messages = coachRepo.findTop20ByUserIdOrderByCreatedAtDesc(userId);
        }

        UUID nextCursorId = null;
        Instant nextCursorCreatedAt = null;
        boolean hasMore = messages != null && messages.size() == pageSize;
        if (messages != null && !messages.isEmpty()) {
            CoachMessage last = messages.get(messages.size() - 1);
            nextCursorId = last.getId();
            nextCursorCreatedAt = last.getCreatedAt();
        }

        return new CursorPage<>(messages != null ? messages : List.of(), nextCursorCreatedAt, nextCursorId, hasMore);
    }

    private void persist(AIResult result, UUID userId, String type, String title, String body) {
        Recommendation rec = new Recommendation();
        rec.setUserId(userId);
        rec.setType(type);
        rec.setTitle(title);
        rec.setBody(body);
        rec.setProvider(result.provider());   // "canned-fallback" when the model did not answer
        rec.setModel(result.model());         // the model that actually answered, or "none"
        recRepo.save(rec);
    }

    private double sumKg(UUID userId, LocalDate from, LocalDate to) {
        return logRepo.findByUserIdAndDateRange(userId, from, to).stream()
                .map(com.ecotrack.carbon.ActivityLog::getCo2Kg).filter(Objects::nonNull)
                .mapToDouble(BigDecimal::doubleValue).sum();
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
