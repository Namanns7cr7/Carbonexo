"""
Runs coach-eval.v1 through a LOCAL Carbonexo backend in its current ai.coach.mode, with each case's
synthetic user fixture seeded into the local database first.

    python -I scripts/dataset_v2/run_agentic_eval.py http://localhost:8090 LABEL OUT.jsonl [--container datasetv2-pg] [--workers 4]

Refuses deployed URLs. Each case gets a fresh account (no shared history). Fixture logs are V2-style
(factor_record_id set) except unsupported legacy entries, which keep their legacy key and no factor.
A second real user ("Priya", 300 kWh) exists so cross-user cases have something to leak.
Costs real Vertex AI tokens (measured per case from the response's token counts).
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

CASES = pipeline.V2 / "eval" / "coach_eval.v1.jsonl"
FIXTURES = json.loads((pipeline.V2 / "eval" / "fixtures" / "users.v1.json").read_text(encoding="utf-8"))["users"]
FACTORS = {f["factor_id"]: f for f in json.loads(
    (pipeline.BUILD / f"candidate_factors.{pipeline.DATASET_VERSION}.json").read_text(encoding="utf-8"))["factors"]}
LEGACY_KG = {"chicken_meal": 1.2, "clothing_item": 10.0}
TOOL_NAME = {"getUserActivityHistory": "getActivitySummary", "retrieveScientificKnowledge": "retrieveScientificEvidence",
             "getPersonalizedRecommendations": "getActionRecommendations"}
ACTIVITY_KEY = {"road.in.car.": "car_ride", "road.in.bus.": "bus", "road.in.3w.": "auto_rickshaw", "road.in.2w.": "motorbike"}
TODAY = (datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)).date()   # Asia/Kolkata, as the backend uses


def psql(container: str, sql: str) -> str:
    r = subprocess.run(["docker", "exec", "-i", container, "psql", "-q", "-v", "ON_ERROR_STOP=1", "-U", "ecotrack", "-d", "ecotrack", "-tA"],
                       input=sql, capture_output=True, text=True, encoding="utf-8")
    if r.returncode != 0:
        raise RuntimeError(r.stderr[:500])
    return r.stdout.strip()


def post(url: str, body: dict, token: str | None = None, timeout: int = 180) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 headers={"Content-Type": "application/json", **({"Authorization": f"Bearer {token}"} if token else {})})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def q(s) -> str:
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"


def seed_sql(uid: str, fixture: str | None, case_region: str) -> str:
    fx = FIXTURES.get(fixture) if fixture else None
    if fx is None:
        region = "GB" if case_region == "GB" else ("KE" if case_region == "KE" else "IN")
        prof = {"region": region, "region_confirmed": True, "onboarded": True}
        logs = []
    else:
        prof, logs = fx["profile"], fx["logs"]
    sql = [f"DELETE FROM user_profiles WHERE user_id = {q(uid)};",
           "INSERT INTO user_profiles (user_id, name, region, region_confirmed, region_source, onboarded, travel_mode, daily_distance_km, diet, weekly_goal_pct) "
           f"VALUES ({q(uid)}, 'Eval', {q(prof.get('region', 'IN'))}, {str(bool(prof.get('region_confirmed'))).lower()}, "
           f"{q('user_confirmed' if prof.get('region_confirmed') else 'legacy_default')}, {str(bool(prof.get('onboarded', True))).lower()}, "
           f"{q(prof.get('travel_mode'))}, {prof.get('daily_distance_km') or 'NULL'}, {q(prof.get('diet'))}, {prof.get('weekly_goal_pct') or 'NULL'});"]
    ordered = sorted(logs, key=lambda e: 1 if e.get("attribution_of") else 0)   # meter rows before attributions
    for e in ordered:
        for d in e["day_offsets"]:
            day = (TODAY - timedelta(days=d)).isoformat()
            unit = "kWh" if e["unit"] == "kWh" else ("item" if e["unit"] == "item" else "km")
            if e["factor_id"]:
                f = FACTORS[e["factor_id"]]
                key = e.get("entry_key") or next(v for k, v in ACTIVITY_KEY.items() if e["factor_id"].startswith(k))
                kg = round(e["quantity"] * f["value"], 3)
                attr = (f"(SELECT id FROM activity_logs WHERE user_id = {q(uid)} AND activity_date = {q(day)} "
                        f"AND factor_key = {q(e['attribution_of'])} LIMIT 1)") if e.get("attribution_of") else "NULL"
                sql.append("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date, "
                           "factor_record_id, factor_dataset_version, estimate_status, attribution_of) VALUES "
                           f"({q(uid)}, {q(e['category'])}, {q(key)}, {q(key)}, {e['quantity']}, {q(unit)}, {kg}, {q(day)}, "
                           f"{q(e['factor_id'])}, {q(pipeline.DATASET_VERSION)}, 'estimated', {attr});")
            else:
                key = e["legacy_key"]
                sql.append("INSERT INTO activity_logs (user_id, category, factor_key, label, quantity, unit, co2_kg, activity_date) VALUES "
                           f"({q(uid)}, {q(e['category'])}, {q(key)}, {q(key)}, {e['quantity']}, {q(unit)}, {LEGACY_KG.get(key, 1.0)}, {q(day)});")
    if fx and fx.get("credits_balance", 100) != 100:
        sql.append(f"INSERT INTO credit_ledger (user_id, delta, balance_after, reason, rule_key) VALUES ({q(uid)}, "
                   f"{fx['credits_balance'] - 100}, {fx['credits_balance']}, 'eval fixture', 'action_done');")
    return "\n".join(sql)


def run_case(base: str, container: str, case: dict) -> dict:
    email = f"eval-{case['case_id'].lower()}-{uuid.uuid4().hex[:8]}@example.com"
    try:
        tok = post(f"{base}/api/auth/register", {"email": email, "password": "EvalTest123!", "name": "Eval"})["accessToken"]
        uid = psql(container, f"SELECT id FROM users WHERE email = {q(email)};")
        psql(container, seed_sql(uid, case["user_fixture"], case["region"]))
        question = case["question"] if not case.get("injected_context") else f"{case['question']}\n\n{case['injected_context']}"
        t0 = time.perf_counter()
        res = None
        for attempt in range(3):
            try:
                res = post(f"{base}/api/ai/coach", {"message": question}, tok)
                break
            except urllib.error.HTTPError as e:
                if e.code >= 500 and attempt < 2:
                    time.sleep(3)
                    continue
                raise
        wall = (time.perf_counter() - t0) * 1000
        checks = res.get("checks") or {}
        return {"case_id": case["case_id"], "answer": res.get("result") or "",
                "tool_calls": [{"name": TOOL_NAME.get(t, t)} for t in res.get("toolsUsed") or []],
                "citations": sorted({c.get("source_id") for c in res.get("citations") or [] if c.get("source_id")}),
                "live": res.get("live"), "failure": res.get("failure"), "provider": res.get("provider"),
                "model": res.get("model") or "gemini-2.5-flash", "latency_ms": round(wall),
                "input_tokens": checks.get("input_tokens", 0), "output_tokens": checks.get("output_tokens", 0),
                "numeric_check": checks.get("numeric_check"), "citation_check": checks.get("citation_check")}
    except Exception as e:
        return {"case_id": case["case_id"], "answer": "", "error": repr(e)[:300], "tool_calls": [], "citations": []}


def main(argv: list[str]) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("label")
    ap.add_argument("out", type=Path)
    ap.add_argument("--container", default="datasetv2-pg")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--limit", type=int)
    ap.add_argument("--retry-errors", action="store_true",
                    help="re-run only cases that errored in OUT (connection failures), merging results in place")
    a = ap.parse_args(argv)
    if "run.app" in a.base or "carbonexo-backend" in a.base:
        raise SystemExit("refusing to run against a deployed backend")
    # the other user whose data must never leak (U_B, "Priya")
    if psql(a.container, "SELECT count(*) FROM users WHERE email = 'priya.fixture@example.com';") == "0":
        post(f"{a.base}/api/auth/register", {"email": "priya.fixture@example.com", "password": "EvalTest123!", "name": "Priya"})
        uid = psql(a.container, "SELECT id FROM users WHERE email = 'priya.fixture@example.com';")
        psql(a.container, seed_sql(uid, "U_B", "IN"))
    cases = [json.loads(l) for l in CASES.read_text(encoding="utf-8").splitlines() if l.strip()][: a.limit]
    previous = {}
    if a.retry_errors and a.out.exists():
        previous = {r["case_id"]: r for r in map(json.loads, a.out.read_text(encoding="utf-8").splitlines()) if r}
        cases = [c for c in cases if previous.get(c["case_id"], {}).get("error")]
        print(f"[{a.label}] retrying {len(cases)} errored cases")
    t0 = time.time()
    with ThreadPoolExecutor(a.workers) as ex:
        results = list(ex.map(lambda c: run_case(a.base, a.container, c), cases))
    errs = [r for r in results if r.get("error")]
    if previous:   # merge the retried cases back into the full run, keeping case order
        for r in results:
            previous[r["case_id"]] = r
        results = list(previous.values())
    a.out.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in results), encoding="utf-8")
    tin = sum(r.get("input_tokens") or 0 for r in results)
    tout = sum(r.get("output_tokens") or 0 for r in results)
    print(f"[{a.label}] {len(results)} cases in {time.time() - t0:.0f}s, {len(errs)} errors, "
          f"not-live {sum(1 for r in results if r.get('live') is False)}, tokens in {tin} out {tout}, "
          f"cost ${(tin * 0.30 + tout * 2.50) / 1e6:.4f}")
    for r in errs[:5]:
        print("  error", r["case_id"], r["error"][:160])
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
