package com.ecotrack.config;

import com.ecotrack.security.SecurityUtils;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import java.util.Optional;
import java.util.UUID;

/**
 * Enables {@code @CreatedDate}/{@code @LastModifiedDate}/{@code @CreatedBy}/
 * {@code @LastModifiedBy} on entities extending {@link com.ecotrack.common.BaseEntity}.
 * The auditor is the authenticated user's id (empty for anonymous/system actions).
 */
@Configuration
@EnableJpaAuditing(auditorAwareRef = "auditorAware")
public class JpaAuditingConfig {

    @Bean
    public AuditorAware<UUID> auditorAware() {
        return () -> Optional.ofNullable(SecurityUtils.currentUserIdOrNull());
    }
}
