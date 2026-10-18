"""
Decision 3 (2026-10-17): scientific status of every legacy (pre-V2) factor value, and how
production, demo mode and the AI may use it.

    python -I scripts/dataset_v2/legacy_status.py   # writes datasets/v2/reviewed/legacy_factor_status.csv

Rules:
  * A legacy value with no traceable source is `unsupported`, whatever its plausibility.
  * production_display = "not_estimated" for unsupported values. The UI says "Not estimated"
    and names the missing information. It never shows a precise invented number.
  * demo_display = "illustrative_with_warning": the legacy value may appear in a clearly
    labelled demo mode only.
  * ai_use = "forbidden" for unsupported values: never passed to the model as fact.
  * v2_replacement points at candidate V2 factor ids. Using them in production still needs
    the approval recorded in DATASET_V2_SCHEMA.md section 7.
"""
from __future__ import annotations

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

OUT = pipeline.V2 / "reviewed" / "legacy_factor_status.csv"

# key -> (scientific_status, v2_replacement ids (';'), replacement_condition, missing_information, discrepancy ids)
ACTIVITY = {
    "car_ride": ("unsupported", "road.in.car.petrol.hatch_lt1000cc;road.in.car.petrol.hatch_lt1400cc;road.in.car.petrol.sedan_lt1400cc;road.in.car.diesel.hatch_lt1400cc;road.in.car.cng.small_lt800cc",
                 "user selects fuel + car size; per vehicle-km, divide by occupancy only if stated", "car fuel type and size; occupancy", "D01"),
    "motorbike": ("unsupported", "road.in.2w.scooter_lt110cc;road.in.2w.motorcycle_lt125cc", "provisional until the two-wheeler table is manually verified", "engine size", "D02"),
    "bus": ("unsupported", "road.in.bus.intracity_stu", "intracity only; not BRTS or intercity", "intracity vs intercity", "D03"),
    "metro_train": ("unsupported", "", "", "an Indian per-passenger-km metro/rail factor (none verified)", "D04"),
    "flight": ("unsupported", "", "", "an approved aviation factor for Indian domestic flights (DESNZ is not applicable per Decision 1)", "D05"),
    "bike": ("supported", "", "operational zero by definition", "", "D06"),
    "walk": ("supported", "", "operational zero by definition", "", "D06"),
    "beef_meal": ("unsupported", "food.global.beef_herd", "recipe = ingredient grams x per-kg factor; global proxy with uncertainty label", "recipe / ingredient quantities", "D07"),
    "chicken_meal": ("unsupported", "food.global.poultry_meat", "recipe-based; global proxy", "recipe / ingredient quantities", "D08"),
    "fish_meal": ("unsupported", "food.global.fish_farmed", "recipe-based; global proxy", "recipe / ingredient quantities; farmed vs wild", "D09"),
    "veg_meal": ("unsupported", "food.global.rice;food.global.wheat_rye;food.global.other_pulses;food.global.other_vegetables", "recipe-based; global proxy", "recipe / ingredient quantities", "D10"),
    "vegan_meal": ("unsupported", "food.global.rice;food.global.wheat_rye;food.global.other_pulses;food.global.tofu", "recipe-based; global proxy", "recipe / ingredient quantities", "D10"),
    "dairy": ("unsupported", "food.global.milk;food.global.cheese", "log by product and ml/g", "product and quantity", "D11"),
    "food_delivery": ("unsupported", "", "", "last-mile distance and a sourced packaging factor; the meal is logged separately", "D12"),
    "home_electricity": ("unsupported", "elec.grid.in.niti_annex_e.fy2024_25", "IN users; awaiting approval to change the production factor", "", "D13"),
    "air_conditioning": ("unsupported", "elec.grid.in.niti_annex_e.fy2024_25", "attribution view of household kWh; never additive to a bill/meter total", "", "D14"),
    "geyser_heater": ("unsupported", "elec.grid.in.niti_annex_e.fy2024_25", "attribution view of household kWh; never additive", "", "D14"),
    "laundry_dryer": ("unsupported", "elec.grid.in.niti_annex_e.fy2024_25", "attribution view of household kWh; never additive", "", "D14"),
    "clothing_item": ("unsupported", "", "", "garment type and weight; a sourced garment factor set", "D15"),
    "electronics": ("unsupported", "", "", "device type and model; a manufacturer LCA or reviewed EEIO factor", "D16"),
    "online_order": ("unsupported", "", "", "delivery-leg factor; the product is logged separately", "D17"),
    "groceries": ("unsupported", "", "", "item and quantity; purchases-vs-meals accounting choice", "D18"),
    "general_waste": ("unsupported", "", "", "mass and treatment route; an India-relevant waste factor", "D19"),
    "plastic_bottle": ("unsupported", "", "", "disposal route; the purchase is not re-counted", "D19"),
    "food_waste": ("unsupported", "", "", "mass and treatment route; production emissions already counted", "D19"),
}

ACTION_TEMPLATES = {
    "metro-commute": 8.0, "meatless": 6.4, "ac-timer": 2.1, "reusable-bottle": 0.8,
    "cook-home": 3.2, "carpool": 5.5, "led-swap": 1.6, "second-hand": 9.0,
}


def rows() -> list[dict]:
    inv = pipeline.parse_legacy(pipeline.REPO)
    out = []
    for key, legacy in inv["V3__reference_data.sql"].items():
        status, repl, cond, missing, disc = ACTIVITY[key]
        out.append(dict(
            legacy_table="emission_factors (V3)", legacy_key=key, legacy_value=legacy["value"], legacy_unit=legacy["unit"],
            scientific_status=status,
            production_display="value" if status == "supported" else "not_estimated",
            demo_display="value" if status == "supported" else "illustrative_with_warning",
            ai_use="allowed" if status == "supported" else "forbidden",
            v2_replacement=repl, replacement_condition=cond, missing_information=missing, discrepancy_ids=disc,
        ))
    for key, legacy in inv["V7__embodied_carbon_factors.sql"].items():
        out.append(dict(
            legacy_table="embodied_carbon_factors (V7)", legacy_key=key, legacy_value=legacy["value"], legacy_unit=legacy["unit"],
            scientific_status="unsupported", production_display="not_estimated", demo_display="illustrative_with_warning",
            ai_use="forbidden", v2_replacement="", replacement_condition="",
            missing_information="product-type-specific LCA factor; for alternatives, a displacement assumption", discrepancy_ids="D22",
        ))
    for key, saving in ACTION_TEMPLATES.items():
        out.append(dict(
            legacy_table="action_templates (V3)", legacy_key=key, legacy_value=saving, legacy_unit="kg/week",
            scientific_status="unsupported", production_display="not_estimated", demo_display="illustrative_with_warning",
            ai_use="forbidden", v2_replacement="computed per user by calculateEmissionComparison / runCarbonTwinScenario",
            replacement_condition="labelled as hypothetical or estimated reduction, never as saved",
            missing_information="the user's own logged baseline for the affected activity", discrepancy_ids="D50",
        ))
    return out


def main() -> int:
    data = rows()
    with OUT.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=list(data[0]))
        w.writeheader()
        w.writerows(data)
    print(f"wrote {len(data)} legacy status rows -> {OUT.relative_to(pipeline.REPO)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
