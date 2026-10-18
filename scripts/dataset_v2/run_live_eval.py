"""
Runs the eval questions through a RUNNING Carbonexo backend's coach endpoint (POST /api/ai/coach).

    python -I scripts/dataset_v2/run_live_eval.py http://localhost:8090 OUT.jsonl [--workers 6] [--limit N]

Each case gets a freshly registered user (no chat history, no cross-case leakage), so point it at
a LOCAL or STAGING backend only - never production. Costs real Vertex AI tokens.
The current coach exposes no tool calls or structured citations, so those fields are empty.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

CASES = pipeline.V2 / "eval" / "coach_eval.v1.jsonl"


def post(url: str, body: dict, token: str | None = None, timeout: int = 180) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def run_case(base: str, case: dict) -> dict:
    email = f"eval-{case['case_id'].lower()}-{uuid.uuid4().hex[:6]}@example.com"
    try:
        tok = post(f"{base}/api/auth/register", {"email": email, "password": "EvalTest123!", "name": "Eval"})["accessToken"]
        question = case["question"] if not case.get("injected_context") else f"{case['question']}\n\n{case['injected_context']}"
        t0 = time.perf_counter()
        res = post(f"{base}/api/ai/coach", {"message": question}, tok)
        latency = (time.perf_counter() - t0) * 1000
        return {"case_id": case["case_id"], "answer": res.get("result", ""), "tool_calls": [], "citations": [],
                "latency_ms": round(latency), "model": "gemini-2.5-flash"}
    except Exception as e:  # recorded, scored as a failure
        return {"case_id": case["case_id"], "answer": "", "error": repr(e)[:300], "tool_calls": [], "citations": []}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out", type=Path)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int)
    a = ap.parse_args(argv)
    if "run.app" in a.base or "carbonexo-backend" in a.base:
        raise SystemExit("refusing to run against a deployed backend: this registers one user per case")
    cases = [json.loads(l) for l in CASES.read_text(encoding="utf-8").splitlines() if l.strip()][: a.limit]
    with ThreadPoolExecutor(a.workers) as ex:
        results = list(ex.map(lambda c: run_case(a.base, c), cases))
    a.out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in results), encoding="utf-8")
    errs = sum(1 for r in results if r.get("error"))
    print(f"ran {len(results)} cases, {errs} errors -> {a.out}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
