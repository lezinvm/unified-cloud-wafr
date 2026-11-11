"""
Targeted live check verification runner.
Runs a live cloud fetch for ONLY the resources needed by a specific check,
evaluates the check rule, and returns whether the resource is actually fixed.
"""
from __future__ import annotations

import asyncio
import csv
import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

HERE = Path(__file__).parent
CATALOG_CSV = HERE / "seed_data" / "control_catalog.csv"
FETCH_DIR = HERE / "mcp_fetch"

# Mapping of check IDs or prefixes to targeted GCP services
CHECK_SERVICES_MAP: Dict[str, List[str]] = {
    # IAM checks
    "IAM-01": ["iam_service_accounts", "project_iam_policy"],
    "IAM-02": ["iam_service_accounts", "iam_roles_custom", "project_iam_policy"],
    "IAM-03": ["iam_service_accounts", "iam_service_account_keys"],
    "IAM-04": ["iam_service_accounts", "iam_service_account_keys"],
    "IAM-05": ["iam_service_accounts", "project_iam_policy"],
    "IAM-06": ["project_iam_policy"],
    "IAM-07": ["essential_contacts"],

    # Storage & Data checks
    "DAT-01": ["storage_buckets", "storage_buckets_detailed", "kms_crypto_keys"],
    "DAT-02": ["storage_buckets", "storage_buckets_detailed"],
    "DAT-03": ["sql_instances"],
    "DAT-04": ["sql_instances"],
    "DAT-05": ["storage_buckets", "storage_buckets_detailed"],
    "DAT-06": ["storage_buckets", "storage_buckets_detailed"],
    "DAT-07": ["compute_disks", "kms_crypto_keys"],
    "DAT-08": ["storage_buckets", "storage_buckets_detailed"],

    # Network checks
    "NET-01": ["firewall_rules"],
    "NET-02": ["firewall_rules"],
    "NET-03": ["subnets"],
    "NET-04": ["networks_vpc"],
    "NET-05": ["routes"],
    "NET-06": ["firewall_rules"],
    "NET-07": ["firewall_rules"],
    "NET-08": ["security_policies"],
    "NET-09": ["subnets"],
    "NET-10": ["networks_vpc"],
    "NET-11": ["security_policies"],

    # Cost & Compute checks
    "CST-01": ["compute_instances"],
    "CST-02": ["compute_instances", "compute_disks"],
    "CST-03": ["compute_disks"],
    "CST-04": ["sql_instances", "sql_backups"],
    "CST-05": ["compute_images"],
    "CST-06": ["compute_instances"],
    "CST-07": ["compute_instance_templates"],

    # Application & Resiliency checks
    "APP-01": ["compute_instances"],
    "APP-02": ["compute_instances", "compute_disks"],
    "APP-03": ["compute_instances", "addresses_static_ip"],
    "APP-04": ["compute_instances"],
    "APP-05": ["gke_clusters"],
    "APP-06": ["gke_clusters"],
    "APP-07": ["forwarding_rules", "backend_services"],
    "APP-08": ["ssl_policies", "target_proxies_https"],
    "APP-09": ["forwarding_rules", "backend_services"],
    "APP-10": ["backend_buckets", "url_maps"],

    # Logging & Monitoring checks
    "LOG-01": ["project_iam_policy"],
    "LOG-02": ["logging_sinks"],
    "LOG-03": ["logging_buckets"],
    "LOG-04": ["logging_metrics"],
    "LOG-05": ["dns_zones"],

    # Security & KMS
    "SEC-01": ["gke_clusters"],
    "SEC-02": ["gke_clusters"],
    "SEC-03": ["gke_clusters"],
    "SEC-04": ["kms_crypto_keys"],
    "SEC-05": ["kms_crypto_keys"],
    "SEC-06": ["kms_crypto_keys"],
    "SEC-07": ["secrets"],

    # Resiliency / Functions
    "RES-01": ["cloud_functions"],
    "RES-02": ["cloud_functions"],
    "RES-03": ["storage_buckets", "storage_buckets_detailed"],
    "RES-04": ["cloud_functions"],

    # Messaging
    "MSG-01": ["pubsub_topics", "pubsub_topics_detailed", "kms_crypto_keys"],
    "MSG-02": ["pubsub_topics", "pubsub_topics_detailed"],
    "MSG-03": ["pubsub_subscriptions"],
}


