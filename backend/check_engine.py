"""
LENS check engine — cloud-agnostic.

Runs the control catalog against actual fetched cloud data and produces real
pass/fail results, for ANY provider (GCP, AWS, Azure) using the same code.

Pipeline:  catalog (what should be true)  +  fetch result (what IS)  -> checks -> verdicts

The only cloud-specific piece is the provider (checks/<name>_checks.py), which:
  - declares which catalog column holds its tokens (gcp_checks/aws_checks/azure_checks)
  - registers one check function per token

For each control:
  1. Read its token(s) from the provider's catalog column.
  2. Look up the registered check(s) in the provider's registry.
  3. Run each check against every scope's fetched data (project/account/subscription).
  4. Roll resource-level PASS/FAIL up to a control verdict per scope:
        any FAIL              -> FAIL
        >=1 PASS, no FAIL     -> PASS
        only UNKNOWN          -> UNKNOWN          (resources exist, extra data needed)
        no resources          -> NOT_APPLICABLE
        no check registered   -> NOT_IMPLEMENTED

Usage:
    python check_engine.py --provider gcp \
        --catalog seed_data/control_catalog.csv \
        --data mcp_fetch/gcp_fetch_result.json \
        --out assessment_result.json \
        [--control NET-01]          # optional: run a single control

Adding a cloud requires NO change to this file — only a new checks module and a
fetch JSON in the shared shape.
"""
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path

from checks import get_provider, rollup

HERE = Path(__file__).parent

# Default fetch file per provider (override with --data).
DEFAULT_DATA = {
    "gcp": HERE / "mcp_fetch" / "gcp_fetch_result.json",
    "aws": HERE / "mcp_fetch" / "aws_fetch_result.json",
    "azure": HERE / "mcp_fetch" / "azure_fetch_result.json",
}


def load_catalog(path: Path) -> list[dict]:
    with open(path, encoding="utf-8") as f:
        return list(csv.DictReader(f))


def load_fetch(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def tokens(cell: str) -> list[str]:
    return [t.strip() for t in (cell or "").split(";") if t.strip()]


def run(provider_name: str, catalog_path: Path, data_path: Path, out_path: Path,
        only_control: str | None = None) -> dict:
    provider = get_provider(provider_name)
    catalog = load_catalog(catalog_path)
    fetch = load_fetch(data_path)

    # The fetch file groups resources by scope. GCP uses "projects"; other
    # clouds may use "accounts"/"subscriptions". Accept any single grouping key
    # that maps scope-name -> { services: {...} }.
    scopes = fetch.get("projects") or fetch.get("accounts") \
        or fetch.get("subscriptions") or fetch.get("scopes") or {}

    assessment = {
        "provider": provider_name,
        "scopeLabel": provider.scope_label,
        "generatedFrom": {
            "catalog": str(catalog_path),
            "data": str(data_path),
            "fetchedAt": fetch.get("fetchedAt"),
        },
        "scopes": list(scopes.keys()),
        "controls": [],
    }

    for ctrl in catalog:
        cid = ctrl["control_id"]
        if only_control and cid != only_control:
            continue

        ctrl_tokens = tokens(ctrl.get(provider.catalog_column, ""))
        registered = [t for t in ctrl_tokens if t in provider]
        implemented = bool(registered)

        per_scope = {}
        for scope, sdata in scopes.items():
            services = sdata.get("services", {})
            if not implemented:
                per_scope[scope] = {"verdict": "NOT_IMPLEMENTED", "resources": []}
                continue
            resources: list[dict] = []
            for tok in registered:
                resources.extend(provider.get(tok)(services))
            per_scope[scope] = {"verdict": rollup(resources), "resources": resources}

        assessment["controls"].append({
            "control_id": cid,
            "title": ctrl.get("title"),
            "pillar": ctrl.get("pillar"),
            "severity": ctrl.get("severity"),
            "resource_type": ctrl.get("resource_type"),
            "checks": ctrl_tokens,
            "implemented": implemented,
            # framework mappings carried through for compliance scoring
            "cis_aws": ctrl.get("cis_aws"),
            "cis_azure": ctrl.get("cis_azure"),
            "cis_gcp": ctrl.get("cis_gcp"),
            "soc2_ids": ctrl.get("soc2_ids"),
            "iso27001_ids": ctrl.get("iso27001_ids"),
            "hipaa_ids": ctrl.get("hipaa_ids"),
            "results": per_scope,
        })

    out_path.write_text(json.dumps(assessment, indent=2), encoding="utf-8")
    return assessment


def print_summary(assessment: dict) -> None:
    label = assessment.get("scopeLabel", "scope")
    print("\n================ ASSESSMENT SUMMARY ================")
    print(f"Provider: {assessment['provider']}")
    print(f"{label.capitalize()}s:", ", ".join(assessment["scopes"]) or "(none)")
    overall = Counter()
    fails = []
    for c in assessment["controls"]:
        for scope, res in c["results"].items():
            overall[res["verdict"]] += 1
            if res["verdict"] == "FAIL":
                failing = [r for r in res["resources"] if r["status"] == "FAIL"]
                fails.append((c["control_id"], c["severity"], scope, failing))

    print(f"\nVerdict counts (control x {label}):")
    for k in ("FAIL", "PASS", "UNKNOWN", "NOT_APPLICABLE", "NOT_IMPLEMENTED"):
        print(f"  {k:<16} {overall.get(k, 0)}")

    if fails:
        print("\n--- FAILING CONTROLS (real findings) ---")
        for cid, sev, scope, failing in fails:
            print(f"\n[{sev}] {cid}  @ {scope}  ({len(failing)} failing resource(s))")
            for r in failing[:8]:
                print(f"    - {r['resource']}: {r['evidence']}")
            if len(failing) > 8:
                print(f"    ... +{len(failing) - 8} more")
    else:
        print("\nNo FAIL verdicts.")

    impl = sum(1 for c in assessment["controls"] if c["implemented"])
    print(f"\nControls with a {assessment['provider']} check implemented: "
          f"{impl}/{len(assessment['controls'])}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--provider", default="gcp", choices=["gcp", "aws", "azure"],
                    help="Which cloud's checks to run.")
    ap.add_argument("--catalog", default=str(HERE / "seed_data" / "control_catalog.csv"))
    ap.add_argument("--data", default=None, help="Fetch result JSON (defaults per provider).")
    ap.add_argument("--out", default=None, help="Output path (default assessment_result_<provider>.json).")
    ap.add_argument("--control", default=None, help="Run only this control_id.")
    args = ap.parse_args()

    data_path = Path(args.data) if args.data else DEFAULT_DATA[args.provider]
    out_path = Path(args.out) if args.out else HERE / f"assessment_result_{args.provider}.json"

    assessment = run(args.provider, Path(args.catalog), data_path, out_path, args.control)
    print_summary(assessment)
    print(f"\nFull results written to: {out_path}")


if __name__ == "__main__":
    main()
