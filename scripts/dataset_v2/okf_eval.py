"""
Pilot retrieval evaluation: flat RAG baseline vs OKF-enriched RAG, same held-out eval cases,
same chunks, same BM25 scorer. The only difference is the OKF layer (metadata, policy
filters, numeric masking, link resolution, provenance labels).

    python -I scripts/dataset_v2/okf_eval.py  # -> datasets/v2/eval/results/okf_pilot_retrieval.report.json

Scope (honest): retrieval-level metrics only. Answer groundedness and explanation accuracy need
generation (Gemini) + judging, which are not run without approval. The 15-concept pilot covers a
subset of the 172 cases; only cases with at least one relevant pilot concept are scored.
"""
from __future__ import annotations

import json
import re
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import okf_consumer as oc  # noqa: E402
import okf_producer  # noqa: E402
import pipeline  # noqa: E402

BUNDLE = pipeline.REPO / "datasets/v2/okf/bundle/ecomind"
CASES = pipeline.V2 / "eval" / "coach_eval.v1.jsonl"
LABELS = pipeline.V2 / "eval" / "okf_pilot_relevance.v1.json"
OUT = pipeline.V2 / "eval" / "results" / "okf_pilot_retrieval.report.json"
K = 3
NOWS = {"fresh_2026-10-17": datetime(2026, 10, 17, 12, tzinfo=timezone.utc),
        "after_staleness_2027-01-05": datetime(2027, 1, 5, tzinfo=timezone.utc)}


def relevance_labels() -> dict:
    pilot = json.loads(okf_producer.PILOT.read_text(encoding="utf-8"))
    fac = {c["factor_id"]: c["path"][:-3] for c in pilot["factors"]}
    src = {c["source_id"]: c["path"][:-3] for c in pilot["sources"]}
    labels = {}
    for line in CASES.read_text(encoding="utf-8").splitlines():
        c = json.loads(line)
        q = c["question"].lower()
        rel = {fac[f] for e in c["expected_values"] for f in e["derived_from"] if f in fac}
        rel |= {src[s] for s in c["required_sources"] if s in src}
        if c["category"] == "double_counting" and re.search(r"kwh|\bac\b|meter|bill|geyser|appliance", q) or c["case_id"] == "DSH-004":
            rel.add("accounting/meter-vs-appliance")
        if c["category"] == "indian_grid_electricity" and re.search(r"t&d|transmission|solar|factor|loss|2025-26|updated", q):
            rel.add("methodology/in-grid-electricity")
        if c["category"] == "carbon_twin" and rel:
            rel.add("computations/carbon-twin-scenario")
        if re.search(r"cloth|t-shirt", q):
            rel.add("policies/verification-policy")
        if rel:
            labels[c["case_id"]] = {"question": c["question"], "region": c["region"], "category": c["category"], "relevant": sorted(rel)}
    return labels


class Flat:
    """Baseline: plain section chunks of the same bundle, no metadata, no filters, no masking, no links."""

    def __init__(self, b: oc.Bundle):
        self.b = b
        self.chunks = []
        for cid, c in b.concepts.items():
            body = re.sub(r"^\[\^[^\]]+\]:.*$", "", c["body"], flags=re.M)
            parts = re.split(r"^# .+$", body, flags=re.M)
            self.chunks += [(cid, p.strip()) for p in parts if p.strip()]
        self.tf = [Counter(oc.tokens(t)) for _, t in self.chunks]
        self.df = Counter(t for tf in self.tf for t in tf)
        self.avgdl = sum(sum(tf.values()) for tf in self.tf) / len(self.tf)

    def retrieve(self, q: str) -> list[tuple[str, str]]:
        import math
        qt, n, out = oc.tokens(q), len(self.chunks), []
        for (cid, text), tf in zip(self.chunks, self.tf):
            dl, s = sum(tf.values()), 0.0
            for t in qt:
                if tf.get(t):
                    idf = math.log(1 + (n - self.df[t] + 0.5) / (self.df[t] + 0.5))
                    s += idf * tf[t] * 2.4 / (tf[t] + 1.4 * (0.25 + 0.75 * dl / self.avgdl))
            out.append((s, cid, text))
        seen, res = set(), []
        for s, cid, text in sorted(out, key=lambda x: -x[0]):
            if s > 0 and cid not in seen:
                seen.add(cid)
                res.append((cid, text))
        return res[:K]


