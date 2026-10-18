---
type: Attested Computation
title: Emissions of one logged or hypothetical activity
description: Sanctioned computation of kg CO2(e) for a quantity of one activity, from a factor-registry record identified by factor id and dataset version.
tags: [computation, emissions, factor-registry]
status: draft
runtime: python
parameters:
  - { name: factor_id, type: string, required: true }
  - { name: dataset_version, type: string, required: true }
  - { name: quantity, type: number, required: true }
  - { name: occupancy, type: integer, required: false }
executor:
  resource: /references/executors/activity_emissions.py
  receipt: [factor_id, dataset_version, factor_value, factor_unit, factor_scientific_status, quantity, occupancy, result_kg, registry_sha256]
attester:
  resource: /references/attesters/activity_emissions_attester.py
generated: { by: claude-code/claude-opus-5-5, at: 2026-10-17T08:40:00Z }
stale_after: 2027-04-17T00:00:00Z
sources:
  - id: factor-registry
    resource: datasets/v2/build/candidate_factors.<dataset_version>.json (scope descriptor; production reads factor_records via the Spring Boot FactorRegistry)
    title: Carbonexo factor registry
carbonexo:
  production_executor: com.ecotrack.carbon.CarbonCalculationService.calculateCo2 (to be pointed at factor_records)
  refuses_when: [factor scientific_status is unsupported, factor not applicable to the user's region, occupancy < 1]
  internal_review_status: pending_human_review
---

# Computation

    record    = registry.lookup(factor_id, dataset_version)      # exact key, no similarity search
    require record.scientific_status in {supported, provisional}
    occupancy = occupancy or 1                                     # divide only when the user stated it
    result_kg = round(quantity * record.value / occupancy, 3)

The agent supplies only the four parameters. It cannot supply a factor value. The executor looks the value up. The attester re-reads the registry by `factor_id` and `dataset_version`, recomputes `result_kg`, checks that the registry file hash matches `registry_sha256`, and compares the result with both the receipt and the number displayed to the user.

# Units

- Vehicle factors (`kg/vkm`) are per vehicle; `occupancy` divides them.
- Passenger factors (`kg/pkm`) are already per person; the executor rejects an occupancy above 1 for them.
- Grid factors (`kg/kWh`) multiply grid-imported kWh. See [Indian grid methodology](/methodology/in-grid-electricity.md).

# Used by

[getEmissionFactors](/tools/get-emission-factors.md), the dashboard totals, and the [Carbon Twin scenario computation](/computations/carbon-twin-scenario.md).
