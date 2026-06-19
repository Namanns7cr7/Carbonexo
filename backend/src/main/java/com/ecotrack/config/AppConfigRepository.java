package com.ecotrack.config;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AppConfigRepository extends JpaRepository<AppConfig, UUID> {
    Optional<AppConfig> findByConfigKey(String configKey);
}
