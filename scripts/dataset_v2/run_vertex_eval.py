"""
Runs the eval questions directly against a Vertex AI Gemini model, using the SAME prompt the
current Carbonexo coach builds for a fresh user (AIService.chat + coach_system v1), and records
real token usage so cost per message is measured, not estimated.

    python -I scripts/dataset_v2/run_vertex_eval.py MODEL LOCATION OUT.jsonl [--workers 6] [--limit N]

Auth: `gcloud auth print-access-token` (your ADC user or a service account). No API key is used.
Costs real Vertex AI tokens.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

CASES = pipeline.V2 / "eval" / "coach_eval.v1.jsonl"
COACH_SYSTEM = ("You are EcoTrack's friendly, encouraging carbon coach. Be concise, practical, never preachy. "
                "Use the user context when relevant: {context}.")
PRICE = {"gemini-2.5-flash": (0.30, 2.50), "gemini-3-flash-preview": (0.50, 3.00)}  # USD / 1M, aggregator-listed
_tok = {"value": None, "at": 0.0}
_lock = threading.Lock()


def token() -> str:
    with _lock:
        if not _tok["value"] or time.time() - _tok["at"] > 1500:
            gcloud = "gcloud.cmd" if sys.platform == "win32" else "gcloud"
            _tok["value"] = subprocess.run([gcloud, "auth", "print-access-token"], capture_output=True, text=True, check=True).stdout.strip()
            _tok["at"] = time.time()
        return _tok["value"]


def coach_prompt(question: str) -> str:
    # Fresh user: AIService saves the user message first, so recent history == that one message.
    return COACH_SYSTEM.format(context=f"user: {question}\n") + "\n\nUser: " + question


def call(model: str, location: str, prompt: str) -> dict:
    host = "aiplatform.googleapis.com" if location == "global" else f"{location}-aiplatform.googleapis.com"
    url = f"https://{host}/v1/projects/carbonexo/locations/{location}/publishers/google/models/{model}:generateContent"
    body = json.dumps({"contents": [{"role": "user", "parts": [{"text": prompt}]}]}).encode()
    for attempt in range(4):
        req = urllib.request.Request(url, data=body, method="POST",
                                     headers={"Authorization": f"Bearer {token()}", "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 503) and attempt < 3:
                time.sleep(2 ** attempt * 3)
                continue
            raise


def run_case(model: str, location: str, case: dict) -> dict:
    q = case["question"] if not case.get("injected_context") else f"{case['question']}\n\n{case['injected_context']}"
    t0 = time.perf_counter()
    try:
        d = call(model, location, coach_prompt(q))
        latency = (time.perf_counter() - t0) * 1000
        parts = d["candidates"][0].get("content", {}).get("parts", [])
        text = "".join(p.get("text", "") for p in parts if not p.get("thought"))
        u = d.get("usageMetadata", {})
        out_tokens = u.get("candidatesTokenCount", 0) + u.get("thoughtsTokenCount", 0)  # thinking billed as output
        return {"case_id": case["case_id"], "answer": text, "tool_calls": [], "citations": [], "latency_ms": round(latency),
                "model": model, "input_tokens": u.get("promptTokenCount", 0), "output_tokens": out_tokens,
                "thought_tokens": u.get("thoughtsTokenCount", 0)}
    except Exception as e:
        return {"case_id": case["case_id"], "answer": "", "error": repr(e)[:300], "tool_calls": [], "citations": [], "model": model}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("model")
    ap.add_argument("location")
    ap.add_argument("out", type=Path)
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--limit", type=int)
    a = ap.parse_args(argv)
    cases = [json.loads(l) for l in CASES.read_text(encoding="utf-8").splitlines() if l.strip()][: a.limit]
    with ThreadPoolExecutor(a.workers) as ex:
        results = list(ex.map(lambda c: run_case(a.model, a.location, c), cases))
    a.out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in results), encoding="utf-8")
    pin, pout = PRICE.get(a.model, (0, 0))
    tin = sum(r.get("input_tokens", 0) for r in results)
    tout = sum(r.get("output_tokens", 0) for r in results)
    cost = (tin * pin + tout * pout) / 1e6
    print(f"{a.model}@{a.location}: {len(results)} cases, {sum(1 for r in results if r.get('error'))} errors, "
          f"tokens in {tin} out {tout} (thinking {sum(r.get('thought_tokens', 0) for r in results)}), "
          f"cost ${cost:.4f} (${cost / max(1, len(results)):.5f}/message)")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
