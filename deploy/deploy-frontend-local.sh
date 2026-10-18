#!/usr/bin/env bash
# =============================================================================
# Deploy the FRONTEND to Cloud Run by building it LOCALLY (not via Cloud Build).
#
# WHY: Cloud Build produced a broken client bundle for this app in the past
# (runtime crash: "useCarbon must be used within CarbonexoProvider" + React #423).
# Building locally with the proven working flow avoids that. Always use THIS
# to (re)deploy the frontend.
#
# Run from the repo root: ./deploy/deploy-frontend-local.sh
# Prereqs: Node + npm, Docker Desktop running, gcloud authenticated.
# Run ./deploy/deploy.sh FIRST — this needs the backend URL it prints.
# =============================================================================
set -uo pipefail

PROJECT_ID="carbonexo"
REGION="asia-south1"
WEB_SVC="carbonexo-web"
REPO="carbonexo"
IMG="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/web:latest"
GOOGLE_CLIENT_ID=""

if [ -f /tmp/carbonexo_backend_url.txt ]; then
  BACKEND_URL=$(cat /tmp/carbonexo_backend_url.txt)
else
  BACKEND_URL=$(gcloud run services describe carbonexo-backend --region="$REGION" --format='value(status.url)' --project="$PROJECT_ID")
fi
if [ -z "$BACKEND_URL" ]; then
  echo "Could not determine backend URL — run ./deploy/deploy.sh first."
  exit 1
fi
echo "==> Using backend URL: $BACKEND_URL"

# 1) Build locally. NEXT_PUBLIC_* are inlined at build time, so set them now.
export NEXT_PUBLIC_API_BASE_URL="$BACKEND_URL"
export NEXT_PUBLIC_GOOGLE_CLIENT_ID="$GOOGLE_CLIENT_ID"
echo "==> npm run build (local)..."
npm run build
if [ ! -f ".next/standalone/server.js" ]; then
  echo "standalone build missing (is output:'standalone' set in next.config?)"
  exit 1
fi

# 2) Stage static assets into the standalone output + add a tiny runtime Dockerfile.
rm -rf .next/standalone/.next/static
cp -R .next/static .next/standalone/.next/static
if [ -d public ]; then
  rm -rf .next/standalone/public
  cp -R public .next/standalone/public
fi
cat > .next/standalone/Dockerfile <<'EOF'
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
EOF

gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet >/dev/null 2>&1

echo "==> docker build + push frontend image (linux/amd64, required by Cloud Run)..."
docker build --platform linux/amd64 -t "$IMG" .next/standalone
if [ $? -ne 0 ]; then echo "Frontend image build failed"; exit 1; fi
docker push "$IMG"
if [ $? -ne 0 ]; then echo "Frontend image push failed"; exit 1; fi

echo "==> Deploying frontend to Cloud Run..."
gcloud run deploy "$WEB_SVC" \
  --image="$IMG" --region="$REGION" --platform=managed --allow-unauthenticated \
  --memory=512Mi --cpu=1 --min-instances=0 --max-instances=3 --port=3000 \
  --project="$PROJECT_ID"
if [ $? -ne 0 ]; then echo "Frontend deploy failed"; exit 1; fi

WEB_URL=$(gcloud run services describe "$WEB_SVC" --region="$REGION" --format='value(status.url)' --project="$PROJECT_ID")
echo "    frontend: $WEB_URL"

# 3) Lock CORS to the real frontend URL ---------------------------------------
echo "==> Updating backend CORS to $WEB_URL ..."
gcloud run services update carbonexo-backend --region="$REGION" --project="$PROJECT_ID" \
  --update-env-vars="CORS_ALLOWED_ORIGINS=$WEB_URL"

echo ""
echo "============================================================"
echo " DONE."
echo "  Frontend : $WEB_URL"
echo "  Backend  : $BACKEND_URL  (Swagger: $BACKEND_URL/swagger-ui.html)"
echo "============================================================"
