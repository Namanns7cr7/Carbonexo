package com.ecotrack.config;

import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AppConfigServiceTest {

    private final AppConfigRepository repo = mock(AppConfigRepository.class);
    private final AppConfigService service = new AppConfigService(repo);

    /** Build a stubbed AppConfig mock up-front (avoids nested-stubbing during when()). */
    private AppConfig cfg(String value) {
        AppConfig c = mock(AppConfig.class);
        when(c.getConfigValue()).thenReturn(value);
        return c;
    }

    @Test
    void getReturnsValueFromRepository() {
        AppConfig c = cfg("gemini");
        when(repo.findByConfigKey("ai.provider")).thenReturn(Optional.of(c));
        assertEquals(Optional.of("gemini"), service.get("ai.provider"));
    }

    @Test
    void getCachesAndDoesNotHitRepositoryTwice() {
        AppConfig c = cfg("v");
        when(repo.findByConfigKey("k")).thenReturn(Optional.of(c));
        service.get("k");
        service.get("k");
        verify(repo, times(1)).findByConfigKey("k");
    }

    @Test
    void invalidateForcesRepositoryReload() {
        AppConfig c = cfg("v");
        when(repo.findByConfigKey("k")).thenReturn(Optional.of(c));
        service.get("k");
        service.invalidate("k");
        service.get("k");
        verify(repo, times(2)).findByConfigKey("k");
    }

    @Test
    void getOrDefaultFallsBackWhenMissing() {
        when(repo.findByConfigKey("missing")).thenReturn(Optional.empty());
        assertEquals("fallback", service.getOrDefault("missing", "fallback"));
    }

    @Test
    void typedGettersParseValues() {
        AppConfig i = cfg("42");
        AppConfig d = cfg("3.5");
        AppConfig b = cfg("true");
        when(repo.findByConfigKey("int")).thenReturn(Optional.of(i));
        when(repo.findByConfigKey("dbl")).thenReturn(Optional.of(d));
        when(repo.findByConfigKey("bool")).thenReturn(Optional.of(b));

        assertEquals(42, service.getInt("int", 0));
        assertEquals(3.5, service.getDouble("dbl", 0.0));
        assertTrue(service.getBool("bool", false));
    }

    @Test
    void typedGettersReturnDefaultOnParseError() {
        AppConfig bad = cfg("not-a-number");
        when(repo.findByConfigKey("bad")).thenReturn(Optional.of(bad));
        assertEquals(7, service.getInt("bad", 7));
        assertEquals(1.5, service.getDouble("bad", 1.5));
    }
}
