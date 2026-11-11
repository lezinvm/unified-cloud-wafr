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

import json
import os
import re
import shutil
import subprocess
import urllib.request
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Callable

BACKEND = Path(__file__).parent
FETCH_DIR = BACKEND / "mcp_fetch"  # fetcher scripts
# Where fetch results are written. Containers point this at a volume so data
# survives image rebuilds; defaults to the scripts folder for local runs.
DATA_DIR = Path(os.getenv("LENS_DATA_DIR") or FETCH_DIR)


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
    # fetch_cmd(scope, out_path, services=None): `services` limits the fetch to
    # those service keys (targeted re-checks); None fetches everything.
    fetch_cmd: Callable[..., list[str]] | None = None
    # verify_cmd(scope): quick read-only call that succeeds only when the
    # scanner identity can read the scope. Runs before the slow full fetch.
    verify_cmd: Callable[[str], list[str]] | None = None
    # access_hint(scope): what to grant the scanner identity on that scope.
    access_hint: Callable[[str], str] | None = None
    # scope_of(cloud_account_doc): the scope id held by a stored cloud account.
    scope_of: Callable[[dict], str] | None = None
    min_readable_services: int = 20    # below this the fetch is treated as blocked
    inventory_types: dict[str, str] = field(default_factory=dict)
    resource_ref: Callable[[dict, str], tuple[str, str, str]] | None = None
    location_index: Callable[[dict], dict[str, str]] | None = None
    guidance: dict = field(default_factory=dict)
    render_cli: Callable[[str, str, list], str] | None = None
    iac_note: str = "# No IaC snippet authored for this control yet."

    # ---- per-scope storage: DATA_DIR/<provider>/<scope>.json ---------------
    # One file per project / account / subscription, so scanning a second
    # scope never overwrites the first.

    def fetch_path(self, scope: str) -> Path:
        if not self.valid_scope(scope):
            raise ValueError(f"'{scope}' is not a valid {self.label} {self.scope_label} id")
        return DATA_DIR / self.name / f"{scope}.json"

    def stored_scopes(self) -> list[str]:
        d = DATA_DIR / self.name
        return sorted(p.stem for p in d.glob("*.json") if self.valid_scope(p.stem)) if d.is_dir() else []

    @property
    def legacy_fetch_file(self) -> Path:
        """Old single file per cloud; split by migrate_legacy_fetch()."""
        return DATA_DIR / f"{self.name}_fetch_result.json"

    @property
    def catalog_column(self) -> str:
        return f"{self.name}_checks"

    @property
    def can_scan(self) -> bool:
        return self.fetch_cmd is not None

    def valid_scope(self, scope_id: str) -> bool:
        return isinstance(scope_id, str) and bool(scope_id) and bool(self.scope_id_re.match(scope_id))

    def account_scope(self, acct: dict) -> str:
        """Scope id stored on a cloud account ('' when none)."""
        if self.scope_of:
            return self.scope_of(acct) or ""
        return str(acct.get(self.account_scope_field) or acct.get("account_identifier") or "")

    def hint(self, scope: str) -> str:
        return self.access_hint(scope) if self.access_hint else ""

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

def _gcp_fetch(scope: str, out: Path, services: list[str] | None = None) -> list[str]:
    cmd = ["node", str(FETCH_DIR / "gcp_fetch_all.mjs"), "--project", scope, "--out", str(out)]
    if services:
        cmd += ["--services", ",".join(services)]
    return cmd


def _gcloud_bin() -> str:
    found = shutil.which("gcloud")
    if found:
        return found
    local = os.getenv("LOCALAPPDATA")  # default Windows install location
    if local:
        win = Path(local) / "Google" / "Cloud SDK" / "google-cloud-sdk" / "bin" / "gcloud.cmd"
        if win.exists():
            return str(win)
    return "gcloud"


def _gcp_verify(scope: str) -> list[str]:
    # Needs resourcemanager.projects.get, which roles/viewer includes.
    return [_gcloud_bin(), "projects", "describe", scope, "--format=value(projectId)", "--quiet"]


