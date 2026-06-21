# GAP_ANALYSIS.md — Carbonexo / EcoTrack

**Date:** 2026-06-18
**Method:** The brief (this engagement document) is treated as the **authoritative PRD/TRD/App-Flow/Schema** because no formal spec documents exist in the repo or design handoff (see AUDIT_REPORT.md §0). Each gap below is measured as *brief requirement* vs *current implementation*.

**Priority legend:** P0 = blocks core product · P1 = required for a complete release · P2 = important, non-blocking · P3 = nice-to-have.
**Effort:** S ≤ 1d · M 2–4d · L 1–2wk · XL > 2wk (single-engineer estimates).

---

## A. Spec-document gaps (meta)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| A1 | No PRD/TRD/Schema.md/App-Flow/Design-doc/Impl-plan exist; brief references them | P1 | S | Treat brief as spec; **derive** `ROADMAP.md` (this engagement) + `DATABASE_DOCUMENTATION.md` (Phase 13) as the canonical schema/flow records. Backfill a short PRD section into ARCHITECTURE.md. |
| A2 | Product naming split (EcoTrack vs Carbonexo) | P3 | S | Keep "Carbonexo" as product/PWA identity; use "EcoTrack" only as internal/working codename in backend artifact (`group: com.ecotrack` acceptable). Document the mapping once. |

---

## B. Identity & access (Phase 4b)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| B1 | No user accounts | P0 | M | `users` table (UUID PK, email unique, password hash bcrypt, audit fields, soft delete). Register/login endpoints. |
| B2 | No JWT auth | P0 | M | Spring Security resource-server style: short-lived access JWT (signed HS256/RS256, configurable), `@PreAuthorize` on controllers. |
| B3 | No refresh tokens | P0 | M | `refresh_tokens` table (rotating, hashed, rev1-on-use, device/IP, expiry). `/auth/refresh`, `/auth/logout`. |
| B4 | Frontend has no auth UI/session | P0 | M | Add `/login` + `/register` routes reusing existing components; access token in memory, refresh in httpOnly cookie; route guard replaces the current `onboarded` gate as the outer gate. |
| B5 | Onboarding currently writes to localStorage only | P1 | S | Persist onboarding answers to `user_profiles` via API; keep optimistic local cache. |

---

## C. Persistence & API (Phases 3, 4)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| C1 | No database | P0 | L | PostgreSQL schema (Phase 3): users, profiles, activity_logs, emission_factors, bills, ocr_results, recommendations, credit_rules, credit_ledger, rewards, redemptions, prompt_templates, app_config, audit/outbox. UUID PKs, FKs, indexes, soft delete, audit cols. |
| C2 | No REST API / DTO / validation / error model | P0 | L | Layered Spring Boot (controller→service→repository→entity) + DTOs + `jakarta.validation` + `@RestControllerAdvice` global error handler returning RFC-7807 problem+json. |
| C3 | Activity logs only client-side | P0 | M | `activity_logs` table + CRUD endpoints; `/logs?from&to`, `/logs/day/{date}`; server computes totals. |
| C4 | Derived metrics computed on client | P1 | M | Server selectors: today total, delta, weekly series, streak, biggest source, total saved → `/dashboard/summary`. Client keeps local compute only for optimistic UI. |
| C5 | No pagination/filtering conventions | P2 | S | Standard `page/size/sort` + filter params; `Page<T>` responses. |

---

## D. Bill upload + OCR (Phases 5, 6)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| D1 | No bill upload (PDF/PNG/JPG/JPEG) | P0 | M | `POST /bills` multipart → validate type+size+magic-bytes → Azure Blob → `bills` row (status UPLOADED). No local disk. |
| D2 | No Azure Blob integration | P0 | M | `BlobStorageService` (abstraction) + Azure SDK impl; container/SAS via config; store blob URL + content hash. |
| D3 | No virus-safe / content validation | P1 | M | MIME sniff + magic-byte check + size cap + optional ClamAV/Defender hook behind an interface; reject on mismatch. |
| D4 | No OCR | P0 | L | `OcrProvider` interface; impls Azure Document Intelligence, Google Vision, Tesseract; selected by config. Extract **billing month, units consumed, bill amount**. |
| D5 | No extracted-metadata store / manual correction | P0 | M | `ocr_results` table (raw JSON + parsed fields + confidence + corrected flag). `PATCH /bills/{id}/ocr` for manual correction; corrections feed the carbon engine. |
| D6 | No upload tracking | P1 | S | Status lifecycle UPLOADED→SCANNED→OCR_PENDING→OCR_DONE→CONFIRMED/FAILED; surfaced in UI. |
| D7 | No bill-upload UI surface | P1 | M | New screen/route (reuse components) for upload + OCR review/correct. |

---

