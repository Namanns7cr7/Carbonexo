# EcoMind Knowledge Bundle: Open Knowledge Format v0.2 Integration

**Spec:** [GoogleCloudPlatform/open-knowledge-format `SPEC.md`](https://github.com/GoogleCloudPlatform/open-knowledge-format/blob/main/SPEC.md), v0.2 (canonical repo; latest commit read 2026-08-21, `ad30107`). The frozen copy in the knowledge-catalog repo was not used.

**Status:** a 15-concept pilot, generated and verified. Full conversion waits for your review of the pilot.

## 1. What OKF gives us, and what it does not

OKF standardises *how knowledge describes itself*: `type`; provenance (`sources`); trust (`generated`, `verified`, and the derived tiers unverified / machine-confirmed / human-reviewed); lifecycle (`status`, `stale_after`); and attested computations. It deliberately does not judge truth. In the spec's terms, a conformant concept carrying only `type` is valid (§11).

So the integration has three layers:
1. **OKF conformance:** structural. Checked by `okf_validate.py` against §11.
2. **Carbonexo verification policy:** `/policies/verification-policy.md` in the bundle, plus `VERIFICATION_POLICY.md`. This decides what can support a claim.
3. **Authoritative numbers:** the factor registry plus Attested Computations. OKF documents *explain* factors. They never supply the number.

## 2. Bundle layout (`okf/bundle/ecomind/`)

```
index.md                         okf_version: "0.2" (the only frontmatter allowed in an index)
log.md                           ISO-dated history, newest first
sources/        Scientific Source      niti-2026-power, indiaghgp-road-2015, desnz-2026-flat
regions/        Region                 in
factors/in/     Emission Factor        elec-grid-fy2024-25, car-petrol-hatch-lt1400cc, bus-intracity-stu
factors/gb/     Emission Factor        rail-national-2026        (UK only; region-isolation test)
factors/legacy/ Emission Factor        clothing-item             (status: deprecated, unsupported)
methodology/    Methodology            in-grid-electricity       (regional method + calculation boundary)
accounting/     Accounting Rule        meter-vs-appliance        (double counting)
computations/   Attested Computation   activity-emissions, carbon-twin-scenario
tools/          Tool Contract          get-emission-factors
policies/       Verification Policy    verification-policy
references/     executors/*.py, attesters/*.py   (not .md, so not concepts)
.okf-build.json run record: producer, run_at, source checks, per-file sha256, bundle_digest
```

That covers every category you listed. Batch 2 (after pilot sign-off) adds sustainability recommendations, GLOBAL food proxies, the remaining Indian and DESNZ factors, the purchases-vs-meals and delivery-vs-meal rules, and the other 7 tool contracts.

## 3. Frontmatter mapping

| OKF field | Carbonexo use |
|---|---|
| `type` | Scientific Source · Region · Emission Factor · Methodology · Accounting Rule · Attested Computation · Tool Contract · Verification Policy |
| `title`, `description`, `tags` | From the registry / manifest, or authored |
| `resource` | Factors: `carbonexo://factor-registry/<dataset_version>/<factor_id>`. Sources: the publisher's landing URL |
| `sources[]` | Factors point at the **source concept** (`/sources/<id>.md`), so lineage is a bundle edge (§5.1). Source concepts point at the publisher URL, with `last_modified` only when an exact date is known |
| per-claim footnotes | `[^<sources.id>]`, validated to resolve |
| `generated` | `carbonexo-okf-producer/0.1.0` for data-derived concepts; `claude-code/claude-opus-5-5` for the five authored concepts. `at` is the real last content change |
| `verified` | `process:carbonexo-source-check`: the producer re-read the value from the hash-pinned artifact **in that run** and it matched (4/4 factors). `process:carbonexo-source-fetch`: the artifact sha256 matched its pin (3/3 sources). `human:<id>` **only** from `reviewed/human_reviews.csv`, which is empty, so there are **0 human events** |
| `status` | Always explicit: `draft` (14) until a human review; `deprecated` (1) for the unsupported legacy value. `stable` is reserved for human-reviewed concepts (policy check) |
| `stale_after` | Per source cadence. CEA/NITI-derived concepts expire 2026-12-31 (CEA v22.0 is unverified); DESNZ 2026 on 2027-06-30; authored rules after 6 months; tool contracts after 3 |
| `carbonexo:` (extension) | `factor_id, value, unit, region, applies_to_regions, proxy_regions, accounting_scope, applicable_year, source_table, license, scientific_status, evidence_verification, uncertainty, internal_review_status, retrieval_role, numeric_authority` |

Attested Computations follow §10: `runtime: python` (the reference executor). The `parameters` are the only thing the model supplies. `executor.receipt` lists the evidence fields. `attester` is deterministic code that re-reads the registry and recomputes, comparing against the receipt **and** the number shown to the user.

## 4. Producer (`scripts/dataset_v2/okf_producer.py`)

- Inputs are read-only: candidate factors, manifest, legacy status, tool contracts, pilot config, authored templates, raw artifacts. **No original data file or migration is modified.**
- Source checks: NITI by pdftotext row match plus CO2/generation ratio; India GHG Program by pdftotext value match; DESNZ by re-extraction by row ID from the pinned xlsx. If pdftotext or the artifact is missing, no `verified` event is written.
- It refuses to build if an authored template carries a `human:` event.
- The output is reproducible: regenerating with the recorded `run_at` reproduces every file hash (test).

## 5. Validator (`scripts/dataset_v2/okf_validate.py`), current result

```
concepts 15 · okf_conformant true · spec warnings 0
trust tiers: machine-confirmed 7, unverified 8 · statuses: draft 14, deprecated 1
policy: errors 0, broken links 0, conflicts 0, stale 0 (at 2026-10-17), missing evidence 0
```

Policy checks: registry agreement (value, unit, region, version, status); source concept linkage; Decision 1; unsupported means deprecated, not estimated and ai_use forbidden; `stable` requires a human review; every `human:` event needs a review row; no future timestamps; broken internal links; staleness; duplicate factor ids; measure conflicts (`in.grid.weighted_average.FY2024-25`: NITI and CEA v21 agree at 0.710); no user data in the bundle.

## 6. Consumer / indexer (`scripts/dataset_v2/okf_consumer.py`; Java port in `RAG_INTEGRATION_PLAN.md`)

1. Parses concepts with the same loader convention as the OKF reference agent (timestamps kept as authored text).
2. Section chunks carry every provenance field: type, role, grade, trust tier, status, stale_after, region and proxy regions, citations (claim-level from footnotes, concept-level fallback, marked as such), and the registry pointer.
3. **Numeric masking:** decimals in evidence concepts are replaced by `[value withheld: use getEmissionFactors]`. Factor value sections become a registry pointer.
4. Hybrid retrieval: BM25 locally; in production, Postgres `ts_rank_cd` plus pgvector cosine fused by reciprocal rank (`rag/hybrid_retrieval.sql`, executed successfully on pgvector/pg16).
5. Filters by region (GB/US never reach IN), role, trust, status and freshness, applied **in SQL** in production.
6. Resolves 1-hop links as "related" titles and descriptions.
7. Renders a delimited context block that says the passages are data and that numbers come only from tools.
8. Records `knowledge_version` (`bundle_digest`, okf_version, dataset_version) and `concepts_used` with `generated_at`, persisted per answer in `ai_responses.okf_bundle_digest` and `knowledge_used` (V15).

Injection handling: sentences inside concepts that read as model instructions are dropped and flagged (tested with a planted payload). The scientific retriever has no access to `ai_memory`, logs or users (structural test, and V14 has no `user_id` column).

## 7. Tests

`test_okf.py` (25) and `test_okf_consumer.py` (13) are part of the 87-test suite. Every policy rule has a negative test that mutates a copy of the bundle and confirms the violation is caught: fabricated human review, stable without review, future timestamp, value drift, UK-as-India proxy, unsupported promoted, broken link, orphan footnote, user data, a missing `type`, and a subdirectory index with frontmatter. There are also positive tests: unknown types and keys are tolerated (§11), and a bare `verified` mapping counts as a one-element list (§5.2).

## 8. OKF is not RLHF

The bundle is curated *knowledge* with provenance. It is not preference data and must not substitute for it. Human feedback and preference pairs stay in their own pipeline (`ai_feedback`, `ai_review_pairs`; `RAG_INTEGRATION_PLAN.md` §9). Eval-linked pairs can never be exported (DB constraint).
