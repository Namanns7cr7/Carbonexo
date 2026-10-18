"""Reference executor for /computations/carbon-twin-scenario.md. Mirrors SimulationService conventions."""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import activity_emissions as ae  # noqa: E402

WEEKLY = {"per_day": 7.0, "per_week": 1.0, "per_month": 1 / 4.33}
WEEKS = {"MONTH": 4.33, "YEAR": 52.0}


def run(registry_path, *, baseline_factor_id: str, replacement_factor_id: str, dataset_version: str,
        quantity: float, frequency: str, horizon: str) -> dict:
    if frequency not in WEEKLY or horizon not in WEEKS:
        raise ae.ComputationRefused("frequency must be per_day|per_week|per_month and horizon MONTH|YEAR")
    qty = quantity * WEEKLY[frequency] * WEEKS[horizon]
    base = ae.run(registry_path, factor_id=baseline_factor_id, dataset_version=dataset_version, quantity=qty)
    proj = ae.run(registry_path, factor_id=replacement_factor_id, dataset_version=dataset_version, quantity=qty)
    return {
        "baseline_factor_id": baseline_factor_id, "replacement_factor_id": replacement_factor_id,
        "dataset_version": dataset_version, "quantity": quantity, "frequency": frequency, "horizon": horizon,
        "horizon_weeks": WEEKS[horizon], "baseline_kg": base["result_kg"], "projected_kg": proj["result_kg"],
        "delta_kg": round(proj["result_kg"] - base["result_kg"], 3), "quantity_kind": "hypothetical_reduction",
        "registry_sha256": base["registry_sha256"],
    }
