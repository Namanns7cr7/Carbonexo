"""Run: python -I -m unittest discover -s scripts/dataset_v2 -p "test_*.py" """
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import pipeline  # noqa: E402


def good_factor(**overrides):
    f = {k: "x" for k in pipeline.REQUIRED_FIELDS}
    f.update(factor_id="t.one", value=0.5, unit="kg/kWh", verification_status="verified_primary",
             source_url="https://example.com/s", record_kind="emission_factor", applies_to_regions=["IN"],
             proxy_regions=[], license_status="verified", scientific_status="supported",
             uncertainty={"level": "low", "notes": None}, dataset_version="2.0.0-candidate.2")
    f.update(overrides)
    return f


class LegacyInventoryTest(unittest.TestCase):
    def setUp(self):
        self.inv = pipeline.parse_legacy(pipeline.REPO)

    def test_parses_every_legacy_copy(self):
        self.assertEqual(len(self.inv["V3__reference_data.sql"]), 25)
        self.assertEqual(len(self.inv["lib/carbon.ts"]), 25)
        self.assertEqual(len(self.inv["lib/api/dashboard.ts"]), 25)
        self.assertEqual(len(self.inv["V7__embodied_carbon_factors.sql"]), 16)
        self.assertEqual(len(self.inv["Carbonexo_Dataset_Export.md"]), 25)
        self.assertEqual(set(self.inv["Carbonexo_Dataset_Export.md"]), set(self.inv["V3__reference_data.sql"]))

    def test_flags_shopping_vs_embodied_conflicts(self):
        issues = "\n".join(pipeline.compare_legacy(self.inv))
        self.assertIn("clothing_item (shopping, 10.0) vs embodied clothing (22.0)", issues)
        self.assertIn("electronics (shopping, 30.0) vs embodied electronics (85.0)", issues)

    def test_detects_a_drifted_copy(self):
        self.inv["lib/carbon.ts"]["car_ride"]["value"] = 0.2
        self.assertTrue(any(i.startswith("car_ride: copies disagree") for i in pipeline.compare_legacy(self.inv)))


class ValidateTest(unittest.TestCase):
    def test_accepts_complete_factor(self):
        self.assertEqual(pipeline.validate([good_factor()]), 0)

    def test_rejects_missing_source_url(self):
        self.assertEqual(pipeline.validate([good_factor(source_url=None)]), 1)

    def test_rejects_unknown_status_and_unitless_value(self):
        self.assertEqual(pipeline.validate([good_factor(verification_status="looks_fine")]), 1)
        self.assertEqual(pipeline.validate([good_factor(unit="item")]), 1)

    def test_rejects_duplicate_ids(self):
        self.assertEqual(pipeline.validate([good_factor(), good_factor()]), 1)


if __name__ == "__main__":
    unittest.main()
