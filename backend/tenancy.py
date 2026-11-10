"""
Authorization and tenant isolation for the API (active when AUTH_MODE=keycloak).

One ASGI middleware enforces, for every request:

1. Route policy (fail closed). Every route has an explicit entry in POLICIES:
     public     no token needed
     user       any authenticated member of an organization
     admin      realm role `lens-admin`
     off        feature disabled: GET returns [] (so the UI still loads),
                other methods return 403
   A request that matches no entry is rejected with 403.

2. Identity from the token only. `org_id` and `user_id` in the query string
   and in JSON bodies are overwritten with the caller's values, so a client
   can never read or write another tenant by changing a parameter.

3. Ownership. Any record referenced by id (path, `assessment_id`,
   `cloud_account_id`, or an upsert `id`) must belong to the caller's org.
   Missing records are allowed through so the route can answer 404.

Collections that hang off an assessment (findings, resources, milestones,
scans, remediation statuses...) have no org field; routes filter them with
`assessment_scope()` / `catalog_or_owned()` from this module.
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from urllib.parse import parse_qsl, urlencode

try:
    from backend.auth import AUTH_ENABLED, AuthError, Principal, verify_token
except ModuleNotFoundError:
    from auth import AUTH_ENABLED, AuthError, Principal, verify_token

PUBLIC, USER, ADMIN, OFF = "public", "user", "admin", "off"


@dataclass(frozen=True)
class Rule:
    method: str
    pattern: re.Pattern
    policy: str
    # Ownership of a path parameter: (collection kind, regex group name)
    path_owner: tuple[str, str] | None = None
    # Upsert body `id` must not belong to another org: collection kind
    body_id_owner: str | None = None
    # Body/query `assessment_id` is required (not just checked when present)
    require_assessment: bool = False


def R(method: str, path: str, policy: str, **kw) -> Rule:
    regex = "^" + re.sub(r"\{(\w+)\}", r"(?P<\1>[^/]+)", path) + "$"
    return Rule(method, re.compile(regex), policy, **kw)


POLICIES: list[Rule] = [
    R("GET", "/api/health", PUBLIC),
    R("GET", "/api/organizations", ADMIN),
    R("GET", "/api/users", USER),
    R("POST", "/api/users/sync", OFF),
    R("POST", "/api/users", ADMIN),
    R("DELETE", "/api/users/{user_id}", ADMIN, path_owner=("user", "user_id")),
    R("POST", "/api/auth/register", OFF),  # self-registration is handled by Keycloak

    R("GET", "/api/cloud-accounts", USER),
    R("POST", "/api/cloud-accounts", USER, body_id_owner="cloud_account"),
    R("DELETE", "/api/cloud-accounts/{account_id}", USER, path_owner=("cloud_account", "account_id")),

    R("GET", "/api/assessments", USER),
    R("GET", "/api/assessments/{assessment_id}", USER, path_owner=("assessment", "assessment_id")),
    R("POST", "/api/assessments", OFF),  # assessments are created by the scanner
    R("DELETE", "/api/assessments/{assessment_id}", USER, path_owner=("assessment", "assessment_id")),
    R("POST", "/api/assessments/{assessment_id}/rerun", OFF),  # fabricated scores
    R("POST", "/api/checks/rerun", OFF),  # marks findings passed without checking

    R("GET", "/api/findings", USER),
    R("POST", "/api/findings", USER, body_id_owner="finding", require_assessment=True),
    R("GET", "/api/resources", USER),
    R("GET", "/api/milestones", USER),
    R("POST", "/api/milestones", USER, body_id_owner="milestone", require_assessment=True),
    R("DELETE", "/api/milestones/{milestone_id}", USER, path_owner=("milestone", "milestone_id")),
    R("GET", "/api/compliance-scores", USER),
    R("GET", "/api/questionnaires", USER),
    R("POST", "/api/questionnaire-responses", USER),

    R("GET", "/api/remediations", USER),
    R("POST", "/api/remediations", ADMIN),
    R("GET", "/api/remediations/status", USER),
    R("POST", "/api/remediations/status", USER, require_assessment=True),

    R("GET", "/api/scans/enabled", USER),
    R("GET", "/api/scans", USER),
    R("POST", "/api/scans", USER, require_assessment=True),
    R("GET", "/api/scans/{scan_id}", USER, path_owner=("scan", "scan_id")),

    R("GET", "/api/scheduled-assessments", USER),
    R("POST", "/api/scheduled-assessments", USER, body_id_owner="schedule"),
    R("DELETE", "/api/scheduled-assessments/{schedule_id}", USER, path_owner=("schedule", "schedule_id")),

    R("GET", "/api/integrations", USER),
    R("POST", "/api/integrations", ADMIN),
    R("GET", "/api/repositories", USER),
    R("POST", "/api/repositories", USER, body_id_owner="repository"),

    # Not real yet (no Jira API calls, alert log is client-written): disabled.
    R("GET", "/api/jira-tickets", OFF),
    R("POST", "/api/jira-tickets", OFF),
    R("GET", "/api/alert-logs", OFF),
    R("POST", "/api/alert-logs", OFF),

    # Reference catalogs: readable by members, writable by admins.
    R("GET", "/api/pillars", USER),
    R("GET", "/api/checks", USER),
    R("GET", "/api/best-practices", USER),
    R("GET", "/api/rules", USER),
    R("GET", "/api/compliance-frameworks", USER),
    R("GET", "/api/questionnaire-questions", USER),
    R("POST", "/api/questionnaire-questions", ADMIN),
]

# kind -> (collection, how ownership is decided)
#   "org"        doc.org_id == caller org
#   "assessment" doc.assessment_id -> assessment.org_id == caller org
OWNERSHIP = {
    "assessment": ("assessments", "org"),
    "cloud_account": ("cloud_accounts", "org"),
    "schedule": ("scheduled_assessments", "org"),
    "repository": ("repositories", "org"),
    "user": ("users", "org"),
    "scan": ("scans", "assessment"),
    "milestone": ("milestones", "assessment"),
    "finding": ("findings", "assessment"),
}


def match_rule(method: str, path: str) -> tuple[Rule | None, dict]:
    for rule in POLICIES:
        if rule.method == method:
            m = rule.pattern.match(path)
            if m:
                return rule, m.groupdict()
    return None, {}


# ---- ownership lookups -----------------------------------------------------

async def assessment_org(db, assessment_id: str) -> str | None:
    doc = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0, "org_id": 1})
    return None if doc is None else (doc.get("org_id") or "")


async def owned(db, kind: str, doc_id: str, org: str) -> bool:
    """True if the record is missing (route answers 404) or belongs to `org`."""
    coll, how = OWNERSHIP[kind]
    doc = await db[coll].find_one({"id": doc_id}, {"_id": 0, "org_id": 1, "assessment_id": 1})
    if doc is None:
        return True
    if how == "org":
        return doc.get("org_id") == org
    aid = doc.get("assessment_id")
    if not aid:
        return False
    return (await assessment_org(db, aid)) in (org, None)


async def org_assessment_ids(db, org: str) -> list[str]:
    return [a["id"] async for a in db["assessments"].find({"org_id": org}, {"_id": 0, "id": 1})]


def principal_of(request) -> Principal | None:
    return getattr(request.state, "principal", None) if AUTH_ENABLED else None


async def assessment_scope(request, db) -> dict:
    """Mongo filter limiting assessment-child docs to the caller's org."""
    p = principal_of(request)
    if p is None:
        return {}
    return {"assessment_id": {"$in": await org_assessment_ids(db, p.org_id)}}


