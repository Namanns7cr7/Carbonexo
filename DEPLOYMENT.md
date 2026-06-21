# Deploying Carbonexo to Google Cloud

Architecture: **Cloud Run** (backend + frontend) + **Cloud SQL** (PostgreSQL 16) +
**Secret Manager** + optional **Vertex AI** (Gemini). The **backend** image is
built by **Cloud Build**. The **frontend** image **must be built locally** (you
need Docker Desktop running) — see the warning below.

> ⚠️ **The frontend must NOT be built via Cloud Build (Linux).** On Linux this
> app mis-compiles: pages are statically prerendered without the `<html>`/`<body>`
> document shell, and the browser crashes on hydration (React #418/#423, "Cannot
> have more than one Element child of a Document", "useCarbon must be used within
> CarbonexoProvider"). A **local build produces a correct bundle**. `deploy.ps1`
> already builds the frontend locally; to redeploy *only* the frontend, use
> [`deploy/deploy-frontend-local.ps1`](deploy/deploy-frontend-local.ps1).

```
Next.js (Cloud Run :3000)  ──►  Spring Boot (Cloud Run :8080)  ──►  Cloud SQL (Postgres 16)
                                        │
                                        ├─ Secret Manager: JWT_SECRET, DB_PASSWORD
                                        └─ Vertex AI (Gemini)  [optional]
```

## Prerequisites
- `gcloud` CLI installed and logged in: `gcloud auth login`
- A **billing-enabled** GCP project (note its **Project ID**)
- **Node + npm** and **Docker Desktop running** (the frontend is built locally)
- Run all commands from the **repo root**

## One-shot deploy
1. Open `deploy/deploy.ps1` and set `$PROJECT_ID` (top of the file). Region defaults to `asia-south1` (Mumbai).
2. From the repo root:
   ```powershell
   .\deploy\deploy.ps1
   ```
   The script will:
   - enable the required APIs
   - create an Artifact Registry repo
   - create the Cloud SQL instance + `ecotrack` database + app user (first run ~10 min)
   - create `JWT_SECRET` and `DB_PASSWORD` in Secret Manager
   - grant the Cloud Run runtime service account: Cloud SQL Client, Secret Accessor, Vertex AI User
   - build & deploy the **backend** (Flyway runs the migrations automatically on boot)
   - build the **frontend locally** (Docker Desktop must be running) and deploy it
     with the backend URL baked in — *not* via Cloud Build (see warning above)
   - lock the backend CORS to the deployed frontend URL
3. It prints the **frontend** and **backend** URLs at the end.

## Manual step — Google sign-in
After deploy, add the printed **frontend URL** to your OAuth client's
**Authorized JavaScript origins**:
Google Cloud Console → APIs & Services → Credentials → your Web client →
add `https://carbonexo-web-XXXX.a.run.app`. (Google may take a few minutes.)

## Optional: enable real AI (Gemini)
The script deploys with `AI_PROVIDER=canned` (no AI cost). To switch to Gemini:
```powershell
gcloud run services update carbonexo-backend --region=asia-south1 `
  --update-env-vars="AI_PROVIDER=gemini"
```
`GCP_PROJECT_ID`, `GCP_LOCATION`, and the `aiplatform.user` role are already set.

## Optional: load demo data
A fresh Cloud SQL DB has the schema (via Flyway) but no demo user. Either register
through the app, or load the seed using the Cloud SQL Auth Proxy / Cloud Shell:
```bash
gcloud sql connect carbonexo-db --user=ecotrack --database=ecotrack < database/seed.sql
```

## Costs & teardown
- **Cloud Run** scales to zero — near-free for light use.
- **Cloud SQL `db-f1-micro`** runs ~$8–10/month (it does *not* scale to zero).
- Tear everything down:
  ```powershell
  gcloud run services delete carbonexo-web carbonexo-backend --region=asia-south1 --quiet
  gcloud sql instances delete carbonexo-db --quiet
  ```

## Troubleshooting
- **Backend 500 / DB errors**: check logs — `gcloud run services logs read carbonexo-backend --region=asia-south1`. Usually the Cloud SQL connection name or the `cloudsql.client` role.
- **Frontend can't reach API / CORS**: the frontend bakes `NEXT_PUBLIC_API_BASE_URL` at *build* time — if the backend URL changes, rebuild the frontend. Backend `CORS_ALLOWED_ORIGINS` must equal the frontend URL.
- **Google sign-in "Access blocked"**: the frontend origin isn't in the OAuth client's Authorized JavaScript origins (see manual step), or the consent screen is still in Testing with you not added as a test user.
