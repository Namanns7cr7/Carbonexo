# Security Guide — Carbonexo / EcoTrack

## Authentication Flow

```
1. POST /api/auth/register or /api/auth/login
   → Server returns: accessToken (JWT, 15 min) + refreshToken (opaque, 14 days)

2. Client stores:
   - accessToken in memory (never localStorage)
   - refreshToken in localStorage (for persistence)

3. Every API call:
   - Authorization: Bearer <accessToken>

4. On 401:
   - Client calls POST /api/auth/refresh { refreshToken }
   - Server rotates: old token revoked, new pair issued
   - Retry original request

5. Logout:
   - POST /api/auth/logout { refreshToken }
   - Server revokes token, client clears storage
```

## JWT Details

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| Secret | >= 256 bits (from `JWT_SECRET` env var) |
| Access token TTL | 15 minutes (configurable) |
| Refresh token TTL | 14 days (configurable) |
| Issuer | `ecotrack` |
| Claims | `sub` (userId), `email`, `role` |

## Password Security

- **BCrypt** with default strength (10 rounds)
- Passwords never stored in plaintext
- Refresh tokens stored as **SHA-256 hashes** only

## CORS

- Allowed origins configured via `CORS_ALLOWED_ORIGINS` env var
- Credentials allowed (for cookies/auth headers)
- Max age: 3600 seconds

## Public Endpoints (No Auth Required)

```
/api/auth/**
/v3/api-docs/**
/swagger-ui/**
/actuator/health/**
/actuator/info
/actuator/prometheus
```

All other endpoints require valid JWT.

## Security Best Practices

1. **Never commit secrets** — Use environment variables or Google Secret Manager
2. **Rotate JWT secret** regularly in production
3. **HTTPS only** in production
4. **Rate limiting** — Implement at API gateway level
5. **Input validation** — All DTOs use `@Valid` + Jakarta Bean Validation
6. **SQL injection** — Prevented by JPA parameterized queries
7. **File upload** — Magic-bytes validation prevents content-type spoofing
8. **CSRF** — Disabled (stateless JWT, no cookies for auth)
9. **Stack traces** — Never exposed to clients (RFC 7807 error format)

## File Upload Security

- Content-type whitelist: PDF, PNG, JPEG only
- File size limit: 10 MB (configurable)
- Magic-bytes validation (prevents spoofed content types)
- SHA-256 hashing for integrity/deduplication
- No local file storage — all files go to Google Cloud Storage
