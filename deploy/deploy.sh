#!/usr/bin/env bash
# =============================================================================
# Carbonexo / EcoTrack - one-shot GCP deploy (Cloud Run + Cloud SQL).
# Bash port of deploy.ps1, for a fresh GCP project.
# Run from the REPO ROOT: ./deploy/deploy.sh
# Prereqs: gcloud installed + authenticated, billing-enabled project.
# Safe to re-run: steps that already exist are skipped.
# =============================================================================
set -uo pipefail

# ----------------------------- CONFIG (edit me) ------------------------------
PROJECT_ID="project-d1b98ab5-f061-4290-96b"
REGION="asia-south1"                         # Mumbai
REPO="carbonexo"                             # Artifact Registry repo
SQL_INSTANCE="carbonexo-db"
DB_NAME="ecotrack"
DB_USER="ecotrack"
BACKEND_SVC="carbonexo-backend"
WEB_SVC="carbonexo-web"
GOOGLE_CLIENT_ID=""                           # empty = Google sign-in disabled, email/password still works
AI_PROVIDER="gemini"                          # "canned" (no GCP cost) or "gemini" (needs Vertex AI)
# Vertex AI (Gemini) is NOT available in asia-south1 — must point at a region
# that actually serves Gemini models, independent of where Cloud Run/Cloud SQL
# live. gemini-2.0-flash is deprecated/unavailable for this project; the 2.5
# models are the confirmed-working names (verified directly against the API).
AI_LOCATION="us-central1"
AI_DEFAULT_MODEL="gemini-2.5-pro"
AI_FAST_MODEL="gemini-2.5-flash"
# -----------------------------------------------------------------------------

echo "==> Project: $PROJECT_ID  Region: $REGION"
gcloud config set project "$PROJECT_ID" >/dev/null

# 1) Enable APIs ---------------------------------------------------------------
echo "==> Enabling APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com \
  sqladmin.googleapis.com secretmanager.googleapis.com \
  artifactregistry.googleapis.com aiplatform.googleapis.com
if [ $? -ne 0 ]; then echo "Failed to enable required APIs"; exit 1; fi

PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
RUNTIME_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
AR_HOST="${REGION}-docker.pkg.dev"
BACKEND_IMG="${AR_HOST}/${PROJECT_ID}/${REPO}/backend:latest"
WEB_IMG="${AR_HOST}/${PROJECT_ID}/${REPO}/web:latest"

# 2) Artifact Registry ---------------------------------------------------------
echo "==> Artifact Registry repo..."
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" --description="Carbonexo images"
fi

# 3) Cloud SQL (PostgreSQL 16) -------------------------------------------------
echo "==> Cloud SQL instance (this can take ~10 min the first time)..."
gcloud sql instances describe "$SQL_INSTANCE" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  gcloud sql instances create "$SQL_INSTANCE" \
    --database-version=POSTGRES_16 --edition=enterprise --tier=db-f1-micro \
    --region="$REGION" --storage-size=10GB --availability-type=zonal
fi
CONNECTION_NAME=$(gcloud sql instances describe "$SQL_INSTANCE" --format='value(connectionName)')
if [ -z "$CONNECTION_NAME" ]; then echo "Cloud SQL instance not available"; exit 1; fi
echo "    connection name: $CONNECTION_NAME"

# DB + app user
gcloud sql databases describe "$DB_NAME" --instance="$SQL_INSTANCE" >/dev/null 2>&1
if [ $? -ne 0 ]; then gcloud sql databases create "$DB_NAME" --instance="$SQL_INSTANCE"; fi

# generate a DB password + JWT secret (only used when first creating the secrets)
DB_PASSWORD=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 28)
JWT_SECRET=$(LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 48)

gcloud sql users describe "$DB_USER" --instance="$SQL_INSTANCE" >/dev/null 2>&1
if [ $? -ne 0 ]; then
  gcloud sql users create "$DB_USER" --instance="$SQL_INSTANCE" --password="$DB_PASSWORD"
else
  echo "    db user exists; reusing existing DB_PASSWORD secret"
fi

# 4) Secret Manager ------------------------------------------------------------
echo "==> Secrets..."
ensure_secret() {
  local name="$1" value="$2"
  gcloud secrets describe "$name" >/dev/null 2>&1
  if [ $? -ne 0 ]; then
    printf '%s' "$value" | gcloud secrets create "$name" --data-file=- --replication-policy=automatic
  else
    echo "    secret $name already exists (keeping current value)"
  fi
}
ensure_secret "JWT_SECRET" "$JWT_SECRET"
ensure_secret "DB_PASSWORD" "$DB_PASSWORD"

# 5) IAM for the Cloud Run runtime service account -----------------------------
echo "==> Granting IAM to $RUNTIME_SA ..."
for role in roles/cloudsql.client roles/secretmanager.secretAccessor roles/aiplatform.user; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUNTIME_SA" --role="$role" --quiet >/dev/null
done

# 6) Build + deploy BACKEND ----------------------------------------------------
echo "==> Building backend image..."
gcloud builds submit --config=deploy/cloudbuild.backend.yaml --substitutions=_IMAGE="$BACKEND_IMG" .
if [ $? -ne 0 ]; then echo "Backend image build failed"; exit 1; fi

DB_URL="jdbc:postgresql:///${DB_NAME}?cloudSqlInstance=${CONNECTION_NAME}&socketFactory=com.google.cloud.sql.postgres.SocketFactory"

ENV_FILE=$(mktemp)
cat > "$ENV_FILE" <<EOF
DB_URL: "$DB_URL"
DB_USER: "$DB_USER"
AI_PROVIDER: "$AI_PROVIDER"
GOOGLE_CLIENT_ID: "$GOOGLE_CLIENT_ID"
GCP_PROJECT_ID: "$PROJECT_ID"
GCP_LOCATION: "$AI_LOCATION"
AI_DEFAULT_MODEL: "$AI_DEFAULT_MODEL"
AI_FAST_MODEL: "$AI_FAST_MODEL"
CORS_ALLOWED_ORIGINS: "*"
API_DOCS_ENABLED: "false"
EOF

echo "==> Deploying backend to Cloud Run..."
gcloud run deploy "$BACKEND_SVC" \
  --image="$BACKEND_IMG" --region="$REGION" --platform=managed --allow-unauthenticated \
  --add-cloudsql-instances="$CONNECTION_NAME" \
  --service-account="$RUNTIME_SA" \
  --memory=1Gi --cpu=1 --min-instances=0 --max-instances=3 --port=8080 --timeout=300 \
  --set-secrets="JWT_SECRET=JWT_SECRET:latest,DB_PASSWORD=DB_PASSWORD:latest" \
  --env-vars-file="$ENV_FILE"
if [ $? -ne 0 ]; then echo "Backend deploy failed"; exit 1; fi
rm -f "$ENV_FILE"

BACKEND_URL=$(gcloud run services describe "$BACKEND_SVC" --region="$REGION" --format='value(status.url)')
echo "    backend: $BACKEND_URL"
echo "$BACKEND_URL" > /tmp/carbonexo_backend_url.txt

echo ""
echo "============================================================"
echo " BACKEND DONE."
echo "  Backend  : $BACKEND_URL  (Swagger: $BACKEND_URL/swagger-ui.html)"
echo "============================================================"
echo "Next: run ./deploy/deploy-frontend-local.sh to build + deploy the frontend."
