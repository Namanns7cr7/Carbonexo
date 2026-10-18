# Agentic AI Coach: Staging Integration, Deployment Readiness and Rollback

**Branch:** `feat/dataset-v2-audit` (worktree `D:\4 year\Carbonexo-datasetv2`, on base `2ad7b61`). **Not committed, merged, pushed or deployed.** No production resource was modified.

## 1. What changed, and where

| Phase | Implementation | Tests |
|---|---|---|
| 1. Gemini works reliably | Explicit models (`gemini-2.5-flash` for both), `AIResult` attribution, `AIFailureKind` classification (MODEL_NOT_FOUND, ENDPOINT, AUTH, QUOTA, TIMEOUT, ...), canned text labelled `canned-fallback` and stripped of invented user claims, `/actuator/health` → `aiModels`, opt-in startup probe, global-endpoint fix (`VertexClients`) for Gemini 3 later | `AIAttributionTest` (7) |
| 1. Fabrication found and fixed | `getMonthlyReport` sent hardcoded 45.2 kg / -8% / 150 credits / 5 actions for every user, now real figures | existing `AIServiceTest` |
| 2. Dataset V2 integration | V12 registry + V13 accounting columns (additive), `FactorRegistryService`: APPROVED vs CANDIDATE authority, region applicability, structured NOT_ESTIMATED, deterministic and attestable calculation | `FactorRegistryServiceIntegrationTest` (11) |
| 3. Agentic tools | 8 read-only tools (`com.ecotrack.ai.agent`), principal-only identity, strict argument validation (unknown keys rejected), 4 s per-tool timeout, max 4 model turns, 6 tool calls, 25 s deadline | `AgenticCoachServiceIntegrationTest` (10) |
| 4. OKF RAG | V14 corpus, `okf_index.py` (71 chunks, embedded with text-embedding-005), hybrid FTS + pgvector RRF with policy filters in SQL, injection guard at index and query time | `KnowledgeRetrievalIntegrationTest` (7) |
| 5. Grounded answers | `coach_agent_system` prompt (V16), `AnswerVerifier` (numbers must come from tools; no "saved" for hypotheticals; one repair, then strip), citation ledger (only tool-supplied sources; grouped markers normalised) | `SourceLedgerAndVerifierTest` (4) |
| 6. Privacy and security | identity from SecurityContext only; cross-user and fake-id attempts denied; 401 fail-closed; feedback owner-only; admin-only reviewer endpoints; logs never contain message text or tokens | `CoachSecurityIntegrationTest` (5, full Spring context over HTTP) |
| 8. Feedback | `POST /api/ai/responses/{id}/feedback` (rating, reasons, correction, opt-in consent), `GET /api/ai/responses/{id}`, admin review pairs + judgement + JSONL preference export (eval-linked and unconsented excluded) | in `CoachSecurityIntegrationTest` |
| Frontend | `CoachAnswerMeta` (attribution, citations with "provisional" badges, thumbs + reasons + correction + consent), `sendCoachFeedback` | vitest `lib/api/ai.test.ts` (6) |

