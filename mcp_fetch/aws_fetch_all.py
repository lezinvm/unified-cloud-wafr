"""
AWS ALL-SERVICES fetcher via the OFFICIAL awslabs.aws-api-mcp-server.

1. Verifies the server, discovers the caller identity (sts get-caller-identity).
2. Discovers all enabled regions (ec2 describe-regions) unless --regions is given.
3. Runs a read-only FETCH_PLAN: global services once, regional services in EVERY region.
4. Enriches with per-resource configuration (S3 bucket settings, IAM credential
   report, KMS key rotation, CloudTrail status).
5. Writes one combined JSON (aws_fetch_result.json), saved atomically after every step.

Fetch-only (no pass/fail logic, no writes). The LENS scanner/checks read the output.

Output schema (per entry in result["services"]):
  scope      "global" | "regional"
  ok         True only if nothing failed (a legitimate "not found", e.g. no password
             policy, is NOT a failure; it is listed under "notFound")
  partial    True if some targets succeeded and some failed
  count      total item count (None when not derivable)
  data       global: the response; regional: {region: response}
  errors     {target: {"error": full text, "kind": access_denied|not_found|timeout|other}}
  truncated  True if the server flagged a truncated response
result["complete"] is False until the run finishes: checks should refuse incomplete files.

Exit codes: 0 = all OK, 1 = finished with failures (use --allow-partial to get 0), 2 = fatal.

Usage:
  python aws_fetch_all.py
  python aws_fetch_all.py --out aws_fetch_result.json --regions us-east-1,eu-west-1
  python aws_fetch_all.py --server-version 1.2.3     # pin (recorded in the output either way)
  python aws_fetch_all.py --list-tools               # dump tool schemas to <out>.tools.json
"""

import argparse
import base64
import csv
import io
import json
import os
import re
import shlex
import sys
import time
from datetime import datetime, timezone

import queue
import shutil
import signal
import subprocess
import threading


# ==========================================================================
# Embedded minimal MCP client (JSON-RPC 2.0 over stdio): real timeouts, ping handling,
# process-tree cleanup, atomic 0600 JSON writes. Self-contained: no extra files needed.
# ==========================================================================

class McpError(Exception):
    """Any MCP / JSON-RPC level failure."""


class McpTimeout(McpError):
    """No response within the allotted time."""


class McpServerExited(McpError):
    """The server process died or closed stdout."""


def setup_console():
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass


def short(text, limit=160):
    text = str(text).replace("\n", " ")
    return text if len(text) <= limit else text[: limit - 3] + "..."


def write_json_atomic(path, obj):
    """Write JSON to `path` atomically with owner-only permissions."""
    tmp = f"{path}.tmp"
    fd = os.open(tmp, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    try:
        os.chmod(tmp, 0o600)
    except Exception:
        pass
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, default=str)
    os.replace(tmp, path)


def tool_text(result):
    """First text block of an MCP tools/call result ('' if none)."""
    for block in (result or {}).get("content", []) or []:
        if isinstance(block, dict) and block.get("type", "text") == "text":
            return block.get("text", "") or ""
    return ""


