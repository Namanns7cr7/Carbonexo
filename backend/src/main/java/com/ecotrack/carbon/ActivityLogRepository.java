package com.ecotrack.carbon;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

public interface ActivityLogRepository extends JpaRepository<ActivityLog, UUID> {

    List<ActivityLog> findByUserIdAndDeletedAtIsNullOrderByActivityDateDescCreatedAtDesc(UUID userId);

    List<ActivityLog> findByUserIdAndActivityDateAndDeletedAtIsNull(UUID userId, LocalDate date);

    @Query("SELECT a FROM ActivityLog a WHERE a.userId = :userId AND a.deletedAt IS NULL " +
           "AND a.activityDate BETWEEN :from AND :to ORDER BY a.activityDate DESC")
    List<ActivityLog> findByUserIdAndDateRange(UUID userId, LocalDate from, LocalDate to);

    @Query("SELECT COALESCE(SUM(a.co2Kg), 0) FROM ActivityLog a " +
           "WHERE a.userId = :userId AND a.activityDate = :date AND a.deletedAt IS NULL")
    BigDecimal sumCo2ByUserAndDate(UUID userId, LocalDate date);

    @Query("SELECT a.category, COALESCE(SUM(a.co2Kg), 0) FROM ActivityLog a " +
           "WHERE a.userId = :userId AND a.activityDate BETWEEN :from AND :to AND a.deletedAt IS NULL " +
           "GROUP BY a.category")
    List<Object[]> breakdownByCategory(UUID userId, LocalDate from, LocalDate to);

    @Query("SELECT DISTINCT a.activityDate FROM ActivityLog a " +
           "WHERE a.userId = :userId AND a.deletedAt IS NULL ORDER BY a.activityDate DESC")
    List<LocalDate> findDistinctDatesByUser(UUID userId);
}
