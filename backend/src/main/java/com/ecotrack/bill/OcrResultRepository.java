package com.ecotrack.bill;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.UUID;

public interface OcrResultRepository extends JpaRepository<OcrResult, UUID> {
    Optional<OcrResult> findByBillId(UUID billId);
}
