"""
Load real check-engine results into MongoDB.

Maps one `assessment_result_<provider>.json` (from check_engine.py) plus the raw
fetch JSON into the collections the API serves to the frontend:

  always written (scoped to this assessment, idempotent replace):
    cloud_accounts      the scanned scope (project/account/subscription)
    assessments         scores and counts computed from PASS/FAIL controls
    findings            one per PASS/FAIL control, with real evidence + resources
    resource_inventory  the real resources from the fetch JSON
    milestones          a baseline milestone for this scan
    remediations        one per FAILING control: real failing resources +
                        authored fix guidance (remediation_guidance.py,
                        tagged guidance_source="authored")

  only with --real-only (dev / real-data-only environments):
    checks, best_practices, pillar scores are REPLACED for this cloud with the
    real WAFR structure (pillar -> domain best practice -> control check), so
    the report's pillar/best-practice/check views show real results.
    Remediations for this cloud that this scan didn't produce are removed.

Usage:
    python check_engine.py --provider gcp
    python load_assessment_to_db.py --result assessment_result_gcp.json \
        --user-id usr-09 --org-id org_01 [--real-only] [--dry-run]
"""
from __future__ import annotations

import argparse
import csv
import json
import os
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from pymongo import MongoClient

from remediation_guidance import GUIDANCE, render_cli

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")
HERE = Path(__file__).parent
NOW = datetime.now(timezone.utc).isoformat()

# Catalog pillar label -> (UI pillar id, display label). The UI's pillar ids
# come from the `pillars` collection (reliability, security, cost,
# operational-excellence, performance-efficiency). The UI has no Sustainability
# pillar, so those controls are shown under Cost Optimization.
PILLAR_MAP = {
    "security": ("security", "Security"),
    "reliability": ("reliability", "Reliability"),
    "cost optimization": ("cost", "Cost Optimization"),
    "cost": ("cost", "Cost Optimization"),
    "sustainability": ("cost", "Cost Optimization"),
    "operational excellence": ("operational-excellence", "Operational Excellence"),
    "operations": ("operational-excellence", "Operational Excellence"),
    "performance efficiency": ("performance-efficiency", "Performance Efficiency"),
    "performance": ("performance-efficiency", "Performance Efficiency"),
}
PILLAR_IDS = ["reliability", "security", "cost", "operational-excellence", "performance-efficiency"]
# Older code paths read short keys; write both so every reader gets real values.
PILLAR_ALIASES = {"operational-excellence": "operations", "performance-efficiency": "performance"}

# Finding severity is lowercase high/medium/low (CRITICAL folds into high, as
# the findings API expects). Checks/remediations keep 'critical'.
SEV_MAP = {
    "CRITICAL": ("high", "critical", "Critical Risk"),
    "HIGH": ("high", "high", "High Risk"),
    "MEDIUM": ("medium", "medium", "Medium Risk"),
    "LOW": ("low", "low", "Low Risk"),
}

FINDING_VERDICTS = {"FAIL", "PASS"}

# Fetch service key -> inventory resource "type".
INVENTORY_TYPES = {
    "compute_instances": "compute_instance",
    "compute_disks": "compute_disk",
    "storage_buckets": "storage_bucket",
    "networks_vpc": "vpc_network",
    "subnets": "subnet",
    "firewall_rules": "firewall_rule",
    "cloud_functions": "cloud_function",
    "cloud_run_services": "cloud_run_service",
    "pubsub_topics": "pubsub_topic",
    "sql_instances": "sql_instance",
    "gke_clusters": "gke_cluster",
    "secrets": "secret",
    "iam_service_accounts": "service_account",
    "addresses_static_ip": "static_ip",
}


def short(v) -> str:
    return v.rsplit("/", 1)[-1] if isinstance(v, str) else str(v)


def pillar_of(control: dict) -> tuple[str, str]:
    raw = (control.get("pillar") or "security").strip().lower()
    return PILLAR_MAP.get(raw, ("security", "Security"))


def severity_of(control: dict) -> tuple[str, str, str]:
    return SEV_MAP.get((control.get("severity") or "MEDIUM").upper(), ("medium", "medium", "Medium Risk"))


def load_catalog(path: Path) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        return {r["control_id"]: r for r in csv.DictReader(f)}


def scope_services(fetch: dict, scope: str) -> dict:
    scopes = fetch.get("projects") or fetch.get("accounts") or fetch.get("subscriptions") or {}
    return (scopes.get(scope) or {}).get("services", {})


def items(services: dict, key: str) -> list:
    svc = services.get(key)
    if not svc or not svc.get("ok"):
        return []
    d = svc.get("data")
    return d if isinstance(d, list) else ([d] if isinstance(d, dict) else [])


