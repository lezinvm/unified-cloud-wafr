"""
Load real check-engine results into MongoDB so the frontend shows actual
findings instead of seeded demo data.

Maps one `assessment_result_<provider>.json` (produced by check_engine.py) into
the existing `assessments`, `findings`, and `cloud_accounts` collections,
following the exact document shapes used by seed_master.py / the API.

It is idempotent: every doc is upserted by its string `id`, so re-running after
a fresh scan just refreshes the same assessment + findings.

Usage:
    # 1. fetch -> 2. assess -> 3. load
    python check_engine.py --provider gcp --data mcp_fetch/gcp_fetch_result.json
    python load_assessment_to_db.py --result assessment_result_gcp.json \
        --user-id usr-09 --org-id org_01

Options:
    --result     path to the engine output JSON (default assessment_result_gcp.json)
    --user-id    owner user_id for isolation (default usr-09, the demo user)
    --org-id     owner org_id for isolation (default org_01)
    --dry-run    print what would be written without touching the DB
"""
from __future__ import annotations

import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")
HERE = Path(__file__).parent
NOW = datetime.now(timezone.utc).isoformat()

# Engine pillar name (Title-case) -> UI pillar slug + display name.
PILLAR_MAP = {
    "security": ("security", "Security"),
    "reliability": ("reliability", "Reliability"),
    "cost": ("cost", "Cost Optimization"),
    "performance": ("performance", "Performance Efficiency"),
    "operations": ("operations", "Operational Excellence"),
    "operational excellence": ("operations", "Operational Excellence"),
    "sustainability": ("operations", "Operational Excellence"),
}
PILLAR_SLUGS = ["security", "reliability", "cost", "operations", "performance"]

# Engine severity (UPPERCASE) -> finding severity (lowercase; schema has only
# high/medium/low, so CRITICAL folds into high) + a risk label.
SEV_MAP = {
    "CRITICAL": ("high", "Critical Risk"),
    "HIGH": ("high", "High Risk"),
    "MEDIUM": ("medium", "Medium Risk"),
    "LOW": ("low", "Low Risk"),
}

# Which engine verdicts become real findings. UNKNOWN / NOT_APPLICABLE /
# NOT_IMPLEMENTED are NOT pass/fail facts, so they are not written as findings
# (they'd distort scores and the findings schema has no such state). They are
# still counted for transparency in the assessment doc.
FINDING_VERDICTS = {"FAIL", "PASS"}


def pillar_of(control: dict) -> tuple[str, str]:
    raw = (control.get("pillar") or "security").strip().lower()
    return PILLAR_MAP.get(raw, ("security", "Security"))


def severity_of(control: dict) -> tuple[str, str]:
    return SEV_MAP.get((control.get("severity") or "MEDIUM").upper(), ("medium", "Medium Risk"))


def ensure_cloud_account(db, provider: str, scope: str, user_id: str, org_id: str, dry: bool):
    """Make sure a cloud_account exists for this scope so /api/assessments
    isolation+reconciliation will surface the assessment."""
    existing = db["cloud_accounts"].find_one({"id": scope})
    if existing:
        return existing["id"]
    doc = {
        "id": scope,
        "cloud": provider,
        "account_name": scope,
        "account_identifier": scope,
        "auth_type": "service-account" if provider == "gcp" else "role",
        "default_region": "us-central1" if provider == "gcp" else "us-east-1",
        "status": "connected",
        "is_active": True,
        "is_global": False,
        "user_id": user_id,
        "org_id": org_id,
        "last_connected_at": NOW,
        "created_at": NOW,
    }
    if provider == "gcp":
        doc["gcp_project"] = scope
    if not dry:
        db["cloud_accounts"].update_one({"id": scope}, {"$set": doc}, upsert=True)
    print(f"  [cloud_account] ensured '{scope}' ({provider})")
    return scope


