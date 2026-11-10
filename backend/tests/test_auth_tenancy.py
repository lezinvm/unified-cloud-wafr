"""Authentication, route policy and tenant isolation (AUTH_MODE=keycloak)."""
import re

import pytest

from conftest import CLIENT, A, B, _OTHER_KEY, make_token


# ---- every route is covered by a policy -------------------------------------

def test_every_route_has_a_policy(client):
    import main
    import tenancy
    missing = []
    for route in main.app.routes:
        methods = getattr(route, "methods", None) or set()
        path = getattr(route, "path", "")
        if not path.startswith("/api"):
            continue
        for m in methods - {"HEAD", "OPTIONS"}:
            concrete = re.sub(r"\{[^}]+\}", "x", path)
            rule, _ = tenancy.match_rule(m, concrete)
            if rule is None:
                missing.append(f"{m} {path}")
    assert not missing, f"routes without a policy: {missing}"


def test_unknown_route_is_denied(client):
    assert client.get("/api/not-a-route", headers=A()).status_code == 403


def test_docs_closed(client):
    assert client.get("/docs").status_code in (403, 404)
    assert client.get("/openapi.json").status_code in (403, 404)


# ---- authentication -----------------------------------------------------------

def test_health_is_public(client):
    assert client.get("/api/health").status_code == 200


@pytest.mark.parametrize("headers", [
    {},
    {"Authorization": "Bearer not-a-jwt"},
    {"Authorization": "Basic abc"},
])
def test_missing_or_malformed_token_rejected(client, headers):
    r = client.get("/api/assessments", headers=headers)
    assert r.status_code == 401
    assert "bearer" in r.headers.get("www-authenticate", "").lower()


def test_forged_signature_rejected(client):
    t = make_token(key=_OTHER_KEY)
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_expired_token_rejected(client):
    t = make_token(exp_in=-3600)
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_wrong_issuer_rejected(client):
    t = make_token(iss="https://evil.test/realms/lens-test")
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_token_for_other_client_rejected(client):
    t = make_token(azp="some-other-client")
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_unknown_kid_rejected(client):
    t = make_token(kid="nope")
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_hs256_alg_confusion_rejected(client):
    t = make_token(alg="HS256", key="secret")
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 401


def test_token_without_org_forbidden(client):
    t = make_token(include_org=False)
    assert client.get("/api/assessments", headers={"Authorization": f"Bearer {t}"}).status_code == 403


# ---- tenant isolation ---------------------------------------------------------

def test_list_assessments_only_own_org(client):
    ids = {a["id"] for a in client.get("/api/assessments", headers=A()).json()}
    assert ids == {"A-1"}


def test_query_params_cannot_switch_tenant(client):
    r = client.get("/api/assessments?org_id=org_b&user_id=user-b", headers=A())
    assert {a["id"] for a in r.json()} == {"A-1"}
    r = client.get("/api/cloud-accounts?org_id=org_b", headers=A())
    assert {a["id"] for a in r.json()} == {"proj-a"}


def test_other_org_assessment_detail_is_404(client):
    assert client.get("/api/assessments/B-1", headers=A()).status_code == 404
    assert client.get("/api/assessments/A-1", headers=A()).status_code == 200


@pytest.mark.parametrize("path", ["/api/findings", "/api/resources", "/api/milestones"])
def test_child_collections_scoped_without_filter(client, path):
    rows = client.get(path, headers=A()).json()
    assert rows and all(r["assessment_id"] == "A-1" for r in rows)


@pytest.mark.parametrize("path", ["/api/findings", "/api/resources", "/api/milestones", "/api/scans"])
def test_child_collections_other_assessment_is_404(client, path):
    assert client.get(f"{path}?assessment_id=B-1", headers=A()).status_code == 404


def test_remediations_show_catalog_and_own_only(client):
    ids = {r["id"] for r in client.get("/api/remediations?cloud=gcp", headers=A()).json()}
    assert ids == {"REM-A", "REM-CAT"}


def test_scan_of_other_org_is_404(client):
    assert client.get("/api/scans/S-B", headers=A()).status_code == 404
    r = client.post("/api/scans", headers=A(), json={"assessment_id": "B-1"})
    assert r.status_code == 404


def test_delete_other_org_assessment_blocked(client, mongo):
    assert client.delete("/api/assessments/B-1", headers=A()).status_code == 404
    assert mongo["assessments"].find_one({"id": "B-1"}) is not None


