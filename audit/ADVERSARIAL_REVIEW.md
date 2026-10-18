# Independent Adversarial Review

Reviewer re-derived everything from the Git diff (`2509223..HEAD`) and re-ran every check. Prior reports were treated as claims to test.

## Claim verification
| Prior claim | Verdict | Evidence |
|---|---|---|
| Unknown action keys earned credits | **True, fixed** | Pre-fix run: 400 expected, 204 returned. Post-fix passes |
| Concurrent identical awards duplicated | **True, fixed** | 8 requests -> 8 ledger rows pre-fix, 1 post-fix |
| Concurrent redemptions double-spent | **True, fixed** | `[201 x8]` pre-fix; exactly 1 success post-fix |
| Stock read-modify-write lost updates | **Unproven** | Not reproduced at 2, 8, 24 racers on old code. Fix kept as defensive; reports corrected |
| Legacy coach path unbounded | **True, fixed** | No length check in `AIService.chat` on `main` |
| Bill correction malformed month -> 500 | **True (by reading), fixed** | `LocalDate.parse` on unvalidated input, no `@Valid`; DTO tests added |
| "Patch-level" dependency updates | **Understated** | `npm audit fix` also bumped dev transitive majors (@typescript-eslint 7->8). Valid (eslint-config-next 14.2.35 requires it); disclosed now |
| 280 backend tests, 0 skipped | **True** | Re-run: 281 with this review's added test, 0 failed, 0 skipped (Testcontainers) |
| Five AI endpoints have no frontend callers | **True** | grep over `app/`, `components/`, `lib/` (non-test) |

## Defects found in the previous agent's work
1. **UX regression (fixed):** the coach now returns 400 above 2000 chars, but neither chat input had a length cap, so a long paste silently fell back to the offline reference answer. Added `COACH_MESSAGE_MAX_CHARS` (`lib/api/ai.ts`) and `maxLength` on both inputs.
2. **Missing rollback test (fixed):** nothing proved that a refused debit rolls back the stock taken first. Added `failedRedemptionLeavesStockAndBalanceUntouched` (passes).
3. **Weak stock test (fixed):** replaced the 2-user test with a 24-user race plus a "losers not charged" check.
4. **Overstated report wording (fixed):** stock "lost-update" and "patch-level" claims corrected above.

## Checked and found sound
- `ApiException` extends `RuntimeException`, so `BadRequestException` after `takeOneFromStock` rolls back (now tested).
- `@Modifying` JPQL and the native advisory-lock query execute against real PG16 (Spring context boots in integration tests).
- `JdbcTemplate` in `ActionTemplateCatalog` joins the JPA transaction; `completePlanAction` -> `onActionDone` self-call is safe because the outer method is `@Transactional`.
- Frontend plan ids match seeded `action_templates` keys, so the real flow is not broken by the stricter check.
- No circular dependencies introduced (`credit` -> `exception`, `config`; `reward` -> `credit`).
- Bill/Group object-level authorisation present.

## Still open (not fixed here)
- `localStorage` refresh token; no per-user rate limit on the legacy coach path; `next` advisories fixable only on 16.x.
- Client-computed CO2 (bounded, not verified); baseline "CO2 saved" model; `context` dropped by the backend coach.
- `ActionTemplateCatalog` uses raw JDBC while neighbours use JPA (precedent: `FactorRegistryRepository`); acceptable, slightly inconsistent.
- Not executed: browser E2E, accessibility automation, load tests, `backend-py`.

## Evidence-based scorecard (estimate, not an official result)
| Category | Weight | Score | Basis |
|---|---|---|---|
| Correctness & alignment | 20 | 16 | 3 reproduced defects fixed; 1 UX regression from the fixes found and fixed; known model issues remain |
| Architecture & modularity | 20 | 15.5 | Layering preserved; baseline duplication, dead endpoints |
| Readability & maintainability | 15 | 11.5 | Lint 0; reports corrected |
| Security & reliability | 15 | 12 | Exploit closed and tested; open items listed |
| Performance & efficiency | 10 | 6 | Unmeasured |
| Testing & validation | 10 | 8.5 | 281 backend + 216 frontend green; real-DB concurrency tests; no E2E |
| Requirement alignment | 10 | 6.5 | Unchanged |
| **Total** | 100 | **~76** | |

Release readiness: **CONDITIONAL**. Safe to deploy the backend fixes; before a public launch address the localStorage refresh token and legacy-coach rate limit, and decide the savings model.
