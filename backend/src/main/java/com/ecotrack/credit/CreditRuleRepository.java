package com.ecotrack.credit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import java.util.UUID;

public interface CreditRuleRepository extends JpaRepository<CreditRule, UUID> {

    @Query("SELECT r FROM CreditRule r WHERE r.ruleKey = :key AND r.active = true " +
           "AND r.validFrom <= CURRENT_DATE AND (r.validTo IS NULL OR r.validTo >= CURRENT_DATE)")
    Optional<CreditRule> findActiveByKey(String key);
}
