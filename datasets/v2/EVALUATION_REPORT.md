# EcoMind Evaluation Report: Coach Baseline and Flat RAG vs OKF-Enriched RAG

**Date:** 2026-10-17 · **Eval set:** `coach-eval.v1`, 172 cases, 17 categories, all `machine_checked`, **human review pending** · **No paid model calls were made.**

## 1. What was measured and what was not

| Measured (offline, deterministic) | Not measured yet (needs Gemini runs: approval + cost) |
|---|---|
| Current offline coach engine on all 172 cases | Gemini-backed coach answers |
| Retrieval quality: flat RAG vs OKF RAG on 72 labelled cases | Answer-level scientific groundedness and explanation accuracy |
| Region isolation, stale / deprecated leakage, numeric exposure, citation resolvability | LLM-judge or human-judged helpfulness |
| Attestation correctness of the numeric computations | Latency and cost of the real tool loop |

## 2. Current coach baseline (offline library engine, `lib/data/climate-knowledge.ts`)

This is the engine the Coach page uses whenever the backend is unreachable. It is unchanged on the base branch `2ad7b61`.

| Metric | Value |
|---|---|
| Full pass | **0 / 172** |
| Content-only pass (ignoring tool / citation plumbing) | 5 / 172 (2.9%). Manual inspection: all 5 are coincidental number matches from generic template text |
| Cases with prohibited claims | 25 (UK DEFRA/DESNZ or US eGRID presented to Indian users; "8.5 kg/day"; "600 kg/yr"; "peer average") |
| Cases with ungrounded numbers | 172 / 172 |
| Tool use / citation recall | 0 / 0 (no tools; free-text citations do not resolve to any source id) |
| Numeric accuracy | 0.105 (coincidental) |
| Latency p50 | 0.01 ms (no model) |

Scorer validation: an oracle answer set hits 100% of the expected numbers. The adversarial checks catch the legacy 0.45 factor, a cross-user leak, fabricated citation ids and "38%"-style percent coincidences. Building these checks found two real bugs, which are fixed: a number regex that read "2500" as "250", and percentages matching kg values. One eval-design error was also caught by a test and corrected: an Indian tree-equivalence case had used the US EPA factor.

## 3. Flat RAG vs OKF-enriched RAG (pilot bundle, 15 concepts)

Same chunks, same BM25 scorer, k = 3, and 72 eval cases that have at least one relevant pilot concept. The rule-based labels are in `eval/okf_pilot_relevance.v1.json`, with review pending. The only difference between the two systems is the OKF layer.

### 3.1 Knowledge fresh (2026-10-17)

| Metric | Flat RAG | OKF RAG |
|---|---|---|
| Precision@3 | 0.236 | **0.255** |
| Recall@3 | 0.340 | **0.384** |
| MRR | 0.387 | **0.447** |
| UK/US documents served to Indian questions | 5 | **0** |
| Deprecated / stale documents served as evidence | 5 | **0** |
| Cases where raw factor numbers reached the context | 28 | **0** |
| Items with a resolvable citation | 0% | **62.6%** |
| Items carrying a trust / status label | 0% | **100%** |

### 3.2 After the grid concepts go stale (2027-01-05)

| Metric | Flat RAG | OKF RAG |
|---|---|---|
| Precision@3 / MRR | 0.236 / 0.387 | 0.171 / 0.324 |
| Stale or deprecated served as evidence | **61** | **0** |
| Raw numbers in context | 28 | 0 |

The lower OKF precision after staleness is the intended behaviour. The stale Indian grid evidence is withheld and confidence drops to low, so the coach says it lacks a current verified source. The flat baseline keeps its precision only by silently serving 61 stale items.

### 3.3 Reading these results

- **Where OKF helps:** trust, freshness, regional factor selection and citation correctness. These are large, unambiguous effects. Relevance improves modestly: MRR +0.06.
- **Contradiction detection** is a bundle-level property: the validator reports `in.grid.weighted_average.FY2024-25`, where NITI and CEA v21 agree at 0.710. The coach-level test of contradictory-source handling (8 eval cases) needs generation.
- **Limits:** a 15-concept pilot; lexical retrieval only (the vector half needs Vertex embeddings, a negligible cost but still requiring approval); rule-based relevance labels; no answer generation. These numbers support continuing to batch 2. They do not show that the coach is grounded.

## 4. Numeric attestation

`activity_emissions` and `carbon_twin` executors plus attesters: 250 kWh × 0.710 gives 177.5 kg, which passes. A tampered factor, result, displayed value or registry hash each fails. Occupancy is refused for per-passenger factors. Unsupported factors are refused. The Carbon Twin delta (−34.808 kg) matches eval case TWN-001's expected value within its 2% tolerance (−34.8077 in the eval was computed from unrounded legs).

## 5. Next measurements (each needs approval)

1. Vertex embeddings for the pilot (≈150k tokens, < $0.02) to measure hybrid vs lexical retrieval.
2. A staging coach run over all 172 cases with tools + OKF RAG on Gemini 2.5 Flash (≈ $0.67 per run), scored by `scoring.py`, then compared with a no-RAG Gemini run on the same cases.
3. Human review of 30 sampled cases and of the relevance labels before any threshold is trusted.
