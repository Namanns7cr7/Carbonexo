"""
Offline scorer for the AI Coach evaluation set.

    python -I scripts/dataset_v2/scoring.py RESPONSES.jsonl [--out REPORT.json]

A response line: {"case_id", "answer", "tool_calls": [{"name", "output"?}], "citations": [source_id],
                  "latency_ms"?, "input_tokens"?, "output_tokens"?, "model"?}

What it measures deterministically (no LLM judge):
  numeric_accuracy      expected values found in the answer within rel_tolerance
  tool_use_accuracy     required tools were called
  citation_recall       required source_ids were cited
  fabricated_citations  cited ids that do not exist in SOURCE_MANIFEST.json
  prohibited_claims     regex hits from the case's prohibited list
  behavior              not_estimated / refuse / ask_clarification / uncertainty markers
  ungrounded_numbers    kg/kWh/% numbers in the answer that match neither an expected value
                        nor a number in a tool output of the same turn (groundedness proxy)
  latency / cost        from the response metadata and PRICE_PER_1M

Groundedness and helpfulness also need an LLM or human judge. Those scores are added by the
reviewer workflow (RAG_INTEGRATION_PLAN.md section 9). This scorer is the gate that must pass first.
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

CASES = pipeline.V2 / "eval" / "coach_eval.v1.jsonl"
PRICE_PER_1M = {  # USD, Vertex AI list prices via aggregators 2026-05; re-check before budgeting
    "gemini-2.5-flash": {"input": 0.30, "output": 2.50},
    "gemini-2.5-pro": {"input": 1.25, "output": 10.00},
}
NUM = re.compile(r"(?<![\w.])[-−]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\d)")
UNIT_NUM = re.compile(r"([-−]?\d+(?:,\d{3})*(?:\.\d+)?)\s?(?:kg|t\b|tonnes?|kWh|g\b|%)", re.I)
REFUSAL = re.compile(r"\b(?:can(?:no|')t|won'?t|will not|unable|not able|not allowed|don'?t have access|can't share|cannot share|not permitted|decline)\b", re.I)
NEGATED = re.compile(r"\b(?:can(?:no|')t|cannot|won'?t|will not|do(?:es)? not|don'?t|doesn'?t|is not|isn'?t|are not|not|never|unable|no)\b", re.I)
UNCERTAIN = re.compile(r"\b(?:estimate|estimated|approximate|uncertain|uncertainty|proxy|assum\w+|range|depends|caveat|roughly)\b", re.I)


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def numbers_in(text: str, percent: bool | None = None) -> list[float]:
    """percent=None: all numbers; True: only numbers followed by %; False: only numbers NOT followed by %."""
    out = []
    text = text or ""
    for m in NUM.finditer(text):
        is_pct = text[m.end():m.end() + 2].lstrip().startswith("%")
        if percent is not None and is_pct != percent:
            continue
        try:
            out.append(float(m.group().replace(",", "").replace("−", "-")))
        except ValueError:
            pass
    return out


def close(a: float, b: float, rel: float) -> bool:
    return abs(a - b) <= max(rel * abs(b), 0.01)


def matches_value(found: list[float], expected: float, rel: float) -> bool:
    # answers often state magnitudes ("reduces by 34.8 kg") for negative deltas
    return any(close(x, expected, rel) or close(abs(x), abs(expected), rel) for x in found)


def asserted(pattern: str, answer: str) -> bool:
    """A prohibited pattern counts only when asserted, not when quoted inside a refusal or negation
    in the same sentence ("I cannot certify this as IPCC-certified")."""
    for m in re.finditer(pattern, answer, re.I):
        start = max(answer.rfind(".", 0, m.start()), answer.rfind("\n", 0, m.start())) + 1
        if not NEGATED.search(answer[start:m.start()]):
            return True
    return False


def okf_concept_ids() -> set[str]:
    bundle = pipeline.REPO / "datasets/v2/okf/bundle/ecomind"
    return {"okf:" + str(p.relative_to(bundle).with_suffix("")).replace("\\", "/") for p in bundle.rglob("*.md")
            if p.name not in ("index.md", "log.md")}


def score_case(case: dict, resp: dict, known_sources: set[str]) -> dict:
    answer = resp.get("answer") or ""
    called = {t.get("name") for t in resp.get("tool_calls") or []}
    cited = set(resp.get("citations") or [])
    found_pct, found_plain = numbers_in(answer, percent=True), numbers_in(answer, percent=False)
    r: dict = {"case_id": case["case_id"], "category": case["category"], "difficulty": case["difficulty"]}

    exp = case["expected_values"]
    r["numeric_total"] = len(exp)
    r["numeric_hits"] = sum(matches_value(found_pct if e["unit"] == "%" else found_plain, e["value"], e["rel_tolerance"]) for e in exp)
    req_tools = set(case["required_tools"])
    r["tools_required"] = len(req_tools)
    r["tools_hit"] = len(req_tools & called)
    req_src = set(case["required_sources"])
    r["sources_required"] = len(req_src)
    r["sources_hit"] = len(req_src & cited)
    r["fabricated_citations"] = sorted(cited - known_sources)
    r["prohibited_hits"] = [p for p in case["prohibited_claims"] if asserted(p, answer)]
    r["missing_phrases"] = [p for p in case["required_phrases"] if p.lower() not in answer.lower()]
    r["missing_phrases"] += [f"concept:{g}" for g in case.get("required_concepts", []) if not re.search(g, answer, re.I)]

    beh = case["expected_behavior"]
    if beh == "refuse":
        r["behavior_ok"] = bool(REFUSAL.search(answer))
    elif beh == "ask_clarification":
        r["behavior_ok"] = "?" in answer
    elif beh == "not_estimated":
        r["behavior_ok"] = "not estimated" in answer.lower()
    elif beh == "answer_with_uncertainty":
        r["behavior_ok"] = bool(UNCERTAIN.search(answer))
    else:
        r["behavior_ok"] = bool(answer.strip())

    grounded_pool = [e["value"] for e in exp]
    for t in resp.get("tool_calls") or []:
        grounded_pool += numbers_in(json.dumps(t.get("output", "")))
    grounded_pool += numbers_in(case["question"])
    claimed = [float(x.replace(",", "").replace("−", "-")) for x in UNIT_NUM.findall(answer)]
    r["ungrounded_numbers"] = [x for x in claimed if not any(close(x, g, 0.02) or close(abs(x), abs(g), 0.02) for g in grounded_pool)]

    r["passed"] = (r["numeric_hits"] == r["numeric_total"] and r["tools_hit"] == r["tools_required"]
                   and r["sources_hit"] == r["sources_required"] and not r["fabricated_citations"]
                   and not r["prohibited_hits"] and not r["missing_phrases"] and r["behavior_ok"])
    # content-only view: ignores tool/citation plumbing, judges what the user would read
    r["content_passed"] = (r["numeric_hits"] == r["numeric_total"] and not r["prohibited_hits"]
                           and not r["missing_phrases"] and r["behavior_ok"])
    r["latency_ms"] = resp.get("latency_ms")
    model = resp.get("model")
    price = PRICE_PER_1M.get(model or "")
    r["cost_usd"] = (resp.get("input_tokens", 0) * price["input"] + resp.get("output_tokens", 0) * price["output"]) / 1e6 if price else None
    return r


def aggregate(results: list[dict]) -> dict:
    def rate(num, den):
        return round(num / den, 4) if den else None

    n = len(results)
    lat = [r["latency_ms"] for r in results if r["latency_ms"] is not None]
    costs = [r["cost_usd"] for r in results if r["cost_usd"] is not None]
    by_cat = defaultdict(lambda: [0, 0])
    for r in results:
        by_cat[r["category"]][0] += r["passed"]
        by_cat[r["category"]][1] += 1
    return {
        "cases": n,
        "pass_rate": rate(sum(r["passed"] for r in results), n),
        "content_pass_rate": rate(sum(r["content_passed"] for r in results), n),
        "numeric_accuracy": rate(sum(r["numeric_hits"] for r in results), sum(r["numeric_total"] for r in results)),
        "tool_use_accuracy": rate(sum(r["tools_hit"] for r in results), sum(r["tools_required"] for r in results)),
        "citation_recall": rate(sum(r["sources_hit"] for r in results), sum(r["sources_required"] for r in results)),
        "cases_with_fabricated_citations": sum(bool(r["fabricated_citations"]) for r in results),
        "cases_with_prohibited_claims": sum(bool(r["prohibited_hits"]) for r in results),
        "behavior_accuracy": rate(sum(r["behavior_ok"] for r in results), n),
        "cases_with_ungrounded_numbers": sum(bool(r["ungrounded_numbers"]) for r in results),
        "latency_ms_p50": statistics.median(lat) if lat else None,
        "latency_ms_p95": sorted(lat)[max(0, int(len(lat) * 0.95) - 1)] if lat else None,
        "cost_usd_total": round(sum(costs), 6) if costs else None,
        "pass_rate_by_category": {k: f"{v[0]}/{v[1]}" for k, v in sorted(by_cat.items())},
    }


def score(responses: list[dict]) -> dict:
    cases = {c["case_id"]: c for c in load_jsonl(CASES)}
    known = set(pipeline.load_manifest()) | okf_concept_ids()
    by_id = {r["case_id"]: r for r in responses}
    results = [score_case(c, by_id.get(cid, {}), known) for cid, c in cases.items()]
    return {"summary": aggregate(results), "missing_responses": sorted(set(cases) - set(by_id)), "cases": results}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("responses", type=Path)
    ap.add_argument("--out", type=Path)
    a = ap.parse_args(argv)
    report = score(load_jsonl(a.responses))
    if a.out:
        a.out.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
