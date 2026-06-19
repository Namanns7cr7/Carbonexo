package com.ecotrack.credit;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.Optional;

/**
 * Config-driven credit rule engine. Reads rules from the database (credit_rules
 * table). No hardcoded reward values.
 */
@Service
public class CreditRuleEngine {

    private static final Logger log = LoggerFactory.getLogger(CreditRuleEngine.class);
    private final CreditRuleRepository ruleRepo;

    public CreditRuleEngine(CreditRuleRepository ruleRepo) {
        this.ruleRepo = ruleRepo;
    }

    /** Calculate credits for kg CO2 saved. */
    public int creditsForKgSaved(double kgSaved) {
        return calculate("kg_saved", kgSaved);
    }

    /** Calculate credits for completing a plan action. */
    public int creditsForActionDone() {
        return calculate("action_done", 1.0);
    }

    /** Calculate credits for a streak day. */
    public int creditsForStreakDay() {
        return calculate("streak_day", 1.0);
    }

    /** Get signup bonus credits. */
    public int signupBonus() {
        return calculate("signup_bonus", 1.0);
    }

    /** Credits for uploading a bill. */
    public int creditsForBillUpload() {
        return calculate("bill_upload", 1.0);
    }

    private int calculate(String ruleKey, double quantity) {
        Optional<CreditRule> rule = ruleRepo.findActiveByKey(ruleKey);
        if (rule.isEmpty()) {
            log.warn("No active credit rule for key={}", ruleKey);
            return 0;
        }
        BigDecimal credits = rule.get().getCreditsPerUnit().multiply(BigDecimal.valueOf(quantity));
        return credits.intValue();
    }
}
