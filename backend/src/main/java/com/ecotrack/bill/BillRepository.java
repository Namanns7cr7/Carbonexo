package com.ecotrack.bill;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.UUID;

public interface BillRepository extends JpaRepository<Bill, UUID> {
    List<Bill> findByUserIdAndDeletedAtIsNullOrderByCreatedAtDesc(UUID userId);
}
