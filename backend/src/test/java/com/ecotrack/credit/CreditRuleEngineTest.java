package com.ecotrack.credit;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class CreditRuleEngineTest {

    private final CreditRuleRepository repo = mock(CreditRuleRepository.class);
    private final CreditRuleEngine engine = new CreditRuleEngine(repo);

    @Test
    void multipliesCreditsPerUnitByQuantity() {
        CreditRule rule = mock(CreditRule.class);
        when(rule.getCreditsPerUnit()).thenReturn(new BigDecimal("2"));
        when(repo.findActiveByKey("kg_saved")).thenReturn(Optional.of(rule));

        assertEquals(20, engine.creditsForKgSaved(10.0)); // 2 * 10
    }

    @Test
    void returnsZeroWhenNoActiveRule() {
        when(repo.findActiveByKey(anyString())).thenReturn(Optional.empty());
        assertEquals(0, engine.creditsForBillUpload());
        assertEquals(0, engine.creditsForActionDone());
    }
}
