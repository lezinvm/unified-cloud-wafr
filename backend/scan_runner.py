"""
Live scan runner, for any registered cloud provider (scan_providers.py) and
any number of projects / accounts / subscriptions.

    verify  provider access check (quick, read-only)
    fetch   provider fetcher (official MCP server client), read-only
    check   python check_engine.py --provider <p>
    load    python load_assessment_to_db.py --provider <p> --assessment-id <id>

Started from the API (POST /api/scans) or the CLI:
    python scan_runner.py --assessment-id A-GCP-my-project
    python scan_runner.py --cloud-account-id <stored cloud account id>

A scan targets either an existing assessment or a stored cloud account. For an
account with no assessment yet, one is created (owned by the account's org and
user) and filled by the first successful scan.

Each scan is a document in the `scans` collection so the UI can poll progress:
    { id, assessment_id, cloud_account_id, provider, project,
      status: queued|running|done|failed, stage, stages: {...}, queued_at,
      error, access_hint, log_tail, started_at, finished_at,
      result: {score, passed, failed, resources} }

Queue: scans run one after another (the VM is small). A new scan waits in
`queued` instead of being refused. Only a second scan of the same assessment
is refused while one is queued or running. Queued scans survive a backend
restart; running ones are marked interrupted.

Files: one fetch file per scope (DATA_DIR/<provider>/<scope>.json) and
per-scan temp/result files in RUN_DIR, so scopes never overwrite each other.

Safety:
  * API scans only when SCAN_ENABLED=1 (dev sets it; prod does not).
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
import re
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
VERIFY_TIMEOUT_S = 90
FETCH_TIMEOUT_S = 40 * 60
STEP_TIMEOUT_S = 10 * 60
STAGES = ("verify", "fetch", "check", "load")
ACTIVE = ["queued", "running"]

_worker: asyncio.Task | None = None


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ScanError(Exception):
    def __init__(self, msg: str, hint: str = ""):
        super().__init__(msg)
        self.hint = hint


async def _run(args: list[str], cwd: Path, log, timeout: int) -> str:
    """Run a subprocess, append its output to the log, return the output."""
    proc = await asyncio.create_subprocess_exec(
        *args, cwd=str(cwd), env=os.environ.copy(),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    script = next((a for a in args[1:2] if a.endswith((".py", ".mjs"))), None)
    name = Path(script or args[0]).name
    try:
        out, _ = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        proc.kill()
        await proc.wait()
        raise ScanError(f"{name} timed out after {max(1, timeout // 60)} min")
    text = out.decode("utf-8", errors="replace")
    log.write(f"\n$ {' '.join(args)}\n{text}")
    log.flush()
    if proc.returncode != 0:
        last = (text.strip().splitlines() or [""])[-1]
        raise ScanError(f"{name} failed (exit {proc.returncode}): {last[:300]}")
    return text


# ---- startup ---------------------------------------------------------------

async def mark_interrupted(db):
    """On startup: a scan left 'running' by a previous process can never finish.
    Queued scans are kept and resumed by resume_queue()."""
    await db["scans"].update_many(
        {"status": "running"},
        {"$set": {"status": "failed", "finished_at": now(),
                  "error": "Interrupted: the backend restarted while this scan was running."}})


def resume_queue(db) -> None:
    if SCAN_ENABLED:
        _kick(db)


# ---- target resolution (stored data only) -----------------------------------

def _provider(cloud: str) -> scan_providers.ScanProvider:
    try:
        prov = scan_providers.get(cloud or "")
    except KeyError as e:
        raise ScanError(str(e))
    if not prov.can_scan:
        raise ScanError(f"Live scanning is not available for {prov.label} yet (no fetcher registered).")
    return prov


def _scope(prov, acct: dict, fallback: str = "") -> str:
    scope = prov.account_scope(acct) if acct else ""
    scope = scope or fallback
    if not prov.valid_scope(scope):
        raise ScanError(f"Stored {prov.scope_label} id '{scope}' is not a valid {prov.label} {prov.scope_label} id. "
                        f"Edit the cloud account and set the real {prov.scope_label} id.")
    return scope


async def resolve_target(db, assessment_id: str) -> dict:
    """Provider, scope and owner of an assessment, from stored data."""
    a = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0})
    if not a:
        raise ScanError("Assessment not found.")
    prov = _provider(a.get("cloud") or "")
    acct = await db["cloud_accounts"].find_one({"id": a.get("cloud_account_id")}, {"_id": 0}) or {}
    scope = _scope(prov, acct, fallback=a.get("account_identifier") or a.get("cloud_account_id") or "")
    user_id, org_id = a.get("user_id"), a.get("org_id")
    if not user_id or not org_id:
        raise ScanError("Assessment has no owner (user_id/org_id); cannot load results.")
    return {"provider": prov.name, "project": scope, "user_id": user_id, "org_id": org_id,
            "cloud_account_id": acct.get("id") or a.get("cloud_account_id")}


def _safe_id(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9-]", "-", s)[:40].strip("-")


async def assessment_for_account(db, cloud_account_id: str, org_id: str | None = None) -> str:
    """Latest assessment of a stored cloud account; creates one if none exists."""
    acct = await db["cloud_accounts"].find_one({"id": cloud_account_id}, {"_id": 0})
    if not acct or (org_id and acct.get("org_id") and acct["org_id"] != org_id):
        raise ScanError("Cloud account not found.")
    prov = _provider(acct.get("cloud") or "")
    scope = _scope(prov, acct)
    if not acct.get("user_id") or not acct.get("org_id"):
        raise ScanError("Cloud account has no owner (user_id/org_id).")
    existing = await db["assessments"].find_one(
        {"cloud_account_id": cloud_account_id, "cloud": prov.name, "org_id": acct["org_id"]},
        {"_id": 0, "id": 1}, sort=[("created_at", -1)])
    if existing:
        return existing["id"]
    # Same id scheme as the loader; suffixed with the account id if another
    # account (e.g. another org scanning the same project) already has it.
    aid = f"A-{prov.name.upper()}-{scope}"
    if await db["assessments"].find_one({"id": aid}, {"_id": 1}):
        aid = f"{aid}-{_safe_id(cloud_account_id)}"
    await db["assessments"].update_one({"id": aid}, {"$setOnInsert": {
        "id": aid, "name": f"{prov.label} Live Well-Architected Review — {scope}",
        "cloud": prov.name, "cloud_account_id": cloud_account_id,
        "account_name": acct.get("account_name") or scope, "account_identifier": scope,
        "region": "global", "lens": prov.lens, "status": "running", "placeholder": True,
        "user_id": acct["user_id"], "org_id": acct["org_id"], "source": "live-scan",
        "created_at": now(),
    }}, upsert=True)
    return aid


# ---- start / queue ---------------------------------------------------------

async def start_scan(db, assessment_id: str | None = None, *, cloud_account_id: str | None = None,
                     org_id: str | None = None, background: bool = True,
                     require_enabled: bool = True) -> dict:
    """Queue a scan for an assessment, or for a cloud account (creating its
    assessment on first scan). background=False runs it now and waits."""
    if require_enabled and not SCAN_ENABLED:
        raise ScanError("Live scanning is disabled on this environment (SCAN_ENABLED is not set).")
    if bool(assessment_id) == bool(cloud_account_id):
        raise ScanError("Give exactly one of assessment_id or cloud_account_id.")
    if cloud_account_id:
        # Validate fully before creating anything.
        acct = await db["cloud_accounts"].find_one({"id": cloud_account_id}, {"_id": 0})
        if not acct or (org_id and acct.get("org_id") and acct["org_id"] != org_id):
            raise ScanError("Cloud account not found.")
        _scope(_provider(acct.get("cloud") or ""), acct)
        assessment_id = await assessment_for_account(db, cloud_account_id, org_id)
    target = await resolve_target(db, assessment_id)
    if await db["scans"].find_one({"assessment_id": assessment_id, "status": {"$in": ACTIVE}}, {"_id": 1}):
        raise ScanError("A scan of this assessment is already queued or running.")

    ts = now()
    scan = {
        "id": f"SCAN-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:6]}",
        "assessment_id": assessment_id, "cloud_account_id": target["cloud_account_id"],
        "provider": target["provider"], "project": target["project"],
        "status": "queued", "stage": "verify", "stages": {s: "pending" for s in STAGES},
        "error": None, "access_hint": None, "log_tail": "",
        "queued_at": ts, "started_at": ts, "finished_at": None, "result": None,
    }
    await db["scans"].insert_one(dict(scan))
    scan["queue_position"] = await db["scans"].count_documents(
        {"status": {"$in": ACTIVE}, "queued_at": {"$lt": ts}})
    if background:
        _kick(db)
    else:
        claimed = await _claim(db, {"id": scan["id"]})
        if claimed:
            await _execute(db, claimed)
    return scan


def _kick(db) -> None:
    """Start the queue worker if it isn't running."""
    global _worker
    if _worker is None or _worker.done():
        _worker = asyncio.create_task(_drain(db))


