"""
Dataset V2 -> Open Knowledge Format (OKF) v0.2 producer for the EcoMind knowledge bundle.

    python -I scripts/dataset_v2/okf_producer.py [--now 2026-10-17T10:00:00Z]

Reads (never modifies): build/candidate_factors.<v>.json, SOURCE_MANIFEST.json,
reviewed/legacy_factor_status.csv, reviewed/human_reviews.csv, schema/coach_tools.v1.json,
okf/pilot.v1.json, okf/authored/**, okf/references/**, raw/ artifacts (for source checks).
Writes: okf/bundle/ecomind/** (regenerated), including .okf-build.json (run record).

Honesty rules (see /policies/verification-policy.md in the bundle):
  * `verified` gets `process:carbonexo-source-check` only when this run re-read the value from
    the hash-pinned artifact and it matched; `process:carbonexo-source-fetch` only when the
    artifact's sha256 matched the manifest pin in this run.
  * `human:<id>` events come ONLY from reviewed/human_reviews.csv. The file has no rows today.
  * Every concept carries `status` explicitly: draft until a human review exists; deprecated
    for unsupported legacy values.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

OKF = pipeline.V2 / "okf"
PILOT = OKF / "pilot.v1.json"
HUMAN_REVIEWS = pipeline.V2 / "reviewed" / "human_reviews.csv"
TOOLS = pipeline.V2 / "schema" / "coach_tools.v1.json"
LEGACY = pipeline.V2 / "reviewed" / "legacy_factor_status.csv"
BUILD_RECORD = ".okf-build.json"
TYPE_BY_KIND = {"emission_factor": "Emission Factor", "benchmark": "Benchmark", "equivalency": "Equivalency",
                "target": "Target", "behavioural_estimate": "Behavioural Estimate"}


class _Loader(yaml.SafeLoader):
    """Keep timestamps as authored text (same choice as the OKF reference agent's document.py)."""


_Loader.yaml_implicit_resolvers = {
    ch: [(t, r) for t, r in rs if t != "tag:yaml.org,2002:timestamp"]
    for ch, rs in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def parse_concept(text: str) -> tuple[dict, str]:
    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return {}, text
    end = next(i for i in range(1, len(lines)) if lines[i].strip() == "---")
    fm = yaml.load("\n".join(lines[1:end]), Loader=_Loader) or {}
    body = "\n".join(lines[end + 1:]).lstrip("\n")
    return fm, body


def render(fm: dict, body: str) -> str:
    fm_text = yaml.safe_dump(fm, sort_keys=False, allow_unicode=True, width=1000, default_flow_style=None).rstrip()
    return f"---\n{fm_text}\n---\n\n{body.rstrip()}\n"


def iso_day(date_str: str | None) -> str | None:
    """'2025-06-10' -> '2025-06-10T00:00:00Z'; partial dates ('2026-02', '2015') have no exact instant -> None."""
    return f"{date_str}T00:00:00Z" if date_str and re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_str) else None


# ---- source checks (machine confirmation against the pinned artifact) -----------------------
class SourceChecker:
    def __init__(self, manifest: dict):
        self.manifest = manifest
        self._text: dict[str, str | None] = {}

    def artifact(self, sid: str) -> Path:
        return pipeline.RAW / self.manifest[sid]["fetch"]["filename"]

    def hash_ok(self, sid: str) -> bool:
        fetch = self.manifest[sid].get("fetch", {})
        path = pipeline.RAW / (fetch.get("filename") or "__none__")
        return bool(fetch.get("sha256")) and path.exists() and pipeline.sha256(path) == fetch["sha256"]

    def pdf_text(self, sid: str) -> str | None:
        if sid not in self._text:
            exe = shutil.which("pdftotext")
            if not exe or not self.hash_ok(sid):
                self._text[sid] = None
            else:
                out = subprocess.run([exe, "-layout", str(self.artifact(sid)), "-"], capture_output=True, timeout=120)
                self._text[sid] = out.stdout.decode("utf-8", errors="replace") if out.returncode == 0 else None
        return self._text[sid]

    def check(self, factor: dict, cfg: dict | None) -> dict:
        if not cfg:
            return {"status": "not_configured"}
        sid, method = cfg["artifact"], cfg["method"]
        if not self.hash_ok(sid):
            return {"status": "not_run", "reason": f"{sid} artifact missing or hash mismatch"}
        if method == "desnz_reextract":
            year = int(factor["factor_id"].rsplit(".y", 1)[1])
            fresh = {f["factor_id"]: f for f in pipeline.extract_desnz(self.manifest[sid], year)}[factor["factor_id"]]
            ok = fresh["value"] == factor["value"]
            return {"status": "passed" if ok else "failed", "method": method, "artifact_sha256": self.manifest[sid]["fetch"]["sha256"],
                    "evidence": fresh["source_locator"], "reextracted_value": fresh["value"]}
        text = self.pdf_text(sid)
        if text is None:
            return {"status": "not_run", "reason": "pdftotext unavailable"}
        m = re.search(cfg["pattern"], text)
        if not m:
            return {"status": "failed", "method": method, "reason": "pattern not found in source text"}
        if method == "pdftotext_row_ratio":
            a, b = (float(m.group(g)) for g in cfg["ratio_groups"])
            value = round(a / b, cfg["round"])
        else:
            value = float(m.group(cfg["value_group"]))
        return {"status": "passed" if value == factor["value"] else "failed", "method": method,
                "artifact_sha256": self.manifest[sid]["fetch"]["sha256"], "evidence": " ".join(m.group(0).split()),
                "source_value": value}


def human_events(concept_id: str) -> list[dict]:
    if not HUMAN_REVIEWS.exists():
        return []
    with HUMAN_REVIEWS.open(encoding="utf-8", newline="") as f:
        return [{"by": f"human:{r['reviewer']}", "at": r["reviewed_at"]} for r in csv.DictReader(f)
                if r["concept_id"] == concept_id and r["verdict"] == "approved"]


def lifecycle_status(concept_id: str, deprecated: bool = False) -> str:
    if deprecated:
        return "deprecated"
    return "stable" if human_events(concept_id) else "draft"


# ---- concept builders -----------------------------------------------------------------------
def factor_concept(cfg: dict, factor: dict, all_factors: dict, check: dict, now: str, as_of: str, measures: dict) -> tuple[dict, str]:
    fid, sid = factor["factor_id"], factor["source_id"]
    cid = cfg["path"][:-3]
    verified = human_events(cid)
    if check.get("status") == "passed":
        verified.append({"by": "process:carbonexo-source-check", "at": now})
    fm = {
        "type": TYPE_BY_KIND[factor["record_kind"]],
        "title": cfg["title"],
        "description": f"{factor['value']} {factor['unit']} ({factor['gases']}, {factor['applicable_year']}, {factor['region']}). Explanation only; numbers are served by the factor registry.",
        "resource": f"carbonexo://factor-registry/{factor['dataset_version']}/{fid}",
        "tags": cfg["tags"],
        "status": lifecycle_status(cid),
        "generated": {"by": PRODUCER, "at": as_of},
    }
    if verified:
        fm["verified"] = verified
    fm["stale_after"] = cfg["stale_after"]
    fm["sources"] = [{"id": sid, "resource": f"/sources/{sid}.md", "title": factor["source_publisher"]}]
    fm["carbonexo"] = {
        "factor_id": fid, "dataset_version": factor["dataset_version"], "value": factor["value"], "unit": factor["unit"],
        "region": factor["region"], "applies_to_regions": factor["applies_to_regions"], "proxy_regions": factor["proxy_regions"],
        "accounting_scope": factor["scope"], "system_boundary": factor["system_boundary"], "gases": factor["gases"],
        "applicable_year": factor["applicable_year"], "statistic": factor["statistic"], "source_table": factor["source_locator"],
        "license": factor["license"], "license_status": factor["license_status"],
        "scientific_status": factor["scientific_status"], "evidence_verification": factor["verification_status"],
        "uncertainty": factor["uncertainty"], "superseded_by": factor["superseded_by"],
        "internal_review_status": "approved" if human_events(cid) else "pending_human_review",
        "retrieval_role": "explanation_only", "numeric_authority": "factor_registry",
    }
    region_link = {"IN": "[India](/regions/in.md)"}.get(factor["region"], factor["region"])
    if factor["region"] in ("GB", "US"):
        applic = (f"Measured in {factor['region']}. Applies to {', '.join(factor['applies_to_regions'])} only. It is **never** applied to "
                  "Indian users, not even as a proxy (Decision 1); see the [verification policy](/policies/verification-policy.md).")
    else:
        proxy = ", ".join(factor["proxy_regions"]) or "none"
        applic = f"Measured for {region_link}. Direct default for: {', '.join(factor['applies_to_regions'])}. Proxy for: {proxy}."
    corro = ""
    for key, ids in measures.items():
        if fid in ids:
            rows = [f"- `{o}` = {all_factors[o]['value']} {all_factors[o]['unit']} ({all_factors[o]['source_id']}, {all_factors[o]['verification_status']})"
                    for o in ids if o != fid and o in all_factors]
            agree = all(all_factors[o]["value"] == factor["value"] for o in ids if o in all_factors)
            corro = f"\n# Corroboration\n\nMeasure `{key}`: {'all records agree' if agree else 'RECORDS CONFLICT'}.\n\n" + "\n".join(rows) + "\n"
    if check.get("status") == "passed":
        ver = (f"Machine-confirmed in this producer run ({check['method']}): `{check.get('evidence')}` in the artifact with sha256 "
               f"`{check['artifact_sha256'][:16]}...`. Not reviewed by a person.")
    else:
        ver = f"Not machine-confirmed ({check.get('status')}: {check.get('reason', 'no source check configured')}). Not reviewed by a person."
    links = "".join(f"\n- [{Path(l).stem.replace('-', ' ')}]({l})" for l in cfg.get("links", []))
    body = f"""# Value

| Field | Value |
|---|---|
| factor_id | `{fid}` |
| value | {factor['value']} {factor['unit']} |
| gases | {factor['gases']} |
| applicable year | {factor['applicable_year']} |
| statistic | {factor['statistic']} |
| dataset version | {factor['dataset_version']} |

The value comes from {factor['source_publisher']}, {factor['source_locator']}.[^{sid}] Calculations read it from the factor registry through the [activity emissions computation](/computations/activity-emissions.md), never from this text.

# Boundary

- Scope: {factor['scope']}
- System boundary: {factor['system_boundary']}

# Applicability

{applic}

# Uncertainty

Level **{factor['uncertainty']['level']}**: {factor['uncertainty']['notes']}.
{corro}
# Verification

{ver}

# Related
{links or chr(10) + '- none'}
- [getEmissionFactors](/tools/get-emission-factors.md)

[^{sid}]: {factor['source_publisher']}, {factor['source_locator']}
"""
    return fm, body


def legacy_concept(cfg: dict, row: dict, as_of: str) -> tuple[dict, str]:
    conflicts = "".join(f"\n- {c['table']} `{c['key']}` = {c['value']} kg/item" for c in cfg.get("conflicts_with", []))
    fm = {
        "type": "Emission Factor", "title": cfg["title"],
        "description": f"Legacy value {row['legacy_value']} kg/{row['legacy_unit']} with no traceable source. Unsupported: production shows Not estimated.",
        "tags": ["legacy", "unsupported", "shopping"],
        "status": "deprecated",
        "generated": {"by": PRODUCER, "at": as_of},
        "sources": [{"id": "legacy-v3", "resource": f"database/migrations/V3__reference_data.sql, emission_factors row {row['legacy_key']} (scope descriptor; the row's source column reads 'frontend catalog')",
                     "title": "Legacy V3 reference data"}],
        "carbonexo": {
            "legacy_key": row["legacy_key"], "legacy_value": float(row["legacy_value"]), "unit": f"kg/{row['legacy_unit']}",
            "scientific_status": row["scientific_status"], "production_display": row["production_display"],
            "demo_display": row["demo_display"], "ai_use": row["ai_use"], "missing_information": row["missing_information"],
            "discrepancy_ids": row["discrepancy_ids"].split(";"), "internal_review_status": "pending_human_review",
            "retrieval_role": "review_only",
        },
    }
    body = f"""# Status

**Unsupported.** The legacy value {row['legacy_value']} kg per {row['legacy_unit']} has no traceable source.[^legacy-v3] It is excluded from production calculations and from AI-generated factual claims. The UI shows **Not estimated**. The value may appear only in a clearly labelled demo mode.

# Conflicting legacy values
{conflicts}

Two incompatible values for the same purchase, both unsourced (audit {row['discrepancy_ids']}).

# Missing information

{row['missing_information']}

# Related

- [Verification policy](/policies/verification-policy.md)

[^legacy-v3]: Legacy V3 reference data
"""
    return fm, body


def source_concept(cfg: dict, src: dict, derived: list[tuple[str, str]], hash_ok: bool, now: str, as_of: str) -> tuple[dict, str]:
    sid = src["source_id"]
    cid = cfg["path"][:-3]
    lic = src.get("license", {})
    url = src.get("fetch", {}).get("url") or src.get("landing_url")
    entry = {"id": sid, "resource": url, "title": src["title"]}
    if iso_day(src.get("publication_date")):
        entry["last_modified"] = iso_day(src["publication_date"])
    verified = human_events(cid) + ([{"by": "process:carbonexo-source-fetch", "at": now}] if hash_ok else [])
    fm = {"type": "Scientific Source", "title": src["title"], "description": f"{src['publisher']}, published {src.get('publication_date')}.",
          "resource": src.get("landing_url") or url, "tags": ["source", src.get("region", "").lower() or "global"],
          "status": lifecycle_status(cid), "generated": {"by": PRODUCER, "at": as_of}}
    if verified:
        fm["verified"] = verified
    fm["stale_after"] = cfg["stale_after"]
    fm["sources"] = [entry]
    rag_ok = lic.get("status") == "verified" and lic.get("rag_allowed", True) is not False
    fm["carbonexo"] = {"source_id": sid, "publisher": src["publisher"], "publication_date": src.get("publication_date"),
                       "region": src.get("region"), "license": lic.get("name"), "license_status": lic.get("status", "unverified"),
                       "rag_text_allowed": rag_ok, "evidence_verification": src["verification_status"],
                       "sha256": src.get("fetch", {}).get("sha256"), "retrieved": src.get("retrieved"),
                       "internal_review_status": "pending_human_review"}
    notes = src.get("caveats", []) + src.get("review", {}).get("checks", [])
    caveats = "\n".join(f"- {n}" for n in notes) or "- none recorded"
    uses = "\n".join(f"- [{t}]({p})" for p, t in derived) or "- none in this bundle yet"
    body = f"""# About

{src['title']}, by {src['publisher']} ({src.get('publication_date')}).[^{sid}]

# Used for
{chr(10)}{uses}

# Caveats and review checks

{caveats}

# Licence

{lic.get('name', 'unknown')} (status: {lic.get('status', 'unverified')}). {'Its text may be indexed for retrieval.' if rag_ok else 'Its text is NOT indexed for retrieval; numbers enter only through the factor registry.'}

# Integrity

{'sha256 `' + src['fetch']['sha256'] + '` re-checked against the downloaded artifact in this producer run.' if hash_ok else 'No hash-pinned artifact was re-checked in this run.'}

[^{sid}]: {src['title']}
"""
    return fm, body


def region_concept(cfg: dict, factors: dict, pilot_factor_paths: dict, legacy_rows: list[dict], as_of: str) -> tuple[dict, str]:
    region = cfg["region"]
    direct = sorted(f for f, r in factors.items() if region in r["applies_to_regions"] and r["record_kind"] == "emission_factor")
    proxies = sorted(f for f, r in factors.items() if region in r["proxy_regions"])
    gaps = sorted({r["legacy_key"]: r["missing_information"] for r in legacy_rows
                   if r["scientific_status"] == "unsupported" and not r["v2_replacement"] and r["legacy_table"].startswith("emission_factors")}.items())
    in_bundle = "\n".join(f"- [{f}](/{p})" for f, p in pilot_factor_paths.items() if f in direct) or "- none"
    fm = {"type": "Region", "title": "India (IN)", "description": "Regional applicability rules, available factors and known evidence gaps for Indian users.",
          "tags": ["region", "india"], "status": "draft", "generated": {"by": PRODUCER, "at": as_of}, "stale_after": cfg["stale_after"],
          "sources": [{"id": "decision-1", "resource": "Carbonexo product decision 1, 2026-10-17 (scope descriptor: India-first region policy)", "title": "Decision 1: India first"}],
          "carbonexo": {"region": region, "default_for_new_users": "suggested_then_confirmed", "existing_accounts": "never_reassigned",
                        "direct_factor_count": len(direct), "proxy_factor_count": len(proxies), "internal_review_status": "pending_human_review"}}
    gap_lines = "\n".join(f"- `{k}`: {v}" for k, v in gaps)
    body = f"""# Region rules

India is suggested as the default region for new Indian users, who confirm or change it. Existing accounts are never reassigned silently.[^decision-1] Factors measured in the UK or US never apply to Indian users. A GLOBAL value may be a proxy only with an explicit uncertainty label. See the [verification policy](/policies/verification-policy.md).

# Methodology

- [Indian grid electricity](/methodology/in-grid-electricity.md)

# Factors in this bundle

{in_bundle}

The full registry has {len(direct)} direct Indian factor records and {len(proxies)} GLOBAL records usable as Indian proxies (dataset {next(iter(factors.values()))['dataset_version']}).

# Not estimated for Indian users

{gap_lines}

[^decision-1]: Decision 1: India first
"""
    return fm, body


def tool_concept(cfg: dict, tools: dict, as_of: str) -> tuple[dict, str]:
    t = next(x for x in tools["tools"] if x["name"] == cfg["name"])
    rules = tools["global_rules"]
    fm = {"type": "Tool Contract", "title": t["name"], "description": t["description"], "tags": ["tool", "ai-coach", "contract"],
          "status": "draft", "generated": {"by": PRODUCER, "at": as_of}, "stale_after": cfg["stale_after"],
          "sources": [{"id": "coach-tools", "resource": "datasets/v2/schema/coach_tools.v1.json (scope descriptor; repository file)", "title": tools["version"]}],
          "carbonexo": {"tool_version": tools["version"], "backed_by": t["backed_by"], "timeout_ms": t["timeout_ms"], "side_effects": "read-only",
                        "internal_review_status": "pending_human_review"}}
    links = "\n".join(f"- [{Path(l).stem.replace('-', ' ')}]({l})" for l in cfg["links"])
    body = f"""# Contract

{t['description']} Backed by `{t['backed_by']}`.[^coach-tools]

- Identity: {rules['identity']}
- Side effects: {rules['side_effects']}
- Numbers: {rules['numbers']}
- Not estimated: {rules['not_estimated']}

# Schema

Input:

```json
{json.dumps(t['input_schema'], indent=2)}
```

Output:

```json
{json.dumps(t['output_schema'], indent=2)}
```

# Related

{links}

[^coach-tools]: {tools['version']}
"""
    return fm, body


# ---- index / log --------------------------------------------------------------------------
def write_indexes(bundle: Path, okf_version: str) -> None:
    dirs = sorted({p.parent for p in bundle.rglob("*.md")} | {bundle})
    for d in dirs:
        concepts = sorted(p for p in d.glob("*.md") if p.name not in ("index.md", "log.md"))
        subdirs = sorted(p for p in d.iterdir() if p.is_dir() and any(p.rglob("*.md")))
        lines = []
        if d == bundle:
            lines += ["---", f'okf_version: "{okf_version}"', "---", ""]
        if concepts:
            lines += ["# Concepts", ""]
            for c in concepts:
                fm, _ = parse_concept(c.read_text(encoding="utf-8"))
                lines.append(f"* [{fm.get('title', c.stem)}]({c.name}) - {fm.get('description', '')}")
            lines.append("")
        if subdirs:
            lines += ["# Subdirectories", ""]
            for s in subdirs:
                lines.append(f"* [{s.name}]({s.name}/index.md) - {SUBDIR_DESC.get(s.name, s.name)}")
            lines.append("")
        (d / "index.md").write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")


SUBDIR_DESC = {
    "sources": "Scientific and government sources, with licence and integrity metadata.",
    "regions": "Regional applicability rules and evidence gaps.",
    "factors": "Emission factor definitions (explanation only; numbers come from the factor registry).",
    "in": "Indian factors.", "gb": "UK factors (never applied to Indian users).", "legacy": "Unsupported legacy values kept for review.",
    "methodology": "Regional calculation methodologies and boundaries.",
    "accounting": "Carbon accounting rules, including double-counting rules.",
    "computations": "Attested Computations: the only sanctioned way to produce a number.",
    "tools": "AI Coach tool and data contracts.",
    "policies": "Verification and trust policies.",
    "references": "Executor and attester code for Attested Computations.",
}

PRODUCER = "carbonexo-okf-producer/0.1.0"


def produce(now: str, out_dir: Path | None = None) -> dict:
    pilot = json.loads(PILOT.read_text(encoding="utf-8"))
    global PRODUCER
    PRODUCER = pilot["producer"]
    as_of = pilot["content_as_of"]
    manifest = pipeline.load_manifest()
    factors_path = pipeline.BUILD / f"candidate_factors.{pipeline.DATASET_VERSION}.json"
    factors = {f["factor_id"]: f for f in json.loads(factors_path.read_text(encoding="utf-8"))["factors"]}
    legacy_rows = list(csv.DictReader(LEGACY.open(encoding="utf-8", newline="")))
    tools = json.loads(TOOLS.read_text(encoding="utf-8"))
    bundle = out_dir or (pipeline.REPO / pilot["bundle_dir"])
    if bundle.exists():
        shutil.rmtree(bundle)
    bundle.mkdir(parents=True)
    checker = SourceChecker(manifest)
    written, checks = {}, {}

    def emit(rel: str, fm: dict, body: str):
        p = bundle / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(render(fm, body), encoding="utf-8")
        written[rel[:-3]] = fm["type"]

    pilot_factor_paths = {c["factor_id"]: c["path"] for c in pilot["factors"]}
    for c in pilot["factors"]:
        f = factors[c["factor_id"]]
        checks[c["factor_id"]] = checker.check(f, pilot["source_checks"].get(c["factor_id"]))
        emit(c["path"], *factor_concept(c, f, factors, checks[c["factor_id"]], now, as_of, pilot["measures"]))
    for c in pilot["legacy_factors"]:
        row = next(r for r in legacy_rows if r["legacy_key"] == c["legacy_key"] and r["legacy_table"].startswith("emission_factors"))
        emit(c["path"], *legacy_concept(c, row, as_of))
    for c in pilot["sources"]:
        derived = [("/" + p, factors[f]["factor_id"]) for f, p in pilot_factor_paths.items() if factors[f]["source_id"] == c["source_id"]]
        hash_ok = checker.hash_ok(c["source_id"])
        checks[c["source_id"]] = {"status": "passed" if hash_ok else "not_run", "method": "sha256_pin"}
        emit(c["path"], *source_concept(c, manifest[c["source_id"]], derived, hash_ok, now, as_of))
    for c in pilot["regions"]:
        emit(c["path"], *region_concept(c, factors, pilot_factor_paths, legacy_rows, as_of))
    for c in pilot["tools"]:
        emit(c["path"], *tool_concept(c, tools, as_of))
    for rel in pilot["authored"]:
        fm, body = parse_concept((OKF / "authored" / rel).read_text(encoding="utf-8"))
        if any(str(e.get("by", "")).startswith("human:") for e in ([fm["verified"]] if isinstance(fm.get("verified"), dict) else fm.get("verified", []))):
            raise SystemExit(f"{rel}: authored templates may not carry human: verification events; record reviews in {HUMAN_REVIEWS.name}")
        extra = human_events(rel[:-3])
        if extra:
            fm["verified"] = extra
            fm["status"] = "stable"
            fm.setdefault("carbonexo", {})["internal_review_status"] = "approved"
        emit(rel, fm, body)
    shutil.copytree(OKF / "references", bundle / "references", ignore=shutil.ignore_patterns("__pycache__"))
    (bundle / "log.md").write_text(
        "# EcoMind Knowledge Bundle Update Log\n\n"
        f"## {as_of[:10]}\n"
        f"* **Initialization**: Pilot bundle of {len(written)} concepts generated by {PRODUCER} from Carbonexo Dataset V2 {pipeline.DATASET_VERSION}. "
        "No concept has been reviewed by a person.\n", encoding="utf-8")
    write_indexes(bundle, pilot["okf_version"])
    files = {str(p.relative_to(bundle)).replace("\\", "/"): pipeline.sha256(p) for p in sorted(bundle.rglob("*")) if p.is_file()}
    digest = hashlib.sha256("".join(f"{k}:{v}\n" for k, v in sorted(files.items())).encode()).hexdigest()
    record = {"producer": PRODUCER, "run_at": now, "content_as_of": as_of, "okf_version": pilot["okf_version"],
              "dataset_version": pipeline.DATASET_VERSION, "registry_sha256": pipeline.sha256(factors_path),
              "manifest_sha256": pipeline.sha256(pipeline.MANIFEST), "concepts": written, "source_checks": checks,
              "files": files, "bundle_digest": digest}
    (bundle / BUILD_RECORD).write_text(json.dumps(record, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return record


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", default=datetime.now(timezone.utc).replace(second=0, microsecond=0).strftime("%Y-%m-%dT%H:%M:%SZ"))
    a = ap.parse_args(argv)
    rec = produce(a.now)
    passed = sum(1 for c in rec["source_checks"].values() if c.get("status") == "passed")
    print(f"wrote {len(rec['concepts'])} concepts -> {Path(json.loads(PILOT.read_text(encoding='utf-8'))['bundle_dir'])}  "
          f"(source checks passed: {passed}/{len(rec['source_checks'])}; bundle_digest {rec['bundle_digest'][:16]})")
    for k, v in rec["source_checks"].items():
        print(f"  {k}: {v.get('status')} {v.get('evidence', v.get('reason', ''))}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