def location_index(services: dict) -> dict[str, str]:
    """resource name -> zone/region from the fetch, for rendering fix commands."""
    idx: dict[str, str] = {}
    for key in ("compute_instances", "compute_disks"):
        for it in items(services, key):
            idx.setdefault(it.get("name", ""), short(it.get("zone", "")))
    for it in items(services, "addresses_static_ip"):
        idx.setdefault(it.get("name", ""), short(it.get("region", "")))
    for it in items(services, "cloud_functions"):
        # projects/P/locations/L/functions/N
        parts = str(it.get("name", "")).split("/")
        if len(parts) >= 6:
            idx.setdefault(parts[-1], parts[3])
    return idx


def split_resource(res: str, loc_idx: dict[str, str]) -> tuple[str, str]:
    """Return (name, loc). Subnet results are 'region/name'."""
    if "/" in res and not res.startswith("projects/"):
        loc, name = res.split("/", 1)
        return name, loc
    return res, loc_idx.get(res, "")


def ensure_cloud_account(db, provider, scope, user_id, org_id, dry):
    doc = {
        "id": scope, "cloud": provider, "account_name": scope, "account_identifier": scope,
        "auth_type": "service-account" if provider == "gcp" else "role",
        "status": "connected", "is_active": True, "is_global": False,
        "user_id": user_id, "org_id": org_id, "source": "live-scan",
        "updated_at": NOW,
    }
    if provider == "gcp":
        doc["gcp_project"] = scope
    if not dry:
        db["cloud_accounts"].update_one({"id": scope}, {"$set": doc, "$setOnInsert": {"created_at": NOW}}, upsert=True)
    print(f"  [cloud_account] {scope} ({provider})")


