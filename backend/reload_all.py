"""
Re-run checks and reload results for every stored fetch, for every cloud and
every project / account / subscription, and every assessment of each (no new
cloud fetch).

For each stored scope (DATA_DIR/<provider>/<scope>.json):
  * every assessment of every cloud account holding that scope is reloaded,
    with its own region filter, under that assessment's owner;
  * with no such assessment, results go to --user-email's user as an
    all-regions assessment (the loader then creates a cloud account named
    after the scope).

Old single-file fetches (<provider>_fetch_result.json) are split per scope first.

    python reload_all.py --user-email you@example.com [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from pymongo import MongoClient

import scan_providers

HERE = Path(__file__).parent
RUN_DIR = Path(os.getenv("LENS_RUN_DIR") or (HERE.parent / ".dev-run"))


def targets_for(db, prov, scope: str, fallback: tuple[str, str]) -> list[dict]:
    """Assessments to reload for a scope: [{user_id, org_id, cloud_account_id, assessment_id, regions}]."""
    out = []
    for acct in db["cloud_accounts"].find({"cloud": prov.name}, {"_id": 0}):
        if prov.account_scope(acct) != scope or not acct.get("user_id") or not acct.get("org_id"):
            continue
        for a in db["assessments"].find({"cloud_account_id": acct["id"], "cloud": prov.name},
                                        {"_id": 0, "id": 1, "user_id": 1, "org_id": 1, "regions": 1}):
            out.append({"user_id": a.get("user_id") or acct["user_id"],
                        "org_id": a.get("org_id") or acct["org_id"], "cloud_account_id": acct["id"],
                        "assessment_id": a["id"], "regions": list(a.get("regions") or [])})
    if not out:
        out.append({"user_id": fallback[0], "org_id": fallback[1], "cloud_account_id": None,
                    "assessment_id": None, "regions": []})
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-email", required=True, help="Owner for scopes no assessment claims")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    db = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))[os.getenv("DB_NAME", "wafr_db")]
    u = db["users"].find_one({"email": args.user_email}, {"_id": 0})
    if not u:
        raise SystemExit(f"no user with email {args.user_email}")
    fallback = (u["id"], u.get("org_id") or f"org_{u['id']}")
    RUN_DIR.mkdir(parents=True, exist_ok=True)

    total = 0
    for prov in scan_providers.PROVIDERS.values():
        moved = scan_providers.migrate_legacy_fetch(prov)
        if moved:
            print(f"[{prov.name}] split old fetch file into: {', '.join(moved)}")
        for scope in prov.stored_scopes():
            fetch_path = prov.fetch_path(scope)
            fetch = json.loads(fetch_path.read_text(encoding="utf-8"))
            for t in targets_for(db, prov, scope, fallback):
                total += 1
                tag = f"{prov.name}-{scope}-{t['assessment_id'] or 'new'}"
                print(f"\n== {prov.name} {scope} -> {t['assessment_id'] or '(new)'}  "
                      f"owner={t['org_id']}/{t['user_id']}  regions={','.join(t['regions']) or 'all'} ==")
                data = fetch_path
                if t["regions"]:
                    data = RUN_DIR / f"reload-{tag}-scoped.json"
                    data.write_text(json.dumps(prov.filter_regions(fetch, scope, t["regions"])), encoding="utf-8")
                result = RUN_DIR / f"reload-{tag}-result.json"
                try:
                    subprocess.run([sys.executable, "check_engine.py", "--provider", prov.name,
                                    "--data", str(data), "--out", str(result)], cwd=HERE, check=True)
                    load = [sys.executable, "load_assessment_to_db.py", "--provider", prov.name,
                            "--result", str(result), "--fetch", str(data),
                            "--user-id", t["user_id"], "--org-id", t["org_id"], "--real-only"]
                    if t["cloud_account_id"]:
                        load += ["--cloud-account-id", t["cloud_account_id"]]
                    if t["assessment_id"]:
                        load += ["--assessment-id", t["assessment_id"]]
                    if args.dry_run:
                        load.append("--dry-run")
                    subprocess.run(load, cwd=HERE, check=True)
                finally:
                    result.unlink(missing_ok=True)
                    if data != fetch_path:
                        data.unlink(missing_ok=True)
    if not total:
        raise SystemExit("no fetch data yet: run a scan first")
    print(f"\nreloaded {total} assessment(s)")


if __name__ == "__main__":
    main()
