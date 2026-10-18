package com.ecotrack.auth;

import com.ecotrack.auth.dto.AuthResponse;
import com.ecotrack.auth.dto.LoginRequest;
import com.ecotrack.auth.dto.RegisterRequest;
import com.ecotrack.config.AppProperties;
import com.ecotrack.exception.BadRequestException;
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
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

/**
 * Registration, login, refresh-token rotation and logout. Access tokens are JWTs;
 * refresh tokens are opaque random strings stored only as SHA-256 hashes and
 * rotated on every use.
 */
@Service
public class AuthService {

    /**
     * How long a rotated refresh token is still honoured. A refresh whose
     * response never reaches the browser (page reload mid-request, a second tab
     * refreshing with the same token, a dropped mobile connection) would
     * otherwise leave the client holding a dead token and sign the user out.
     * Only rotation opens this window; a logged-out token never comes back.
     */
    static final Duration ROTATION_GRACE = Duration.ofSeconds(30);

    private final UserRepository users;
    private final RefreshTokenRepository refreshTokens;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final com.ecotrack.credit.CreditService creditService;
    private final GoogleTokenVerifier googleVerifier;
    private final long refreshTtlSeconds;

    public AuthService(UserRepository users, RefreshTokenRepository refreshTokens,
                       PasswordEncoder passwordEncoder, JwtService jwtService,
                       com.ecotrack.credit.CreditService creditService,
                       GoogleTokenVerifier googleVerifier, AppProperties props) {
        this.users = users;
        this.refreshTokens = refreshTokens;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.creditService = creditService;
        this.googleVerifier = googleVerifier;
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

    /**
     * Log in (or transparently sign up) using a Google Identity Services ID token.
     * The token is verified against Google's keys; the user is matched by email and
     * created on first sight. Email/password accounts and Google accounts that share
     * an email are the same user.
     */
    @Transactional
    public AuthResponse loginWithGoogle(String idToken, HttpServletRequest http) {
        if (!googleVerifier.isConfigured()) {
            throw new BadRequestException("Google login is not enabled on this server");
        }
        com.google.api.client.googleapis.auth.oauth2.GoogleIdToken.Payload payload =
                googleVerifier.verify(idToken);
        if (payload == null) {
            throw new BadCredentialsException("Invalid Google ID token");
        }
        String email = payload.getEmail();
        Boolean emailVerified = payload.getEmailVerified();
        if (email == null || Boolean.FALSE.equals(emailVerified)) {
            throw new BadCredentialsException("Google account has no verified email");
        }
        String name = (String) payload.get("name");

        User user = users.findByEmailIgnoreCaseAndDeletedAtIsNull(email).orElse(null);
        if (user == null) {
            user = new User();
            user.setEmail(email.trim());
            // Google users authenticate via Google; store a random unusable password.
            user.setPasswordHash(passwordEncoder.encode(UUID.randomUUID().toString()));
            user.setDisplayName(name != null ? name : email);
            user.setRole(Role.USER);
            user.setEmailVerified(true);
            users.save(user);
            creditService.onSignup(user.getId());
        }
        user.setLastLoginAt(Instant.now());
        return issueTokens(user, http);
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken, HttpServletRequest http) {
        String hash = sha256(rawRefreshToken);
        RefreshToken token = refreshTokens.findByTokenHash(hash)
                .orElseThrow(() -> new BadCredentialsException("Invalid refresh token"));
        Instant now = Instant.now();
        if (!token.getExpiresAt().isAfter(now)) {
            throw new BadCredentialsException("Refresh token expired or revoked");
        }
        if (token.getRevokedAt() != null && !(rotatedWithinGrace(token, now) && sessionStillOpen(token))) {
            throw new BadCredentialsException("Refresh token expired or revoked");
        }
        User user = users.findByIdAndDeletedAtIsNull(token.getUserId())
                .orElseThrow(() -> new BadCredentialsException("Account no longer active"));

        return issueTokens(user, http, token);
    }

    static boolean rotatedWithinGrace(RefreshToken token, Instant now) {
        return token.getReplacedBy() != null
                && token.getRevokedAt().plus(ROTATION_GRACE).isAfter(now);
    }

    /**
     * Follows the rotation chain from a rotated token to the newest one. The
     * session is open only while that newest token is unrevoked: once it is
     * logged out, the grace window can't revive the session through an older
     * token (a stale tab, or a copy taken before sign-out).
     */
    private boolean sessionStillOpen(RefreshToken token) {
        RefreshToken current = token;
        for (int hops = 0; hops < 20 && current.getReplacedBy() != null; hops++) {
            Optional<RefreshToken> next = refreshTokens.findById(current.getReplacedBy());
            if (next.isEmpty()) return false;
            current = next.get();
        }
        return current.getReplacedBy() == null && current.getRevokedAt() == null;
    }

    @Transactional
    public void logout(String rawRefreshToken) {
        refreshTokens.findByTokenHash(sha256(rawRefreshToken)).ifPresent(t -> {
            if (t.getRevokedAt() == null) t.setRevokedAt(Instant.now());
        });
    }

    private AuthResponse issueTokens(User user, HttpServletRequest http) {
        return issueTokens(user, http, null);
    }

    /** @param rotatedFrom the refresh token being exchanged, revoked here and linked to its successor */
    private AuthResponse issueTokens(User user, HttpServletRequest http, RefreshToken rotatedFrom) {
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
        if (rotatedFrom != null && rotatedFrom.getRevokedAt() == null) {
            rotatedFrom.setRevokedAt(Instant.now());       // rotate
            rotatedFrom.setReplacedBy(rt.getId());
        }

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
