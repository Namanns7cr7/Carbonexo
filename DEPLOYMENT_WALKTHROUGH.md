# Deployment Walkthrough — Carbonexo on Google Cloud (a learning guide)

This explains, end to end, **how this app was deployed to Google Cloud**, what each
piece does, and — importantly — **every problem we hit and how we fixed it**. Read
it top to bottom and you'll understand the whole flow, not just the commands.

---

## 1. The target architecture

```
Browser
  │
  ▼
Cloud Run: carbonexo-web     (Next.js frontend, Node server)
  │  calls https://…  (CORS)
  ▼
Cloud Run: carbonexo-backend (Spring Boot API, Java 17)
  │  JDBC over Cloud SQL socket factory
  ▼
Cloud SQL: carbonexo-db      (PostgreSQL 16)

Supporting GCP services:
- Artifact Registry  → stores the two container images
- Secret Manager     → JWT_SECRET, DB_PASSWORD (never in code/env files)
- Cloud Build        → builds the backend image (and originally the frontend)
- Vertex AI (Gemini) → optional AI (we run AI_PROVIDER=canned by default)
```

Why this shape:
- **Cloud Run** runs containers and scales to zero (cheap; ~free when idle).
- **Cloud SQL** is managed Postgres (the one always-on cost, ~$8–10/mo on db-f1-micro).
- **Secret Manager** keeps secrets out of the image and out of git.
- Two separate Cloud Run services (web + backend) = one platform, one logs view.

---

## 2. Prerequisites

- `gcloud` CLI installed and logged in: `gcloud auth login`
- A **billing-enabled** GCP project (ours: `carbonexo`)
- Docker Desktop running (for the frontend local build) + Node/npm + JDK 17/Maven (local)

---

## 3. The deploy order (and why order matters)

1. **Enable APIs** (run, cloudbuild, sqladmin, secretmanager, artifactregistry, aiplatform).
2. **Artifact Registry** repo — somewhere to push images.
3. **Cloud SQL** instance + database + app user — slow (~10 min); everything else needs it.
4. **Secret Manager** — create `JWT_SECRET` and `DB_PASSWORD`.
5. **IAM** — grant the Cloud Run runtime service account: `cloudsql.client`,
   `secretmanager.secretAccessor`, `aiplatform.user`.
6. **Backend**: build image → deploy to Cloud Run (Flyway runs migrations on boot).
7. **Frontend**: build with the backend URL baked in → deploy.
8. **CORS**: point the backend's `CORS_ALLOWED_ORIGINS` at the frontend URL.

The backend must exist before the frontend (the frontend bakes the backend URL at
build time). CORS is wired last because it needs the final frontend URL.

