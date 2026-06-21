# API Documentation — Carbonexo / EcoTrack

Base URL: `http://localhost:8080`
Auth: Bearer JWT in `Authorization` header.

## Authentication

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | No | Register new user |
| POST | `/api/auth/login` | No | Login, get JWT |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/logout` | No | Revoke refresh token |

### POST /api/auth/register
```json
Request:  { "email": "user@example.com", "password": "securePass123", "displayName": "Yash" }
Response: { "accessToken": "...", "refreshToken": "...", "expiresIn": 900, "user": { "id": "uuid", "email": "...", "displayName": "...", "role": "USER" } }
```

## Profiles

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/profiles/me` | Yes | Get current user profile |
| PUT | `/api/profiles/me` | Yes | Update profile |
| POST | `/api/profiles/me/onboarding` | Yes | Mark onboarding complete |

## Activities

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/activities` | Yes | Log a new activity |
| GET | `/api/activities` | Yes | List activities (optional: ?from=&to=) |
| DELETE | `/api/activities/{id}` | Yes | Soft-delete an activity |

### POST /api/activities
```json
Request:  { "category": "travel", "factorKey": "car_ride", "label": "Car commute", "emoji": "🚗", "quantity": 13, "unit": "km", "co2Kg": 2.34, "note": "13 km", "activityDate": "2026-06-18" }
Response: { "id": "uuid", "category": "travel", ... }
```

## Dashboard

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/dashboard` | Yes | Aggregated dashboard data |
| GET | `/api/emission-factors` | Yes | List active emission factors |

## Bills (File Upload + OCR)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/bills/upload` | Yes | Upload bill (multipart/form-data) |
| GET | `/api/bills` | Yes | List user's bills |
| GET | `/api/bills/{id}` | Yes | Get bill details |
| PUT | `/api/bills/{id}/correct` | Yes | Manually correct OCR results |

### POST /api/bills/upload
```
Content-Type: multipart/form-data
Field: file (PDF, PNG, JPG, JPEG — max 10MB)
```

### PUT /api/bills/{id}/correct
```json
Request: { "billingMonth": "2026-06", "unitsConsumed": 245.5, "billAmount": 1850.00 }
```

## Credits

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/credits/balance` | Yes | Get credit balance |
| GET | `/api/credits/history` | Yes | Get credit history |

## Rewards

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/rewards` | Yes | List reward catalog |
| POST | `/api/rewards/{id}/redeem` | Yes | Redeem a reward |
| GET | `/api/rewards/redemptions` | Yes | List user's redemptions |

## AI

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/ai/recommendations` | Yes | Carbon reduction recommendations |
| POST | `/api/ai/electricity-analysis` | Yes | Electricity consumption analysis |
| POST | `/api/ai/transport-insights` | Yes | Transportation insights |
| GET | `/api/ai/daily-tip` | Yes | Personalized daily tip |
| POST | `/api/ai/monthly-report` | Yes | Monthly sustainability report |
| POST | `/api/ai/coach` | Yes | AI coach chat message |
| GET | `/api/ai/coach/history` | Yes | Get coach chat history |

## Observability

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/actuator/health` | No | Health check |
| GET | `/actuator/metrics` | No | Metrics |
| GET | `/actuator/prometheus` | No | Prometheus metrics |

## Error Format (RFC 7807)
```json
{ "type": "https://ecotrack.app/problems/bad-request", "status": 400, "detail": "Validation failed", "instance": "/api/auth/register", "timestamp": "2026-06-18T12:00:00Z", "errors": { "email": "must not be blank" } }
```
