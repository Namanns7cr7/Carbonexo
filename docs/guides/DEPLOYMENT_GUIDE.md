# Deployment Guide — Carbonexo / EcoTrack

## Prerequisites

- **Google Cloud Platform** project with:
  - Cloud Storage bucket
  - Cloud Vision API enabled
  - Vertex AI / Gemini API enabled
  - Service account with appropriate roles
- **PostgreSQL 16** database
- **Java 17+** (for building the backend)
- **Node.js 18+** (for building the frontend)

## Environment Variables

```bash
# Database
DB_URL=jdbc:postgresql://HOST:5432/ecotrack
DB_USER=ecotrack
DB_PASSWORD=<secure-password>

# Google Cloud (all services use ADC)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GCP_PROJECT_ID=your-project-id
GCP_LOCATION=us-central1

# Storage
STORAGE_PROVIDER=gcs
GCS_BUCKET=carbonexo-bills

# OCR
OCR_PROVIDER=google

# AI
AI_PROVIDER=gemini
AI_DEFAULT_MODEL=gemini-2.5-pro
AI_FAST_MODEL=gemini-2.0-flash

# Security
JWT_SECRET=<256-bit-random-secret>

# Frontend
NEXT_PUBLIC_API_BASE_URL=https://api.yourdomain.com

# Server
SERVER_PORT=8080
CORS_ALLOWED_ORIGINS=https://yourdomain.com
```

## Build & Deploy

### Backend (Spring Boot)
```bash
cd backend
mvn clean package -DskipTests
java -jar target/ecotrack-backend-0.1.0.jar
```

### Frontend (Next.js)
```bash
npm install
npm run build
npm start
```

### Docker (PostgreSQL)
```bash
cd database
docker-compose up -d
```

## Google Cloud Deployment

### Cloud Run (Backend)
```bash
# Build container
cd backend
gcloud builds submit --tag gcr.io/PROJECT_ID/ecotrack-backend

# Deploy
gcloud run deploy ecotrack-backend \
  --image gcr.io/PROJECT_ID/ecotrack-backend \
  --platform managed \
  --region us-central1 \
  --set-env-vars DB_URL=...,GCP_PROJECT_ID=...
```

### Vercel (Frontend)
```bash
# Connect repo to Vercel
# Set NEXT_PUBLIC_API_BASE_URL env var
vercel deploy
```

## Health Check

After deployment: `curl https://api.yourdomain.com/actuator/health`

Expected: `{"status":"UP"}`
