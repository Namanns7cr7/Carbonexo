# Test Validation Report

## Commands executed and results
| Command | Before | After |
|---|---|---|
| `npx tsc --noEmit` | exit 0 | exit 0 |
| `npx next lint` | 4 warnings (`lib/context/ecomind-context.tsx`) | 0 warnings |
| `npx vitest run` | 213 passed, **2 failed** (215) | 216 passed, 0 failed |
| `npx next build` | not run on baseline | success (also after the Next patch upgrade) |
| `mvn -B test` (Docker `maven:3.9-eclipse-temurin-17`, no database) | 261 run, 0 failed, 73 skipped | 269 run, 0 failed, 73 skipped (measured mid-audit) |
| `mvn -B test` with Testcontainers (Docker socket, `pgvector/pgvector:pg16`) | not run on the untouched baseline | 280 run, 0 failed, **0 skipped** (final) |
| `npm audit --omit=dev` | 4 (1 critical, 3 high) | 2 (1 critical, 1 high), both fixed only by `next@16` |

Java and Maven are not installed on the host; backend runs used Docker. The 73 tests skipped without a database ran green once Docker/Testcontainers was available.

## Failing tests found on `main`
1. `lib/api/ai.test.ts` - test expected the page route in the coach request; code sends only a title/feature `context` string. Test rewritten to the real contract.
2. `lib/experience/experience.test.ts` - expected touch DPR cap below desktop; both are 1.5 since the quality change. Test now asserts the real savings (segments, stars).

## Regression evidence (new tests run against pre-fix code)
`CreditEconomyIntegrationTest` on commit `2509223`: 3 of 5 failed:
- unknown action key: expected 400, got 204
- 8 concurrent completions: expected 1 ledger row, got 8
- 8 concurrent redemptions: expected 1 success, got 8 (`[201 x8]`)
All pass after the fix. The limited-stock tests (2, 8 and 24 racing users) also passed on the old code, so they are guards, not proof of the old race.

## Tests added
- `CreditEconomyIntegrationTest` (real Postgres, HTTP, concurrency)
- `CreditServiceTest` (+3), `RewardServiceTest` (+2)
- `AIControllerInputTest`, `ActivityLogRequestValidationTest`, `BillCorrectionRequestValidationTest`
- `lib/api/ai.test.ts` (+1)

## Gaps
No browser E2E, no accessibility automation, no frontend component tests (Vitest runs only `lib/**`).
