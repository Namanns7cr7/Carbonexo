# Method Alignment Report

Each row is a verified method/caller mismatch. "Verified" means reproduced by a test or by reading the full call chain.

| Method | Problem | Evidence | Status |
|---|---|---|---|
| `CreditController.completeAction(actionKey)` | Name and contract say "complete a plan action", but any string earned credits. `UUID.nameUUIDFromBytes(key)` made each unique string a new idempotency key, so unlimited credits could be minted and redeemed. | Pre-fix integration test: made-up key returned 204 instead of 400 | Fixed: `CreditService.completePlanAction` validates against `action_templates` (keys match `lib/carbon.ts` ACTIONS and V3 seed) |
| `CreditService.awardCredits` | Javadoc claimed "serializable ledger append"; the method was plain `@Transactional` (READ COMMITTED). `balance_after` computed from a stale sum. | 8 concurrent identical requests -> 8 ledger rows | Fixed |
| `CreditService.onActionDone` | Not transactional; `exists` check and award ran in separate transactions. | Same test | Fixed |
| `RewardService.redeem` | `reward.setStock(reward.getStock()-1); save(reward)` is a lost-update read-modify-write. | Code reading; race did not reproduce reliably in the 2-user test, so this is a code-level fix | Fixed (atomic `UPDATE ... WHERE stock > 0`) |
| `CreditService.debitCredits` | Concurrent debits both saw the same balance: 8 parallel redeems all returned 201 on a balance that covered one. | Pre-fix test: `codes: [201 x8]` | Fixed |
| `AIController.electricityAnalysis` | `(Number) body.getOrDefault`, `(String) ...` casts: wrong JSON type -> `ClassCastException` -> 500. | Code reading + new unit tests | Fixed |
| `AIController.coach` | Accepted blank and unbounded messages on the legacy path (production default `ai.coach.mode=legacy`); the agentic path alone enforced 2000 chars. | Code reading | Fixed |
| `BillService.correct` | `LocalDate.parse(billingMonth + "-01")` on unvalidated input -> `DateTimeParseException` -> generic 500. DTO had no validation, controller had no `@Valid`. | Code reading + validation tests | Fixed |
| `lib/api/ai.sendCoachMessage` | Sends `context` (page title/feature). `AIController.coach` reads only `message`, so the field is dropped. The unit test claimed the route was transmitted. | Test failed on `main`; backend never reads `context` | Open (feature not implemented end-to-end); test corrected to the real contract |
| `ActivityLogRequest.co2Kg` | Client-supplied, only `>= 0`: 1e9 kg accepted and then ranks/scores. | Code reading | Mitigated by upper bound; server-side recomputation still open |
| Dashboard/Group/Report "saved" | `baseline(8 kg/day) x days - logged`: logging less looks like more savings. | `DashboardService:87-93`, `GroupService:233-277`, `ReportService:57` | Open (product decision) |

Not found: unused return values or swallowed exceptions on the credit/reward paths after the fixes.
