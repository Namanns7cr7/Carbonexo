package com.ecotrack.auth;

import com.ecotrack.auth.dto.LoginRequest;
import com.ecotrack.auth.dto.RegisterRequest;
import com.ecotrack.config.AppProperties;
import com.ecotrack.credit.CreditService;
import com.ecotrack.exception.ConflictException;
import com.ecotrack.user.Role;
import com.ecotrack.user.User;
import com.ecotrack.user.UserRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthServiceTest {

    private UserRepository userRepository;
    private RefreshTokenRepository refreshTokenRepository;
    private PasswordEncoder passwordEncoder;
    private JwtService jwtService;
    private CreditService creditService;
    private GoogleTokenVerifier googleVerifier;
    private AuthService authService;

    @BeforeEach
    void setUp() {
        userRepository = mock(UserRepository.class);
        refreshTokenRepository = mock(RefreshTokenRepository.class);
        passwordEncoder = mock(PasswordEncoder.class);
        jwtService = mock(JwtService.class);
        creditService = mock(CreditService.class);
        googleVerifier = mock(GoogleTokenVerifier.class);

        var jwt = new AppProperties.Security.Jwt("0123456789012345678901234567890123456789", 900, 1209600, "ecotrack");
        var props = new AppProperties(null, new AppProperties.Security(jwt, null), null, null, null, null, null);

        authService = new AuthService(
                userRepository,
                refreshTokenRepository,
                passwordEncoder,
                jwtService,
                creditService,
                googleVerifier,
                props
        );
    }

    @Test
    void registerThrowsConflictWhenEmailExists() {
        when(userRepository.existsByEmailIgnoreCaseAndDeletedAtIsNull("test@example.com")).thenReturn(true);
        RegisterRequest req = new RegisterRequest("test@example.com", "password", "Name");

        assertThrows(ConflictException.class, () -> authService.register(req, null));
    }

    @Test
    void registerSavesUserAndAwardCredits() {
        when(userRepository.existsByEmailIgnoreCaseAndDeletedAtIsNull(anyString())).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed_pass");
        when(jwtService.generateAccessToken(any(), anyString(), anyString())).thenReturn("access_tok");

        RegisterRequest req = new RegisterRequest("new@example.com", "password", "New User");
        var resp = authService.register(req, mock(HttpServletRequest.class));

        assertNotNull(resp);
        assertEquals("new@example.com", resp.user().email());
        verify(userRepository).save(any(User.class));
        verify(creditService).onSignup(any());
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void loginThrowsBadCredentialsOnUserNotFound() {
        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull(anyString())).thenReturn(Optional.empty());
        LoginRequest req = new LoginRequest("missing@example.com", "password");

        assertThrows(BadCredentialsException.class, () -> authService.login(req, null));
    }

    @Test
    void loginThrowsBadCredentialsOnPasswordMismatch() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hashed");

        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("wrong_pass", "hashed")).thenReturn(false);

        LoginRequest req = new LoginRequest("user@example.com", "wrong_pass");

        assertThrows(BadCredentialsException.class, () -> authService.login(req, null));
    }

    @Test
    void loginSucceedsWithValidCredentials() {
        User user = new User();
        user.setEmail("user@example.com");
        user.setPasswordHash("hashed");
        user.setRole(Role.USER);

        when(userRepository.findByEmailIgnoreCaseAndDeletedAtIsNull("user@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("correct", "hashed")).thenReturn(true);
        when(jwtService.generateAccessToken(any(), anyString(), anyString())).thenReturn("access_tok");

        LoginRequest req = new LoginRequest("user@example.com", "correct");
        var resp = authService.login(req, null);

        assertNotNull(resp);
        assertEquals("user@example.com", resp.user().email());
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    // --- refresh-token rotation ---

    private RefreshToken storedToken(UUID userId, Instant revokedAt, UUID replacedBy) {
        RefreshToken t = new RefreshToken();
        t.setUserId(userId);
        t.setTokenHash("hash");
        t.setExpiresAt(Instant.now().plusSeconds(3600));
        t.setRevokedAt(revokedAt);
        t.setReplacedBy(replacedBy);
        return t;
    }

    private UUID activeUser() {
        UUID userId = UUID.randomUUID();
        User user = new User();
        user.setId(userId);
        user.setEmail("user@example.com");
        user.setRole(Role.USER);
        when(userRepository.findByIdAndDeletedAtIsNull(userId)).thenReturn(Optional.of(user));
        when(jwtService.generateAccessToken(any(), anyString(), anyString())).thenReturn("access_tok");
        return userId;
    }

    @Test
    void refreshRotatesAnActiveToken() {
        RefreshToken old = storedToken(activeUser(), null, null);
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(old));
        when(refreshTokenRepository.save(any(RefreshToken.class))).thenAnswer(inv -> inv.getArgument(0));

        var resp = authService.refresh("raw", null);

        assertNotNull(resp.refreshToken());
        assertNotNull(old.getRevokedAt(), "the used token is revoked");
    }

    @Test
    void refreshHonoursATokenRotatedWithinTheGraceWindow() {
        // The browser lost the response to the first refresh and retries with the same token.
        Instant rotatedAt = Instant.now().minusSeconds(5);
        RefreshToken old = storedToken(activeUser(), rotatedAt, UUID.randomUUID());
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(old));

        var resp = authService.refresh("raw", null);

        assertNotNull(resp.refreshToken());
        assertEquals(rotatedAt, old.getRevokedAt(), "the original rotation is left as it was");
    }

    @Test
    void refreshRejectsATokenRotatedLongerAgoThanTheGraceWindow() {
        Instant rotatedAt = Instant.now().minus(AuthService.ROTATION_GRACE).minusSeconds(1);
        RefreshToken old = storedToken(UUID.randomUUID(), rotatedAt, UUID.randomUUID());
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(old));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("raw", null));
    }

    @Test
    void refreshRejectsALoggedOutTokenEvenWithinTheGraceWindow() {
        RefreshToken old = storedToken(UUID.randomUUID(), Instant.now(), null); // logout: no successor
        when(refreshTokenRepository.findByTokenHash(anyString())).thenReturn(Optional.of(old));

        assertThrows(BadCredentialsException.class, () -> authService.refresh("raw", null));
    }
}
