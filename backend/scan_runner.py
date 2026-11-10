"""
Live scan runner: the same pipeline as `scripts/dev-env.sh scan`, started from
the API.

    fetch   node mcp_fetch/gcp_fetch_all.mjs   (official gcloud MCP server,
                                                VM identity, read-only)
    check   python check_engine.py
    load    python load_assessment_to_db.py --real-only

Each scan is a document in the `scans` collection, so the UI can poll progress:
    { id, assessment_id, project, status: queued|running|done|failed,
      stage: fetch|check|load|done, stages: {...}, error, log_tail,
      started_at, finished_at, result: {score, passed, failed, resources} }

Safety:
  * Only enabled when SCAN_ENABLED=1 (dev sets it; prod does not).
  * One scan at a time (in-process lock + a DB check for running scans).
  * The project id comes from the stored assessment/cloud account, never from
    the request, and must match the GCP project-id pattern.
  * Subprocesses get argument lists (no shell).
  * A fetch where most services are blocked keeps the previous data.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import shutil
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

BACKEND = Path(__file__).parent
FETCH_DIR = BACKEND / "mcp_fetch"
FETCH_FILE = FETCH_DIR / "gcp_fetch_result.json"
RUN_DIR = BACKEND.parent / ".dev-run"

SCAN_ENABLED = os.getenv("SCAN_ENABLED", "").lower() in ("1", "true", "yes")
PROJECT_RE = re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$")
MIN_READABLE_SERVICES = 20
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
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise ScanError(f"{Path(args[1]).name if len(args) > 1 else args[0]} timed out after {timeout // 60} min")
    text = out.decode("utf-8", errors="replace")
    log.write(f"\n$ {' '.join(args)}\n{text}")
    log.flush()
    if proc.returncode != 0:
        last = (text.strip().splitlines() or [""])[-1]
        raise ScanError(f"{Path(args[1]).name if len(args) > 1 else args[0]} failed "
                        f"(exit {proc.returncode}): {last[:300]}")
    return text


async def mark_interrupted(db):
    """On startup: scans left 'running' by a previous process can never finish."""
    await db["scans"].update_many(
        {"status": {"$in": ["queued", "running"]}},
        {"$set": {"status": "failed", "finished_at": now(),
                  "error": "Interrupted: the backend restarted while this scan was running."}})


async def resolve_target(db, assessment_id: str) -> dict:
    """Look up what to scan from stored data (never from the request)."""
    a = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0})
    if not a:
        raise ScanError("Assessment not found.")
    if (a.get("cloud") or "").lower() != "gcp":
        raise ScanError("Live scanning is only available for GCP assessments so far.")
    acct = await db["cloud_accounts"].find_one({"id": a.get("cloud_account_id")}, {"_id": 0}) or {}
    project = acct.get("gcp_project") or a.get("cloud_account_id") or ""
    if not PROJECT_RE.match(project):
        raise ScanError(f"Stored project id '{project}' is not a valid GCP project id.")
    user_id, org_id = a.get("user_id"), a.get("org_id")
    if not user_id or not org_id:
        raise ScanError("Assessment has no owner (user_id/org_id); cannot load results.")
    return {"project": project, "user_id": user_id, "org_id": org_id}


async def start_scan(db, assessment_id: str) -> dict:
    if not SCAN_ENABLED:
        raise ScanError("Live scanning is disabled on this environment (SCAN_ENABLED is not set).")
    if _lock.locked() or await db["scans"].find_one({"status": {"$in": ["queued", "running"]}}):
        raise ScanError("A scan is already running. Wait for it to finish.")
    target = await resolve_target(db, assessment_id)
    scan = {
        "id": f"SCAN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
        "assessment_id": assessment_id, "project": target["project"],
        "status": "queued", "stage": "fetch",
        "stages": {s: "pending" for s in ("fetch", "check", "load")},
        "error": None, "log_tail": "", "started_at": now(), "finished_at": None, "result": None,
    }
    await db["scans"].insert_one(dict(scan))
    asyncio.create_task(_execute(db, scan["id"], assessment_id, target))
    return scan


async def _set(db, scan_id: str, **fields):
    await db["scans"].update_one({"id": scan_id}, {"$set": fields})


async def _execute(db, scan_id: str, assessment_id: str, target: dict):
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    log_path = RUN_DIR / f"{scan_id}.log"
    tmp = RUN_DIR / f"{scan_id}-fetch.json"
    project = target["project"]
    async with _lock:
        with open(log_path, "w", encoding="utf-8") as log:
            stage = "fetch"
            try:
                await _set(db, scan_id, status="running", stage="fetch", **{"stages.fetch": "running"})
                await _run(["node", "gcp_fetch_all.mjs", "--project", project, "--out", str(tmp)],
                           FETCH_DIR, log, FETCH_TIMEOUT_S)
                fetched = json.loads(tmp.read_text(encoding="utf-8"))
                services = (fetched.get("projects", {}).get(project) or {}).get("services", {})
                readable = sum(1 for v in services.values() if v.get("ok"))
                if readable < MIN_READABLE_SERVICES:
                    raise ScanError(
                        f"Only {readable} services were readable, so the scanner identity lacks access. "
                        "Previous results were kept.")
                shutil.move(str(tmp), str(FETCH_FILE))
                await _set(db, scan_id, **{"stages.fetch": "done", "fetch_services": readable})

                stage = "check"
                await _set(db, scan_id, stage="check", **{"stages.check": "running"})
                await _run([sys.executable, "check_engine.py", "--provider", "gcp"], BACKEND, log, STEP_TIMEOUT_S)
                await _set(db, scan_id, **{"stages.check": "done"})

                stage = "load"
                await _set(db, scan_id, stage="load", **{"stages.load": "running"})
                await _run([sys.executable, "load_assessment_to_db.py",
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