class McpClient:
    def __init__(self, cmd, env=None, stderr_path=None,
                 client_name="lens-fetch", client_version="2.0.0"):
        if not cmd:
            raise McpError("Empty server command")
        resolved = shutil.which(cmd[0])
        if not resolved:
            raise McpError(f"'{cmd[0]}' was not found on PATH")
        self.cmd = [resolved] + list(cmd[1:])
        self.env = dict(os.environ)
        self.env.update(env or {})
        self.stderr_path = stderr_path
        self.client_name = client_name
        self.client_version = client_version
        self.proc = None
        self.server_info = {}
        self._q = queue.Queue()
        self._id = 0
        self._stderr_file = None
        self._reader = None

    # ------------------------------------------------------------------ lifecycle
    def start(self):
        if self.stderr_path:
            self._stderr_file = open(self.stderr_path, "ab")
            stderr = self._stderr_file
        else:
            stderr = subprocess.DEVNULL
        kwargs = {}
        if os.name == "nt":
            kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
        else:
            kwargs["start_new_session"] = True
        self.proc = subprocess.Popen(
            self.cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=stderr,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=self.env,
            **kwargs,
        )
        self._reader = threading.Thread(target=self._read_loop, daemon=True)
        self._reader.start()

    def _read_loop(self):
        try:
            for line in self.proc.stdout:
                self._q.put(line)
        except Exception:
            pass
        finally:
            self._q.put(None)  # EOF sentinel

    def alive(self):
        return self.proc is not None and self.proc.poll() is None

    def close(self):
        proc = self.proc
        if proc is None:
            return
        try:
            proc.stdin.close()
        except Exception:
            pass
        try:
            proc.wait(timeout=2)
        except Exception:
            self._kill_tree()
        try:
            proc.wait(timeout=10)
        except Exception:
            pass
        if self._stderr_file:
            try:
                self._stderr_file.close()
            except Exception:
                pass
        self.proc = None

    def _kill_tree(self):
        proc = self.proc
        if proc is None or proc.poll() is not None:
            return
        try:
            if os.name == "nt":
                subprocess.run(["taskkill", "/PID", str(proc.pid), "/T", "/F"],
                               capture_output=True)
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
                try:
                    proc.wait(timeout=5)
                except Exception:
                    os.killpg(os.getpgid(proc.pid), signal.SIGKILL)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    def __enter__(self):
        self.start()
        return self

    def __exit__(self, *exc):
        self.close()
        return False

    # ------------------------------------------------------------------ transport
    def _send(self, obj):
        if not self.alive():
            raise McpServerExited("MCP server process is not running")
        try:
            self.proc.stdin.write(json.dumps(obj) + "\n")
            self.proc.stdin.flush()
        except (BrokenPipeError, OSError, ValueError) as e:
            raise McpServerExited(f"Cannot write to MCP server: {e}")

    def notify(self, method, params=None):
        msg = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            msg["params"] = params
        self._send(msg)

    def request(self, method, params=None, timeout=60):
        self._id += 1
        rid = self._id
        msg = {"jsonrpc": "2.0", "id": rid, "method": method}
        if params is not None:
            msg["params"] = params
        self._send(msg)

        deadline = time.monotonic() + timeout
        while True:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise McpTimeout(f"{method}: no response within {timeout}s")
            try:
                line = self._q.get(timeout=remaining)
            except queue.Empty:
                raise McpTimeout(f"{method}: no response within {timeout}s")
            if line is None:
                self._q.put(None)
                raise McpServerExited("MCP server closed its output (exited)")
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except ValueError:
                continue  # non-JSON noise on stdout
            if not isinstance(data, dict):
                continue
            if data.get("id") == rid and ("result" in data or "error" in data) \
                    and "method" not in data:
                return data
            # Server -> client request (e.g. ping): answer so the server never stalls.
            if "method" in data and "id" in data:
                if data["method"] == "ping":
                    self._send({"jsonrpc": "2.0", "id": data["id"], "result": {}})
                else:
                    self._send({"jsonrpc": "2.0", "id": data["id"],
                                "error": {"code": -32601, "message": "Method not found"}})
            # anything else (notifications, late responses to timed-out calls) is dropped

    @staticmethod
    def _result(msg):
        if "error" in msg:
            err = msg["error"] or {}
            raise McpError(f"JSON-RPC error {err.get('code')}: {err.get('message')}")
        return msg.get("result") or {}

    # ------------------------------------------------------------------ MCP API
    def initialize(self, timeout=180):
        res = self._result(self.request("initialize", {
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {"name": self.client_name, "version": self.client_version},
        }, timeout=timeout))
        self.server_info = res.get("serverInfo", {}) or {}
        self.notify("notifications/initialized")
        return res

    def list_tools(self, timeout=60):
        """Returns {tool_name: tool_definition}, following pagination cursors."""
        tools = {}
        cursor = None
        while True:
            params = {"cursor": cursor} if cursor else {}
            res = self._result(self.request("tools/list", params, timeout=timeout))
            for tool in res.get("tools", []) or []:
                if isinstance(tool, dict) and tool.get("name"):
                    tools[tool["name"]] = tool
            cursor = res.get("nextCursor")
            if not cursor:
                return tools

    def call_tool(self, name, arguments, timeout=120):
        return self._result(self.request(
            "tools/call", {"name": name, "arguments": arguments}, timeout=timeout))


# ==========================================================================
# Fetcher
# ==========================================================================

SERVER_PKG = "awslabs.aws-api-mcp-server"

