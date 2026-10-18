---
type: Accounting Rule
title: Meter total vs appliance entries (no double counting)
description: A household meter or bill reading is the electricity total; appliance entries attribute a share of it and are never added on top.
tags: [accounting, double-counting, electricity]
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-17T08:40:00Z }
stale_after: 2027-04-17T00:00:00Z
sources:
  - id: ghg-protocol-scope2-scope3
    resource: https://ghgprotocol.org/standards
    title: GHG Protocol Scope 2 Guidance (methodology reference; license unverified, not quoted)
carbonexo:
  accounting_scope: household electricity
  rule_id: accounting.electricity.meter_is_total
  enforced_by: [v_logged_emissions.counts_toward_total, activity_logs.attribution_of]
  internal_review_status: pending_human_review
---

# Rule

For one household and one period, electricity is counted once. When a meter reading or confirmed bill covers the period, that kWh figure is the total. Air-conditioning, geyser and laundry entries are **attribution**: they say how much of the total went where, and they carry `attribution_of` pointing at the meter or bill log.

# Examples

| Logged | Counted kWh | Why |
|---|---|---|
| 250 kWh bill + 60 kWh AC | 250 | AC is inside the bill |
| 42 kWh meter + 14 kWh AC attribution | 42 | Attribution rows are excluded from totals |
| 14 kWh AC only, no meter or bill | 14 | Nothing else covers the period |

# Where it is enforced

- Database: the proposed `v_logged_emissions.counts_toward_total` excludes rows with `attribution_of`.
- Calculations: [activity emissions computation](/computations/activity-emissions.md) receives only counted rows.
- Coach: answers about totals must not add appliance rows to a meter total. Eval cases DBL-001, DBL-005 and DSH-004 test this.

# Related rules

Purchases-vs-meals and delivery-vs-meal follow the same "count each emission once" principle and will be separate concepts in batch 2.
