# Carbonexo Dataset V2: Audit and Source Verification

**Date:** 2026-10-17 · **Branch:** `feat/dataset-v2-audit` (isolated worktree `../Carbonexo-datasetv2`) · **Dataset version:** `2.0.0-candidate.1`

**Status: audit only. No production factor, migration, frontend route or cloud resource was changed.**

Companion files:
- [`FACTOR_DISCREPANCIES.csv`](FACTOR_DISCREPANCIES.csv): 61 findings with evidence and a verdict.
- [`SOURCE_MANIFEST.json`](SOURCE_MANIFEST.json): 15 sources with URLs, dates, licences and pinned hashes.
- [`reviewed/manual_transcriptions.csv`](reviewed/manual_transcriptions.csv): values transcribed by hand.
- [`../../scripts/dataset_v2/pipeline.py`](../../scripts/dataset_v2/pipeline.py): reproducible fetch, extract and validate pipeline.

---

## 1. Bottom line

1. **None of the 25 activity factors in production has a traceable source.** Migration V3 records their source as `'frontend catalog'`: the values were copied from `lib/carbon.ts`, so the provenance is circular.
2. **Every factor is `GLOBAL`, and every profile defaults to `GLOBAL`.** An Indian user is calculated with 0.45 kg/kWh electricity. CEA's FY 2024-25 all-India figure is **0.710**, so Indian users' electricity emissions are under-counted by about 37%.
3. **"CO₂ saved" is not a measurement.** It is computed as a fixed, unsourced 8.0 kg/day minus whatever the user logged. A user who logs nothing "saves" 8 kg/day.
4. **The coach shows citations it never used.** Gemini replies are displayed with source chips taken from a local keyword matcher. The backend prompt contains no sources, no factors and no user activity. The matcher also routes any message containing "carbon" to the car answer.
5. **Several citations and numbers are fabricated or misattributed:**
   - "IPCC AR6 8.5 kg/day": IPCC publishes no such figure.
   - "UNEP EGR 2023 – The Sound of Silence": the real title is "Broken Record".
   - "21.77 kg/tree/yr (US EPA)": EPA's figure is 60.
   - "38% below the regional peer average (11.0 kg/day)": a hardcoded string with no peer dataset behind it.

The good news: the arithmetic machinery is sound. `CarbonCalculationService`, `SimulationService` and the DB-driven factor lookup are a solid base for deterministic tools once they are fed verified, region-keyed factors.

## 2. Scope and method

| Inspected | Notes |
|---|---|
| `database/migrations/V1, V3, V7, V8, V9, V10` | V3 holds the 25 activity factors, 8 action templates, rewards and prompts. V7 holds the 8 embodied categories plus 8 alternatives. |
| `lib/carbon.ts`, `lib/api/dashboard.ts`, `lib/constants.ts` | Two frontend copies of the factor table. The `pipeline.py inventory` command confirms all three copies currently agree. |
| `lib/data/climate-knowledge.ts` | The 5 "research benchmarks" plus the keyword-routed coach generator. |
| `lib/api/{simulations,reports,score}.ts` | Offline fallback engines, including commit `86cff42`. |
| `app/app/{page,coach,scan}.tsx`, `public/{methodology,pitch}.html` | Hardcoded UI claims. |
| Java: `CarbonCalculationService`, `SimulationService`, `EmbodiedCarbonService`, `DashboardService`, `ReportService`, `GroupService`, `CreditService`, `AIService`, `CannedFallbackProvider`, `application.yml` | Calculation and AI paths. |
| pgvector memory (`V10`, `PgVectorCoachMemory`) | Reviewed for separation only. It is per-user and must remain separate from the scientific corpus. |

**Dataset exports.** `Carbonexo_Dataset_Export.md` (sha256 `1b461ef8…8021`) and `data.docx` (sha256 `a609c473…0825`) came from `Downloads/Telegram Desktop`. They contain the same content; the docx is a rendering of the .md. A copy of the .md is kept in [`legacy/`](legacy/Carbonexo_Dataset_Export.md), and the `inventory` command parses it as a fifth legacy copy.

**The export's numbers match the code exactly:**
- all 25 activity factors match V3, `lib/carbon.ts` and `lib/api/dashboard.ts`;
- the 8 embodied pairs match V7;
- the 5 benchmarks match `climate-knowledge.ts`.

