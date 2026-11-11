"""
AWS ALL-SERVICES fetcher via the OFFICIAL awslabs.aws-api-mcp-server.

1. Discovers authenticated account and caller identity (sts get-caller-identity).
2. Fetches read-only resource data for every service in the catalog-relevant
   FETCH_PLAN (IAM, S3, EC2, VPC, Security Groups, RDS, KMS, CloudTrail,
   EKS, Lambda, SQS, SNS, DynamoDB...).
3. Collects everything into one combined JSON result (aws_fetch_result.json).

Fetch-only (no pass/fail logic, no writes). The LENS scanner/checks read the output.

Usage:
  python aws_fetch_all.py
  python aws_fetch_all.py --out C:\path\to\aws_fetch_result.json
"""

import subprocess
import json
import sys
import os
import time
import argparse
from datetime import datetime, timezone

# -----------------------------------------------------------------------------
# Service Fetch Plan (Read-Only AWS CLI Commands)
# -----------------------------------------------------------------------------
FETCH_PLAN = [
    # IAM & Account Governance
    {"key": "iam_account_summary",       "cmd": "aws iam get-account-summary"},
    {"key": "iam_password_policy",       "cmd": "aws iam get-account-password-policy"},
    {"key": "iam_users",                 "cmd": "aws iam list-users"},
    {"key": "iam_roles",                 "cmd": "aws iam list-roles --max-items 50"},
    {"key": "iam_mfa_devices",           "cmd": "aws iam list-virtual-mfa-devices"},

    # Storage & Object Store
    {"key": "s3_buckets",                "cmd": "aws s3api list-buckets"},

    # Compute & Virtual Infrastructure
    {"key": "ec2_instances",             "cmd": "aws ec2 describe-instances --max-items 50"},
    {"key": "ec2_ebs_volumes",           "cmd": "aws ec2 describe-volumes --max-items 50"},
    {"key": "ec2_ebs_snapshots",         "cmd": "aws ec2 describe-snapshots --owner-ids self --max-items 50"},

    # Network & Perimeter Defense
    {"key": "vpc_networks",              "cmd": "aws ec2 describe-vpcs"},
    {"key": "vpc_subnets",               "cmd": "aws ec2 describe-subnets --max-items 50"},
    {"key": "security_groups",           "cmd": "aws ec2 describe-security-groups --max-items 50"},
    {"key": "route_tables",              "cmd": "aws ec2 describe-route-tables --max-items 50"},
    {"key": "internet_gateways",         "cmd": "aws ec2 describe-internet-gateways"},
    {"key": "elastic_ips",               "cmd": "aws ec2 describe-addresses"},

    # Databases
    {"key": "rds_instances",             "cmd": "aws rds describe-db-instances --max-items 50"},
    {"key": "rds_clusters",              "cmd": "aws rds describe-db-clusters --max-items 50"},
    {"key": "dynamodb_tables",           "cmd": "aws dynamodb list-tables"},

    # Logging, Audit & Observability
    {"key": "cloudtrail_trails",         "cmd": "aws cloudtrail describe-trails"},
    {"key": "cloudwatch_alarms",         "cmd": "aws cloudwatch describe-alarms --max-items 50"},

    # Cryptography & Key Management
    {"key": "kms_keys",                  "cmd": "aws kms list-keys --limit 50"},
    {"key": "kms_aliases",               "cmd": "aws kms list-aliases --limit 50"},

    # Containers & Kubernetes
    {"key": "eks_clusters",              "cmd": "aws eks list-clusters"},
    {"key": "ecr_repositories",          "cmd": "aws ecr describe-repositories --max-items 50"},

    # Serverless & Messaging
    {"key": "lambda_functions",          "cmd": "aws lambda list-functions --max-items 50"},
    {"key": "sns_topics",                "cmd": "aws sns list-topics"},
    {"key": "sqs_queues",                "cmd": "aws sqs list-queues"},
]


