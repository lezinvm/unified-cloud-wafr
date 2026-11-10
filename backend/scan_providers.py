"""
Cloud provider registry for scanning and loading.

Everything that differs between clouds lives here; the scan runner, the loader
and the dev scripts are generic and take `--provider`. Checks have their own
registry in checks/ (same idea).

Adding a cloud = one ScanProvider entry:
  * scope:      what one scan covers (GCP project / AWS account / Azure
                subscription), how it is named in the fetch JSON, how to
                validate its id, and which cloud_account field holds it
  * fetch:      the fetcher command (an official MCP server client). None means
                the cloud is registered but cannot be scanned yet.
  * inventory:  which fetched services become resource-inventory rows
  * resources:  how a fetched item maps to (name, id/ARN, region), and how a
                failing check resource maps to (name, location) for fix commands
  * guidance:   authored remediation guidance + CLI renderer for that cloud
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable

BACKEND = Path(__file__).parent
FETCH_DIR = BACKEND / "mcp_fetch"


def _short(v) -> str:
    return v.rsplit("/", 1)[-1] if isinstance(v, str) else str(v)


def _items(services: dict, key: str) -> list:
    svc = services.get(key)
    if not svc or not svc.get("ok"):
        return []
    d = svc.get("data")
    return d if isinstance(d, list) else ([d] if isinstance(d, dict) else [])


@dataclass(frozen=True)
class ScanProvider:
    name: str                          # gcp | aws | azure
    label: str                         # display name
    scope_label: str                   # project | account | subscription
    scope_key: str                     # grouping key in the fetch JSON
    scope_id_re: re.Pattern            # valid scope id
    account_scope_field: str           # cloud_accounts field with the scope id
    lens: str
    auth_type: str
    fetch_cmd: Callable[[str, Path], list[str]] | None = None
    min_readable_services: int = 20    # below this the fetch is treated as blocked
    inventory_types: dict[str, str] = field(default_factory=dict)
    resource_ref: Callable[[dict, str], tuple[str, str, str]] | None = None
    location_index: Callable[[dict], dict[str, str]] | None = None
    guidance: dict = field(default_factory=dict)
    render_cli: Callable[[str, str, list], str] | None = None
    iac_note: str = "# No IaC snippet authored for this control yet."

    @property
    def fetch_file(self) -> Path:
        return FETCH_DIR / f"{self.name}_fetch_result.json"

    @property
    def can_scan(self) -> bool:
        return self.fetch_cmd is not None

    def valid_scope(self, scope_id: str) -> bool:
        return bool(scope_id) and bool(self.scope_id_re.match(scope_id))

    def inventory_ref(self, item: dict, fallback: str) -> tuple[str, str, str]:
        if self.resource_ref:
            return self.resource_ref(item, fallback)
        raw = item.get("name") or item.get("id") or fallback
        return _short(raw), str(raw), "global"

    def locations(self, services: dict) -> dict[str, str]:
        return self.location_index(services) if self.location_index else {}

    def split_resource(self, res: str, loc_idx: dict[str, str]) -> tuple[str, str]:
        """(name, location) for a failing-check resource. 'region/name' is split."""
        if "/" in res and not res.startswith(("projects/", "arn:", "/subscriptions/")):
            loc, name = res.split("/", 1)
            return name, loc
        return res, loc_idx.get(res, "")

    def cli_for(self, control_id: str, scope: str, pairs: list) -> str:
        return self.render_cli(control_id, scope, pairs) if self.render_cli else ""


# ---- GCP --------------------------------------------------------------------

def _gcp_fetch(scope: str, out: Path) -> list[str]:
    return ["node", str(FETCH_DIR / "gcp_fetch_all.mjs"), "--project", scope, "--out", str(out)]


def _gcp_ref(item: dict, fallback: str) -> tuple[str, str, str]:
    raw = item.get("name") or item.get("email") or item.get("id") or fallback
    return (_short(raw), item.get("selfLink") or item.get("name") or _short(raw),
            _short(item.get("region") or item.get("zone") or item.get("location") or "global"))


def _gcp_locations(services: dict) -> dict[str, str]:
    idx: dict[str, str] = {}
    for key in ("compute_instances", "compute_disks"):
        for it in _items(services, key):
            idx.setdefault(it.get("name", ""), _short(it.get("zone", "")))
    for it in _items(services, "addresses_static_ip"):
        idx.setdefault(it.get("name", ""), _short(it.get("region", "")))
    for it in _items(services, "cloud_functions"):
        parts = str(it.get("name", "")).split("/")  # projects/P/locations/L/functions/N
        if len(parts) >= 6:
            idx.setdefault(parts[-1], parts[3])
    return idx


def _gcp_guidance():
    try:
        from backend.remediation_guidance import GUIDANCE, render_cli
    except ModuleNotFoundError:
        from remediation_guidance import GUIDANCE, render_cli
    return GUIDANCE, render_cli


_GCP_GUIDANCE, _GCP_RENDER = _gcp_guidance()

GCP = ScanProvider(
    name="gcp", label="Google Cloud", scope_label="project", scope_key="projects",
    scope_id_re=re.compile(r"^[a-z][a-z0-9-]{4,28}[a-z0-9]$"),
    account_scope_field="gcp_project",
    lens="google-cloud-architecture-framework", auth_type="service-account",
    fetch_cmd=_gcp_fetch,
    inventory_types={
        "compute_instances": "compute_instance", "compute_disks": "compute_disk",
        "storage_buckets": "storage_bucket", "networks_vpc": "vpc_network",
        "subnets": "subnet", "firewall_rules": "firewall_rule",
        "cloud_functions": "cloud_function", "cloud_run_services": "cloud_run_service",
        "pubsub_topics": "pubsub_topic", "sql_instances": "sql_instance",
        "gke_clusters": "gke_cluster", "secrets": "secret",
        "iam_service_accounts": "service_account", "addresses_static_ip": "static_ip",
    },
    resource_ref=_gcp_ref, location_index=_gcp_locations,
    guidance=_GCP_GUIDANCE, render_cli=_GCP_RENDER,
    iac_note="# No Terraform snippet authored for this control yet.",
)

# ---- AWS / Azure: registered, not scannable yet ------------------------------
# Fill in fetch_cmd (an official MCP server client), inventory_types,
# resource_ref, location_index and guidance when their fetchers are built.

AWS = ScanProvider(
    name="aws", label="AWS", scope_label="account", scope_key="accounts",
    scope_id_re=re.compile(r"^\d{12}$"),
    account_scope_field="account_identifier",
    lens="aws-well-architected", auth_type="role",
)

AZURE = ScanProvider(
    name="azure", label="Azure", scope_label="subscription", scope_key="subscriptions",
    scope_id_re=re.compile(r"^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$"),
    account_scope_field="subscription_id",
    lens="azure-well-architected", auth_type="service-principal",
)

PROVIDERS: dict[str, ScanProvider] = {p.name: p for p in (GCP, AWS, AZURE)}


def get(name: str) -> ScanProvider:
    p = PROVIDERS.get((name or "").lower())
    if p is None:
        raise KeyError(f"Unknown cloud provider '{name}'. Known: {sorted(PROVIDERS)}")
    return p
