package com.ecotrack.credit;

import com.ecotrack.config.AppConfigService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CreditServiceTest {

    private final CreditLedgerRepository ledger = mock(CreditLedgerRepository.class);
    private final CreditRuleEngine rules = mock(CreditRuleEngine.class);
    private final AppConfigService cfg = mock(AppConfigService.class);
    private final ActionTemplateCatalog catalog = mock(ActionTemplateCatalog.class);
    private final CreditService svc = new CreditService(ledger, rules, cfg, catalog);
    private final UUID user = UUID.randomUUID();

    @Test
    void awardsCreditsWithRunningBalance() {
        when(cfg.getBool("credits.enabled", true)).thenReturn(true);
        when(ledger.sumDeltaByUserId(user)).thenReturn(100);

        svc.awardCredits(user, 50, "reason", "rule", "type", null);

        ArgumentCaptor<CreditLedger> cap = ArgumentCaptor.forClass(CreditLedger.class);
        verify(ledger).save(cap.capture());
        assertEquals(50, cap.getValue().getDelta());
        assertEquals(150, cap.getValue().getBalanceAfter()); // 100 + 50
    }

    @Test
    void doesNotAwardWhenCreditsDisabled() {
        when(cfg.getBool("credits.enabled", true)).thenReturn(false);
        svc.awardCredits(user, 50, "r", "k", "t", null);
        verify(ledger, never()).save(any());
    }

    @Test
    void doesNotAwardNonPositiveCredits() {
        when(cfg.getBool("credits.enabled", true)).thenReturn(true);
        svc.awardCredits(user, 0, "r", "k", "t", null);
        verify(ledger, never()).save(any());
    }

    @Test
    void actionDoneAwardsOncePerAction() {
        UUID action = UUID.randomUUID();
        when(cfg.getBool("credits.enabled", true)).thenReturn(true);
        when(rules.creditsForActionDone()).thenReturn(25);
        when(ledger.existsByUserIdAndRuleKeyAndRefId(user, "action_done", action)).thenReturn(false, true);

        svc.onActionDone(user, action);
        svc.onActionDone(user, action); // re-ticked in the UI

        verify(ledger, times(1)).save(any());
    }

    @Test
    void distinctActionsEachAward() {
        when(cfg.getBool("credits.enabled", true)).thenReturn(true);
        when(rules.creditsForActionDone()).thenReturn(25);
        when(ledger.existsByUserIdAndRuleKeyAndRefId(eq(user), eq("action_done"), any())).thenReturn(false);

        svc.onActionDone(user, UUID.randomUUID());
        svc.onActionDone(user, UUID.randomUUID());

        verify(ledger, times(2)).save(any());
    }

    @Test
    void debitFailsOnInsufficientBalance() {
        when(ledger.sumDeltaByUserId(user)).thenReturn(10);
        assertFalse(svc.debitCredits(user, 50, "r", "t", null));
        verify(ledger, never()).save(any());
    }

    @Test
    void debitSucceedsAndRecordsNegativeDelta() {
        when(ledger.sumDeltaByUserId(user)).thenReturn(100);

        assertTrue(svc.debitCredits(user, 30, "r", "t", null));

        ArgumentCaptor<CreditLedger> cap = ArgumentCaptor.forClass(CreditLedger.class);
        verify(ledger).save(cap.capture());
        assertEquals(-30, cap.getValue().getDelta());
        assertEquals(70, cap.getValue().getBalanceAfter()); // 100 - 30
    }

    @Test
    void ledgerWritesAreSerialisedPerUser() {
        when(cfg.getBool("credits.enabled", true)).thenReturn(true);
        when(ledger.sumDeltaByUserId(user)).thenReturn(100);

        svc.awardCredits(user, 5, "r", "rule", "t", null);
        svc.debitCredits(user, 5, "r", "t", null);

        verify(ledger, times(2)).lockLedger("credit_ledger:" + user);
    }

    @Test
    void unknownPlanActionIsRejectedAndEarnsNothing() {
        when(catalog.isActive("made-up-key")).thenReturn(false);

        assertThrows(com.ecotrack.exception.BadRequestException.class,
                () -> svc.completePlanAction(user, "made-up-key"));
        verify(ledger, never()).save(any());
    }

    @Test
    void knownPlanActionEarnsOnceAndNeverTwice() {
        when(cfg.getBool("credits.enabled", true)).thenReturn(true);
        when(catalog.isActive("metro-commute")).thenReturn(true);
        when(rules.creditsForActionDone()).thenReturn(25);

        svc.completePlanAction(user, "metro-commute");
        verify(ledger, times(1)).save(any(CreditLedger.class));

        when(ledger.existsByUserIdAndRuleKeyAndRefId(eq(user), eq("action_done"), any())).thenReturn(true);
        svc.completePlanAction(user, "metro-commute");
        verify(ledger, times(1)).save(any(CreditLedger.class)); // still one
    }
}
