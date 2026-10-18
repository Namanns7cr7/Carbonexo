# Performance Review

No profiling or load test was run, so there are **no performance gains claimed**.

## Measured
| Metric | Value |
|---|---|
| `next build` | success; ~15 s wall clock on this machine |
| First Load JS shared by all routes | 87.2 kB |
| Heaviest listed routes | `/welcome` 167 kB, `/onboarding` 153 kB first load |
| Backend suite incl. Testcontainers | ~33 s for 277 tests (includes image startup) |

## Observed by reading (not measured)
- Ledger balance is `SUM(delta)` over all of a user's rows on every award/debit (`CreditLedgerRepository.sumDeltaByUserId`); fine at demo scale, O(rows per user) later. `balance_after` on the latest row could replace it, now safe because writes are serialised.
- Index `ix_credit_ledger_user (user_id, created_at DESC)` exists (V2); existing latency work is in V11.
- The advisory lock adds one cheap round trip per ledger write; contention is per user only.
- Coach history paging is capped at 100 (`AIService.getChatHistoryPaged`).
- Earth rendering already has a reduced budget for touch devices (`lib/experience/quality.ts`).

## Not examined
N+1 query count under real data, JPA fetch plans, Cloud Run cold starts, bundle analysis per route.
