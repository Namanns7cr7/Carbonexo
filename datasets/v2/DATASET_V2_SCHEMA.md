# Carbonexo Dataset V2: Schema and Versioning

**Dataset version:** `2.0.0-candidate.2` · **Status:** candidate. Nothing is approved and nothing is in production.

Schema validity is necessary but **not** sufficient. A record can pass every schema and still be scientifically wrong. Correctness comes from provenance checks, the arithmetic tests, and human review (§7).

## 1. Separate datasets

| Dataset | Location | Contains | Must never contain |
|---|---|---|---|
| Source artifacts | `datasets/v2/raw/` (git-ignored; GCS in prod) | Publisher files, hash-pinned | Edits |
| Source manifest | `SOURCE_MANIFEST.json` | 17 entries: 16 sources + the audited team export. URL, date, licence, sha256, review notes | Values |
| Validated factor table | `build/candidate_factors.<v>.json` → `factor_records` (V12) | 80 numeric records with full provenance | Unsourced numbers |
| Legacy status | `reviewed/legacy_factor_status.csv` | 49 legacy values with Decision 3 handling | New values |
| Knowledge bundle (OKF v0.2) | `okf/bundle/ecomind/` | Explanatory concepts, rules, contracts | User data; authoritative numbers |
| Scientific RAG corpus | `rag/corpus_manifest.v1.json` → `sci_chunks` (V14) | Licensed text + OKF concepts | User data (no `user_id` column) |
| Evaluation set | `eval/coach_eval.v1.jsonl` + `eval/fixtures/` | 172 cases, 5 synthetic users | Real users; training use |
| Synthetic examples | `eval/fixtures/users.v1.json`, `impact/synthetic_population.sql` | Synthetic users only | Real PII |
| Preference data | `datasets/v2/preference/` (not created) → `ai_review_pairs` (V15) | Reviewed, consented pairs | Eval-linked pairs (DB constraint) |
| User memory | `ai_memory` (V10, existing) | Per-user coach memory | Anything retrievable cross-user |

Tests in `test_data_quality.py` enforce four of these separations: eval text never appears in training/preference data, no non-`example.com` email appears in datasets, the RAG corpus includes only licence-verified documents, and the scientific corpus has no `user_id`.

## 2. Factor record (`schema/factor_record.v2.schema.json`)

| Field | Meaning |
|---|---|
| `factor_id` | Stable dotted id `<domain>.<region>.<thing>[.<variant>]`; DESNZ ids end in `.yYYYY` |
| `record_kind` | `emission_factor` · `benchmark` · `equivalency` · `target` · `behavioural_estimate` |
| `value`, `unit` | Non-negative number; unit must have a denominator (`kg/kWh`, `kg/vkm`, `kg/pkm`, `kg CO2e/kg product`) |
| `region` | Where measured: `IN`, `GB`, `US`, `GLOBAL` |
| `applies_to_regions` | Regions where it is the direct default |
| `proxy_regions` | Regions where it may be used only with an uncertainty label |
| `applicable_year`, `scope`, `system_boundary`, `gases`, `statistic` | What the number covers |
| `source_id`, `source_url`, `source_locator`, `citation_of_record` | Exact provenance (table / row id / section) |
| `publication_date`, `license`, `license_status` | Licensing metadata |
| `verification_status` | How the **evidence** was checked: `verified_primary` · `verified_secondary` · `needs_manual_review` · `rejected` |
| `scientific_status` | Fitness for **claims**: `supported` · `provisional` · `unsupported` |
| `uncertainty` | `{level, notes}` |
| `superseded_by`, `valid_from`, `valid_to` | Versioning |
| `dataset_version` | Semver of the set the record belongs to |

### Rules the database also enforces (V12, tested by `proposed_migrations/test_constraints.sql`, 21/21 pass)

