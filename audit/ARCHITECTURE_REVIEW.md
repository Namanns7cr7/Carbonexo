# Architecture Review

Scope: `main` @ `2509223` (audited on branch `audit/hardening`). Method: file reading plus execution of the build and test suites.

## Shape
```
Next.js 14 PWA (app/, components/, lib/)        ->  lib/api/* (fetch client, bearer JWT)
Spring Boot 3.3 (backend/, Java 17)             ->  controller -> service -> repository (JPA) / JdbcTemplate
PostgreSQL 16 + pgvector (database/migrations V1..V17, Flyway)
Providers behind interfaces: AIProvider, OcrProvider, BlobStorageService (config-selected)
AI: legacy coach (AIService.chat) or agentic coach (ai/agent, mode from app_config ai.coach.mode)
backend-py/ : partial FastAPI port, not deployed (not audited)
```
231 backend Java files; 14 REST controllers; 17 Flyway migrations. The `/api/**` surface is authenticated except `/api/auth/**`, Swagger and actuator health/info (`SecurityConfig`).

## Verified execution flows
- Login: `AuthController` -> `AuthService` (bcrypt, JWT, hashed rotating refresh) -> `lib/api/auth.ts` -> `setTokens`.
- Plan action: `lib/store.tsx togglePlan` -> `lib/api/credits.completeAction` -> `CreditController.completeAction` -> `CreditService.completePlanAction` -> ledger. (Re-routed in this audit; see changelog.)
- Redeem: `RewardController` -> `RewardService.redeem` -> `CreditService.debitCredits` -> `RedemptionRepository`.
- Coach: `app/app/coach/page.tsx` -> `sendCoachMessage` -> `AIController.coach` -> agentic or legacy service.

## Findings
| # | Severity | Finding | Status |
|---|---|---|---|
| A1 | High | Ledger "read sum, then append" had no concurrency control; check-then-act idempotency was racy (`CreditService`). | Fixed (per-user advisory lock) |
| A2 | Medium | The same baseline literal `8.0` kg/day is repeated in `DashboardService`, `GroupService.FALLBACK_BASELINE_DAILY_KG`, `ReportService.FALLBACK_BASELINE_DAILY_KG`. Three copies of one business rule. | Open: move to `app_config` |
| A3 | Medium | Layering is otherwise clean: controllers delegate; DTO records; providers behind interfaces. Two exceptions: `AIController` did input parsing with casts (fixed) and a new `ActionTemplateCatalog` reads a table with no entity (by design: read-only lookup). | Partly fixed |
| A4 | Low | `AIController` constructor takes `ObjectProvider<AgenticCoachService>` and branches on null: acceptable optional-bean handling. | None |
| A5 | Info | Patterns present are proportionate (service layer, repository, strategy via provider interfaces). No unjustified patterns were added. | None |

Nothing was restructured: the existing architecture fits the problem and rewriting it would have added risk without a verified benefit.
