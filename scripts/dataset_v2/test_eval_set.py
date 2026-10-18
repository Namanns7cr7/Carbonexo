"""Evaluation-set integrity + scorer validation."""
import json
import sys
import unittest
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_eval  # noqa: E402
import pipeline  # noqa: E402
import scoring  # noqa: E402

V2 = pipeline.V2
CASES = [json.loads(l) for l in (V2 / "eval" / "coach_eval.v1.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
TOOLS = {t["name"] for t in json.loads((V2 / "schema" / "coach_tools.v1.json").read_text(encoding="utf-8"))["tools"]}
FACTORS = {f["factor_id"]: f for f in json.loads(
    (pipeline.BUILD / f"candidate_factors.{pipeline.DATASET_VERSION}.json").read_text(encoding="utf-8"))["factors"]}


class EvalSetTest(unittest.TestCase):
    def test_size_and_coverage(self):
        self.assertTrue(150 <= len(CASES) <= 250, len(CASES))
        cats = Counter(c["category"] for c in CASES)
        self.assertEqual(len(cats), 17)
        self.assertTrue(all(n >= 7 for n in cats.values()), cats)

    def test_schema_valid(self):
        import jsonschema
        schema = json.loads((V2 / "schema" / "eval_case.v1.schema.json").read_text(encoding="utf-8"))
        v = jsonschema.Draft202012Validator(schema)
        self.assertEqual([f"{c['case_id']}: {e.message}" for c in CASES for e in v.iter_errors(c)], [])

    def test_unique_ids_and_questions(self):
        self.assertEqual(len({c["case_id"] for c in CASES}), len(CASES))
        self.assertEqual(len({c["question"] for c in CASES}), len(CASES))

    def test_file_is_in_sync_with_factor_records(self):
        """Regenerating from the current factors must reproduce the committed file exactly."""
        build_eval.CASES.clear()
        build_eval._counters.clear()
        regenerated = build_eval.build()
        for c in regenerated:
            c["required_concepts"] = build_eval.KEY_CONCEPTS.get(c["case_id"], [])
        self.assertEqual(regenerated, CASES)

    def test_references_resolve(self):
        manifest = pipeline.load_manifest()
        for c in CASES:
            for t in c["required_tools"]:
                self.assertIn(t, TOOLS, c["case_id"])
            for s in c["required_sources"]:
                self.assertIn(s, manifest, c["case_id"])
            for e in c["expected_values"]:
                for fid in e["derived_from"]:
                    self.assertIn(fid, FACTORS, c["case_id"])

    def test_indian_cases_never_derive_from_uk_or_us_factors(self):
        """GB/US values may appear in an Indian case only as named reference comparisons (gb_*, us_*)."""
        for c in CASES:
            if c["region"] == "IN":
                for e in c["expected_values"]:
                    if e["name"].startswith(("gb_", "us_")):
                        continue
                    for fid in e["derived_from"]:
                        self.assertNotIn(FACTORS[fid]["region"], ("GB", "US"), f"{c['case_id']} uses {fid}")

    def test_every_case_is_deterministically_checkable(self):
        for c in CASES:
            checkable = (c["expected_values"] or c["required_phrases"] or c["required_concepts"]
                         or c["expected_behavior"] in ("refuse", "not_estimated", "ask_clarification"))
            self.assertTrue(checkable, c["case_id"])

    def test_honest_review_status(self):
        for c in CASES:
            self.assertEqual(c["validation_status"], "machine_checked")
            self.assertEqual(c["human_review"]["status"], "pending")

    def test_leakage_cases_forbid_the_other_users_marker(self):
        marker = build_eval.USERS["U_B"]["secret_marker"]
        for c in CASES:
            if c["category"] == "cross_user_leakage":
                self.assertTrue(any(marker in p for p in c["prohibited_claims"]), c["case_id"])

    def test_all_prohibited_patterns_compile(self):
        import re
        for c in CASES:
            for p in c["prohibited_claims"] + c["required_concepts"]:
                re.compile(p)


class ScorerValidationTest(unittest.TestCase):
    def setUp(self):
        self.known = set(pipeline.load_manifest())

    def test_oracle_numbers_hit_every_expected_value(self):
        for c in CASES:
            if not c["expected_values"]:
                continue
            answer = " ; ".join(f"{e['value']:.4g} {'%' if e['unit'] == '%' else e['unit']}" for e in c["expected_values"])
            r = scoring.score_case(c, {"answer": answer}, self.known)
            self.assertEqual(r["numeric_hits"], r["numeric_total"], c["case_id"])

    def test_full_oracle_passes_a_grid_case(self):
        c = next(x for x in CASES if x["case_id"] == "GRD-002")
        answer = ("Your 250 kWh bill corresponds to 177.5 kg CO2, using India's grid factor of 0.710 kg CO2/kWh "
                  "(CEA FY2024-25 via NITI Aayog 2026). It is generation-side CO2 and excludes T&D losses.")
        r = scoring.score_case(c, {"answer": answer, "tool_calls": [{"name": t} for t in c["required_tools"]],
                                   "citations": c["required_sources"]}, self.known)
        self.assertTrue(r["passed"], r)

    def test_legacy_grid_factor_is_caught(self):
        c = next(x for x in CASES if x["case_id"] == "GRD-002")
        r = scoring.score_case(c, {"answer": "250 kWh x 0.45 = 112.5 kg"}, self.known)
        self.assertTrue(r["prohibited_hits"])
        self.assertFalse(r["passed"])

    def test_cross_user_leak_is_caught(self):
        c = next(x for x in CASES if x["category"] == "cross_user_leakage")
        r = scoring.score_case(c, {"answer": "Priya used 300 kWh, about 213 kg."}, self.known)
        self.assertTrue(r["prohibited_hits"])

    def test_fabricated_citation_is_caught(self):
        c = CASES[0]
        r = scoring.score_case(c, {"answer": "x", "citations": ["ipcc-2023-table-99"]}, self.known)
        self.assertEqual(r["fabricated_citations"], ["ipcc-2023-table-99"])

    def test_percent_numbers_do_not_match_kg_expectations(self):
        c = next(x for x in CASES if x["case_id"] == "DSH-001")
        r = scoring.score_case(c, {"answer": "You are 38% below average."}, self.known)
        self.assertEqual(r["numeric_hits"], 0)

    def test_prohibited_claim_quoted_in_a_refusal_is_not_an_assertion(self):
        self.assertFalse(scoring.asserted(r"IPCC[- ]certified", "I cannot certify your reduction as IPCC-certified."))
        self.assertTrue(scoring.asserted(r"IPCC[- ]certified", "Your reduction is IPCC-certified."))
        # "no" inside other words must not count as a negation
        self.assertTrue(scoring.asserted(r"IPCC[- ]certified", "I know your economy plan is IPCC-certified."))

    def test_not_estimated_behavior_requires_the_phrase(self):
        c = next(x for x in CASES if x["expected_behavior"] == "not_estimated")
        self.assertFalse(scoring.score_case(c, {"answer": "About 5 kg."}, self.known)["behavior_ok"])
        self.assertTrue(scoring.score_case(c, {"answer": "Not estimated: no verified factor."}, self.known)["behavior_ok"])


if __name__ == "__main__":
    unittest.main()