# scope: "global" runs once; "regional" runs in every region.
FETCH_PLAN = [
    # IAM & Account Governance (global)
    {"key": "iam_account_summary", "cmd": "aws iam get-account-summary", "scope": "global"},
    {"key": "iam_password_policy", "cmd": "aws iam get-account-password-policy", "scope": "global"},
    {"key": "iam_users", "cmd": "aws iam list-users", "scope": "global"},
    {"key": "iam_roles", "cmd": "aws iam list-roles", "scope": "global"},
    {"key": "iam_mfa_devices", "cmd": "aws iam list-virtual-mfa-devices", "scope": "global"},
    {"key": "iam_local_policies", "cmd": "aws iam list-policies --scope Local", "scope": "global"},

    # Storage (global listing)
    {"key": "s3_buckets", "cmd": "aws s3api list-buckets", "scope": "global"},

    # Compute & block storage
    {"key": "ec2_instances", "cmd": "aws ec2 describe-instances", "scope": "regional"},
    {"key": "ec2_ebs_volumes", "cmd": "aws ec2 describe-volumes", "scope": "regional"},
    {"key": "ec2_ebs_snapshots", "cmd": "aws ec2 describe-snapshots --owner-ids self", "scope": "regional"},
    {"key": "ec2_ebs_default_encryption", "cmd": "aws ec2 get-ebs-encryption-by-default", "scope": "regional"},

    # Network & perimeter
    {"key": "vpc_networks", "cmd": "aws ec2 describe-vpcs", "scope": "regional"},
    {"key": "vpc_subnets", "cmd": "aws ec2 describe-subnets", "scope": "regional"},
    {"key": "vpc_flow_logs", "cmd": "aws ec2 describe-flow-logs", "scope": "regional"},
    {"key": "security_groups", "cmd": "aws ec2 describe-security-groups", "scope": "regional"},
    {"key": "route_tables", "cmd": "aws ec2 describe-route-tables", "scope": "regional"},
    {"key": "internet_gateways", "cmd": "aws ec2 describe-internet-gateways", "scope": "regional"},
    {"key": "elastic_ips", "cmd": "aws ec2 describe-addresses", "scope": "regional"},

    # Databases
    {"key": "rds_instances", "cmd": "aws rds describe-db-instances", "scope": "regional"},
    {"key": "rds_clusters", "cmd": "aws rds describe-db-clusters", "scope": "regional"},
    {"key": "dynamodb_tables", "cmd": "aws dynamodb list-tables", "scope": "regional"},

    # Logging, audit & threat detection
    {"key": "cloudtrail_trails", "cmd": "aws cloudtrail describe-trails", "scope": "regional"},
    {"key": "cloudwatch_alarms", "cmd": "aws cloudwatch describe-alarms", "scope": "regional"},
    {"key": "guardduty_detectors", "cmd": "aws guardduty list-detectors", "scope": "regional"},
    {"key": "config_recorders", "cmd": "aws configservice describe-configuration-recorders", "scope": "regional"},
    {"key": "accessanalyzer_analyzers", "cmd": "aws accessanalyzer list-analyzers", "scope": "regional"},

    # Cryptography
    {"key": "kms_keys", "cmd": "aws kms list-keys", "scope": "regional"},
    {"key": "kms_aliases", "cmd": "aws kms list-aliases", "scope": "regional"},

    # Containers & serverless & messaging
    {"key": "eks_clusters", "cmd": "aws eks list-clusters", "scope": "regional"},
    {"key": "ecr_repositories", "cmd": "aws ecr describe-repositories", "scope": "regional"},
    {"key": "lambda_functions", "cmd": "aws lambda list-functions", "scope": "regional"},
    {"key": "sns_topics", "cmd": "aws sns list-topics", "scope": "regional"},
    {"key": "sqs_queues", "cmd": "aws sqs list-queues", "scope": "regional"},
]

S3_CHECKS = [
    ("public_access_block", "get-public-access-block"),
    ("encryption", "get-bucket-encryption"),
    ("versioning", "get-bucket-versioning"),
    ("logging", "get-bucket-logging"),
    ("policy_status", "get-bucket-policy-status"),
]

SAFE_NAME = re.compile(r"^[A-Za-z0-9._:/@=+\-]+$")


class FatalError(Exception):
    pass


