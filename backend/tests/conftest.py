"""
Test setup: run the real FastAPI app in AUTH_MODE=keycloak against a throwaway
MongoDB database, with tokens signed by a test RSA key.

Needs a reachable MongoDB (MONGO_URI, default mongodb://localhost:27017).
Tests are skipped if it isn't available.
"""
import os
import sys
import time
import uuid
from pathlib import Path

import pytest

TEST_DB = f"wafr_pytest_{uuid.uuid4().hex[:8]}"
ISSUER = "https://idp.test/realms/lens-test"
CLIENT = "lens-test-app"

# Must be set before the app modules are imported (they read env at import).
os.environ.update({
    "AUTH_MODE": "keycloak",
    "KEYCLOAK_ISSUER": ISSUER,
    "KEYCLOAK_CLIENT_ID": CLIENT,
    "CORS_ORIGINS": "http://localhost:8444",
    "DB_NAME": TEST_DB,
    "MONGO_URI": os.environ.get("MONGO_URI", "mongodb://localhost:27017"),
    "KEYCLOAK_URL": "http://127.0.0.1:1",  # never touch a real Keycloak
})
os.environ.pop("SCAN_ENABLED", None)
os.environ.pop("REAL_DATA_ONLY", None)

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

import jwt  # noqa: E402
from cryptography.hazmat.primitives.asymmetric import rsa  # noqa: E402
from jwt.algorithms import RSAAlgorithm  # noqa: E402
from pymongo import MongoClient  # noqa: E402

_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
_OTHER_KEY = rsa.generate_private_key(public_exponent=65537, key_size=2048)
KID = "test-kid"


def _jwks(_url):
    import json
    jwk = json.loads(RSAAlgorithm.to_jwk(_KEY.public_key()))
    jwk.update({"kid": KID, "use": "sig", "alg": "RS256"})
    return {"keys": [jwk]}


def make_token(*, sub="user-a", org="org_a", email="a@example.com", roles=(), azp=CLIENT,
               iss=ISSUER, exp_in=300, key=None, kid=KID, include_org=True, alg="RS256"):
    now = int(time.time())
    claims = {"sub": sub, "iss": iss, "azp": azp, "typ": "Bearer", "iat": now,
              "exp": now + exp_in, "email": email, "name": sub,
              "realm_access": {"roles": list(roles)}}
    if include_org:
        claims["org_id"] = org
    return jwt.encode(claims, key or _KEY, algorithm=alg, headers={"kid": kid})


@pytest.fixture(scope="session")
def mongo():
    client = MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=2000)
    try:
        client.admin.command("ping")
    except Exception:
        pytest.skip("MongoDB not reachable")
    yield client[TEST_DB]
    client.drop_database(TEST_DB)


@pytest.fixture(scope="session")
def client(mongo):
    import auth
    auth.set_jwks_fetcher(_jwks)
    from fastapi.testclient import TestClient
    import main
    with TestClient(main.app) as c:
        yield c


@pytest.fixture(autouse=True)
def seed(mongo):
    """Two tenants with one assessment each, plus a catalog check."""
    for name in mongo.list_collection_names():
        mongo[name].delete_many({})
    mongo["assessments"].insert_many([
        {"id": "A-1", "org_id": "org_a", "user_id": "user-a", "cloud": "gcp", "cloud_account_id": "proj-a", "score": 20},
        {"id": "B-1", "org_id": "org_b", "user_id": "user-b", "cloud": "gcp", "cloud_account_id": "proj-b", "score": 90},
    ])
    mongo["cloud_accounts"].insert_many([
        {"id": "proj-a", "org_id": "org_a", "user_id": "user-a", "cloud": "gcp"},
        {"id": "proj-b", "org_id": "org_b", "user_id": "user-b", "cloud": "gcp"},
    ])
    mongo["findings"].insert_many([
        {"id": "F-A", "assessment_id": "A-1", "check_id": "NET-01", "status": "fail"},
        {"id": "F-B", "assessment_id": "B-1", "check_id": "NET-01", "status": "fail"},
    ])
    mongo["resource_inventory"].insert_many([
        {"id": "R-A", "assessment_id": "A-1", "name": "vm-a"},
        {"id": "R-B", "assessment_id": "B-1", "name": "vm-b"},
    ])
    mongo["milestones"].insert_many([
        {"id": "M-A", "assessment_id": "A-1"}, {"id": "M-B", "assessment_id": "B-1"},
    ])
    mongo["remediations"].insert_many([
        {"id": "REM-A", "assessment_id": "A-1", "cloud": "gcp", "check_id": "NET-01"},
        {"id": "REM-B", "assessment_id": "B-1", "cloud": "gcp", "check_id": "NET-01"},
        {"id": "REM-CAT", "cloud": "gcp", "check_id": "CAT-1"},
    ])
    mongo["scans"].insert_one({"id": "S-B", "assessment_id": "B-1", "status": "done", "started_at": "x"})
    mongo["scheduled_assessments"].insert_one({"id": "SCH-B", "org_id": "org_b"})
    yield


def auth_header(**kw):
    return {"Authorization": f"Bearer {make_token(**kw)}"}


A = auth_header
B = lambda **kw: auth_header(sub="user-b", org="org_b", email="b@example.com", **kw)  # noqa: E731
