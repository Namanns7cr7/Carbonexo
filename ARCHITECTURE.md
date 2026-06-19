# Architecture — Carbonexo / EcoTrack

## System Overview

Carbonexo is a full-stack carbon footprint tracking platform with AI-powered sustainability coaching, built on **Google Cloud** infrastructure.

```
┌──────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                          │
│  app/ · components/ · lib/                                          │
│  ├── lib/api/client.ts  (auth, retry, error handling)              │
│  ├── lib/store.tsx      (React context + localStorage fallback)    │
│  └── lib/carbon.ts      (pure domain model)                       │
├──────────────────────────────────────────────────────────────────────┤
│                    REST API (Spring Boot 3.3)                       │
│  /api/auth/**  /api/profiles/**  /api/activities/**  /api/dashboard │
│  /api/bills/**  /api/credits/**  /api/rewards/**  /api/ai/**       │
├──────────────────────────────────────────────────────────────────────┤
│                      SERVICE LAYER                                  │
│  AuthService · UserProfileService · CarbonCalculationService       │
│  DashboardService · BillService · CreditService · RewardService    │
│  AIService · CreditRuleEngine · OcrProcessingService               │
├──────────────────────────────────────────────────────────────────────┤
│                   PROVIDER ABSTRACTIONS                             │
│  BlobStorageService ──► GoogleCloudStorageService | LocalStub       │
│  OcrProvider ──────────► GoogleVisionOcrProvider | TesseractOCR     │
│  AIProvider ───────────► GeminiAIProvider | CannedFallback          │
├──────────────────────────────────────────────────────────────────────┤
│                      DATA LAYER                                     │
│  PostgreSQL 16 · Flyway migrations · JPA/Hibernate                 │
│  16 tables · UUID PKs · audit columns · soft delete                │
├──────────────────────────────────────────────────────────────────────┤
│                    GOOGLE CLOUD SERVICES                            │
│  Cloud Storage (bills) · Cloud Vision (OCR) · Vertex AI (Gemini)   │
└──────────────────────────────────────────────────────────────────────┘
```

## Key Design Principles

1. **Provider Abstraction** — All cloud services behind interfaces. Swap by changing a config value.
2. **No Hardcoded Values** — Emission factors, credit rules, prompt templates, rewards all in the database.
3. **Config Hierarchy** — `application.yml` → env vars → `app_config` DB table (runtime-editable).
4. **Additive Integration** — Frontend's `useCarbon()` hook surface unchanged; data source swappable.
5. **Google-Only Cloud** — GCS, Vision, Gemini. No Azure, no AWS.

## Package Structure

```
com.ecotrack/
├── EcotrackApplication.java
├── auth/          # Registration, login, JWT, refresh tokens
├── carbon/        # Emission factors, activity logs, carbon engine, dashboard
├── bill/          # Bill upload, OCR results
├── credit/        # Credit rules, ledger, rule engine
├── reward/        # Rewards catalog, redemptions
├── ai/            # AI provider, prompt templates, renderer
│   └── service/   # AI services, recommendations, coach chat
├── storage/       # Blob storage abstraction (GCS / local)
├── upload/        # File validation
├── ocr/           # OCR provider abstraction (Vision / Tesseract)
├── profile/       # User profiles
├── config/        # App properties, runtime config
├── security/      # Security filter chain, JWT filter, CORS
├── exception/     # Global exception handler, API exceptions
├── common/        # Base entity
├── user/          # User entity, repository
└── observability/ # Request tracing, health indicators
```

## Data Flow

### Bill Upload → OCR → Carbon Log
```
User uploads PDF/PNG → FileValidationService validates →
  GoogleCloudStorageService stores in GCS →
  Bill record created (status=UPLOADED) →
  GoogleVisionOcrProvider extracts text →
  OcrResult saved with parsed billing month, units, amount →
  Bill status → OCR_DONE →
  User reviews & corrects if needed →
  Bill status → CONFIRMED →
  ActivityLog created for electricity consumption
```

### Credit Accrual
```
User action (signup, carbon saved, bill upload, action done) →
  CreditRuleEngine reads rules from DB →
  CreditService appends to credit_ledger →
  Balance = SUM(delta) from ledger
```