The backend half is automated in [`deploy/deploy.ps1`](deploy/deploy.ps1). The
frontend is deployed with [`deploy/deploy-frontend-local.ps1`](deploy/deploy-frontend-local.ps1)
(see §5 for why it's separate).

---

## 4. Key concepts you should understand

### Cloud Run + Cloud SQL connection
The backend reaches Cloud SQL using the **Cloud SQL socket factory** (a Java library,
`postgres-socket-factory`). The JDBC URL looks like:
```
jdbc:postgresql:///ecotrack?cloudSqlInstance=carbonexo:asia-south1:carbonexo-db&socketFactory=com.google.cloud.sql.postgres.SocketFactory
```
Plus `--add-cloudsql-instances=<connectionName>` on the deploy, and the runtime SA
needs the `cloudsql.client` role. The factory authenticates via the service account,
then Postgres authenticates with `DB_USER`/`DB_PASSWORD`.

### Secrets vs env vars
- Plain config (DB_URL, CORS, etc.) → `--env-vars-file` (a YAML file).
- Real secrets (JWT_SECRET, DB_PASSWORD) → `--set-secrets` referencing Secret Manager,
  so the values never appear in the service config or logs.

### NEXT_PUBLIC_* are build-time
Anything `NEXT_PUBLIC_*` in Next.js is **inlined into the JS at build time**, not read
at runtime. So the frontend image must be **built with** `NEXT_PUBLIC_API_BASE_URL`
(the backend URL) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID`. Change the backend URL → you
must rebuild the frontend.

### Cloud Run gives two URL forms
A service is reachable at both:
```
https://carbonexo-web-yigbd35s3q-el.a.run.app        (newer hash form, the "official" status.url)
https://carbonexo-web-95267034623.asia-south1.run.app (project-number form)
```
Both work, so CORS and Google OAuth origins must allow **both**.

---

## 5. The big gotcha: deploy the frontend LOCALLY

**Symptom:** the frontend built by **Cloud Build** crashed at runtime in the browser
with `Error: useCarbon must be used within CarbonexoProvider` and `Minified React
error #423` (a hydration failure) — on every page.

**Diagnosis:** the *same code* built **locally** (Windows/Node 22) worked perfectly,
but built in the **Cloud Build container (Linux/Alpine, Node 20)** it produced a
broken client bundle — the SWC compiler chunked the React context such that the
provider and the `useCarbon` consumer ended up with different context instances.
We confirmed this by loading the live URL in a headless browser and capturing the
console (see §7), and by comparing chunk hashes between the local and container builds.

**Fix:** build the frontend **locally** (known-good bundle) and ship those artifacts:
1. `npm run build` locally with `output: 'standalone'` (set in `next.config.mjs`).
2. Copy `.next/static` and `public` into `.next/standalone/`.
3. Add a tiny `Dockerfile` (just `node:22-slim` + `CMD node server.js`).
4. `docker build` locally → `docker push` to Artifact Registry → `gcloud run deploy`.

This is exactly what [`deploy/deploy-frontend-local.ps1`](deploy/deploy-frontend-local.ps1)
does. **Do not redeploy the frontend via Cloud Build** — it reintroduces the bug.
(The backend is fine via Cloud Build.)

---

## 6. Problems we hit, and the fix for each (the real learning)

| Problem | Root cause | Fix |
|---|---|---|
| Script wouldn't parse | em-dashes / apostrophes in a `.ps1`; PowerShell 5.1 mis-read non-ASCII | keep deploy scripts ASCII-only |
| Script aborted on first `gcloud describe` | `$ErrorActionPreference='Stop'` treats a native command's stderr as fatal (PS 5.1) | use `'Continue'` + check `$LASTEXITCODE` / `throw` explicitly |
| Backend crash: "key is 24 bits" | JWT secret generated with `RandomNumberGenerator.GetBytes` — not available in PS 5.1, so it was empty | generate the secret with `Get-Random` (48 chars) |
| Backend: "password authentication failed" | secret stored via `Write-Output \| gcloud` got a **trailing newline** | write the secret to a temp file with `[IO.File]::WriteAllText` (no newline) |
| Backend: "Connection to :5432 refused" | `&socketFactory=…` was stripped passing the URL through `--set-env-vars` (the `&`), and `$DB_NAME?cloudSqlInstance` mis-parsed (`?` is a valid PS var char) | pass env via `--env-vars-file` (YAML); wrap vars as `${DB_NAME}` |
| `gcloud … --data-file=$tmp.FullName` failed | PowerShell didn't evaluate `.FullName` in a bare argument | use a string path (`[IO.Path]::GetTempFileName()`) |
| Frontend runtime crash (`useCarbon` / #423) | Cloud Build (Linux/Alpine) produced a broken bundle | build locally, ship artifacts (§5) |
| Google login: `Error 400: origin_mismatch` | live URL not in the OAuth client's **Authorized JavaScript origins** | add both Cloud Run URLs there (Console) |
| Crash "came back" after a fix | a Cloud Build redeploy (revision 00004/00005) overwrote the good revision | redeploy frontend locally; if needed, route traffic to the good revision |

---

## 7. How to TEST the deployed site (don't trust "it deployed")

A green deploy doesn't mean the app works in the browser. We loaded the live URL in a
headless browser and captured the console — that's how we caught the runtime crash
that the deploy logs didn't show:

```powershell
# .shots/console-check.mjs loads pages and prints console errors + page errors
node .shots\console-check.mjs https://carbonexo-web-yigbd35s3q-el.a.run.app
```
"OK - no errors" on `/`, `/login`, `/app`, `/onboarding` = the bundle is healthy.

---

## 8. How to redeploy (day to day)

```powershell
# Backend (code change in backend/): Cloud Build is fine
.\deploy\deploy.ps1            # full stack; safe to re-run, skips existing resources

# Frontend (code change in app/, components/, lib/): LOCAL build only
.\deploy\deploy-frontend-local.ps1
```

If a bad frontend revision is serving, route traffic to a known-good one without
rebuilding:
```powershell
gcloud run services update-traffic carbonexo-web --region=asia-south1 `
  --to-revisions=carbonexo-web-00006-hw7=100
```

---

## 9. After deploy: the one manual step

Add the live frontend URLs to the OAuth client's **Authorized JavaScript origins**
(Google Cloud Console → APIs & Services → Credentials → your Web client):
```
https://carbonexo-web-yigbd35s3q-el.a.run.app
https://carbonexo-web-95267034623.asia-south1.run.app
```
This is required for "Continue with Google" (email/password works without it).

---

## 10. Costs & teardown

- Cloud Run: scales to zero, ~free for light use.
- Cloud SQL `db-f1-micro`: ~$8–10/month (does not scale to zero).
- Tear everything down:
  ```powershell
  gcloud run services delete carbonexo-web carbonexo-backend --region=asia-south1 --quiet
  gcloud sql instances delete carbonexo-db --quiet
  ```

---

## 11. Live URLs (current)

- Frontend: https://carbonexo-web-yigbd35s3q-el.a.run.app
- Backend:  https://carbonexo-backend-95267034623.asia-south1.run.app
- Swagger:  https://carbonexo-backend-95267034623.asia-south1.run.app/swagger-ui.html
