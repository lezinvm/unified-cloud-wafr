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


# Sub-resource keys the fetcher builds from a parent list; asking for the
# child alone would return an empty (and falsely "compliant") list.
DERIVED_FROM = {
    "iam_service_account_keys": "iam_service_accounts",
    "storage_buckets_detailed": "storage_buckets",
    "sql_backups": "sql_instances",
    "pubsub_topics_detailed": "pubsub_topics",
}


class _ReadTracker(dict):
    """Services dict that records every key a check function reads."""

    def __init__(self, data: dict):
        super().__init__(data)
        self.read: set = set()

    def get(self, key, default=None):
        self.read.add(key)
        return super().get(key, default)

    def __getitem__(self, key):
        self.read.add(key)
        return super().__getitem__(key)

    def __contains__(self, key):
        self.read.add(key)
        return super().__contains__(key)


def services_read_by(fns: list, sample_services: dict) -> List[str]:
    """Exact service keys the check functions read, found by running them on
    the last full fetch of this scope (and on empty data, for early exits)."""
    keys: set = set()
    for data in (sample_services or {}, {}):
        for fn in fns:
            t = _ReadTracker(data)
            try:
                fn(t)
            except Exception:  # noqa: BLE001 - only the keys read matter here
                pass
            keys |= t.read
    keys |= {DERIVED_FROM[k] for k in keys if k in DERIVED_FROM}
    return sorted(keys)


def get_services_for_check(check_id: str) -> List[str]:
    """Legacy hand-written map. Not used for re-checks any more (it missed most
    controls); kept for reference."""
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

    fns = [f for f in (provider_registry.get(t) for t in tokens) if f]
    if not fns:
        return _unverified(f"No automated {prov.label} check exists for {check_id}; it can't be re-checked.")

    # 1. Fetch exactly the services these check functions read.
    sample = {}
    try:
        stored = json.loads(prov.fetch_path(scope).read_text(encoding="utf-8"))
        sample = ((stored.get(prov.scope_key) or {}).get(scope) or {}).get("services", {})
    except (OSError, ValueError):
        pass
    services_to_fetch = services_read_by(fns, sample)
    if not services_to_fetch:
        return _unverified(f"Could not tell which cloud data {check_id} needs. Run a full scan.")
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


    now_iso = datetime.now(timezone.utc).isoformat()
    who = user_id or asm.get("user_id")

    # ---- Guard 1: the fresh data must really have been read. ----------------
    # A service that is missing or blocked returns no items, and "no items"
    # must never be read as "fixed".
    unread = [k for k in services_to_fetch
              if not (isinstance(live_services.get(k), dict) and live_services[k].get("ok"))]
    if unread:
        return _unverified(f"Could not read {', '.join(unread)} from the cloud just now, so nothing was "
                           f"changed. Try again, or run a full scan.")

    # ---- Run the real check functions on the fresh data. --------------------
    results = []
    for fn in fns:
        results.extend(fn(live_services))

    def same(a: str, b: str) -> bool:
        a, b = (a or "").strip().lower(), (b or "").strip().lower()
        return bool(a) and (a == b or a.rsplit("/", 1)[-1] == b.rsplit("/", 1)[-1])

    fails = [r for r in results if r.get("status") == "FAIL"]
    unknown = [r for r in results if r.get("status") not in ("PASS", "FAIL")]

    if resource_arn:
        mine = [r for r in results if same(r.get("resource", ""), resource_arn)]
        if not mine:
            return _unverified(f"'{resource_arn}' was not found in the live data. If you deleted it, "
                               f"run a full scan to confirm.")
        if any(r.get("status") == "FAIL" for r in mine):
            ev = next(r for r in mine if r.get("status") == "FAIL").get("evidence", "")
            await _status(db, assessment_id, check_id, resource_arn, "fail", f"Live re-check: still failing. {ev}", who, now_iso)
            return {"passed": False, "status": "fail", "evidence": ev, "message": f"Still failing: {ev}"}
        if any(r.get("status") != "PASS" for r in mine):
            return _unverified(f"The live data isn't enough to judge '{resource_arn}'.")
        ev = mine[0].get("evidence", "")
        await _status(db, assessment_id, check_id, resource_arn, "fixed", f"Live re-check passed: {ev}", who, now_iso)
        out = {"passed": True, "status": "fixed", "evidence": ev, "message": f"Verified in the live cloud: {ev}"}
        if not fails and not unknown:  # the last failing resource of this check was fixed
            out["updated_score"] = await _mark_check_passed(db, assessment_id, check_id, now_iso)
        return out

    # Check-level re-check: every resource must pass.
    if not results:
        return _unverified("No resources for this check were found in the live data. Run a full scan to confirm.")
    if fails:
        ev = "; ".join(r.get("evidence", "") for r in fails[:3])
        await _status(db, assessment_id, check_id, None, "fail", f"Live re-check: still failing. {ev}", who, now_iso)
        return {"passed": False, "status": "fail", "evidence": ev,
                "message": f"{len(fails)} resource(s) still failing: {ev}"}
    if unknown:
        return _unverified("The live data isn't enough to judge every resource of this check.")
    await _status(db, assessment_id, check_id, None, "fixed", "Live re-check passed: all resources compliant.", who, now_iso)
    return {"passed": True, "status": "fixed", "evidence": "All resources compliant.",
            "message": f"Verified in the live cloud: all {len(results)} resource(s) compliant.",
            "updated_score": await _mark_check_passed(db, assessment_id, check_id, now_iso)}


