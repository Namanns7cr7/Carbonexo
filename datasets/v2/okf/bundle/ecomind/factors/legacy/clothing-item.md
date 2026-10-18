---
type: Emission Factor
title: Clothing item (legacy, unsupported)
description: 'Legacy value 10.0 kg/item with no traceable source. Unsupported: production shows Not estimated.'
tags: [legacy, unsupported, shopping]
status: deprecated
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
sources:
- {id: legacy-v3, resource: 'database/migrations/V3__reference_data.sql, emission_factors row clothing_item (scope descriptor; the row''s source column reads ''frontend catalog'')', title: Legacy V3 reference data}
carbonexo:
  legacy_key: clothing_item
  legacy_value: 10.0
  unit: kg/item
  scientific_status: unsupported
  production_display: not_estimated
  demo_display: illustrative_with_warning
  ai_use: forbidden
  missing_information: garment type and weight; a sourced garment factor set
  discrepancy_ids: [D15]
  internal_review_status: pending_human_review
  retrieval_role: review_only
---

# Status

**Unsupported.** The legacy value 10.0 kg per item has no traceable source.[^legacy-v3] It is excluded from production calculations and from AI-generated factual claims. The UI shows **Not estimated**. The value may appear only in a clearly labelled demo mode.

# Conflicting legacy values

- embodied_carbon_factors (V7) `clothing` = 22.0 kg/item

Two incompatible values for the same purchase, both unsourced (audit D15).

# Missing information

garment type and weight; a sourced garment factor set

# Related

- [Verification policy](/policies/verification-policy.md)

[^legacy-v3]: Legacy V3 reference data
