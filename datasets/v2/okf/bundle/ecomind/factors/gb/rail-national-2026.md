---
type: Emission Factor
title: UK national rail, DESNZ 2026 (per passenger-km)
description: 0.03092 kg/pkm (CO2e (AR5 GWP100 per DESNZ methodology), 2026, GB). Explanation only; numbers are served by the factor registry.
resource: carbonexo://factor-registry/2.0.0-candidate.2/rail.gb.national.y2026
tags: [uk, transport, rail]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
verified:
- {by: 'process:carbonexo-source-check', at: '2026-10-18T11:36:00Z'}
stale_after: '2027-06-30T00:00:00Z'
sources:
- {id: desnz-2026-flat, resource: /sources/desnz-2026-flat.md, title: UK Department for Energy Security and Net Zero (DESNZ)}
carbonexo:
  factor_id: rail.gb.national.y2026
  dataset_version: 2.0.0-candidate.2
  value: 0.03092
  unit: kg/pkm
  region: GB
  applies_to_regions: [GB]
  proxy_regions: []
  accounting_scope: Scope 3 business travel
  system_boundary: UK national rail, per passenger-km
  gases: CO2e (AR5 GWP100 per DESNZ methodology)
  applicable_year: '2026'
  statistic: point_estimate
  source_table: Factors by Category / ID 25_315_3147_11_1 / Business travel- land > Rail > National rail
  license: Open Government Licence v3.0
  license_status: verified
  scientific_status: supported
  evidence_verification: verified_primary
  uncertainty: {level: low, notes: UK fleet/grid; not transferable to IN}
  superseded_by: null
  internal_review_status: pending_human_review
  retrieval_role: explanation_only
  numeric_authority: factor_registry
---

# Value

| Field | Value |
|---|---|
| factor_id | `rail.gb.national.y2026` |
| value | 0.03092 kg/pkm |
| gases | CO2e (AR5 GWP100 per DESNZ methodology) |
| applicable year | 2026 |
| statistic | point_estimate |
| dataset version | 2.0.0-candidate.2 |

The value comes from UK Department for Energy Security and Net Zero (DESNZ), Factors by Category / ID 25_315_3147_11_1 / Business travel- land > Rail > National rail.[^desnz-2026-flat] Calculations read it from the factor registry through the [activity emissions computation](/computations/activity-emissions.md), never from this text.

# Boundary

- Scope: Scope 3 business travel
- System boundary: UK national rail, per passenger-km

# Applicability

Measured in GB. Applies to GB only. It is **never** applied to Indian users, not even as a proxy (Decision 1); see the [verification policy](/policies/verification-policy.md).

# Uncertainty

Level **low**: UK fleet/grid; not transferable to IN.

# Verification

Machine-confirmed in this producer run (desnz_reextract): `Factors by Category / ID 25_315_3147_11_1 / Business travel- land > Rail > National rail` in the artifact with sha256 `a9a455ab396dae22...`. Not reviewed by a person.

# Related

- none
- [getEmissionFactors](/tools/get-emission-factors.md)

[^desnz-2026-flat]: UK Department for Energy Security and Net Zero (DESNZ), Factors by Category / ID 25_315_3147_11_1 / Business travel- land > Rail > National rail
