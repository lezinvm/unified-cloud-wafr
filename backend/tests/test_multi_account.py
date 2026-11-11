"""Many clouds, many projects/accounts: scan by account, per-scope files, queue,
access check. The cloud fetch is replaced by tests/fake_fetch.py; the check
engine and loader run for real against the test database."""
import asyncio
import dataclasses
import json
import os
import sys
import time
from pathlib import Path

import pytest

from conftest import A, B

HERE = Path(__file__).parent
FAKE = str(HERE / "fake_fetch.py")


def _fake_fetch(scope, out, services=None, *, delay=0.0):
    cmd = [sys.executable, "-c",
           f"import time,runpy,sys; time.sleep({delay}); "
           f"sys.argv={[FAKE, 'projects', scope, str(out), ','.join(services or [])]!r}; "
           f"runpy.run_path({FAKE!r}, run_name='__main__')"]
    return cmd


def _verify(scope):
    # "noaccess" in the scope id simulates a project the scanner can't read.
    return [sys.executable, "-c", f"import sys; sys.exit(1 if 'noaccess' in {scope!r} else 0)"]


@pytest.fixture
def fake_gcp(monkeypatch):
    import scan_providers
    import scan_runner
    gcp = dataclasses.replace(scan_providers.GCP, fetch_cmd=_fake_fetch, verify_cmd=_verify)
    monkeypatch.setitem(scan_providers.PROVIDERS, "gcp", gcp)
    monkeypatch.setattr(scan_runner, "_worker", None)
    return gcp


@pytest.fixture
def adb(mongo):
    from motor.motor_asyncio import AsyncIOMotorClient

    def make():
        return AsyncIOMotorClient(os.environ["MONGO_URI"])[mongo.name]
    return make


def _account(mongo, acct_id, scope, org="org_a", user="user-a", **extra):
    mongo["cloud_accounts"].insert_one({"id": acct_id, "cloud": "gcp", "account_name": f"Name {scope}",
                                        "account_identifier": acct_id, "gcp_project": scope,
                                        "org_id": org, "user_id": user, **extra})


def test_scan_new_accounts_creates_assessments_and_keeps_files_apart(mongo, fake_gcp, adb):
    import scan_runner
    _account(mongo, "cfg-111", "team-open-one")
    _account(mongo, "cfg-222", "team-closed-two")

    async def go():
        db = adb()
        s1 = await scan_runner.start_scan(db, cloud_account_id="cfg-111", background=False, require_enabled=False)
        s2 = await scan_runner.start_scan(db, cloud_account_id="cfg-222", background=False, require_enabled=False)
        return s1, s2

    s1, s2 = asyncio.run(go())
    d1, d2 = (mongo["scans"].find_one({"id": s["id"]}) for s in (s1, s2))
    assert d1["status"] == "done", d1.get("error")
    assert d2["status"] == "done", d2.get("error")

    a1 = mongo["assessments"].find_one({"id": "A-GCP-team-open-one"})
    a2 = mongo["assessments"].find_one({"id": "A-GCP-team-closed-two"})
    # Results attach to the user's own account record, owned by its org.
    assert a1["cloud_account_id"] == "cfg-111" and a2["cloud_account_id"] == "cfg-222"
    assert a1["org_id"] == "org_a" and "placeholder" not in a1
    assert a1["account_name"] == "Name team-open-one"
    # No duplicate account keyed by the project id was created.
    assert mongo["cloud_accounts"].count_documents({"id": {"$in": ["team-open-one", "team-closed-two"]}}) == 0
    # Same control, different result per project.
    assert mongo["checks"].find_one({"assessment_id": a1["id"], "id": "NET-01"})["status"] == "fail"
    assert mongo["checks"].find_one({"assessment_id": a2["id"], "id": "NET-01"})["status"] == "pass"
    # One fetch file per project.
    assert fake_gcp.stored_scopes() == ["team-closed-two", "team-open-one"]
    # Rescanning the account reuses its assessment.
    asyncio.run(scan_runner.start_scan(adb(), cloud_account_id="cfg-111", background=False, require_enabled=False))
    assert mongo["assessments"].count_documents({"cloud_account_id": "cfg-111"}) == 1


