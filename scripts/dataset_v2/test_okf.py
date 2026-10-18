"""OKF v0.2 bundle tests: conformance, reproducibility, policy violations are CAUGHT, attestation."""
import json
import sys as _sys
_sys.dont_write_bytecode = True  # tests import executors from the bundle; keep it free of __pycache__
import shutil
import sys
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import okf_producer  # noqa: E402
import okf_validate  # noqa: E402
import pipeline  # noqa: E402

BUNDLE = pipeline.REPO / "datasets/v2/okf/bundle/ecomind"
RECORD = json.loads((BUNDLE / okf_producer.BUILD_RECORD).read_text(encoding="utf-8"))
NOW = okf_validate.parse_dt(RECORD["run_at"])
REGISTRY = pipeline.BUILD / f"candidate_factors.{pipeline.DATASET_VERSION}.json"
sys.path.insert(0, str(BUNDLE / "references" / "executors"))
sys.path.insert(0, str(BUNDLE / "references" / "attesters"))
import activity_emissions as ae  # noqa: E402
import activity_emissions_attester as aea  # noqa: E402
import carbon_twin as ct  # noqa: E402
import carbon_twin_attester as cta  # noqa: E402


class MutableBundle:
    """Copy of the committed bundle in a temp dir, for negative tests."""

    def __enter__(self):
        self.tmp = Path(tempfile.mkdtemp())
        self.root = self.tmp / "ecomind"
        shutil.copytree(BUNDLE, self.root)
        return self

    def __exit__(self, *exc):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def edit(self, rel: str, fn):
        p = self.root / rel
        fm, body = okf_producer.parse_concept(p.read_text(encoding="utf-8"))
        fm, body = fn(fm, body)
        p.write_text(okf_producer.render(fm, body), encoding="utf-8")

    def report(self, now=NOW):
        return okf_validate.validate(self.root, now)


class ConformanceTest(unittest.TestCase):
    def test_committed_bundle_is_conformant_and_passes_policy(self):
        r = okf_validate.validate(BUNDLE, NOW)
        self.assertTrue(r["okf_conformant"], r["okf_conformance_errors"])
        self.assertEqual(r["okf_spec_warnings"], [])
        self.assertTrue(r["carbonexo_policy_passed"], r["carbonexo_policy"])
        self.assertEqual(r["concepts"], 15)

    def test_root_index_declares_okf_version(self):
        fm, _ = okf_producer.parse_concept((BUNDLE / "index.md").read_text(encoding="utf-8"))
        self.assertEqual(fm, {"okf_version": "0.2"})

    def test_bundle_is_reproducible(self):
        with tempfile.TemporaryDirectory() as d:
            rec = okf_producer.produce(RECORD["run_at"], out_dir=Path(d) / "ecomind")
            self.assertEqual(rec["files"], RECORD["files"])
            self.assertEqual(rec["bundle_digest"], RECORD["bundle_digest"])

    def test_missing_type_breaks_conformance(self):
        with MutableBundle() as b:
            b.edit("regions/in.md", lambda fm, body: ({k: v for k, v in fm.items() if k != "type"}, body))
            self.assertFalse(b.report()["okf_conformant"])

    def test_subdirectory_index_with_frontmatter_breaks_conformance(self):
        with MutableBundle() as b:
            p = b.root / "sources" / "index.md"
            p.write_text("---\ntitle: x\n---\n" + p.read_text(encoding="utf-8"), encoding="utf-8")
            self.assertFalse(b.report()["okf_conformant"])

    def test_unknown_type_and_keys_do_not_break_conformance(self):
        """SPEC 11: consumers MUST NOT reject unknown types or unknown keys."""
        with MutableBundle() as b:
            b.edit("regions/in.md", lambda fm, body: ({**fm, "type": "Totally New Type", "x_future_key": 1}, body))
            self.assertTrue(b.report()["okf_conformant"])

    def test_bare_verified_mapping_is_a_one_element_list(self):
        self.assertEqual(okf_validate.trust_tier({"verified": {"by": "process:x", "at": "2026-01-01T00:00:00Z"}}), "machine-confirmed")
        self.assertEqual(okf_validate.trust_tier({}), "unverified")


