package com.ecotrack.auth;

import com.ecotrack.config.AppProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/** Issues and validates short-lived access JWTs (HS256). */
@Service
public class JwtService {

    private final SecretKey key;
    private final long accessTtlSeconds;
    private final String issuer;

    /** The placeholder from application.yml; it is public on GitHub, so tokens signed with it can be forged. */
    static final String DEV_DEFAULT_SECRET = "change-me-dev-only-secret-change-me-dev-only-secret";

    public JwtService(AppProperties props) {
        AppProperties.Security.Jwt jwt = props.security().jwt();
        // Cloud Run sets K_SERVICE; refuse to boot there without a real JWT_SECRET.
        if (DEV_DEFAULT_SECRET.equals(jwt.secret()) && System.getenv("K_SERVICE") != null) {
            throw new IllegalStateException("JWT_SECRET is unset: refusing to start with the public dev default");
        }
        this.key = Keys.hmacShaKeyFor(jwt.secret().getBytes(StandardCharsets.UTF_8));
        this.accessTtlSeconds = jwt.accessTokenTtlSeconds();
        this.issuer = jwt.issuer();
    }

    public String generateAccessToken(UUID userId, String email, String role) {
        Instant now = Instant.now();
        return Jwts.builder()
                .issuer(issuer)
                .subject(userId.toString())
                .claim("email", email)
                .claim("role", role)
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(accessTtlSeconds)))
                .signWith(key)
                .compact();
    }

    /** @return parsed claims, or null if the token is invalid/expired. */
    public Claims parse(String token) {
        try {
            return Jwts.parser()
                    .verifyWith(key)
                    .requireIssuer(issuer)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
        } catch (Exception e) {
            return null;
        }
    }

    public long getAccessTtlSeconds() {
        return accessTtlSeconds;
    }
}