**Three of the export's claims are wrong** (D58–D61 in the CSV):
- *"Nothing is hardcoded in frontend or backend code."* False. There are at least 9 hardcoded locations.
- *Section 3 is "the credible part of this dataset."* Most of it fails verification (see §3).
- *"Full citations are in the source file."* That file contains a fabricated report title.

The export's own label for section 1, *"illustrative placeholder values"*, is honest, but users never see that caveat.

**Infrastructure statement (not verified):** the export says production runs on Cloud SQL `carbonexo-db` (Postgres 16, `asia-south1`). This was not checked against GCP and will be confirmed read-only in the cloud deliverable.

**Worktrees checked:** `Carbonexo` (feat/carbonexo-living-world), `-cinematic`, `-living`, `-old`, `-physics`. This work lives in a new worktree so it does not collide with them. No migration was added, so the Flyway numbering (latest V11) is untouched.

**Source verification standard:**
- `verified_primary`: the number was read from the publisher's own file, with a hash pinned where it could be downloaded.
- `verified_secondary`: read from a reputable redistributor (OWID).
- `needs_manual_review`: the primary document was unreachable or the extraction was ambiguous.

Values without evidence were **rejected rather than filled in**.

## 3. What is credible, what needs correction, what lacks evidence

### 3.1 Credible (keep, with documented boundary)

| Item | Current | Verified | Source |
|---|---|---|---|
| Bike / walk | 0 | 0 operational | definition. Record boundary = operational only. |
| Chicken, eggs, tofu, cow milk (per kg) | 9.9 / 4.7 / 3.2 / 3.2 | 9.87 / 4.67 / 3.16 / 3.15 | Poore & Nemecek 2018 via OWID (CC BY 4.0). Milk is per **kg**, not per L. |
| Gasoline 8.887 kg CO₂/gal | 8.887 | 8.887 | US EPA. US-only, so no use for Indian users. |
| AC: ~6% per °C; ~24% for 20 → 24 °C | 6–8%, 24–30% | ~6%, ~24% | BEE India figures as reported in the press. **Wrongly attributed to US DOE.** The primary BEE document has not been located, so this stays `needs_manual_review`. |

### 3.2 Requires correction (a source exists; the app's value, unit, region or attribution is wrong)

| Item | Current | Verified evidence | Problem |
|---|---|---|---|
| Home electricity + 3 appliances | 0.45 kg/kWh "global / EPA eGRID" | **0.710** IN, FY 2024-25 (CEA v21, CO₂ only, generation-side) | Wrong region. eGRID is US-only. Appliances double-count the meter total. |
| Car | 0.18 /km | 0.16152 GB 2026 (per vehicle-km); 0.117–0.130 IN petrol hatchback | Region. Vehicle-km and passenger-km are mixed up. |
| Motorbike | 0.10 /km | 0.11367 GB; ~0.029–0.054 IN | About 2–3× too high for typical Indian two-wheelers. |
| Bus | 0.08 /km | 0.10151 GB /pkm; **0.0152** IN intracity STU /pkm | Region and unit. The India value is CO₂-only and from 2015. |
| Flight | 0.25 /km | 0.22928 with RF / 0.13552 without (GB domestic) | Radiative-forcing basis not stated. Unit should be passenger-km. |
| Daily budget 8.5 kg | 8.5 kg/day; "2,500 kg/yr = 6.8–8.5 kg/day" | 2,500 kg/yr = **6.85 kg/day** | Arithmetic: 8.5 kg/day is 3,103 kg/yr. Misattributed to IPCC; the source is IGES et al. 2019. **Scope mismatch:** the target covers the whole lifestyle footprint, but the app tracks only 5 categories. |
| 2050 cap | 2.1 kg/day | 0.7 t/yr = **1.92** kg/day | Arithmetic. |
| Beef | 60 kg/kg | 99.48 (global mean) | The statistic (mean or median) is not stated. |
| Lentils | 0.9 kg/kg | 1.79 ("other pulses") | P&N has no lentil category. 0.9 is not supported. |
| Tree equivalence | 21.77 kg/tree/yr "US EPA" | **60** kg CO₂/tree/yr (EPA, US urban tree, 10-yr average) | Wrong value and misattributed. The dashboard uses 20 kg with no time period. |
| DESNZ benchmarks (car 0.171, rail 0.035, bus 0.096) | "DEFRA 2024" literals | 2026: 0.16152 / 0.03092 / 0.10151 | Stale and UK-only. The 2026 UK grid fell 26%, so rail factors move every year. |
| Client simulation fallback | per_month 0.25, unknown factor → 0.18, fake 45% progress | backend: 1/4.33, explicit errors | Two engines that diverge. Shows hypothetical savings as fact. |
| Electricity / transport AI prompts | factor 0.45; `travel_logs = "[]"` | — | Uses the wrong region factor and an empty context. |
| Coach keyword router | `includes('car')`, `includes('ac')` | — | "carbon", "track" and "impact" are mis-routed. |