- `no_uk_us_for_india`: a GB/US record can never list `IN` in `applies_to_regions` or `proxy_regions` (Decision 1).
- `proxy_needs_uncertainty`: a proxy record needs `uncertainty_level` medium or high.
- `factor_records_unit_check`: a unit must carry a denominator.
- Records of an `approved`/`active` dataset version are immutable. Corrections ship as a new version.
- At most one `active` dataset version. Activation requires `approved_by` and `approved_at`.
- `activity_factor_map`: `not_estimated` rows must name the missing information, and `estimated` rows must reference an existing record.

## 3. Current contents (rechecked 2026-10-17)

| | Count |
|---|---|
| Factor records | 80 (51 verified_primary, 26 verified_secondary, 3 needs_manual_review) |
| Scientific status | 77 supported, 3 provisional, 0 unsupported (unsupported values stay in the legacy table) |
| Regions | GB 32 · GLOBAL 28 (25 usable as IN proxies) · IN 18 · US 2 |
| Indian grid electricity | `elec.grid.in.niti_annex_e.fy2024_25` = **0.710 kg CO2/kWh**, FY 2024-25, generation-side, CO2 only, excludes T&D losses; NITI Aayog 2026 Annexure E reproducing CEA v21.0. Arithmetic re-derived for all 12 years. CEA v22.0 exists, but its value is not retrieved (login wall), so supersession is unresolved. |
| Legacy values | 49: 47 `unsupported`, 2 `supported` (bike/walk = 0) |

## 4. Decision 1 (India first) in the data

- `user_profiles.region_confirmed`, `region_source`, `region_confirmed_at` (V13). Existing rows get `legacy_default` and are **never** reassigned. New Indian users get `suggested`, then `user_confirmed`.
- Lookup order: the confirmed region's direct factor, then a GLOBAL proxy (labelled with uncertainty), then `not_estimated`. GB/US values are never in that chain for an Indian user.
- The production electricity factor is **not** changed by this branch. `impact/impact_readonly.sql` previews the effect (synthetic data: +57.8% on electricity kg, because 0.710 / 0.45 = 1.578).

## 5. Decision 3 (unsupported factors)

| Field (`legacy_factor_status.csv`) | Production | Demo mode | AI |
|---|---|---|---|
| `scientific_status = unsupported` | `not_estimated`: "Not estimated" + `missing_information` | `illustrative_with_warning` | `forbidden`: never in a prompt as fact |

`getEmissionFactors` returns `status: not_estimated` with `missing_information` instead of a number. The scorer rejects any answer that states a legacy value (eval prohibited patterns).

## 6. OKF knowledge bundle (v0.2)

See `OKF_INTEGRATION.md`. Domain fields live under one `carbonexo:` key, so they can't collide with future OKF keys: `factor_id`, `region`, `unit`, `accounting_scope`, `applicable_year`, `source_table`, `license`, `scientific_status`, `internal_review_status`, `retrieval_role`, `numeric_authority`.

## 7. Approval workflow

1. **Candidate:** the pipeline builds `<x.y.z>-candidate.N` and the tests pass (87 Python tests plus the DB constraint suite).
2. **Scientific review (human):** a named reviewer checks each record against its source locator, marks it in `reviewed/human_reviews.csv` (`concept_id, reviewer, reviewed_at, verdict`), and signs off the dataset version. No tool writes this file.
3. **Approve:** `UPDATE factor_dataset_versions SET status='approved', approved_by=..., approved_at=now()`. The records become immutable.
4. **Activate (separate approval):** feature flag `factors.registry=v2` in staging, then the impact report, then production. Rollback: re-activate the previous version and flip the flag back.
5. **Never:** rewrite historical `activity_logs.co2_kg`, touch `credit_ledger`, or mark anything human-reviewed without step 2.

## 8. Versioning

- Factor dataset: semver. A minor bump means new records or new regions. A patch means metadata corrections. A major bump means a methodology change that alters values.
- OKF bundle: the `bundle_digest` (sha256 over all files) in `.okf-build.json`, recorded per answer in `ai_responses.okf_bundle_digest`.
- Eval set: `coach-eval.v1`. Regenerating from factors must reproduce the committed file exactly (test).
- Embeddings: `sci_corpus_versions(embedding_model, dimensions, chunking)`. A model change means a new corpus version, never in-place re-embedding.
