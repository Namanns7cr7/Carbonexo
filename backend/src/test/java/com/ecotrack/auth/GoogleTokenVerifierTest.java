package com.ecotrack.auth;

import com.ecotrack.config.AppProperties;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class GoogleTokenVerifierTest {

    private GoogleTokenVerifier verifier(String clientId) {
        var jwt = new AppProperties.Security.Jwt(
                "0123456789012345678901234567890123456789", 900, 1209600, "ecotrack");
        var props = new AppProperties(null,
                new AppProperties.Security(jwt, new AppProperties.Security.Google(clientId)),
                null, null, null, null, null);
        return new GoogleTokenVerifier(props);
    }

    @Test
    void notConfiguredWhenClientIdMissing() {
        assertFalse(verifier(null).isConfigured());
        assertFalse(verifier("").isConfigured());
        assertFalse(verifier("   ").isConfigured());
    }

    @Test
    void configuredWhenClientIdPresent() {
        assertTrue(verifier("abc123.apps.googleusercontent.com").isConfigured());
    }

    @Test
    void verifyThrowsWhenNotConfigured() {
        assertThrows(IllegalStateException.class, () -> verifier(null).verify("any-token"));
    }

    @Test
    void verifyReturnsNullForAGarbageTokenWhenConfigured() {
        // configured but the token is not a real Google ID token -> null (a clean 401), not a crash
        assertNull(verifier("abc123.apps.googleusercontent.com").verify("not.a.real.token"));
    }
}