### 3.3 Insufficient evidence (do not ship a number; show "not estimated")

| Item | Why |
|---|---|
| All 7 meal factors (beef 5.0, chicken 1.2, fish 1.3, veg 0.6, vegan 0.4, dairy 1.0, food delivery 0.6) | No serving or recipe is defined. Beef 5.0 implies about 50 g of beef, while the knowledge base says 200 g = 12 kg. They must be rebuilt as ingredient-grams × verified per-kg factors, with Indian staple recipes. |
| **Food delivery vs meal** | The boundary is undefined. 0.6 kg looks like a meal, which double-counts if the meal is logged too. The app's own "cook at home" action implies ~1.07 kg per delivery. Remodel as an add-on only: last-mile km plus a sourced packaging factor. |
| **Clothing 10 vs 22** | Two unsourced values for the same purchase (shopping vs embodied). Garment footprints vary more than 10× by type and fibre. |
| **Electronics 30 vs 85** | Two unsourced values. A "generic device" is undefined: phone, laptop and TV differ by an order of magnitude. |
| Online order 2.5, groceries 1.0 | Undefined boundaries; they overlap products and meals. |
| Waste (0.5 / 0.2 / 0.4 per "item") | Undefined unit. The result depends on the treatment route. Food waste re-counts food already counted. |
| Metro in India | UK factors don't transfer (the UK grid is ~5× cleaner). No published Indian per-pkm metro factor was found. |
| All 16 V7 embodied rows | The migration itself calls them "illustrative". "kg saved" is the difference of two unsourced numbers. |
| 8 action-template savings | No derivations. The metro action alone has three conflicting numbers in the codebase (4.2, 5.1, 8.0 kg/wk). |
| 1.5 TR AC "1.8 kW"; oat milk 0.9; "US/EU 12–16 t" | No source given. |

### 3.4 Rejected (fabricated, misattributed, or structurally wrong)

- **CO₂ saved = 8.0 kg/day − logged** (`DashboardService:89`, `ReportService:31`, `GroupService:42`). The baseline is unsourced and under-logging is rewarded.
- **Offline ESG report:** `lifetimeCo2SavedKg = 42.5`, a fixed account start date, and default category totals, labelled "verified local carbon ledger" (`lib/api/reports.ts`). The offline score has default balance, streak and active-day constants (`lib/api/score.ts`).
- **"38% below regional peer average (11.0 kg/day)":** hardcoded (`app/app/page.tsx:358`).
- **Canned AI fallback** asserts user facts it cannot know ("You primarily use a car", "footprint decreased by 8%").
- **Coach citation chips** on Gemini replies (`app/app/coach/page.tsx:196-222`), and the welcome claim "grounded in verified data from DEFRA, Oxford, EPA, IPCC".
- **Citations:** "IPCC AR6 lifestyle threshold 8.5 kg/day"; "UNEP (2020) Target Emission Allowances"; "UNEP EGR 2023 – The Sound of Silence".
- **Other claims:** "66× per gram of protein" (it was computed per kg); "Meatless Mondays −38% / 603 kg/yr"; "6 weeks of household electricity"; "Coal peak 0.820"; "New York to Chicago".
- **`'frontend catalog'`** recorded as a source.

## 4. Double-counting rules Dataset V2 must enforce

1. **Electricity:** the household meter or bill kWh is the total. Appliance entries are an attribution view, never added on top for the same period. (GHG Protocol Scope 2 location-based accounting; one meter, one figure.)
2. **Food:** account for food either by purchases (groceries) or by consumption (meals) per user-period, never both. Food waste counts disposal only.
3. **Delivery:** delivery = transport leg + packaging only. The product or meal is logged separately.
4. **Purchases:** one factor per product type. The shopping table and the embodied table must merge into one product-factor dataset.
5. **Transport:** vehicle-km factors are divided by occupancy only when the user states occupancy. Passenger-km factors are never divided again.
6. **Reductions:** "logged emissions", "estimated reduction from an adopted action" and "hypothetical simulation" are three separate quantities with separate labels. Credits must not be minted from hypotheticals.