Backend tests: **211 passing** (`mvn test`, was 166 before this phase). Python dataset/OKF/eval tests: **88 passing**. Frontend: `lib/api/ai.test.ts` 6 passing; my files type-check (the base branch's `app/app/page.tsx` does not, see §6).

The other stream's uncommitted `generateLive()` change in `Carbonexo-living` was applied verbatim, with its stale test updated, so the two merge cleanly. That stream should be told before either side commits.

## 2. Configuration matrix

| Setting | Production today | Staging (proposed) | Production after approval |
|---|---|---|---|
| `AI_FAST_MODEL` / `AI_DEFAULT_MODEL` | unset → **gemini-2.0-flash / gemini-2.5-pro (both 404)** | gemini-2.5-flash | gemini-2.5-flash |
| `AGENT_MODEL` / `AGENT_LOCATION` | n/a | gemini-2.5-flash / asia-south1 | same |
| `AI_PROBE_ON_STARTUP` | n/a | true | true |
| app_config `ai.coach.mode` | (n/a) | `tools_rag` | `legacy` → `tools_rag` after release review |
| app_config `factors.allow_candidate` | n/a | `true` (answers labelled CANDIDATE) | **`false` until a human approves a dataset version** |
| app_config `ai.coach.daily_turn_limit` | n/a | 50 | 50 |

Important: with `allow_candidate=false` and no approved dataset, the agentic coach answers "Not estimated: a reviewed and approved emission-factor dataset" for every number. That is the intended production-safe behaviour until the human review in `DATASET_V2_SCHEMA.md` §7 happens.

## 3. Database migration plan

1. V12–V16 are additive (new tables, nullable columns, one view, config rows). Verified locally: historical `activity_logs` (original columns), `credit_ledger` and profile regions are byte-identical before and after.
2. Flyway applies them on deploy (`filesystem:/app/migrations`).
3. Data loads are a separate job, never migrations:
   - `build/registry_seed.2.0.0-candidate.2.sql` (draft dataset + 77 activity mappings),
   - `build/sci_corpus.okf-pilot.v1-*.sql` (corpus, `--activate` only in staging).
4. Remove the stale `backend/src/main/resources/db/migration/V5__latency_optimization.sql` (a duplicate of V11).

## 4. Controls

- Cost: per-user daily limit (DB count of `ai_responses`), output cap 4096 per call (Gemini 2.5 thinking tokens count against it; only used tokens are billed), at most 4 model turns per message, tool-call cap 6, deadline 25 s.
- Reliability: in-process circuit breaker (configuration failures open for 5 min; 3 transient failures open for 30 s); one retry for QUOTA / UNAVAILABLE / EMPTY_RESPONSE.
- Metrics (Micrometer): `carbonexo.coach.turns{outcome,mode}`, `carbonexo.coach.tool.calls{tool,status}`, `carbonexo.coach.verifier{result}`, `carbonexo.coach.latency`, `carbonexo.coach.tokens{direction}`, and `aiModels` in health.
- Alerts (Cloud Monitoring, log/metric based): any `outcome=model_failure_MODEL_NOT_FOUND|AUTH|ENDPOINT` (page); `circuit_open` > 0 for 10 min; verifier `stripped` rate > 10%; p95 latency > 10 s; daily tokens above budget line; billing budget alerts at 50 / 90 / 100% of $50.

## 4b. Total system cost against the $50/month target (measured where possible)

| Item | Basis | Monthly |
|---|---|---|
| Gemini 2.5 Flash, coach | **measured** $0.00187 per message (C2: about 2,650 input and 430 output tokens) | $0.00187 × messages |
| Query embeddings (text-embedding-005) | ≈ 20 tokens per knowledge call at ≈ $0.10 / 1M (aggregator price) | < $0.05 |
| Corpus (re)embedding | 71 chunks ≈ 30k tokens per rebuild | < $0.01 |
| Cloud SQL (existing db-f1-micro, asia-south1) | aggregator list price | ≈ $9 |
| Cloud Run backend (min-instances 0) | ≈ 3–4 s CPU per message; inside the free tier up to tens of thousands of messages | ≈ $0–2 |
| Ingestion job (Cloud Run Job, monthly) | a few minutes | < $0.10 |
| Logging / Monitoring | inside free allotments | ≈ $0 |
| Artifact Registry + Cloud Build | images and a few builds | ≈ $2–5 |
| **Fixed subtotal** | | **≈ $12–16** |
| **Messages that fit in $50** | ($50 − $16) / $0.00187 | **≈ 18,000 / month** (≈ 900 users × 20 messages) |

Prices are aggregator/list estimates; verify in the GCP Pricing Calculator. `min-instances=0` stays: measured p50 is 2.6–3.6 s, and the trade-off is a one-off ~25 s cold start after idle. An always-on instance has not been measured against the budget.

## 5. Rollback

| Problem | Action | Time |
|---|---|---|
| Agentic answers wrong or unsafe | `UPDATE app_config SET config_value='legacy' WHERE config_key='ai.coach.mode'` (5-min cache; restart to apply at once) | minutes |
| Bad factor data | point `factors.dataset_version` at the previous version, or set `allow_candidate=false` | minutes |
| Bad corpus | re-activate the previous `sci_corpus_versions` row | minutes |
| Bad release | `gcloud run services update-traffic carbonexo-backend --to-revisions=<previous>=100` | 1 min |
| Migrations | additive only: leave them in place; nothing reads the new tables when the mode is `legacy` | n/a |

## 6. Blockers found outside this change (need owners)

1. `app/app/page.tsx` on `2ad7b61` does not compile (unbalanced JSX), so `next build` fails.
2. `/actuator/prometheus` is in the security `PUBLIC` list. Restrict it before coach metrics ship (they reveal usage volumes).
3. `backend-py/app/ai/canned.py` repeats the old invented canned texts.
4. `SimulationService` (the Simulate screen) still uses the legacy unsupported factors. The coach's Carbon Twin tool uses the registry, so the two can disagree until Simulate is migrated.
5. Production still uses retired model ids (§2). The one-line env fix is ready but needs your approval.
