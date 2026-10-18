package com.ecotrack.ai.feedback;

import com.ecotrack.security.SecurityUtils;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/** Coach feedback (users, own responses only) and the reviewer workflow (ADMIN). */
@RestController
public class FeedbackController {

    private final FeedbackService service;

    public FeedbackController(FeedbackService service) {
        this.service = service;
    }

    @PostMapping("/api/ai/responses/{responseId}/feedback")
    public ResponseEntity<Map<String, Object>> feedback(@PathVariable UUID responseId, @RequestBody FeedbackService.FeedbackRequest req) {
        return ResponseEntity.ok(service.submit(SecurityUtils.currentUserId(), responseId, req));
    }

    @GetMapping("/api/ai/responses/{responseId}")
    public ResponseEntity<Map<String, Object>> response(@PathVariable UUID responseId) {
        return ResponseEntity.ok(service.responseMeta(SecurityUtils.currentUserId(), responseId));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/api/admin/ai/review-pairs")
    public ResponseEntity<Map<String, Object>> createPair(@RequestBody FeedbackService.PairRequest req) {
        return ResponseEntity.ok(Map.of("pair_id", service.createPair(req)));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/api/admin/ai/review-pairs/{pairId}/judgement")
    public ResponseEntity<Map<String, Object>> judge(@PathVariable UUID pairId, @RequestBody FeedbackService.JudgementRequest req) {
        return ResponseEntity.ok(service.judge(pairId, "human:" + SecurityUtils.currentUserId(), req));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping(value = "/api/admin/ai/preference-export", produces = "application/x-ndjson")
    public ResponseEntity<String> export() {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("application/x-ndjson")).body(service.exportPreferences());
    }
}