def build(provider, scope, controls, catalog, services, user_id, org_id, fetched_at):
    asm_id = f"A-{provider.upper()}-{scope}"
    loc_idx = location_index(services)

    findings, checks, remediations = [], [], []
    bp_checks: dict[tuple[str, str], list[dict]] = defaultdict(list)
    p_total = {p: 0 for p in PILLAR_IDS}
    p_pass = {p: 0 for p in PILLAR_IDS}
    p_high = {p: 0 for p in PILLAR_IDS}
    counts = defaultdict(int)
    sev_counts = {"high": 0, "medium": 0, "low": 0}

    for ctrl in controls:
        res = (ctrl.get("results") or {}).get(scope)
        if not res:
            continue
        verdict = res.get("verdict", "NOT_IMPLEMENTED")
        counts[verdict] += 1
        if verdict not in FINDING_VERDICTS:
            continue

        cid = ctrl["control_id"]
        cat = catalog.get(cid, {})
        pid, plabel = pillar_of(ctrl)
        f_sev, c_sev, risk = severity_of(ctrl)
        rlist = res.get("resources", [])
        failing = [r for r in rlist if r.get("status") == "FAIL"]
        status = "fail" if verdict == "FAIL" else "pass"

        p_total[pid] += 1
        if status == "pass":
            p_pass[pid] += 1
        else:
            sev_counts[f_sev] += 1
            if f_sev == "high":
                p_high[pid] += 1

        if status == "fail":
            evidence = "; ".join(r.get("evidence", "") for r in failing[:6])
            res_names = [r["resource"] for r in failing if r.get("resource")]
        else:
            evidence = "Compliant per live scan."
            res_names = [r["resource"] for r in rlist if r.get("resource")]

        rem_id = f"REM-{provider.upper()}-{cid}"
        g = GUIDANCE.get(cid, {})
        findings.append({
            "id": f"FND-{asm_id}-{cid}", "assessment_id": asm_id, "check_id": cid,
            "remediation_id": rem_id if status == "fail" else None,
            "cloud": provider, "pillar_id": pid, "pillar": plabel,
            "severity": f_sev, "title": ctrl.get("title", cid), "description": evidence,
            "status": status, "effort": g.get("effort", "Medium Effort"), "risk": risk,
            "resources": res_names,
            "cis_gcp": ctrl.get("cis_gcp"), "cis_aws": ctrl.get("cis_aws"), "cis_azure": ctrl.get("cis_azure"),
            "soc2_ids": ctrl.get("soc2_ids"), "iso27001_ids": ctrl.get("iso27001_ids"),
            "hipaa_ids": ctrl.get("hipaa_ids"),
            "source": "live-scan", "created_at": NOW, "updated_at": NOW,
        })

        domain_id = cat.get("domain_id") or cid.split("-")[0]
        domain_name = cat.get("domain_name") or domain_id
        bp_id = f"BP-{pid}-{domain_id}"
        check = {
            "id": cid, "pillar_id": pid, "best_practice_id": bp_id,
            "title": ctrl.get("title", cid),
            "description": evidence if status == "fail" else (cat.get("description") or ""),
            "severity": c_sev, "status": status,
            "effort": g.get("effort", "Medium Effort").split()[0],
            "cloud_provider": provider, "assessment_id": asm_id, "source": "live-scan",
        }
        checks.append(check)
        bp_checks[(pid, bp_id)].append({**check, "_domain_name": domain_name})

        if status == "fail":
            pairs = [split_resource(n, loc_idx) for n in res_names]
            steps = [{"step": i + 1, "title": t, "consolePath": cp, "instruction": ins}
                     for i, (t, cp, ins) in enumerate(g.get("steps", []))]
            if g.get("warning"):
                steps.insert(0, {"step": 0, "title": "Before you start",
                                 "consolePath": "", "instruction": g["warning"]})
            remediations.append({
                "id": rem_id, "check_id": cid, "cloud": provider, "assessment_id": asm_id,
                "pillar": plabel, "pillarId": pid, "severity": c_sev,
                "title": ctrl.get("title", cid), "effort": g.get("effort", "Medium Effort"),
                "estTime": g.get("estTime", ""), "risk": risk,
                "description": evidence, "rationale": cat.get("description", ""),
                "resources": res_names,
                "manualSteps": steps,
                "cli": {"command": render_cli(cid, scope, pairs),
                        "explanation": g.get("explanation", "")},
                "iac": {"tf": "# No Terraform snippet authored for this control yet.",
                        "cf": "# Not applicable to GCP."},
                "guidance_source": "authored" if g else "none",
                "source": "live-scan", "updated_at": NOW,
            })

    # Best practices = (pillar, catalog domain). A BP fails if any check fails.
    best_practices = []
    for (pid, bp_id), chks in bp_checks.items():
        best_practices.append({
            "id": bp_id, "pillar_id": pid, "title": chks[0]["_domain_name"],
            "description": f"{len(chks)} control(s) evaluated in this domain by the live scan.",
            "status": "fail" if any(c["status"] == "fail" for c in chks) else "pass",
            "cloud_provider": provider, "source": "live-scan",
        })

    scored = counts["PASS"] + counts["FAIL"]
    pillar_scores = {p: (round(p_pass[p] / p_total[p] * 100) if p_total[p] else 0) for p in PILLAR_IDS}
    pillar_high = dict(p_high)
    for full, alias in PILLAR_ALIASES.items():
        pillar_scores[alias] = pillar_scores[full]
        pillar_high[alias] = pillar_high[full]

    failed_bps = sum(1 for b in best_practices if b["status"] == "fail")
    inventory = build_inventory(provider, scope, asm_id, services)

    assessment = {
        "id": asm_id,
        "name": f"{provider.upper()} Live Well-Architected Review — {scope}",
        "cloud": provider, "cloud_account_id": scope,
        "account_name": scope, "account_identifier": scope,
        # The fetch covers every region of the project, not one region.
        "region": "global",
        "lens": {"gcp": "google-cloud-architecture-framework", "aws": "aws-well-architected",
                 "azure": "azure-well-architected"}.get(provider, "well-architected"),
        "status": "FAIL" if counts["FAIL"] else "COMPLETED",
        "score": round(counts["PASS"] / scored * 100) if scored else 0,
        "checks_count": scored, "total_checks": scored,
        "passed_checks": counts["PASS"], "failed_checks": counts["FAIL"],
        "total_best_practices": len(best_practices),
        "passed_bps": len(best_practices) - failed_bps, "failed_bps": failed_bps,
        "high_risks": sev_counts["high"], "medium_risks": sev_counts["medium"],
        "low_risks": sev_counts["low"],
        "pillar_scores": pillar_scores, "pillar_high_risks": pillar_high,
        "unknown_controls": counts["UNKNOWN"],
        "not_applicable_controls": counts["NOT_APPLICABLE"],
        "not_implemented_controls": counts["NOT_IMPLEMENTED"],
        "resources_scanned": len(inventory),
        "rerun_count": 0, "is_global": False,
        "user_id": user_id, "org_id": org_id, "source": "live-scan",
        "last_run_at": fetched_at or NOW, "updated_at": NOW,
    }
    for c in checks:
        c.pop("_domain_name", None)
    return assessment, findings, checks, best_practices, remediations, inventory


def build_inventory(provider, scope, asm_id, services):
    out = []
    for key, rtype in INVENTORY_TYPES.items():
        for i, it in enumerate(items(services, key)):
            if not isinstance(it, dict):
                continue
            raw = it.get("name") or it.get("email") or it.get("id") or f"{rtype}-{i}"
            out.append({
                "id": f"res-{asm_id}-{key}-{i}", "assessment_id": asm_id, "cloud": provider,
                "type": rtype, "name": short(raw),
                "arn": it.get("selfLink") or it.get("name") or short(raw),
                "region": short(it.get("region") or it.get("zone") or it.get("location") or "global"),
                "account_id": scope, "source": "live-scan",
            })
    return out


