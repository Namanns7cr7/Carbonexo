package com.ecotrack.auth;

import com.ecotrack.auth.dto.AuthResponse;
import com.ecotrack.auth.dto.LoginRequest;
import com.ecotrack.auth.dto.RegisterRequest;
import com.ecotrack.config.AppProperties;
import com.ecotrack.exception.ConflictException;
import com.ecotrack.user.Role;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Registration, login, refresh-token rotation and logout. Access tokens are JWTs;
 * refresh tokens are opaque random strings stored only as SHA-256 hashes and
 * rotated on every use.
 */
@Service
public class AuthService {

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final com.ecotrack.credit.CreditService creditService;
    private final long refreshTtlSeconds;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       com.ecotrack.credit.CreditService creditService, AppProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.creditService = creditService;
        this.refreshTtlSeconds = props.security().jwt().refreshTokenTtlSeconds();
    }

    @Transactional
    public AuthResponse register(RegisterRequest req, HttpServletRequest http) {
        if (users.existsByEmailIgnoreCaseAndDeletedAtIsNull(req.email())) {
            throw new ConflictException("Email already registered");
        }
        User user = new User();
        user.setEmail(req.email().trim());
        user.setPasswordHash(passwordEncoder.encode(req.password()));
        user.setDisplayName(req.displayName());
        user.setRole(Role.USER);
        users.save(user);
        // Hook (Phase 8): award signup-bonus credits via CreditService here.
        creditService.onSignup(user.getId());
        return issueTokens(user, http);
    }

    @Transactional
    public AuthResponse login(LoginRequest req, HttpServletRequest http) {
        User user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(req.email())
                .orElseThrow(() -> new BadCredentialsException("Invalid email or password"));
        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            throw new BadCredentialsException("Invalid email or password");
        }
        user.setLastLoginAt(Instant.now());
        return issueTokens(user, http);
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken, HttpServletRequest http) {
        String hash = sha256(rawRefreshToken);
        RefreshToken token = refreshTokens.findByTokenHash(hash)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));
        if (!token.isActive()) {
            throw new BadCredentialsException("Refresh token expired or revoked");
        }
        User user = users.findByIdAndDeletedAtIsNull(token.getUserId())
                .orElseThrow(() -> new BadCredentialsException("Account no longer active"));

        token.setRevokedAt(Instant.now());                 // rotate
        AuthResponse response = issueTokens(user, http);
        return response;
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.findByTokenHash(sha256(rawRefreshToken)).ifPresent(t -> {
            if (t.getRevokedAt() == null) t.setRevokedAt(Instant.now());
        });
    }

    private AuthResponse issueTokens(User user, HttpServletRequest http) {
        String access = jwtService.generateAccessToken(
                user.getId(), user.getEmail(), user.getRole().name());

        String rawRefresh = UUID.randomUUID() + "." + UUID.randomUUID();
        RefreshToken rt = new RefreshToken();
        rt.setUserId(user.getId());
        rt.setTokenHash(sha256(rawRefresh));
        rt.setExpiresAt(Instant.now().plusSeconds(refreshTtlSeconds));
        if (http != null) {
            rt.setUserAgent(truncate(http.getHeader("User-Agent"), 400));
            rt.setIpAddress(http.getRemoteAddr());
        }
        refreshTokens.save(rt);

        return new AuthResponse(access, rawRefresh, jwtService.getAccessTtlSeconds(),
                new AuthResponse.UserSummary(user.getId(), user.getEmail(),
                        user.getDisplayName(), user.getRole().name()));
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) return null;
        return s.length() <= max ? s : s.substring(0, max);
    }
}
