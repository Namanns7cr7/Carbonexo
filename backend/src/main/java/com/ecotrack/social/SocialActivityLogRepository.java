package com.ecotrack.social;

import com.ecotrack.carbon.ActivityLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Read-only aggregation queries over {@code activity_logs} for the group
 * leaderboard (co2_saved metric). Deliberately a separate repository (kept
 * inside com.ecotrack.social, alongside the rest of the social feature) so the
 * carbon package's own entity/repository files never need to be touched —
 * Spring Data JPA allows several repository interfaces over the same entity.
 */
public interface SocialActivityLogRepository extends JpaRepository<ActivityLog, UUID> {

    /**
     * Per-member CO2 total (kg) for the given users, honoring the same
     * soft-delete convention as {@code ActivityLogRepository} (deletedAt IS
     * NULL). {@code from} is inclusive and nullable — null means no lower
     * bound (the "all" window).
     *
     * Two queries rather than {@code (:from IS NULL OR ...)}: PostgreSQL
     * cannot infer the type of a parameter that is only compared with NULL,
     * and rejects the statement.
     */
    default List<Object[]> sumCo2ByUserIds(List<UUID> userIds, LocalDate from) {
        return from == null ? sumCo2AllTime(userIds) : sumCo2Since(userIds, from);
    }

    @Query("SELECT a.userId, COALESCE(SUM(a.co2Kg), 0) FROM ActivityLog a " +
           "WHERE a.userId IN :userIds AND a.deletedAt IS NULL " +
           "GROUP BY a.userId")
    List<Object[]> sumCo2AllTime(List<UUID> userIds);

    @Query("SELECT a.userId, COALESCE(SUM(a.co2Kg), 0) FROM ActivityLog a " +
           "WHERE a.userId IN :userIds AND a.deletedAt IS NULL AND a.activityDate >= :from " +
           "GROUP BY a.userId")
    List<Object[]> sumCo2Since(List<UUID> userIds, LocalDate from);

    /**
     * Per-member [userId, CO2 total kg, distinct logged days] from {@code from}
     * (inclusive). Members with no logs in the window are absent.
     */
    @Query("SELECT a.userId, COALESCE(SUM(a.co2Kg), 0), COUNT(DISTINCT a.activityDate) FROM ActivityLog a " +
           "WHERE a.userId IN :userIds AND a.deletedAt IS NULL AND a.activityDate >= :from " +
           "GROUP BY a.userId")
    List<Object[]> sumCo2AndLoggedDaysSince(List<UUID> userIds, LocalDate from);
}