# ----------------------------------------------------------------------------- helpers
def classify(err):
    e = str(err).lower()
    if any(k in e for k in ("accessdenied", "unauthorizedoperation", "unauthorizedaccess",
                            "not authorized", "access denied")):
        return "access_denied"
    if re.search(r"nosuch|notfound|reportnotpresent", e):
        return "not_found"
    return "other"


def fail(msg, kind=None):
    return {"ok": False, "data": None, "error": str(msg),
            "error_kind": kind or classify(msg), "truncated": False}


def good(data, truncated=False):
    return {"ok": True, "data": data, "error": None, "error_kind": None, "truncated": truncated}


def parse_aws_result(res):
    if res.get("isError"):
        return fail(tool_text(res) or "MCP tool error")
    resp = None
    sc = res.get("structuredContent")
    if isinstance(sc, dict):
        items = sc.get("result")
        if isinstance(items, list) and items and isinstance(items[0], dict):
            resp = items[0].get("response", items[0])
        elif isinstance(items, dict):
            resp = items.get("response", items)
    if resp is None:
        text = tool_text(res)
        if not text:
            return fail("Malformed or empty MCP response", "other")
        try:
            return good(json.loads(text))
        except ValueError:
            return good(text)
    if isinstance(resp, dict):
        if resp.get("error"):
            return fail(resp["error"])
        raw = resp.get("as_json")
        if raw is not None:
            try:
                data = json.loads(raw) if isinstance(raw, str) else raw
            except ValueError as e:
                return fail(f"JSON parse error: {e}", "other")
            return good(data, truncated=bool(resp.get("truncated")))
    return good(resp)


def count_items(data):
    if isinstance(data, list):
        return len(data)
    if isinstance(data, dict):
        lists = [v for v in data.values() if isinstance(v, list)]
        if len(lists) == 1:
            return len(lists[0])
    return None


def slim(r):
    out = {"ok": r["ok"], "data": r["data"]}
    if not r["ok"]:
        out["error"] = r["error"]
        out["kind"] = r["error_kind"]
    return out


def is_failure(r):
    return (not r["ok"]) and r["error_kind"] != "not_found"


def aggregate(scope, per_target):
    """per_target: {target: raw result}. Builds one uniform services entry."""
    errors, not_found, data, counts = {}, [], {}, []
    truncated = False
    n_ok = n_fail = 0
    for target, r in per_target.items():
        if r["ok"]:
            n_ok += 1
            data[target] = r["data"]
            c = count_items(r["data"])
            if c is not None:
                counts.append(c)
            truncated = truncated or r.get("truncated", False)
        elif r["error_kind"] == "not_found":
            n_ok += 1
            not_found.append(target)
            errors[target] = {"error": r["error"], "kind": "not_found"}
        else:
            n_fail += 1
            errors[target] = {"error": r["error"], "kind": r["error_kind"]}
    entry = {
        "scope": scope,
        "ok": n_fail == 0,
        "partial": n_fail > 0 and n_ok > 0,
        "count": sum(counts) if counts else None,
        "data": data.get("global") if scope == "global" else data,
        "errors": errors or None,
        "notFound": not_found or None,
        "truncated": truncated,
    }
    return entry


def detail_entry(data, failures):
    return {"scope": "detail", "ok": not failures, "partial": bool(failures) and bool(data),
            "count": len(data), "data": data, "errors": failures or None,
            "notFound": None, "truncated": False}