def build_assessment(provider: str, scope: str, controls: list[dict],
                     user_id: str, org_id: str, fetched_at: str | None) -> tuple[dict, list[dict]]:
    """Produce one assessment doc + its findings docs from the per-scope results."""
    asm_id = f"A-{provider.upper()}-{scope}"
    findings: list[dict] = []

    # Per-pillar tallies for pillar_scores / pillar_high_risks.
    pillar_total = {s: 0 for s in PILLAR_SLUGS}
    pillar_pass = {s: 0 for s in PILLAR_SLUGS}
    pillar_high = {s: 0 for s in PILLAR_SLUGS}

    counts = {"FAIL": 0, "PASS": 0, "UNKNOWN": 0, "NOT_APPLICABLE": 0, "NOT_IMPLEMENTED": 0}
    high = medium = low = 0

    for ctrl in controls:
        res = (ctrl.get("results") or {}).get(scope)
        if not res:
            continue
        verdict = res.get("verdict", "NOT_IMPLEMENTED")
        counts[verdict] = counts.get(verdict, 0) + 1

        pslug, pname = pillar_of(ctrl)
        sev, risk = severity_of(ctrl)

        # Only PASS/FAIL controls count toward score + become findings.
        if verdict in FINDING_VERDICTS:
            pillar_total[pslug] += 1
            if verdict == "PASS":
                pillar_pass[pslug] += 1

        if verdict == "FAIL":
            if sev == "high":
                high += 1
                pillar_high[pslug] += 1
            elif sev == "medium":
                medium += 1
            else:
                low += 1

            failing = [r for r in res.get("resources", []) if r.get("status") == "FAIL"]
            evidence = "; ".join(r.get("evidence", "") for r in failing[:6]) or ctrl.get("title", "")
            resources = [r.get("resource") for r in failing if r.get("resource")]
        elif verdict == "PASS":
            evidence = "Compliant per live scan."
            resources = [r.get("resource") for r in res.get("resources", []) if r.get("resource")]
        else:
            # UNKNOWN / NOT_APPLICABLE / NOT_IMPLEMENTED -> not a finding.
            continue

        findings.append({
            "id": f"FND-{asm_id}-{ctrl['control_id']}",
            "assessment_id": asm_id,
            "check_id": ctrl["control_id"],
            "cloud": provider,
            "pillar_id": pslug,
            "pillar": pname,
            "severity": sev,
            "title": ctrl.get("title", ctrl["control_id"]),
            "description": evidence,
            "status": "fail" if verdict == "FAIL" else "pass",
            "effort": "Medium Effort",
            "risk": risk,
            "resources": resources,
            # framework mappings carried through for compliance scoring later
            "cis_gcp": ctrl.get("cis_gcp"),
            "cis_aws": ctrl.get("cis_aws"),
            "cis_azure": ctrl.get("cis_azure"),
            "soc2_ids": ctrl.get("soc2_ids"),
            "iso27001_ids": ctrl.get("iso27001_ids"),
            "hipaa_ids": ctrl.get("hipaa_ids"),
            "created_at": NOW,
            "updated_at": NOW,
        })

    total_scored = counts["FAIL"] + counts["PASS"]
    passed = counts["PASS"]
    failed = counts["FAIL"]
    score = round((passed / total_scored) * 100) if total_scored else 0

    pillar_scores = {}
    for s in PILLAR_SLUGS:
        pillar_scores[s] = round((pillar_pass[s] / pillar_total[s]) * 100) if pillar_total[s] else 0

    assessment = {
        "id": asm_id,
        "name": f"{provider.upper()} Live Well-Architected Review — {scope}",
        "cloud": provider,
        "cloud_account_id": scope,
        "account_name": scope,
        "account_identifier": scope,
        "region": "us-central1" if provider == "gcp" else "us-east-1",
        "lens": {
            "gcp": "google-cloud-architecture-framework",
            "aws": "aws-well-architected",
            "azure": "azure-well-architected",
        }.get(provider, "well-architected"),
        "status": "FAIL" if failed > 0 else "COMPLETED",
        "score": score,
        "checks_count": total_scored,
        "total_checks": total_scored,
        "passed_checks": passed,
        "failed_checks": failed,
        "total_best_practices": len(PILLAR_SLUGS),
        "passed_bps": sum(1 for s in PILLAR_SLUGS if pillar_scores[s] >= 70),
        "failed_bps": sum(1 for s in PILLAR_SLUGS if pillar_total[s] and pillar_scores[s] < 70),
        "high_risks": high,
        "medium_risks": medium,
        "low_risks": low,
        "pillar_scores": pillar_scores,
        "pillar_high_risks": pillar_high,
        # transparency: non-pass/fail controls recorded but not scored
        "unknown_controls": counts["UNKNOWN"],
        "not_applicable_controls": counts["NOT_APPLICABLE"],
        "not_implemented_controls": counts["NOT_IMPLEMENTED"],
        "rerun_count": 0,
        "is_global": False,
        "user_id": user_id,
        "org_id": org_id,
        "source": "live-scan",
        "last_run_at": fetched_at or NOW,
        "created_at": NOW,
        "updated_at": NOW,
    }
    return assessment, findings


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--result", default=str(HERE / "assessment_result_gcp.json"))
    ap.add_argument("--user-id", default="usr-09")
    ap.add_argument("--org-id", default="org_01")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    result = json.loads(Path(args.result).read_text(encoding="utf-8"))
    provider = result["provider"]
    controls = result["controls"]
    fetched_at = (result.get("generatedFrom") or {}).get("fetchedAt")

    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]

    print(f"Loading {provider} results from {args.result}")
    print(f"Target: {MONGO_URI}/{DB_NAME}  (dry-run={args.dry_run})")

    for scope in result["scopes"]:
        print(f"\nScope: {scope}")
        ensure_cloud_account(db, provider, scope, args.user_id, args.org_id, args.dry_run)
        assessment, findings = build_assessment(
            provider, scope, controls, args.user_id, args.org_id, fetched_at)

        print(f"  [assessment] {assessment['id']}  score={assessment['score']}  "
              f"status={assessment['status']}  pass={assessment['passed_checks']} "
              f"fail={assessment['failed_checks']}  findings={len(findings)}")
        print(f"             unknown={assessment['unknown_controls']} "
              f"n/a={assessment['not_applicable_controls']} "
              f"not_impl={assessment['not_implemented_controls']}")

        if args.dry_run:
            continue

        db["assessments"].update_one({"id": assessment["id"]}, {"$set": assessment}, upsert=True)
        # Replace this assessment's findings so re-runs don't accumulate stale ones.
        db["findings"].delete_many({"assessment_id": assessment["id"]})
        if findings:
            db["findings"].insert_many(findings)

    if not args.dry_run:
        print("\n[OK] Loaded into MongoDB.")
    else:
        print("\n[DRY RUN] Nothing written.")


if __name__ == "__main__":
    main()
