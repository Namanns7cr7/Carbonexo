package com.ecotrack.credit;

import com.ecotrack.config.AppConfigService;
import com.ecotrack.credit.dto.CreditBalanceResponse;
import com.ecotrack.credit.dto.CreditHistoryResponse;
import com.ecotrack.exception.BadRequestException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
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
    private final ActionTemplateCatalog actionCatalog;

    public CreditService(CreditLedgerRepository ledgerRepo, CreditRuleEngine ruleEngine,
                          AppConfigService appConfig, ActionTemplateCatalog actionCatalog) {
        this.ledgerRepo = ledgerRepo;
        this.ruleEngine = ruleEngine;
        this.appConfig = appConfig;
        this.actionCatalog = actionCatalog;
    }

    /** Serialises ledger writes for one user for the rest of the current transaction. */
    private void lockLedger(UUID userId) {
        ledgerRepo.lockLedger("credit_ledger:" + userId);
    }

    /** Award credits for a given reason. Serialised per user by {@link #lockLedger}. */
    @Transactional
    public void awardCredits(UUID userId, int credits, String reason, String ruleKey,
                              String refType, UUID refId) {
        if (!appConfig.getBool("credits.enabled", true)) return;
        if (credits <= 0) return;

        lockLedger(userId);
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
        lockLedger(userId);
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

    /** How many plan actions this user has completed; each earns exactly one ledger row. */
    public int completedActionCount(UUID userId) {
        return (int) ledgerRepo.countByUserIdAndRuleKey(userId, "action_done");
    }

    public CreditBalanceResponse getBalance(UUID userId) {
        int balance = ledgerRepo.sumDeltaByUserId(userId);
        return new CreditBalanceResponse(userId, balance);
    }

    public List<CreditHistoryResponse> getHistory(UUID userId) {
        return ledgerRepo.findByUserIdOrderByCreatedAtDesc(userId).stream()
                .map(e -> new CreditHistoryResponse(
                        e.getId(), e.getDelta(), e.getBalanceAfter(), e.getReason(),
                        e.getRuleKey(), e.getRefType(), e.getCreatedAt().toString(),
                        e.getRefId()
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

    /**
     * Idempotent per (user, action): completing the same plan action again —
     * e.g. un-ticking and re-ticking it — never awards a second time.
     */
    @Transactional
    public void onActionDone(UUID userId, UUID actionId) {
        lockLedger(userId); // check-then-award must not interleave with a concurrent identical request
        if (actionId != null && ledgerRepo.existsByUserIdAndRuleKeyAndRefId(userId, "action_done", actionId)) return;
        int credits = ruleEngine.creditsForActionDone();
        awardCredits(userId, credits, "Action completed", "action_done", "action", actionId);
    }

    public void onBillUpload(UUID userId, UUID billId) {
        int credits = ruleEngine.creditsForBillUpload();
        awardCredits(userId, credits, "Bill uploaded & confirmed", "bill_upload", "bill", billId);
    }

    /**
     * Credits a plan action by its catalog key. Only keys present (and active) in action_templates
     * count: otherwise a caller could mint unlimited credits by sending a fresh made-up key each time.
     */
    @Transactional
    public void completePlanAction(UUID userId, String actionKey) {
        if (!actionCatalog.isActive(actionKey)) {
            throw new BadRequestException("Unknown action: " + (actionKey == null ? "" : actionKey));
        }
        onActionDone(userId, UUID.nameUUIDFromBytes(actionKey.getBytes(StandardCharsets.UTF_8)));
    }
}
