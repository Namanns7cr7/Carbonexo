# ROADMAP.md — Carbonexo / EcoTrack backend build

**Date:** 2026-06-18
**Inputs:** AUDIT_REPORT.md, GAP_ANALYSIS.md, the brief (authoritative spec).
**Principle:** Additive only. Frontend structure/routing/components preserved. Backend is greenfield in new `backend/` + `database/` trees. Each milestone is independently demoable.

---

## 1. Target architecture (decided)

```
Carbonexo/                      # existing Next.js frontend (PRESERVED)
├── app/  components/  lib/  public/
├── lib/api/                    # NEW — frontend API service layer (Phase 11, additive)
├── database/                   # NEW — Phase 3
│   ├── schema.sql  seed.sql  indexes.sql
│   └── migrations/  (V1__*.sql … Flyway-style, ordered)
├── backend/                    # NEW — Spring Boot (Phase 4+)
│   └── src/main/java/com/ecotrack/...
│       controllers/ services/ repositories/ entities/ dto/
│       config/ security/ exceptions/ integrations/ schedulers/ utils/
└── AUDIT_REPORT.md GAP_ANALYSIS.md ROADMAP.md + Phase-13 docs
```

**Stack:** Java 17 · Spring Boot 3.3 · Spring Security 6 · PostgreSQL 16 · Flyway · Azure Blob · Azure/Google/Tesseract OCR (pluggable) · OpenAI/Anthropic/Azure-OpenAI (pluggable) · Maven · springdoc-openapi (Swagger) · Micrometer/Actuator.

**Key cross-cutting decisions:**
1. **Build tool:** Maven (single-module to start; multi-module only if it grows).
2. **Migrations:** Flyway, versioned SQL under `database/migrations/`; `schema.sql` is the readable consolidated snapshot, Flyway scripts are the executable source of truth.
3. **IDs:** UUID v4 PKs everywhere; `created_at/updated_at/created_by/updated_by` audit columns; `deleted_at` soft delete where the brief says "where appropriate" (users, profiles, bills, rewards, logs — not ledger/audit which are append-only/immutable).
4. **Provider abstraction:** `OcrProvider`, `AIProvider`, `BlobStorageService`, `CreditRuleEngine` are interfaces; concrete impls chosen by `*.provider` config via Spring conditional beans. **No provider-specific code in business services.**
5. **Config:** `application.yml` + env + `app_config` table. No hardcoded keys/URLs/factors/rules/rewards.
6. **Frontend integration:** client → Spring Boot via `NEXT_PUBLIC_API_BASE_URL`; access token in memory, refresh token in httpOnly cookie; `useCarbon()` public surface unchanged, internals swapped to API.
7. **AI default:** Anthropic impl defaults to latest Claude (claude-opus-4-8 for quality, claude-sonnet-4-6 for cheaper/faster paths).

---

## 2. Milestones (dependency-ordered)

| M | Name | Brief phases | Depends on | Exit criteria |
|---|---|---|---|---|
| **M0** | Planning | 1, 2 | — | ✅ AUDIT, GAP, ROADMAP committed |
| **M1** | Database | 3 | M0 | schema.sql + migrations + indexes + seed; `flyway migrate` clean on PG16 |
| **M2** | Backend skeleton + config | 4, 10 | M1 | App boots, connects to PG, `/health` 200, global error handler, OpenAPI UI live, config externalized |
| **M3** | Auth | 4b | M2 | register/login/refresh/logout; JWT guards; Swagger authorize works; tests green |
| **M4** | Core domain API | 4, 7 | M3 | profiles, activity logs CRUD, emission factors served, dashboard summary; carbon engine config-driven |
| **M5** | Bills + storage + OCR | 5, 6 | M4 | upload→Blob→OCR→parsed fields→manual correct→electricity log; providers swappable |
| **M6** | Credits + rewards | 8 | M4 | rule-driven ledger, balance, history; rewards catalog; atomic redemption |
| **M7** | AI engine | 9 | M4 | provider-pluggable recs, analyses, tips, monthly report, coach; templates in DB |
| **M8** | Frontend integration | 11 | M3–M7 | `lib/api/` layer; screens read live data; auth UI; bill-upload + rewards UI; UI otherwise unchanged |
| **M9** | Observability | 12 | M2 | structured logs, request tracing, /health /metrics, error monitor hook |
| **M10** | Docs + hardening | 13 | all | 6 docs; security headers; tests; deployment guide |

Critical path: M1→M2→M3→M4→(M5∥M6∥M7)→M8→M10. M9 runs alongside from M2.

---

## 3. Task breakdown (execution order)

