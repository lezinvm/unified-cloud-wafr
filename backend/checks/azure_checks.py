"""
Azure check registry — same format as checks/gcp_checks.py.

HOW TO ADD AZURE CHECKS
-----------------------
1. Fetch Azure resource data into the same shape the engine expects:
       { "<service_key>": { "ok": true, "count": N, "data": [ ... ] }, ... }
   (e.g. via the Azure MCP server, mirroring mcp_fetch/gcp_fetch_all.mjs).
   Each assessed scope is one subscription.

2. For each Azure token in control_catalog.csv's `azure_checks` column, write a
   function and register it with @azure.check("<token>"). The function receives
   the per-scope resource map and returns result dicts:
       passed(name, evidence) / failed(name, evidence) / unknown(name, need)
   Return [] when the service has no resources (-> NOT_APPLICABLE).

3. Run:  python check_engine.py --provider azure --data <azure_fetch.json>

The engine, rollup, summary, and output are shared — nothing else to change.
"""
from __future__ import annotations

from .base import (Provider, resource_list, short_name,
                   passed, failed, unknown, scope_unknown)

azure = Provider("azure", catalog_column="azure_checks", scope_label="subscription")

register = azure.check
_data = resource_list
_name = short_name


# ---- EXAMPLE (reference implementation of the pattern) ------------------
# Network security group allowing inbound SSH/RDP from the internet — the Azure
# analogue of GCP NET-01. Expects a fetched "network_security_groups" service.

@register("network_security_group_allow_ingress_from_internet_to_ssh_rdp")  # NET-01
def nsg_ssh_rdp(resources: dict) -> list:
    nsgs = _data(resources, "network_security_groups")
    if not nsgs:
        return []  # not fetched / none -> NOT_APPLICABLE
    out = []
    admin = {"22", "3389"}
    internet = {"*", "0.0.0.0/0", "internet"}
    for nsg in nsgs:
        name = nsg.get("name", "?")
        bad = False
        for rule in (nsg.get("properties", {}) or {}).get("securityRules") or []:
            p = rule.get("properties", {}) or {}
            if (p.get("direction") == "Inbound" and p.get("access") == "Allow"
                    and str(p.get("sourceAddressPrefix", "")).lower() in internet):
                ports = {str(p.get("destinationPortRange"))}
                ports |= {str(x) for x in (p.get("destinationPortRanges") or [])}
                if ports & admin or "*" in ports:
                    bad = True
        out.append(failed(name, "Inbound SSH/RDP allowed from internet.") if bad
                   else passed(name, "No open-internet admin inbound rule."))
    return out


# TODO: implement the remaining Azure tokens from control_catalog.csv
# `azure_checks`. Unregistered tokens report NOT_IMPLEMENTED (honest coverage).
