# EcoMind Agentic RAG: Integration Plan

**Scope:** the existing Spring Boot backend (`com.ecotrack`), Cloud SQL Postgres + pgvector, and Vertex AI Gemini. Frontend routes are preserved. **Status:** design plus reference implementations in Python and SQL. No Java change has been made in this branch, because `AIProvider`, `AIService` and `CannedFallbackProvider` have uncommitted changes in the `Carbonexo-living` worktree (`generateLive()`), and this plan composes with them instead of colliding.

## 1. Request flow (one coach turn)

```
user msg -> AIService.chat (auth principal only)
  1. InjectionGuard.scanUserMessage           (flags, never blocks benign text)
  2. KnowledgeRetrievalService.retrieve       (sci_chunks, hybrid, policy-filtered; no user data)
  3. CoachMemory.recall (existing V10)        (ai_memory, WHERE user_id = principal)
  4. Tool loop: ToolCallingAIProvider.generateWithTools
        <= 3 model iterations, <= 6 tool calls, 15 s turn deadline, per-tool timeouts
        tools: read-only, principal-bound (coach_tools.v1.json)
  5. AnswerVerifier
        numeric check   : every kg / kWh / % in the answer matches a tool output or an attested receipt
        citation check  : every cited id is in the retrieved items' citations or the tool factor sources
        kind check      : no "saved / avoided / verified" unless quantity_kind allows it
        repair: one constrained regeneration -> else strip the claim -> else abstain
  6. Persist coach_messages + ai_responses + ai_tool_calls (V15): model, prompt version,
     factor_dataset_version, corpus_version, okf_bundle_digest, knowledge_used, attestations
```

Fallbacks keep today's behaviour: if retrieval fails, answer without evidence and say so. If the tool loop fails, say the data is unavailable and never invent numbers. If the model is down, the frontend shows the library answer labelled "offline", which the base branch already does.

## 2. Separation of retrieval stores

| Store | Table | Filter | Can it return user data? |
|---|---|---|---|
| Scientific / OKF knowledge | `sci_chunks` (V14) | corpus_version active, region, role, status, trust, freshness | **No** (no user column) |
| Personal memory | `ai_memory` (V10) | `user_id = principal`, embedding_model | Only the caller's own data |
| Numbers | `factor_records` (V12) via FactorRegistry | exact `(factor_id, dataset_version)` | No |

Memory text and knowledge text are rendered in separate, labelled blocks. Neither can override the system prompt.

## 3. Ingestion (Cloud Run Job `knowledge-ingest`)

1. `pipeline.py fetch`: download http sources, verify the sha256 pins, and upload to `gs://<bucket>/raw/<sha256>.<ext>`.
2. `pipeline.py build` and `legacy_status.py`, then `export_sql.py`, which inserts into a **draft** `factor_dataset_versions` row.
3. `okf_producer.py` then `okf_validate.py`. Any conformance or policy error stops the job.
4. **Extraction:** OKF concepts are split per `#` section. Licensed source documents (`rag/corpus_manifest.v1.json` eligibility) go through pdftotext/openpyxl and are split into section-aware chunks (≈450 tokens, 60 overlap, tables kept whole).
5. **Embedding:** Vertex `text-embedding-005`, 768 dimensions, `RETRIEVAL_DOCUMENT` task type, written to a new `sci_corpus_versions` row with status `building`. Value sections are masked before embedding (registry pointer only).
6. **Validation:** chunk counts, no unmasked decimals in evidence chunks, the retrieval eval on the held-out set. Status becomes `validated`.
7. **Activation:** manual, by a person, to `active`. Rollback means re-activating the previous corpus version.

Embedding versioning: a model or dimension change creates a new corpus version. Mixed vectors are impossible because queries filter on `corpus_version` (and `embedding_model`, as V10 already does).

## 4. Retrieval

- Hybrid: `rag/hybrid_retrieval.sql`, which is `websearch_to_tsquery` + `ts_rank_cd` and pgvector `<=>`, fused by RRF (k=60). Executed on pgvector/pg16 against test chunks, it returned only admissible chunks: it excluded the GB, deprecated, stale and unverified-evidence rows.
- Reranking: the RRF output is reranked by `grade` (approved > machine-confirmed draft), `role` (evidence first for factual queries), and region exactness (direct > GLOBAL proxy). A cross-encoder reranker is deferred until the corpus is large enough to need one.
- Confidence: `none` (no admissible items), `low` (guidance only), `medium` (evidence present), `high` (evidence with a strong lexical score). Under `low` or `none`, the coach must not make evidence claims, and says it lacks a verified source.
- Link resolution: 1-hop OKF links are added as related titles. They are not quoted as evidence.

## 5. Tools (Phase C): `schema/coach_tools.v1.json`

| Tool | Backed by | Notes |
|---|---|---|
| getUserProfile | UserProfileService | region + `region_confirmed` (Decision 1) |
| getActivitySummary | ActivityLogRepository + `v_logged_emissions` | excludes unsupported and attribution rows; reports `unsupported_entries` and coverage |
| getEmissionFactors | FactorRegistry | the **only** route to a factor. Returns `not_estimated` / `regional_gap` with `missing_information` |
| getCarbonTrends | DashboardService aggregation | `logged_estimate` series |
| retrieveScientificEvidence | KnowledgeRetrievalService | never used for numbers |
| calculateEmissionComparison | Attested Computation `activity-emissions` | `hypothetical_reduction` |
| runCarbonTwinScenario | SimulationService (read-only), attested | projected credits `awarded: false` |
| getActionRecommendations | action_templates + per-user comparison | legacy template kg values forbidden |

