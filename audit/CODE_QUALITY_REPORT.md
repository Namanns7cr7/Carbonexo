# Code Quality Report

## Strengths (verified)
- Consistent controller -> service -> repository layering, record DTOs, RFC-7807 error handler, provider interfaces for AI/OCR/storage.
- Config-as-data (factors, credit rules, prompts in DB), Flyway as the schema source of truth.
- `tsc` strict clean, lint clean, 216 frontend and 280 backend tests green.

## Issues
| Sev | Item | Status |
|---|---|---|
| Medium | Duplicated 8.0 kg/day baseline in three classes | Open |
| Medium | Stale or misleading claims: README badge "106 passing", `CreditService` javadoc "serializable", frontend test named "page-aware grounding" | Javadoc and test fixed; README open |
| Low | `AIController` endpoints `recommendations`, `electricity-analysis`, `transport-insights`, `daily-tip`, `monthly-report` have no frontend callers in `app/` or `components/` (only `lib/api/ai.ts`) | Open: dead surface; keep or remove deliberately |
| Low | `JSON.stringify` dependency keys in `useEcoMindPageContext` | Documented in place |
| Low | `user_plans`, `audit_log` tables and `kg_saved`/`streak_day` credit rules unused (per repo's own master context, not re-verified here) | Open |

Not reviewed: every frontend page for dead buttons, `backend-py/`, `scripts/dataset_v2/`.
