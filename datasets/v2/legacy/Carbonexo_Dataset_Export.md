# Carbonexo — Dataset Export

Everything Carbonexo uses to compute emissions, organized by what it is and where it's trustworthy vs. illustrative.

---

## 1. Core Activity Emission Factors

**Used by:** Track, Simulate (Carbon Twin), Dashboard breakdowns
**Status:** Illustrative placeholder values — plausible order-of-magnitude numbers, not individually cited against a named public dataset.
**Source file:** `database/migrations/V3__reference_data.sql`

| Category | Activity | Unit | kg CO₂e / unit | Default qty |
|---|---|---|---|---|
| Travel | Car ride | km | 0.1800 | 10 |
| Travel | Motorbike | km | 0.1000 | 10 |
| Travel | Bus | km | 0.0800 | 10 |
| Travel | Metro / Train | km | 0.0400 | 10 |
| Travel | Flight | km | 0.2500 | 500 |
| Travel | Bike | km | 0.0000 | 5 |
| Travel | Walk | km | 0.0000 | 3 |
| Food | Beef meal | item | 5.0000 | 1 |
| Food | Chicken meal | item | 1.2000 | 1 |
| Food | Fish meal | item | 1.3000 | 1 |
| Food | Veg meal | item | 0.6000 | 1 |
| Food | Vegan meal | item | 0.4000 | 1 |
| Food | Dairy | item | 1.0000 | 1 |
| Food | Food delivery | item | 0.6000 | 1 |
| Electricity | Home electricity | kWh | 0.4500 | 4 |
| Electricity | Air conditioning | kWh | 0.4500 | 6 |
| Electricity | Geyser / heater | kWh | 0.4500 | 3 |
| Electricity | Laundry + dryer | kWh | 0.4500 | 2 |
| Shopping | Clothing item | item | 10.0000 | 1 |
| Shopping | Electronics | item | 30.0000 | 1 |
| Shopping | Online order | item | 2.5000 | 1 |
| Shopping | Groceries | item | 1.0000 | 1 |
| Waste | General waste | item | 0.5000 | 1 |
| Waste | Plastic bottle | item | 0.2000 | 1 |
| Waste | Food waste | item | 0.4000 | 1 |

---

## 2. Embodied-Carbon Factors (Scan feature)

**Used by:** Barcode/purchase-scan feature — "manufacturing footprint before you bought it"
**Status:** Illustrative LCA ballparks, not region-certified or audited.
**Source file:** `database/migrations/V7__embodied_carbon_factors.sql`

| Category | kg CO₂e / item | Lower-carbon alternative | Alt. kg CO₂e |
|---|---|---|---|
| Electronics (new) | 85.0 | Refurbished electronics | 15.0 |
| Clothing (new) | 22.0 | Secondhand clothing | 3.0 |
| Packaged food | 1.5 | Bulk / unpackaged food | 0.5 |
| Furniture (new) | 90.0 | Secondhand furniture | 10.0 |
| Major appliance (new) | 150.0 | Refurbished appliance | 30.0 |
| Footwear (new pair) | 14.0 | Secondhand footwear | 2.0 |
| Toy (new) | 5.0 | Secondhand toy | 1.0 |
| Book (new, printed) | 2.5 | Secondhand book | 0.3 |

---

## 3. Cited Climate Research Benchmarks

**Used by:** AI Coach grounding, pitch/methodology materials
**Status:** Real, named, peer-reviewed/government sources — this is the credible part of the dataset.
**Source file:** `lib/data/climate-knowledge.ts`

| Topic | Value | Source |
|---|---|---|
| Petrol car vs. electric metro | 0.171 vs. 0.029–0.035 kg CO₂e/km (~81% cut) | UK DESNZ (2024) GHG Conversion Factors |
| Domestic flight (incl. radiative forcing) | 0.245 kg CO₂e/passenger-km | IPCC AR6 WG III Ch.10 + DEFRA Aviation Factors |
| Beef vs. other proteins | Beef 60.0 kg CO₂e/kg vs. chicken 9.9, tofu 3.2, lentils 0.9 | Poore & Nemecek, *Science* 360(6392), 2018 (Oxford meta-study, 38,700 farms) |
| AC / cooling electricity | 0.45 kg CO₂e/kWh grid avg; 1°C thermostat rise ≈ 6–8% less demand | US EPA eGRID 2024 + DOE Energy Star |
| 1.5°C per-capita lifestyle budget | 2,500 kg CO₂e/year (~8.5 kg/day) by 2030 | UNEP Emissions Gap Report + IPCC 1.5°C Special Report |

Full citations (author, year, journal/report title) are in the source file.

---

## 4. Where this lives at runtime

- Loaded into Postgres via Flyway from `database/migrations/` on app startup (tables: `emission_factors`, `embodied_carbon_factors`).
- Production: Cloud SQL instance `carbonexo-db` (Postgres 16, `asia-south1`).
- Nothing is hardcoded in frontend or backend code — both read from these tables via `/api/emission-factors` etc.

---

*Generated for sharing — pulled directly from the Carbonexo repo's migration and data files.*
