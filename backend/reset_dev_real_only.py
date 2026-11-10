"""
Wipe all demo/seed data from a DEV database so only real scan data remains.

Run this, then check_engine.py + load_assessment_to_db.py --real-only.

Kept (reference definitions, not customer data):
    pillars (definitions only: embedded demo bestPractices removed, score -> 0)
    compliance_frameworks, questionnaire_questions, control_catalog, organizations
    users: only the account given with --keep-email (demo usage fields zeroed)

Emptied (everything else that holds demo customer data):
    assessments, findings, milestones, resource_inventory, resources,
    remediations, remediation_statuses, cloud_accounts, checks, best_practices,
    rules, integrations, alert_logs, repositories, jira_tickets,
    scheduled_assessments, questionnaire_responses, assessment_compliance_scores

SAFETY: refuses to run unless --yes is given, and refuses any MONGO_URI that is
not the dev Mongo on port 27018 unless --i-know-this-is-not-prod is also given.

Usage:
    MONGO_URI=mongodb://localhost:27018 python reset_dev_real_only.py \
        --keep-email lezin.menath@cloudifyops.com --yes
"""
from __future__ import annotations

import argparse
import os
import sys

from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

WIPE = [
    "assessments", "findings", "milestones", "resource_inventory", "resources",
    "remediations", "remediation_statuses", "cloud_accounts", "checks",
    "best_practices", "rules", "integrations", "alert_logs", "repositories",
    "jira_tickets", "scheduled_assessments", "questionnaire_responses",
    "assessment_compliance_scores",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep-email", required=True, help="The one user to keep.")
    ap.add_argument("--yes", action="store_true", help="Actually delete.")
    ap.add_argument("--i-know-this-is-not-prod", action="store_true",
                    help="Allow a MONGO_URI other than the dev Mongo on :27018.")
    args = ap.parse_args()

    if ":27018" not in MONGO_URI and not args.i_know_this_is_not_prod:
        sys.exit(f"REFUSING: MONGO_URI={MONGO_URI} is not the dev Mongo (:27018).")

    db = MongoClient(MONGO_URI, serverSelectionTimeoutMS=4000)[DB_NAME]
    keep = args.keep_email.strip().lower()
    user = db["users"].find_one({"email": keep}, {"_id": 0, "id": 1})
    if not user:
        sys.exit(f"REFUSING: user {keep} not found in {DB_NAME}; nothing deleted.")

    existing = set(db.list_collection_names())
    print(f"Target: {MONGO_URI}/{DB_NAME}  keep user: {keep} ({user['id']})")
    for name in WIPE:
        n = db[name].count_documents({}) if name in existing else 0
        print(f"  {'wipe' if args.yes else 'would wipe'} {name:30s} {n}")
    n_users = db["users"].count_documents({"email": {"$ne": keep}})
    print(f"  {'delete' if args.yes else 'would delete'} {n_users} other user(s)")

    if not args.yes:
        print("\nDry run. Re-run with --yes to delete.")
        return

    for name in WIPE:
        if name in existing:
            db[name].delete_many({})
    db["users"].delete_many({"email": {"$ne": keep}})
    db["users"].update_one({"email": keep}, {"$set": {
        "costUsage": 0, "tokenUsage": 0, "projects": [], "lastActive": "",
    }})
    db["pillars"].update_many({}, {"$set": {"score": 0}, "$unset": {"bestPractices": ""}})
    print("\n[OK] Dev DB reset. Now run check_engine.py and load_assessment_to_db.py --real-only.")


if __name__ == "__main__":
    main()
