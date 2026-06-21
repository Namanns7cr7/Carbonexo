package com.ecotrack.ai.service;

import com.ecotrack.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/ai")
public class AIController {

    private final AIService service;

    public AIController(AIService service) {
        this.service = service;
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
    public ResponseEntity<CoachResponse> coach(@RequestBody Map<String, String> body) {
        UUID userId = SecurityUtils.currentUserId();
        String message = body.getOrDefault("message", "");
        return ResponseEntity.ok(service.chat(userId, message));
    }

    @GetMapping("/coach/history")
    public ResponseEntity<List<CoachMessage>> coachHistory() {
        UUID userId = SecurityUtils.currentUserId();
        return ResponseEntity.ok(service.getChatHistory(userId));
    }
}
