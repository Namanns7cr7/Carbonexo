---
type: Methodology
title: Indian grid electricity emissions (location-based)
description: How Carbonexo converts an Indian household's grid electricity use into kg CO2, and what that number does and does not include.
tags: [india, electricity, scope-2, methodology]
status: draft
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-17T08:40:00Z }
stale_after: 2026-12-31T00:00:00Z
sources:
  - id: niti-2026-power
    resource: /sources/niti-2026-power.md
    title: NITI Aayog (2026) Sectoral Insights - Power, Annexure E
carbonexo:
  region: IN
  accounting_scope: location-based grid average (GHG Protocol Scope 2 location method, applied to a household)
  internal_review_status: pending_human_review
---

# Method

emissions_kg = grid_kWh x [India grid weighted-average factor](/factors/in/elec-grid-fy2024-25.md)

The factor is CEA's all-India weighted average, total CO2 divided by total net generation including renewables, as reproduced in NITI Aayog's Annexure E.[^niti-2026-power] Computation runs through the [activity emissions computation](/computations/activity-emissions.md), never through free text.

# Boundary

- **Gas:** CO2 only, not CO2e.
- **Generation-side:** the factor is per unit of net generation. It **excludes transmission and distribution losses**. Carbonexo does not apply a T&D uplift, because no reviewed Indian loss figure is in Dataset V2. Answers must say this rather than invent a percentage.
- **Grid-imported kWh only:** self-consumed rooftop solar is not multiplied by this factor. Net-metering export accounting is not modelled.
- **All-India:** no state-level or DISCOM-level factors are in Dataset V2.

# Year selection

Use the latest verified fiscal year for current bills. Older fiscal-year values are kept for historical previews only. CEA has published v22.0 (expected FY 2025-26 data), but its values are not verified in Dataset V2, so no FY 2025-26 number is given. This concept goes stale on 2026-12-31 to force that recheck.

# Household accounting

A bill or meter reading is the household total. Appliance entries are an attribution view of that total; see [meter vs appliance](/accounting/meter-vs-appliance.md).

[^niti-2026-power]: NITI Aayog (2026) Sectoral Insights - Power, Annexure E