# ----------------------------------------------------------------------------- main
def main():
    setup_console()
    default_out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aws_fetch_result.json")
    ap = argparse.ArgumentParser(description="AWS All-Services Fetcher via Official AWS API MCP Server")
    ap.add_argument("--out", default=default_out, help="Output JSON path")
    ap.add_argument("--regions", help="Comma-separated regions (default: all enabled regions)")
    ap.add_argument("--profile", help="AWS profile name for the MCP server")
    ap.add_argument("--server-version", default=os.environ.get("AWS_MCP_VERSION"),
                    help="Pin awslabs.aws-api-mcp-server to this version (or env AWS_MCP_VERSION)")
    ap.add_argument("--server-cmd", help="Override the launch command (testing / offline use)")
    ap.add_argument("--timeout", type=int, default=120, help="Per-call timeout in seconds")
    ap.add_argument("--init-timeout", type=int, default=300,
                    help="Startup timeout (first run downloads the server)")
    ap.add_argument("--skip-details", action="store_true", help="Skip per-resource detail calls")
    ap.add_argument("--allow-partial", action="store_true", help="Exit 0 even if some calls failed")
    ap.add_argument("--list-tools", action="store_true", help="Dump tool schemas and exit")
    args = ap.parse_args()

    print("=" * 70, flush=True)
    print("  AWS ALL-SERVICES FETCHER (OFFICIAL AWS API MCP SERVER)", flush=True)
    print("=" * 70, flush=True)

    if args.server_cmd:
        cmd = shlex.split(args.server_cmd)
    else:
        pkg = f"{SERVER_PKG}=={args.server_version}" if args.server_version else SERVER_PKG
        cmd = ["uvx", pkg]
        if not args.server_version:
            print("[!] Server version is not pinned; the exact version used is recorded in the "
                  "output. Pin it with --server-version.", flush=True)

    primary_region = (os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION")
                      or "us-east-1")
    env = {"READ_OPERATIONS_ONLY": "true", "AWS_REGION": primary_region}
    if args.profile:
        env["AWS_API_MCP_PROFILE_NAME"] = args.profile

    result = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "cloud": "aws",
        "complete": False,
        "accountId": "unknown",
        "callerArn": "unknown",
        "primaryRegion": primary_region,
        "regions": [],
        "readOperationsOnly": True,
        "serverInfo": {},
        "serverVersionRequested": args.server_version,
        "serviceCount": len(FETCH_PLAN),
        "services": {},
    }
    save_warned = [False]

    def save():
        try:
            write_json_atomic(args.out, result)
        except Exception as e:
            if not save_warned[0]:
                print(f"  [!] Could not save {args.out}: {e}", flush=True)
                save_warned[0] = True

    client = None
    exit_code = 0
    try:
        try:
            client = McpClient(cmd, env=env, stderr_path=args.out + ".stderr.log",
                               client_name="lens-aws-fetch")
            client.start()
            print(f"[*] Starting MCP server: {' '.join(cmd)}", flush=True)
            client.initialize(timeout=args.init_timeout)
        except McpError as e:
            raise FatalError(f"MCP server failed to start/handshake: {e} "
                             f"(see {args.out}.stderr.log)")
        result["serverInfo"] = client.server_info
        print(f"  [+] Connected: {client.server_info.get('name')} "
              f"(v{client.server_info.get('version')})", flush=True)

        try:
            tools = client.list_tools()
        except McpError as e:
            raise FatalError(f"tools/list failed: {e}")

        if args.list_tools:
            path = args.out + ".tools.json"
            write_json_atomic(path, list(tools.values()))
            print(f"  [+] {len(tools)} tools written to {path}", flush=True)
            return 0
        if "call_aws" not in tools:
            raise FatalError(f"Server does not expose 'call_aws' (tools: {sorted(tools)})")

        def run(cli, region=None):
            full = f"{cli} --region {region}" if region else cli
            try:
                res = client.call_tool("call_aws", {"cli_command": full}, timeout=args.timeout)
            except McpServerExited as e:
                raise FatalError(str(e))
            except McpTimeout:
                return fail(f"Timeout after {args.timeout}s", "timeout")
            except McpError as e:
                return fail(str(e), "other")
            return parse_aws_result(res)

        # ---- identity (fail fast)
        print("\n[*] Discovering AWS account identity...", flush=True)
        sts = run("aws sts get-caller-identity")
        if not sts["ok"] or not isinstance(sts["data"], dict) or not sts["data"].get("Account"):
            raise FatalError(f"STS get-caller-identity failed: {sts['error']}")
        result["accountId"] = sts["data"]["Account"]
        result["callerArn"] = sts["data"].get("Arn", "unknown")
        print(f"  [+] Account:  {result['accountId']}", flush=True)
        print(f"  [+] Identity: {result['callerArn']}", flush=True)

        # ---- regions (fail fast)
        if args.regions:
            regions = [r.strip() for r in args.regions.split(",") if r.strip()]
        else:
            rr = run("aws ec2 describe-regions")
            if not rr["ok"] or not isinstance(rr["data"], dict):
                raise FatalError("Region discovery failed (a single-region scan would silently "
                                 f"miss resources); pass --regions to override: {rr['error']}")
            regions = sorted(r["RegionName"] for r in rr["data"].get("Regions", []))
        if not regions:
            raise FatalError("No regions to scan")
        result["regions"] = regions
        print(f"  [+] Regions ({len(regions)}): {', '.join(regions)}", flush=True)
        planned = sum(1 if e["scope"] == "global" else len(regions) for e in FETCH_PLAN)
        print(f"  [+] Planned main calls: {planned} (sequential). Use --regions to narrow a scan.",
              flush=True)
        save()

        # ---- main plan
        total = len(FETCH_PLAN)
        print(f"\n=== AWS ACCOUNT {result['accountId']} ({total} services) ===", flush=True)
        for idx, entry in enumerate(FETCH_PLAN, start=1):
            key, scope = entry["key"], entry["scope"]
            targets = ["global"] if scope == "global" else regions
            per_target = {}
            for t in targets:
                per_target[t] = run(entry["cmd"], None if scope == "global" else t)
            agg = aggregate(scope, per_target)
            result["services"][key] = agg
            state = "OK" if agg["ok"] else ("PARTIAL" if agg["partial"] else "FAILED")
            extra = f", {len(agg['errors'])} target error(s)" if agg["errors"] else ""
            print(f"  [{idx:02d}/{total}] {key}: {state} (count={agg['count']}{extra})", flush=True)
            if agg["errors"] and not agg["ok"]:
                first = next(iter(agg["errors"].items()))
                print(f"          first error [{first[0]}]: {short(first[1]['error'], 110)}", flush=True)
            save()

        # ---- details
        if not args.skip_details:
            print("\n[*] Fetching per-resource configuration...", flush=True)

            # IAM credential report
            cr_failures = {}
            gen = run("aws iam generate-credential-report")  # may be blocked by read-only mode
            report = None
            last = None
            for _ in range(10):
                last = run("aws iam get-credential-report")
                if last["ok"]:
                    report = last["data"]
                    break
                err = str(last["error"]).lower().replace(" ", "")
                if "inprogress" in err or "notready" in err or ("reportnotpresent" in err and gen["ok"]):
                    time.sleep(3)
                    continue
                break
            cr_data = {}
            if report and isinstance(report, dict) and report.get("Content"):
                content = report["Content"]
                try:
                    text = base64.b64decode(content, validate=True).decode("utf-8")
                except Exception:
                    text = content
                rows = list(csv.DictReader(io.StringIO(text)))
                cr_data = {"generatedTime": report.get("GeneratedTime"), "rows": rows}
            else:
                msg = (last or {}).get("error") or "empty credential report"
                if not gen["ok"]:
                    msg = f"{msg} (generate-credential-report: {gen['error']})"
                cr_failures["global"] = {"error": msg, "kind": (last or {}).get("error_kind", "other")}
            result["services"]["iam_credential_report"] = {
                "scope": "detail", "ok": not cr_failures, "partial": False,
                "count": len(cr_data.get("rows", [])), "data": cr_data or None,
                "errors": cr_failures or None, "notFound": None, "truncated": False}
            print(f"  - iam_credential_report: {'OK' if not cr_failures else 'FAILED'}", flush=True)
            save()

            # S3 per-bucket configuration
            s3 = result["services"].get("s3_buckets", {})
            buckets = []
            if s3.get("ok") and isinstance(s3.get("data"), dict):
                buckets = [b.get("Name") for b in s3["data"].get("Buckets", []) if b.get("Name")]
            s3_data, s3_fail = {}, {}
            for name in buckets:
                if not SAFE_NAME.match(name):
                    s3_fail[name] = {"error": "Unsafe bucket name, skipped", "kind": "other"}
                    continue
                loc = run(f"aws s3api get-bucket-location --bucket {name}")
                bregion = primary_region
                if loc["ok"] and isinstance(loc["data"], dict):
                    lc = loc["data"].get("LocationConstraint")
                    bregion = "us-east-1" if not lc else ("eu-west-1" if lc == "EU" else lc)
                elif is_failure(loc):
                    s3_fail[f"{name}/location"] = {"error": loc["error"], "kind": loc["error_kind"]}
                rec = {"region": bregion}
                for label, sub in S3_CHECKS:
                    r = run(f"aws s3api {sub} --bucket {name}", bregion)
                    rec[label] = slim(r)
                    if is_failure(r):
                        s3_fail[f"{name}/{label}"] = {"error": r["error"], "kind": r["error_kind"]}
                s3_data[name] = rec
            result["services"]["s3_bucket_details"] = detail_entry(s3_data, s3_fail)
            print(f"  - s3_bucket_details: {len(s3_data)} bucket(s), {len(s3_fail)} error(s)", flush=True)
            save()

            # KMS rotation
            kms_data, kms_fail = {}, {}
            kms = result["services"].get("kms_keys", {})
            for region, kd in (kms.get("data") or {}).items():
                for k in (kd or {}).get("Keys", []):
                    kid = k.get("KeyId")
                    if not kid or not SAFE_NAME.match(kid):
                        continue
                    d = run(f"aws kms describe-key --key-id {kid}", region)
                    rec = {"describe": slim(d)}
                    if is_failure(d):
                        kms_fail[f"{region}/{kid}"] = {"error": d["error"], "kind": d["error_kind"]}
                    meta = (d["data"] or {}).get("KeyMetadata", {}) if d["ok"] else {}
                    if (meta.get("KeyManager") == "CUSTOMER" and meta.get("KeyState") == "Enabled"
                            and meta.get("KeySpec", "SYMMETRIC_DEFAULT") == "SYMMETRIC_DEFAULT"
                            and meta.get("Origin", "AWS_KMS") == "AWS_KMS"):
                        rot = run(f"aws kms get-key-rotation-status --key-id {kid}", region)
                        rec["rotation"] = slim(rot)
                        if is_failure(rot):
                            kms_fail[f"{region}/{kid}/rotation"] = {"error": rot["error"],
                                                                      "kind": rot["error_kind"]}
                    kms_data[f"{region}/{kid}"] = rec
            result["services"]["kms_key_details"] = detail_entry(kms_data, kms_fail)
            print(f"  - kms_key_details: {len(kms_data)} key(s), {len(kms_fail)} error(s)", flush=True)
            save()

            # CloudTrail status (query each trail once, in its home region)
            ct_data, ct_fail = {}, {}
            ct = result["services"].get("cloudtrail_trails", {})
            for region, td in (ct.get("data") or {}).items():
                for trail in (td or {}).get("trailList", []):
                    arn = trail.get("TrailARN")
                    if trail.get("HomeRegion", region) != region or not arn or not SAFE_NAME.match(arn):
                        continue
                    r = run(f"aws cloudtrail get-trail-status --name {arn}", region)
                    ct_data[arn] = slim(r)
                    if is_failure(r):
                        ct_fail[arn] = {"error": r["error"], "kind": r["error_kind"]}
            result["services"]["cloudtrail_status"] = detail_entry(ct_data, ct_fail)
            print(f"  - cloudtrail_status: {len(ct_data)} trail(s), {len(ct_fail)} error(s)", flush=True)
            save()

        # ---- finalize
        failed = [k for k, v in result["services"].items() if not v["ok"] and not v["partial"]]
        partial = [k for k, v in result["services"].items() if v["partial"]]
        denied = sorted({k for k, v in result["services"].items()
                         for e in (v["errors"] or {}).values() if e["kind"] == "access_denied"})
        result["summary"] = {"failed": failed, "partial": partial, "accessDenied": denied}
        result["complete"] = True
        save()
        if (failed or partial) and not args.allow_partial:
            exit_code = 1

    except FatalError as e:
        print(f"\n[FATAL] {e}", flush=True)
        result["fatalError"] = str(e)
        save()
        return 2
    except KeyboardInterrupt:
        print("\n[!] Interrupted; partial results saved (complete=false).", flush=True)
        result["fatalError"] = "Interrupted"
        save()
        return 2
    finally:
        if client:
            client.close()

    # ---- summary
    print("\n" + "=" * 70, flush=True)
    print("                      SUMMARY", flush=True)
    print("=" * 70, flush=True)
    print(f"Account:   {result['accountId']}", flush=True)
    print(f"Regions:   {len(result['regions'])}", flush=True)
    with_data = [f"{k}={v['count']}" for k, v in result["services"].items()
                 if v.get("count")]
    print("Services with data: " + (", ".join(with_data) if with_data else "(none)"), flush=True)
    s = result["summary"]
    print(f"Failed:    {', '.join(s['failed']) or '-'}", flush=True)
    print(f"Partial:   {', '.join(s['partial']) or '-'}", flush=True)
    print(f"Access denied in: {', '.join(s['accessDenied']) or '-'}", flush=True)
    print(f"Full data written to: {args.out}", flush=True)
    print("=" * 70, flush=True)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
