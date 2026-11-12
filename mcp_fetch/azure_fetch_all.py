"""
Azure ALL-SERVICES fetcher via the OFFICIAL Microsoft Azure MCP Server (@azure/mcp).

1. Verifies the server and lists subscriptions (subscription_list).
2. For EACH selected subscription (default: all; see --subscription / --default-only):
   a. Resource groups (group_list)
   b. Resource inventory per resource group (group_resource_list)
   c. RBAC role assignments (role_assignment_list)
   d. Azure Advisor / WAFR recommendations (advisor_recommendation_list)
3. Writes one combined JSON (azure_fetch_result.json), saved atomically after every step.

Fetch-only (no pass/fail logic, no writes). The LENS scanner/checks read the output.

Output schema:
  result["subscriptions"] = [ {subscriptionId, subscriptionName, tenantId, isDefault,
                               services: {resource_groups, all_resources,
                                          role_assignments, advisor_recommendations}} ]
  Each service entry: ok, partial, count, data, errors ({target: {error, kind}}), truncated.
  `ok` is True only if nothing failed. result["complete"] is False until the run finishes:
  checks should refuse incomplete files.
  NOTE: group_resource_list returns inventory metadata (name/type/id/location), not
  per-resource configuration. Use --list-tools to dump the server's tool schemas
  (<out>.tools.json) when adding per-service configuration calls.

Exit codes: 0 = all OK, 1 = finished with failures (use --allow-partial to get 0), 2 = fatal.

Usage:
  python azure_fetch_all.py
  python azure_fetch_all.py --out azure_fetch_result.json
  python azure_fetch_all.py --subscription <id-or-name> [--subscription ...]
  python azure_fetch_all.py --default-only
  python azure_fetch_all.py --server-version 1.2.3    # pin (recorded in the output either way)
"""

import argparse
import json
import os
import re
import shlex
import sys
from datetime import datetime, timezone

import queue
import shutil
import signal
import subprocess
import threading
import time


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

SERVER_PKG = "@azure/mcp"
CONTINUATION_KEY = re.compile(r"next|continuation|cursor|skiptoken", re.I)


class FatalError(Exception):
    pass


# ----------------------------------------------------------------------------- helpers
def classify(err):
    e = str(err).lower()
    if any(k in e for k in ("authorizationfailed", "forbidden", "unauthorized", "access denied",
                            "does not have authorization", "403")):
        return "access_denied"
    if re.search(r"notfound|not found|does not exist|resourcegroupnotfound", e):
        return "not_found"
    return "other"


def fail(msg, kind=None):
    return {"ok": False, "data": None, "error": str(msg), "kind": kind or classify(msg)}


def good(data):
    return {"ok": True, "data": data, "error": None, "kind": None}


def parse_tool_result(res):
    if res.get("isError"):
        return fail(tool_text(res) or "Unknown MCP error")
    text = tool_text(res)
    if not text:
        return fail("Empty content in tool response", "other")
    try:
        data = json.loads(text)
    except ValueError:
        return good(text)
    if isinstance(data, dict):
        status = data.get("status")
        if isinstance(status, int) and status >= 400:
            return fail(data.get("message") or f"HTTP {status}")
    return good(data)


def extract_list(data, key):
    """Returns (list, error). Empty/None results are an empty list; a wrong shape is an error."""
    if not isinstance(data, dict):
        return None, f"Unexpected response (not an object): {short(data, 80)}"
    results = data.get("results")
    if results in (None, {}, []):
        return [], None
    if isinstance(results, dict):
        if key in results:
            val = results[key]
            return (val or []), None
        return None, f"Unexpected response shape: results has no '{key}' (keys: {sorted(results)})"
    if isinstance(results, list):
        return results, None
    return None, f"Unexpected results type: {type(results).__name__}"


def has_continuation(data):
    scopes = [data] if isinstance(data, dict) else []
    if isinstance(data, dict) and isinstance(data.get("results"), dict):
        scopes.append(data["results"])
    for scope in scopes:
        for k, v in scope.items():
            if CONTINUATION_KEY.search(k) and v and not isinstance(v, bool):
                return True
    return False


