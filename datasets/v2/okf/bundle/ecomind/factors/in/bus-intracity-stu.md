---
type: Emission Factor
title: Intracity State Transport bus, India (per passenger-km)
description: 0.015161 kg/pkm (CO2, 2015, IN). Explanation only; numbers are served by the factor registry.
resource: carbonexo://factor-registry/2.0.0-candidate.2/road.in.bus.intracity_stu
tags: [india, transport, bus]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
verified:
- {by: 'process:carbonexo-source-check', at: '2026-10-18T11:36:00Z'}
stale_after: '2027-04-17T00:00:00Z'
sources:
- {id: indiaghgp-road-2015, resource: /sources/indiaghgp-road-2015.md, title: 'India GHG Program (WRI India, CII, TERI)'}
carbonexo:
  factor_id: road.in.bus.intracity_stu
  dataset_version: 2.0.0-candidate.2
  value: 0.015161
  unit: kg/pkm
  region: IN
  applies_to_regions: [IN]
  proxy_regions: []
  accounting_scope: tank-to-wheel
  system_boundary: per passenger-km, State Transport Utility fleet average load
  gases: CO2
  applicable_year: '2015'
  statistic: point_estimate
  source_table: Bus paragraph
  license: Copyright 2015 India GHG Program - reuse terms not confirmed
  license_status: unverified
  scientific_status: supported
  evidence_verification: verified_primary
  uncertainty: {level: medium, notes: '2015 fleet, rated efficiency, tank-to-wheel CO2 only'}
  superseded_by: null
  internal_review_status: pending_human_review
  retrieval_role: explanation_only
  numeric_authority: factor_registry
---

# Value

| Field | Value |
|---|---|
| factor_id | `road.in.bus.intracity_stu` |
| value | 0.015161 kg/pkm |
| gases | CO2 |
| applicable year | 2015 |
| statistic | point_estimate |
| dataset version | 2.0.0-candidate.2 |

The value comes from India GHG Program (WRI India, CII, TERI), Bus paragraph.[^indiaghgp-road-2015] Calculations read it from the factor registry through the [activity emissions computation](/computations/activity-emissions.md), never from this text.

# Boundary

- Scope: tank-to-wheel
- System boundary: per passenger-km, State Transport Utility fleet average load

# Applicability

Measured for [India](/regions/in.md). Direct default for: IN. Proxy for: none.

# Uncertainty

Level **medium**: 2015 fleet, rated efficiency, tank-to-wheel CO2 only.

# Verification

Machine-confirmed in this producer run (pdftotext_value): `emission factor for bus transport is 0.015161 kg CO2/pax-km` in the artifact with sha256 `82c52c2be6349b31...`. Not reviewed by a person.

# Related

- none
- [getEmissionFactors](/tools/get-emission-factors.md)

[^indiaghgp-road-2015]: India GHG Program (WRI India, CII, TERI), Bus paragraph
