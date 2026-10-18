package com.ecotrack.credit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.UUID;

public interface CreditLedgerRepository extends JpaRepository<CreditLedger, UUID> {

    List<CreditLedger> findByUserIdOrderByCreatedAtDesc(UUID userId);

    long countByUserIdAndRuleKey(UUID userId, String ruleKey);

    boolean existsByUserIdAndRuleKeyAndRefId(UUID userId, String ruleKey, UUID refId);

    @Query("SELECT COALESCE(SUM(c.delta), 0) FROM CreditLedger c WHERE c.userId = :userId")
    int sumDeltaByUserId(UUID userId);

    @Query("SELECT c FROM CreditLedger c WHERE c.userId = :userId ORDER BY c.createdAt DESC LIMIT 1")
    CreditLedger findLatestByUserId(UUID userId);

    /**
     * Takes a transaction-scoped Postgres advisory lock so concurrent ledger writes for one user
     * run one after another. The balance is "read sum, then append", so without this two requests
     * can read the same balance (double-spend, duplicate idempotent awards). Released on commit/rollback.
     */
    @Query(value = "SELECT CAST(pg_advisory_xact_lock(hashtext(:key)) AS text)", nativeQuery = true)
    String lockLedger(@Param("key") String key);
}
