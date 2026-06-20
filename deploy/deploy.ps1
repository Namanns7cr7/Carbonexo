# =============================================================================
# Carbonexo / EcoTrack — one-shot GCP deploy (Cloud Run + Cloud SQL).
# Run from the REPO ROOT:   .\deploy\deploy.ps1
# Prereqs: gcloud installed + `gcloud auth login` done, billing-enabled project.
# Safe to re-run: steps that already exist are skipped.
# =============================================================================
$ErrorActionPreference = 'Stop'

# ----------------------------- CONFIG (edit me) ------------------------------
$PROJECT_ID   = "REPLACE_WITH_YOUR_PROJECT_ID"      # e.g. carbonexo-123456
$REGION       = "asia-south1"                        # Mumbai
$REPO         = "carbonexo"                          # Artifact Registry repo
$SQL_INSTANCE = "carbonexo-db"
$DB_NAME      = "ecotrack"
$DB_USER      = "ecotrack"
$BACKEND_SVC  = "carbonexo-backend"
$WEB_SVC      = "carbonexo-web"
$GOOGLE_CLIENT_ID = "95267034623-do8ogieusjpgl080q5kohfqethjgraha.apps.googleusercontent.com"
$AI_PROVIDER  = "canned"   # "canned" (no GCP cost) or "gemini" (needs Vertex AI)
# -----------------------------------------------------------------------------

if ($PROJECT_ID -eq "REPLACE_WITH_YOUR_PROJECT_ID") { throw "Edit PROJECT_ID at the top of this script first." }

Write-Host "==> Project: $PROJECT_ID  Region: $REGION" -ForegroundColor Cyan
gcloud config set project $PROJECT_ID | Out-Null

# 1) Enable APIs ---------------------------------------------------------------
Write-Host "==> Enabling APIs..." -ForegroundColor Cyan
gcloud services enable run.googleapis.com cloudbuild.googleapis.com `
  sqladmin.googleapis.com secretmanager.googleapis.com `
  artifactregistry.googleapis.com aiplatform.googleapis.com

$PROJECT_NUMBER = (gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
$RUNTIME_SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
$AR_HOST = "$REGION-docker.pkg.dev"
$BACKEND_IMG = "$AR_HOST/$PROJECT_ID/$REPO/backend:latest"
$WEB_IMG     = "$AR_HOST/$PROJECT_ID/$REPO/web:latest"

# 2) Artifact Registry ---------------------------------------------------------
Write-Host "==> Artifact Registry repo..." -ForegroundColor Cyan
gcloud artifacts repositories describe $REPO --location=$REGION 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="Carbonexo images"
}

# 3) Cloud SQL (PostgreSQL 16) -------------------------------------------------
Write-Host "==> Cloud SQL instance (this can take ~10 min the first time)..." -ForegroundColor Cyan
gcloud sql instances describe $SQL_INSTANCE 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud sql instances create $SQL_INSTANCE `
    --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro `
    --region=$REGION --storage-size=10GB --availability-type=zonal
}
$CONNECTION_NAME = (gcloud sql instances describe $SQL_INSTANCE --format='value(connectionName)')
Write-Host "    connection name: $CONNECTION_NAME"

# DB + app user
gcloud sql databases describe $DB_NAME --instance=$SQL_INSTANCE 2>$null
if ($LASTEXITCODE -ne 0) { gcloud sql databases create $DB_NAME --instance=$SQL_INSTANCE }

# generate a DB password + JWT secret (only used when first creating the secrets)
$DB_PASSWORD = -join ((48..57)+(65..90)+(97..122) | Get-Random -Count 28 | ForEach-Object {[char]$_})
$JWT_SECRET  = [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(48))

gcloud sql users describe $DB_USER --instance=$SQL_INSTANCE 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud sql users create $DB_USER --instance=$SQL_INSTANCE --password=$DB_PASSWORD
} else {
  Write-Host "    db user exists; reusing existing DB_PASSWORD secret"
}

