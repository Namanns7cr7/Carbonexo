---
type: Tool Contract
title: getEmissionFactors
description: Deterministic factor lookup by activity key and region. The ONLY way the model obtains a factor.
tags: [tool, ai-coach, contract]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
stale_after: '2027-01-17T00:00:00Z'
sources:
- {id: coach-tools, resource: datasets/v2/schema/coach_tools.v1.json (scope descriptor; repository file), title: coach-tools.v1}
carbonexo: {tool_version: coach-tools.v1, backed_by: 'FactorRegistry (V2 factor_records), region -> GLOBAL proxy -> regional_gap', timeout_ms: 1000, side_effects: read-only, internal_review_status: pending_human_review}
---

# Contract

Deterministic factor lookup by activity key and region. The ONLY way the model obtains a factor. Backed by `FactorRegistry (V2 factor_records), region -> GLOBAL proxy -> regional_gap`.[^coach-tools]

- Identity: No tool accepts a user id. Every tool acts as the authenticated principal (SecurityUtils.currentUserId()) resolved server-side. A user id, email or name supplied by the model or the user message is ignored.
- Side effects: All v1 tools are read-only. runCarbonTwinScenario reuses SimulationService, which never writes logs or credits.
- Numbers: Every kg figure in an answer must come from a tool output in the same turn. Tool outputs carry factor_ids + dataset_version so the citation validator can check them.
- Not estimated: When status is not_estimated or regional_gap, the answer must say 'Not estimated' and list missing_information. Never substitute a number.

# Schema

Input:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "activity"
  ],
  "properties": {
    "activity": {
      "type": "string",
      "description": "Catalog key, e.g. home_electricity, car_ride, bus, food.global.peas"
    },
    "region": {
      "type": "string",
      "description": "Defaults to the profile region."
    },
    "variant": {
      "type": "string",
      "description": "e.g. petrol_hatch_lt1400cc, intracity"
    }
  }
}
```

Output:

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": [
    "status",
    "missing_information"
  ],
  "properties": {
    "status": {
      "$ref": "#/definitions/EstimateStatus"
    },
    "factor": {
      "$ref": "#/definitions/FactorRef"
    },
    "missing_information": {
      "type": "array",
      "items": {
        "type": "string"
      }
    },
    "alternatives_available": {
      "type": "array",
      "items": {
        "type": "string"
      }
    }
  }
}
```

# Related

- [activity emissions](/computations/activity-emissions.md)
- [verification policy](/policies/verification-policy.md)

[^coach-tools]: coach-tools.v1
