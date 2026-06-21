package com.ecotrack.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();
    private HttpServletRequest req;

    @BeforeEach
    void setUp() {
        req = mock(HttpServletRequest.class);
        when(req.getRequestURI()).thenReturn("/api/test");
        when(req.getMethod()).thenReturn("GET");
    }

    @Test
    void apiExceptionMapsToItsStatusAndCarriesMetadata() {
        ProblemDetail pd = handler.handleApi(new BadRequestException("bad input"), req);

        assertEquals(HttpStatus.BAD_REQUEST.value(), pd.getStatus());
        assertEquals("bad input", pd.getDetail());
        assertEquals("/api/test", pd.getInstance().toString());
        assertNotNull(pd.getType());
        assertNotNull(pd.getProperties().get("timestamp"));
    }

    @Test
    void authenticationExceptionMapsTo401() {
        AuthenticationException ex = mock(AuthenticationException.class);
        ProblemDetail pd = handler.handleAuth(ex, req);
        assertEquals(HttpStatus.UNAUTHORIZED.value(), pd.getStatus());
    }

    @Test
    void accessDeniedMapsTo403() {
        ProblemDetail pd = handler.handleAccessDenied(new AccessDeniedException("nope"), req);
        assertEquals(HttpStatus.FORBIDDEN.value(), pd.getStatus());
    }

    @Test
    void illegalArgumentMapsTo400() {
        ProblemDetail pd = handler.handleIllegalArg(new IllegalArgumentException("bad arg"), req);
        assertEquals(HttpStatus.BAD_REQUEST.value(), pd.getStatus());
        assertEquals("bad arg", pd.getDetail());
    }

    @Test
    void unexpectedExceptionMapsTo500AndHidesInternals() {
        ProblemDetail pd = handler.handleUnexpected(new RuntimeException("db password leaked"), req);
        assertEquals(HttpStatus.INTERNAL_SERVER_ERROR.value(), pd.getStatus());
        assertEquals("An unexpected error occurred", pd.getDetail());
        assertFalse(pd.getDetail().contains("password"), "must not leak internal messages");
    }
}
