package com.ecotrack.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Runtime configuration service — reads from the {@code app_config} table with
 * an in-memory cache (5 min TTL). Used by engines to fetch runtime-editable
 * values (OCR provider, AI provider, credit rules, etc.) without restart.
 */
@Service
public class AppConfigService {

    private static final Logger log = LoggerFactory.getLogger(AppConfigService.class);
    private static final long CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

    private final AppConfigRepository repo;
    private final Map<String, CacheEntry> cache = new ConcurrentHashMap<>();

    public AppConfigService(AppConfigRepository repo) {
        this.repo = repo;
    }

    public Optional<String> get(String key) {
        CacheEntry entry = cache.get(key);
        if (entry != null && !entry.isExpired()) {
            return Optional.ofNullable(entry.value);
        }
        Optional<AppConfig> cfg = repo.findByConfigKey(key);
        String val = cfg.map(AppConfig::getConfigValue).orElse(null);
        cache.put(key, new CacheEntry(val, System.currentTimeMillis()));
        return Optional.ofNullable(val);
    }

    public String getOrDefault(String key, String defaultValue) {
        return get(key).orElse(defaultValue);
    }

    public int getInt(String key, int defaultValue) {
        return get(key).map(v -> {
            try { return Integer.parseInt(v); }
            catch (NumberFormatException e) { return defaultValue; }
        }).orElse(defaultValue);
    }

    public double getDouble(String key, double defaultValue) {
        return get(key).map(v -> {
            try { return Double.parseDouble(v); }
            catch (NumberFormatException e) { return defaultValue; }
        }).orElse(defaultValue);
    }

    public boolean getBool(String key, boolean defaultValue) {
        return get(key).map(Boolean::parseBoolean).orElse(defaultValue);
    }

    /** Invalidate cache for a specific key (e.g. after admin update). */
    public void invalidate(String key) {
        cache.remove(key);
    }

    /** Invalidate entire cache. */
    public void invalidateAll() {
        cache.clear();
    }

    private record CacheEntry(String value, long createdAt) {
        boolean isExpired() {
            return System.currentTimeMillis() - createdAt > CACHE_TTL_MS;
        }
    }
}
