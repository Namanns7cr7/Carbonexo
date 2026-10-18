package com.ecotrack.security;

import com.ecotrack.config.AppProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.List;

/**
 * Stateless security baseline. Public: auth endpoints, Swagger, actuator
 * health/info. Metrics (/actuator/prometheus, /actuator/metrics) need ROLE_ADMIN or
 * the scrape token in {@code X-Metrics-Token}: they reveal usage volumes and model
 * failures. Everything else requires a valid bearer JWT, validated
 * by {@link JwtAuthenticationFilter} (Phase 4b) which runs before the username/
 * password filter and populates the SecurityContext with a {@link UserPrincipal}.
 */
@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    private static final String[] PUBLIC = {
            "/api/auth/**",
            "/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html",
            "/actuator/health/**", "/actuator/info"
    };

    private static final String[] METRICS = {"/actuator/prometheus", "/actuator/metrics/**", "/actuator/metrics"};
    static final String METRICS_TOKEN_HEADER = "X-Metrics-Token";

    private final AppProperties props;
    private final byte[] metricsScrapeToken;

    public SecurityConfig(AppProperties props,
                          @Value("${ecotrack.security.metrics-scrape-token:}") String metricsScrapeToken) {
        this.props = props;
        // Shorter than 32 chars counts as unset: a guessable token is worse than none.
        this.metricsScrapeToken = metricsScrapeToken != null && metricsScrapeToken.length() >= 32
                ? metricsScrapeToken.getBytes(StandardCharsets.UTF_8) : null;
    }

    /** ROLE_ADMIN, or a constant-time match of the scrape token. No token configured means admin only. */
    AuthorizationManager<RequestAuthorizationContext> metricsAccess() {
        return (auth, ctx) -> {
            var a = auth.get();
            boolean admin = a != null && a.isAuthenticated()
                    && a.getAuthorities().stream().anyMatch(g -> "ROLE_ADMIN".equals(g.getAuthority()));
            if (admin) return new AuthorizationDecision(true);
            String presented = ctx.getRequest().getHeader(METRICS_TOKEN_HEADER);
            boolean token = metricsScrapeToken != null && presented != null
                    && MessageDigest.isEqual(metricsScrapeToken, presented.getBytes(StandardCharsets.UTF_8));
            return new AuthorizationDecision(token);
        };
    }

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                           JwtAuthenticationFilter jwtFilter) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .sessionManagement(sm -> sm.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC).permitAll()
                        .requestMatchers(METRICS).access(metricsAccess())
                        .anyRequest().authenticated())
                .exceptionHandling(eh -> eh
                        .authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
                .addFilterBefore(jwtFilter, UsernamePasswordAuthenticationFilter.class)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable);
        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration cfg) throws Exception {
        return cfg.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration cfg = new CorsConfiguration();
        cfg.setAllowedOrigins(props.cors().allowedOrigins());
        cfg.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        cfg.setAllowedHeaders(List.of("*"));
        cfg.setAllowCredentials(true);
        cfg.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", cfg);
        return source;
    }
}