class HonestTrustTest(unittest.TestCase):
    def test_no_human_actor_anywhere_in_committed_bundle(self):
        for p in BUNDLE.rglob("*.md"):
            self.assertNotIn("human:", p.read_text(encoding="utf-8").split("\n---", 1)[0], p)

    def test_fabricated_human_review_is_caught(self):
        with MutableBundle() as b:
            b.edit("factors/in/elec-grid-fy2024-25.md",
                   lambda fm, body: ({**fm, "verified": fm["verified"] + [{"by": "human:someone", "at": "2026-10-17T08:00:00Z"}]}, body))
            errs = b.report()["carbonexo_policy"]["errors"]
            self.assertTrue(any("human verification event" in e for e in errs), errs)

    def test_stable_without_human_review_is_caught(self):
        with MutableBundle() as b:
            b.edit("methodology/in-grid-electricity.md", lambda fm, body: ({**fm, "status": "stable"}, body))
            self.assertTrue(any("stable requires a human review" in e for e in b.report()["carbonexo_policy"]["errors"]))

    def test_future_timestamp_is_caught(self):
        with MutableBundle() as b:
            b.edit("accounting/meter-vs-appliance.md",
                   lambda fm, body: ({**fm, "generated": {"by": fm["generated"]["by"], "at": "2099-01-01T00:00:00Z"}}, body))
            self.assertTrue(any("future timestamp" in e for e in b.report()["carbonexo_policy"]["errors"]))

    def test_every_pilot_factor_is_machine_confirmed_against_its_source(self):
        for fid, c in RECORD["source_checks"].items():
            self.assertEqual(c["status"], "passed", fid)

    def test_authored_templates_cannot_smuggle_human_events(self):
        tmpl = okf_producer.OKF / "authored" / "policies" / "verification-policy.md"
        original = tmpl.read_text(encoding="utf-8")
        try:
            tmpl.write_text(original.replace("stale_after:", "verified: { by: human:x, at: 2026-10-17T08:00:00Z }\nstale_after:", 1), encoding="utf-8")
            with tempfile.TemporaryDirectory() as d, self.assertRaises(SystemExit):
                okf_producer.produce(RECORD["run_at"], out_dir=Path(d) / "b")
        finally:
            tmpl.write_text(original, encoding="utf-8")


class ProvenancePolicyTest(unittest.TestCase):
    def test_value_drift_from_registry_is_caught(self):
        with MutableBundle() as b:
            b.edit("factors/in/elec-grid-fy2024-25.md", lambda fm, body: ({**fm, "carbonexo": {**fm["carbonexo"], "value": 0.45}}, body))
            self.assertTrue(any("differs from registry" in e for e in b.report()["carbonexo_policy"]["errors"]))

    def test_uk_factor_as_india_proxy_is_caught(self):
        with MutableBundle() as b:
            b.edit("factors/gb/rail-national-2026.md", lambda fm, body: ({**fm, "carbonexo": {**fm["carbonexo"], "proxy_regions": ["IN"]}}, body))
            self.assertTrue(any("Decision 1" in e for e in b.report()["carbonexo_policy"]["errors"]))

    def test_unsupported_factor_cannot_be_promoted(self):
        with MutableBundle() as b:
            b.edit("factors/legacy/clothing-item.md", lambda fm, body: ({**fm, "status": "draft"}, body))
            self.assertTrue(any("must be status deprecated" in e for e in b.report()["carbonexo_policy"]["errors"]))

    def test_broken_internal_link_is_reported(self):
        with MutableBundle() as b:
            b.edit("regions/in.md", lambda fm, body: (fm, body + "\nSee [nothing](/nowhere/missing.md).\n"))
            r = b.report()
            self.assertTrue(r["okf_conformant"])  # broken links never break OKF conformance (SPEC 6.1)
            self.assertIn("regions/in: /nowhere/missing.md", r["carbonexo_policy"]["broken_links"])

    def test_orphan_footnote_is_a_spec_warning(self):
        with MutableBundle() as b:
            b.edit("regions/in.md", lambda fm, body: (fm, body + "\nClaim.[^ghost]\n\n[^ghost]: nowhere\n"))
            self.assertTrue(any("[^ghost]" in w for w in b.report()["okf_spec_warnings"]))

    def test_staleness_is_detected(self):
        r = okf_validate.validate(BUNDLE, datetime(2027, 1, 1, tzinfo=timezone.utc))
        stale = " ".join(r["carbonexo_policy"]["stale"])
        self.assertIn("factors/in/elec-grid-fy2024-25", stale)
        self.assertIn("methodology/in-grid-electricity", stale)

    def test_user_data_in_bundle_is_caught(self):
        with MutableBundle() as b:
            b.edit("regions/in.md", lambda fm, body: (fm, body + "\nContact priya@example.com\n"))
            self.assertTrue(any("user data" in e for e in b.report()["carbonexo_policy"]["errors"]))