@lru_cache(maxsize=1)
def _gcp_scanner_sa() -> str:
    """Scanner identity: GCP_SCANNER_SA, else the VM's attached service account."""
    if os.getenv("GCP_SCANNER_SA"):
        return os.environ["GCP_SCANNER_SA"]
    req = urllib.request.Request(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email",
        headers={"Metadata-Flavor": "Google"})
    try:
        with urllib.request.urlopen(req, timeout=1) as r:  # noqa: S310 - fixed metadata URL
            return r.read().decode().strip()
    except OSError:
        pass
    try:  # not on a VM: the account gcloud is using
        out = subprocess.run([_gcloud_bin(), "config", "get-value", "account"],
                             capture_output=True, text=True, timeout=15).stdout.strip()
        if "@" in out:
            return out.splitlines()[-1]
    except (OSError, subprocess.SubprocessError):
        pass
    return "<scanner service account>"


def _gcp_hint(scope: str) -> str:
    sa = _gcp_scanner_sa()
    return (f"Grant the scanner service account read access on project '{scope}': "
            f"gcloud projects add-iam-policy-binding {scope} --member=serviceAccount:{sa} "
            f"--role=roles/viewer   (then the same with --role=roles/iam.securityReviewer)")


def _gcp_scope(acct: dict) -> str:
    return str(acct.get("gcp_project") or acct.get("account_identifier") or "")


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
    fetch_cmd=_gcp_fetch, verify_cmd=_gcp_verify, access_hint=_gcp_hint, scope_of=_gcp_scope,
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

_AWS_ACCOUNT_RE = re.compile(r"^\d{12}$")
_AWS_ROLE_RE = re.compile(r"^arn:aws[a-z-]*:iam::(\d{12}):role/")


def _aws_scope(acct: dict) -> str:
    ident = str(acct.get("account_identifier") or "")
    if _AWS_ACCOUNT_RE.match(ident):
        return ident
    m = _AWS_ROLE_RE.match(str(acct.get("role_arn") or ""))
    return m.group(1) if m else ident


def _azure_scope(acct: dict) -> str:
    return str(acct.get("subscription_id") or acct.get("account_identifier") or "")


AWS = ScanProvider(
    name="aws", label="AWS", scope_label="account", scope_key="accounts",
    scope_id_re=_AWS_ACCOUNT_RE,
    account_scope_field="account_identifier", scope_of=_aws_scope,
    lens="aws-well-architected", auth_type="role",
)

AZURE = ScanProvider(
    name="azure", label="Azure", scope_label="subscription", scope_key="subscriptions",
    scope_id_re=re.compile(r"^[0-9a-fA-F]{8}-([0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}$"),
    account_scope_field="subscription_id", scope_of=_azure_scope,
    lens="azure-well-architected", auth_type="service-principal",
)

PROVIDERS: dict[str, ScanProvider] = {p.name: p for p in (GCP, AWS, AZURE)}


def migrate_legacy_fetch(prov: ScanProvider) -> list[str]:
    """Split an old `<provider>_fetch_result.json` into per-scope files.

    Scopes that already have their own file are left alone (the per-scope file
    is newer). The old file is renamed to `.migrated` so this runs once.
    Returns the scopes written.
    """
    src = prov.legacy_fetch_file
    if not src.exists():
        return []
    data = json.loads(src.read_text(encoding="utf-8"))
    written = []
    for scope, body in (data.get(prov.scope_key) or {}).items():
        if not prov.valid_scope(scope):
            continue
        dst = prov.fetch_path(scope)
        if dst.exists():
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        single = {k: v for k, v in data.items() if k != prov.scope_key}
        single[prov.scope_key] = {scope: body}
        dst.write_text(json.dumps(single), encoding="utf-8")
        written.append(scope)
    src.rename(src.with_name(src.name + ".migrated"))
    return written


def get(name: str) -> ScanProvider:
    p = PROVIDERS.get((name or "").lower())
    if p is None:
        raise KeyError(f"Unknown cloud provider '{name}'. Known: {sorted(PROVIDERS)}")
    return p
