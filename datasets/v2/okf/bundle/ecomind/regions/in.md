---
type: Region
title: India (IN)
description: Regional applicability rules, available factors and known evidence gaps for Indian users.
tags: [region, india]
status: draft
generated: {by: carbonexo-okf-producer/0.1.0, at: '2026-10-17T07:50:00Z'}
stale_after: '2027-04-17T00:00:00Z'
sources:
- {id: decision-1, resource: 'Carbonexo product decision 1, 2026-10-17 (scope descriptor: India-first region policy)', title: 'Decision 1: India first'}
carbonexo: {region: IN, default_for_new_users: suggested_then_confirmed, existing_accounts: never_reassigned, direct_factor_count: 18, proxy_factor_count: 25, internal_review_status: pending_human_review}
---

# Region rules

India is suggested as the default region for new Indian users, who confirm or change it. Existing accounts are never reassigned silently.[^decision-1] Factors measured in the UK or US never apply to Indian users. A GLOBAL value may be a proxy only with an explicit uncertainty label. See the [verification policy](/policies/verification-policy.md).

# Methodology

- [Indian grid electricity](/methodology/in-grid-electricity.md)

# Factors in this bundle

- [elec.grid.in.niti_annex_e.fy2024_25](/factors/in/elec-grid-fy2024-25.md)
- [road.in.car.petrol.hatch_lt1400cc](/factors/in/car-petrol-hatch-lt1400cc.md)
- [road.in.bus.intracity_stu](/factors/in/bus-intracity-stu.md)

The full registry has 18 direct Indian factor records and 25 GLOBAL records usable as Indian proxies (dataset 2.0.0-candidate.2).

# Not estimated for Indian users

- `clothing_item`: garment type and weight; a sourced garment factor set
- `electronics`: device type and model; a manufacturer LCA or reviewed EEIO factor
- `flight`: an approved aviation factor for Indian domestic flights (DESNZ is not applicable per Decision 1)
- `food_delivery`: last-mile distance and a sourced packaging factor; the meal is logged separately
- `food_waste`: mass and treatment route; production emissions already counted
- `general_waste`: mass and treatment route; an India-relevant waste factor
- `groceries`: item and quantity; purchases-vs-meals accounting choice
- `metro_train`: an Indian per-passenger-km metro/rail factor (none verified)
- `online_order`: delivery-leg factor; the product is logged separately
- `plastic_bottle`: disposal route; the purchase is not re-counted

[^decision-1]: Decision 1: India first
