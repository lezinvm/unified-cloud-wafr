"""Compliance scoring rules and storage."""
import pytest

import compliance as cp


def _c(cid, verdict, **fw):
    base = {"control_id": cid, "title": cid, "severity": "high", "verdict": verdict,
            "failing_resources": 1 if verdict == "FAIL" else 0,
            "cis_gcp": "", "cis_aws": "", "cis_azure": "", "soc2_ids": "", "iso27001_ids": "", "hipaa_ids": ""}
    base.update(fw)
    return base


@pytest.mark.parametrize("verdicts,expected", [
    (["PASS", "PASS"], "pass"),
    (["PASS", "FAIL"], "fail"),
    (["FAIL", "UNKNOWN"], "fail"),
    (["PASS", "UNKNOWN"], "not_assessed"),       # never counted as passed
    (["PASS", "NOT_IMPLEMENTED"], "not_assessed"),
    (["NOT_APPLICABLE", "NOT_APPLICABLE"], "not_applicable"),
    (["NOT_APPLICABLE", "PASS"], "pass"),
])
def test_requirement_status(verdicts, expected):
    assert cp.requirement_status(verdicts) == expected


def _fw(fid):
    return next(f for f in cp.FRAMEWORKS if f["id"] == fid)


def test_score_and_coverage():
    controls = [
        _c("A", "PASS", soc2_ids="CC6.1"),
        _c("B", "FAIL", soc2_ids="CC6.6"),
        _c("C", "UNKNOWN", soc2_ids="CC7.2"),
        _c("D", "NOT_APPLICABLE", soc2_ids="A1.2"),
        _c("E", "PASS", soc2_ids="CC6.1;CC7.2"),     # one control, two requirements
    ]
    s = cp.score_framework(_fw("soc2"), "gcp", "Google Cloud", controls)
    by_id = {r["id"]: r for r in s["requirements"]}
    assert by_id["CC6.1"]["status"] == "pass" and len(by_id["CC6.1"]["controls"]) == 2
    assert by_id["CC6.6"]["status"] == "fail"
    assert by_id["CC7.2"]["status"] == "not_assessed"
    assert by_id["A1.2"]["status"] == "not_applicable"
    assert (s["passed"], s["failed"], s["not_assessed"], s["not_applicable"]) == (1, 1, 1, 1)
    assert s["score"] == 50          # 1 pass / (1 pass + 1 fail)
    assert s["coverage"] == 67       # 2 decided / 3 applicable
    assert s["control_pass_rate"] == 67  # A, E pass; B fails
    assert s["requirements"][0]["status"] == "fail"  # failures listed first


def test_nothing_decided_gives_no_score():
    s = cp.score_framework(_fw("hipaa"), "gcp", "Google Cloud", [_c("A", "UNKNOWN", hipaa_ids="164.312(b)")])
    assert s["score"] is None and s["coverage"] == 0


def test_iso_2013_ids_converted_to_2022():
    s = cp.score_framework(_fw("iso27001"), "gcp", "Google Cloud",
                           [_c("A", "FAIL", iso27001_ids="A.9.4.2"), _c("B", "PASS", iso27001_ids="A.8.24")])
    by_id = {r["id"]: r for r in s["requirements"]}
    assert "A.9.4.2" not in by_id
    assert by_id["A.8.5"]["converted_from"] == ["A.9.4.2"]
    assert by_id["A.8.24"]["converted_from"] is None


def test_cis_uses_the_providers_column_and_parses_level():
    controls = [_c("A", "FAIL", cis_gcp="3.6 (v3.0 L1)", cis_aws="5.2 (v3.0 L1)")]
    gcp = cp.score_framework(_fw("cis"), "gcp", "Google Cloud", controls)
    aws = cp.score_framework(_fw("cis"), "aws", "AWS", controls)
    assert [r["id"] for r in gcp["requirements"]] == ["3.6"] and gcp["requirements"][0]["level"] == "L1"
    assert [r["id"] for r in aws["requirements"]] == ["5.2"]
    assert gcp["name"] == "CIS Google Cloud Foundations Benchmark" and gcp["version"] == "v3.0"
    assert gcp["mapping_note"]  # CIS numbering is flagged as unvalidated


def test_build_scores_skips_frameworks_with_no_mappings():
    docs = cp.build_scores("gcp", "Google Cloud", "A-1", [_c("A", "PASS", soc2_ids="CC6.1")], "t")
    assert [d["framework_id"] for d in docs] == ["soc2"]
    assert docs[0]["id"] == "CS-A-1-soc2" and docs[0]["assessment_id"] == "A-1"


def test_real_catalog_frameworks_all_present():
    import csv
    from pathlib import Path
    rows = list(csv.DictReader(open(Path(__file__).resolve().parents[1] / "seed_data" / "control_catalog.csv",
                                    encoding="utf-8")))
    controls = [{**r, "verdict": "PASS", "failing_resources": 0, "severity": r["severity"].lower()} for r in rows]
    docs = {d["framework_id"]: d for d in cp.build_scores("gcp", "Google Cloud", "A-1", controls, "t")}
    assert set(docs) == {"cis", "soc2", "iso27001", "hipaa"}
    assert all(d["score"] == 100 for d in docs.values())
    assert not any(r["id"].startswith("A.9.") or r["id"] == "A.6.1.3" for r in docs["iso27001"]["requirements"])
