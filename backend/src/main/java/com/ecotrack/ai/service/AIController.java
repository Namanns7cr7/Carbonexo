package com.ecotrack.ai.service;

import com.ecotrack.ai.agent.AgenticCoachService;
import com.ecotrack.config.AppConfigService;
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

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AIController.class);

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
        double units = ((Number) body.getOrDefault("units", 0)).doubleValue();
        String month = (String) body.getOrDefault("billingMonth", "2026-06");
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
        String period = body.getOrDefault("period", "2026-06");
        return ResponseEntity.ok(Map.of("result", service.getMonthlyReport(userId, period)));
    }

    @PostMapping("/coach")
    public ResponseEntity<CoachResponse> coach(@RequestBody Map<String, Object> body) {
        UUID userId = SecurityUtils.currentUserId();   // the ONLY source of identity for every coach tool
        String message = body != null && body.get("message") != null ? body.get("message").toString() : "";
        // Pure small talk never reaches the model, retrieval or recommendation paths.
        var smallTalk = SmallTalk.reply(message);
        if (smallTalk.isPresent()) {
            boolean persisted = true;
            try {
                service.saveSmallTalk(userId, message.trim(), smallTalk.get());
            } catch (RuntimeException e) {
                persisted = false;   // still answer, but say plainly it was not saved
                log.warn("Coach small talk not persisted: {}", e.toString());
            }
            return ResponseEntity.ok(new CoachResponse(smallTalk.get(), null, AIService.SMALLTALK_PROVIDER, null, null, null,
                    null, List.of(), List.of(), Map.of("persisted", persisted)));
        }
        // app_config ai.coach.mode: legacy (default, production) | tools | tools_rag (agentic, source-grounded)
        // | safe_limited (agentic, approved factors and reviewed evidence only; failures reported plainly)
        AgenticCoachService.Mode mode = AgenticCoachService.Mode.fromConfig(appConfig.getOrDefault("ai.coach.mode", "legacy"));
        if (agenticCoach != null && mode != null) {
            return ResponseEntity.ok(agenticCoach.chat(userId, message, mode, pageHint(body)));
        }
        return ResponseEntity.ok(service.chat(userId, message));
    }

    private static final java.util.regex.Pattern PAGE_ROUTE = java.util.regex.Pattern.compile("/app(/[a-z0-9-]{1,40}){0,3}");
    private static final java.util.regex.Pattern PAGE_TITLE = java.util.regex.Pattern.compile("[\\p{L}\\p{N} &'-]{1,60}");

    /**
     * Optional {"pageContext":{"route":"/app/credits","pageTitle":"Green Credits"}} from the client, reduced to a
     * short, validated label. Anything else in it (client-side numbers, ids, filters) is ignored, and an invalid
     * route or title drops the hint rather than passing free text into the prompt.
     */
    static String pageHint(Map<String, Object> body) {
        if (body == null || !(body.get("pageContext") instanceof Map<?, ?> ctx)) return null;
        Object route = ctx.get("route"), title = ctx.get("pageTitle");
        if (!(route instanceof String r) || !PAGE_ROUTE.matcher(r).matches()) return null;
        if (!(title instanceof String t) || !PAGE_TITLE.matcher(t).matches()) return null;
        return t + " (" + r + ")";
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
}
