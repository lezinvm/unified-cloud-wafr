"""
Load check-engine results into MongoDB, for any cloud provider.

Input: `assessment_result_<provider>.json` (check_engine.py) plus the raw fetch
JSON. Everything cloud-specific (scope naming, inventory, resource locations,
fix guidance, lens) comes from scan_providers.py; this file has no
provider-specific code.

Everything written is scoped to ONE assessment (per scope), and every id
includes the assessment id, so two projects/accounts/subscriptions of the
same cloud never overwrite each other:

    cloud_accounts      the scanned scope
    assessments         scores/counts from PASS/FAIL controls
    findings            one per PASS/FAIL control (real evidence + resources)
    resource_inventory  resources from the fetch JSON
    milestones          baseline milestone for the scan
    remediations        one per FAILING control: real failing resources +
                        authored guidance (guidance_source="authored")
    checks              the assessment's control results (report views)
    best_practices      per (pillar, catalog domain), pass/fail from its checks

--real-only additionally removes legacy demo rows for this cloud (catalog
checks/best practices/remediations that belong to no assessment).

Usage:
    python check_engine.py --provider gcp
    python load_assessment_to_db.py --result assessment_result_gcp.json \
        --user-id U --org-id O [--assessment-id ID] [--real-only] [--dry-run]
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

import scan_providers

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")
HERE = Path(__file__).parent
NOW = datetime.now(timezone.utc).isoformat()

# Catalog pillar label -> (UI pillar id, display label). The UI has no
# Sustainability pillar, so those controls are shown under Cost Optimization.
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
PILLAR_ALIASES = {"operational-excellence": "operations", "performance-efficiency": "performance"}

# Finding severity is lowercase high/medium/low (CRITICAL folds into high).
SEV_MAP = {
    "CRITICAL": ("high", "critical", "Critical Risk"),
    "HIGH": ("high", "high", "High Risk"),
    "MEDIUM": ("medium", "medium", "Medium Risk"),
    "LOW": ("low", "low", "Low Risk"),
}
FINDING_VERDICTS = {"FAIL", "PASS"}
FRAMEWORK_FIELDS = ("cis_gcp", "cis_aws", "cis_azure", "soc2_ids", "iso27001_ids", "hipaa_ids")


def pillar_of(control: dict) -> tuple[str, str]:
    return PILLAR_MAP.get((control.get("pillar") or "security").strip().lower(), ("security", "Security"))


def severity_of(control: dict) -> tuple[str, str, str]:
    return SEV_MAP.get((control.get("severity") or "MEDIUM").upper(), ("medium", "medium", "Medium Risk"))


def load_catalog(path: Path) -> dict[str, dict]:
    with open(path, encoding="utf-8") as f:
        return {r["control_id"]: r for r in csv.DictReader(f)}


def scope_services(prov: scan_providers.ScanProvider, fetch: dict, scope: str) -> dict:
    scopes = fetch.get(prov.scope_key) or {}
    return (scopes.get(scope) or {}).get("services", {})


def assessment_id_for(prov: scan_providers.ScanProvider, scope: str) -> str:
    return f"A-{prov.name.upper()}-{scope}"


def ensure_cloud_account(db, prov, scope, user_id, org_id, dry):
    doc = {
        "id": scope, "cloud": prov.name, "account_name": scope, "account_identifier": scope,
        prov.account_scope_field: scope, "auth_type": prov.auth_type,
        "status": "connected", "is_active": True, "is_global": False,
        "user_id": user_id, "org_id": org_id, "source": "live-scan", "updated_at": NOW,
    }
    if not dry:
        db["cloud_accounts"].update_one({"id": scope}, {"$set": doc, "$setOnInsert": {"created_at": NOW}},
                                        upsert=True)
    print(f"  [cloud_account] {scope} ({prov.name})")


def build(prov, scope, asm_id, controls, catalog, services, user_id, org_id, fetched_at):
    loc_idx = prov.locations(services)
    findings, checks, remediations = [], [], []
    bp_checks: dict[str, list[dict]] = defaultdict(list)
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

        rem_id = f"REM-{asm_id}-{cid}"
        g = prov.guidance.get(cid, {})
        findings.append({
            "id": f"FND-{asm_id}-{cid}", "assessment_id": asm_id, "check_id": cid,
            "remediation_id": rem_id if status == "fail" else None,
            "cloud": prov.name, "pillar_id": pid, "pillar": plabel,
            "severity": f_sev, "title": ctrl.get("title", cid), "description": evidence,
            "status": status, "effort": g.get("effort", "Medium Effort"), "risk": risk,
            "resources": res_names,
            **{k: ctrl.get(k) for k in FRAMEWORK_FIELDS},
            "source": "live-scan", "created_at": NOW, "updated_at": NOW,
        })

        domain_id = cat.get("domain_id") or cid.split("-")[0]
        bp_id = f"BP-{asm_id}-{pid}-{domain_id}"
        check = {
            # id stays the control id: the UI links checks to remediations by it.
            # Uniqueness comes from assessment_id (every query filters on it).
            "id": cid, "control_id": cid,
            "pillar_id": pid, "best_practice_id": bp_id,
            "title": ctrl.get("title", cid),
            "description": evidence if status == "fail" else (cat.get("description") or ""),
            "severity": c_sev, "status": status,
            "effort": g.get("effort", "Medium Effort").split()[0],
            "cloud_provider": prov.name, "assessment_id": asm_id, "source": "live-scan",
        }
        checks.append(check)
        bp_checks[bp_id].append({**check, "_domain": cat.get("domain_name") or domain_id})

        if status == "fail":
            pairs = [prov.split_resource(n, loc_idx) for n in res_names]
            steps = [{"step": i + 1, "title": t, "consolePath": cp, "instruction": ins}
                     for i, (t, cp, ins) in enumerate(g.get("steps", []))]
            if g.get("warning"):
                steps.insert(0, {"step": 0, "title": "Before you start", "consolePath": "",
                                 "instruction": g["warning"]})
            remediations.append({
                "id": rem_id, "check_id": cid, "cloud": prov.name, "assessment_id": asm_id,
                "pillar": plabel, "pillarId": pid, "severity": c_sev,
                "title": ctrl.get("title", cid), "effort": g.get("effort", "Medium Effort"),
                "estTime": g.get("estTime", ""), "risk": risk,
                "description": evidence, "rationale": cat.get("description", ""),
                "resources": res_names, "manualSteps": steps,
                "cli": {"command": prov.cli_for(cid, scope, pairs), "explanation": g.get("explanation", "")},
                "iac": {"tf": prov.iac_note, "cf": prov.iac_note},
                "guidance_source": "authored" if g else "none",
                "source": "live-scan", "updated_at": NOW,
            })

    best_practices = []
    for bp_id, chks in bp_checks.items():
        best_practices.append({
            "id": bp_id, "pillar_id": chks[0]["pillar_id"], "title": chks[0]["_domain"],
            "description": f"{len(chks)} control(s) evaluated in this domain by the live scan.",
            "status": "fail" if any(c["status"] == "fail" for c in chks) else "pass",
            "cloud_provider": prov.name, "assessment_id": asm_id, "source": "live-scan",
        })

    scored = counts["PASS"] + counts["FAIL"]
    pillar_scores = {p: (round(p_pass[p] / p_total[p] * 100) if p_total[p] else 0) for p in PILLAR_IDS}
    pillar_high = dict(p_high)
    for full, alias in PILLAR_ALIASES.items():
        pillar_scores[alias] = pillar_scores[full]
        pillar_high[alias] = pillar_high[full]
    failed_bps = sum(1 for b in best_practices if b["status"] == "fail")
    inventory = build_inventory(prov, scope, asm_id, services)

    assessment = {
        "id": asm_id,
        "name": f"{prov.label} Live Well-Architected Review — {scope}",
        "cloud": prov.name, "cloud_account_id": scope,
        "account_name": scope, "account_identifier": scope,
        "region": "global",  # the fetch covers every region of the scope
        "lens": prov.lens,
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
        c.pop("_domain", None)
    return assessment, findings, checks, best_practices, remediations, inventory


def build_inventory(prov, scope, asm_id, services):
    out = []
    for key, rtype in prov.inventory_types.items():
        for i, it in enumerate(scan_providers._items(services, key)):
            if not isinstance(it, dict):
                continue
            name, ref, region = prov.inventory_ref(it, f"{rtype}-{i}")
            out.append({"id": f"res-{asm_id}-{key}-{i}", "assessment_id": asm_id, "cloud": prov.name,
                        "type": rtype, "name": name, "arn": ref, "region": region,
                        "account_id": scope, "source": "live-scan"})
    return out


def build_milestone(a: dict) -> dict:
    keys = ("score", "total_checks", "passed_checks", "failed_checks", "total_best_practices",
            "passed_bps", "failed_bps", "high_risks", "medium_risks", "low_risks",
            "pillar_scores", "pillar_high_risks")
    return {"id": f"MLST-{a['id']}-baseline", "assessment_id": a["id"], "milestone_number": 1,
            "milestone_name": "Live Scan Baseline", "version": "v1.0.0", **{k: a[k] for k in keys},
            "notes": "Baseline from live cloud scan via check engine.",
            "recorded_by": "Live Scanner", "recorded_at": a["last_run_at"],
            "source": "live-scan", "created_at": NOW}


def replace(db, coll: str, asm_id: str, docs: list[dict]) -> None:
    db[coll].delete_many({"assessment_id": asm_id})
    if docs:
        db[coll].insert_many(docs)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--result", required=False, default=None,
                    help="check_engine output (default assessment_result_<provider>.json)")
    ap.add_argument("--provider", default=None, help="Cloud provider; defaults to the one in --result")
    ap.add_argument("--fetch", default=None, help="Raw fetch JSON (default from the provider registry)")
    ap.add_argument("--catalog", default=str(HERE / "seed_data" / "control_catalog.csv"))
    ap.add_argument("--user-id", required=True)
    ap.add_argument("--org-id", required=True)
    ap.add_argument("--assessment-id", default=None,
                    help="Store results under this assessment id (single-scope results only)")
    ap.add_argument("--real-only", action="store_true",
                    help="Also remove this cloud's legacy demo checks/best practices/remediations.")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    result_path = Path(args.result) if args.result else HERE / f"assessment_result_{args.provider or 'gcp'}.json"
    result = json.loads(result_path.read_text(encoding="utf-8"))
    prov = scan_providers.get(args.provider or result["provider"])
    if result["provider"] != prov.name:
        raise SystemExit(f"--provider {prov.name} does not match result provider {result['provider']}")
    fetch_path = Path(args.fetch) if args.fetch else prov.fetch_file
    if not fetch_path.exists():
        raise SystemExit(f"fetch JSON not found: {fetch_path}")
    fetch = json.loads(fetch_path.read_text(encoding="utf-8"))
    catalog = load_catalog(Path(args.catalog))
    fetched_at = (result.get("generatedFrom") or {}).get("fetchedAt") or fetch.get("fetchedAt")
    scopes = result["scopes"]
    if args.assessment_id and len(scopes) != 1:
        raise SystemExit("--assessment-id needs a single-scope result")

    db = MongoClient(MONGO_URI)[DB_NAME]
    print(f"Loading {prov.name} from {result_path} -> {MONGO_URI}/{DB_NAME} "
          f"(real-only={args.real_only}, dry-run={args.dry_run})")

    for scope in scopes:
        if not prov.valid_scope(scope):
            raise SystemExit(f"'{scope}' is not a valid {prov.label} {prov.scope_label} id")
        asm_id = args.assessment_id or assessment_id_for(prov, scope)
        print(f"\n{prov.scope_label.capitalize()}: {scope}  ->  {asm_id}")
        ensure_cloud_account(db, prov, scope, args.user_id, args.org_id, args.dry_run)
        a, fnd, chks, bps, rems, inv = build(prov, scope, asm_id, result["controls"], catalog,
                                             scope_services(prov, fetch, scope), args.user_id,
                                             args.org_id, fetched_at)
        m = build_milestone(a)
        print(f"  [assessment] score={a['score']} pass={a['passed_checks']} fail={a['failed_checks']} "
              f"bps={a['total_best_practices']} (failed {a['failed_bps']}) resources={len(inv)}")
        print(f"  [findings] {len(fnd)}  [remediations] {len(rems)} "
              f"(authored guidance: {sum(1 for r in rems if r['guidance_source'] == 'authored')})")
        print("  [pillar scores] " + ", ".join(f"{p}={a['pillar_scores'][p]}" for p in PILLAR_IDS))
        if args.dry_run:
            continue
        db["assessments"].update_one({"id": asm_id}, {"$set": a, "$setOnInsert": {"created_at": NOW}}, upsert=True)
        for coll, docs in (("findings", fnd), ("resource_inventory", inv), ("checks", chks),
                           ("best_practices", bps), ("remediations", rems)):
            replace(db, coll, asm_id, docs)
        db["milestones"].update_one({"id": m["id"]}, {"$set": m}, upsert=True)

    if args.real_only and not args.dry_run:
        legacy = {"$or": [{"assessment_id": {"$exists": False}}, {"assessment_id": None}]}
        r1 = db["checks"].delete_many({"cloud_provider": prov.name, **legacy})
        r2 = db["best_practices"].delete_many({"$and": [legacy, {"$or": [
            {"cloud_provider": prov.name}, {"cloud_provider": {"$exists": False}}]}]})
        r3 = db["remediations"].delete_many({"cloud": prov.name, **legacy})
        print(f"\n[real-only] removed legacy {prov.name} rows: checks={r1.deleted_count} "
              f"best_practices={r2.deleted_count} remediations={r3.deleted_count}")

    print("\n[DRY RUN] nothing written." if args.dry_run else "\n[OK] Loaded into MongoDB.")


if __name__ == "__main__":
    main()
