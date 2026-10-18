# Remediation Changelog

Branch `audit/hardening` (from `main` @ `2509223`). Nothing pushed.

| Commit | Change | Reason |
|---|---|---|
| `fix(backend): stop credit minting and double-spend; bound coach/AI/activity inputs` | `CreditController`, `CreditService`, new `ActionTemplateCatalog`, `CreditLedgerRepository.lockLedger`, `RewardRepository.takeOneFromStock`, `RewardService`, `AIController`, `ActivityLogRequest` + tests | Credit minting, double-spend, unbounded/untyped input |
| `test(frontend): align stale tests...; clear hook lint warnings` | `ai.test.ts`, `experience.test.ts`, `ecomind-context.tsx` | 2 failing tests; 4 lint warnings (documented one `eslint-disable` for structural dep keys) |
| `chore(deps): next 14.2.5 -> 14.2.35 ...` | `package.json`, lockfile | Security advisories. Note: `npm audit fix` also moved dev-only transitive packages (`@typescript-eslint` 7 -> 8 via `eslint-config-next@14.2.35`, `postcss`, `nanoid`, `source-map-js`); lint, typecheck, tests and build pass. |
| `fix(backend): validate bill corrections` - `BillCorrectionRequest` constraints + `@Valid` on `BillController.correct` | Malformed month -> 500 | Input validation |

Interface changes: `CreditService` constructor gained `ActionTemplateCatalog` (one caller: Spring; one test updated). `/api/credits/action` now returns 400 for unknown keys (the frontend only sends catalogue ids). `/api/ai/coach` returns 400 for blank/over-long messages.

Rollback: revert the commits. No migration or schema change was made.
