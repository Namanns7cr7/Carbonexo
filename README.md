# Carbonexo / EcoTrack

A mobile-first carbon-footprint tracking PWA: log daily activities, upload electricity
bills (OCR), earn green credits, redeem rewards, and get AI sustainability coaching.

- **Frontend:** Next.js 14 (App Router) · TypeScript · Tailwind · Framer Motion
- **Backend:** Java 17 · Spring Boot 3.3 · Spring Security (JWT) · Flyway
- **Database:** PostgreSQL 16 (via Docker)
- **Auth:** email/password **and** Sign in with Google
- **AI:** Google Gemini (with a built-in `canned` fallback that needs no cloud creds)

---

## Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Docker Desktop | any recent | runs PostgreSQL |
| JDK | 17 | e.g. Eclipse Temurin 17 |
| Maven | 3.9+ | to build the backend |
| Node.js | 18+ | runs the frontend |

> On this machine these are already installed: JDK 17 at `C:\Program Files\Eclipse Adoptium\jdk-17.0.19.10-hotspot`,
> Maven at `C:\Tools\apache-maven-3.9.9`, and both are on the user `PATH`.

---

## One-time setup

```powershell
# 1. Frontend dependencies
cd "d:\4 year\Carbonexo"
npm install

# 2. Build the backend (creates target\ecotrack-backend-0.1.0.jar)
cd "d:\4 year\Carbonexo\backend"
mvn -DskipTests clean package
```

Environment is configured in **`.env.local`** (frontend) and via env vars (backend).
`.env.local` already contains the API base URL and the Google client ID.

---

## Run the project (3 terminals)

**Terminal 1 — Database (PostgreSQL in Docker):**
```powershell
docker compose -f "d:\4 year\Carbonexo\database\docker-compose.yml" up -d
```

**Terminal 2 — Backend (Spring Boot):**
```powershell
cd "d:\4 year\Carbonexo\backend"
$env:AI_PROVIDER="canned"
$env:GOOGLE_CLIENT_ID="95267034623-do8ogieusjpgl080q5kohfqethjgraha.apps.googleusercontent.com"
java -jar target\ecotrack-backend-0.1.0.jar
```
Flyway auto-creates/updates the schema on boot. Wait for `Started EcotrackApplication`.

**Terminal 3 — Frontend (Next.js):**
```powershell
cd "d:\4 year\Carbonexo"
npm run dev
```

Then open **http://localhost:3000**.

> **Order matters:** start Postgres before the backend (the backend connects on boot).

---

## URLs & demo login

| What | URL / value |
|---|---|
| App | http://localhost:3000 |
| Demo login | `yash@ecotrack.dev` / `password` |
| Google login | "Continue with Google" button on `/login` |
| API docs (Swagger) | http://localhost:8080/swagger-ui.html |
| Health | http://localhost:8080/actuator/health |

---

## Sign in with Google

Requires a Google OAuth **Web** client ID (Google Cloud Console → APIs & Services → Credentials)
with **`http://localhost:3000`** as an Authorized JavaScript origin (exact: `http`, no trailing slash).

The same client ID must be set in **both** places:
- Backend: `GOOGLE_CLIENT_ID` env var (used to validate the token's audience)
- Frontend: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in `.env.local`

First-time Google sign-in auto-creates the account (verified email + welcome credits) and
reuses the normal JWT/refresh session.

---

## Stop

```powershell
# Backend / Frontend: Ctrl+C in their terminals.
# Database:
docker compose -f "d:\4 year\Carbonexo\database\docker-compose.yml" down       # keep data
docker compose -f "d:\4 year\Carbonexo\database\docker-compose.yml" down -v    # wipe all data
```

---

## Common tasks

**Reload demo/seed data** (after a `down -v` reset, or to reset the demo user):
```powershell
Get-Content "d:\4 year\Carbonexo\database\seed.sql" | docker exec -i ecotrack-postgres psql -U ecotrack -d ecotrack
```

**Rebuild after backend code changes** (stop the running backend first so the jar isn't locked):
```powershell
cd "d:\4 year\Carbonexo\backend"
mvn -DskipTests clean package
```

**Inspect the database directly:**
```powershell
docker exec -it ecotrack-postgres psql -U ecotrack -d ecotrack
# \dt  list tables   ·   SELECT * FROM users;   ·   \q  quit
```

---

## Where the data lives

All application data is stored in **PostgreSQL**, running in the `ecotrack-postgres` Docker
container and persisted to the Docker volume **`database_ecotrack_pgdata`** (survives restarts).

The browser only holds the refresh token (`cx-refresh`) and a UI cache (`cx-state`) in
`localStorage`; the short-lived access token lives in memory. No account/footprint data is
stored in the browser.

This is a **local dev database** (`localhost:5432`, user/pass `ecotrack`/`ecotrack`) — not in
any cloud and not backed up. To use a managed/cloud Postgres, override `DB_URL`, `DB_USER`,
`DB_PASSWORD` env vars when starting the backend.

---

## Configuration reference (backend env vars)

| Var | Default | Purpose |
|---|---|---|
| `DB_URL` | `jdbc:postgresql://localhost:5432/ecotrack` | database connection |
| `DB_USER` / `DB_PASSWORD` | `ecotrack` / `ecotrack` | database credentials |
| `GOOGLE_CLIENT_ID` | _(empty)_ | enables Sign in with Google |
| `AI_PROVIDER` | `gemini` | `gemini` (needs GCP creds) or `canned` (no creds) |
| `JWT_SECRET` | dev default | **change for any non-local use** |
| `SERVER_PORT` | `8080` | backend port |

---

## Troubleshooting

- **Backend won't connect to DB** → make sure the Postgres container is up and healthy:
  `docker ps` (look for `ecotrack-postgres ... healthy`).
- **Google button errors "origin is not allowed"** → the Authorized JavaScript origin in
  Google Console must be exactly `http://localhost:3000`. Changes can take a few minutes.
- **Google sign-in blocked** → if the OAuth consent screen is in "Testing", add your Google
  email under Audience → Test users.
- **`mvn package` fails to rename the jar** → a backend instance is still running and holding
  the file; stop it first.
- **Port already in use (8080 / 3000)** → an old instance is still running; stop it, then retry.