# 4) Secret Manager ------------------------------------------------------------
Write-Host "==> Secrets..." -ForegroundColor Cyan
function Ensure-Secret($name, $value) {
  gcloud secrets describe $name 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Output $value | gcloud secrets create $name --data-file=- --replication-policy=automatic
  } else {
    Write-Host "    secret $name already exists (keeping current value)"
  }
}
Ensure-Secret "JWT_SECRET" $JWT_SECRET
Ensure-Secret "DB_PASSWORD" $DB_PASSWORD

# 5) IAM for the Cloud Run runtime service account -----------------------------
Write-Host "==> Granting IAM to $RUNTIME_SA ..." -ForegroundColor Cyan
foreach ($role in @("roles/cloudsql.client","roles/secretmanager.secretAccessor","roles/aiplatform.user")) {
  gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$RUNTIME_SA" --role=$role --quiet | Out-Null
}

# 6) Build + deploy BACKEND ----------------------------------------------------
Write-Host "==> Building backend image..." -ForegroundColor Cyan
gcloud builds submit --config=deploy/cloudbuild.backend.yaml --substitutions=_IMAGE=$BACKEND_IMG .

$DB_URL = "jdbc:postgresql:///$DB_NAME?cloudSqlInstance=$CONNECTION_NAME&socketFactory=com.google.cloud.sql.postgres.SocketFactory"

Write-Host "==> Deploying backend to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $BACKEND_SVC `
  --image=$BACKEND_IMG --region=$REGION --platform=managed --allow-unauthenticated `
  --add-cloudsql-instances=$CONNECTION_NAME `
  --service-account=$RUNTIME_SA `
  --memory=1Gi --cpu=1 --min-instances=0 --max-instances=3 --port=8080 `
  --set-secrets="JWT_SECRET=JWT_SECRET:latest,DB_PASSWORD=DB_PASSWORD:latest" `
  --set-env-vars="^##^DB_URL=$DB_URL##DB_USER=$DB_USER##AI_PROVIDER=$AI_PROVIDER##GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID##GCP_PROJECT_ID=$PROJECT_ID##GCP_LOCATION=$REGION##CORS_ALLOWED_ORIGINS=*"

$BACKEND_URL = (gcloud run services describe $BACKEND_SVC --region=$REGION --format='value(status.url)')
Write-Host "    backend: $BACKEND_URL" -ForegroundColor Green

# 7) Build + deploy FRONTEND (needs backend URL baked in at build) -------------
Write-Host "==> Building frontend image (NEXT_PUBLIC_* baked in)..." -ForegroundColor Cyan
gcloud builds submit --config=deploy/cloudbuild.frontend.yaml `
  --substitutions="_IMAGE=$WEB_IMG,_API_URL=$BACKEND_URL,_GCID=$GOOGLE_CLIENT_ID" .

Write-Host "==> Deploying frontend to Cloud Run..." -ForegroundColor Cyan
gcloud run deploy $WEB_SVC `
  --image=$WEB_IMG --region=$REGION --platform=managed --allow-unauthenticated `
  --memory=512Mi --cpu=1 --min-instances=0 --max-instances=3 --port=3000

$WEB_URL = (gcloud run services describe $WEB_SVC --region=$REGION --format='value(status.url)')
Write-Host "    frontend: $WEB_URL" -ForegroundColor Green

# 8) Lock CORS to the real frontend URL ---------------------------------------
Write-Host "==> Updating backend CORS to $WEB_URL ..." -ForegroundColor Cyan
gcloud run services update $BACKEND_SVC --region=$REGION `
  --update-env-vars="CORS_ALLOWED_ORIGINS=$WEB_URL"

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " DONE." -ForegroundColor Green
Write-Host "  Frontend : $WEB_URL"
Write-Host "  Backend  : $BACKEND_URL  (Swagger: $BACKEND_URL/swagger-ui.html)"
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "MANUAL STEP — Google sign-in:" -ForegroundColor Yellow
Write-Host "  Add this to your OAuth client's Authorized JavaScript origins:"
Write-Host "    $WEB_URL"
Write-Host "  (Google Cloud Console -> APIs & Services -> Credentials -> your Web client)"
