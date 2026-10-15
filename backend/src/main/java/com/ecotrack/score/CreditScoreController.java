package com.ecotrack.score;

import com.ecotrack.score.dto.CreditScoreResponse;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/credits")
public class CreditScoreController {

    private final CreditScoreService service;

    public CreditScoreController(CreditScoreService service) {
        this.service = service;
    }

    @GetMapping("/score")
    public ResponseEntity<CreditScoreResponse> getScore() {
        return ResponseEntity.ok(service.getScore(SecurityUtils.currentUserId()));
    }
}
