"""
Carbonexo Dataset V2 - reproducible ingestion and validation pipeline.

    python -I scripts/dataset_v2/pipeline.py fetch       # download http sources, verify pinned sha256
    python -I scripts/dataset_v2/pipeline.py build       # extract candidate factors -> datasets/v2/build/
    python -I scripts/dataset_v2/pipeline.py inventory   # parse legacy factor copies, report disagreements
    python -I scripts/dataset_v2/pipeline.py validate    # schema-check the candidate set
    python -I scripts/dataset_v2/pipeline.py all

Design rules:
  * Raw downloads live in datasets/v2/raw/ (git-ignored) and are treated as untrusted data:
    they are only parsed (openpyxl / csv), never executed.
  * A hash mismatch is a hard failure. Publishers revise files (DESNZ republished the
    2026 flat file on 2026-07-31), and a silent change must never reach production factors.
  * Nothing here writes to a database. Promotion to emission_factors is a separate,
    reviewed Flyway migration.

Requires: Python 3.11+, openpyxl.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
V2 = REPO / "datasets" / "v2"
RAW = V2 / "raw"
BUILD = V2 / "build"
MANIFEST = V2 / "SOURCE_MANIFEST.json"
MANUAL = V2 / "reviewed" / "manual_transcriptions.csv"
FACTOR_SCHEMA = V2 / "schema" / "factor_record.v2.schema.json"

DATASET_VERSION = "2.0.0-candidate.2"

REQUIRED_FIELDS = (
    "factor_id", "value", "unit", "region", "applicable_year", "scope", "system_boundary",
    "gases", "source_id", "source_publisher", "source_url", "source_locator",
    "publication_date", "license", "verification_status", "dataset_version",
)  # the full contract (incl. scientific_status, applicability) is schema/factor_record.v2.schema.json
VERIFICATION_STATUSES = {"verified_primary", "verified_secondary", "needs_manual_review", "rejected"}

# DESNZ row IDs are stable across years, so the same map extracts 2025 and 2026.
# factor_id -> (desnz_row_id, unit, scope, boundary)
DESNZ_ROWS = {
    "road.gb.car.petrol_avg":        ("4_301_3070_4_1", "kg/vkm", "Scope 1 (tailpipe)", "average UK petrol car, per vehicle-km"),
    "road.gb.car.unknown_fuel_avg":  ("4_301_3074_4_1", "kg/vkm", "Scope 1 (tailpipe)", "average UK car, fuel unknown, per vehicle-km"),
    "road.gb.car.bev_avg":           ("25_301_3076_4_1", "kg/vkm", "Scope 3 business travel", "average UK BEV incl. UK grid electricity, per vehicle-km"),
    "road.gb.motorbike.avg":         ("4_302_3080_4_1", "kg/vkm", "Scope 1 (tailpipe)", "average UK motorbike, per vehicle-km"),
    "road.gb.taxi.regular":          ("25_313_3141_11_1", "kg/pkm", "Scope 3 business travel", "regular taxi, per passenger-km"),
    "road.gb.bus.avg_local":         ("25_314_3145_11_1", "kg/pkm", "Scope 3 business travel", "average UK local bus, per passenger-km"),
    "road.gb.coach":                 ("25_314_3146_11_1", "kg/pkm", "Scope 3 business travel", "coach, per passenger-km"),
    "rail.gb.national":              ("25_315_3147_11_1", "kg/pkm", "Scope 3 business travel", "UK national rail, per passenger-km"),
    "rail.gb.light_rail_tram":       ("25_315_3149_11_1", "kg/pkm", "Scope 3 business travel", "UK light rail and tram, per passenger-km"),
    "rail.gb.underground":           ("25_315_3150_11_1", "kg/pkm", "Scope 3 business travel", "London Underground, per passenger-km"),
    "air.gb.domestic.avg.with_rf":   ("21_316_3160_11_1", "kg/pkm", "Scope 3 business travel", "domestic to/from UK, average passenger, incl. radiative forcing"),
    "air.gb.domestic.avg.without_rf":("21_316_3161_11_1", "kg/pkm", "Scope 3 business travel", "domestic to/from UK, average passenger, CO2e without RF"),
    "air.intl_non_uk.avg.with_rf":   ("21_316_3178_11_1", "kg/pkm", "Scope 3 business travel", "international flights not to/from UK, average passenger, incl. RF"),
    "air.intl_non_uk.avg.without_rf":("21_316_3179_11_1", "kg/pkm", "Scope 3 business travel", "international flights not to/from UK, average passenger, without RF"),
    "elec.grid.gb.generation":       ("7_400_4000_5_1", "kg/kWh", "Scope 2 location-based", "UK grid electricity generated"),
    "elec.grid.gb.td_losses":        ("13_402_4000_5_1", "kg/kWh", "Scope 3 cat.3", "UK T&D losses"),
}

# OWID entity -> factor_id. Global mean per kg of product (Poore & Nemecek 2018).
OWID_ENTITIES = {
    "Beef (beef herd)": "food.global.beef_herd", "Beef (dairy herd)": "food.global.beef_dairy_herd",
    "Lamb & Mutton": "food.global.lamb_mutton", "Cheese": "food.global.cheese",
    "Pig Meat": "food.global.pig_meat", "Poultry Meat": "food.global.poultry_meat",
    "Fish (farmed)": "food.global.fish_farmed", "Prawns (farmed)": "food.global.prawns_farmed",
    "Eggs": "food.global.eggs", "Milk": "food.global.milk", "Tofu": "food.global.tofu",
    "Peas": "food.global.peas", "Other Pulses": "food.global.other_pulses",
    "Groundnuts": "food.global.groundnuts", "Rice": "food.global.rice",
    "Wheat & Rye": "food.global.wheat_rye", "Maize": "food.global.maize",
    "Potatoes": "food.global.potatoes", "Root Vegetables": "food.global.root_vegetables",
    "Other Vegetables": "food.global.other_vegetables", "Soy milk": "food.global.soy_milk",
    "Tomatoes": "food.global.tomatoes", "Bananas": "food.global.bananas",
    "Cane Sugar": "food.global.cane_sugar", "Coffee": "food.global.coffee",
}


def load_manifest() -> dict:
    return {s["source_id"]: s for s in json.loads(MANIFEST.read_text(encoding="utf-8"))["sources"]}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def raw_path(src: dict) -> Path:
    return RAW / src["fetch"]["filename"]


def cmd_fetch(_args) -> int:
    RAW.mkdir(parents=True, exist_ok=True)
    failures = 0
    for sid, src in load_manifest().items():
        fetch = src.get("fetch", {})
        if fetch.get("method") != "http":
            print(f"[skip]   {sid}: {fetch.get('method')} ({fetch.get('blocker', 'no automated fetch')})")
            continue
        dest = raw_path(src)
        if not dest.exists():
            req = urllib.request.Request(fetch["url"], headers={"User-Agent": "carbonexo-dataset-v2/1.0"})
            with urllib.request.urlopen(req, timeout=120) as resp:
                dest.write_bytes(resp.read())
        actual = sha256(dest)
        expected = fetch.get("sha256")
        if expected is None:
            print(f"[unpinned] {sid}: sha256={actual} - review the file, then pin this hash in the manifest")
        elif actual != expected:
            print(f"[FAIL]   {sid}: sha256 {actual} != pinned {expected} - publisher revised the file?")
            failures += 1
        else:
            print(f"[ok]     {sid}")
    return 1 if failures else 0


def base_record(src: dict, **fields) -> dict:
    rec = {
        "source_id": src["source_id"],
        "source_publisher": src["publisher"],
        "source_url": src.get("fetch", {}).get("url") or src.get("landing_url"),
        "publication_date": src.get("publication_date"),
        "license": src.get("license", {}).get("name") or "unverified",
        "license_status": src.get("license", {}).get("status", "unverified"),
        "dataset_version": DATASET_VERSION,
    }
    rec.update(fields)
    return rec


def extract_desnz(src: dict, year: int) -> list[dict]:
    import openpyxl  # imported lazily so `inventory` works without it

    wb = openpyxl.load_workbook(raw_path(src), read_only=True, data_only=True)
    ws = wb["Factors by Category"]
    rows, header_seen = {}, False
    for r in ws.iter_rows(values_only=True):
        if not header_seen:
            header_seen = r and r[0] == "ID"
            continue
        if r[0] and r[8] == "kg CO2e":
            rows[r[0]] = r
    out = []
    for factor_id, (row_id, unit, scope, boundary) in DESNZ_ROWS.items():
        r = rows.get(row_id)
        if r is None:
            raise SystemExit(f"DESNZ {year}: row {row_id} for {factor_id} not found - schema changed?")
        out.append(base_record(
            src, factor_id=f"{factor_id}.y{year}", value=float(r[9]), unit=unit, region="GB",
            applicable_year=str(year), scope=scope, system_boundary=boundary, gases="CO2e (AR5 GWP100 per DESNZ methodology)",
            source_locator=f"Factors by Category / ID {row_id} / {' > '.join(str(x) for x in r[2:7] if x)}",
            verification_status=src["verification_status"],
        ))
    return out


def extract_owid(src: dict) -> list[dict]:
    out = []
    with raw_path(src).open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            fid = OWID_ENTITIES.get(row["Entity"])
            if fid is None:
                continue
            out.append(base_record(
                src, factor_id=fid, value=float(row["Greenhouse gas emissions per kilogram"]), unit="kg CO2e/kg product",
                region="GLOBAL", applicable_year=row["Year"], scope="product life cycle",
                system_boundary="land-use change, farm, processing, transport, packaging, retail (Poore & Nemecek 2018); global mean",
                gases="CO2e", source_locator=f"CSV Entity='{row['Entity']}'",
                verification_status=src["verification_status"],
                citation_of_record="poore-nemecek-2018",
            ))
    return out


def load_manual(manifest: dict) -> list[dict]:
    out = []
    with MANUAL.open(encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            src = manifest[row["source_id"]]
            out.append(base_record(
                src, factor_id=row["factor_id"], value=float(row["value"]), unit=row["unit"], region=row["region"],
                applicable_year=row["applicable_year"], scope=row["scope"], system_boundary=row["system_boundary"],
                gases=row["gases"], source_locator=row["source_locator"],
                verification_status=row["verification_status"], notes=row["notes"] or None,
            ))
    return out


# Per-source scientific policy. Decision 1 (2026-10-17): UK/US values are never applicable
# to India, not even as a proxy. GLOBAL values may be an IN proxy only with an uncertainty label.
# source_id -> (statistic, uncertainty level, uncertainty note, proxy_regions)
SOURCE_POLICY = {
    "desnz-2026-flat": ("point_estimate", "low", "UK fleet/grid; not transferable to IN", []),
    "desnz-2025-flat": ("point_estimate", "low", "UK fleet/grid; superseded by DESNZ 2026", []),
    "owid-ghg-per-kg-poore": ("mean", "medium", "Global mean of a wide distribution across producers; IN-specific LCA not yet reviewed", ["IN"]),
    "indiaghgp-road-2015": ("point_estimate", "medium", "2015 fleet, rated efficiency, tank-to-wheel CO2 only", []),
    "niti-2026-power": ("weighted_average", "low", "Generation-side; excludes T&D losses; CO2 only", []),
    "cea-co2-baseline-v21": ("weighted_average", "low", "Generation-side; excludes T&D losses; CO2 only", []),
    "cea-co2-baseline-v20": ("weighted_average", "low", "Generation-side; CO2 only", []),
    "epa-ghg-equivalencies-refs": ("point_estimate", "medium", "US-specific", []),
    "iges-15-lifestyles-2019": ("point_estimate", "medium", "Whole-lifestyle consumption footprint target, not comparable with partial tracking", []),
}
RECORD_KIND_BY_PREFIX = {"equiv": "equivalency", "target": "target", "behav": "behavioural_estimate"}
SCIENTIFIC_STATUS = {"verified_primary": "supported", "verified_secondary": "supported",
                     "needs_manual_review": "provisional", "rejected": "unsupported"}


def classify(rec: dict, all_ids: set[str]) -> dict:
    """Add the V2 scientific fields (record_kind, applicability, status, uncertainty, supersession)."""
    statistic, level, note, proxy = SOURCE_POLICY[rec["source_id"]]
    region = rec["region"]
    applies = [region]
    if rec["factor_id"].startswith("target."):  # global per-capita targets apply to every region by design
        applies = ["GLOBAL", "IN"]
    rec.setdefault("citation_of_record", None)
    rec.setdefault("notes", None)
    rec.update(
        record_kind=RECORD_KIND_BY_PREFIX.get(rec["factor_id"].split(".")[0], "emission_factor"),
        applies_to_regions=applies,
        proxy_regions=[] if region in ("GB", "US") else proxy,
        statistic=statistic,
        scientific_status=SCIENTIFIC_STATUS[rec["verification_status"]],
        uncertainty={"level": level, "notes": note},
        superseded_by=None, valid_from=None, valid_to=None,
    )
    if rec["source_id"] == "desnz-2025-flat":
        successor = rec["factor_id"].replace(".y2025", ".y2026")
        rec["superseded_by"] = successor if successor in all_ids else None
    return rec


def cmd_build(_args) -> int:
    manifest = load_manifest()
    factors = (
        extract_desnz(manifest["desnz-2026-flat"], 2026)
        + extract_desnz(manifest["desnz-2025-flat"], 2025)
        + extract_owid(manifest["owid-ghg-per-kg-poore"])
        + load_manual(manifest)
    )
    ids = {f["factor_id"] for f in factors}
    factors = [classify(f, ids) for f in factors]
    BUILD.mkdir(parents=True, exist_ok=True)
    out = BUILD / f"candidate_factors.{DATASET_VERSION}.json"
    out.write_text(json.dumps({"dataset_version": DATASET_VERSION, "factors": factors}, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(factors)} candidate factors -> {out.relative_to(REPO)}")
    return validate(factors)


def schema_errors(factors: list[dict]) -> list[str]:
    import jsonschema

    schema = json.loads(FACTOR_SCHEMA.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    return [f"{f.get('factor_id', '<missing id>')}: schema: {e.message}" for f in factors for e in validator.iter_errors(f)]


def validate(factors: list[dict]) -> int:
    errors, seen = schema_errors(factors), set()
    for f in factors:
        fid = f.get("factor_id", "<missing id>")
        if fid in seen:
            errors.append(f"{fid}: duplicate factor_id")
        seen.add(fid)
        for k in REQUIRED_FIELDS:
            if f.get(k) in (None, ""):
                errors.append(f"{fid}: missing {k}")
        if f.get("verification_status") not in VERIFICATION_STATUSES:
            errors.append(f"{fid}: bad verification_status {f.get('verification_status')!r}")
        if not isinstance(f.get("value"), (int, float)) or f["value"] < 0:
            errors.append(f"{fid}: value must be a non-negative number")
        if "/" not in str(f.get("unit", "")) and "%" not in str(f.get("unit", "")):
            errors.append(f"{fid}: unit {f.get('unit')!r} has no denominator")
    for e in errors:
        print("[invalid]", e)
    statuses = {}
    for f in factors:
        statuses[f.get("verification_status")] = statuses.get(f.get("verification_status"), 0) + 1
    print(f"validated {len(factors)} factors, {len(errors)} errors; by status: {statuses}")
    return 1 if errors else 0


def cmd_validate(_args) -> int:
    path = BUILD / f"candidate_factors.{DATASET_VERSION}.json"
    return validate(json.loads(path.read_text(encoding="utf-8"))["factors"])


# ---- legacy inventory: every place a factor value lives today -------------------------

V3_ROW = re.compile(r"\('(\w+)','(\w+)','[^']*','[^']*','(\w+)',([\d.]+),[\d.]+,'(\w+)','([^']*)'\)")
V7_ROW = re.compile(r"\('(\w+)','([^']*)',([\d.]+),'(\w+)','[^']*',(?:'(\w+)'|NULL)\)")
TS_DASH_ROW = re.compile(r"factorKey: '(\w+)'.*?unit: '(\w+)', factorKgPerUnit: ([\d.]+)")
TS_TRACK_ROW = re.compile(r"\{ label: '([^']+)', emoji: '[^']*', factor: ([\d.]+), unit: '(\w+)'")
EXPORT_ROW = re.compile(r"^\| (Travel|Food|Electricity|Shopping|Waste) \| ([^|]+)\| (\w+) \| ([\d.]+) \| [\d.]+ \|$", re.M)


def parse_legacy(repo: Path) -> dict:
    read = lambda p: (repo / p).read_text(encoding="utf-8")
    v3 = {m[1]: {"category": m[0], "unit": m[2], "value": float(m[3]), "region": m[4], "source": m[5]}
          for m in V3_ROW.findall(read("database/migrations/V3__reference_data.sql"))}
    v7 = {m[0]: {"label": m[1], "value": float(m[2]), "unit": m[3], "alternative": m[4] or None}
          for m in V7_ROW.findall(read("database/migrations/V7__embodied_carbon_factors.sql"))}
    dash = {m[0]: {"unit": m[1], "value": float(m[2])} for m in TS_DASH_ROW.findall(read("lib/api/dashboard.ts"))}
    # lib/carbon.ts is keyed by label; map label -> factor_key via the V3 labels
    v3_labels = dict(re.findall(r"\('\w+','(\w+)','([^']*)'", read("database/migrations/V3__reference_data.sql")))
    by_label = {lbl: key for key, lbl in v3_labels.items()}
    track = {by_label.get(m[0], m[0]): {"unit": m[2], "value": float(m[1])} for m in TS_TRACK_ROW.findall(read("lib/carbon.ts"))}
    # The shared team export (datasets/v2/legacy/Carbonexo_Dataset_Export.md), section 1 table rows
    export = {by_label.get(m[1].strip(), m[1].strip()): {"unit": m[2].strip(), "value": float(m[3])}
              for m in EXPORT_ROW.findall(read("datasets/v2/legacy/Carbonexo_Dataset_Export.md"))}
    return {"V3__reference_data.sql": v3, "V7__embodied_carbon_factors.sql": v7,
            "lib/carbon.ts": track, "lib/api/dashboard.ts": dash, "Carbonexo_Dataset_Export.md": export}


def compare_legacy(inv: dict) -> list[str]:
    issues = []
    v3, track, dash, v7, export = (inv[k] for k in ("V3__reference_data.sql", "lib/carbon.ts", "lib/api/dashboard.ts",
                                                   "V7__embodied_carbon_factors.sql", "Carbonexo_Dataset_Export.md"))
    for key in sorted(set(v3) | set(track) | set(dash) | set(export)):
        vals = {name: copy.get(key, {}).get("value") for name, copy in
                (("V3", v3), ("carbon.ts", track), ("dashboard.ts", dash), ("export.md", export))}
        if len(set(vals.values())) > 1:
            issues.append(f"{key}: copies disagree {vals}")
    for shop_key, emb_key in (("clothing_item", "clothing"), ("electronics", "electronics")):
        if shop_key in v3 and emb_key in v7 and v3[shop_key]["value"] != v7[emb_key]["value"]:
            issues.append(f"{shop_key} (shopping, {v3[shop_key]['value']}) vs embodied {emb_key} ({v7[emb_key]['value']}): two incompatible values for the same purchase")
    regions = {r["region"] for r in v3.values()}
    if regions == {"GLOBAL"}:
        issues.append("all activity factors are region GLOBAL - no region-specific factor can ever be selected")
    unsourced = [k for k, r in v3.items() if r["source"] in ("frontend catalog", "")]
    if unsourced:
        issues.append(f"{len(unsourced)}/{len(v3)} activity factors cite 'frontend catalog' (circular provenance)")
    return issues


def cmd_inventory(_args) -> int:
    inv = parse_legacy(REPO)
    issues = compare_legacy(inv)
    BUILD.mkdir(parents=True, exist_ok=True)
    (BUILD / "legacy_inventory.json").write_text(json.dumps({"copies": inv, "issues": issues}, indent=2, ensure_ascii=False), encoding="utf-8")
    counts = {k: len(v) for k, v in inv.items()}
    print(f"legacy factor copies: {counts}")
    for i in issues:
        print("[legacy]", i)
    return 0  # informational: legacy issues are tracked in FACTOR_DISCREPANCIES.csv, not build failures


def main(argv: list[str]) -> int:
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("command", choices=["fetch", "build", "inventory", "validate", "all"])
    args = p.parse_args(argv)
    if args.command == "all":
        return cmd_fetch(args) or cmd_inventory(args) or cmd_build(args)
    return {"fetch": cmd_fetch, "build": cmd_build, "inventory": cmd_inventory, "validate": cmd_validate}[args.command](args)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