def get_services_for_check(check_id: str) -> List[str]:
    cid = check_id.strip().upper()
    if cid in CHECK_SERVICES_MAP:
        return CHECK_SERVICES_MAP[cid]
    prefix = cid.split("-")[0]
    prefix_fallbacks: Dict[str, List[str]] = {
        "IAM": ["iam_service_accounts", "project_iam_policy", "iam_service_account_keys"],
        "DAT": ["storage_buckets", "storage_buckets_detailed", "sql_instances", "sql_backups"],
        "NET": ["firewall_rules", "networks_vpc", "subnets", "routes"],
        "CST": ["compute_instances", "compute_disks", "sql_instances", "sql_backups"],
        "APP": ["compute_instances", "gke_clusters", "forwarding_rules"],
        "LOG": ["logging_buckets", "logging_sinks", "logging_metrics"],
        "MSG": ["pubsub_topics", "pubsub_topics_detailed", "pubsub_subscriptions"],
        "SEC": ["kms_crypto_keys", "secrets", "gke_clusters"],
        "RES": ["cloud_functions", "storage_buckets", "storage_buckets_detailed"],
    }
    return prefix_fallbacks.get(prefix, ["iam_service_accounts", "storage_buckets", "compute_instances"])


def load_control_catalog() -> Dict[str, Dict[str, Any]]:
    if not CATALOG_CSV.exists():
        return {}
    catalog = {}
    with open(CATALOG_CSV, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            catalog[row["control_id"]] = row
    return catalog


async def run_targeted_fetch(prov: Any, scope: str, services: List[str], fetch_file: Path) -> None:
    """Run the provider's fetcher for only the services this check needs."""
    cmd = prov.fetch_cmd(scope, fetch_file, services)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=str(FETCH_DIR),
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=os.environ.copy(),
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=120)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise RuntimeError("Targeted cloud resource fetch timed out after 2 minutes.")

    if proc.returncode != 0:
        err_msg = stderr.decode("utf-8", errors="replace") or stdout.decode("utf-8", errors="replace")
        raise RuntimeError(f"Cloud fetch error: {err_msg[:200]}")


