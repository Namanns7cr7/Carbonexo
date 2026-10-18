package com.ecotrack.ai.service;

import com.ecotrack.ai.agent.AgenticCoachService;
import com.ecotrack.config.AppConfigService;
import com.ecotrack.exception.BadRequestException;
import org.springframework.beans.factory.ObjectProvider;
import com.ecotrack.ai.service.dto.CursorPage;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    /** Same ceiling the agentic coach enforces; applied here so the legacy path is bounded too. */
    static final int MAX_COACH_MESSAGE_CHARS = 2000;
    private static final java.util.regex.Pattern YEAR_MONTH = java.util.regex.Pattern.compile("\\d{4}-(0[1-9]|1[0-2])");

    private final AIService service;
    private final AppConfigService appConfig;
    private final AgenticCoachService agenticCoach;

    public AIController(AIService service, AppConfigService appConfig,
                        ObjectProvider<AgenticCoachService> agenticCoach) {
        this.service = service;
        this.appConfig = appConfig;
        this.agenticCoach = agenticCoach.getIfAvailable();
    }

    @PostMapping("/recommendations")
    public ResponseEntity<Map<String, String>> recommendations() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(Map.of("result", service.getRecommendations(userId)));
    }

    @PostMapping("/electricity-analysis")
    public ResponseEntity<Map<String, String>> electricityAnalysis(
            @RequestBody Map<String, Object> body) {
        UUID userId = SecurityUtils.currentUserId();
        double units = requireUnits(body.get("units"));
        String month = requireYearMonth(body.getOrDefault("billingMonth", "2026-06"), "billingMonth");
        return ResponseEntity.ok(Map.of("result", service.analyzeElectricity(userId, units, month)));
    }

    @PostMapping("/transport-insights")
    public ResponseEntity<Map<String, String>> transportInsights() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(Map.of("result", service.getTransportInsights(userId)));
    }

    @GetMapping("/daily-tip")
    public ResponseEntity<Map<String, String>> dailyTip() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(Map.of("result", service.getDailyTip(userId)));
    }

    @PostMapping("/monthly-report")
    public ResponseEntity<Map<String, String>> monthlyReport(@RequestBody Map<String, String> body) {
        UUID userId = SecurityUtils.currentUserId();
        String period = requireYearMonth(body.getOrDefault("period", "2026-06"), "period");
        return ResponseEntity.ok(Map.of("result", service.getMonthlyReport(userId, period)));
    }

    @PostMapping("/coach")
    public ResponseEntity<CoachResponse> coach(@RequestBody Map<String, Object> body) {
        UUID userId = SecurityUtils.currentUserId();   // the ONLY source of identity for every coach tool
        String message = requireCoachMessage(body == null ? null : body.get("message"));
        // app_config ai.coach.mode: legacy (default, production) | tools | tools_rag (agentic, source-grounded)
        // | safe_limited (agentic, approved factors and reviewed evidence only; failures reported plainly)
        AgenticCoachService.Mode mode = AgenticCoachService.Mode.fromConfig(appConfig.getOrDefault("ai.coach.mode", "legacy"));
        if (agenticCoach != null && mode != null) {
            return ResponseEntity.ok(agenticCoach.chat(userId, message, mode));
        }
        return ResponseEntity.ok(service.chat(userId, message));
    }

    @GetMapping("/coach/history")
    public ResponseEntity<List<CoachMessage>> coachHistory() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(service.getChatHistory(userId));
    }

    /**
     * Sub-50ms cursor-based pagination endpoint for infinite scrolling in the coach chat interface.
     */
    @GetMapping("/coach/history/paged")
    public ResponseEntity<CursorPage<CoachMessage>> coachHistoryPaged(
            @RequestParam(required = false) Instant cursorCreatedAt,
            @RequestParam(required = false) UUID cursorId,
            @RequestParam(defaultValue = "20") int limit) {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(service.getChatHistoryPaged(userId, cursorCreatedAt, cursorId, limit));
    }

    static String requireCoachMessage(Object raw) {
        String message = raw instanceof String s ? s.trim() : "";
        if (message.isEmpty()) throw new BadRequestException("message is required");
        if (message.length() > MAX_COACH_MESSAGE_CHARS) throw new BadRequestException("message too long");
        return message;
    }

    static double requireUnits(Object raw) {
        if (!(raw instanceof Number n) || !Double.isFinite(n.doubleValue()) || n.doubleValue() < 0 || n.doubleValue() > 1_000_000) {
            throw new BadRequestException("units must be a number between 0 and 1000000");
        }
        return n.doubleValue();
    }

    static String requireYearMonth(Object raw, String field) {
        if (!(raw instanceof String s) || !YEAR_MONTH.matcher(s).matches()) {
            throw new BadRequestException(field + " must be formatted YYYY-MM");
        }
        return s;
    }
}