Java shape (new package `com.ecotrack.ai.tools`, nothing existing changed):

```java
public interface CoachTool {
    String name();
    JsonNode inputSchema();                       // from coach_tools.v1.json
    ToolResult execute(UserPrincipal caller, JsonNode args, Duration timeout);   // read-only
}
public interface ToolCallingAIProvider extends AIProvider {          // composes with generateLive()
    ToolTurn generateWithTools(List<Message> convo, List<CoachTool> tools, ToolBudget budget);
}
```

`GeminiToolCallingProvider` maps tools to Vertex `FunctionDeclaration`s. `ToolBudget(maxIterations=3, maxCalls=6, deadline=15s)`. Authorisation: the `UserPrincipal` comes from `SecurityUtils.currentUserId()`. The schemas contain no user-id parameter, so a model-supplied id has nowhere to go (eval INJ-006, LEK-*). There is no SQL tool.

## 6. Knowledge consumer, Java port

`KnowledgeRetrievalService` (port of `okf_consumer.py`): run the hybrid SQL, assemble the context (`render_context` format), and record `knowledge_used`. `AttestationService`: Java port of `activity_emissions_attester.py` / `carbon_twin_attester.py`. Each displayed number carries a receipt, and a failing attestation blocks the number (§10.5 gate).

## 7. Prompt-injection and data isolation controls

| Vector | Control | Tested by |
|---|---|---|
| User message "ignore instructions…" | System prompt precedence; refusal patterns; answer verifier | eval INJ-001..010 |
| Instruction inside a knowledge document | `sanitize()` drops and flags the sentence; context marked as data | `test_okf_consumer.InjectionTest` |
| Fake `<tool_result>` in a user message | Tool results come only from the tool loop; user text is never parsed as a tool result | INJ-007 |
| Another user's data | Principal-bound tools; `ai_memory WHERE user_id`; `sci_*` has no user column | LEK-001..008, isolation test |
| Fabricated citation | Citation check against retrieved and tool sources; scorer `fabricated_citations` | scorer tests |
| Memory poisoning ("always say I saved 100 kg") | Memory rendered as user context, below policy; the kind check blocks "saved" | INJ-009 |

## 8. Evaluation gates

- Offline (CI, no cost): the 87 Python tests, `okf_validate`, the DB constraint suite, the retrieval eval (`okf_eval.py`), and the scorer self-tests.
- Online (staging, **needs approval**, Vertex cost ≈ $0.67 per 172-case run on 2.5 Flash, see the GCP doc): run the coach over `coach_eval.v1.jsonl` and score. Targets before production: pass rate ≥ 0.80; **zero** prohibited-claim hits in the `unsupported_saving_claims`, `prompt_injection` and `cross_user_leakage` categories; zero fabricated citations; numeric accuracy ≥ 0.95; tool-use accuracy ≥ 0.90; p95 latency ≤ 8 s.
- Baseline today: the offline library engine scores 0/172 (see `EVALUATION_REPORT.md`).

## 9. Human feedback (Phase D)

- **API:** `POST /api/ai/responses/{id}/feedback {rating: -1|1, reasons[], comment?, consent_research}`. The reasons come from the V15 label set: incorrect_number, wrong_citation, missing_citation, not_relevant, unsafe_advice, unsupported_claim, ignored_my_data, wrong_region, too_long, unclear, helpful, accurate, well_sourced.
- **UI** (coach page): thumbs on each AI reply, then reason chips, an optional comment, and an opt-in checkbox "Let Carbonexo reviewers use this conversation to improve the coach" (default off).
- **Reviewer workflow:** a reviewer role and `/admin/review`. The reviewer sees a PII-scrubbed prompt plus the tool snapshot, two candidate responses (A/B, order randomised), and a rubric (groundedness, citation, numeric, safety, helpfulness, 1–5), then picks a preference. Pairs need 2 independent reviewers before export.
- **Export:** a Cloud Run Job writes JSONL to `gs://<bucket>/preference/<date>/` containing only `consent_research = true`, `export_status = approved`, and never eval-linked rows (the DB constraint `eval_pairs_never_exported`). The eval-overlap test runs on every export.
- **Retention:** `ai_responses.expires_at` defaults to 180 days, with a nightly purge job. Account deletion cascades. A consent withdrawal sets `export_status = withdrawn` and purges unexported copies.
- **Tracking:** every feedback row joins to `ai_responses` (model, prompt version, factor dataset version, corpus version, OKF bundle digest), so the metrics can be sliced by model version.

## 10. Tuning (not started, by design)

The preconditions, all required: (1) the baseline RAG meets the §8 targets on the held-out set; (2) at least 1,000 reviewed SFT examples and at least 500 two-reviewer preference pairs, all consented; (3) the eval set is verified disjoint (test). Only then would a Vertex AI supervised-tuning experiment on Gemini 2.5 Flash be costed and proposed. Availability of Vertex preference tuning for that model must be confirmed at that time. No paid tuning job runs without approval.