async def rerun_single_check(
    db: Any,
    assessment_id: str,
    check_id: str,
    resource_arn: Optional[str] = None,
    user_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Execute live check rerun against real cloud infrastructure."""
    try:
        from backend import scan_providers
        from backend.checks import get_provider
    except ModuleNotFoundError:
        import scan_providers
        from checks import get_provider

    asm = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0})
    if not asm:
        raise ValueError(f"Assessment '{assessment_id}' not found.")

    prov_name = (asm.get("cloud") or "gcp").lower()
    prov = scan_providers.get(prov_name)
    provider_registry = get_provider(prov_name)
    if not prov.can_scan:
        raise ValueError(f"Live re-checks are not available for {prov.label} yet.")
    acct = await db["cloud_accounts"].find_one({"id": asm.get("cloud_account_id")}, {"_id": 0}) or {}
    scope = prov.account_scope(acct) or asm.get("account_identifier") or ""
    if not prov.valid_scope(scope):
        raise ValueError(f"Assessment has no valid {prov.label} {prov.scope_label} id (got '{scope}').")

    catalog = load_control_catalog()
    ctrl = catalog.get(check_id.upper()) or {}
    tokens_str = ctrl.get(provider_registry.catalog_column, "") if provider_registry else ctrl.get(f"{prov_name}_checks", "")
    tokens = [t.strip() for t in tokens_str.split(";") if t.strip()]

    # 1. Fetch targeted live data from the cloud
    services_to_fetch = get_services_for_check(check_id)
    # Partial fetch goes to its own temp file: it must never replace the
    # stored full fetch of this scope.
    try:
        from backend.scan_runner import RUN_DIR
    except ModuleNotFoundError:
        from scan_runner import RUN_DIR
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    fetch_file = RUN_DIR / f"recheck-{uuid.uuid4().hex[:10]}.json"
    try:
        await run_targeted_fetch(prov, scope, services_to_fetch, fetch_file)
        # 2. Run the real check against freshly fetched data
        if not fetch_file.exists():
            raise RuntimeError("Fetch output file missing after live fetch.")
        with open(fetch_file, encoding="utf-8") as f:
            fetched_data = json.load(f)
    finally:
        if fetch_file.exists():
            fetch_file.unlink()

    # Same region scope as the assessment (account-wide items always included).
    if asm.get("regions"):
        fetched_data = prov.filter_regions(fetched_data, scope, list(asm["regions"]))
    scope_data = (fetched_data.get(prov.scope_key) or {}).get(scope) or {}
    live_services = scope_data.get("services", {})

    provider_registry = get_provider(prov_name)
    raw_results = []
    for tok in tokens:
        fn = provider_registry.get(tok)
        if fn:
            raw_results.extend(fn(live_services))

    # Evaluate verdict
    now_iso = datetime.now(timezone.utc).isoformat()
    failing_results = [r for r in raw_results if r.get("status") == "FAIL"]
    passing_results = [r for r in raw_results if r.get("status") == "PASS"]

    # Check if a specific resource was targeted
    passed = False
    evidence = ""

    if resource_arn:
        target_norm = resource_arn.lower().strip()
        matching_fail = [r for r in failing_results if target_norm in r.get("resource", "").lower() or r.get("resource", "").lower() in target_norm]
        matching_pass = [r for r in passing_results if target_norm in r.get("resource", "").lower() or r.get("resource", "").lower() in target_norm]

        if matching_fail:
            passed = False
            evidence = matching_fail[0].get("evidence", "Resource failed compliance check.")
        elif matching_pass or len(failing_results) == 0:
            passed = True
            evidence = matching_pass[0].get("evidence", "Resource verified compliant in live cloud.") if matching_pass else "Resource compliant."
        else:
            passed = False
            evidence = "Resource state could not be verified compliant."
    else:
        # Check-level rerun across all impacted resources
        if len(failing_results) == 0 and (len(passing_results) > 0 or len(raw_results) == 0):
            passed = True
            evidence = "All resources verified compliant per live cloud scan."
        else:
            passed = False
            evidence = "; ".join(r.get("evidence", "") for r in failing_results[:3]) or "Unmet security configuration requirements detected."

    # 3. Update database based on REAL result
    status_key = f"{assessment_id}::{check_id}::{resource_arn or '__check_level__'}"
    if passed:
        # Mark remediation status as fixed
        await db["remediation_statuses"].update_one(
            {"key": status_key},
            {
                "$set": {
                    "key": status_key,
                    "assessment_id": assessment_id,
                    "check_id": check_id,
                    "resource_raw": resource_arn or "__check_level__",
                    "status": "fixed",
                    "note": f"Live verification passed: {evidence}",
                    "user_id": user_id or asm.get("user_id", "usr-01"),
                    "updated_at": now_iso,
                }
            },
            upsert=True,
        )

        # If overall check has no more failing resources, update finding and check records
        if len(failing_results) == 0:
            await db["findings"].update_one(
                {"assessment_id": assessment_id, "check_id": check_id},
                {"$set": {"status": "pass", "description": evidence, "updated_at": now_iso}},
            )
            await db["checks"].update_one(
                {"assessment_id": assessment_id, "id": check_id},
                {"$set": {"status": "pass", "description": evidence}},
            )

        # Recalculate assessment metrics
        all_findings = await db["findings"].find({"assessment_id": assessment_id}).to_list(300)
        failing_count = sum(1 for f in all_findings if f.get("status") == "fail")
        total_checks = asm.get("total_checks", len(all_findings) or 46)
        passed_count = max(0, total_checks - failing_count)
        new_score = min(100, max(50, round((passed_count / max(1, total_checks)) * 100)))

        await db["assessments"].update_one(
            {"id": assessment_id},
            {
                "$set": {
                    "score": new_score,
                    "passed_checks": passed_count,
                    "failed_checks": failing_count,
                    "updated_at": now_iso,
                }
            },
        )

        return {
            "passed": True,
            "status": "fixed",
            "evidence": evidence,
            "message": f"Live check passed: {evidence}",
            "updated_score": new_score,
        }
    else:
        # DO NOT mark as fixed! Keep as failing
        await db["remediation_statuses"].update_one(
            {"key": status_key},
            {
                "$set": {
                    "key": status_key,
                    "assessment_id": assessment_id,
                    "check_id": check_id,
                    "resource_raw": resource_arn or "__check_level__",
                    "status": "fail",
                    "note": f"Live check verified non-compliant: {evidence}",
                    "user_id": user_id or asm.get("user_id", "usr-01"),
                    "updated_at": now_iso,
                }
            },
            upsert=True,
        )

        return {
            "passed": False,
            "status": "fail",
            "evidence": evidence,
            "message": f"Live check still failing: {evidence}",
        }
