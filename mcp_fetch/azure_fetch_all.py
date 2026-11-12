"""
Azure ALL-SERVICES fetcher via the OFFICIAL Microsoft Azure MCP Server (@azure/mcp).

1. Discovers authenticated account and default subscription (subscription_list).
2. Discovers all resource groups in the subscription (group_list).
3. Fetches read-only resource inventory across every resource group (group_resource_list),
   capturing VMs, NSGs, VNets, Storage Accounts, Key Vaults, SQL instances, and App Services.
4. Fetches RBAC Role Assignments (role -> role_assignment_list).
5. Fetches Azure Advisor / WAFR recommendations (advisor -> advisor_recommendation_list).
6. Collects everything into one combined JSON result (azure_fetch_result.json).

Fetch-only (no pass/fail logic, no writes). The LENS scanner/checks read the output.

Usage:
  python azure_fetch_all.py
  python azure_fetch_all.py --out azure_fetch_result.json
"""

import subprocess
import json
import sys
import os
import time
import argparse
from datetime import datetime, timezone

def main():
    default_out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "azure_fetch_result.json")
    parser = argparse.ArgumentParser(description="Azure All-Services Fetcher via Official Azure MCP Server")
    parser.add_argument("--out", default=default_out, help="Output JSON path")
    args = parser.parse_args()

    print("=" * 70, flush=True)
    print("  AZURE ALL-SERVICES FETCHER (OFFICIAL MICROSOFT AZURE MCP SERVER)", flush=True)
    print("=" * 70, flush=True)

    # 1. Spawn Official Azure MCP Server
    print("[*] Spawning official Azure MCP Server (npx -y @azure/mcp@latest server start)...", flush=True)
    proc = subprocess.Popen(
        ["npx", "-y", "@azure/mcp@latest", "server", "start"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8",
        shell=True
    )

    req_id = 1

    def send_and_wait(method, params, timeout=45):
        nonlocal req_id
        current_id = req_id
        req_id += 1
        msg = {
            "jsonrpc": "2.0",
            "id": current_id,
            "method": method,
            "params": params
        }
        proc.stdin.write(json.dumps(msg) + "\n")
        proc.stdin.flush()

        start_time = time.time()
        while time.time() - start_time < timeout:
            line = proc.stdout.readline()
            if not line:
                return None
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
                if data.get("id") == current_id:
                    return data
            except Exception:
                pass
        return None

    def call_mcp_tool(tool_name, tool_args):
        raw = send_and_wait("tools/call", {
            "name": tool_name,
            "arguments": tool_args
        })
        if not raw:
            return {"ok": False, "error": "Timeout or no response from Azure MCP server"}

        res = raw.get("result", {})
        if res.get("isError"):
            return {"ok": False, "error": res.get("content", [{}])[0].get("text", "Unknown MCP error")}

        content = res.get("content", [])
        if not content:
            return {"ok": False, "error": "Empty content in tool response"}

        text = content[0].get("text", "")
        try:
            parsed = json.loads(text)
            return {"ok": True, "data": parsed}
        except Exception:
            return {"ok": True, "data": text}

    # 2. Handshake
    print("[*] Performing MCP JSON-RPC 2.0 handshake...", flush=True)
    init_res = send_and_wait("initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "lens-azure-fetch", "version": "1.0.0"}
    })
    s_info = init_res.get("result", {}).get("serverInfo", {}) if init_res else {}
    print(f"  [+] Connected to Server: {s_info.get('name')} (v{s_info.get('version')})", flush=True)

    proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
    proc.stdin.flush()
    time.sleep(1)

    # 3. Discover Active Subscription
    print("\n[*] Discovering Azure subscriptions...", flush=True)
    sub_resp = call_mcp_tool("subscription_list", {})
    sub_id = "unknown"
    sub_name = "unknown"
    tenant_id = "unknown"

    if sub_resp.get("ok"):
        sub_data = sub_resp["data"]
        subs = sub_data.get("results", {}).get("subscriptions", []) if isinstance(sub_data, dict) else []
        if subs:
            # Prefer default or first subscription
            active_sub = next((s for s in subs if s.get("isDefault")), subs[0])
            sub_id = active_sub.get("subscriptionId", "unknown")
            sub_name = active_sub.get("displayName", "unknown")
            tenant_id = active_sub.get("tenantId", "unknown")
            print(f"  [+] Active Subscription: {sub_name} ({sub_id})", flush=True)
            print(f"  [+] Tenant ID:           {tenant_id}", flush=True)
        else:
            print("  [-] Warning: No subscriptions found.", flush=True)
    else:
        print(f"  [-] Failed to list subscriptions: {sub_resp.get('error')}", flush=True)

    result = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "cloud": "azure",
        "subscriptionId": sub_id,
        "subscriptionName": sub_name,
        "tenantId": tenant_id,
        "services": {}
    }

    # 4. Discover Resource Groups
    print("\n[*] Querying Resource Groups in subscription...", flush=True)
    rg_resp = call_mcp_tool("group_list", {"subscription": sub_id})
    resource_groups = []
    if rg_resp.get("ok"):
        rg_data = rg_resp["data"]
        groups = rg_data.get("results", {}).get("groups", []) if isinstance(rg_data, dict) else []
        resource_groups = [g.get("name") for g in groups if g.get("name")]
        result["services"]["resource_groups"] = {
            "ok": True,
            "count": len(groups),
            "data": groups
        }
        print(f"  [+] Discovered {len(resource_groups)} Resource Groups: {', '.join(resource_groups)}", flush=True)
    else:
        result["services"]["resource_groups"] = {"ok": False, "error": rg_resp.get("error")}
        print(f"  [-] Error querying resource groups: {rg_resp.get('error')}", flush=True)

    # 5. Inventory All Resources Across Each Resource Group
    print(f"\n[*] Inventorying resources across {len(resource_groups)} Resource Groups...", flush=True)
    all_resources = []
    by_type = {}
    for rg in resource_groups:
        rg_res = call_mcp_tool("group_resource_list", {"resource-group": rg, "subscription": sub_id})
        if rg_res.get("ok"):
            items = rg_res["data"].get("results", {}).get("resources", []) if isinstance(rg_res["data"], dict) else []
            all_resources.extend(items)
            for item in items:
                t = item.get("type", "unknown")
                by_type[t] = by_type.get(t, 0) + 1
            print(f"  • RG '{rg}': {len(items)} resources found", flush=True)
        else:
            print(f"  • RG '{rg}': {rg_res.get('error')}", flush=True)

    result["services"]["all_resources"] = {
        "ok": True,
        "count": len(all_resources),
        "data": all_resources,
        "typeBreakdown": by_type
    }

    # 6. Fetch RBAC Role Assignments (Identity & Access)
    print("\n[*] Querying RBAC Role Assignments (IAM)...", flush=True)
    role_resp = call_mcp_tool("role", {
        "command": "role_assignment_list",
        "parameters": {"scope": f"/subscriptions/{sub_id}"}
    })
    if role_resp.get("ok"):
        r_data = role_resp["data"]
        assignments = r_data.get("results", {}).get("assignments", []) if isinstance(r_data, dict) else []
        result["services"]["role_assignments"] = {
            "ok": True,
            "count": len(assignments),
            "data": assignments
        }
        print(f"  [+] Retrieved {len(assignments)} Role Assignments across subscription", flush=True)
    else:
        result["services"]["role_assignments"] = {"ok": False, "error": role_resp.get("error")}
        print(f"  [-] Error querying role assignments: {role_resp.get('error')}", flush=True)

    # 7. Fetch Azure Advisor / Well-Architected Recommendations
    print("\n[*] Querying Azure Advisor / WAFR Recommendations...", flush=True)
    adv_resp = call_mcp_tool("advisor", {
        "command": "advisor_recommendation_list",
        "parameters": {}
    })
    if adv_resp.get("ok"):
        a_data = adv_resp["data"]
        recs = a_data.get("results", {}).get("recommendations", []) if isinstance(a_data, dict) else []
        result["services"]["advisor_recommendations"] = {
            "ok": True,
            "count": len(recs),
            "data": recs
        }
        print(f"  [+] Retrieved {len(recs)} Advisor Recommendations", flush=True)
    else:
        result["services"]["advisor_recommendations"] = {"ok": False, "error": adv_resp.get("error")}
        print(f"  [-] Error querying advisor: {adv_resp.get('error')}", flush=True)

    # Save output JSON
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    proc.terminate()

    # 8. Summary
    print("\n" + "=" * 70, flush=True)
    print("                      AZURE FETCH SUMMARY", flush=True)
    print("=" * 70, flush=True)
    print(f"Subscription:        {sub_name} ({sub_id})", flush=True)
    print(f"Resource Groups:     {len(resource_groups)}", flush=True)
    print(f"Total Resources:     {len(all_resources)}", flush=True)
    print(f"Role Assignments:    {result['services'].get('role_assignments', {}).get('count', 0)}", flush=True)
    print(f"Advisor Findings:    {result['services'].get('advisor_recommendations', {}).get('count', 0)}", flush=True)
    print("\nResource Types Breakdown:")
    for r_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
        print(f"  • {r_type}: {count}")
    print(f"\nFull raw data written to: {args.out}", flush=True)
    print("=" * 70, flush=True)

if __name__ == "__main__":
    main()

