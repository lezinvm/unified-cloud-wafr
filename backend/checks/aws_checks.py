"""
AWS check registry — same format as checks/gcp_checks.py.

HOW TO ADD AWS CHECKS
---------------------
1. Fetch AWS resource data into the same shape the engine expects:
       { "<service_key>": { "ok": true, "count": N, "data": [ ... ] }, ... }
   (e.g. via an AWS MCP fetcher, mirroring mcp_fetch/gcp_fetch_all.mjs).
   Each assessed scope is one account+region.

2. For each AWS token in control_catalog.csv's `aws_checks` column, write a
   function and register it with @aws.check("<token>"). The function receives
   the per-scope resource map and returns result dicts:
       passed(name, evidence) / failed(name, evidence) / unknown(name, need)
   Return [] when the service has no resources (-> NOT_APPLICABLE).

3. Run:  python check_engine.py --provider aws --data <aws_fetch.json>

The engine, rollup, summary, and output are shared — nothing else to change.
"""
from __future__ import annotations

from .base import (Provider, resource_list, short_name,
                   passed, failed, unknown, scope_unknown)

aws = Provider("aws", catalog_column="aws_checks", scope_label="account")

# Alias so check bodies read the same as the GCP module.
register = aws.check
_data = resource_list
_name = short_name


# ---- EXAMPLE (reference implementation of the pattern) ------------------
# Security group open to the world on SSH/RDP — the AWS analogue of GCP NET-01.
# Expects a fetched service key "security_groups" with EC2 describe-style data.

@register("ec2_securitygroup_allow_ingress_from_internet_to_tcp_port_22_3389")  # NET-01
def sg_ssh_rdp(resources: dict) -> list:
    sgs = _data(resources, "security_groups")
    if not sgs:
        return []  # not fetched / none -> NOT_APPLICABLE
    out = []
    admin = {22, 3389}
    for sg in sgs:
        gid = sg.get("GroupId") or sg.get("GroupName", "?")
        open_admin = False
        for perm in sg.get("IpPermissions") or []:
            lo = perm.get("FromPort")
            hi = perm.get("ToPort")
            world = any(r.get("CidrIp") == "0.0.0.0/0" for r in perm.get("IpRanges") or [])
            if world and lo is not None and hi is not None:
                if any(lo <= p <= hi for p in admin):
                    open_admin = True
        out.append(failed(gid, "0.0.0.0/0 ingress to SSH/RDP.") if open_admin
                   else passed(gid, "No open-internet admin ingress."))
    return out


# TODO: implement the remaining AWS tokens from control_catalog.csv `aws_checks`.
# Until a token is registered here, the engine reports its control
# NOT_IMPLEMENTED for the aws provider (honest coverage, never a false pass).
