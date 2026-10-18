---
type: Scientific Source
title: 'Scenarios Towards Viksit Bharat and Net Zero - Sectoral Insights: Power (2026), Annexure E: Weighted Average Emissions Factor of Grid Electricity'
description: NITI Aayog, Government of India, published 2026-02.
resource: https://www.niti.gov.in/
tags: [source, in]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
verified:
- {by: 'process:carbonexo-source-fetch', at: '2026-10-18T11:36:00Z'}
stale_after: '2026-12-31T00:00:00Z'
sources:
- {id: niti-2026-power, resource: 'https://www.niti.gov.in/sites/default/files/2026-02/Scenarios-Towards-Viksit-Bharat-and-Net-Zero-Sectoral-Insights-Power.pdf', title: 'Scenarios Towards Viksit Bharat and Net Zero - Sectoral Insights: Power (2026), Annexure E: Weighted Average Emissions Factor of Grid Electricity'}
carbonexo: {source_id: niti-2026-power, publisher: 'NITI Aayog, Government of India', publication_date: 2026-02, region: IN, license: Government of India publication - reuse terms not confirmed, license_status: unverified, rag_text_allowed: false, evidence_verification: verified_primary, sha256: 1f4e6799bc8e79435540e2a578506c9f0a61ecc772e52d157a5ca647abb3db00, retrieved: '2026-10-17', internal_review_status: pending_human_review}
---

# About

Scenarios Towards Viksit Bharat and Net Zero - Sectoral Insights: Power (2026), Annexure E: Weighted Average Emissions Factor of Grid Electricity, by NITI Aayog, Government of India (2026-02).[^niti-2026-power]

# Used for

- [elec.grid.in.niti_annex_e.fy2024_25](/factors/in/elec-grid-fy2024-25.md)

# Caveats and review checks

- Text extraction shifts the factor column down by one row (stray 0.774 above FY2013-14; FY2024-25 row appears blank). Correct mapping confirmed arithmetically: factor = total CO2 / total net generation incl. RE.
- FY2024-25: 1234.19 Mt / 1739.06 BU = 0.7097 -> 0.710; FY2023-24: 1203.36/1654.54 = 0.7273 -> 0.727; FY2022-23: 1108.11/1547.80 = 0.7159 -> 0.716; FY2013-14: 727.4/939.83 = 0.774.
- Internal inconsistency inside the NITI report: the summary table (p.~10) lists 'Grid Emission Factor 0.727' for the current year, which is the FY2023-24 value; Section 4.4.6 and Annexure E give 0.71 for 2025 (FY2024-25).

# Licence

Government of India publication - reuse terms not confirmed (status: unverified). Its text is NOT indexed for retrieval; numbers enter only through the factor registry.

# Integrity

sha256 `1f4e6799bc8e79435540e2a578506c9f0a61ecc772e52d157a5ca647abb3db00` re-checked against the downloaded artifact in this producer run.

[^niti-2026-power]: Scenarios Towards Viksit Bharat and Net Zero - Sectoral Insights: Power (2026), Annexure E: Weighted Average Emissions Factor of Grid Electricity