async def catalog_or_owned(request, db) -> dict:
    """Catalog docs (no assessment_id) plus the caller's own assessment docs."""
    p = principal_of(request)
    if p is None:
        return {}
    ids = await org_assessment_ids(db, p.org_id)
    return {"$or": [{"assessment_id": {"$exists": False}}, {"assessment_id": None},
                    {"assessment_id": {"$in": ids}}]}


# ---- middleware ------------------------------------------------------------

def _json(status: int, detail: str):
    return status, json.dumps({"detail": detail}).encode()


class TenancyMiddleware:
    def __init__(self, app, db):
        self.app = app
        self.db = db
        self._seen: dict[str, float] = {}

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or not AUTH_ENABLED:
            return await self.app(scope, receive, send)
        method = scope["method"]
        path = scope["path"]
        if method == "OPTIONS":  # CORS preflight carries no credentials
            return await self.app(scope, receive, send)

        rule, params = match_rule(method, path)
        if rule is None:
            return await self._reply(send, *_json(403, "This endpoint is not available."))
        if rule.policy == PUBLIC:
            return await self.app(scope, receive, send)

        # Authenticate.
        token = ""
        for k, v in scope.get("headers", []):
            if k == b"authorization":
                val = v.decode("latin-1")
                if val.lower().startswith("bearer "):
                    token = val[7:].strip()
                break
        try:
            principal = verify_token(token)
        except AuthError as e:
            headers = [(b"www-authenticate", b'Bearer realm="lens"')] if e.status == 401 else []
            return await self._reply(send, *_json(e.status, str(e)), headers)

        if rule.policy == OFF:
            if method == "GET":
                return await self._reply(send, 200, b"[]")
            return await self._reply(send, *_json(403, "This feature is disabled on this environment."))
        if rule.policy == ADMIN and not principal.is_admin:
            return await self._reply(send, *_json(403, "Administrator role required."))

        org = principal.org_id
        await self._register(principal)

        # Overwrite identity in the query string.
        query = [(k, v) for k, v in parse_qsl(scope.get("query_string", b"").decode(), keep_blank_values=True)
                 if k not in ("org_id", "user_id")]
        query_assessment = next((v for k, v in query if k == "assessment_id"), None)
        query += [("org_id", org), ("user_id", principal.sub)]
        scope = dict(scope)
        scope["query_string"] = urlencode(query).encode()
        scope["state"] = {**(scope.get("state") or {}), "principal": principal}

        # Path ownership.
        if rule.path_owner:
            kind, group = rule.path_owner
            if not await owned(self.db, kind, params[group], org):
                return await self._reply(send, *_json(404, "Not found."))

        # Body: read, check, overwrite identity.
        body_bytes = b""
        more = True
        while more:
            msg = await receive()
            body_bytes += msg.get("body", b"")
            more = msg.get("more_body", False)
        body = None
        if body_bytes:
            try:
                body = json.loads(body_bytes)
            except ValueError:
                return await self._reply(send, *_json(400, "Request body must be JSON."))
        if body is not None and not isinstance(body, dict):
            return await self._reply(send, *_json(400, "Request body must be a JSON object."))

        aid = (body or {}).get("assessment_id") or query_assessment
        if aid is not None:
            if not isinstance(aid, str):
                return await self._reply(send, *_json(400, "assessment_id must be a string."))
            org_of = await assessment_org(self.db, aid)
            if org_of is not None and org_of != org:
                return await self._reply(send, *_json(404, "Assessment not found."))
            if rule.require_assessment and org_of is None:
                return await self._reply(send, *_json(404, "Assessment not found."))
        elif rule.require_assessment:
            return await self._reply(send, *_json(400, "assessment_id is required."))

        if body is not None:
            acct = body.get("cloud_account_id")
            if acct is not None and not await owned(self.db, "cloud_account", str(acct), org):
                return await self._reply(send, *_json(404, "Cloud account not found."))
            if rule.body_id_owner and body.get("id") is not None:
                if not await owned(self.db, rule.body_id_owner, str(body["id"]), org):
                    return await self._reply(send, *_json(409, "That id belongs to another organization."))
            body["org_id"] = org
            body["user_id"] = principal.sub
            body_bytes = json.dumps(body).encode()
            scope["headers"] = [(k, v) for k, v in scope["headers"] if k != b"content-length"] + [
                (b"content-length", str(len(body_bytes)).encode())]

        sent = False

        async def replay():
            nonlocal sent
            if sent:
                return {"type": "http.disconnect"}
            sent = True
            return {"type": "http.request", "body": body_bytes, "more_body": False}

        return await self.app(scope, replay, send)

    async def _register(self, p: Principal) -> None:
        """Keep a users record for the token's identity (refreshed at most every 5 min)."""
        if time.time() - self._seen.get(p.sub, 0) < 300:
            return
        now = datetime.now(timezone.utc).isoformat()
        fields = {"email": p.email, "name": p.name or p.email, "org_id": p.org_id,
                  "role": "admin" if p.is_admin else "user", "status": "Active", "lastActive": now}
        res = await self.db["users"].update_one({"id": p.sub}, {"$set": fields})
        if res.matched_count == 0 and p.email:
            # A record created before SSO (same email, old id): adopt it.
            res = await self.db["users"].update_one({"email": p.email}, {"$set": {**fields, "id": p.sub}})
        if res.matched_count == 0:
            await self.db["users"].insert_one({**fields, "id": p.sub, "createdAt": now})
        self._seen[p.sub] = time.time()

    @staticmethod
    async def _reply(send, status: int, body: bytes, headers=None):
        await send({"type": "http.response.start", "status": status,
                    "headers": [(b"content-type", b"application/json"),
                                (b"content-length", str(len(body)).encode())] + (headers or [])})
        await send({"type": "http.response.body", "body": body})
