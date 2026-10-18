# Security Review

Only issues with an identified code path are listed.

## Fixed
| Sev | Issue | Path | Fix |
|---|---|---|---|
| High | Business-logic abuse: unlimited credit minting, then redemption of rewards | `POST /api/credits/action?actionKey=<anything>` | Key must exist and be active in `action_templates` |
| High | Double-spend: N parallel redemptions all succeed on a balance that covers one (reproduced: 8 of 8) | `RewardService.redeem` / `CreditService.debitCredits` | Per-user `pg_advisory_xact_lock` |
| Medium | Unbounded LLM input on legacy coach path (cost/DoS) | `POST /api/ai/coach` | 2000-char cap, blank rejected |
| Medium | Free-text `period` interpolated into an LLM prompt (prompt-injection surface) | `POST /api/ai/monthly-report` | Must match `YYYY-MM` |
| Low | 500s with stack-style handling for malformed JSON types / dates | `electricity-analysis`, bill correction | 400 with message |
| Low | Absurd emission/quantity values accepted | `ActivityLogRequest` | Upper bounds |
| High (dep) | `next` 14.2.5 and transitive `nanoid`, `source-map-js` advisories | `package.json` | `next@14.2.35`, `npm audit fix` |

## Checked and acceptable
- JWT filter, stateless sessions, CSRF disabled with bearer-only auth, CORS from config with `allowCredentials=false` (`SecurityConfig`).
- Metrics endpoints need ROLE_ADMIN or a >=32-char scrape token, compared in constant time.
- Object-level authorisation: `BillService.getById/correct` return 404 for another user's bill; `GroupService` calls `requireMembership` on group reads; coach tools take identity from the principal only (see `CoachSecurityIntegrationTest`).
- Secrets: none committed (`.env.example` only).

## Open
| Sev | Issue | Note |
|---|---|---|
| Medium | Refresh token stored in `localStorage` (`lib/api/client.ts` `cx-refresh`) | Any XSS reads it. Moving to an httpOnly cookie needs a backend change. |
| Medium | Legacy coach path has no per-user rate limit (agentic path does) | Message cap added; a daily quota should be added to `AIService.chat`. |
| Medium | `next` advisories that only 16.x fixes remain (`npm audit`: 1 critical, 1 high, after patching) | A major upgrade needs its own migration; not done. |
| Low | Soft-deleted bills still readable by owner via `getById` | Owner only; low impact. |
| Info | Swagger UI is public by design | Disable via config for production if undesired. |

Not tested: rate-limit behaviour under load, file-upload fuzzing, XSS sweep of the frontend, `backend-py`.