## 5. Indian applicability

| Category | Best verified Indian source found | Status | Gap |
|---|---|---|---|
| Grid electricity | CEA CO₂ Baseline Database v21.0 (FY 2024-25: 0.710) | needs_manual_review (PDF behind login) | v22.0 (Aug 2026) exists but values were not retrieved. T&D-loss treatment not decided. |
| Cars, 2W, 3W, bus | India GHG Program 2015 v1.0 | verified_primary (hash pinned) | 2015 fleet, rated efficiency, CO₂-only, tank-to-wheel. Two-wheeler table needs a manual read. |
| Metro / rail | none | — | Need DMRC/BMRCL reports, Indian Railways data, or a documented derivation. |
| Food | Poore & Nemecek global means | verified_secondary | No India-specific LCA set reviewed. Indian recipes still need defining. |
| Waste | none | — | IPCC 2006 Vol. 5 methods with Indian parameters are the candidate. |
| Behavioural (AC) | BEE ~6%/°C | needs_manual_review | Locate the primary BEE/MoP document. |

UK (DESNZ) and US (EPA) values stay in Dataset V2 as region-tagged reference records, never as defaults for `IN`.

## 6. Reproducibility (implemented in this branch)

```
python -I scripts/dataset_v2/pipeline.py all       # fetch -> inventory -> build -> validate
python -I -m unittest discover -s scripts/dataset_v2 -p "test_*.py"
```

Current run:
- 5 sources fetched and hash-verified; 10 are manual.
- 4 legacy issues detected automatically across 5 legacy copies (V3, V7, two frontend files, the team export).
- **77 candidate factors** built, with 0 schema errors: 48 verified_primary, 25 verified_secondary, 4 needs_manual_review.
- 7 tests passing.
- The validator **rejected** the BEE AC row because no primary URL exists, so that row was removed from the candidate set.
- Raw downloads go to `datasets/v2/raw/` (git-ignored) and are only parsed, never executed. A hash mismatch fails the build.

The candidate set is **not** a replacement for production factors. It is the evidence base from which mapped, reviewed rows will be promoted.

## 7. Decisions needed from you before the next phase

1. **India grid factor:** someone with CEA portal access should download the v21 and v22 user guides so their hashes can be pinned. Also decide whether to include T&D losses (that needs its own sourced loss figure).
2. **Default region:** should new profiles default to `IN`? (Recommended.)
3. **"CO₂ saved" and credits:** approve replacing the 8.0 kg/day baseline with action-level estimated reductions. *Corrected in Phase 2:* no credit balance depends on it (`onCarbonSaved()` is never called; 0 `kg_saved` ledger rows), so only displayed "saved" figures, the reports page and group goal progress change. See `CO2_ACCOUNTING_REDESIGN.md`.
4. **Unverified categories** (meals, clothing, electronics, online orders, waste, embodied): show "not estimated / illustrative", or keep the legacy value with a visible "unverified" badge?
5. **RAG licensing:** OGL (DESNZ), CC BY (OWID) and public-domain (EPA) text can go into the corpus. P&N (AAAS), India GHGP, IGES, CEA and IPCC need their terms confirmed first.

## 8. Later phases (added 2026-10-17)

The deferred deliverables now exist. Start from `ECOMIND_ARCHITECTURE.md`:
- `DATASET_V2_SCHEMA.md`, `schema/*.json`, `proposed_migrations/V12–V15` (drafts, outside Flyway's path)
- `eval/coach_eval.v1.jsonl` (172 cases, machine-checked, **human review pending**) and `EVALUATION_REPORT.md`
- `CO2_ACCOUNTING_REDESIGN.md` (Decision 2 impact report), `VERIFICATION_POLICY.md`
- `OKF_INTEGRATION.md` + `okf/bundle/ecomind/` (15-concept OKF v0.2 pilot)
- `RAG_INTEGRATION_PLAN.md`, `GOOGLE_CLOUD_COST_AND_DEPLOYMENT.md`, `KNOWLEDGE_CATALOG_FEASIBILITY.md`
- `FINDINGS_STATUS_2ad7b61.csv`: which findings the base branch has fixed since this audit

No fine-tuning, cloud jobs, deployment, push or merge has happened.
