# CO2 "Saved" Redesign: Impact Report and Safe Migration Proposal (Decision 2)

**Status:** proposal. No production change has been made. Rewards, credits and historical accounting changes need explicit approval.

## 1. What is wrong today

`CarbonCalculationService.carbonSaved()` computes `max(0, 8.0 kg/day x days - logged kg)`. The 8.0 kg/day figure has no source. On the base branch (`2ad7b61`) it still drives:
- `DashboardService.totalSaved` (computed; the dashboard UI no longer shows it),
- `ReportService` "lifetime CO2 saved" (shown on the Reports page),
- `GroupService` goal progress.

Two frontend constants add to this: `lib/api/reports.ts` falls back to 42.5 kg, and the store seeds `savedBaseline: 42`.

The formula splits exactly into two parts:

```
old_saved = 8*(D - L)     <- credit for days with NO logs
          + (8*L - E)     <- baseline minus logged kg on logged days
```

where D = days in the window, L = days with at least one log, and E = logged kg.

## 2. Measured impact (synthetic population, reproducible)

Method: a throwaway Postgres 16 + pgvector container runs migrations V1–V11, the demo seed, and `impact/synthetic_population.sql`. That population is 300 users with accounts 30–180 days old and five logging-habit buckets (0 / 10 / 30 / 60 / 90% of days), using legacy factors. Then `impact/impact_readonly.sql` runs inside a `READ ONLY` transaction. Two independent rebuilds produced identical figures.

| Metric | Value |
|---|---|
| Users | 301 |
| Users who never logged | 60 |
| Users shown a positive "lifetime saved" | **301 (100%)** |
| Users shown "saved" with **zero** logs | 60 |
| Total "lifetime saved" | 183,509 kg |
| of which from users with zero logs | 53,568 kg |
| Unlogged-day component | 159,320 kg |
| Logged-day component | 24,189 kg |
| **Share of gross "saved" caused by not logging** | **86.8%** |
| Users eligible for a V2 personal baseline (≥14 logged days in the last 28) | 116 |
| Credit balance total | 33,725, **unchanged by any proposal** |
| Ledger rows from the `kg_saved` rule | **0** |

The last row matters most: `CreditService.onCarbonSaved()` is never called. **No credit balance anywhere depends on the 8 kg/day figure.** Replacing it changes displayed "saved" numbers, the reports page and group goal progress. It does not change balances.

Real-data numbers come from running `impact_readonly.sql` against a production snapshot or read replica. That run needs your approval.

## 3. Proposed quantities (kept separate end to end)

| Quantity | Source | UI wording | Can mint credits? |
|---|---|---|---|
| Logged estimated emissions | `v_logged_emissions` (activity × factor in force) | "Logged: 37.9 kg (estimate)" | No |
| Personal baseline estimate | `personal_baselines` (V13), only with ≥14 logged days in 28 | "Your typical week: ~42 kg (from 28 days of logs)" | No |
| Hypothetical reduction | Carbon Twin / `calculateEmissionComparison` (attested) | "If you switched…: −34.8 kg/month (hypothetical)" | No (projected credits are shown as not awarded) |
| Self-reported action completion | `user_plans.done` | "You marked this done" | Yes, existing `action_done` rule, unchanged |
| Estimated reduction from an adopted action | `reduction_estimates` (V13): observed vs the user's own baseline, labelled with evidence level | "Estimated change since you started: −3.1 kg/week" | Not without a new, approved rule |
| Verified measurement | Confirmed bill (`bills.status = CONFIRMED`) linked via `activity_logs.verified_by_bill_id` | "From your confirmed bill" | Yes, existing `bill_upload` rule, unchanged |
| In-app green credits | `credit_ledger` (append-only) | "Credits (app points, not CO2)" | n/a |

"Saved" or "avoided" never appears without one of these qualifiers. The eval set enforces this through prohibited-claim patterns in 10+ cases.

## 4. Safe migration (each step reversible, each needs approval)

1. **Read-only measurement:** run `impact_readonly.sql` on a production snapshot. Nothing is written.
2. **Additive schema:** copy V12–V15 into `database/migrations` (they are additive; checksums prove `activity_logs` original columns, `credit_ledger`, the ledger sum and profile regions are byte-identical before and after).
3. **Dual read, flagged:** add `accounting.saved_metric=legacy|v2` (app_config). Under `v2`, the dashboard and reports show logged estimates, personal-baseline-relative estimates (when eligible), and "Not enough logging to estimate a change" otherwise. Under `legacy`, the old behaviour stays, labelled "legacy estimate".
4. **Staging A/B** on synthetic and opt-in accounts, compared with the impact report.
5. **Production switch** of the flag. Rollback means flipping it back. No data was migrated, so nothing needs undoing.
6. **Later, separately approved:** retire `carbonSaved()`, remove the frontend 42.5 / 42 constants, and decide whether a new credit rule should reward *verified* reductions.

Never done: recalculating historical credits, editing `credit_ledger`, or rewriting historical `co2_kg`.

## 5. Optional hardening (needs approval: it alters a table's behaviour)

`credit_ledger` is append-only only by convention. A `BEFORE UPDATE OR DELETE` trigger that raises an exception would enforce it. It is **not** included in the drafts, because you asked that the ledger not be modified.
