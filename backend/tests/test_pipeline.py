"""Provider-driven pipeline: check engine -> loader, multi-scope isolation."""
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]


def _fetch_for(projects: dict) -> dict:
    """Minimal GCP fetch JSON. projects: {name: open_ssh(bool)}."""
    out = {"fetchedAt": "2026-01-01T00:00:00Z", "projects": {}}
    for name, open_ssh in projects.items():
        out["projects"][name] = {"services": {
            "firewall_rules": {"ok": True, "count": 1, "data": [{
                "name": f"fw-{name}", "direction": "INGRESS", "disabled": False,
                "sourceRanges": ["0.0.0.0/0" if open_ssh else "10.0.0.0/8"],
                "allowed": [{"IPProtocol": "tcp", "ports": ["22"]}],
                "logConfig": {"enable": False}}]},
            "networks_vpc": {"ok": True, "count": 1, "data": [{"name": "custom-vpc", "peerings": []}]},
            "compute_instances": {"ok": True, "count": 1, "data": [{
                "name": f"vm-{name}", "zone": "projects/x/zones/us-central1-a",
                "networkInterfaces": [{"accessConfigs": []}], "serviceAccounts": [], "metadata": {}}]},
        }}
    return out


def _run(args, env):
    r = subprocess.run([sys.executable, *args], cwd=BACKEND, env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + r.stderr
    return r.stdout


@pytest.fixture
def pipeline_env(mongo, tmp_path):
    env = {**os.environ, "DB_NAME": mongo.name}
    for k in ("AUTH_MODE",):
        env.pop(k, None)
    return env


def _load(env, tmp_path, projects, assessment_id=None):
    fetch = tmp_path / "fetch.json"
    fetch.write_text(json.dumps(_fetch_for(projects)))
    result = tmp_path / "result.json"
    _run(["check_engine.py", "--provider", "gcp", "--data", str(fetch), "--out", str(result)], env)
    extra = ["--assessment-id", assessment_id] if assessment_id else []
    return _run(["load_assessment_to_db.py", "--provider", "gcp", "--result", str(result),
                 "--fetch", str(fetch), "--user-id", "user-a", "--org-id", "org_a", *extra], env)


def test_two_projects_same_cloud_do_not_overwrite(mongo, pipeline_env, tmp_path):
    _load(pipeline_env, tmp_path, {"proj-open-1": True})
    _load(pipeline_env, tmp_path, {"proj-closed-2": False})
    a1, a2 = "A-GCP-proj-open-1", "A-GCP-proj-closed-2"
    assert mongo["assessments"].find_one({"id": a1}) and mongo["assessments"].find_one({"id": a2})

    def check(aid, cid):
        return mongo["checks"].find_one({"assessment_id": aid, "id": cid})

    # Same control, different result per project, both kept.
    assert check(a1, "NET-01")["status"] == "fail"
    assert check(a2, "NET-01")["status"] == "pass"
    rem1 = mongo["remediations"].find_one({"assessment_id": a1, "check_id": "NET-01"})
    assert rem1 and rem1["resources"] == ["fw-proj-open-1"]
    assert mongo["remediations"].find_one({"assessment_id": a2, "check_id": "NET-01"}) is None
    # Each project's inventory and best practices stay separate.
    assert {r["name"] for r in mongo["resource_inventory"].find({"assessment_id": a1})} >= {"vm-proj-open-1"}
    assert mongo["best_practices"].count_documents({"assessment_id": a1}) > 0
    assert mongo["best_practices"].count_documents({"assessment_id": a2}) > 0


def test_rescan_replaces_only_that_assessment(mongo, pipeline_env, tmp_path):
    _load(pipeline_env, tmp_path, {"proj-open-1": True})
    _load(pipeline_env, tmp_path, {"proj-closed-2": False})
    # Project 1 gets fixed and re-scanned.
    _load(pipeline_env, tmp_path, {"proj-open-1": False})
    assert mongo["checks"].find_one({"assessment_id": "A-GCP-proj-open-1", "id": "NET-01"})["status"] == "pass"
    assert mongo["remediations"].find_one({"assessment_id": "A-GCP-proj-open-1", "check_id": "NET-01"}) is None
    assert mongo["checks"].count_documents({"assessment_id": "A-GCP-proj-closed-2"}) > 0


def test_compliance_scores_stored_per_assessment(mongo, pipeline_env, tmp_path):
    _load(pipeline_env, tmp_path, {"proj-open-1": True})
    _load(pipeline_env, tmp_path, {"proj-closed-2": False})
    for aid in ("A-GCP-proj-open-1", "A-GCP-proj-closed-2"):
        docs = {d["framework_id"]: d for d in mongo["assessment_compliance_scores"].find({"assessment_id": aid})}
        assert set(docs) == {"cis", "soc2", "iso27001", "hipaa"}
        assert mongo["assessments"].find_one({"id": aid})["compliance_summary"]["soc2"]["total"] > 0
    # NET-01 (SSH open to the internet) is recorded under SOC 2 CC6.6 per project.
    def net01_in_cc66(aid):
        doc = mongo["assessment_compliance_scores"].find_one({"assessment_id": aid, "framework_id": "soc2"})
        req = next(r for r in doc["requirements"] if r["id"] == "CC6.6")
        return req["status"], next(c["verdict"] for c in req["controls"] if c["control_id"] == "NET-01")
    assert net01_in_cc66("A-GCP-proj-open-1") == ("fail", "FAIL")
    assert net01_in_cc66("A-GCP-proj-closed-2")[1] == "PASS"


def test_explicit_assessment_id_is_used(mongo, pipeline_env, tmp_path):
    _load(pipeline_env, tmp_path, {"proj-open-1": True}, assessment_id="A-custom-1")
    assert mongo["assessments"].find_one({"id": "A-custom-1"})["cloud_account_id"] == "proj-open-1"
    assert mongo["findings"].count_documents({"assessment_id": "A-custom-1"}) > 0


def test_invalid_scope_id_rejected(mongo, pipeline_env, tmp_path):
    fetch = tmp_path / "fetch.json"
    fetch.write_text(json.dumps(_fetch_for({"BAD_PROJECT!": True})))
    result = tmp_path / "result.json"
    _run(["check_engine.py", "--provider", "gcp", "--data", str(fetch), "--out", str(result)], pipeline_env)
    r = subprocess.run([sys.executable, "load_assessment_to_db.py", "--provider", "gcp", "--result", str(result),
                        "--fetch", str(fetch), "--user-id", "u", "--org-id", "o"],
                       cwd=BACKEND, env=pipeline_env, capture_output=True, text=True)
    assert r.returncode != 0 and "not a valid" in (r.stdout + r.stderr)


def test_registry_shape():
    import scan_providers as sp
    assert set(sp.PROVIDERS) == {"gcp", "aws", "azure"}
    assert sp.get("gcp").can_scan and not sp.get("aws").can_scan and not sp.get("azure").can_scan
    assert sp.get("gcp").valid_scope("lens-wafr-gcp") and not sp.get("gcp").valid_scope("x")
    assert sp.get("aws").valid_scope("123456789012") and not sp.get("aws").valid_scope("12345")
    assert sp.get("azure").valid_scope("00000000-0000-0000-0000-000000000000")
    with pytest.raises(KeyError):
        sp.get("oracle")


@pytest.mark.parametrize("cloud,scope", [("aws", "123456789012"),
                                         ("azure", "00000000-0000-0000-0000-000000000000")])
def test_scan_refused_for_cloud_without_fetcher(mongo, cloud, scope):
    import scan_runner
    from motor.motor_asyncio import AsyncIOMotorClient
    mongo["assessments"].insert_one({"id": f"A-{cloud}", "cloud": cloud, "cloud_account_id": scope,
                                     "user_id": "u", "org_id": "o"})

    async def go():
        db = AsyncIOMotorClient(os.environ["MONGO_URI"])[mongo.name]
        with pytest.raises(scan_runner.ScanError, match="not available"):
            await scan_runner.start_scan(db, f"A-{cloud}", background=False, require_enabled=False)

    asyncio.run(go())
