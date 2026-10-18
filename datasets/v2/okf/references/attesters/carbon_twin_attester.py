"""Attester for /computations/carbon-twin-scenario.md. Recomputes both legs independently; no LLM."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

WEEKLY = {"per_day": 7.0, "per_week": 1.0, "per_month": 1 / 4.33}
WEEKS = {"MONTH": 4.33, "YEAR": 52.0}


def attest(registry_path, receipt: dict, displayed_delta_kg: float | None = None) -> dict:
    reasons = []
    raw = Path(registry_path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != receipt.get("registry_sha256"):
        reasons.append("registry_sha256 mismatch")
    factors = {f["factor_id"]: f for f in json.loads(raw.decode("utf-8"))["factors"]}
    if receipt.get("quantity_kind") != "hypothetical_reduction":
        reasons.append("quantity_kind must be hypothetical_reduction")
    if WEEKS.get(receipt.get("horizon")) != receipt.get("horizon_weeks"):
        reasons.append("horizon_weeks does not match the SimulationService convention")
    try:
        qty = receipt["quantity"] * WEEKLY[receipt["frequency"]] * WEEKS[receipt["horizon"]]
        legs = []
        for key in ("baseline_factor_id", "replacement_factor_id"):
            f = factors[receipt[key]]
            if f["scientific_status"] not in ("supported", "provisional"):
                reasons.append(f"{receipt[key]} is {f['scientific_status']}")
            legs.append(round(qty * f["value"], 3))
        if abs(legs[0] - receipt["baseline_kg"]) > 1e-9 or abs(legs[1] - receipt["projected_kg"]) > 1e-9:
            reasons.append("leg recomputation mismatch")
        delta = round(legs[1] - legs[0], 3)
        if abs(delta - receipt["delta_kg"]) > 1e-9:
            reasons.append("delta_kg mismatch")
        if displayed_delta_kg is not None and abs(round(displayed_delta_kg, 3) - delta) > 0.0005:
            reasons.append(f"displayed {displayed_delta_kg} != attested {delta}")
    except KeyError as e:
        reasons.append(f"receipt incomplete or unknown factor: {e}")
    return {"verdict": "fail" if reasons else "pass", "reasons": reasons}