def metrics(rows: list[dict]) -> dict:
    n = len(rows)
    return {
        "cases": n,
        "precision_at_3": round(sum(r["p"] for r in rows) / n, 4),
        "recall_at_3": round(sum(r["r"] for r in rows) / n, 4),
        "mrr": round(sum(r["rr"] for r in rows) / n, 4),
        "region_violations": sum(r["region_violation"] for r in rows),
        "deprecated_or_stale_served_as_evidence": sum(r["bad_grade"] for r in rows),
        "raw_factor_numbers_exposed": sum(r["numeric_exposure"] for r in rows),
        "items_with_resolvable_citation_pct": round(100 * sum(r["cite_ok"] for r in rows) / max(1, sum(r["items"] for r in rows)), 1),
        "items_labelled_with_trust_pct": round(100 * sum(r["labelled"] for r in rows) / max(1, sum(r["items"] for r in rows)), 1),
    }


def score(retrieved: list[str], relevant: list[str]) -> tuple[float, float, float]:
    hits = [c for c in retrieved if c in relevant]
    rr = next((1 / (i + 1) for i, c in enumerate(retrieved) if c in relevant), 0.0)
    return (len(hits) / K, len(set(hits)) / len(relevant), rr)


def run() -> dict:
    labels = relevance_labels()
    LABELS.write_text(json.dumps({"labels_version": "okf-pilot-relevance.v1", "rule_based": True, "human_review": "pending",
                                  "cases": labels}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    manifest = set(pipeline.load_manifest())
    report = {"k": K, "labelled_cases": len(labels), "scenarios": {}}
    for scen, now in NOWS.items():
        b = oc.Bundle(BUNDLE, now)
        flat = Flat(b)
        values = {c["fm"]["carbonexo"]["factor_id"]: str(c["fm"]["carbonexo"]["value"]) for c in b.concepts.values()
                  if (c["fm"].get("carbonexo") or {}).get("factor_id")}
        values["legacy"] = "10.0"
        grade = {ch.concept_id: ch.meta["grade"] for ch in b.chunks}
        region_of = {ch.concept_id: ch.meta["region"] for ch in b.chunks}
        rows_flat, rows_okf = [], []
        for cid, lab in labels.items():
            reg = lab["region"] if lab["region"] in ("IN", "GB") else None
            f = flat.retrieve(lab["question"])
            fr = [x[0] for x in f]
            p, r, rr = score(fr, lab["relevant"])
            rows_flat.append({"p": p, "r": r, "rr": rr, "items": len(f),
                              "region_violation": int(reg == "IN" and any(region_of.get(x) in ("GB", "US") for x in fr)),
                              "bad_grade": sum(grade[x] in ("deprecated", "stale") for x in fr),
                              "numeric_exposure": int(any(re.search(rf"(?<![\d.]){re.escape(v)}(?![\d])", t) for _, t in f for v in values.values())),
                              "cite_ok": 0, "labelled": 0})
            o = b.retrieve(lab["question"], region=reg, k=K)
            orr = [it["concept_id"] for it in o["items"]]
            p, r, rr = score(orr, lab["relevant"])
            rows_okf.append({"p": p, "r": r, "rr": rr, "items": len(o["items"]),
                             "region_violation": int(reg == "IN" and any(it["region"] in ("GB", "US") for it in o["items"])),
                             "bad_grade": sum(it["grade"] in ("deprecated", "stale") for it in o["items"]),
                             "numeric_exposure": int(any(re.search(rf"(?<![\d.]){re.escape(v)}(?![\d])", it["text"]) for it in o["items"] for v in values.values())),
                             "cite_ok": sum(any(c["id"] in manifest or str(c["resource"]).startswith("/") for c in it["citations"]) for it in o["items"]),
                             "labelled": sum(bool(it["label"]) for it in o["items"])})
        report["scenarios"][scen] = {"flat_rag": metrics(rows_flat), "okf_rag": metrics(rows_okf)}
    return report


def main() -> int:
    report = run()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
