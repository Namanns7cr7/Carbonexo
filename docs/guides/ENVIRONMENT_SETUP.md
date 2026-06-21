# Environment Setup — Carbonexo / EcoTrack

## Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| Java JDK | 17+ | Backend |
| Maven | 3.9+ | Backend build |
| Node.js | 18+ | Frontend |
| PostgreSQL | 16+ | Database |
| Docker | Latest | Optional (for PostgreSQL) |

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd Carbonexo

# Frontend dependencies
npm install

# Backend (Maven downloads deps automatically)
cd backend
mvn dependency:resolve
```

### 2. Start PostgreSQL

**Option A: Docker (recommended)**
```bash
cd database
docker-compose up -d
```

**Option B: Local PostgreSQL**
```bash
createdb ecotrack
psql ecotrack -c "CREATE USER ecotrack WITH PASSWORD 'ecotrack';"
psql ecotrack -c "GRANT ALL PRIVILEGES ON DATABASE ecotrack TO ecotrack;"
```

### 3. Start Backend

```bash
cd backend
mvn spring-boot:run
```

The backend will:
- Connect to PostgreSQL on localhost:5432
- Run Flyway migrations automatically
- Start on port 8080
- Use local-stub storage (no GCP needed)
- Use Tesseract OCR (local fallback)
- Use canned AI responses (no API key needed)

Verify: `curl http://localhost:8080/actuator/health`

### 4. Start Frontend

```bash
# From project root
npm run dev
```

Opens on `http://localhost:3000`

### 5. Access Swagger UI

`http://localhost:8080/swagger-ui.html`

## Development Without Google Cloud

The app runs fully locally without any GCP credentials:

| Service | Local Fallback |
|---------|----------------|
| Storage | `local_stub` — writes to `.local-blob/` directory |
| OCR | `tesseract` — free local OCR (install tessdata) |
| AI | `canned` — returns helpful static responses |

Set these in environment or leave defaults in `application.yml`.

## With Google Cloud

1. Create a GCP service account with roles:
   - `Storage Object Admin`
   - `Cloud Vision AI User`
   - `Vertex AI User`

2. Download the JSON key file

3. Set environment variables:
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json
export GCP_PROJECT_ID=your-project-id
export STORAGE_PROVIDER=gcs
export GCS_BUCKET=carbonexo-bills
export OCR_PROVIDER=google
export AI_PROVIDER=gemini
```