def entry(ok, count=None, data=None, errors=None, partial=False, truncated=False, **extra):
    e = {"ok": ok, "partial": partial, "count": count, "data": data,
         "errors": errors or None, "truncated": truncated}
    e.update(extra)
    return e


# ----------------------------------------------------------------------------- main
def main():
    setup_console()
    default_out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "azure_fetch_result.json")
    ap = argparse.ArgumentParser(description="Azure All-Services Fetcher via Official Azure MCP Server")
    ap.add_argument("--out", default=default_out, help="Output JSON path")
    ap.add_argument("--subscription", action="append",
                    help="Subscription id or name (repeatable). Default: all subscriptions")
    ap.add_argument("--default-only", action="store_true",
                    help="Scan only the default (or first) subscription")
    ap.add_argument("--server-version", default=os.environ.get("AZURE_MCP_VERSION"),
                    help="Pin @azure/mcp to this version (or env AZURE_MCP_VERSION)")
    ap.add_argument("--server-cmd", help="Override the launch command (testing / offline use)")
    ap.add_argument("--timeout", type=int, default=90, help="Per-call timeout in seconds")
    ap.add_argument("--init-timeout", type=int, default=300,
                    help="Startup timeout (first run downloads the server)")
    ap.add_argument("--allow-partial", action="store_true", help="Exit 0 even if some calls failed")
    ap.add_argument("--list-tools", action="store_true", help="Dump tool schemas and exit")
    args = ap.parse_args()

    print("=" * 70, flush=True)
    print("  AZURE ALL-SERVICES FETCHER (OFFICIAL MICROSOFT AZURE MCP SERVER)", flush=True)
    print("=" * 70, flush=True)

    variants = []
    if args.server_cmd:
        cmd = shlex.split(args.server_cmd)
    else:
        spec = f"{SERVER_PKG}@{args.server_version or 'latest'}"
        cmd = ["npx", "-y", spec, "server", "start", "--read-only"]
        # If this server version rejects --read-only, retry once without it.
        variants.append([c for c in cmd if c != "--read-only"])
        if not args.server_version:
            print("[!] Server version is not pinned; the exact version used is recorded in the "
                  "output. Pin it with --server-version.", flush=True)

    variants.insert(0, cmd)
    result = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "cloud": "azure",
        "complete": False,
        "readOnlyEnforced": False,
        "serverInfo": {},
        "serverVersionRequested": args.server_version,
        "toolsAvailable": [],
        "subscriptions": [],
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
        last_err = None
        for v_idx, launch in enumerate(variants):
            try:
                client = McpClient(launch, stderr_path=args.out + ".stderr.log",
                                   client_name="lens-azure-fetch")
                print(f"[*] Starting MCP server: {' '.join(launch)}", flush=True)
                client.start()
                client.initialize(timeout=args.init_timeout)
                result["readOnlyEnforced"] = "--read-only" in launch
                last_err = None
                break
            except McpError as e:
                last_err = e
                client.close()
                client = None
                if v_idx + 1 < len(variants):
                    print(f"  [!] Startup failed ({short(e, 100)}); retrying without --read-only. "
                          "Rely on a Reader-only identity.", flush=True)
        if last_err is not None:
            raise FatalError(f"MCP server failed to start/handshake: {last_err} "
                             f"(see {args.out}.stderr.log)")
        if not result["readOnlyEnforced"]:
            print("  [!] Server read-only mode is NOT enforced.", flush=True)
        result["serverInfo"] = client.server_info
        print(f"  [+] Connected: {client.server_info.get('name')} "
              f"(v{client.server_info.get('version')})", flush=True)

        try:
            tools = client.list_tools()
        except McpError as e:
            raise FatalError(f"tools/list failed: {e}")
        result["toolsAvailable"] = sorted(tools)

        if args.list_tools:
            path = args.out + ".tools.json"
            write_json_atomic(path, list(tools.values()))
            print(f"  [+] {len(tools)} tools written to {path}", flush=True)
            return 0

        def invoke(command, params):
            """Direct tool if exposed, else the namespace tool with {command, parameters}."""
            ns = command.split("_", 1)[0]
            if command in tools:
                name, arguments = command, params
            elif ns in tools:
                name, arguments = ns, {"command": command, "parameters": params}
            else:
                return fail(f"Tool '{command}' not exposed by server (no '{command}' or '{ns}' tool)",
                            "tool_missing")
            try:
                res = client.call_tool(name, arguments, timeout=args.timeout)
            except McpServerExited as e:
                raise FatalError(str(e))
            except McpTimeout:
                return fail(f"Timeout after {args.timeout}s", "timeout")
            except McpError as e:
                return fail(str(e), "other")
            return parse_tool_result(res)

        # ---- subscriptions (fail fast)
        print("\n[*] Discovering Azure subscriptions...", flush=True)
        sub_resp = invoke("subscription_list", {})
        if not sub_resp["ok"]:
            raise FatalError(f"subscription_list failed: {sub_resp['error']}")
        subs, shape_err = extract_list(sub_resp["data"], "subscriptions")
        if shape_err:
            raise FatalError(f"subscription_list: {shape_err}")
        subs = [s for s in subs if isinstance(s, dict) and s.get("subscriptionId")]
        if not subs:
            raise FatalError("No subscriptions found for the authenticated identity")

        if args.subscription:
            wanted = {w.lower() for w in args.subscription}
            selected = [s for s in subs if s["subscriptionId"].lower() in wanted
                        or str(s.get("displayName", "")).lower() in wanted]
            if not selected:
                raise FatalError(f"None of {args.subscription} matched; available: "
                                 f"{[s.get('displayName') for s in subs]}")
        elif args.default_only:
            selected = [next((s for s in subs if s.get("isDefault")), subs[0])]
        else:
            selected = subs
        print(f"  [+] Scanning {len(selected)} of {len(subs)} subscription(s)", flush=True)

        # ---- per subscription
        for s_idx, sub in enumerate(selected, start=1):
            sub_id = sub["subscriptionId"]
            sub_name = sub.get("displayName", "unknown")
            services = {}
            rec = {"subscriptionId": sub_id, "subscriptionName": sub_name,
                   "tenantId": sub.get("tenantId", "unknown"),
                   "isDefault": bool(sub.get("isDefault")), "services": services}
            result["subscriptions"].append(rec)
            print(f"\n=== [{s_idx}/{len(selected)}] {sub_name} ({sub_id}) ===", flush=True)

            # Resource groups
            rg_names = []
            rg_resp = invoke("group_list", {"subscription": sub_id})
            if rg_resp["ok"]:
                groups, err = extract_list(rg_resp["data"], "groups")
                if err:
                    services["resource_groups"] = entry(False, errors={"group_list": {"error": err, "kind": "other"}})
                else:
                    rg_names = [g.get("name") for g in groups if isinstance(g, dict) and g.get("name")]
                    trunc = has_continuation(rg_resp["data"])
                    services["resource_groups"] = entry(not trunc, len(groups), groups,
                                                        partial=trunc, truncated=trunc)
                print(f"  [+] {len(rg_names)} resource group(s)", flush=True)
            else:
                services["resource_groups"] = entry(False, errors={"group_list": {
                    "error": rg_resp["error"], "kind": rg_resp["kind"]}})
                print(f"  [-] group_list failed: {short(rg_resp['error'])}", flush=True)
            save()

            # Inventory
            all_resources, by_type, rg_errors = [], {}, {}
            truncated_any = False
            for rg in rg_names:
                r = invoke("group_resource_list", {"resource-group": rg, "subscription": sub_id})
                if not r["ok"]:
                    rg_errors[rg] = {"error": r["error"], "kind": r["kind"]}
                    print(f"    - RG '{rg}': FAILED {short(r['error'], 100)}", flush=True)
                    continue
                items, err = extract_list(r["data"], "resources")
                if err:
                    rg_errors[rg] = {"error": err, "kind": "other"}
                    print(f"    - RG '{rg}': FAILED {short(err, 100)}", flush=True)
                    continue
                if has_continuation(r["data"]):
                    truncated_any = True
                    rg_errors[rg] = {"error": "Response has a continuation token; results truncated",
                                     "kind": "truncated"}
                for item in items:
                    t = item.get("type", "unknown") if isinstance(item, dict) else "unknown"
                    by_type[t] = by_type.get(t, 0) + 1
                all_resources.extend(items)
                print(f"    - RG '{rg}': {len(items)} resources", flush=True)
            if "resource_groups" in services and not services["resource_groups"]["ok"] and not rg_names:
                services["all_resources"] = entry(False, errors={"inventory": {
                    "error": "Skipped: resource group discovery failed", "kind": "other"}},
                    typeBreakdown={})
            else:
                services["all_resources"] = entry(
                    not rg_errors, len(all_resources), all_resources, rg_errors,
                    partial=bool(rg_errors) and len(rg_errors) < len(rg_names) or truncated_any,
                    truncated=truncated_any, typeBreakdown=by_type)
            print(f"  [+] Inventory: {len(all_resources)} resources, {len(rg_errors)} RG error(s)",
                  flush=True)
            save()

            # RBAC
            ra = invoke("role_assignment_list", {"scope": f"/subscriptions/{sub_id}"})
            if ra["ok"]:
                items, err = extract_list(ra["data"], "assignments")
                if err:
                    services["role_assignments"] = entry(False, errors={"role_assignment_list": {
                        "error": err, "kind": "other"}})
                else:
                    trunc = has_continuation(ra["data"])
                    services["role_assignments"] = entry(not trunc, len(items), items,
                                                         partial=trunc, truncated=trunc)
                    print(f"  [+] Role assignments: {len(items)}", flush=True)
            else:
                services["role_assignments"] = entry(False, errors={"role_assignment_list": {
                    "error": ra["error"], "kind": ra["kind"]}})
                print(f"  [-] role_assignment_list failed: {short(ra['error'])}", flush=True)
            save()

            # Advisor
            ad = invoke("advisor_recommendation_list", {"subscription": sub_id})
            if ad["ok"]:
                items, err = extract_list(ad["data"], "recommendations")
                if err:
                    services["advisor_recommendations"] = entry(False, errors={
                        "advisor_recommendation_list": {"error": err, "kind": "other"}})
                else:
                    trunc = has_continuation(ad["data"])
                    services["advisor_recommendations"] = entry(not trunc, len(items), items,
                                                                partial=trunc, truncated=trunc)
                    print(f"  [+] Advisor recommendations: {len(items)}", flush=True)
            else:
                services["advisor_recommendations"] = entry(False, errors={
                    "advisor_recommendation_list": {"error": ad["error"], "kind": ad["kind"]}})
                print(f"  [-] advisor_recommendation_list failed: {short(ad['error'])}", flush=True)
            save()

        # ---- finalize
        failed, partial = [], []
        for rec in result["subscriptions"]:
            for k, v in rec["services"].items():
                label = f"{rec['subscriptionName']}/{k}"
                if v["partial"]:
                    partial.append(label)
                elif not v["ok"]:
                    failed.append(label)
        result["summary"] = {"failed": failed, "partial": partial}
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
    print("                      AZURE FETCH SUMMARY", flush=True)
    print("=" * 70, flush=True)
    for rec in result["subscriptions"]:
        sv = rec["services"]
        print(f"{rec['subscriptionName']} ({rec['subscriptionId']})", flush=True)
        print(f"  Resource Groups:  {sv.get('resource_groups', {}).get('count')}", flush=True)
        print(f"  Total Resources:  {sv.get('all_resources', {}).get('count')}", flush=True)
        print(f"  Role Assignments: {sv.get('role_assignments', {}).get('count')}", flush=True)
        print(f"  Advisor Findings: {sv.get('advisor_recommendations', {}).get('count')}", flush=True)
        breakdown = sv.get("all_resources", {}).get("typeBreakdown") or {}
        for r_type, count in sorted(breakdown.items(), key=lambda x: -x[1]):
            print(f"    - {r_type}: {count}", flush=True)
    s = result["summary"]
    print(f"\nFailed:  {', '.join(s['failed']) or '-'}", flush=True)
    print(f"Partial: {', '.join(s['partial']) or '-'}", flush=True)
    print(f"Full raw data written to: {args.out}", flush=True)
    print("=" * 70, flush=True)
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
