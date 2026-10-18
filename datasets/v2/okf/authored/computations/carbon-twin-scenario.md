---
type: Attested Computation
title: Carbon Twin replace-with scenario
description: Hypothetical emissions change from replacing a recurring activity with another over a month or a year, as the Simulate screen computes it.
tags: [computation, carbon-twin, simulation, hypothetical]
status: draft
runtime: python
parameters:
  - { name: baseline_factor_id, type: string, required: true }
  - { name: replacement_factor_id, type: string, required: true }
  - { name: dataset_version, type: string, required: true }
  - { name: quantity, type: number, required: true }
  - { name: frequency, type: string, required: true }
  - { name: horizon, type: string, required: true }
executor:
  resource: /references/executors/carbon_twin.py
  receipt: [baseline_factor_id, replacement_factor_id, dataset_version, quantity, frequency, horizon, horizon_weeks, baseline_kg, projected_kg, delta_kg, quantity_kind, registry_sha256]
attester:
  resource: /references/attesters/carbon_twin_attester.py
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-17T08:40:00Z }
stale_after: 2027-04-17T00:00:00Z
sources:
  - id: simulation-service
    resource: backend/src/main/java/com/ecotrack/simulation/SimulationService.java (scope descriptor; repository code)
    title: Carbonexo SimulationService horizon and frequency conventions
carbonexo:
  quantity_kind: hypothetical_reduction
  internal_review_status: pending_human_review
---

# Computation

    weekly    = {per_day: 7, per_week: 1, per_month: 1 / 4.33}[frequency]
    weeks     = {MONTH: 4.33, YEAR: 52}[horizon]
    qty       = quantity * weekly * weeks
    baseline  = activity_emissions(baseline_factor_id, dataset_version, qty)
    projected = activity_emissions(replacement_factor_id, dataset_version, qty)
    delta_kg  = projected - baseline

Both legs run through the [activity emissions computation](/computations/activity-emissions.md), so simulated and logged numbers cannot drift apart. The conventions match SimulationService: 4.33 weeks per month and 52 per year.[^simulation-service]

# Meaning of the result

`delta_kg` is a **hypothetical reduction**. Answers must not describe it as saved, avoided or verified. Projected credits are not awarded. If either factor is unsupported or not applicable to the user's region, the scenario is not estimated and the answer names the missing factor.

[^simulation-service]: Carbonexo SimulationService horizon and frequency conventions
