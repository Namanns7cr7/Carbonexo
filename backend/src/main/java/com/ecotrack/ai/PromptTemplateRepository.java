package com.ecotrack.ai;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.Optional;
import java.util.UUID;

public interface PromptTemplateRepository extends JpaRepository<PromptTemplate, UUID> {

    @Query("SELECT pt FROM PromptTemplate pt WHERE pt.templateKey = :key AND pt.active = true " +
           "ORDER BY pt.version DESC LIMIT 1")
    Optional<PromptTemplate> findLatestActiveByKey(String key);
}
