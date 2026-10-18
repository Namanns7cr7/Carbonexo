package com.ecotrack.social;

import com.ecotrack.credit.CreditLedger;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Read-only aggregation queries over {@code credit_ledger} for the group
 * leaderboard (credits metric). Kept inside com.ecotrack.social as a second
 * repository over the same entity, so the credit package's own files are
 * never modified.
 */
public interface SocialCreditLedgerRepository extends JpaRepository<CreditLedger, UUID> {

    /**
     * Per-member credit delta total for the given users. {@code from} is
     * inclusive and nullable — null means no lower bound (the "all" window).
     * Split into two queries for the same PostgreSQL reason as
     * {@link SocialActivityLogRepository#sumCo2ByUserIds}.
     */
    default List<Object[]> sumDeltaByUserIds(List<UUID> userIds, Instant from) {
        return from == null ? sumDeltaAllTime(userIds) : sumDeltaSince(userIds, from);
    }

    @Query("SELECT c.userId, COALESCE(SUM(c.delta), 0) FROM CreditLedger c " +
           "WHERE c.userId IN :userIds " +
           "GROUP BY c.userId")
    List<Object[]> sumDeltaAllTime(List<UUID> userIds);

    @Query("SELECT c.userId, COALESCE(SUM(c.delta), 0) FROM CreditLedger c " +
           "WHERE c.userId IN :userIds AND c.createdAt >= :from " +
           "GROUP BY c.userId")
    List<Object[]> sumDeltaSince(List<UUID> userIds, Instant from);
}
