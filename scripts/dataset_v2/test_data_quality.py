"""Data quality + provenance suite for Dataset V2.

Schema validity is necessary but NOT sufficient: these tests check provenance, regional
applicability (Decision 1), unsupported-factor handling (Decision 3), arithmetic against the
source tables, plausibility ranges and dataset separation.

Run: python -I -m unittest discover -s scripts/dataset_v2 -p "test_*.py"
"""
import csv
import json
import re
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402

V2 = pipeline.V2
BUILD_FILE = pipeline.BUILD / f"candidate_factors.{pipeline.DATASET_VERSION}.json"


def factors():
    return {f["factor_id"]: f for f in json.loads(BUILD_FILE.read_text(encoding="utf-8"))["factors"]}


def read_csv(path):
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


class ProvenanceTest(unittest.TestCase):
    def setUp(self):
        self.f = factors()
        self.m = pipeline.load_manifest()

    def test_candidate_set_is_schema_valid(self):
        self.assertEqual(pipeline.schema_errors(list(self.f.values())), [])

    def test_every_factor_resolves_to_a_manifest_source(self):
        for fid, f in self.f.items():
            self.assertIn(f["source_id"], self.m, fid)
            if f.get("citation_of_record"):
                self.assertIn(f["citation_of_record"], self.m, fid)

    def test_http_sources_are_hash_pinned(self):
        for sid, s in self.m.items():
            if s.get("fetch", {}).get("method") == "http" and s["verification_status"] != "pending_fetch":
                self.assertRegex(s["fetch"].get("sha256") or "", r"^[0-9a-f]{64}$", sid)

    def test_raw_files_match_pinned_hashes_when_present(self):
        for sid, s in self.m.items():
            fetch = s.get("fetch", {})
            path = pipeline.RAW / (fetch.get("filename") or "__none__")
            if fetch.get("method") == "http" and fetch.get("sha256") and path.exists():
                self.assertEqual(pipeline.sha256(path), fetch["sha256"], sid)

    def test_supported_factors_never_come_from_manual_review_sources_without_notes(self):
        for fid, f in self.f.items():
            if f["scientific_status"] == "provisional":
                self.assertEqual(f["verification_status"], "needs_manual_review", fid)

    def test_superseded_records_point_at_existing_successors(self):
        for fid, f in self.f.items():
            if f["source_id"] == "desnz-2025-flat":
                self.assertIn(f["superseded_by"], self.f, fid)


class RegionalApplicabilityTest(unittest.TestCase):
    """Decision 1: never assume UK or US factors apply to India."""

    def setUp(self):
        self.f = factors()

    def test_uk_and_us_records_never_apply_to_india(self):
        for fid, f in self.f.items():
            if f["region"] in ("GB", "US"):
                self.assertNotIn("IN", f["applies_to_regions"] + f["proxy_regions"], fid)

    def test_india_defaults_come_only_from_indian_sources_or_global_targets(self):
        for fid, f in self.f.items():
            if "IN" in f["applies_to_regions"]:
                self.assertTrue(f["region"] == "IN" or f["record_kind"] == "target", fid)

    def test_global_proxies_for_india_carry_uncertainty(self):
        for fid, f in self.f.items():
            if "IN" in f["proxy_regions"]:
                self.assertIn(f["uncertainty"]["level"], ("medium", "high"), fid)
                self.assertTrue(f["uncertainty"]["notes"], fid)

    def test_indian_grid_factor_has_explicit_boundary(self):
        grid = self.f["elec.grid.in.niti_annex_e.fy2024_25"]
        self.assertEqual(grid["gases"], "CO2")
        self.assertIn("excludes T&D", grid["system_boundary"])
        self.assertEqual(grid["applicable_year"], "FY2024-25")


class ArithmeticAgainstSourceTest(unittest.TestCase):
    # Factor column as printed in the NITI PDF text layer, in row order 2013-14..2024-25 once
    # the one-row extraction shift is undone (see SOURCE_MANIFEST niti-2026-power.review).
    PRINTED = [0.774, 0.779, 0.774, 0.770, 0.754, 0.744, 0.713, 0.703, 0.715, 0.716, 0.727, 0.710]

    def test_annex_e_factor_equals_co2_over_generation_every_year(self):
        rows = read_csv(V2 / "reviewed" / "niti_annex_e_rows.csv")
        self.assertEqual(len(rows), len(self.PRINTED))
        for row, printed in zip(rows, self.PRINTED):
            computed = float(row["total_co2_mt"]) / float(row["total_net_generation_bu"])
            self.assertAlmostEqual(round(computed, 3), printed, places=3, msg=row["fiscal_year"])

    def test_annex_e_generation_columns_add_up(self):
        """Unadjusted years: conventional + RE = total. From FY2022-23 the total also includes
        cross-border transfers and captive injection (Annexure E footnote *), so total > sum."""
        for row in read_csv(V2 / "reviewed" / "niti_annex_e_rows.csv"):
            parts = float(row["net_generation_conventional_bu"]) + float(row["re_generation_bu"])
            total = float(row["total_net_generation_bu"])
            if row["adjusted_cross_border_and_captive"] == "true":
                self.assertTrue(0 < total - parts < 0.03 * total, f"{row['fiscal_year']}: adjustment {total - parts:.2f} BU")
            else:
                self.assertAlmostEqual(parts, total, delta=0.02, msg=row["fiscal_year"])

    def test_transcribed_grid_factors_match_annex_rows(self):
        f = factors()
        rows = {r["fiscal_year"]: r for r in read_csv(V2 / "reviewed" / "niti_annex_e_rows.csv")}
        for fy, fid in (("2024-25", "fy2024_25"), ("2023-24", "fy2023_24"), ("2022-23", "fy2022_23")):
            r = rows[fy]
            self.assertAlmostEqual(f[f"elec.grid.in.niti_annex_e.{fid}"]["value"],
                                   round(float(r["total_co2_mt"]) / float(r["total_net_generation_bu"]), 3), places=3)

    def test_cea_and_niti_agree_for_fy2024_25(self):
        f = factors()
        self.assertEqual(f["elec.grid.in.cea_v21.weighted_avg"]["value"], f["elec.grid.in.niti_annex_e.fy2024_25"]["value"])

    def test_lifestyle_target_daily_arithmetic(self):
        self.assertAlmostEqual(factors()["target.lifestyle.2030"]["value"] / 365, 6.849, places=3)


