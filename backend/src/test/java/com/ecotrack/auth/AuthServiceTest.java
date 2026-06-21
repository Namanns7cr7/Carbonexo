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
}
