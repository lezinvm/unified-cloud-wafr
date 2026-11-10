"""
Live scan runner, for any registered cloud provider (scan_providers.py).

    fetch   provider fetcher (official MCP server client), read-only
    check   python check_engine.py --provider <p>
    load    python load_assessment_to_db.py --provider <p> --assessment-id <id>

Started from the API (POST /api/scans) or the CLI:
    python scan_runner.py --assessment-id A-GCP-lens-wafr-gcp

Each scan is a document in the `scans` collection so the UI can poll progress:
    { id, assessment_id, provider, project, status: queued|running|done|failed,
      stage: fetch|check|load|done, stages: {...}, error, log_tail,
      started_at, finished_at, result: {score, passed, failed, resources} }

Safety:
  * API scans only when SCAN_ENABLED=1 (dev sets it; prod does not).
  * One scan at a time (in-process lock + a DB check for running scans).
  * Provider, scope id and owner come from the stored assessment/cloud account,
    never from the request; the scope id must match the provider's id format.
  * Subprocesses get argument lists (no shell).
  * A fetch where most services are blocked keeps the previous data.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

try:
    from backend import scan_providers
except ModuleNotFoundError:
    import scan_providers

BACKEND = Path(__file__).parent
# Scan logs and intermediate files. Containers point this at a volume.
RUN_DIR = Path(os.getenv("LENS_RUN_DIR") or (BACKEND.parent / ".dev-run"))

SCAN_ENABLED = os.getenv("SCAN_ENABLED", "").lower() in ("1", "true", "yes")
FETCH_TIMEOUT_S = 40 * 60
STEP_TIMEOUT_S = 10 * 60

_lock = asyncio.Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ScanError(Exception):
    pass


async def _run(args: list[str], cwd: Path, log, timeout: int) -> str:
    """Run a subprocess, append its output to the log, return the output."""
    proc = await asyncio.create_subprocess_exec(
        *args, cwd=str(cwd), env=os.environ.copy(),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    name = Path(args[1]).name if len(args) > 1 else args[0]
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise ScanError(f"{name} timed out after {timeout // 60} min")
    text = out.decode("utf-8", errors="replace")
    log.write(f"\n$ {' '.join(args)}\n{text}")
    log.flush()
    if proc.returncode != 0:
        last = (text.strip().splitlines() or [""])[-1]
        raise ScanError(f"{name} failed (exit {proc.returncode}): {last[:300]}")
    return text


async def mark_interrupted(db):
    """On startup: scans left 'running' by a previous process can never finish."""
    await db["scans"].update_many(
        {"status": {"$in": ["queued", "running"]}},
        {"$set": {"status": "failed", "finished_at": now(),
                  "error": "Interrupted: the backend restarted while this scan was running."}})


async def resolve_target(db, assessment_id: str) -> dict:
    """Look up provider, scope and owner from stored data (never from the request)."""
    a = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0})
    if not a:
        raise ScanError("Assessment not found.")
    try:
        prov = scan_providers.get(a.get("cloud") or "")
    except KeyError as e:
        raise ScanError(str(e))
    if not prov.can_scan:
        raise ScanError(f"Live scanning is not available for {prov.label} yet (no fetcher registered).")
    acct = await db["cloud_accounts"].find_one({"id": a.get("cloud_account_id")}, {"_id": 0}) or {}
    scope = acct.get(prov.account_scope_field) or acct.get("account_identifier") or a.get("cloud_account_id") or ""
    if not prov.valid_scope(scope):
        raise ScanError(f"Stored {prov.scope_label} id '{scope}' is not a valid {prov.label} {prov.scope_label} id.")
    user_id, org_id = a.get("user_id"), a.get("org_id")
    if not user_id or not org_id:
        raise ScanError("Assessment has no owner (user_id/org_id); cannot load results.")
    return {"provider": prov.name, "project": scope, "user_id": user_id, "org_id": org_id}


async def start_scan(db, assessment_id: str, *, background: bool = True, require_enabled: bool = True) -> dict:
    if require_enabled and not SCAN_ENABLED:
        raise ScanError("Live scanning is disabled on this environment (SCAN_ENABLED is not set).")
    if _lock.locked() or await db["scans"].find_one({"status": {"$in": ["queued", "running"]}}):
        raise ScanError("A scan is already running. Wait for it to finish.")
    target = await resolve_target(db, assessment_id)
    scan = {
        "id": f"SCAN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
        "assessment_id": assessment_id, "provider": target["provider"], "project": target["project"],
        "status": "queued", "stage": "fetch",
        "stages": {s: "pending" for s in ("fetch", "check", "load")},
        "error": None, "log_tail": "", "started_at": now(), "finished_at": None, "result": None,
    }
    await db["scans"].insert_one(dict(scan))
    job = _execute(db, scan["id"], assessment_id, target)
    if background:
        asyncio.create_task(job)
    else:
        await job
    return scan


async def _set(db, scan_id: str, **fields):
    await db["scans"].update_one({"id": scan_id}, {"$set": fields})


async def _execute(db, scan_id: str, assessment_id: str, target: dict):
    prov = scan_providers.get(target["provider"])
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    log_path = RUN_DIR / f"{scan_id}.log"
    tmp = RUN_DIR / f"{scan_id}-fetch.json"
    result_file = RUN_DIR / f"assessment_result_{prov.name}.json"
    scope = target["project"]
    async with _lock:
        with open(log_path, "w", encoding="utf-8") as log:
            stage = "fetch"
            try:
                await _set(db, scan_id, status="running", stage="fetch", **{"stages.fetch": "running"})
                await _run(prov.fetch_cmd(scope, tmp), scan_providers.FETCH_DIR, log, FETCH_TIMEOUT_S)
                prov.fetch_file.parent.mkdir(parents=True, exist_ok=True)
                fetched = json.loads(tmp.read_text(encoding="utf-8"))
                services = ((fetched.get(prov.scope_key) or {}).get(scope) or {}).get("services", {})
                readable = sum(1 for v in services.values() if v.get("ok"))
                if readable < prov.min_readable_services:
                    raise ScanError(
                        f"Only {readable} services were readable, so the scanner identity lacks access "
                        f"to this {prov.scope_label}. Previous results were kept.")
                shutil.move(str(tmp), str(prov.fetch_file))
                await _set(db, scan_id, **{"stages.fetch": "done", "fetch_services": readable})

                stage = "check"
                await _set(db, scan_id, stage="check", **{"stages.check": "running"})
                await _run([sys.executable, "check_engine.py", "--provider", prov.name,
                            "--data", str(prov.fetch_file), "--out", str(result_file)],
                           BACKEND, log, STEP_TIMEOUT_S)
                await _set(db, scan_id, **{"stages.check": "done"})

                stage = "load"
                await _set(db, scan_id, stage="load", **{"stages.load": "running"})
                await _run([sys.executable, "load_assessment_to_db.py", "--provider", prov.name,
                            "--result", str(result_file), "--fetch", str(prov.fetch_file),
                            "--assessment-id", assessment_id,
                            "--user-id", target["user_id"], "--org-id", target["org_id"], "--real-only"],
                           BACKEND, log, STEP_TIMEOUT_S)

                a = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0}) or {}
                await _set(db, scan_id, status="done", stage="done", finished_at=now(),
                           **{"stages.load": "done"},
                           result={"score": a.get("score"), "passed": a.get("passed_checks"),
                                   "failed": a.get("failed_checks"),
                                   "resources": a.get("resources_scanned")})
            except Exception as e:  # noqa: BLE001 - record any failure on the scan doc
                msg = str(e) if isinstance(e, ScanError) else f"{type(e).__name__}: {e}"
                log.write(f"\nERROR: {msg}\n")
                await _set(db, scan_id, status="failed", finished_at=now(), error=msg,
                           **{f"stages.{stage}": "failed"})
            finally:
                if tmp.exists():
                    tmp.unlink()
    try:
        tail = log_path.read_text(encoding="utf-8", errors="replace").splitlines()[-25:]
        await _set(db, scan_id, log_tail="\n".join(tail))
    except OSError:
        pass


def _cli() -> None:
    """Run one scan synchronously (same pipeline as the API)."""
    ap = argparse.ArgumentParser(description="Run a live scan for one assessment.")
    ap.add_argument("--assessment-id", required=True)
    args = ap.parse_args()

    from motor.motor_asyncio import AsyncIOMotorClient
    db = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))[os.getenv("DB_NAME", "wafr_db")]

    async def go():
        scan = await start_scan(db, args.assessment_id, background=False, require_enabled=False)
        doc = await db["scans"].find_one({"id": scan["id"]}, {"_id": 0})
        print(f"scan {doc['id']}: {doc['status']} ({doc['provider']} {doc['project']})")
        if doc.get("fetch_services") is not None:
            print(f"  services readable: {doc['fetch_services']}")
        if doc["status"] == "done":
            r = doc["result"]
            print(f"  score={r['score']} passed={r['passed']} failed={r['failed']} resources={r['resources']}")
        else:
            print(f"  error: {doc['error']}\n  log: {RUN_DIR / (doc['id'] + '.log')}")
            sys.exit(1)

    asyncio.run(go())


if __name__ == "__main__":
    _cli()
