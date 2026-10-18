"""
Validates an OKF v0.2 bundle in two separate layers:

  1. OKF conformance (SPEC section 11): parseable frontmatter, non-empty `type`, reserved
     `index.md`/`log.md` structure. Only these can make a bundle NON-CONFORMANT.
     SHOULD-level spec guidance (ISO timestamps, actor convention, footnote keys) is reported
     as warnings, as the spec requires consumers not to reject on soft guidance.
  2. Carbonexo policy (application-specific; never a statement about OKF conformance):
     provenance against the factor registry + manifest, regional applicability, honest trust
     claims, broken internal links, missing evidence, staleness, duplicate/conflicting factors.

    python -I scripts/dataset_v2/okf_validate.py [BUNDLE_DIR] [--now ISO] [--out REPORT.json]
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
import okf_producer  # noqa: E402
import pipeline  # noqa: E402

ISO = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$")
ACTOR = re.compile(r"^(?:human:[\w.@-]+|process:[\w.-]+|[\w.-]+/[\w.-]+)$")
LINK = re.compile(r"\[[^\]]*\]\(([^)\s]+)\)")
FOOTNOTE_REF = re.compile(r"\[\^([^\]]+)\](?!:)")
FOOTNOTE_DEF = re.compile(r"^\[\^([^\]]+)\]:", re.M)
RESERVED = {"index.md", "log.md"}
STATUSES = {"draft", "stable", "deprecated"}


def parse_dt(s: str) -> datetime:
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def events(fm: dict) -> list[dict]:
    v = fm.get("verified")
    return [v] if isinstance(v, dict) else [e for e in (v or []) if isinstance(e, dict)]


def trust_tier(fm: dict) -> str:
    ev = events(fm)
    if not ev:
        return "unverified"
    return "human-reviewed" if any(str(e.get("by", "")).startswith("human:") for e in ev) else "machine-confirmed"


def is_stale(fm: dict, now: datetime) -> bool:
    s = fm.get("stale_after")
    return bool(isinstance(s, str) and ISO.match(s) and now >= parse_dt(s))


def load_bundle(bundle: Path) -> tuple[dict, list[str]]:
    concepts, errors = {}, []
    for p in sorted(bundle.rglob("*.md")):
        rel = str(p.relative_to(bundle)).replace("\\", "/")
        if p.name in RESERVED:
            continue
        text = p.read_text(encoding="utf-8")
        try:
            fm, body = okf_producer.parse_concept(text)
        except (yaml.YAMLError, StopIteration) as e:
            errors.append(f"{rel}: unparseable frontmatter ({e.__class__.__name__})")
            continue
        if not isinstance(fm, dict) or not text.startswith("---"):
            errors.append(f"{rel}: missing YAML frontmatter block")
            continue
        if not str(fm.get("type") or "").strip():
            errors.append(f"{rel}: frontmatter has no non-empty `type`")
        concepts[rel[:-3]] = {"path": rel, "fm": fm, "body": body}
    return concepts, errors


def check_reserved(bundle: Path) -> list[str]:
    errors = []
    for p in bundle.rglob("index.md"):
        rel = str(p.relative_to(bundle)).replace("\\", "/")
        text = p.read_text(encoding="utf-8")
        if text.startswith("---"):
            fm, _ = okf_producer.parse_concept(text)
            if p.parent != bundle or set(fm) - {"okf_version"}:
                errors.append(f"{rel}: index.md frontmatter is only allowed at the bundle root and only `okf_version`")
    for p in bundle.rglob("log.md"):
        rel = str(p.relative_to(bundle)).replace("\\", "/")
        dates = re.findall(r"^## (.+)$", p.read_text(encoding="utf-8"), re.M)
        for d in dates:
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d.strip()):
                errors.append(f"{rel}: log date heading '{d}' is not ISO YYYY-MM-DD")
        if dates != sorted(dates, reverse=True):
            errors.append(f"{rel}: log entries must be newest first")
    return errors


def spec_warnings(cid: str, fm: dict, body: str) -> list[str]:
    w = []
    for key in ("stale_after",):
        if key in fm and not (isinstance(fm[key], str) and ISO.match(fm[key])):
            w.append(f"{cid}: {key} is not an ISO 8601 datetime with explicit offset")
    gen = fm.get("generated")
    if gen is not None:
        if not isinstance(gen, dict) or not gen.get("by"):
            w.append(f"{cid}: generated.by is required within generated")
        else:
            if not ACTOR.match(str(gen["by"])):
                w.append(f"{cid}: generated.by '{gen['by']}' does not follow the actor convention")
            if "at" in gen and not ISO.match(str(gen["at"])):
                w.append(f"{cid}: generated.at is not ISO 8601 with offset")
    for e in events(fm):
        if not ACTOR.match(str(e.get("by", ""))):
            w.append(f"{cid}: verified.by '{e.get('by')}' does not follow the actor convention")
        if not ISO.match(str(e.get("at", ""))):
            w.append(f"{cid}: verified.at is not ISO 8601 with offset")
    if "status" in fm and fm["status"] not in STATUSES:
        w.append(f"{cid}: status '{fm['status']}' is not draft|stable|deprecated")
    srcs = fm.get("sources") or []
    ids = set()
    for s in srcs:
        if not isinstance(s, dict) or not s.get("resource"):
            w.append(f"{cid}: a sources entry has no resource")
            continue
        if s.get("id"):
            ids.add(s["id"])
        if "last_modified" in s and not ISO.match(str(s["last_modified"])):
            w.append(f"{cid}: sources[{s.get('id')}].last_modified is not ISO 8601 with offset")
    for ref in set(FOOTNOTE_REF.findall(body)) | set(FOOTNOTE_DEF.findall(body)):
        if ref not in ids:
            w.append(f"{cid}: footnote [^{ref}] has no matching sources[].id")
    return w


def policy_checks(concepts: dict, bundle: Path, now: datetime, run_at: datetime | None) -> dict:
    out = {k: [] for k in ("errors", "missing_evidence", "stale", "conflicts", "broken_links", "warnings")}
    manifest = pipeline.load_manifest()
    reg_path = pipeline.BUILD / f"candidate_factors.{pipeline.DATASET_VERSION}.json"
    registry = {f["factor_id"]: f for f in json.loads(reg_path.read_text(encoding="utf-8"))["factors"]}
    reviews = set()
    if okf_producer.HUMAN_REVIEWS.exists():
        with okf_producer.HUMAN_REVIEWS.open(encoding="utf-8", newline="") as f:
            reviews = {(r["concept_id"], f"human:{r['reviewer']}", r["reviewed_at"]) for r in csv.DictReader(f) if r["verdict"] == "approved"}
    seen_factor = {}
    for cid, c in concepts.items():
        fm, body = c["fm"], c["body"]
        cx = fm.get("carbonexo") or {}
        # honest trust: every human: event needs a matching review row
        for e in events(fm):
            if str(e.get("by", "")).startswith("human:") and (cid, e["by"], e.get("at")) not in reviews:
                out["errors"].append(f"{cid}: human verification event {e['by']} has no matching row in reviewed/human_reviews.csv")
            if run_at and ISO.match(str(e.get("at", ""))) and parse_dt(e["at"]) > run_at:
                out["errors"].append(f"{cid}: verified.at {e['at']} is after the producer run")
        gen_at = (fm.get("generated") or {}).get("at")
        if run_at and isinstance(gen_at, str) and ISO.match(gen_at) and parse_dt(gen_at) > run_at:
            out["errors"].append(f"{cid}: generated.at {gen_at} is after the producer run (future timestamp)")
        if fm.get("status") == "stable" and trust_tier(fm) != "human-reviewed":
            out["errors"].append(f"{cid}: status stable requires a human review under the Carbonexo policy")
        if "status" not in fm:
            out["errors"].append(f"{cid}: Carbonexo producers must write status explicitly")
        if is_stale(fm, now):
            out["stale"].append(f"{cid}: stale since {fm['stale_after']}")
        # links
        for link in LINK.findall(body):
            if link.startswith(("http://", "https://", "#", "mailto:")):
                continue
            target = (bundle / link.lstrip("/")) if link.startswith("/") else (bundle / c["path"]).parent / link
            if not target.exists():
                out["broken_links"].append(f"{cid}: {link}")
        # provenance for factor concepts
        if fm.get("type") == "Emission Factor":
            if cx.get("scientific_status") == "unsupported":
                if fm.get("status") != "deprecated":
                    out["errors"].append(f"{cid}: unsupported factor must be status deprecated")
                if cx.get("production_display") != "not_estimated" or cx.get("ai_use") != "forbidden":
                    out["errors"].append(f"{cid}: unsupported factor must be not_estimated and ai_use forbidden")
                continue
            fid = cx.get("factor_id")
            if fid in seen_factor:
                out["conflicts"].append(f"duplicate factor_id {fid} in {seen_factor[fid]} and {cid}")
            seen_factor[fid] = cid
            rec = registry.get(fid)
            if rec is None:
                out["errors"].append(f"{cid}: factor_id {fid} not in registry {pipeline.DATASET_VERSION}")
                continue
            for k_doc, k_reg in (("value", "value"), ("unit", "unit"), ("region", "region"), ("dataset_version", "dataset_version"),
                                 ("scientific_status", "scientific_status")):
                if cx.get(k_doc) != rec[k_reg]:
                    out["errors"].append(f"{cid}: carbonexo.{k_doc}={cx.get(k_doc)!r} differs from registry {rec[k_reg]!r}")
            if rec["source_id"] not in manifest:
                out["errors"].append(f"{cid}: source {rec['source_id']} not in manifest")
            if not any(s.get("resource") == f"/sources/{rec['source_id']}.md" for s in fm.get("sources") or []):
                out["errors"].append(f"{cid}: sources must link the source concept /sources/{rec['source_id']}.md")
            if cx.get("region") in ("GB", "US") and "IN" in (cx.get("applies_to_regions", []) + cx.get("proxy_regions", [])):
                out["errors"].append(f"{cid}: Decision 1 violation (UK/US factor applicable to IN)")
            if trust_tier(fm) == "unverified":
                out["missing_evidence"].append(f"{cid}: no machine or human confirmation against its source")
            if rec["scientific_status"] == "provisional":
                out["missing_evidence"].append(f"{cid}: provisional factor (needs manual review)")
    # registry-level contradictions for measures declared in the pilot config
    pilot = json.loads(okf_producer.PILOT.read_text(encoding="utf-8"))
    for key, ids in pilot.get("measures", {}).items():
        vals = {i: registry[i]["value"] for i in ids if i in registry}
        if len(set(vals.values())) > 1:
            out["conflicts"].append(f"measure {key}: records disagree {vals}")
    # the bundle must not contain user data
    for cid, c in concepts.items():
        if re.search(r"[\w.+-]+@[\w-]+\.[\w.]+", c["body"]) or "user_id" in json.dumps(c["fm"]):
            out["errors"].append(f"{cid}: possible user data in knowledge bundle")
    return out


def validate(bundle: Path, now: datetime) -> dict:
    concepts, conf_errors = load_bundle(bundle)
    conf_errors += check_reserved(bundle)
    warnings = [w for cid, c in concepts.items() for w in spec_warnings(cid, c["fm"], c["body"])]
    record_path = bundle / okf_producer.BUILD_RECORD
    run_at = parse_dt(json.loads(record_path.read_text(encoding="utf-8"))["run_at"]) if record_path.exists() else None
    policy = policy_checks(concepts, bundle, now, run_at)
    tiers = {}
    for c in concepts.values():
        tiers[trust_tier(c["fm"])] = tiers.get(trust_tier(c["fm"]), 0) + 1
    statuses = {}
    for c in concepts.values():
        statuses[c["fm"].get("status", "stable(absent)")] = statuses.get(c["fm"].get("status", "stable(absent)"), 0) + 1
    return {
        "bundle": str(bundle.relative_to(pipeline.REPO)).replace("\\", "/") if bundle.is_relative_to(pipeline.REPO) else str(bundle),
        "validated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "concepts": len(concepts),
        "types": sorted({str(c["fm"].get("type") or "<missing>") for c in concepts.values()}),
        "okf_conformant": not conf_errors,
        "okf_conformance_errors": conf_errors,
        "okf_spec_warnings": warnings,
        "trust_tiers": tiers,
        "statuses": statuses,
        "carbonexo_policy_passed": not policy["errors"] and not policy["broken_links"] and not policy["conflicts"],
        "carbonexo_policy": policy,
        "note": "OKF conformance does not imply scientific correctness. No concept is human-reviewed unless reviewed/human_reviews.csv says so.",
    }


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("bundle", nargs="?", type=Path, default=pipeline.REPO / "datasets/v2/okf/bundle/ecomind")
    ap.add_argument("--now", default=None)
    ap.add_argument("--out", type=Path, default=pipeline.BUILD / "okf_validation_report.json")
    a = ap.parse_args(argv)
    now = parse_dt(a.now) if a.now else datetime.now(timezone.utc)
    report = validate(a.bundle.resolve(), now)
    a.out.parent.mkdir(parents=True, exist_ok=True)
    a.out.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {k: report[k] for k in ("concepts", "okf_conformant", "trust_tiers", "statuses", "carbonexo_policy_passed")}
    summary.update({k: len(v) for k, v in report["carbonexo_policy"].items()})
    summary["okf_spec_warnings"] = len(report["okf_spec_warnings"])
    print(json.dumps(summary, indent=2))
    for k in ("okf_conformance_errors", "okf_spec_warnings"):
        for e in report[k]:
            print(f"[{k}] {e}")
    for k, v in report["carbonexo_policy"].items():
        for e in v:
            print(f"[policy:{k}] {e}")
    return 0 if report["okf_conformant"] and report["carbonexo_policy_passed"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
