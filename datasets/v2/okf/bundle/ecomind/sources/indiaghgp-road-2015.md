---
type: Scientific Source
title: India Specific Road Transport Emission Factors, Version 1.0 (2015)
description: India GHG Program (WRI India, CII, TERI), published 2015.
resource: https://indiaghgp.org/node/234
tags: [source, in]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
verified:
- {by: 'process:carbonexo-source-fetch', at: '2026-10-17T08:50:00Z'}
stale_after: '2027-04-17T00:00:00Z'
sources:
- {id: indiaghgp-road-2015, resource: 'https://indiaghgp.org/sites/default/files/Road%20Transport%20Technical%20Paper.pdf', title: 'India Specific Road Transport Emission Factors, Version 1.0 (2015)'}
carbonexo: {source_id: indiaghgp-road-2015, publisher: 'India GHG Program (WRI India, CII, TERI)', publication_date: '2015', region: IN, license: Copyright 2015 India GHG Program - reuse terms not confirmed, license_status: unverified, rag_text_allowed: false, evidence_verification: verified_primary, sha256: 82c52c2be6349b3119d3cfbe274c22f26dc6bfcacc2e3f02f13d338d59a04b67, retrieved: '2026-10-17', internal_review_status: pending_human_review}
---

# About

India Specific Road Transport Emission Factors, Version 1.0 (2015), by India GHG Program (WRI India, CII, TERI) (2015).[^indiaghgp-road-2015]

# Used for

- [road.in.car.petrol.hatch_lt1400cc](/factors/in/car-petrol-hatch-lt1400cc.md)
- [road.in.bus.intracity_stu](/factors/in/bus-intracity-stu.md)

# Caveats and review checks

- Tank-to-wheel CO2 only (not CO2e, no upstream fuel).
- Based on rated fuel efficiency data, ~2015 fleet. Likely understates real-world on-road consumption.
- The two-wheeler table text-extracts with misaligned columns. Those rows stay needs_manual_review until checked against the rendered PDF.

# Licence

Copyright 2015 India GHG Program - reuse terms not confirmed (status: unverified). Its text is NOT indexed for retrieval; numbers enter only through the factor registry.

# Integrity

sha256 `82c52c2be6349b3119d3cfbe274c22f26dc6bfcacc2e3f02f13d338d59a04b67` re-checked against the downloaded artifact in this producer run.

[^indiaghgp-road-2015]: India Specific Road Transport Emission Factors, Version 1.0 (2015)
