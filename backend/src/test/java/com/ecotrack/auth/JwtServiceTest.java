package com.ecotrack.auth;

import com.ecotrack.config.AppProperties;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.Test;

import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

class JwtServiceTest {

    private static final String SECRET = "0123456789012345678901234567890123456789"; // >= 256 bits

    private JwtService service(String secret) {
        var jwt = new AppProperties.Security.Jwt(secret, 900, 1209600, "ecotrack");
        var props = new AppProperties(null, new AppProperties.Security(jwt, null),
                null, null, null, null, null);
        return new JwtService(props);
    }

    @Test
    void generatesAndParsesAValidToken() {
        JwtService svc = service(SECRET);
        UUID id = UUID.randomUUID();

        String token = svc.generateAccessToken(id, "user@example.com", "USER");
        Claims claims = svc.parse(token);

        assertNotNull(claims);
        assertEquals(id.toString(), claims.getSubject());
        assertEquals("user@example.com", claims.get("email"));
        assertEquals("USER", claims.get("role"));
    }

    @Test
    void rejectsATamperedToken() {
        JwtService svc = service(SECRET);
        String token = svc.generateAccessToken(UUID.randomUUID(), "user@example.com", "USER");

        assertNull(svc.parse(token + "tampered"));
    }

    @Test
    void rejectsATokenSignedWithADifferentSecret() {
        JwtService signer = service("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        JwtService verifier = service("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

        String token = signer.generateAccessToken(UUID.randomUUID(), "user@example.com", "USER");

        assertNull(verifier.parse(token));
    }
}
