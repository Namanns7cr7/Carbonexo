package com.ecotrack.credit;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.credit.dto.CreditBalanceResponse;
import com.ecotrack.credit.dto.CreditHistoryResponse;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

/**
 * Credit service — manages the append-only ledger. Provides accrual hooks
 * (called by other services on carbon-saved, action-done, etc.), balance query,
 * and history.
 */
@Service
public class CreditService {

    private final CreditLedgerRepository ledgerRepo;
    private final CreditRuleEngine ruleEngine;
    private final AppConfigService appConfig;

    public CreditService(CreditLedgerRepository ledgerRepo, CreditRuleEngine ruleEngine,
                          AppConfigService appConfig) {
        this.ledgerRepo = ledgerRepo;
        this.ruleEngine = ruleEngine;
        this.appConfig = appConfig;
    }

    /** Award credits for a given reason. Thread-safe via serializable ledger append. */
    @Transactional
    public void awardCredits(UUID userId, int credits, String reason, String ruleKey,
                              String refType, UUID refId) {
        if (!appConfig.getBool("credits.enabled", true)) return;
        if (credits <= 0) return;

        int currentBalance = ledgerRepo.sumDeltaByUserId(userId);
        CreditLedger entry = new CreditLedger();
        entry.setUserId(userId);
        entry.setDelta(credits);
        entry.setBalanceAfter(currentBalance + credits);
        entry.setReason(reason);
        entry.setRuleKey(ruleKey);
        entry.setRefType(refType);
        entry.setRefId(refId);
        entry.setCreatedBy(userId);
        ledgerRepo.save(entry);
    }

    /** Debit credits (for redemption). Returns false if insufficient balance. */
    @Transactional
    public boolean debitCredits(UUID userId, int credits, String reason, String refType, UUID refId) {
        int currentBalance = ledgerRepo.sumDeltaByUserId(userId);
        if (currentBalance < credits) return false;

        CreditLedger entry = new CreditLedger();
        entry.setUserId(userId);
        entry.setDelta(-credits);
        entry.setBalanceAfter(currentBalance - credits);
        entry.setReason(reason);
        entry.setRefType(refType);
        entry.setRefId(refId);
        entry.setCreatedBy(userId);
        ledgerRepo.save(entry);
        return true;
    }

    public CreditBalanceResponse getBalance(UUID userId) {
        int balance = ledgerRepo.sumDeltaByUserId(userId);
        return new CreditBalanceResponse(userId, balance);
    }

    public List<CreditHistoryResponse> getHistory(UUID userId) {
        return ledgerRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(e -> new CreditHistoryResponse(
                        e.getId(), e.getDelta(), e.getBalanceAfter(), e.getReason(),
                        e.getRuleKey(), e.getRefType(), e.getCreatedAt().toString()
                )).toList();
    }

    // --- Accrual hooks (called by other services) ---

    public void onSignup(UUID userId) {
        int credits = ruleEngine.signupBonus();
        awardCredits(userId, credits, "Welcome bonus", "signup_bonus", "signup", userId);
    }

    public void onCarbonSaved(UUID userId, double kgSaved) {
        int credits = ruleEngine.creditsForKgSaved(kgSaved);
        awardCredits(userId, credits, kgSaved + " kg CO₂ saved", "kg_saved", "carbon_saved", null);
    }

    public void onActionDone(UUID userId, UUID actionId) {
        int credits = ruleEngine.creditsForActionDone();
        awardCredits(userId, credits, "Action completed", "action_done", "action", actionId);
    }

    public void onBillUpload(UUID userId, UUID billId) {
        int credits = ruleEngine.creditsForBillUpload();
        awardCredits(userId, credits, "Bill uploaded & confirmed", "bill_upload", "bill", billId);
    }
}
