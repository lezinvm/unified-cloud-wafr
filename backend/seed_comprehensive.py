import os
import json
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

def seed_comprehensive():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print(f"Connecting to MongoDB at {MONGO_URI} [db: {DB_NAME}]...")

    json_path = os.path.join(os.path.dirname(__file__), "platform_data_dump.json")
    if not os.path.exists(json_path):
        print(f"[ERROR] Dump file not found: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    # 1. Extract and seed Pillars, Best Practices, and Checks
    raw_pillars = data.get("pillars", [])
    pillars_list = []
    best_practices_list = []
    checks_list = []

    for idx, p in enumerate(raw_pillars):
        p_id = p.get("id")
        p_doc = {
            "id": p_id,
            "label": p.get("label"),
            "short": p.get("short"),
            "score": p.get("score", 85),
            "color": p.get("color"),
            "display_order": idx
        }
        pillars_list.append(p_doc)

        for bp in p.get("bestPractices", []):
            bp_id = bp.get("id")
            bp_doc = {
                "id": bp_id,
                "pillar_id": p_id,
                "title": bp.get("title"),
                "description": bp.get("description"),
                "status": bp.get("status", "pass")
            }
            best_practices_list.append(bp_doc)

            for c in bp.get("checks", []):
                chk_doc = {
                    "id": c.get("id"),
                    "pillar_id": p_id,
                    "best_practice_id": bp_id,
                    "title": c.get("title"),
                    "description": c.get("description"),
                    "severity": c.get("severity", "medium").lower(),
                    "status": c.get("status", "pass"),
                    "effort": c.get("effort", "Medium"),
                    "cloud_provider": "all"
                }
                checks_list.append(chk_doc)

    # Seed pillars
    if pillars_list:
        db["pillars"].drop()
        db["pillars"].insert_many(pillars_list)
        print(f"[OK] Seeded {len(pillars_list)} pillars into 'pillars'")

    # Seed best_practices
    if best_practices_list:
        db["best_practices"].drop()
        db["best_practices"].insert_many(best_practices_list)
        print(f"[OK] Seeded {len(best_practices_list)} best practices into 'best_practices'")

    # Seed checks and rules
    if checks_list:
        db["checks"].drop()
        db["checks"].insert_many(checks_list)
        db["rules"].drop()
        db["rules"].insert_many(checks_list)
        print(f"[OK] Seeded {len(checks_list)} checks into 'checks' and 'rules' collections")

    # 2. Seed Assessments with complete DB fields
    assessments_list = [
        {
            "id": "A-001",
            "name": "Production — us-east-1 Full Review",
            "org_id": "org_01",
            "user_id": "usr-01",
            "cloud_account_id": "acc_01",
            "cloud": "aws",
            "region": "us-east-1",
            "lens": "aws-well-architected",
            "status": "COMPLETED",
            "score": 84,
            "checks_count": 46,
            "total_best_practices": 16,
            "passed_bps": 12,
            "failed_bps": 4,
            "total_checks": 46,
            "passed_checks": 36,
            "failed_checks": 10,
            "high_risks": 3,
            "medium_risks": 5,
            "low_risks": 2,
            "pillar_scores": {
                "reliability": 88,
                "security": 79,
                "cost": 91,
                "operations": 82,
                "performance": 80
            },
            "pillar_high_risks": {
                "reliability": 1,
                "security": 2,
                "cost": 0,
                "operations": 0,
                "performance": 0
            },
            "rerun_count": 0,
            "last_run_at": "2026-10-12T10:00:00Z",
            "created_at": "2026-10-01T10:00:00Z",
            "updated_at": "2026-10-12T10:00:00Z"
        },
        {
            "id": "A-002",
            "name": "Staging — us-west-2 Review",
            "org_id": "org_01",
            "user_id": "usr-01",
            "cloud_account_id": "acc_01",
            "cloud": "aws",
            "region": "us-west-2",
            "lens": "aws-well-architected",
            "status": "COMPLETED",
            "score": 71,
            "checks_count": 46,
            "total_best_practices": 16,
            "passed_bps": 10,
            "failed_bps": 6,
            "total_checks": 46,
            "passed_checks": 31,
            "failed_checks": 15,
            "high_risks": 5,
            "medium_risks": 7,
            "low_risks": 3,
            "pillar_scores": {
                "reliability": 72,
                "security": 68,
                "cost": 75,
                "operations": 70,
                "performance": 70
            },
            "pillar_high_risks": {
                "reliability": 2,
                "security": 2,
                "cost": 1,
                "operations": 0,
                "performance": 0
            },
            "rerun_count": 0,
            "last_run_at": "2026-10-12T11:00:00Z",
            "created_at": "2026-10-02T10:00:00Z",
            "updated_at": "2026-10-12T11:00:00Z"
        },
        {
            "id": "A-003",
            "name": "Azure Data Platform Review",
            "org_id": "org_01",
            "user_id": "usr-02",
            "cloud_account_id": "acc_02",
            "cloud": "azure",
            "region": "eastus",
            "lens": "azure-well-architected",
            "status": "COMPLETED",
            "score": 78,
            "checks_count": 46,
            "total_best_practices": 16,
            "passed_bps": 11,
            "failed_bps": 5,
            "total_checks": 46,
            "passed_checks": 34,
            "failed_checks": 12,
            "high_risks": 4,
            "medium_risks": 6,
            "low_risks": 2,
            "pillar_scores": {
                "reliability": 78,
                "security": 74,
                "cost": 82,
                "operations": 80,
                "performance": 76
            },
            "pillar_high_risks": {
                "reliability": 1,
                "security": 2,
                "cost": 1,
                "operations": 0,
                "performance": 0
            },
            "rerun_count": 0,
            "last_run_at": "2026-10-11T09:00:00Z",
            "created_at": "2026-10-03T10:00:00Z",
            "updated_at": "2026-10-11T09:00:00Z"
        }
    ]
    db["assessments"].drop()
    db["assessments"].insert_many(assessments_list)
    print(f"[OK] Seeded {len(assessments_list)} assessments with full metrics into 'assessments'")

    # 3. Seed Milestones with complete DB fields
    milestones_list = [
        {
            "id": "mil_01",
            "assessment_id": "A-001",
            "milestone_number": 1,
            "milestone_name": "Pre-Audit Baseline",
            "version": "v1.0.0",
            "score": 84,
            "total_best_practices": 16,
            "passed_bps": 12,
            "failed_bps": 4,
            "total_checks": 46,
            "passed_checks": 36,
            "failed_checks": 10,
            "high_risks": 3,
            "medium_risks": 5,
            "low_risks": 2,
            "pillar_scores": {
                "reliability": 88,
                "security": 79,
                "cost": 91,
                "operations": 82,
                "performance": 80
            },
            "pillar_high_risks": {
                "reliability": 1,
                "security": 2,
                "cost": 0,
                "operations": 0,
                "performance": 0
            },
            "notes": "Initial pre-audit baseline architecture evaluation.",
            "recorded_by": "Alice Admin",
            "recorded_at": "2026-10-01T12:00:00Z"
        },
        {
            "id": "mil_02",
            "assessment_id": "A-001",
            "milestone_number": 2,
            "milestone_name": "Post-Remediation Checkpoint",
            "version": "v1.1.0",
            "score": 90,
            "total_best_practices": 16,
            "passed_bps": 15,
            "failed_bps": 1,
            "total_checks": 46,
            "passed_checks": 42,
            "failed_checks": 4,
            "high_risks": 1,
            "medium_risks": 2,
            "low_risks": 1,
            "pillar_scores": {
                "reliability": 94,
                "security": 88,
                "cost": 93,
                "operations": 89,
                "performance": 86
            },
            "pillar_high_risks": {
                "reliability": 0,
                "security": 1,
                "cost": 0,
                "operations": 0,
                "performance": 0
            },
            "notes": "Post-remediation checkpoint with resolved IAM and S3 security findings.",
            "recorded_by": "Jagan Gurugubelli",
            "recorded_at": "2026-10-10T15:30:00Z"
        }
    ]
    db["milestones"].drop()
    db["milestones"].insert_many(milestones_list)
    print(f"[OK] Seeded {len(milestones_list)} milestones with full metrics into 'milestones'")

    # 4. Seed Cloud Accounts
    cloud_accounts_list = [
        {
            "id": "acc_01",
            "org_id": "org_01",
            "user_id": "usr-01",
            "cloud": "aws",
            "account_name": "Production-AWS",
            "account_identifier": "124890123456",
            "default_region": "us-east-1",
            "auth_type": "role",
            "role_arn": "arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole",
            "external_id": "cfops-wafr-tenant-9941",
            "is_active": True,
            "last_connected_at": "2026-10-12T08:00:00Z"
        },
        {
            "id": "acc_02",
            "org_id": "org_01",
            "user_id": "usr-01",
            "cloud": "azure",
            "account_name": "Acme Corp Tenant",
            "account_identifier": "sub-4891-2394",
            "default_region": "eastus",
            "auth_type": "sp",
            "tenant_id": "72f988bf-86f1-41af-91ab-2d7cd011db47",
            "client_id": "e892c901-44bb-4e31-8902-124890123456",
            "is_active": True,
            "last_connected_at": "2026-10-11T12:00:00Z"
        },
        {
            "id": "acc_03",
            "org_id": "org_01",
            "user_id": "usr-01",
            "cloud": "gcp",
            "account_name": "acme-org",
            "account_identifier": "proj-gcp-9941",
            "default_region": "us-central1",
            "auth_type": "sa",
            "gcp_project": "acme-gcp-prod-9941",
            "sa_email": "wafr-scanner@acme-gcp-prod.iam.gserviceaccount.com",
            "is_active": True,
            "last_connected_at": "2026-10-10T14:00:00Z"
        }
    ]
    db["cloud_accounts"].drop()
    db["cloud_accounts"].insert_many(cloud_accounts_list)
    print(f"[OK] Seeded {len(cloud_accounts_list)} cloud accounts scoped to org_01 into 'cloud_accounts'")

    print("\n[SUCCESS] Comprehensive seeding complete! All checks, rules, best practices, metrics, and accounts are populated.")

if __name__ == "__main__":
    seed_comprehensive()
