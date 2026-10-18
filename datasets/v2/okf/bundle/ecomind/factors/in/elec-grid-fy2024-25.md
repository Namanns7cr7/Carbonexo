---
type: Emission Factor
title: India grid electricity, weighted average (FY 2024-25)
description: 0.71 kg/kWh (CO2, FY2024-25, IN). Explanation only; numbers are served by the factor registry.
resource: carbonexo://factor-registry/2.0.0-candidate.2/elec.grid.in.niti_annex_e.fy2024_25
tags: [india, electricity, grid]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
verified:
- {by: 'process:carbonexo-source-check', at: '2026-10-18T11:36:00Z'}
stale_after: '2026-12-31T00:00:00Z'
sources:
- {id: niti-2026-power, resource: /sources/niti-2026-power.md, title: 'NITI Aayog, Government of India'}
carbonexo:
  factor_id: elec.grid.in.niti_annex_e.fy2024_25
  dataset_version: 2.0.0-candidate.2
  value: 0.71
  unit: kg/kWh
  region: IN
  applies_to_regions: [IN]
  proxy_regions: []
  accounting_scope: location-based grid average
  system_boundary: all-India; total CO2 / total net generation incl. RE; adjusted for cross-border transfers; incl. grid-connected captive injection; generation-side, excludes T&D losses
  gases: CO2
  applicable_year: FY2024-25
  statistic: weighted_average
  source_table: Annexure E, row FY2024-25 (1234.19 Mt CO2 / 1739.06 BU)
  license: Government of India publication - reuse terms not confirmed
  license_status: unverified
  scientific_status: supported
  evidence_verification: verified_primary
  uncertainty: {level: low, notes: Generation-side; excludes T&D losses; CO2 only}
  superseded_by: null
  internal_review_status: pending_human_review
  retrieval_role: explanation_only
  numeric_authority: factor_registry
---

# Value

| Field | Value |
|---|---|
| factor_id | `elec.grid.in.niti_annex_e.fy2024_25` |
| value | 0.71 kg/kWh |
| gases | CO2 |
| applicable year | FY2024-25 |
| statistic | weighted_average |
| dataset version | 2.0.0-candidate.2 |

The value comes from NITI Aayog, Government of India, Annexure E, row FY2024-25 (1234.19 Mt CO2 / 1739.06 BU).[^niti-2026-power] Calculations read it from the factor registry through the [activity emissions computation](/computations/activity-emissions.md), never from this text.

# Boundary

- Scope: location-based grid average
- System boundary: all-India; total CO2 / total net generation incl. RE; adjusted for cross-border transfers; incl. grid-connected captive injection; generation-side, excludes T&D losses

# Applicability

Measured for [India](/regions/in.md). Direct default for: IN. Proxy for: none.

# Uncertainty

Level **low**: Generation-side; excludes T&D losses; CO2 only.

# Corroboration

Measure `in.grid.weighted_average.FY2024-25`: all records agree.

- `elec.grid.in.cea_v21.weighted_avg` = 0.71 kg/kWh (cea-co2-baseline-v21, verified_secondary)

# Verification

Machine-confirmed in this producer run (pdftotext_row_ratio): `2024-25 1234.19 1461.85 255.01 1739.06` in the artifact with sha256 `1f4e6799bc8e7943...`. Not reviewed by a person.

# Related

- [in grid electricity](/methodology/in-grid-electricity.md)
- [meter vs appliance](/accounting/meter-vs-appliance.md)
- [getEmissionFactors](/tools/get-emission-factors.md)

[^niti-2026-power]: NITI Aayog, Government of India, Annexure E, row FY2024-25 (1234.19 Mt CO2 / 1739.06 BU)