def test_same_project_in_two_orgs_stays_separate(mongo, fake_gcp, adb):
    import scan_runner
    _account(mongo, "cfg-a", "shared-project")
    _account(mongo, "cfg-b", "shared-project", org="org_b", user="user-b")

    async def go():
        db = adb()
        for acct in ("cfg-a", "cfg-b"):
            await scan_runner.start_scan(db, cloud_account_id=acct, background=False, require_enabled=False)
    asyncio.run(go())

    a = list(mongo["assessments"].find({"account_identifier": "shared-project"}, {"_id": 0}))
    assert {x["org_id"] for x in a} == {"org_a", "org_b"}
    assert len({x["id"] for x in a}) == 2
    assert mongo["cloud_accounts"].find_one({"id": "cfg-a"})["org_id"] == "org_a"
    assert mongo["cloud_accounts"].find_one({"id": "cfg-b"})["org_id"] == "org_b"


def test_no_access_fails_fast_with_grant_hint(mongo, fake_gcp, adb):
    import scan_runner
    _account(mongo, "cfg-x", "noaccess-proj")
    s = asyncio.run(scan_runner.start_scan(adb(), cloud_account_id="cfg-x", background=False,
                                           require_enabled=False))
    d = mongo["scans"].find_one({"id": s["id"]})
    assert d["status"] == "failed" and d["stages"]["verify"] == "failed"
    assert d["stages"]["fetch"] == "pending"  # never started the slow fetch
    assert "noaccess-proj" in d["access_hint"] and "roles/viewer" in d["access_hint"]
    assert "scanner@test-project.iam.gserviceaccount.com" in d["access_hint"]
    a = mongo["assessments"].find_one({"cloud_account_id": "cfg-x"})
    assert a["status"] == "failed" and a["placeholder"] is True


def test_invalid_stored_scope_creates_nothing(mongo, fake_gcp, adb):
    import scan_runner
    _account(mongo, "cfg-bad", "Not A Project!")
    with pytest.raises(scan_runner.ScanError, match="not a valid"):
        asyncio.run(scan_runner.start_scan(adb(), cloud_account_id="cfg-bad", require_enabled=False))
    assert mongo["assessments"].count_documents({"cloud_account_id": "cfg-bad"}) == 0


def test_scans_queue_instead_of_being_refused(mongo, fake_gcp, adb, monkeypatch):
    import scan_providers
    import scan_runner
    slow = dataclasses.replace(fake_gcp, fetch_cmd=lambda s, o, sv=None: _fake_fetch(s, o, sv, delay=1.5))
    monkeypatch.setitem(scan_providers.PROVIDERS, "gcp", slow)
    _account(mongo, "cfg-q1", "queue-one")
    _account(mongo, "cfg-q2", "queue-two")

    async def go():
        db = adb()
        s1 = await scan_runner.start_scan(db, cloud_account_id="cfg-q1", require_enabled=False)
        s2 = await scan_runner.start_scan(db, cloud_account_id="cfg-q2", require_enabled=False)
        # A second scan of the same assessment is refused while one is waiting.
        with pytest.raises(scan_runner.ScanError, match="already queued or running"):
            await scan_runner.start_scan(db, cloud_account_id="cfg-q2", require_enabled=False)
        deadline = time.time() + 120
        while time.time() < deadline:
            docs = await db["scans"].find({"id": {"$in": [s1["id"], s2["id"]]}}).to_list(5)
            if all(d["status"] in ("done", "failed") for d in docs):
                break
            await asyncio.sleep(0.3)
        return s1, s2

    s1, s2 = asyncio.run(go())
    assert s1["queue_position"] == 0 and s2["queue_position"] == 1
    d1, d2 = (mongo["scans"].find_one({"id": s["id"]}) for s in (s1, s2))
    assert d1["status"] == "done" and d2["status"] == "done", (d1.get("error"), d2.get("error"))
    # One at a time, in order.
    assert d2["started_at"] >= d1["finished_at"]


def test_restart_keeps_queued_and_fails_running(mongo, adb):
    import scan_runner
    mongo["scans"].insert_many([{"id": "S-run", "status": "running", "stage": "fetch",
                                 "stages": {"verify": "done", "fetch": "running"}},
                                {"id": "S-q", "status": "queued"}])
    asyncio.run(scan_runner.mark_interrupted(adb()))
    run = mongo["scans"].find_one({"id": "S-run"})
    assert run["status"] == "failed" and run["stages"]["fetch"] == "failed"
    assert mongo["scans"].find_one({"id": "S-q"})["status"] == "queued"