class AttestationTest(unittest.TestCase):
    FID, VER = "elec.grid.in.niti_annex_e.fy2024_25", pipeline.DATASET_VERSION

    def test_honest_run_attests(self):
        receipt = ae.run(REGISTRY, factor_id=self.FID, dataset_version=self.VER, quantity=250)
        self.assertEqual(receipt["result_kg"], 177.5)
        self.assertEqual(aea.attest(REGISTRY, receipt, displayed_kg=177.5)["verdict"], "pass")

    def test_tampered_factor_or_result_or_display_fails(self):
        receipt = ae.run(REGISTRY, factor_id=self.FID, dataset_version=self.VER, quantity=250)
        self.assertEqual(aea.attest(REGISTRY, {**receipt, "factor_value": 0.45})["verdict"], "fail")
        self.assertEqual(aea.attest(REGISTRY, {**receipt, "result_kg": 112.5})["verdict"], "fail")
        self.assertEqual(aea.attest(REGISTRY, receipt, displayed_kg=112.5)["verdict"], "fail")
        self.assertEqual(aea.attest(REGISTRY, {**receipt, "registry_sha256": "0" * 64})["verdict"], "fail")

    def test_occupancy_only_divides_vehicle_factors(self):
        r = ae.run(REGISTRY, factor_id="road.in.car.petrol.hatch_lt1400cc", dataset_version=self.VER, quantity=40, occupancy=4)
        self.assertEqual(r["result_kg"], 1.3)
        with self.assertRaises(ae.ComputationRefused):
            ae.run(REGISTRY, factor_id="road.in.bus.intracity_stu", dataset_version=self.VER, quantity=10, occupancy=4)

    def test_unsupported_factor_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            reg = Path(d) / "reg.json"
            data = json.loads(REGISTRY.read_text(encoding="utf-8"))
            data["factors"] = [dict(data["factors"][0], factor_id="x.unsupported", scientific_status="unsupported")]
            reg.write_text(json.dumps(data), encoding="utf-8")
            with self.assertRaises(ae.ComputationRefused):
                ae.run(reg, factor_id="x.unsupported", dataset_version=self.VER, quantity=1)

    def test_carbon_twin_matches_eval_expectation_and_attests(self):
        r = ct.run(REGISTRY, baseline_factor_id="road.in.car.petrol.hatch_lt1400cc", replacement_factor_id="road.in.bus.intracity_stu",
                   dataset_version=self.VER, quantity=10, frequency="per_day", horizon="MONTH")
        self.assertAlmostEqual(r["delta_kg"], -34.808, places=3)  # eval case TWN-001 expects -34.8077 (rounded legs)
        self.assertEqual(cta.attest(REGISTRY, r, displayed_delta_kg=r["delta_kg"])["verdict"], "pass")
        self.assertEqual(cta.attest(REGISTRY, {**r, "horizon_weeks": 4.0})["verdict"], "fail")
        self.assertEqual(cta.attest(REGISTRY, {**r, "quantity_kind": "logged_estimate"})["verdict"], "fail")


if __name__ == "__main__":
    unittest.main()