def build_milestone(a: dict) -> dict:
    keys = ("score", "total_checks", "passed_checks", "failed_checks", "total_best_practices",
            "passed_bps", "failed_bps", "high_risks", "medium_risks", "low_risks",
            "pillar_scores", "pillar_high_risks")
    return {"id": f"MLST-{a['id']}-baseline", "assessment_id": a["id"], "milestone_number": 1,
            "milestone_name": "Live Scan Baseline", "version": "v1.0.0",
            **{k: a[k] for k in keys},
            "notes": "Baseline from live cloud scan via check engine.",
            "recorded_by": "Live Scanner", "recorded_at": a["last_run_at"],
            "source": "live-scan", "created_at": NOW}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--result", default=str(HERE / "assessment_result_gcp.json"))
    ap.add_argument("--fetch", default=None, help="Raw fetch JSON (default mcp_fetch/<provider>_fetch_result.json)")
    ap.add_argument("--catalog", default=str(HERE / "seed_data" / "control_catalog.csv"))
    ap.add_argument("--user-id", default="usr-09")
    ap.add_argument("--org-id", default="org_01")
    ap.add_argument("--real-only", action="store_true",
                    help="Replace this cloud's checks/best practices/pillar scores with the real structure.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    result = json.loads(Path(args.result).read_text(encoding="utf-8"))
    provider = result["provider"]
    fetch_path = Path(args.fetch) if args.fetch else HERE / "mcp_fetch" / f"{provider}_fetch_result.json"
    if not fetch_path.exists():
        raise SystemExit(f"fetch JSON not found: {fetch_path}")
    fetch = json.loads(fetch_path.read_text(encoding="utf-8"))
    catalog = load_catalog(Path(args.catalog))
    fetched_at = (result.get("generatedFrom") or {}).get("fetchedAt")

    db = MongoClient(MONGO_URI)[DB_NAME]
    print(f"Loading {provider} from {args.result} -> {MONGO_URI}/{DB_NAME} "
          f"(real-only={args.real_only}, dry-run={args.dry_run})")

    all_checks, all_bps, all_rems, scores = [], [], [], {}
    for scope in result["scopes"]:
        print(f"\nScope: {scope}")
        ensure_cloud_account(db, provider, scope, args.user_id, args.org_id, args.dry_run)
        a, fnd, chks, bps, rems, inv = build(provider, scope, result["controls"], catalog,
                                             scope_services(fetch, scope), args.user_id,
                                             args.org_id, fetched_at)
        m = build_milestone(a)
        print(f"  [assessment] {a['id']} score={a['score']} pass={a['passed_checks']} "
              f"fail={a['failed_checks']} bps={a['total_best_practices']} "
              f"(failed {a['failed_bps']}) resources={len(inv)}")
        print(f"  [findings] {len(fnd)}  [remediations] {len(rems)} "
              f"(authored guidance: {sum(1 for r in rems if r['guidance_source'] == 'authored')})")
        print("  [pillar scores] " + ", ".join(f"{p}={a['pillar_scores'][p]}" for p in PILLAR_IDS))
        all_checks += chks
        all_bps += bps
        all_rems += rems
        scores = a["pillar_scores"]
        if args.dry_run:
            continue
        db["assessments"].update_one({"id": a["id"]}, {"$set": a, "$setOnInsert": {"created_at": NOW}}, upsert=True)
        for coll, docs in (("findings", fnd), ("resource_inventory", inv)):
            db[coll].delete_many({"assessment_id": a["id"]})
            if docs:
                db[coll].insert_many(docs)
        db["milestones"].update_one({"id": m["id"]}, {"$set": m}, upsert=True)
        for r in rems:
            db["remediations"].update_one({"id": r["id"]}, {"$set": r}, upsert=True)

    if args.real_only and not args.dry_run:
        # Replace this cloud's WAFR structure with the real one.
        db["checks"].delete_many({"cloud_provider": provider})
        if all_checks:
            db["checks"].insert_many(all_checks)
        db["best_practices"].delete_many({"$or": [{"cloud_provider": provider},
                                                  {"cloud_provider": {"$exists": False}}]})
        if all_bps:
            db["best_practices"].insert_many(all_bps)
        db["remediations"].delete_many({"cloud": provider, "id": {"$nin": [r["id"] for r in all_rems]}})
        for p in PILLAR_IDS:
            db["pillars"].update_one({"id": p}, {"$set": {"score": scores.get(p, 0)},
                                                 "$unset": {"bestPractices": ""}})
        print(f"\n[real-only] replaced {provider} checks={len(all_checks)} "
              f"best_practices={len(all_bps)}, pillar scores updated")

    print("\n[DRY RUN] nothing written." if args.dry_run else "\n[OK] Loaded into MongoDB.")


if __name__ == "__main__":
    main()
