# Benchmark Scorecard (internal estimate)

These are my own estimates against the default rubric, **not an official evaluator result**. Confidence is limited: performance was not measured and the frontend was not exhaustively traced.

| Category | Weight | Before | After | Evidence | Remaining |
|---|---|---|---|---|---|
| Correctness & function alignment | 20 | 13 | 16 | Credit/reward races and minting reproduced and fixed; 3 casts/parse paths fixed | Client-computed CO2, baseline "savings", coach `context` dropped |
| Architecture & modularity | 20 | 15 | 15.5 | Clean layering kept | Baseline duplicated; dead AI endpoints |
| Readability & maintainability | 15 | 11 | 11.5 | Lint 0, stale test/doc claims corrected | README badge, large service classes not reviewed |
| Security & reliability | 15 | 9 | 12 | Exploit closed with real-DB tests; 2 inputs bounded; next patched | localStorage refresh token, no legacy rate limit, next 16 advisories |
| Performance & efficiency | 10 | 6 | 6 | Nothing measured | SUM-per-write ledger, no profiling |
| Testing & validation | 10 | 6.5 | 8.5 | 2 failing tests fixed, 73 DB tests now run, +19 tests | No E2E/a11y/component tests |
| Product / requirement alignment | 10 | 6 | 6.5 | Documented purpose matches code for audited flows | See traceability below |
| **Total** | 100 | **~66.5** | **~76** | | |

## Traceability (audited items only)
| Requirement | Component | Test | Status |
|---|---|---|---|
| Actions earn credits once | `CreditService.completePlanAction` | `CreditEconomyIntegrationTest` | Implemented and verified |
| Rewards can't overspend / oversell | `RewardService.redeem` | same + unit | Implemented and verified (stock race: code-level only) |
| Per-user ownership of bills/groups | `BillService`, `GroupService` | `CoachSecurityIntegrationTest` covers coach only | Implemented, partly verified |
| Page-aware coach | `sendCoachMessage` -> `AIController.coach` | `ai.test.ts` | Partially implemented (backend ignores `context`) |
| Real CO2 savings | `DashboardService`, `GroupService` | existing unit tests | Incorrectly implemented (baseline model) |
| Verified emissions | `ActivityLogController` | validation test | Partially implemented (bounded, still client-computed) |