## E. Carbon engine (Phase 7)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| E1 | Emission factors hardcoded in `lib/carbon.ts` | P0 | M | `emission_factors` table + `carbon.*` config defaults; `CarbonCalculationService` reads factors by (category, key, region, effective_date). No hardcoded factors. |
| E2 | No electricity-from-bill calc | P0 | S | units × electricityFactor → kg CO₂; persist as a derived electricity log linked to the bill. |
| E3 | No transport calc on server | P1 | S | mode factor × distance; factors from config/db. |
| E4 | No monthly/yearly/saved aggregations server-side | P1 | M | Aggregation queries + endpoints; "carbon saved" = baseline − actual (or completed-action savings). |
| E5 | Factor versioning/region | P2 | M | `region`, `effective_from/to`, `source` columns; pick latest applicable. |

---

## F. Green credits + rewards (Phase 8, deliverable #8)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| F1 | No credit rules (e.g. 1 kg saved = 10 credits) | P0 | M | `credit_rules` table, editable without deploy; rule types (per-kg-saved, per-action, per-streak, signup-bonus). |
| F2 | No credit ledger / history / balance | P0 | M | Append-only `credit_ledger` (delta, reason, ref); balance = sum (or materialized). `GET /credits/balance`, `/credits/history`. |
| F3 | No rewards catalog | P1 | M | `rewards` table (cost, stock, active, partner); `GET /rewards`. |
| F4 | No redemption tracking | P1 | M | `redemptions` table + `POST /rewards/{id}/redeem` (atomic balance check → debit ledger → redemption row). |
| F5 | Frontend has no credits/rewards screens | P1 | M | New rewards/marketplace screen + credit balance widget on profile/home (reuse components). |

---

## G. AI engine (Phase 9)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| G1 | AI is canned client strings | P0 | L | `AIProvider` interface; impls OpenAI, Anthropic, Azure OpenAI; selected by config. Default to latest Claude (claude-opus-4-8 / claude-sonnet-4-6) for Anthropic impl. |
| G2 | No prompt template store | P0 | M | `prompt_templates` table (key, version, body, variables); rendered server-side; **no prompts in business services**. |
| G3 | Missing AI features: reduction recs, electricity analysis, transport insights, tips, monthly report | P1 | L | One service per feature, each = template + context assembler + provider call; cache results; persist to `recommendations`. |
| G4 | Coach chat not backed by LLM | P1 | M | `POST /coach/messages` → provider; persist `coach_messages`; stream optional. |
| G5 | No guardrails/cost controls | P2 | M | Token/rate limits, per-user quotas, timeouts, fallback to canned copy on provider failure. |

---

## H. Configuration (Phase 10)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| H1 | Values inline in TS / would-be-inline in Java | P0 | M | `application.yml` + env vars + `app_config` DB table (typed key/value, hot-readable). Nothing hardcoded: keys, URLs, providers, factors, credit rules, reward values. |
| H2 | No secret management | P0 | S | Env vars locally; Azure Key Vault in cloud; never in repo. |
| H3 | Provider selection must be runtime-config | P0 | S | `ocr.provider`, `ai.provider`, `storage.provider` config keys → Spring conditional beans / factory. |

---

## I. Frontend integration (Phase 11)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| I1 | No API service layer | P0 | M | `lib/api/` typed client (fetch wrapper): base URL from env, auth header injection, refresh-on-401 interceptor, retry w/ backoff, typed errors. |
| I2 | No loading/error states for network | P1 | M | Extend `components/app/ui.tsx` (Loading/EmptyState/Error+retry); apply per screen. |
| I3 | Store must switch from localStorage to API | P1 | L | Keep `useCarbon()` surface **unchanged**; swap its internals to call the API layer (React Query/SWR or hand-rolled) with localStorage as offline cache. Screens untouched. |
| I4 | Next.js (RSC) vs "React SPA" assumption | P2 | S | Decision: client calls Spring Boot directly via `NEXT_PUBLIC_API_BASE_URL`; optionally add Next `rewrites` to proxy `/api/*` for same-origin/cookies. Documented in ARCHITECTURE.md. |

---

## J. Observability + docs (Phases 12, 13)

| Gap | Description | Priority | Effort | Proposed solution |
|---|---|---|---|---|
| J1 | No structured logging / tracing | P1 | M | Logback JSON encoder, MDC correlation id via filter, propagate `X-Request-Id`. |
| J2 | No health/metrics | P1 | S | Spring Boot Actuator `/health`, `/metrics`, `/info`; Micrometer + Prometheus registry. |
| J3 | No error monitoring | P2 | S | Pluggable (Sentry/App Insights) behind config. |
| J4 | No architecture/API/DB/deploy/security/env docs | P1 | M | Phase 13 deliverables. |
| J5 | No tests | P1 | L | JUnit5 + Mockito + Testcontainers (PostgreSQL) for backend; Vitest for frontend API layer. |

---

## K. Prioritized cut-line

**P0 (must exist for a working end-to-end product):** B1–B4, C1–C3, D1–D2, D4–D5, E1–E2, F1–F2, G1–G2, H1–H3, I1.
**P1 (complete release):** B5, C4, D3, D6–D7, E3–E4, F3–F5, G3–G4, I2–I3, J1–J2, J4–J5.
**P2/P3:** remainder.

This ordering drives ROADMAP.md.