def test_delete_other_org_schedule_blocked(client, mongo):
    assert client.delete("/api/scheduled-assessments/SCH-B", headers=A()).status_code == 404
    assert mongo["scheduled_assessments"].find_one({"id": "SCH-B"}) is not None


def test_write_cannot_overwrite_other_org_record(client, mongo):
    r = client.post("/api/cloud-accounts", headers=A(), json={"id": "proj-b", "cloud": "gcp"})
    assert r.status_code == 409
    assert mongo["cloud_accounts"].find_one({"id": "proj-b"})["org_id"] == "org_b"


def test_write_identity_comes_from_token(client, mongo):
    r = client.post("/api/cloud-accounts", headers=A(),
                    json={"id": "proj-new", "cloud": "gcp", "org_id": "org_b", "user_id": "user-b"})
    assert r.status_code == 200
    doc = mongo["cloud_accounts"].find_one({"id": "proj-new"})
    assert doc["org_id"] == "org_a" and doc["user_id"] == "user-a"


def test_child_write_requires_owned_assessment(client):
    r = client.post("/api/remediations/status", headers=A(),
                    json={"assessment_id": "B-1", "check_id": "NET-01", "status": "fixed"})
    assert r.status_code == 404
    r = client.post("/api/remediations/status", headers=A(), json={"check_id": "NET-01", "status": "fixed"})
    assert r.status_code == 400


def test_nosql_operator_in_assessment_id_rejected(client):
    r = client.post("/api/scans", headers=A(), json={"assessment_id": {"$ne": None}})
    assert r.status_code == 400


def test_other_tenant_is_symmetric(client):
    ids = {a["id"] for a in client.get("/api/assessments", headers=B()).json()}
    assert ids == {"B-1"}


# ---- disabled features and admin ---------------------------------------------

@pytest.mark.parametrize("method,path", [
    ("post", "/api/assessments/A-1/rerun"),
    ("post", "/api/checks/rerun"),
    ("post", "/api/assessments"),
    ("post", "/api/jira-tickets"),
    ("post", "/api/alert-logs"),
    ("post", "/api/auth/register"),
    ("post", "/api/users/sync"),
])
def test_fabricating_or_fake_writes_disabled(client, method, path):
    assert getattr(client, method)(path, headers=A(), json={}).status_code == 403


@pytest.mark.parametrize("path", ["/api/jira-tickets", "/api/alert-logs"])
def test_disabled_reads_return_empty_list(client, path):
    r = client.get(path, headers=A())
    assert r.status_code == 200 and r.json() == []


@pytest.mark.parametrize("method,path", [
    ("post", "/api/users"), ("delete", "/api/users/user-b"),
    ("get", "/api/organizations"), ("post", "/api/integrations"),
    ("post", "/api/remediations"), ("post", "/api/questionnaire-questions"),
])
def test_admin_only_routes(client, method, path):
    kw = {"json": {}} if method == "post" else {}
    assert getattr(client, method)(path, headers=A(), **kw).status_code == 403


def test_admin_cannot_delete_user_of_other_org(client, mongo):
    mongo["users"].insert_one({"id": "victim", "org_id": "org_b", "email": "v@b.com"})
    r = client.delete("/api/users/victim", headers=A(roles=["lens-admin"]))
    assert r.status_code == 404
    assert mongo["users"].find_one({"id": "victim"}) is not None


def test_user_record_created_from_token(client, mongo):
    client.get("/api/assessments", headers=A(sub="fresh-user", email="fresh@example.com"))
    u = mongo["users"].find_one({"id": "fresh-user"})
    assert u and u["org_id"] == "org_a" and u["role"] == "user"


def test_pre_sso_user_record_is_adopted_not_duplicated(client, mongo):
    mongo["users"].insert_one({"id": "usr-legacy", "email": "legacy@example.com", "org_id": "org_a"})
    client.get("/api/assessments", headers=A(sub="kc-legacy", email="legacy@example.com"))
    docs = list(mongo["users"].find({"email": "legacy@example.com"}))
    assert len(docs) == 1 and docs[0]["id"] == "kc-legacy"


def test_cors_preflight_allowed_origin_only(client):
    ok = client.options("/api/assessments", headers={
        "Origin": "http://localhost:8444", "Access-Control-Request-Method": "GET"})
    assert ok.headers.get("access-control-allow-origin") == "http://localhost:8444"
    bad = client.options("/api/assessments", headers={
        "Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
    assert bad.headers.get("access-control-allow-origin") is None


def test_client_id_constant(client):
    assert CLIENT == "lens-test-app"
