package com.ecotrack.reward;

import com.ecotrack.reward.dto.RedemptionResponse;
import com.ecotrack.reward.dto.RewardResponse;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/rewards")
public class RewardController {

    private final RewardService service;

    public RewardController(RewardService service) {
        this.service = service;
    }

    @GetMapping
    public ResponseEntity<List<RewardResponse>> catalog() {
        return ResponseEntity.ok(service.getCatalog());
    }

    @PostMapping("/{id}/redeem")
    public ResponseEntity<RedemptionResponse> redeem(@PathVariable UUID id) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(service.redeem(SecurityUtils.currentUserId(), id));
    }

    @GetMapping("/redemptions")
    public ResponseEntity<List<RedemptionResponse>> redemptions() {
        return ResponseEntity.ok(service.getRedemptions(SecurityUtils.currentUserId()));
    }
}