### M1 — Database (Phase 3)
- [ ] `database/schema.sql` — all tables, FKs, audit + soft-delete columns, enums/check constraints.
- [ ] `database/indexes.sql` — FK indexes, hot-query indexes (logs by user+date, ledger by user, bills by user+status).
- [ ] `database/migrations/V1__init.sql` … (init, seed-config, factors, credit-rules, rewards, prompt-templates).
- [ ] `database/seed.sql` — emission factors (from `lib/carbon.ts`), credit rules, sample rewards, prompt templates, demo user.

### M2 — Backend skeleton + config (Phases 4, 10)
- [ ] Maven `pom.xml`, `EcotrackApplication`, package layout.
- [ ] `application.yml` + profiles (`dev`, `prod`) + env placeholders; `app_config` loader.
- [ ] Datasource + Flyway wiring; JPA base entity (`BaseEntity` audit), auditing config.
- [ ] Global exception handler (RFC-7807), validation, base DTOs, `ApiResponse`.
- [ ] springdoc OpenAPI/Swagger config; Actuator.

### M3 — Auth (Phase 4b)
- [ ] `User`, `RefreshToken` entities + repos; bcrypt; `UserDetailsService`.
- [ ] JWT util (sign/verify, configurable secret/expiry), security filter chain, method security.
- [ ] `AuthController` register/login/refresh/logout; DTOs + validation; tests.

### M4 — Core domain (Phases 4, 7)
- [ ] `UserProfile`, `ActivityLog`, `EmissionFactor` entities/repos/services/controllers/DTOs.
- [ ] `CarbonCalculationService` (config/db factors; electricity, transport, monthly, yearly, saved).
- [ ] `DashboardService` summary (today/delta/week/streak/biggest source/saved).
- [ ] Onboarding profile persistence endpoint.

### M5 — Bills + storage + OCR (Phases 5, 6)
- [ ] `BlobStorageService` + Azure impl; validation (type/size/magic-bytes/scan hook).
- [ ] `Bill`, `OcrResult` entities; `BillController` upload/list/get/correct.
- [ ] `OcrProvider` interface + Azure/Google/Tesseract impls + factory; async OCR via scheduler/queue; map → electricity log.

### M6 — Credits + rewards (Phase 8)
- [ ] `CreditRule`, `CreditLedger`, `Reward`, `Redemption` entities/repos.
- [ ] `CreditRuleEngine` (config/db rules) + `CreditService` (accrual hooks on saved-carbon/actions).
- [ ] `RewardController` catalog + atomic `redeem`.

### M7 — AI engine (Phase 9)
- [ ] `AIProvider` interface + OpenAI/Anthropic/Azure impls + factory.
- [ ] `PromptTemplate` entity + renderer; templates seeded in DB.
- [ ] Services: recommendations, electricity analysis, transport insights, tips, monthly report, coach; persistence + fallback.

### M8 — Frontend integration (Phase 11)
- [ ] `lib/api/` client (base URL, auth header, 401-refresh, retry, typed errors).
- [ ] Swap `lib/store.tsx` internals → API (public hook surface unchanged).
- [ ] `/login` `/register` + route guard; loading/error states.
- [ ] New UI: bill upload + OCR review; rewards/redemption; credit balance widget.

### M9 — Observability (Phase 12) — parallel from M2
- [ ] Logback JSON + MDC correlation filter; `X-Request-Id` propagation.
- [ ] Actuator health/metrics; Micrometer/Prometheus; error-monitor hook.

### M10 — Docs + hardening (Phase 13)
- [ ] ARCHITECTURE.md, API_DOCUMENTATION.md, DATABASE_DOCUMENTATION.md, DEPLOYMENT_GUIDE.md, ENVIRONMENT_SETUP.md, SECURITY_GUIDE.md.
- [ ] Security headers/CSP; SW cache excludes `/api`; tests (JUnit5 + Testcontainers, Vitest).

---

## 4. Risks & mitigations

| Risk | Mitigation |
|---|---|
| No formal spec docs | Brief = spec; schema/flow captured in DATABASE_DOCUMENTATION.md + ARCHITECTURE.md |
| Provider creds (Azure/OpenAI/etc.) unavailable in dev | Every provider has a local/no-op fallback (Tesseract for OCR, canned-copy fallback for AI, local-stub blob for storage) selectable by config so the app runs without cloud creds |
| Java/PG toolchain not installed locally | Code is generated production-ready; build/run documented in ENVIRONMENT_SETUP.md; Docker Compose provided for PG |
| Scope is very large (XL) | Strict milestone gating; each milestone independently demoable; P0 cut-line first |
| Breaking the preserved frontend | Integration is additive; `useCarbon()` contract frozen; screens untouched except data source |

---

## 5. Immediate next step
Begin **M1 (Phase 3): database** — `schema.sql`, `indexes.sql`, `migrations/`, `seed.sql`.
