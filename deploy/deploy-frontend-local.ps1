# =============================================================================
# Deploy the FRONTEND to Cloud Run by building it LOCALLY (not via Cloud Build).
#
# WHY: Cloud Build on Linux/Alpine produced a broken client bundle for this app
# (runtime crash: "useCarbon must be used within CarbonexoProvider" + React #423).
# Building locally produces a correct bundle; we package that into a tiny image
# and push it. Always use THIS to (re)deploy the frontend.
#
# Run from the repo root:   .\deploy\deploy-frontend-local.ps1
# Prereqs: Node + npm, Docker Desktop running, gcloud authenticated.
# =============================================================================
$ErrorActionPreference = 'Continue'

$PROJECT_ID       = 'carbonexo'
$REGION           = 'asia-south1'
$WEB_SVC          = 'carbonexo-web'
$IMG              = "$REGION-docker.pkg.dev/$PROJECT_ID/carbonexo/web:latest"
$BACKEND_URL      = 'https://carbonexo-backend-95267034623.asia-south1.run.app'
$GOOGLE_CLIENT_ID = '95267034623-do8ogieusjpgl080q5kohfqethjgraha.apps.googleusercontent.com'

# 1) Build locally. NEXT_PUBLIC_* are inlined at build time, so set them now.
$env:NEXT_PUBLIC_API_BASE_URL     = $BACKEND_URL
$env:NEXT_PUBLIC_GOOGLE_CLIENT_ID = $GOOGLE_CLIENT_ID
Write-Host '==> npm run build (local)...' -ForegroundColor Cyan
npm run build
if (-not (Test-Path '.next\standalone\server.js')) { throw 'standalone build missing (is output:"standalone" set in next.config?)' }

# 2) Stage static assets into the standalone output + add a tiny runtime Dockerfile.
Copy-Item '.next\static' '.next\standalone\.next\static' -Recurse -Force
if (Test-Path 'public') { Copy-Item 'public' '.next\standalone\public' -Recurse -Force }
Set-Content '.next\standalone\Dockerfile' -Encoding ascii -Value @'
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
'@

# 3) Build the image locally, push to Artifact Registry, deploy to Cloud Run.
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet 2>&1 | Out-Null
Write-Host '==> docker build...' -ForegroundColor Cyan
docker build -t $IMG '.next\standalone'
if ($LASTEXITCODE -ne 0) { throw 'docker build failed' }
Write-Host '==> docker push...' -ForegroundColor Cyan
docker push $IMG
if ($LASTEXITCODE -ne 0) { throw 'docker push failed' }
Write-Host '==> deploy...' -ForegroundColor Cyan
gcloud run deploy $WEB_SVC --image=$IMG --region=$REGION --project=$PROJECT_ID `
  --platform=managed --allow-unauthenticated `
  --memory=512Mi --cpu=1 --min-instances=0 --max-instances=3 --port=3000

$url = gcloud run services describe $WEB_SVC --region=$REGION --project=$PROJECT_ID --format='value(status.url)'
Write-Host ""
Write-Host "DONE -> $url" -ForegroundColor Green