async def _claim(db, query: dict) -> dict | None:
    return await db["scans"].find_one_and_update(
        {**query, "status": "queued"},
        {"$set": {"status": "running", "started_at": now()}},
        sort=[("queued_at", 1)], projection={"_id": 0}, return_document=True)


async def _drain(db) -> None:
    while True:
        scan = await _claim(db, {})
        if not scan:
            return
        try:
            await _execute(db, scan)
        except Exception as e:  # noqa: BLE001 - never let one scan stop the queue
            await _set(db, scan["id"], status="failed", finished_at=now(), error=f"{type(e).__name__}: {e}")


async def _set(db, scan_id: str, **fields):
    await db["scans"].update_one({"id": scan_id}, {"$set": fields})


# ---- execution -------------------------------------------------------------

async def _execute(db, scan: dict) -> None:
    scan_id, assessment_id = scan["id"], scan["assessment_id"]
    RUN_DIR.mkdir(parents=True, exist_ok=True)
    log_path = RUN_DIR / f"{scan_id}.log"
    tmp = RUN_DIR / f"{scan_id}-fetch.json"
    result_file = RUN_DIR / f"{scan_id}-result.json"
    stage = "verify"
    with open(log_path, "w", encoding="utf-8") as log:
        try:
            # Re-resolve at run time: the account may have changed while queued.
            target = await resolve_target(db, assessment_id)
            prov = scan_providers.get(target["provider"])
            scope = target["project"]
            await _set(db, scan_id, stage="verify", project=scope, **{"stages.verify": "running"})
            if prov.verify_cmd:
                try:
                    await _run(prov.verify_cmd(scope), BACKEND, log, VERIFY_TIMEOUT_S)
                except ScanError as e:
                    raise ScanError(f"The scanner cannot read {prov.label} {prov.scope_label} '{scope}' "
                                    f"({e}).", prov.hint(scope))
            await _set(db, scan_id, **{"stages.verify": "done"})

            stage = "fetch"
            await _set(db, scan_id, stage="fetch", **{"stages.fetch": "running"})
            await _run(prov.fetch_cmd(scope, tmp), scan_providers.FETCH_DIR, log, FETCH_TIMEOUT_S)
            fetched = json.loads(tmp.read_text(encoding="utf-8"))
            services = ((fetched.get(prov.scope_key) or {}).get(scope) or {}).get("services", {})
            readable = sum(1 for v in services.values() if v.get("ok"))
            if readable < prov.min_readable_services:
                raise ScanError(
                    f"Only {readable} services were readable, so the scanner identity lacks access "
                    f"to this {prov.scope_label}. Previous results were kept.", prov.hint(scope))
            fetch_file = prov.fetch_path(scope)
            fetch_file.parent.mkdir(parents=True, exist_ok=True)
            os.replace(tmp, fetch_file)
            await _set(db, scan_id, **{"stages.fetch": "done", "fetch_services": readable})

            stage = "check"
            await _set(db, scan_id, stage="check", **{"stages.check": "running"})
            await _run([sys.executable, "check_engine.py", "--provider", prov.name,
                        "--data", str(fetch_file), "--out", str(result_file)],
                       BACKEND, log, STEP_TIMEOUT_S)
            await _set(db, scan_id, **{"stages.check": "done"})

            stage = "load"
            await _set(db, scan_id, stage="load", **{"stages.load": "running"})
            load = [sys.executable, "load_assessment_to_db.py", "--provider", prov.name,
                    "--result", str(result_file), "--fetch", str(fetch_file),
                    "--assessment-id", assessment_id,
                    "--user-id", target["user_id"], "--org-id", target["org_id"], "--real-only"]
            if target.get("cloud_account_id"):
                load += ["--cloud-account-id", str(target["cloud_account_id"])]
            await _run(load, BACKEND, log, STEP_TIMEOUT_S)
            await db["assessments"].update_one({"id": assessment_id},
                                               {"$unset": {"placeholder": "", "scan_error": ""}})

            a = await db["assessments"].find_one({"id": assessment_id}, {"_id": 0}) or {}
            await _set(db, scan_id, status="done", stage="done", finished_at=now(),
                       **{"stages.load": "done"},
                       result={"score": a.get("score"), "passed": a.get("passed_checks"),
                               "failed": a.get("failed_checks"),
                               "resources": a.get("resources_scanned")})
            if result_file.exists():
                result_file.unlink()
        except Exception as e:  # noqa: BLE001 - record any failure on the scan doc
            msg = str(e) if isinstance(e, ScanError) else f"{type(e).__name__}: {e}"
            hint = getattr(e, "hint", "") or None
            log.write(f"\nERROR: {msg}\n" + (f"HINT: {hint}\n" if hint else ""))
            await _set(db, scan_id, status="failed", finished_at=now(), error=msg, access_hint=hint,
                       **{f"stages.{stage}": "failed"})
            # An assessment created for this scan but never filled shows the error.
            await db["assessments"].update_one({"id": assessment_id, "placeholder": True},
                                               {"$set": {"status": "failed", "scan_error": msg}})
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
    ap = argparse.ArgumentParser(description="Run a live scan for one assessment or cloud account.")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--assessment-id")
    g.add_argument("--cloud-account-id")
    args = ap.parse_args()

    from motor.motor_asyncio import AsyncIOMotorClient
    db = AsyncIOMotorClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))[os.getenv("DB_NAME", "wafr_db")]

    async def go():
        scan = await start_scan(db, args.assessment_id, cloud_account_id=args.cloud_account_id,
                                background=False, require_enabled=False)
        doc = await db["scans"].find_one({"id": scan["id"]}, {"_id": 0})
        print(f"scan {doc['id']}: {doc['status']} ({doc['provider']} {doc['project']} -> {doc['assessment_id']})")
        if doc.get("fetch_services") is not None:
            print(f"  services readable: {doc['fetch_services']}")
        if doc["status"] == "done":
            r = doc["result"]
            print(f"  score={r['score']} passed={r['passed']} failed={r['failed']} resources={r['resources']}")
        else:
            print(f"  error: {doc['error']}")
            if doc.get("access_hint"):
                print(f"  fix:   {doc['access_hint']}")
            print(f"  log:   {RUN_DIR / (doc['id'] + '.log')}")
            sys.exit(1)

    asyncio.run(go())


if __name__ == "__main__":
    _cli()
