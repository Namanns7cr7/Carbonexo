"""Attester for /computations/activity-emissions.md. Deterministic, no LLM (OKF v0.2 section 10.2).

attest(registry_path, receipt, displayed_kg=None) -> {"verdict": "pass"|"fail", "reasons": [...]}

Checks, against an independent re-read of the registry:
  provenance - the registry file is the one the executor used (sha256), the factor exists in
               that dataset version, and the receipt's factor value/unit/status match it;
  fidelity   - result_kg equals quantity x value / occupancy, and the number shown to the
               user (if given) equals result_kg.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path


def attest(registry_path: str | Path, receipt: dict, displayed_kg: float | None = None) -> dict:
    reasons = []
    raw = Path(registry_path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != receipt.get("registry_sha256"):
        reasons.append("registry_sha256 mismatch: a different registry file was used")
    data = json.loads(raw.decode("utf-8"))
    if data.get("dataset_version") != receipt.get("dataset_version"):
        reasons.append("dataset_version mismatch")
    rec = next((f for f in data["factors"] if f["factor_id"] == receipt.get("factor_id")), None)
    if rec is None:
        reasons.append("factor_id not in registry")
    else:
        if rec["value"] != receipt.get("factor_value"):
            reasons.append(f"factor_value {receipt.get('factor_value')} != registry {rec['value']}")
        if rec["unit"] != receipt.get("factor_unit"):
            reasons.append("factor_unit mismatch")
        if rec["scientific_status"] not in ("supported", "provisional"):
            reasons.append(f"factor is {rec['scientific_status']}: must not produce a number")
        occ = receipt.get("occupancy") or 1
        expected = round(receipt.get("quantity", 0) * rec["value"] / occ, 3)
        if abs(expected - receipt.get("result_kg", float("nan"))) > 1e-9:
            reasons.append(f"result_kg {receipt.get('result_kg')} != recomputed {expected}")
        if displayed_kg is not None and abs(round(displayed_kg, 3) - expected) > 0.0005:
            reasons.append(f"displayed {displayed_kg} != attested {expected}")
    return {"verdict": "fail" if reasons else "pass", "reasons": reasons}
