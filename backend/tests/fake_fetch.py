"""Stand-in for a cloud fetcher in tests: writes a fetch JSON for one scope.

    python fake_fetch.py <scope_key> <scope> <out> [services,...]

Every service is readable (ok), so the scan passes the "enough services
readable" gate. One firewall rule decides NET-01 (see below).
"""
import json
import sys

scope_key, scope, out = sys.argv[1], sys.argv[2], sys.argv[3]
only = sys.argv[4].split(",") if len(sys.argv) > 4 and sys.argv[4] else None
keys = [f"svc_{i}" for i in range(25)] + ["firewall_rules", "compute_instances"]
services = {k: {"ok": True, "data": []} for k in keys}
# Scopes with "closed" in the name have SSH restricted (NET-01 passes).
services["firewall_rules"]["data"] = [{
    "name": f"fw-{scope}", "direction": "INGRESS", "disabled": False,
    "sourceRanges": ["10.0.0.0/8" if "closed" in scope else "0.0.0.0/0"],
    "allowed": [{"IPProtocol": "tcp", "ports": ["22"]}], "logConfig": {"enable": False},
}]
if only:
    services = {k: v for k, v in services.items() if k in only}
with open(out, "w", encoding="utf-8") as f:
    json.dump({"fetchedAt": "2026-10-16T00:00:00Z", scope_key: {scope: {"services": services}}}, f)