def test_scope_of_account_per_cloud():
    import scan_providers as sp
    assert sp.get("gcp").account_scope({"id": "cfg-1", "account_identifier": "cfg-1", "gcp_project": "my-proj"}) == "my-proj"
    aws = {"account_identifier": "cfg-9", "role_arn": "arn:aws:iam::123456789012:role/LensReadOnly"}
    assert sp.get("aws").account_scope(aws) == "123456789012"
    assert sp.get("aws").account_scope({"account_identifier": "210987654321"}) == "210987654321"
    sub = "00000000-0000-0000-0000-000000000000"
    assert sp.get("azure").account_scope({"subscription_id": sub}) == sub
    with pytest.raises(ValueError):
        sp.get("gcp").fetch_path("../etc/passwd")


def test_legacy_fetch_file_is_split_per_scope():
    import scan_providers as sp
    gcp = sp.get("gcp")
    gcp.legacy_fetch_file.parent.mkdir(parents=True, exist_ok=True)
    gcp.legacy_fetch_file.write_text(json.dumps({"fetchedAt": "x", "projects": {
        "legacy-one": {"services": {}}, "legacy-two": {"services": {}}, "BAD!": {}}}))
    assert sorted(sp.migrate_legacy_fetch(gcp)) == ["legacy-one", "legacy-two"]
    assert not gcp.legacy_fetch_file.exists()
    one = json.loads(gcp.fetch_path("legacy-one").read_text())
    assert list(one["projects"]) == ["legacy-one"] and one["fetchedAt"] == "x"


# ---- API ----------------------------------------------------------------------

def test_api_scan_needs_exactly_one_target(client):
    assert client.post("/api/scans", json={}, headers=A()).status_code == 400
    r = client.post("/api/scans", json={"assessment_id": "A-1", "cloud_account_id": "proj-a"}, headers=A())
    assert r.status_code == 400


def test_api_scan_of_other_orgs_account_is_hidden(client):
    r = client.post("/api/scans", json={"cloud_account_id": "proj-b"}, headers=A())
    assert r.status_code == 404


def test_api_account_access_info(client, mongo):
    _account(mongo, "cfg-acc", "visible-proj")
    r = client.get("/api/cloud-accounts/cfg-acc/access", headers=A())
    assert r.status_code == 200
    body = r.json()
    assert body["scope"] == "visible-proj" and body["valid_scope"] and body["can_scan"]
    assert "visible-proj" in body["hint"]
    assert client.get("/api/cloud-accounts/cfg-acc/access", headers=B()).status_code == 404


def test_targeted_recheck_keeps_full_fetch_and_uses_own_scope(mongo, fake_gcp, adb, monkeypatch):
    import importlib
    import scan_runner
    import targeted_check_runner
    # The re-check may import the registry as backend.scan_providers; patch both.
    for mod_name in ("scan_providers", "backend.scan_providers"):
        try:
            mod = importlib.import_module(mod_name)
        except ModuleNotFoundError:
            continue
        monkeypatch.setitem(mod.PROVIDERS, "gcp",
                            dataclasses.replace(mod.GCP, fetch_cmd=_fake_fetch, verify_cmd=_verify))
    _account(mongo, "cfg-rc", "recheck-proj")
    asyncio.run(scan_runner.start_scan(adb(), cloud_account_id="cfg-rc", background=False, require_enabled=False))
    stored = fake_gcp.fetch_path("recheck-proj")
    before = stored.read_bytes()

    aid = mongo["assessments"].find_one({"cloud_account_id": "cfg-rc"})["id"]
    out = asyncio.run(targeted_check_runner.rerun_single_check(adb(), aid, "NET-01"))
    assert out["passed"] is False  # fake project still has SSH open
    assert stored.read_bytes() == before  # partial fetch never replaced the full one
    assert not list(scan_runner.RUN_DIR.glob("recheck-*.json"))


def test_targeted_recheck_has_no_project_fallback(mongo, adb):
    import targeted_check_runner
    mongo["assessments"].insert_one({"id": "A-noscope", "cloud": "gcp", "cloud_account_id": "missing",
                                     "org_id": "org_a", "user_id": "user-a"})
    with pytest.raises(ValueError, match="no valid"):
        asyncio.run(targeted_check_runner.rerun_single_check(adb(), "A-noscope", "NET-01"))
