"""
Re-run checks and reload results for every stored fetch, for every cloud and
every project / account / subscription (no new cloud fetch).

For each stored scope (DATA_DIR/<provider>/<scope>.json):
  * the owner is the cloud account that holds that scope, and results go to
    that account's latest assessment;
  * with no such account, results go to --user-email's user (the loader then
    creates a cloud account named after the scope).

Old single-file fetches (<provider>_fetch_result.json) are split per scope first.

    python reload_all.py --user-email you@example.com [--dry-run]
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

from pymongo import MongoClient

import scan_providers

HERE = Path(__file__).parent
RUN_DIR = Path(os.getenv("LENS_RUN_DIR") or (HERE.parent / ".dev-run"))


def owner_for(db, prov, scope: str, fallback: tuple[str, str]) -> tuple[str, str, str | None, str | None]:
    """(user_id, org_id, cloud_account_id, assessment_id) for a scope."""
    for acct in db["cloud_accounts"].find({"cloud": prov.name}, {"_id": 0}):
        if prov.account_scope(acct) == scope and acct.get("user_id") and acct.get("org_id"):
            a = db["assessments"].find_one({"cloud_account_id": acct["id"], "cloud": prov.name},
                                           {"_id": 0, "id": 1}, sort=[("created_at", -1)])
            return acct["user_id"], acct["org_id"], acct["id"], (a or {}).get("id")
    return fallback[0], fallback[1], None, None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--user-email", required=True, help="Owner for scopes no cloud account claims")
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
            total += 1
            user_id, org_id, acct_id, aid = owner_for(db, prov, scope, fallback)
            print(f"\n== {prov.name} {scope}  owner={org_id}/{user_id}  account={acct_id or '(new)'} ==")
            fetch = prov.fetch_path(scope)
            result = RUN_DIR / f"reload-{prov.name}-{scope}-result.json"
            subprocess.run([sys.executable, "check_engine.py", "--provider", prov.name,
                            "--data", str(fetch), "--out", str(result)], cwd=HERE, check=True)
            load = [sys.executable, "load_assessment_to_db.py", "--provider", prov.name,
                    "--result", str(result), "--fetch", str(fetch),
                    "--user-id", user_id, "--org-id", org_id, "--real-only"]
            if acct_id:
                load += ["--cloud-account-id", acct_id]
            if aid:
                load += ["--assessment-id", aid]
            if args.dry_run:
                load.append("--dry-run")
            subprocess.run(load, cwd=HERE, check=True)
            result.unlink(missing_ok=True)
    if not total:
        raise SystemExit("no fetch data yet: run a scan first")
    print(f"\nreloaded {total} scope(s)")


if __name__ == "__main__":
    main()
