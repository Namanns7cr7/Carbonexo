package com.ecotrack.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

/** Helpers for reading the current authenticated principal (a user id UUID). */
public final class SecurityUtils {

    private SecurityUtils() {}

    /** @return the authenticated user's id, or {@code null} if anonymous/system. */
    public static UUID currentUserIdOrNull() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) return null;
        Object principal = auth.getPrincipal();
        if (principal instanceof UserPrincipal up) return up.id();
        if (principal instanceof String s) {
            try { return UUID.fromString(s); } catch (IllegalArgumentException ignored) { return null; }
        }
        return null;
    }

    /** @return the authenticated user's id, throwing if there is none. */
    public static UUID requireCurrentUserId() {
        UUID id = currentUserIdOrNull();
        if (id == null) throw new IllegalStateException("No authenticated user in context");
        return id;
    }

    /** Convenience alias for {@link #requireCurrentUserId()}. */
    public static UUID currentUserId() {
        return requireCurrentUserId();
    }
}