def _unverified(msg: str) -> Dict[str, Any]:
    """Could not decide from live data: nothing is changed in the database."""
    return {"passed": False, "status": "unverified", "evidence": msg, "message": msg}


async def _status(db, assessment_id, check_id, resource, status, note, user_id, now_iso) -> None:
    raw = resource or "__check_level__"
    key = f"{assessment_id}::{check_id}::{raw}"
    await db["remediation_statuses"].update_one({"key": key}, {"$set": {
        "key": key, "assessment_id": assessment_id, "check_id": check_id, "resource_raw": raw,
        "status": status, "note": note, "source": "live-recheck", "user_id": user_id, "updated_at": now_iso,
    }}, upsert=True)


async def _mark_check_passed(db, assessment_id: str, check_id: str, now_iso: str) -> int:
    """Every resource of the check now passes in the live cloud."""
    await _status(db, assessment_id, check_id, None, "fixed",
                  "Live re-check passed: all resources compliant.", None, now_iso)
    return await apply_verified_fix(db, assessment_id, check_id, now_iso)


async def apply_verified_fix(db, assessment_id: str, check_id: str, now_iso: str) -> int:
    """Record a control that a live re-check verified as passing, and recompute
    every number a full scan produces, with the same formulas as the loader:
    score, pass/fail counts, pillar scores, best practices, compliance.
    Same code for every cloud and lens (all of them derive from control verdicts)."""
    try:
        from backend import compliance, scan_providers
        from backend.load_assessment_to_db import PILLAR_IDS, PILLAR_ALIASES, compliance_summary
    except ModuleNotFoundError:
        import compliance
        import scan_providers
        from load_assessment_to_db import PILLAR_IDS, PILLAR_ALIASES, compliance_summary

    note = "Verified compliant by a live re-check."
    q = {"assessment_id": assessment_id}
    await db["findings"].update_one({**q, "check_id": check_id},
                                    {"$set": {"status": "pass", "description": note, "updated_at": now_iso}})
    await db["checks"].update_one({**q, "id": check_id}, {"$set": {"status": "pass", "description": note}})
    # Kept (the page showing it stays valid) but flagged; the next scan drops it.
    await db["remediations"].update_many({**q, "check_id": check_id},
                                         {"$set": {"resolved": True, "resolved_at": now_iso}})

    checks = await db["checks"].find(q, {"_id": 0, "status": 1, "pillar_id": 1,
                                         "best_practice_id": 1}).to_list(2000)
    passed = sum(1 for c in checks if c.get("status") == "pass")
    failed = sum(1 for c in checks if c.get("status") == "fail")
    score = round(passed / (passed + failed) * 100) if passed + failed else 0

    pillar_scores = {}
    for p in PILLAR_IDS:
        mine = [c for c in checks if c.get("pillar_id") == p]
        ok = sum(1 for c in mine if c.get("status") == "pass")
        pillar_scores[p] = round(ok / len(mine) * 100) if mine else 0
    for full, alias in PILLAR_ALIASES.items():
        pillar_scores[alias] = pillar_scores[full]

    # A best practice passes when all its checks pass.
    by_bp: dict = {}
    for c in checks:
        by_bp.setdefault(c.get("best_practice_id"), []).append(c.get("status"))
    for bp_id, sts in by_bp.items():
        if bp_id:
            await db["best_practices"].update_one(
                {**q, "id": bp_id}, {"$set": {"status": "fail" if "fail" in sts else "pass"}})
    bps = await db["best_practices"].find(q, {"_id": 0, "status": 1}).to_list(1000)
    failed_bps = sum(1 for b in bps if b.get("status") == "fail")

    a = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0}) or {}
    update = {"score": score, "passed_checks": passed, "failed_checks": failed,
              "pillar_scores": pillar_scores, "passed_bps": len(bps) - failed_bps,
              "failed_bps": failed_bps, "status": "FAIL" if failed else "COMPLETED", "updated_at": now_iso}

    # Compliance: same control verdicts -> same scoring as the scan.
    results = a.get("control_results")
    if isinstance(results, list) and results:
        for r in results:
            if r.get("control_id") == check_id:
                r["verdict"], r["failing_resources"] = "PASS", 0
        prov = scan_providers.get(a.get("cloud") or "")
        scores = compliance.build_scores(prov.name, prov.label, assessment_id, results, now_iso)
        await db["assessment_compliance_scores"].delete_many(q)
        if scores:
            await db["assessment_compliance_scores"].insert_many([dict(s) for s in scores])
        update["control_results"] = results
        update["compliance_summary"] = compliance_summary(scores)
    await db["assessments"].update_one({"id": assessment_id}, {"$set": update})
    return score
