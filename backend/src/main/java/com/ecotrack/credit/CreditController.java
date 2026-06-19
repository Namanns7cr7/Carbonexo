package com.ecotrack.credit;

import com.ecotrack.credit.dto.CreditBalanceResponse;
import com.ecotrack.credit.dto.CreditHistoryResponse;
import com.ecotrack.security.SecurityUtils;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/credits")
public class CreditController {

    private final CreditService service;

    public CreditController(CreditService service) {
        this.service = service;
    }

    @GetMapping("/balance")
    public ResponseEntity<CreditBalanceResponse> getBalance() {
        return ResponseEntity.ok(service.getBalance(SecurityUtils.currentUserId()));
    }

    @GetMapping("/history")
    public ResponseEntity<List<CreditHistoryResponse>> getHistory() {
        return ResponseEntity.ok(service.getHistory(SecurityUtils.currentUserId()));
    }

    @PostMapping("/action")
    public ResponseEntity<Void> completeAction(@RequestParam String actionKey) {
        java.util.UUID actionId = java.util.UUID.nameUUIDFromBytes(actionKey.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        service.onActionDone(SecurityUtils.currentUserId(), actionId);
        return ResponseEntity.noContent().build();
    }
}