class PlausibilityTest(unittest.TestCase):
    """Catches unit slips (t vs kg, g vs kg, per mile vs per km) in transcription."""
    RANGES = {"kg/kWh": (0.0, 1.2), "kg/vkm": (0.0, 0.5), "kg/pkm": (0.0, 0.5), "kg CO2e/kg product": (0.1, 120.0)}

    def test_values_within_physical_ranges(self):
        for fid, f in factors().items():
            lo_hi = self.RANGES.get(f["unit"])
            if lo_hi:
                self.assertTrue(lo_hi[0] <= f["value"] <= lo_hi[1], f"{fid}={f['value']} {f['unit']}")

    def test_desnz_year_over_year_drift_is_bounded(self):
        f = factors()
        for fid, rec in f.items():
            if fid.endswith(".y2026"):
                prev = f.get(fid.replace(".y2026", ".y2025"))
                if prev and prev["value"] > 0:
                    drift = abs(rec["value"] - prev["value"]) / prev["value"]
                    self.assertLess(drift, 0.5, f"{fid}: {prev['value']} -> {rec['value']}")


class LegacyStatusTest(unittest.TestCase):
    """Decision 3: unsupported legacy numbers never reach production claims or the AI."""

    def setUp(self):
        self.rows = read_csv(V2 / "reviewed" / "legacy_factor_status.csv")
        self.f = factors()

    def test_every_legacy_value_has_a_status_row(self):
        inv = pipeline.parse_legacy(pipeline.REPO)
        keys = {r["legacy_key"] for r in self.rows}
        for table in ("V3__reference_data.sql", "V7__embodied_carbon_factors.sql"):
            for k in inv[table]:
                self.assertIn(k, keys, f"{table}:{k}")

    def test_unsupported_rows_are_hidden_in_production_and_forbidden_to_ai(self):
        for r in self.rows:
            if r["scientific_status"] == "unsupported":
                self.assertEqual(r["production_display"], "not_estimated", r["legacy_key"])
                self.assertEqual(r["ai_use"], "forbidden", r["legacy_key"])
                self.assertEqual(r["demo_display"], "illustrative_with_warning", r["legacy_key"])

    def test_not_estimated_rows_name_the_missing_information(self):
        for r in self.rows:
            if r["production_display"] == "not_estimated" and not r["v2_replacement"]:
                self.assertTrue(r["missing_information"], r["legacy_key"])

    def test_replacement_ids_exist(self):
        for r in self.rows:
            for fid in filter(None, r["v2_replacement"].split(";")):
                if fid.startswith("computed per user"):
                    continue
                self.assertIn(fid, self.f, r["legacy_key"])


class SeparationAndLicensingTest(unittest.TestCase):
    """Source docs, factor tables, eval cases, training/preference data and user memory stay separate."""

    def test_eval_cases_never_appear_in_training_or_preference_data(self):
        cases = [json.loads(l) for l in (V2 / "eval" / "coach_eval.v1.jsonl").read_text(encoding="utf-8").splitlines() if l.strip()]
        ids = {c["case_id"] for c in cases}
        questions = {c["question"].strip().lower() for c in cases}
        for d in ("training", "preference"):
            for p in (V2 / d).rglob("*") if (V2 / d).exists() else []:
                if p.is_file():
                    text = p.read_text(encoding="utf-8", errors="ignore").lower()
                    self.assertFalse(any(i.lower() in text for i in ids), f"eval id leaked into {p}")
                    self.assertFalse(any(q in text for q in questions), f"eval question leaked into {p}")

    def test_no_user_memory_or_real_pii_in_datasets(self):
        email = re.compile(r"[\w.+-]+@[\w-]+\.[\w.]+")
        for p in V2.rglob("*"):
            if p.is_file() and p.suffix in (".json", ".jsonl", ".csv") and "raw" not in p.parts:
                for e in email.findall(p.read_text(encoding="utf-8", errors="ignore")):
                    self.assertTrue(e.endswith("@example.com"), f"{p}: {e}")

    def test_rag_corpus_contains_only_license_verified_documents(self):
        m = pipeline.load_manifest()
        corpus = json.loads((V2 / "rag" / "corpus_manifest.v1.json").read_text(encoding="utf-8"))
        for d in corpus["documents"]:
            if d["include"]:
                lic = m[d["source_id"]]["license"]
                self.assertEqual(lic.get("status"), "verified", d["source_id"])
                self.assertIsNot(lic.get("rag_allowed"), False, d["source_id"])

    def test_every_unverified_license_source_is_excluded_from_corpus(self):
        m = pipeline.load_manifest()
        corpus = json.loads((V2 / "rag" / "corpus_manifest.v1.json").read_text(encoding="utf-8"))
        included = {d["source_id"] for d in corpus["documents"] if d["include"]}
        for sid, s in m.items():
            if s.get("license", {}).get("status") != "verified":
                self.assertNotIn(sid, included, sid)


if __name__ == "__main__":
    unittest.main()
