"""
Unified Master Seed Script for Unified Cloud WAFR Platform
Seeds all collections cleanly in MongoDB with 100% data integrity:
- Users (including lezin.menath@cloudifyops.com with full permissions)
- Cloud Accounts (1 AWS, 1 Azure, 1 GCP - all connected and verified)
- Assessments (AWS Success & Fail, Azure Success & Fail, GCP Success & Fail)
- Cloud-Specific Checks & Rules (138 checks: 46 AWS, 46 Azure, 46 GCP)
- Remediations (27 remediations: 9 AWS, 9 Azure, 9 GCP)
- Findings (Linked to assessments with actual cloud resources)
- Milestones (Baselines and post-remediation checkpoints)
- Pillars, Compliance Frameworks, Integrations, Alert Logs, Questions
"""
import os
import json
from datetime import datetime, timezone
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

NOW = datetime.now(timezone.utc).isoformat()
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# ─────────────────────────────────────────────────────────────────────────────
# 1. CLOUD ACCOUNTS (Clean 1:1:1 multi-cloud mapping)
# ─────────────────────────────────────────────────────────────────────────────
CLOUD_ACCOUNTS = [
    {
        "id": "124890123456",
        "cloud": "aws",
        "account_name": "acme-production-us-east-1",
        "account_identifier": "124890123456",
        "auth_type": "role",
        "role_arn": "arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole",
        "external_id": "cfops-wafr-tenant-9941",
        "default_region": "us-east-1",
        "status": "connected",
        "is_active": True,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_connected_at": NOW,
        "created_at": NOW,
    },
    {
        "id": "sub-4891-2394-8812",
        "cloud": "azure",
        "account_name": "Acme Corp Azure Tenant",
        "account_identifier": "sub-4891-2394-8812",
        "auth_type": "sp",
        "tenant_id": "72f988bf-86f1-41af-91ab-2d7cd011db47",
        "client_id": "e892c901-44bb-4e31-8902-124890123456",
        "default_region": "eastus",
        "status": "connected",
        "is_active": True,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_connected_at": NOW,
        "created_at": NOW,
    },
    {
        "id": "proj-gcp-prod-9941",
        "cloud": "gcp",
        "account_name": "acme-gcp-prod",
        "account_identifier": "proj-gcp-prod-9941",
        "gcp_project": "proj-gcp-prod-9941",
        "auth_type": "service-account",
        "sa_email": "wafr-scanner@proj-gcp-prod-9941.iam.gserviceaccount.com",
        "default_region": "us-central1",
        "status": "connected",
        "is_active": True,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_connected_at": NOW,
        "created_at": NOW,
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# 2. ASSESSMENTS (1 Success + 1 Fail for AWS, Azure, and GCP)
# ─────────────────────────────────────────────────────────────────────────────
ASSESSMENTS = [
    # ── AWS Successful Assessment ──
    {
        "id": "A-001",
        "name": "Production — us-east-1 Full Review",
        "cloud": "aws",
        "cloud_account_id": "124890123456",
        "account_name": "acme-production-us-east-1",
        "account_identifier": "124890123456",
        "region": "us-east-1",
        "lens": "aws-well-architected",
        "status": "COMPLETED",
        "score": 84,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 36,
        "failed_checks": 10,
        "total_best_practices": 16,
        "passed_bps": 12,
        "failed_bps": 4,
        "high_risks": 3,
        "medium_risks": 5,
        "low_risks": 2,
        "pillar_scores": {
            "reliability": 88,
            "security": 79,
            "cost": 91,
            "operations": 82,
            "performance": 80,
        },
        "pillar_high_risks": {
            "reliability": 1,
            "security": 2,
            "cost": 0,
            "operations": 0,
            "performance": 0,
        },
        "rerun_count": 0,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_run_at": "2026-10-12T10:00:00Z",
        "created_at": "2026-10-01T10:00:00Z",
        "updated_at": NOW,
    },

    # ── AWS Failed Assessment ──
    {
        "id": "A-FAIL-001",
        "name": "Production E-Commerce AWS Architecture Audit (Critical Failures)",
        "cloud": "aws",
        "cloud_account_id": "124890123456",
        "account_name": "acme-production-us-east-1",
        "account_identifier": "124890123456",
        "region": "us-east-1",
        "lens": "aws-well-architected",
        "status": "FAIL",
        "score": 38,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 16,
        "failed_checks": 30,
        "total_best_practices": 16,
        "passed_bps": 4,
        "failed_bps": 12,
        "high_risks": 16,
        "medium_risks": 10,
        "low_risks": 4,
        "pillar_scores": {
            "security": 31,
            "reliability": 36,
            "cost": 48,
            "operations": 40,
            "performance": 37,
        },
        "pillar_high_risks": {
            "security": 6,
            "reliability": 4,
            "cost": 3,
            "operations": 2,
            "performance": 1,
        },
        "rerun_count": 1,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_run_at": NOW,
        "created_at": "2026-10-14T08:00:00Z",
        "updated_at": NOW,
    },

    # ── Azure Successful Assessment ──
    {
        "id": "A-003",
        "name": "Azure Well-Architected Framework Review — Data & Enterprise",
        "cloud": "azure",
        "cloud_account_id": "sub-4891-2394-8812",
        "account_name": "Acme Corp Azure Tenant",
        "account_identifier": "sub-4891-2394-8812",
        "region": "eastus",
        "lens": "azure-well-architected",
        "status": "COMPLETED",
        "score": 82,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 38,
        "failed_checks": 8,
        "total_best_practices": 16,
        "passed_bps": 13,
        "failed_bps": 3,
        "high_risks": 2,
        "medium_risks": 4,
        "low_risks": 2,
        "pillar_scores": {
            "reliability": 82,
            "security": 80,
            "cost": 85,
            "operations": 84,
            "performance": 79,
        },
        "pillar_high_risks": {
            "reliability": 1,
            "security": 1,
            "cost": 0,
            "operations": 0,
            "performance": 0,
        },
        "rerun_count": 0,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_run_at": "2026-10-11T09:00:00Z",
        "created_at": "2026-10-03T10:00:00Z",
        "updated_at": NOW,
    },

    # ── Azure Failed Assessment ──
    {
        "id": "A-AZURE-FAIL",
        "name": "Azure AKS & Microservices Security Hardening Review (Critical Failures)",
        "cloud": "azure",
        "cloud_account_id": "sub-4891-2394-8812",
        "account_name": "Acme Corp Azure Tenant",
        "account_identifier": "sub-4891-2394-8812",
        "region": "eastus",
        "lens": "azure-well-architected",
        "status": "FAIL",
        "score": 42,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 16,
        "failed_checks": 30,
        "total_best_practices": 16,
        "passed_bps": 5,
        "failed_bps": 11,
        "high_risks": 8,
        "medium_risks": 5,
        "low_risks": 2,
        "pillar_scores": {
            "reliability": 40,
            "security": 32,
            "cost": 50,
            "operations": 45,
            "performance": 43,
        },
        "pillar_high_risks": {
            "security": 4,
            "reliability": 2,
            "cost": 1,
            "operations": 1,
            "performance": 0,
        },
        "rerun_count": 0,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_run_at": NOW,
        "created_at": "2026-10-15T10:00:00Z",
        "updated_at": NOW,
    },

    # ── GCP Failed Assessment (Evaluates VM lens-multicloud e2-medium) ──
    {
        "id": "A-GCP-001",
        "name": "Google Cloud Architecture Review — lens-multicloud (us-central1)",
        "cloud": "gcp",
        "cloud_account_id": "proj-gcp-prod-9941",
        "account_name": "acme-gcp-prod",
        "account_identifier": "proj-gcp-prod-9941",
        "region": "us-central1",
        "lens": "google-cloud-architecture-framework",
        "status": "FAIL",
        "score": 41,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 18,
        "failed_checks": 28,
        "total_best_practices": 16,
        "passed_bps": 6,
        "failed_bps": 10,
        "high_risks": 6,
        "medium_risks": 4,
        "low_risks": 1,
        "pillar_scores": {
            "reliability": 45,
            "security": 32,
            "cost": 48,
            "operations": 40,
            "performance": 40,
        },
        "pillar_high_risks": {
            "security": 3,
            "reliability": 2,
            "cost": 1,
            "operations": 0,
            "performance": 0,
        },
        "rerun_count": 0,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_run_at": NOW,
        "created_at": "2026-10-16T04:00:00Z",
        "updated_at": NOW,
    },

    # ── GCP Successful Assessment ──
    {
        "id": "A-GCP-002",
        "name": "Google Cloud Analytics & BigQuery Well-Architected Review",
        "cloud": "gcp",
        "cloud_account_id": "proj-gcp-prod-9941",
        "account_name": "acme-gcp-prod",
        "account_identifier": "proj-gcp-prod-9941",
        "region": "us-central1",
        "lens": "google-cloud-architecture-framework",
        "status": "COMPLETED",
        "score": 89,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 41,
        "failed_checks": 5,
        "total_best_practices": 16,
        "passed_bps": 14,
        "failed_bps": 2,
        "high_risks": 1,
        "medium_risks": 3,
        "low_risks": 1,
        "pillar_scores": {
            "reliability": 90,
            "security": 88,
            "cost": 92,
            "operations": 86,
            "performance": 89,
        },
        "pillar_high_risks": {
            "reliability": 0,
            "security": 1,
            "cost": 0,
            "operations": 0,
            "performance": 0,
        },
        "rerun_count": 0,
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_run_at": "2026-10-13T14:00:00Z",
        "created_at": "2026-10-05T10:00:00Z",
        "updated_at": NOW,
    },
]

# ─────────────────────────────────────────────────────────────────────────────
# 3. USERS (Explicit user including lezin.menath@cloudifyops.com)
# ─────────────────────────────────────────────────────────────────────────────
USERS = [
    { "id": "usr-01", "name": "Jagan Gurugubelli", "email": "jagan.gurugubelli@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "admin", "status": "Active", "plan": "Enterprise", "costUsage": 14.85, "tokenUsage": 2410500, "projects": ["WAFR Review - 1", "PROD Modernization"], "createdAt": "Sep 01, 2024", "lastActive": "5 mins ago" },
    { "id": "usr-02", "name": "Thiruvengadam Raju", "email": "thiruvengadam.raju@cloudifyops.com", "organization": "Acme Corp", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 8.40, "tokenUsage": 1380200, "projects": ["Azure Migrations"], "createdAt": "Sep 01, 2024", "lastActive": "12 mins ago" },
    { "id": "usr-03", "name": "Vais Afeefa", "email": "vais.afeefa@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 6.20, "tokenUsage": 940000, "projects": ["Governance Portal"], "createdAt": "Sep 01, 2024", "lastActive": "1 hour ago" },
    { "id": "usr-04", "name": "Mariyam Qurashi", "email": "mariyam.qurashi@cloudifyops.com", "organization": "Contoso Tech", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 4.50, "tokenUsage": 720000, "projects": ["Multi-Cloud WAFR"], "createdAt": "Sep 01, 2024", "lastActive": "3 hours ago" },
    { "id": "usr-05", "name": "Dhernis Tiwari", "email": "dhernis.tiwari@cloudifyops.com", "organization": "FinTech Cloud", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Pro", "costUsage": 3.80, "tokenUsage": 610000, "projects": ["Cost Optimizer"], "createdAt": "Sep 01, 2024", "lastActive": "Yesterday" },
    { "id": "usr-06", "name": "Jabin Sebastian", "email": "jabin.sebastian@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 5.10, "tokenUsage": 830000, "projects": ["AWS Lens 2026"], "createdAt": "Sep 01, 2024", "lastActive": "2 days ago" },
    { "id": "usr-08", "name": "Vishal Agrawal", "email": "vishal.agrawal@cloudifyops.com", "organization": "DataCorp Enterprise", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Pro", "costUsage": 7.30, "tokenUsage": 1190000, "projects": ["SecOps Automation"], "createdAt": "Sep 01, 2024", "lastActive": "30 mins ago" },
    { "id": "usr-09", "name": "Lezin VM", "email": "lezin.menath@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "admin", "status": "Active", "plan": "Enterprise", "costUsage": 12.90, "tokenUsage": 2150000, "projects": ["Unified Cloud Lens", "AI Fix Assistant", "Multi-Cloud Governance"], "createdAt": "Sep 01, 2024", "lastActive": "Just now" },
    { "id": "usr-10", "name": "Karthick Duraiswamy", "email": "karthickduraiswamy@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 9.60, "tokenUsage": 1540000, "projects": ["WAFR Review - 1", "FinOps Insights"], "createdAt": "Sep 01, 2024", "lastActive": "45 mins ago" },
    { "id": "usr-11", "name": "Kiran K", "email": "kiran.k@cloudifyops.com", "organization": "Apex Solutions", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Pro", "costUsage": 4.90, "tokenUsage": 780000, "projects": ["GCP Compliance"], "createdAt": "Sep 01, 2024", "lastActive": "4 hours ago" },
    { "id": "usr-12", "name": "Akshay VM", "email": "akshay.vm@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Pro", "costUsage": 5.70, "tokenUsage": 910000, "projects": ["IaC Remediation"], "createdAt": "Sep 01, 2024", "lastActive": "1 day ago" },
    { "id": "usr-13", "name": "Jayasharma Alagupandhy", "email": "jayasharma.alagupandhy@cloudifyops.com", "organization": "Alpha Cloud Ltd", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 8.10, "tokenUsage": 1300000, "projects": ["PROD Modernization"], "createdAt": "Sep 01, 2024", "lastActive": "2 hours ago" },
    { "id": "usr-14", "name": "Abhijith Sasidharan", "email": "abhijith.sasidharan@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "user", "status": "Active", "plan": "Enterprise", "costUsage": 6.90, "tokenUsage": 1120000, "projects": ["Security Posture"], "createdAt": "Sep 01, 2024", "lastActive": "5 hours ago" },
    { "id": "usr-admin", "name": "System Administrator", "email": "admin@cloudifyops.com", "organization": "CloudifyOps", "org_id": "org_01", "role": "admin", "status": "Active", "plan": "Enterprise", "costUsage": 0.0, "tokenUsage": 0, "projects": ["Global Governance"], "createdAt": "Sep 01, 2024", "lastActive": "Just now" }
]

def main():
    print(f"Connecting to MongoDB at {MONGO_URI} [db: {DB_NAME}]...")
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    # ─────────────────────────────────────────────────────────────────────────
    # A. SEED BASE PLATFORM DUMP (Pillars, Frameworks, Integrations, Alert Logs, Questions)
    # ─────────────────────────────────────────────────────────────────────────
    dump_path = os.path.join(BASE_DIR, "platform_data_dump.json")
    if os.path.exists(dump_path):
        with open(dump_path, "r", encoding="utf-8") as f:
            dump_data = json.load(f)
        
        pillars = dump_data.get("pillars", [])
        if pillars:
            db["pillars"].drop()
            for idx, p in enumerate(pillars):
                p["display_order"] = idx
            db["pillars"].insert_many(pillars)
            print(f"[OK] Seeded {len(pillars)} pillars.")

        frameworks = dump_data.get("complianceFrameworks", [])
        if frameworks:
            db["compliance_frameworks"].drop()
            db["compliance_frameworks"].insert_many(frameworks)
            print(f"[OK] Seeded {len(frameworks)} compliance frameworks.")

        integrations_dict = dump_data.get("integrations", {})
        if integrations_dict:
            db["integrations"].drop()
            docs = []
            for k, v in integrations_dict.items():
                v["service_type"] = k
                docs.append(v)
            db["integrations"].insert_many(docs)
            print(f"[OK] Seeded {len(docs)} integrations.")

        alert_logs = dump_data.get("alertLogs", [])
        if alert_logs:
            db["alert_logs"].drop()
            db["alert_logs"].insert_many(alert_logs)
            print(f"[OK] Seeded {len(alert_logs)} alert logs.")

        questions = dump_data.get("orgQuestions", [])
        if questions:
            db["questionnaire_questions"].drop()
            db["questionnaire_questions"].insert_many(questions)
            print(f"[OK] Seeded {len(questions)} questionnaire questions.")

    # ─────────────────────────────────────────────────────────────────────────
    # B. SEED USERS
    # ─────────────────────────────────────────────────────────────────────────
    for u in USERS:
        db["users"].update_one({"email": u["email"]}, {"$set": u}, upsert=True)
    print(f"[OK] Seeded {len(USERS)} platform users (including lezin.menath@cloudifyops.com).")

    # ─────────────────────────────────────────────────────────────────────────
    # C. SEED CLOUD ACCOUNTS (AWS: 1, Azure: 1, GCP: 1)
    # ─────────────────────────────────────────────────────────────────────────
    db["cloud_accounts"].drop()
    db["cloud_accounts"].insert_many(CLOUD_ACCOUNTS)
    print(f"[OK] Seeded {len(CLOUD_ACCOUNTS)} active cloud accounts (AWS: 124890123456, Azure: sub-4891-2394-8812, GCP: proj-gcp-prod-9941).")

    # ─────────────────────────────────────────────────────────────────────────
    # D. SEED ASSESSMENTS (2 AWS, 2 Azure, 2 GCP)
    # ─────────────────────────────────────────────────────────────────────────
    db["assessments"].drop()
    db["assessments"].insert_many(ASSESSMENTS)
    print(f"[OK] Seeded {len(ASSESSMENTS)} assessments (1 Success & 1 Fail for AWS, Azure, and GCP).")

    # ─────────────────────────────────────────────────────────────────────────
    # E. SEED CLOUD CHECKS & RULES (138 cloud checks)
    # ─────────────────────────────────────────────────────────────────────────
    try:
        from seed_cloud_checks import seed_cloud_checks
        seed_cloud_checks()
        checks_list = list(db["checks"].find({}, {"_id": 0}))
        if checks_list:
            db["rules"].drop()
            db["rules"].insert_many(checks_list)
            print(f"[OK] Synced {len(checks_list)} checks to 'rules' collection.")

        if os.path.exists(dump_path):
            with open(dump_path, "r", encoding="utf-8") as f:
                d_data = json.load(f)
            bp_list = []
            for p in d_data.get("pillars", []):
                p_id = p.get("id")
                for bp in p.get("bestPractices", []):
                    bp_list.append({
                        "id": bp.get("id"),
                        "pillar_id": p_id,
                        "title": bp.get("title"),
                        "description": bp.get("description"),
                        "status": bp.get("status", "pass")
                    })
            if bp_list:
                db["best_practices"].drop()
                db["best_practices"].insert_many(bp_list)
                print(f"[OK] Seeded {len(bp_list)} best practices into 'best_practices'.")
    except Exception as e:
        print(f"[WARN] Failed to run seed_cloud_checks: {e}")

    # ─────────────────────────────────────────────────────────────────────────
    # F. SEED REMEDIATIONS & FINDINGS (AWS, Azure, GCP)
    # ─────────────────────────────────────────────────────────────────────────
    try:
        from seed_remediations_and_findings import REMEDIATIONS
        db["remediations"].drop()
        db["remediations"].insert_many(REMEDIATIONS)
        print(f"[OK] Seeded {len(REMEDIATIONS)} cloud remediations into 'remediations' collection.")

        # Seed findings for all 6 assessments
        all_findings = []
        for asm in ASSESSMENTS:
            asm_id = asm["id"]
            asm_cloud = asm["cloud"]
            cloud_rems = [r for r in REMEDIATIONS if r["cloud"] == asm_cloud]
            if not cloud_rems:
                cloud_rems = [r for r in REMEDIATIONS if r["cloud"] == "aws"]
            
            # If assessment is a success, mark most findings passed/resolved
            is_success = asm["status"] == "COMPLETED"

            for idx, rem in enumerate(cloud_rems):
                finding_status = "pass" if (is_success and idx > 1) else "fail"
                finding = {
                    "id": f"FND-{asm_id}-{rem['check_id']}",
                    "assessment_id": asm_id,
                    "check_id": rem["check_id"],
                    "remediation_id": rem["id"],
                    "cloud": asm_cloud,
                    "pillar_id": rem.get("pillarId", "reliability"),
                    "pillar": rem.get("pillar", "Reliability"),
                    "severity": rem["severity"],
                    "title": rem["title"],
                    "description": rem["description"],
                    "status": finding_status,
                    "effort": rem.get("effort", "Low Effort"),
                    "risk": rem.get("risk", "High Risk"),
                    "resources": rem.get("resources", []),
                    "created_at": asm.get("created_at") or NOW,
                    "updated_at": NOW
                }
                all_findings.append(finding)

        if all_findings:
            db["findings"].drop()
            db["findings"].insert_many(all_findings)
            print(f"[OK] Seeded {len(all_findings)} findings across all 6 assessments.")
    except Exception as e:
        print(f"[WARN] Failed to seed remediations/findings: {e}")

    # ─────────────────────────────────────────────────────────────────────────
    # G. SEED MILESTONES (Baseline and checkpoint milestones)
    # ─────────────────────────────────────────────────────────────────────────
    milestones_list = []
    for asm in ASSESSMENTS:
        milestones_list.append({
            "id": f"mil-{asm['id']}-01",
            "assessment_id": asm["id"],
            "milestone_number": 1,
            "milestone_name": "Pre-Audit Baseline",
            "version": "v1.0.0",
            "score": asm["score"],
            "total_best_practices": asm["total_best_practices"],
            "passed_bps": asm["passed_bps"],
            "failed_bps": asm["failed_bps"],
            "total_checks": asm["total_checks"],
            "passed_checks": asm["passed_checks"],
            "failed_checks": asm["failed_checks"],
            "high_risks": asm["high_risks"],
            "medium_risks": asm["medium_risks"],
            "low_risks": asm["low_risks"],
            "notes": f"Initial baseline assessment milestone for {asm['name']}.",
            "pillar_scores": asm["pillar_scores"],
            "pillar_high_risks": asm.get("pillar_high_risks", {}),
            "recorded_by": "Lezin VM",
            "recorded_at": asm["created_at"],
        })
        if asm["status"] == "COMPLETED":
            milestones_list.append({
                "id": f"mil-{asm['id']}-02",
                "assessment_id": asm["id"],
                "milestone_number": 2,
                "milestone_name": "Post-Remediation Checkpoint",
                "version": "v1.1.0",
                "score": min(100, asm["score"] + 8),
                "total_best_practices": asm["total_best_practices"],
                "passed_bps": asm["passed_bps"] + 2,
                "failed_bps": max(0, asm["failed_bps"] - 2),
                "total_checks": asm["total_checks"],
                "passed_checks": asm["passed_checks"] + 4,
                "failed_checks": max(0, asm["failed_checks"] - 4),
                "high_risks": max(0, asm["high_risks"] - 2),
                "medium_risks": max(0, asm["medium_risks"] - 2),
                "low_risks": asm["low_risks"],
                "notes": "Verified remediation of top security and reliability findings.",
                "pillar_scores": asm["pillar_scores"],
                "pillar_high_risks": asm.get("pillar_high_risks", {}),
                "recorded_by": "Lezin VM",
                "recorded_at": NOW,
            })
    db["milestones"].drop()
    db["milestones"].insert_many(milestones_list)
    print(f"[OK] Seeded {len(milestones_list)} milestones across assessments.")

    # ─────────────────────────────────────────────────────────────────────────
    # H. SEED RESOURCES (Cloud resource inventory)
    # ─────────────────────────────────────────────────────────────────────────
    resources_list = [
        # AWS Resources
        {"id": "res-aws-01", "cloud": "aws", "type": "alb", "arn": "arn:aws:elasticloadbalancing:us-east-1:124890123456:loadbalancer/app/prod-public-alb/50dc6c495c0c9188", "name": "prod-public-alb", "region": "us-east-1", "account_id": "124890123456"},
        {"id": "res-aws-02", "cloud": "aws", "type": "s3", "arn": "arn:aws:s3:::acme-customer-billing-prod-us-east-1", "name": "acme-customer-billing-prod-us-east-1", "region": "us-east-1", "account_id": "124890123456"},
        {"id": "res-aws-03", "cloud": "aws", "type": "sqs", "arn": "arn:aws:sqs:us-east-1:124890123456:prod-order-processing", "name": "prod-order-processing", "region": "us-east-1", "account_id": "124890123456"},
        {"id": "res-aws-04", "cloud": "aws", "type": "iam_role", "arn": "arn:aws:iam::124890123456:role/app-backend-prod-role", "name": "app-backend-prod-role", "region": "global", "account_id": "124890123456"},
        # Azure Resources
        {"id": "res-az-01", "cloud": "azure", "type": "app_gateway", "arn": "/subscriptions/sub-4891-2394-8812/resourceGroups/acme-prod-rg/providers/Microsoft.Network/applicationGateways/acme-prod-appgw", "name": "acme-prod-appgw", "region": "eastus", "account_id": "sub-4891-2394-8812"},
        {"id": "res-az-02", "cloud": "azure", "type": "storage_account", "arn": "/subscriptions/sub-4891-2394-8812/resourceGroups/acme-prod-rg/providers/Microsoft.Storage/storageAccounts/acmeproddata9941", "name": "acmeproddata9941", "region": "eastus", "account_id": "sub-4891-2394-8812"},
        {"id": "res-az-03", "cloud": "azure", "type": "key_vault", "arn": "/subscriptions/sub-4891-2394-8812/resourceGroups/acme-prod-rg/providers/Microsoft.KeyVault/vaults/acme-prod-kv-9941", "name": "acme-prod-kv-9941", "region": "eastus", "account_id": "sub-4891-2394-8812"},
        # GCP Resources
        {"id": "res-gcp-01", "cloud": "gcp", "type": "compute_instance", "arn": "//compute.googleapis.com/projects/proj-gcp-prod-9941/zones/us-central1-a/instances/lens-multicloud", "name": "lens-multicloud", "region": "us-central1", "account_id": "proj-gcp-prod-9941"},
        {"id": "res-gcp-02", "cloud": "gcp", "type": "compute_disk", "arn": "//compute.googleapis.com/projects/proj-gcp-prod-9941/zones/us-central1-a/disks/lens-multicloud-boot", "name": "lens-multicloud-boot", "region": "us-central1", "account_id": "proj-gcp-prod-9941"},
        {"id": "res-gcp-03", "cloud": "gcp", "type": "backend_service", "arn": "//compute.googleapis.com/projects/proj-gcp-prod-9941/global/backendServices/lens-multicloud-backend", "name": "lens-multicloud-backend", "region": "global", "account_id": "proj-gcp-prod-9941"},
    ]
    db["resources"].drop()
    db["resources"].insert_many(resources_list)
    print(f"[OK] Seeded {len(resources_list)} cloud resources into 'resources' collection.")

    print("\n==================================================================")
    print(" [MASTER SEED COMPLETE]")
    print(f" Users:              {db['users'].count_documents({})}")
    print(f" Cloud Accounts:     {db['cloud_accounts'].count_documents({})} (AWS: 1, Azure: 1, GCP: 1)")
    print(f" Assessments:        {db['assessments'].count_documents({})} (AWS: 2, Azure: 2, GCP: 2)")
    print(f" Checks:             {db['checks'].count_documents({})}")
    print(f" Remediations:       {db['remediations'].count_documents({})}")
    print(f" Findings:           {db['findings'].count_documents({})}")
    print(f" Milestones:         {db['milestones'].count_documents({})}")
    print(f" Pillars:            {db['pillars'].count_documents({})}")
    print(f" Frameworks:         {db['compliance_frameworks'].count_documents({})}")
    print("==================================================================")

if __name__ == "__main__":
    main()
