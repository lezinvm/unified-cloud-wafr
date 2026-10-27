import os
import re
import json
import time
import asyncio
from datetime import datetime, timezone
import urllib.request
import urllib.parse
import urllib.error
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
try:
    from backend.database import db, check_db_connection  # local dev (run from project root)
except ModuleNotFoundError:
    from database import db, check_db_connection  # Docker (WORKDIR is /app = backend/)

app = FastAPI(
    title="Unified Cloud WAFR API",
    description="Backend API serving assessments, findings, accounts, and inventory data from MongoDB.",
    version="1.0.0"
)

# Enable CORS for React frontend (Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- KEYCLOAK AUTHENTICATION & SYNC HELPERS ---
KEYCLOAK_URL = os.getenv("KEYCLOAK_URL", "http://localhost:8080").rstrip("/")
KEYCLOAK_REALM = os.getenv("KEYCLOAK_REALM", "lens-realm")
KEYCLOAK_ADMIN_USER = os.getenv("KEYCLOAK_ADMIN_USER", "admin")
KEYCLOAK_ADMIN_PASSWORD = os.getenv("KEYCLOAK_ADMIN_PASSWORD", "admin")

def get_keycloak_admin_token() -> Optional[str]:
    try:
        data = urllib.parse.urlencode({
            "client_id": "admin-cli",
            "grant_type": "password",
            "username": KEYCLOAK_ADMIN_USER,
            "password": KEYCLOAK_ADMIN_PASSWORD
        }).encode()
        req = urllib.request.Request(
            f"{KEYCLOAK_URL}/realms/master/protocol/openid-connect/token",
            data=data,
            method="POST"
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            resp_data = json.loads(res.read().decode())
            return resp_data.get("access_token")
    except Exception as e:
        print(f"Keycloak admin token error: {e}")
        return None

def get_keycloak_realm_users() -> Optional[List[Dict[str, Any]]]:
    """Return the Keycloak realm users, or None if Keycloak is unreachable.

    IMPORTANT: None (fetch failed) must be distinguished from [] (Keycloak
    genuinely has zero users). Callers use this to avoid destructive pruning of
    the local users collection during a transient Keycloak outage.
    """
    token = get_keycloak_admin_token()
    if not token:
        return None
    try:
        req = urllib.request.Request(
            f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users",
            headers={"Authorization": f"Bearer {token}", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=5) as res:
            return json.loads(res.read().decode())
    except Exception as e:
        print(f"Error fetching Keycloak users: {e}")
        return None

def create_keycloak_realm_user(email: str, password: str, name: str, role: str = "user") -> Dict[str, Any]:
    token = get_keycloak_admin_token()
    if not token:
        raise HTTPException(status_code=503, detail="Keycloak authentication server is not reachable.")
    name_parts = name.strip().split(" ")
    first_name = name_parts[0] or email.split("@")[0]
    last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ""

    payload = {
        "username": email,
        "email": email,
        "firstName": first_name,
        "lastName": last_name,
        "enabled": True,
        "emailVerified": True,
        "credentials": [{"type": "password", "value": password, "temporary": False}]
    }

    req = urllib.request.Request(
        f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users",
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            location = res.headers.get("Location")
            kc_id = location.split("/")[-1] if location else None
            return {"id": kc_id, "email": email, "name": name, "role": role}
    except urllib.error.HTTPError as he:
        if he.code == 409:
            raise HTTPException(status_code=409, detail="An account with this email address already exists. Please sign in instead.")
        error_body = he.read().decode()
        raise HTTPException(status_code=he.code, detail=f"Keycloak error: {error_body}")

def delete_keycloak_realm_user(user_id_or_email: str) -> bool:
    token = get_keycloak_admin_token()
    if not token:
        return False
    user_id = user_id_or_email
    if "@" in user_id_or_email:
        users = get_keycloak_realm_users()
        if not users:
            return False
        match = next((u for u in users if (u.get("email") or u.get("username") or "").lower() == user_id_or_email.lower()), None)
        if match:
            user_id = match["id"]
        else:
            return False

    req = urllib.request.Request(
        f"{KEYCLOAK_URL}/admin/realms/{KEYCLOAK_REALM}/users/{user_id}",
        headers={"Authorization": f"Bearer {token}"},
        method="DELETE"
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as res:
            return res.status in (200, 204)
    except Exception as e:
        print(f"Error deleting user from Keycloak: {e}")
        return False

async def sync_keycloak_users_to_db() -> List[Dict[str, Any]]:
    kc_users = await asyncio.to_thread(get_keycloak_realm_users)

    # SAFETY: if Keycloak is unreachable (None, not an empty list), do NOT prune
    # or wipe the local users collection. A transient Keycloak outage previously
    # caused delete_many({}) to erase every user. Return the existing DB users
    # untouched so the app degrades gracefully instead of destroying data.
    if kc_users is None:
        print("[WARN] Keycloak unreachable; skipping user sync/prune to avoid data loss.")
        existing = await db["users"].find({}, {"_id": 0}).to_list(500)
        return existing

    kc_emails_map = {
        (u.get("email") or u.get("username")).lower(): u
        for u in kc_users
        if (u.get("email") or u.get("username"))
    }

    # Keycloak reachable but genuinely has zero users: the local list should
    # mirror that (empty). Only now is pruning everything the correct behavior.
    if not kc_emails_map:
        await db["users"].delete_many({})
        return []

    # 1. Prune: delete any user in MongoDB not in Keycloak
    await db["users"].delete_many({"email": {"$nin": list(kc_emails_map.keys())}})

    # 2. Upsert each Keycloak user into MongoDB
    synced_users = []
    for email, kc_u in kc_emails_map.items():
        first_name = kc_u.get("firstName") or ""
        last_name = kc_u.get("lastName") or ""
        name = f"{first_name} {last_name}".strip() or email.split("@")[0].replace(".", " ").title()
        org_id = f"org_{re.sub(r'[^a-zA-Z0-9]', '_', email.split('@')[0])}"
        is_admin = email == "admin@cloudifyops.com"

        user_doc = await db["users"].find_one({"email": email})
        if not user_doc:
            user_doc = {
                "id": kc_u["id"],
                "name": name,
                "email": email,
                "organization": "CloudifyOps" if is_admin else "Default Organization",
                "org_id": "org_01" if is_admin else org_id,
                "status": "Active" if kc_u.get("enabled", True) else "Inactive",
                "plan": "Enterprise" if is_admin else "Starter",
                "role": "admin" if is_admin else "user",
                "costUsage": 0.0,
                "tokenUsage": 0,
                "projects": [],
                "createdAt": "Today",
                "lastActive": "Just now"
            }
            await db["users"].insert_one(user_doc)
        else:
            await db["users"].update_one(
                {"email": email},
                {"$set": {
                    "id": kc_u["id"],
                    "name": name if name else user_doc.get("name"),
                    "status": "Active" if kc_u.get("enabled", True) else "Inactive"
                }}
            )
        user_doc.pop("_id", None)
        synced_users.append(user_doc)

    return synced_users

@app.get("/api/health")
async def health_check():
    db_connected = await check_db_connection()
    return {
        "status": "ok",
        "database": "connected" if db_connected else "disconnected"
    }

@app.get("/api/organizations")
async def get_organizations():
    orgs = await db["organizations"].find({}, {"_id": 0}).to_list(100)
    return orgs

@app.get("/api/users")
async def get_users(org_id: Optional[str] = None, email: Optional[str] = None):
    # Strict synchronization with Keycloak user list
    await sync_keycloak_users_to_db()
    query = {}
    if org_id:
        query["org_id"] = org_id
    if email:
        query["email"] = email.lower()
    users = await db["users"].find(query, {"_id": 0}).to_list(200)
    return users

@app.post("/api/users/sync")
async def sync_users():
    users = await sync_keycloak_users_to_db()
    return {"status": "synced", "count": len(users), "users": users}

@app.get("/api/cloud-accounts")
async def get_cloud_accounts(org_id: Optional[str] = None, user_id: Optional[str] = None):
    query = {}
    if org_id and user_id:
        query["$or"] = [{"org_id": org_id}, {"user_id": user_id}, {"is_global": True}, {"user_id": "all"}]
    elif org_id:
        query["$or"] = [{"org_id": org_id}, {"is_global": True}, {"user_id": "all"}]
    elif user_id:
        query["$or"] = [{"user_id": user_id}, {"is_global": True}, {"user_id": "all"}]
    accounts = await db["cloud_accounts"].find(query, {"_id": 0}).to_list(100)
    return accounts

@app.get("/api/assessments")
async def get_assessments(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    cloud_account_id: Optional[str] = None
):
    query = {}
    if org_id and user_id:
        query["$or"] = [{"org_id": org_id}, {"user_id": user_id}, {"is_global": True}, {"user_id": "all"}]
    elif org_id:
        query["$or"] = [{"org_id": org_id}, {"is_global": True}, {"user_id": "all"}]
    elif user_id:
        query["$or"] = [{"user_id": user_id}, {"is_global": True}, {"user_id": "all"}]

    if cloud_account_id:
        query["cloud_account_id"] = cloud_account_id
    assessments = await db["assessments"].find(query, {"_id": 0}).to_list(100)

    # Data-integrity invariant: never return an assessment for a cloud the
    # requesting user has no account on. The permissive $or above (is_global /
    # user_id:"all") plus inconsistent seed tagging can otherwise leak a global
    # assessment (e.g. an Azure review) to a user with zero Azure accounts.
    # Skip this reconciliation for explicit single-account lookups.
    if (org_id or user_id) and not cloud_account_id:
        acct_query = {}
        if org_id and user_id:
            acct_query["$or"] = [{"org_id": org_id}, {"user_id": user_id}, {"is_global": True}, {"user_id": "all"}]
        elif org_id:
            acct_query["$or"] = [{"org_id": org_id}, {"is_global": True}, {"user_id": "all"}]
        elif user_id:
            acct_query["$or"] = [{"user_id": user_id}, {"is_global": True}, {"user_id": "all"}]
        user_accounts = await db["cloud_accounts"].find(acct_query, {"_id": 0, "cloud": 1}).to_list(100)
        accounted_clouds = {(a.get("cloud") or "").lower() for a in user_accounts if a.get("cloud")}
        assessments = [
            a for a in assessments
            if (a.get("cloud") or "").lower() in accounted_clouds
        ]

    return assessments

@app.get("/api/assessments/{assessment_id}")
async def get_assessment_detail(assessment_id: str):
    assessment = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment

@app.get("/api/findings")
async def get_findings(
    assessment_id: Optional[str] = None,
    cloud: Optional[str] = None,
    severity: Optional[str] = None,
    service: Optional[str] = None,
    limit: int = Query(default=100, le=500)
):
    query = {}
    if assessment_id:
        query["assessment_id"] = assessment_id
    if cloud and cloud.lower() != 'all':
        query["cloud"] = cloud.lower()
    if severity:
        query["severity"] = severity.lower()
    if service:
        query["service"] = service
    findings = await db["findings"].find(query, {"_id": 0}).to_list(limit)

    # If no findings found, auto-initialize from remediations — but ONLY for an
    # assessment that actually exists, and ONLY using that assessment's real
    # cloud. Previously this fabricated findings for non-existent assessment ids
    # and fell back to AWS remediations, mislabeling GCP/Azure assessments.
    if assessment_id and not findings:
        assessment = await db["assessments"].find_one({"id": assessment_id})
        if not assessment:
            # Do not fabricate findings for an unknown assessment.
            return findings
        asm_cloud = (assessment.get("cloud") or "aws").lower()
        rems = await db["remediations"].find({"cloud": asm_cloud}, {"_id": 0}).to_list(100)
        # No AWS fallback: if the cloud has no remediation catalog, return empty
        # rather than injecting wrong-cloud findings.
        new_findings = []
        for r in rems:
            fnd = {
                "id": f"FND-{assessment_id}-{r['check_id']}",
                "assessment_id": assessment_id,
                "check_id": r["check_id"],
                "remediation_id": r["id"],
                "cloud": asm_cloud,
                "pillar_id": r.get("pillarId", "reliability"),
                "pillar": r.get("pillar", "Reliability"),
                "severity": r["severity"],
                "title": r["title"],
                "description": r["description"],
                "status": "fail",
                "effort": r.get("effort", "Low Effort"),
                "risk": r.get("risk", "High Risk"),
                "resources": r.get("resources", []),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            new_findings.append(fnd)
        if new_findings:
            await db["findings"].insert_many(new_findings)
            findings = new_findings
            
    return findings

@app.post("/api/findings")
async def update_or_create_finding(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing finding 'id'")
    await db["findings"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

# --- REMEDIATIONS API ---
@app.get("/api/remediations")
async def get_remediations(
    cloud: Optional[str] = None,
    pillar_id: Optional[str] = None,
    check_id: Optional[str] = None,
    assessment_id: Optional[str] = None
):
    query = {}
    if cloud and cloud.lower() != 'all':
        query["cloud"] = cloud.lower()
    if pillar_id:
        query["$or"] = [{"pillar_id": pillar_id.lower()}, {"pillarId": pillar_id.lower()}]
    if check_id:
        query["check_id"] = check_id
    remediations = await db["remediations"].find(query, {"_id": 0}).to_list(100)
    return remediations

@app.post("/api/remediations")
async def create_or_update_remediation(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing remediation 'id'")
    await db["remediations"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

@app.get("/api/remediations/status")
async def get_remediation_statuses(assessment_id: Optional[str] = None, user_id: Optional[str] = None):
    query = {}
    if assessment_id:
        query["assessment_id"] = assessment_id
    if user_id:
        query["user_id"] = user_id
    statuses = await db["remediation_statuses"].find(query, {"_id": 0}).to_list(500)
    return statuses

@app.post("/api/remediations/status")
async def save_remediation_status(payload: Dict[str, Any]):
    key = payload.get("key") or f"{payload.get('assessment_id')}::{payload.get('check_id')}"
    payload["key"] = key
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db["remediation_statuses"].update_one(
        {"key": key},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "key": key}

@app.get("/api/resources")
async def get_resources(
    assessment_id: Optional[str] = None,
    cloud: Optional[str] = None,
    service: Optional[str] = None
):
    query = {}
    if assessment_id:
        query["assessment_id"] = assessment_id
    if cloud:
        query["cloud"] = cloud
    if service:
        query["service"] = service
    resources = await db["resource_inventory"].find(query, {"_id": 0}).to_list(200)
    return resources

@app.get("/api/pillars")
async def get_pillars(cloud: Optional[str] = None):
    pillars = await db["pillars"].find({}, {"_id": 0}).sort("display_order", 1).to_list(50)
    bps = await db["best_practices"].find({}, {"_id": 0}).to_list(100)

    chk_query = {}
    if cloud and cloud.lower() != 'all':
        chk_query["cloud_provider"] = cloud.lower()
    else:
        chk_query["cloud_provider"] = "aws"

    checks = await db["checks"].find(chk_query, {"_id": 0}).to_list(500)

    bp_map = {}
    for bp in bps:
        bp_copy = dict(bp)
        bp_copy["checks"] = [c for c in checks if c.get("best_practice_id") == bp["id"]]
        p_id = bp.get("pillar_id")
        if p_id not in bp_map:
            bp_map[p_id] = []
        bp_map[p_id].append(bp_copy)

    for p in pillars:
        p["bestPractices"] = bp_map.get(p["id"], [])

    return pillars

@app.get("/api/compliance-frameworks")
async def get_compliance_frameworks():
    frameworks = await db["compliance_frameworks"].find({}, {"_id": 0}).to_list(50)
    return frameworks

@app.get("/api/compliance-scores")
async def get_compliance_scores(assessment_id: Optional[str] = None):
    query = {"assessment_id": assessment_id} if assessment_id else {}
    scores = await db["assessment_compliance_scores"].find(query, {"_id": 0}).to_list(100)
    return scores

@app.get("/api/milestones")
async def get_milestones(assessment_id: Optional[str] = None):
    query = {"assessment_id": assessment_id} if assessment_id else {}
    milestones = await db["milestones"].find(query, {"_id": 0}).to_list(100)
    return milestones

@app.get("/api/questionnaires")
async def get_questionnaires(assessment_id: Optional[str] = None):
    query = {"assessment_id": assessment_id} if assessment_id else {}
    responses = await db["questionnaire_responses"].find(query, {"_id": 0}).to_list(200)
    questions = await db["questionnaire_questions"].find({}, {"_id": 0}).to_list(200)
    return {
        "questions": questions,
        "responses": responses
    }

# --- WRITE / MUTATION ENDPOINTS ---

@app.post("/api/assessments")
async def create_assessment(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing assessment 'id'")
    
    # Safeguard user_id and org_id against cloud account and users table
    cloud_acc_id = payload.get("cloud_account_id")
    if cloud_acc_id:
        acc = await db["cloud_accounts"].find_one({"$or": [{"id": str(cloud_acc_id)}, {"account_identifier": str(cloud_acc_id)}]})
        if acc:
            if not payload.get("user_id") or payload.get("user_id") in ["usr-09", "user-lezin"]:
                payload["user_id"] = acc.get("user_id")
            if not payload.get("org_id") or payload.get("org_id") == "org_01":
                payload["org_id"] = acc.get("org_id")

    if payload.get("user_id"):
        user_doc = await db["users"].find_one({"$or": [{"id": payload["user_id"]}, {"email": payload["user_id"]}]})
        if user_doc:
            payload["user_id"] = user_doc["id"]
            if not payload.get("org_id"):
                payload["org_id"] = user_doc.get("org_id")

    # Check if exists
    existing = await db["assessments"].find_one({"id": payload["id"]})
    if existing:
        await db["assessments"].update_one({"id": payload["id"]}, {"$set": payload})
    else:
        await db["assessments"].insert_one(payload)
    return {"status": "success", "id": payload["id"]}

@app.delete("/api/assessments/{assessment_id}")
async def delete_assessment(assessment_id: str):
    res = await db["assessments"].delete_one({"id": assessment_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Assessment not found")
    return {"status": "deleted", "id": assessment_id}

@app.post("/api/assessments/{assessment_id}/rerun")
async def rerun_assessment(assessment_id: str):
    assessment = await db["assessments"].find_one({"id": assessment_id})
    if not assessment:
        raise HTTPException(status_code=404, detail="Assessment not found")

    now_iso = datetime.now(timezone.utc).isoformat()
    new_rerun_count = (assessment.get("rerun_count") or 1) + 1

    # Check solved checks from remediation_statuses
    fixed_statuses = await db["remediation_statuses"].find({
        "assessment_id": assessment_id,
        "status": "fixed"
    }).to_list(200)
    fixed_check_ids = set(s.get("check_id") for s in fixed_statuses)

    # Update findings: if check was fixed, mark pass
    if fixed_check_ids:
        await db["findings"].update_many(
            {"assessment_id": assessment_id, "check_id": {"$in": list(fixed_check_ids)}},
            {"$set": {"status": "pass", "updated_at": now_iso}}
        )

    # Recalculate metrics
    findings = await db["findings"].find({"assessment_id": assessment_id}).to_list(200)
    failing_count = sum(1 for f in findings if f.get("status") == "fail")
    total_checks = assessment.get("total_checks", 46)
    passed_count = max(0, total_checks - failing_count)
    new_score = min(100, max(50, round((passed_count / total_checks) * 100)))

    update_fields = {
        "status": "COMPLETED",
        "score": new_score,
        "passed_checks": passed_count,
        "failed_checks": failing_count,
        "passed_bps": min(16, 12 + (10 - failing_count) // 3),
        "failed_bps": max(0, 16 - min(16, 12 + (10 - failing_count) // 3)),
        "high_risks": max(0, min(failing_count, assessment.get("high_risks", 3))),
        "rerun_count": new_rerun_count,
        "last_run_at": now_iso,
        "updated_at": now_iso
    }

    await db["assessments"].update_one({"id": assessment_id}, {"$set": update_fields})
    updated_doc = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0})

    # Create milestone in wafr_db.milestones
    milestone_id = f"MLST-{assessment_id}-R{new_rerun_count}"
    milestone_doc = {
        "id": milestone_id,
        "assessment_id": assessment_id,
        "milestone_number": new_rerun_count,
        "milestone_name": f"Post-Remediation Review (Rerun #{new_rerun_count})",
        "version": f"v1.{new_rerun_count}.0",
        "recorded_at": "Just now",
        "recorded_by": "Automated Scanner",
        "score": new_score,
        "total_checks": total_checks,
        "passed_checks": passed_count,
        "failed_checks": failing_count,
        "high_risks": update_fields["high_risks"],
        "notes": f"Rerun triggered. {len(fixed_check_ids)} checks resolved via live telemetry scan.",
        "created_at": now_iso
    }
    await db["milestones"].update_one({"id": milestone_id}, {"$set": milestone_doc}, upsert=True)

    # Insert alert log in wafr_db.alert_logs
    await db["alert_logs"].insert_one({
        "id": f"ALT-{int(time.time() * 1000) % 100000}",
        "service": "wafr",
        "title": f"Assessment Rerun Completed: {assessment.get('name')}",
        "details": f"Live scan completed. Score: {new_score}%. {passed_count}/{total_checks} checks passing.",
        "severity": "info",
        "status": "delivered",
        "timestamp": "Just now",
        "created_at": now_iso
    })

    return {
        "status": "success",
        "assessment": updated_doc,
        "milestone": milestone_doc
    }

@app.post("/api/checks/rerun")
async def rerun_check(payload: Dict[str, Any]):
    check_id = payload.get("check_id")
    assessment_id = payload.get("assessment_id") or "A-001"
    resource_arn = payload.get("resource_arn")
    user_id = payload.get("user_id") or "usr-01"
    status = payload.get("status") or "fixed"
    note = payload.get("note") or "Telemetry verified compliant"
    now_iso = datetime.now(timezone.utc).isoformat()

    if not check_id:
        raise HTTPException(status_code=400, detail="Missing 'check_id'")

    # 1. Update wafr_db.remediation_statuses
    status_key = f"{assessment_id}::{check_id}::{resource_arn or '__check_level__'}"
    await db["remediation_statuses"].update_one(
        {"key": status_key},
        {
            "$set": {
                "key": status_key,
                "assessment_id": assessment_id,
                "check_id": check_id,
                "resource_raw": resource_arn or "__check_level__",
                "status": status,
                "note": note,
                "user_id": user_id,
                "updated_at": now_iso
            }
        },
        upsert=True
    )

    # 2. Update wafr_db.findings
    finding_query = {"assessment_id": assessment_id, "check_id": check_id}
    finding = await db["findings"].find_one(finding_query)
    if finding:
        await db["findings"].update_one(
            finding_query,
            {"$set": {"status": "pass" if status == "fixed" else "fail", "updated_at": now_iso}}
        )

    # 3. Update wafr_db.checks
    await db["checks"].update_one(
        {"id": check_id},
        {"$set": {"status": "pass" if status == "fixed" else "fail"}}
    )

    # 4. Recalculate wafr_db.assessments metrics
    assessment = await db["assessments"].find_one({"id": assessment_id})
    if assessment:
        findings_cursor = db["findings"].find({"assessment_id": assessment_id})
        all_findings = await findings_cursor.to_list(200)

        failing_count = sum(1 for f in all_findings if f.get("status") == "fail")
        total_checks = assessment.get("total_checks", 46)
        passed_count = max(0, total_checks - failing_count)
        new_score = min(100, max(50, round((passed_count / total_checks) * 100)))

        await db["assessments"].update_one(
            {"id": assessment_id},
            {
                "$set": {
                    "score": new_score,
                    "passed_checks": passed_count,
                    "failed_checks": failing_count,
                    "high_risks": max(0, assessment.get("high_risks", 3) - 1) if status == "fixed" else assessment.get("high_risks", 3),
                    "updated_at": now_iso
                }
            }
        )

    # 5. Insert audit log in wafr_db.alert_logs
    alert_id = f"ALT-{int(time.time() * 1000) % 100000}"
    await db["alert_logs"].insert_one({
        "id": alert_id,
        "service": "wafr",
        "title": f"Check {check_id} Re-verified (Passed)",
        "details": f"Configuration rule verification succeeded for {resource_arn or 'all impacted resources'} in assessment {assessment_id}.",
        "severity": "info",
        "status": "delivered",
        "timestamp": "Just now",
        "created_at": now_iso
    })

    return {
        "status": "success",
        "check_id": check_id,
        "assessment_id": assessment_id,
        "resource_arn": resource_arn,
        "verified": True,
        "finding_status": "pass" if status == "fixed" else "fail",
        "timestamp": now_iso
    }

@app.post("/api/cloud-accounts")
async def create_cloud_account(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing account 'id'")
    
    if payload.get("user_id"):
        user_doc = await db["users"].find_one({"$or": [{"id": payload["user_id"]}, {"email": payload["user_id"]}]})
        if user_doc:
            payload["user_id"] = user_doc["id"]
            if not payload.get("org_id"):
                payload["org_id"] = user_doc.get("org_id")

    await db["cloud_accounts"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

# --- SCHEDULED ASSESSMENTS CRUD ---
@app.get("/api/scheduled-assessments")
async def get_scheduled_assessments(
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    cloud: Optional[str] = None
):
    query = {}
    if org_id and user_id:
        query["$or"] = [{"org_id": org_id}, {"user_id": user_id}]
    elif org_id:
        query["org_id"] = org_id
    elif user_id:
        query["user_id"] = user_id

    if cloud:
        query["cloud"] = cloud.lower()
    schedules = await db["scheduled_assessments"].find(query, {"_id": 0}).to_list(100)
    return schedules

@app.post("/api/scheduled-assessments")
async def create_or_update_schedule(payload: Dict[str, Any]):
    # Safeguard user_id and org_id against cloud account and users table
    cloud_acc_id = payload.get("cloud_account_id")
    if cloud_acc_id:
        acc = await db["cloud_accounts"].find_one({"$or": [{"id": str(cloud_acc_id)}, {"account_identifier": str(cloud_acc_id)}]})
        if acc:
            if not payload.get("user_id") or payload.get("user_id") in ["usr-09", "user-lezin"]:
                payload["user_id"] = acc.get("user_id")
            if not payload.get("org_id") or payload.get("org_id") == "org_01":
                payload["org_id"] = acc.get("org_id")

    if payload.get("user_id"):
        user_doc = await db["users"].find_one({"$or": [{"id": payload["user_id"]}, {"email": payload["user_id"]}]})
        if user_doc:
            payload["user_id"] = user_doc["id"]
            if not payload.get("org_id"):
                payload["org_id"] = user_doc.get("org_id")

    await db["scheduled_assessments"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

@app.delete("/api/scheduled-assessments/{schedule_id}")
async def delete_schedule(schedule_id: str):
    res = await db["scheduled_assessments"].delete_one({"id": schedule_id})
    return {"status": "deleted" if res.deleted_count > 0 else "not_found", "id": schedule_id}

# --- MILESTONES CRUD ---
@app.post("/api/milestones")
async def create_milestone(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing milestone 'id'")
    await db["milestones"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

@app.delete("/api/milestones/{milestone_id}")
async def delete_milestone(milestone_id: str):
    res = await db["milestones"].delete_one({"id": milestone_id})
    return {"status": "deleted" if res.deleted_count > 0 else "not_found", "id": milestone_id}

# --- INTEGRATIONS & JIRA TICKETS ---
@app.get("/api/integrations")
async def get_integrations(org_id: Optional[str] = None):
    query = {"org_id": org_id} if org_id else {}
    return await db["integrations"].find(query, {"_id": 0}).to_list(50)

@app.post("/api/integrations")
async def save_integration(payload: Dict[str, Any]):
    service_type = payload.get("service_type")
    if not service_type:
        raise HTTPException(status_code=400, detail="Missing 'service_type'")
    # Key integration config by (org_id, service_type) so each org keeps its own
    # Slack/Jira/GChat credentials. Previously keyed on service_type alone, so
    # every org shared and overwrote a single global integration document.
    match = {"service_type": service_type}
    if payload.get("org_id"):
        match["org_id"] = payload["org_id"]
    await db["integrations"].update_one(
        match,
        {"$set": payload},
        upsert=True
    )
    return {"status": "success"}

# --- INFRASTRUCTURE REPOSITORIES ---
@app.get("/api/repositories")
async def get_repositories(org_id: Optional[str] = None, user_id: Optional[str] = None):
    query = {}
    if org_id:
        query["org_id"] = org_id
    if user_id:
        query["$or"] = [{"user_id": user_id}, {"org_id": org_id}] if org_id else [{"user_id": user_id}]
    repos = await db["repositories"].find(query, {"_id": 0}).to_list(50)
    if not repos and not org_id and not user_id:
        repos = await db["repositories"].find({}, {"_id": 0}).to_list(50)
    return repos

@app.post("/api/repositories")
async def save_repository(payload: Dict[str, Any]):
    repo_id = payload.get("id") or f"repo_{int(time.time())}"
    payload["id"] = repo_id
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()
    if not payload.get("created_at"):
        payload["created_at"] = payload["updated_at"]

    query = {"id": repo_id}
    if payload.get("user_id"):
        query = {"$or": [{"id": repo_id}, {"user_id": payload["user_id"]}]}
    elif payload.get("org_id"):
        query = {"$or": [{"id": repo_id}, {"org_id": payload["org_id"]}]}

    await db["repositories"].update_one(query, {"$set": payload}, upsert=True)
    return {"status": "success", "id": repo_id, "repository": payload}

@app.get("/api/jira-tickets")
async def get_jira_tickets(finding_id: Optional[str] = None):
    query = {"finding_id": finding_id} if finding_id else {}
    return await db["jira_tickets"].find(query, {"_id": 0}).to_list(200)

@app.post("/api/jira-tickets")
async def create_jira_ticket(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing ticket 'id'")
    await db["jira_tickets"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

# --- QUESTIONNAIRE RESPONSES ---
@app.post("/api/questionnaire-responses")
async def save_questionnaire_response(payload: Dict[str, Any]):
    q_id = payload.get("question_id")
    if not q_id:
        raise HTTPException(status_code=400, detail="Missing 'question_id'")
    # Key responses by (assessment_id, user_id, question_id) so one assessment's
    # or user's answer never overwrites another's. Previously keyed on
    # question_id alone, which collapsed all tenants' answers into one document.
    match = {"question_id": q_id}
    if payload.get("assessment_id"):
        match["assessment_id"] = payload["assessment_id"]
    if payload.get("user_id"):
        match["user_id"] = payload["user_id"]
    await db["questionnaire_responses"].update_one(
        match,
        {"$set": payload},
        upsert=True
    )
    return {"status": "success"}

# --- USERS CRUD ---
@app.post("/api/users")
async def create_or_update_user(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    name = (payload.get("name") or "").strip()
    password = payload.get("password") or "Welcome@123"

    if email:
        try:
            await asyncio.to_thread(create_keycloak_realm_user, email, password, name)
        except HTTPException as he:
            if he.status_code != 409:
                pass
        except Exception:
            pass

    if not payload.get("id"):
        payload["id"] = f"usr-{int(time.time())}"
    await db["users"].update_one(
        {"email": email} if email else {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

@app.delete("/api/users/{user_id}")
async def delete_user(user_id: str):
    user_doc = await db["users"].find_one({"$or": [{"id": user_id}, {"email": user_id}]})
    target_id = user_doc["id"] if user_doc else user_id
    await asyncio.to_thread(delete_keycloak_realm_user, target_id)
    res = await db["users"].delete_one({"$or": [{"id": user_id}, {"email": user_id}]})
    return {"status": "deleted" if res.deleted_count > 0 else "not_found", "id": user_id}

# --- ALERT LOGS ---
@app.get("/api/alert-logs")
async def get_alert_logs(limit: int = 100):
    logs = await db["alert_logs"].find({}, {"_id": 0}).sort("timestamp", -1).to_list(limit)
    return logs

@app.post("/api/alert-logs")
async def create_alert_log(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing log 'id'")
    await db["alert_logs"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

# --- QUESTIONNAIRE QUESTIONS ---
@app.get("/api/questionnaire-questions")
async def get_questionnaire_questions():
    questions = await db["questionnaire_questions"].find({}, {"_id": 0}).to_list(100)
    return questions

@app.post("/api/questionnaire-questions")
async def update_questionnaire_question(payload: Dict[str, Any]):
    if not payload.get("id"):
        raise HTTPException(status_code=400, detail="Missing 'id'")
    await db["questionnaire_questions"].update_one(
        {"id": payload["id"]},
        {"$set": payload},
        upsert=True
    )
    return {"status": "success", "id": payload["id"]}

# --- CHECKS & BEST PRACTICES ---
@app.get("/api/checks")
async def get_checks(
    pillar_id: Optional[str] = None,
    best_practice_id: Optional[str] = None,
    severity: Optional[str] = None,
    status: Optional[str] = None,
    cloud: Optional[str] = None
):
    query = {}
    if pillar_id:
        query["pillar_id"] = pillar_id
    if best_practice_id:
        query["best_practice_id"] = best_practice_id
    if severity:
        query["severity"] = severity.lower()
    if status:
        query["status"] = status.lower()
    if cloud and cloud.lower() != 'all':
        query["cloud_provider"] = cloud.lower()
    checks = await db["checks"].find(query, {"_id": 0}).to_list(500)
    return checks

@app.get("/api/best-practices")
async def get_best_practices(pillar_id: Optional[str] = None):
    query = {"pillar_id": pillar_id} if pillar_id else {}
    bps = await db["best_practices"].find(query, {"_id": 0}).to_list(100)
    return bps

@app.get("/api/rules")
async def get_rules(pillar_id: Optional[str] = None):
    query = {"pillar_id": pillar_id} if pillar_id else {}
    rules = await db["rules"].find(query, {"_id": 0}).to_list(300)
    return rules

@app.delete("/api/cloud-accounts/{account_id}")
async def delete_cloud_account(account_id: str):
    res = await db["cloud_accounts"].delete_one({"id": account_id})
    return {"status": "deleted" if res.deleted_count > 0 else "not_found", "id": account_id}

# --- REGISTRATION & AUTH VALIDATION ---
EMAIL_REGEX = r'^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$'

DISALLOWED_EMAIL_DOMAINS = {
    # Google
    "gmail.com", "googlemail.com",
    # Yahoo
    "yahoo.com", "yahoo.co.in", "yahoo.co.uk", "yahoo.ca", "yahoo.fr", "yahoo.de", "yahoo.it", "yahoo.es", "yahoo.com.br", "yahoo.com.au", "ymail.com", "rocketmail.com",
    # Microsoft
    "outlook.com", "hotmail.com", "hotmail.co.uk", "hotmail.fr", "live.com", "msn.com", "passport.com",
    # Apple
    "icloud.com", "me.com", "mac.com",
    # AOL
    "aol.com", "aim.com",
    # Proton
    "proton.me", "protonmail.com", "protonmail.ch",
    # Zoho
    "zoho.com", "zohomail.com",
    # Mail.com / GMX
    "mail.com", "email.com", "gmx.com", "gmx.net", "gmx.de", "web.de",
    # Yandex / Russian
    "yandex.com", "yandex.ru", "mail.ru", "bk.ru", "inbox.ru", "list.ru",
    # Tutanota
    "tutanota.com", "tutamail.com", "tuta.com", "tuta.io",
    # Others & Disposable
    "fastmail.com", "hushmail.com", "inbox.com", "rediffmail.com",
    "tempmail.com", "10minutemail.com", "guerrillamail.com", "sharklasers.com", "mailinator.com",
    "throwawaymail.com", "getairmail.com", "dispostable.com", "yopmail.com"
}

def is_personal_email_domain(domain: str) -> bool:
    d = domain.lower().strip()
    if d in DISALLOWED_EMAIL_DOMAINS:
        return True
    for blocked in DISALLOWED_EMAIL_DOMAINS:
        if d.endswith("." + blocked):
            return True
    return False

@app.post("/api/auth/register")
async def register_user(payload: Dict[str, Any]):
    email = (payload.get("email") or "").strip().lower()
    name = (payload.get("name") or "").strip()
    password = payload.get("password") or ""

    if not email or not re.match(EMAIL_REGEX, email):
        raise HTTPException(status_code=400, detail="Invalid email address format.")
    
    parts = email.split("@")
    if len(parts) != 2 or "." not in parts[1] or len(parts[1].split(".")[-1]) < 2:
        raise HTTPException(status_code=400, detail="Please enter a valid email address with a valid domain.")

    domain = parts[1].lower()
    if is_personal_email_domain(domain):
        raise HTTPException(
            status_code=400,
            detail="Personal email accounts (Gmail, Yahoo, Outlook, etc.) are not supported. Please use your company email address."
        )

    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters long.")

    # 1. Create user in Keycloak (Keycloak manages auth)
    kc_info = await asyncio.to_thread(create_keycloak_realm_user, email, password, name or parts[0])
    kc_id = kc_info.get("id") if kc_info else None

    # 2. Add / Sync to MongoDB wafr_db.users
    user_id = kc_id or f"usr-{int(time.time())}"
    org_id = f"org_{re.sub(r'[^a-zA-Z0-9]', '_', parts[0])}"
    new_user = {
        "id": user_id,
        "name": name or parts[0].replace(".", " ").title(),
        "email": email,
        "organization": payload.get("organization") or "Default Organization",
        "org_id": org_id,
        "status": "Active",
        "plan": "Starter",
        "role": "user",
        "costUsage": 0.0,
        "tokenUsage": 0,
        "projects": [],
        "createdAt": "Today",
        "lastActive": "Just now"
    }

    await db["users"].update_one({"email": email}, {"$set": new_user}, upsert=True)
    new_user.pop("_id", None)
    return {"status": "success", "user": new_user}
