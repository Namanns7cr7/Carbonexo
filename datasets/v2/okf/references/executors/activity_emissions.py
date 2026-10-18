"""Reference executor for /computations/activity-emissions.md (OKF v0.2 section 10).

Deterministic, stdlib only. Production runs the same contract in the Spring Boot
FactorRegistry; this file is the offline/eval reference and the attester's ground truth.

    run(registry_path, factor_id=..., dataset_version=..., quantity=..., occupancy=None) -> receipt dict
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

USABLE = {"supported", "provisional"}


class ComputationRefused(ValueError):
    """The sanctioned computation declined to produce a number (e.g. unsupported factor)."""


def registry_digest(registry_path: str | Path) -> str:
    return hashlib.sha256(Path(registry_path).read_bytes()).hexdigest()


def lookup(registry_path: str | Path, factor_id: str, dataset_version: str) -> dict:
    data = json.loads(Path(registry_path).read_text(encoding="utf-8"))
    if data.get("dataset_version") != dataset_version:
        raise ComputationRefused(f"registry is {data.get('dataset_version')}, receipt asked for {dataset_version}")
    for f in data["factors"]:
        if f["factor_id"] == factor_id:
            return f
    raise ComputationRefused(f"unknown factor_id {factor_id}")


def run(registry_path: str | Path, *, factor_id: str, dataset_version: str, quantity: float, occupancy: int | None = None) -> dict:
    if quantity < 0:
        raise ComputationRefused("quantity must be >= 0")
    rec = lookup(registry_path, factor_id, dataset_version)
    if rec["scientific_status"] not in USABLE:
        raise ComputationRefused(f"{factor_id} is {rec['scientific_status']}: not estimated")
    occ = 1 if occupancy is None else int(occupancy)
    if occ < 1:
        raise ComputationRefused("occupancy must be >= 1")
    if occ > 1 and rec["unit"] != "kg/vkm":
        raise ComputationRefused(f"occupancy only divides per-vehicle factors, not {rec['unit']}")
    return {
        "factor_id": factor_id,
        "dataset_version": dataset_version,
        "factor_value": rec["value"],
        "factor_unit": rec["unit"],
        "factor_scientific_status": rec["scientific_status"],
        "quantity": quantity,
        "occupancy": occ,
        "result_kg": round(quantity * rec["value"] / occ, 3),
        "registry_sha256": registry_digest(registry_path),
    }
