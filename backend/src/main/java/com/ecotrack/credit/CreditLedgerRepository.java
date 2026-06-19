package com.ecotrack.credit;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;
import java.util.UUID;

public interface CreditLedgerRepository extends JpaRepository<CreditLedger, UUID> {

    List<CreditLedger> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("SELECT COALESCE(SUM(c.delta), 0) FROM CreditLedger c WHERE c.userId = :userId")
    int sumDeltaByUserId(UUID userId);

    @Query("SELECT c FROM CreditLedger c WHERE c.userId = :userId ORDER BY c.createdAt DESC LIMIT 1")
    CreditLedger findLatestByUserId(UUID userId);
}