def main():
    default_out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "aws_fetch_result.json")
    parser = argparse.ArgumentParser(description="AWS All-Services Fetcher via Official AWS MCP Server")
    parser.add_argument("--out", default=default_out, help="Output JSON path")
    args = parser.parse_args()

    print("=" * 70, flush=True)
    print("  AWS ALL-SERVICES FETCHER (OFFICIAL AWS MCP SERVER)", flush=True)
    print("=" * 70, flush=True)

    # 1. Spawn Official AWS MCP Server
    proc = subprocess.Popen(
        ["uvx", "awslabs.aws-api-mcp-server"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
        text=True,
        encoding="utf-8"
    )

    req_id = 1

    def send_and_wait(method, params):
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

        while True:
            line = proc.stdout.readline()
            if not line:
                return None
            try:
                data = json.loads(line)
                if data.get("id") == current_id:
                    return data
            except Exception:
                pass

    def run_aws_cmd(cli_cmd):
        raw_res = send_and_wait("tools/call", {
            "name": "call_aws",
            "arguments": {"cli_command": cli_cmd}
        })
        if not raw_res:
            return {"ok": False, "error": "No response from MCP server"}

        items = raw_res.get("result", {}).get("structuredContent", {}).get("result", [])
        if not items:
            return {"ok": False, "error": "Empty result"}

        resp_obj = items[0].get("response", {})
        err = resp_obj.get("error")
        if err:
            return {"ok": False, "error": err}

        raw_json = resp_obj.get("as_json")
        if raw_json:
            try:
                return {"ok": True, "data": json.loads(raw_json)}
            except Exception as e:
                return {"ok": False, "error": f"JSON parse error: {e}"}

        return {"ok": True, "data": resp_obj}

    # 2. Handshake
    print("[*] Connecting to Official AWS MCP Server (awslabs.aws-api-mcp-server)...", flush=True)
    init_res = send_and_wait("initialize", {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "lens-aws-fetch", "version": "1.0.0"}
    })
    s_info = init_res.get("result", {}).get("serverInfo", {}) if init_res else {}
    print(f"  [+] Connected to MCP Server: {s_info.get('name')} (v{s_info.get('version')})", flush=True)

    proc.stdin.write(json.dumps({"jsonrpc": "2.0", "method": "notifications/initialized"}) + "\n")
    proc.stdin.flush()
    time.sleep(1)

    # 3. Discover Caller Identity
    print("\n[*] Discovering AWS account identity...", flush=True)
    sts_r = run_aws_cmd("aws sts get-caller-identity")
    account_id = "unknown"
    arn = "unknown"
    if sts_r.get("ok"):
        account_id = sts_r["data"].get("Account", "unknown")
        arn = sts_r["data"].get("Arn", "unknown")
        print(f"  [+] Target Account: {account_id}", flush=True)
        print(f"  [+] Authenticated Identity: {arn}", flush=True)
    else:
        print(f"  [-] Warning: STS check failed: {sts_r.get('error')}", flush=True)

    result = {
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "cloud": "aws",
        "accountId": account_id,
        "callerArn": arn,
        "serviceCount": len(FETCH_PLAN),
        "services": {}
    }

    print(f"\n=== AWS ACCOUNT: {account_id} ({len(FETCH_PLAN)} services) ===", flush=True)

    for idx, entry in enumerate(FETCH_PLAN, start=1):
        key = entry["key"]
        cmd = entry["cmd"]
        try:
            r = run_aws_cmd(cmd)
            if r.get("ok"):
                data = r["data"]
                count = 0
                if isinstance(data, list):
                    count = len(data)
                elif isinstance(data, dict):
                    # Check for typical AWS list wrappers (e.g. Users, Buckets, SecurityGroups)
                    sub_lists = [v for v in data.values() if isinstance(v, list)]
                    count = len(sub_lists[0]) if sub_lists else len(data)

                result["services"][key] = {
                    "ok": True,
                    "count": count,
                    "data": data
                }
                print(f"  [{idx:02d}/{len(FETCH_PLAN)}] • {key}: OK ({count} items)", flush=True)
            else:
                err_str = str(r.get("error", "AccessDenied/Empty"))
                short_err = "AccessDenied" if "AccessDenied" in err_str else (err_str[:50] + "...")
                result["services"][key] = {
                    "ok": False,
                    "error": short_err,
                    "data": None
                }
                print(f"  [{idx:02d}/{len(FETCH_PLAN)}] • {key}: {short_err}", flush=True)

        except Exception as e:
            result["services"][key] = {"ok": False, "error": str(e), "data": None}
            print(f"  [{idx:02d}/{len(FETCH_PLAN)}] • {key}: ERROR ({e})", flush=True)

        # Incremental save after each service
        try:
            with open(args.out, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2)
        except Exception:
            pass

    proc.terminate()

    # 4. Summary
    print("\n" + "=" * 70, flush=True)
    print("                      SUMMARY", flush=True)
    print("=" * 70, flush=True)
    print(f"Account: {account_id}", flush=True)
    
    with_data = [
        f"{k}={v['count']}"
        for k, v in result["services"].items()
        if v.get("ok") and v.get("count", 0) > 0
    ]
    if with_data:
        print("  Services with data: " + ", ".join(with_data), flush=True)
    else:
        print("  (No active resources found in queried services)", flush=True)

    accessible = sum(1 for v in result["services"].values() if v.get("ok"))
    print(f"\nTotal Services Queried: {len(FETCH_PLAN)}", flush=True)
    print(f"Accessible Services:   {accessible}/{len(FETCH_PLAN)}", flush=True)
    print(f"Full data written to:   {args.out}", flush=True)
    print("=" * 70, flush=True)


if __name__ == "__main__":
    main()
