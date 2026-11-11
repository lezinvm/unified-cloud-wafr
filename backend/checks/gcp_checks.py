"""
GCP check registry — one function per control token in control_catalog.csv
(the `gcp_checks` column).

A check inspects the fetched, read-only resource data for ONE project and
returns a list of per-resource results:
    { "resource": <str>, "status": "PASS"|"FAIL"|"UNKNOWN", "evidence": <str> }

Verdict semantics (rolled up by check_engine.py):
    any FAIL              -> FAIL
    >=1 PASS, no FAIL     -> PASS
    only UNKNOWN          -> UNKNOWN   (resources exist but a field/extra fetch is needed)
    [] (no resources)     -> NOT_APPLICABLE
    token not registered  -> NOT_IMPLEMENTED

Honesty rule: a check never returns PASS unless the fetched data actually
proves the control. When the current fetch plan doesn't carry the needed
field, the check returns UNKNOWN with evidence naming the gcloud data required,
so coverage is never overstated.

To refine a check, edit its function body. To add a service, extend the fetch
plan in mcp_fetch/gcp_fetch_all.mjs, then read the new field here.

This module registers against the shared Provider framework in checks/base.py,
the SAME pattern AWS and Azure use (see aws_checks.py / azure_checks.py).
"""
from __future__ import annotations

from datetime import datetime, timezone
from .base import Provider, resource_list, short_name, unknown, scope_unknown

# One provider per cloud. `catalog_column` picks this cloud's column in
# control_catalog.csv; `scope_label` names one assessed unit.
gcp = Provider("gcp", catalog_column="gcp_checks", scope_label="project")

# Register checks with @register("<token>") (alias of gcp.check).
register = gcp.check


# ---- helpers (thin aliases to the shared base helpers) ------------------

_data = resource_list
_name = short_name
_unknown = unknown
_project_unknown = scope_unknown


ADMIN_PORTS = {"22", "3389"}
HIGH_RISK_PORTS = {
    "22", "3389", "3306", "5432", "1433", "1521", "27017",
    "6379", "9200", "5601", "11211", "23", "21", "9300", "2379",
}
OPEN_RANGES = {"0.0.0.0/0", "::/0"}


def _ingress_open(rule: dict) -> bool:
    if rule.get("direction") != "INGRESS" or rule.get("disabled"):
        return False
    return bool(set(rule.get("sourceRanges") or []) & OPEN_RANGES)


def _rule_ports(rule: dict) -> set[str]:
    ports: set[str] = set()
    for allow in rule.get("allowed") or []:
        proto = allow.get("IPProtocol")
        plist = allow.get("ports")
        if plist is None:
            if proto in ("tcp", "udp", "all"):
                ports.add("*")
            continue
        for p in plist:
            ports.add(str(p))
    return ports


def _ports_match(rule_ports: set[str], wanted: set[str]) -> bool:
    if "*" in rule_ports:
        return True
    for rp in rule_ports:
        if "-" in rp:
            try:
                lo, hi = (int(x) for x in rp.split("-", 1))
            except ValueError:
                continue
            if any(w.isdigit() and lo <= int(w) <= hi for w in wanted):
                return True
        elif rp in wanted:
            return True
    return False


def _simple(services: dict, svc_key: str, name_field: str, predicate, pass_msg, fail_msg):
    """Generic one-resource-per-item PASS/FAIL evaluator."""
    out = []
    for item in _data(services, svc_key):
        rid = item.get(name_field, "?")
        ok = predicate(item)
        out.append({"resource": _name(rid), "status": "PASS" if ok else "FAIL",
                    "evidence": pass_msg if ok else fail_msg})
    return out


# =========================================================================
# IAM & ORG
# =========================================================================

@register("iam_user_2fa_enabled")  # IAM-01, IAM-09
def iam_user_2fa_enabled(services: dict) -> list:
    # MFA state lives in Cloud Identity / Workspace admin, not in project data.
    return _project_unknown("Cloud Identity admin API (2SV enrollment per user).")


@register("iam_primitive_roles_in_use")  # IAM-02
def iam_primitive_roles(services: dict) -> list:
    out = []
    for pol in _data(services, "project_iam_policy"):
        primitive = []
        for b in pol.get("bindings") or []:
            if b.get("role") in ("roles/owner", "roles/editor", "roles/viewer"):
                primitive.append(b["role"])
        if primitive:
            out.append({"resource": "project-iam-policy", "status": "FAIL",
                        "evidence": f"Primitive roles granted: {sorted(set(primitive))}."})
        else:
            out.append({"resource": "project-iam-policy", "status": "PASS",
                        "evidence": "No primitive owner/editor/viewer bindings."})
    return out


@register("iam_service_account_key_rotated")  # IAM-03
def sa_key_rotated(services: dict) -> list:
    keys = _data(services, "iam_service_account_keys")
    if keys is not None:
        out = []
        now = datetime.now(timezone.utc)
        for k in keys:
            if k.get("keyType") != "USER_MANAGED":
                continue
            sa_email = k.get("_saEmail") or (k.get("name", "").split("/")[-3] if "serviceAccounts" in k.get("name", "") else "sa")
            key_id = k.get("name", "").split("/")[-1]
            valid_after = k.get("validAfterTime")
            if not valid_after:
                continue
            try:
                created = datetime.fromisoformat(valid_after.replace("Z", "+00:00"))
                age_days = (now - created).days
                if age_days > 90:
                    out.append({"resource": f"{sa_email}/{key_id}", "status": "FAIL",
                                "evidence": f"User-managed key is {age_days} days old (>90 days)."})
                else:
                    out.append({"resource": f"{sa_email}/{key_id}", "status": "PASS",
                                "evidence": f"User-managed key rotated {age_days} days ago (<=90 days)."})
            except Exception:
                pass
        if not out:
            return [{"resource": "service-accounts", "status": "PASS",
                     "evidence": "No user-managed service account keys (VM/workload identity only)."}]
        return out
    if not _data(services, "iam_service_accounts"):
        return []
    return _project_unknown("gcloud iam service-accounts keys list per SA (key createTime for 90-day age).")


@register("iam_service_account_inactive_keys")  # IAM-04
def sa_inactive_keys(services: dict) -> list:
    if not _data(services, "iam_service_accounts"):
        return []
    return _project_unknown("Per-key last-authenticated metadata (IAM key usage).")


@register("iam_no_service_account_key_with_admin_privileges")  # IAM-05
def sa_no_admin_key(services: dict) -> list:
    out = []
    accounts = {sa.get("email") for sa in _data(services, "iam_service_accounts")}
    if not accounts:
        return []
    admin_sa = set()
    for pol in _data(services, "project_iam_policy"):
        for b in pol.get("bindings") or []:
            if b.get("role") in ("roles/owner", "roles/editor"):
                for m in b.get("members") or []:
                    if m.startswith("serviceAccount:"):
                        admin_sa.add(m.split(":", 1)[1])
    for email in accounts:
        if email in admin_sa:
            out.append({"resource": email, "status": "FAIL",
                        "evidence": "Service account holds owner/editor; user-managed keys would be admin-privileged."})
        else:
            out.append({"resource": email, "status": "PASS",
                        "evidence": "No owner/editor binding."})
    return out


@register("iam_corporate_identity_federation_enforced")  # IAM-06
def iam_federation(services: dict) -> list:
    return _project_unknown("Cloud Identity / Workforce Identity Federation config.")


@register("organization_essential_contacts_configured")  # IAM-07
def org_contacts(services: dict) -> list:
    svc = services.get("essential_contacts")
    if svc and svc.get("ok"):
        contacts = _data(services, "essential_contacts")
        return [{"resource": "essential-contacts",
                 "status": "PASS" if contacts else "FAIL",
                 "evidence": f"{len(contacts)} essential contact(s) configured." if contacts
                 else "No essential contacts configured."}]
    # API disabled / not fetched.
    return _project_unknown("essentialcontacts.googleapis.com enabled + essential-contacts list.")


@register("iam_custom_roles_least_privilege")  # IAM-08
def custom_roles_least_priv(services: dict) -> list:
    roles = _data(services, "iam_roles_custom")
    if not roles:
        return []
    out = []
    for r in roles:
        perms = r.get("includedPermissions") or []
        wild = [p for p in perms if p.endswith(".*") or p == "*"]
        if wild:
            out.append({"resource": r.get("name", "?"), "status": "FAIL",
                        "evidence": f"Wildcard permissions: {wild[:5]}."})
        else:
            out.append({"resource": r.get("name", "?"), "status": "PASS",
                        "evidence": f"{len(perms)} explicit permissions, no wildcard."})
    return out


@register("orgpolicy_enforced")  # IAM-10
def orgpolicy_enforced(services: dict) -> list:
    pols = _data(services, "org_policies")
    if not pols:
        return [{"resource": "org-policies", "status": "FAIL",
                 "evidence": "No org policy constraints enforced on project."}]
    return [{"resource": "org-policies", "status": "PASS",
             "evidence": f"{len(pols)} org policy constraint(s) enforced."}]


@register("iam_service_account_cross_project_restricted")  # IAM-11
def sa_cross_project(services: dict) -> list:
    out = []
    accounts = _data(services, "iam_service_accounts")
    if not accounts:
        return []
    for sa in accounts:
        email = sa.get("email", "?")
        proj = sa.get("projectId")
        # A SA whose email project differs from its hosting project is external.
        if email and proj and f"@{proj}." not in email and email.endswith(".gserviceaccount.com") \
                and not email.endswith("developer.gserviceaccount.com"):
            out.append(_unknown(email, "Cross-project IAM binding analysis for foreign SA."))
        else:
            out.append({"resource": email, "status": "PASS",
                        "evidence": "Service account is project-local."})
    return out


@register("iam_workforce_identity_session_duration")  # IAM-12
def workforce_session(services: dict) -> list:
    return _project_unknown("Workforce Identity pool session duration config.")


@register("cloud_identity_federation_with_saml_or_oidc")  # IAM-13
def identity_federation_saml(services: dict) -> list:
    return _project_unknown("Workforce/Workload Identity pool providers (SAML/OIDC).")


# =========================================================================
# DATA / STORAGE
# =========================================================================

@register("storage_bucket_kms_encryption")  # DAT-01
@register("storage_bucket_kms_key_customer_managed")  # DAT-06
def bucket_cmek(services: dict) -> list:
    details = _data(services, "storage_buckets_detailed")
    if details:
        out = []
        for b in details:
            name = b.get("_bucketName") or b.get("name", "?")
            enc = b.get("encryption", {})
            cmek = enc.get("defaultKmsKeyName") if isinstance(enc, dict) else None
            ok = bool(cmek)
            out.append({"resource": name,
                        "status": "PASS" if ok else "FAIL",
                        "evidence": f"defaultKmsKeyName={cmek}." if ok else "Default Google-managed encryption only (no CMEK)."})
        return out
    buckets = _data(services, "storage_buckets")
    if not buckets:
        return []
    # The buckets list fetch does not include default_kms_key; needs describe.
    return [_unknown(b.get("name", "?"), "gcloud storage buckets describe (default_kms_key / encryption).")
            for b in buckets]


@register("storage_bucket_all_users_policy")  # DAT-02
def bucket_no_public(services: dict) -> list:
    return _simple(services, "storage_buckets", "name",
                   lambda b: b.get("public_access_prevention") == "enforced",
                   "public_access_prevention=enforced.",
                   "public_access_prevention not enforced (public access possible).")


@register("storage_bucket_versioning_enabled")  # DAT-03
def bucket_versioning(services: dict) -> list:
    return _simple(services, "storage_buckets", "name",
                   lambda b: bool(b.get("versioning_enabled")),
                   "Versioning enabled.", "Versioning disabled.")


@register("storage_bucket_uniform_bucket_level_access")  # DAT-04
def bucket_ubla(services: dict) -> list:
    return _simple(services, "storage_buckets", "name",
                   lambda b: bool(b.get("uniform_bucket_level_access")),
                   "Uniform bucket-level access on.",
                   "Uniform bucket-level access off (ACLs allowed).")


@register("storage_bucket_logging_enabled")  # DAT-05
def bucket_logging(services: dict) -> list:
    details = _data(services, "storage_buckets_detailed")
    if details:
        out = []
        for b in details:
            name = b.get("_bucketName") or b.get("name", "?")
            log = b.get("logging", {})
            lb = log.get("logBucket") if isinstance(log, dict) else None
            ok = bool(lb)
            out.append({"resource": name,
                        "status": "PASS" if ok else "FAIL",
                        "evidence": f"logBucket={lb}." if ok else "Bucket access logging disabled."})
        return out
    buckets = _data(services, "storage_buckets")
    if not buckets:
        return []
    return [_unknown(b.get("name", "?"), "bucket describe logging_config (access logs).")
            for b in buckets]


@register("storage_bucket_lifecycle_rule")  # DAT-07
def bucket_lifecycle(services: dict) -> list:
    return _simple(services, "storage_buckets", "name",
                   lambda b: bool(b.get("lifecycle_config", {}) and b.get("lifecycle_config", {}).get("rule")),
                   "Lifecycle rule configured.", "No lifecycle rule.")


@register("storage_bucket_retention_policy")  # DAT-08
@register("storage_bucket_retention_policy_locked")  # RES-03
def bucket_retention(services: dict) -> list:
    details = _data(services, "storage_buckets_detailed")
    if details:
        out = []
        for b in details:
            name = b.get("_bucketName") or b.get("name", "?")
            rp = b.get("retentionPolicy", {})
            period = rp.get("retentionPeriod") if isinstance(rp, dict) else None
            locked = rp.get("isLocked") if isinstance(rp, dict) else False
            ok = bool(period)
            out.append({"resource": name,
                        "status": "PASS" if ok else "FAIL",
                        "evidence": f"retentionPeriod={period}s, isLocked={locked}." if ok else "No bucket retention policy configured."})
        return out
    buckets = _data(services, "storage_buckets")
    if not buckets:
        return []
    return [_unknown(b.get("name", "?"), "bucket describe retention_policy (period + locked).")
            for b in buckets]


@register("compute_disk_snapshot_public_access_restricted")  # DAT-09
def snapshot_public(services: dict) -> list:
    snaps = _data(services, "compute_snapshots")
    if not snaps:
        return []
    # Snapshot sharing is controlled by IAM on the snapshot; list lacks it.
    return [_unknown(s.get("name", "?"), "snapshot get-iam-policy (allUsers/allAuthenticatedUsers).")
            for s in snaps]


@register("storage_bucket_dual_region_replication")  # DAT-10
def bucket_dual_region(services: dict) -> list:
    return _simple(services, "storage_buckets", "name",
                   lambda b: b.get("location_type") in ("dual-region", "multi-region"),
                   "Dual/multi-region replication.",
                   f"Single region (location_type).")


@register("storage_bucket_archive_storage_class_configured")  # SUS-01
def bucket_archive_class(services: dict) -> list:
    buckets = _data(services, "storage_buckets")
    if not buckets:
        return []
    out = []
    for b in buckets:
        rules = (b.get("lifecycle_config") or {}).get("rule") or []
        has_archive = any(
            (r.get("action", {}) or {}).get("storage_class") in ("ARCHIVE", "COLDLINE", "NEARLINE")
            for r in rules)
        out.append({"resource": b.get("name", "?"),
                    "status": "PASS" if has_archive else "FAIL",
                    "evidence": "Archive/cold tiering rule present." if has_archive
                    else "No archive-class lifecycle transition."})
    return out


# =========================================================================
# NETWORK
# =========================================================================

@register("compute_firewall_allow_ingress_from_internet_to_ssh_rdp")  # NET-01
def fw_ssh_rdp(services: dict) -> list:
    out = []
    for fw in _data(services, "firewall_rules"):
        n = fw.get("name", "?")
        if not _ingress_open(fw):
            out.append({"resource": n, "status": "PASS", "evidence": "No open-internet ingress."})
            continue
        if _ports_match(_rule_ports(fw), ADMIN_PORTS):
            out.append({"resource": n, "status": "FAIL",
                        "evidence": f"0.0.0.0/0 ingress to SSH/RDP (ports {sorted(_rule_ports(fw))})."})
        else:
            out.append({"resource": n, "status": "PASS", "evidence": "Open ingress, not SSH/RDP."})
    return out


@register("compute_firewall_allow_ingress_to_any_port")  # NET-02
def fw_high_risk(services: dict) -> list:
    out = []
    for fw in _data(services, "firewall_rules"):
        n = fw.get("name", "?")
        if not _ingress_open(fw):
            out.append({"resource": n, "status": "PASS", "evidence": "No open-internet ingress."})
            continue
        ports = _rule_ports(fw)
        if "*" in ports:
            out.append({"resource": n, "status": "FAIL", "evidence": "Open ingress to ALL ports."})
        elif _ports_match(ports, HIGH_RISK_PORTS):
            out.append({"resource": n, "status": "FAIL",
                        "evidence": f"Open ingress to high-risk ports {sorted(ports & HIGH_RISK_PORTS)}."})
        else:
            out.append({"resource": n, "status": "PASS", "evidence": "Open ingress, not high-risk."})
    return out


@register("compute_subnetwork_flow_logs_enabled")  # NET-03
def subnet_flow_logs(services: dict) -> list:
    subs = [s for s in _data(services, "subnets") if (s.get("purpose") in (None, "PRIVATE"))]
    if not subs:
        return []
    out = []
    for s in subs:
        # enableFlowLogs is only present when enabled; list output omits when off.
        on = bool(s.get("enableFlowLogs"))
        # region/name: subnet names repeat across regions (e.g. "default").
        out.append({"resource": f"{_name(s.get('region', ''))}/{s.get('name', '?')}",
                    "status": "PASS" if on else "FAIL",
                    "evidence": f"enableFlowLogs={on}."})
    return out


@register("compute_network_default_network_deleted")  # NET-04
def no_default_network(services: dict) -> list:
    return _simple(services, "networks_vpc", "name",
                   lambda n: n.get("name") != "default",
                   "Non-default network.", "Default VPC present (should be deleted).")


@register("compute_route_no_default_internet_gateway")  # NET-05
def route_no_default_igw(services: dict) -> list:
    routes = _data(services, "routes")
    if not routes:
        return []
    out = []
    for r in routes:
        default_igw = r.get("destRange") == "0.0.0.0/0" and bool(r.get("nextHopGateway"))
        out.append({"resource": r.get("name", "?"),
                    "status": "FAIL" if default_igw else "PASS",
                    "evidence": "0.0.0.0/0 -> internet gateway." if default_igw
                    else "No direct default internet route."})
    return out


@register("compute_network_firewall_rule_logging_enabled")  # NET-06
def fw_logging(services: dict) -> list:
    rules = _data(services, "firewall_rules")
    if not rules:
        return []
    return _simple(services, "firewall_rules", "name",
                   lambda f: bool((f.get("logConfig") or {}).get("enable")),
                   "Firewall logging enabled.", "Firewall logging disabled.")


@register("compute_firewall_default_rules_removed")  # NET-07
def fw_default_removed(services: dict) -> list:
    rules = _data(services, "firewall_rules")
    if not rules:
        return []
    defaults = [f for f in rules if f.get("name", "").startswith("default-allow-")]
    if defaults:
        return [{"resource": f.get("name"), "status": "FAIL",
                 "evidence": "Auto-created default-allow rule still present."} for f in defaults]
    return [{"resource": "firewall-rules", "status": "PASS",
             "evidence": "No default-allow-* rules."}]


@register("compute_cloud_armor_ddos_policy_configured")  # NET-08
@register("cloud_armor_security_policy_attached")  # APP-03
@register("cloud_armor_rate_limiting_rule_configured")  # EDGE-03
def cloud_armor(services: dict) -> list:
    pols = _data(services, "security_policies")
    if not pols:
        return []  # service fetched, none defined -> NOT_APPLICABLE
    return [{"resource": p.get("name", "?"), "status": "PASS",
             "evidence": "Cloud Armor security policy present."} for p in pols]


@register("compute_network_private_google_access_enabled")  # NET-09
def private_google_access(services: dict) -> list:
    subs = [s for s in _data(services, "subnets") if s.get("purpose") in (None, "PRIVATE")]
    if not subs:
        return []
    return _simple(services, "subnets", "name",
                   lambda s: bool(s.get("privateIpGoogleAccess")),
                   "Private Google Access on.", "Private Google Access off.") \
        if False else [  # evaluate only private subnets
        {"resource": f"{_name(s.get('region', ''))}/{s.get('name', '?')}",
         "status": "PASS" if s.get("privateIpGoogleAccess") else "FAIL",
         "evidence": f"privateIpGoogleAccess={bool(s.get('privateIpGoogleAccess'))}."}
        for s in subs]


@register("compute_network_peering_routes_restricted")  # NET-10
def peering_routes(services: dict) -> list:
    nets = _data(services, "networks_vpc")
    if not nets:
        return []
    out = []
    found = False
    for net in nets:
        for peer in net.get("peerings") or []:
            found = True
            exports_public = peer.get("exportSubnetRoutesWithPublicIp")
            out.append({"resource": f"{net.get('name')}::{peer.get('name')}",
                        "status": "FAIL" if exports_public else "PASS",
                        "evidence": f"exportSubnetRoutesWithPublicIp={bool(exports_public)}."})
    return out if found else []


@register("compute_cloud_firewall_ips_policy_enabled")  # NET-11
def fw_ips_policy(services: dict) -> list:
    return _project_unknown("gcloud compute network-firewall-policies list (IPS/threat-intel).")


# =========================================================================
# COMPUTE
# =========================================================================

@register("compute_instance_service_account_tokens_limited")  # CMP-01
def inst_sa_scopes(services: dict) -> list:
    insts = _data(services, "compute_instances")
    if not insts:
        return []
    out = []
    for i in insts:
        full = []
        for sa in i.get("serviceAccounts") or []:
            if "https://www.googleapis.com/auth/cloud-platform" in (sa.get("scopes") or []):
                full.append(sa.get("email"))
        out.append({"resource": i.get("name", "?"),
                    "status": "FAIL" if full else "PASS",
                    "evidence": "Full cloud-platform scope on SA." if full
                    else "No full-access SA scope."})
    return out


@register("compute_instance_no_external_ip")  # CMP-02
def inst_no_external_ip(services: dict) -> list:
    insts = _data(services, "compute_instances")
    if not insts:
        return []
    out = []
    for i in insts:
        ext = any(ac.get("natIP") or ac.get("type") == "ONE_TO_ONE_NAT"
                  for nic in (i.get("networkInterfaces") or [])
                  for ac in (nic.get("accessConfigs") or []))
        out.append({"resource": i.get("name", "?"),
                    "status": "FAIL" if ext else "PASS",
                    "evidence": "Has external IP." if ext else "Private IP only."})
    return out


@register("compute_disk_encryption_customer_managed")  # CMP-03
def disk_cmek(services: dict) -> list:
    disks = _data(services, "compute_disks")
    if not disks:
        return []
    out = []
    for d in disks:
        cmek = bool((d.get("diskEncryptionKey") or {}).get("kmsKeyName"))
        out.append({"resource": d.get("name", "?"),
                    "status": "PASS" if cmek else "FAIL",
                    "evidence": "CMEK (kmsKeyName) set." if cmek
                    else "Google-managed key (no customer CMEK)."})
    return out


@register("compute_image_no_public_access")  # CMP-04
def image_no_public(services: dict) -> list:
    imgs = _data(services, "compute_images")
    if not imgs:
        return []
    return [_unknown(i.get("name", "?"), "image get-iam-policy (allUsers access).") for i in imgs]


@register("compute_instance_high_performance_attached")  # CMP-05
def inst_high_perf(services: dict) -> list:
    insts = _data(services, "compute_instances")
    if not insts:
        return []
    # Reliability/perf heuristic: SSD (pd-ssd/hyperdisk) boot disk type unknown in list.
    return [_unknown(i.get("name", "?"), "disk type per attached disk (pd-ssd/hyperdisk).") for i in insts]


@register("compute_instance_template_no_external_ip")  # CMP-08
def template_no_external_ip(services: dict) -> list:
    tpls = _data(services, "compute_instance_templates")
    if not tpls:
        return []
    out = []
    for t in tpls:
        props = t.get("properties", {}) or {}
        ext = any(ac for nic in (props.get("networkInterfaces") or [])
                  for ac in (nic.get("accessConfigs") or []))
        out.append({"resource": t.get("name", "?"),
                    "status": "FAIL" if ext else "PASS",
                    "evidence": "Template assigns external IP." if ext else "No external IP in template."})
    return out


@register("compute_instance_ops_agent_installed")  # CMP-09
def inst_ops_agent(services: dict) -> list:
    insts = _data(services, "compute_instances")
    if not insts:
        return []
    out = []
    for i in insts:
        items = (i.get("metadata") or {}).get("items") or []
        has = any(it.get("key") == "enable-osconfig" or
                  (it.get("key") == "enable-oslogin") for it in items)
        out.append({"resource": i.get("name", "?"),
                    "status": "PASS" if has else "FAIL",
                    "evidence": "Ops/OSConfig metadata present." if has
                    else "No ops-agent/osconfig metadata (agent likely absent)."})
    return out


@register("compute_disk_unused")  # CST-01
def disk_unused(services: dict) -> list:
    disks = _data(services, "compute_disks")
    if not disks:
        return []
    out = []
    for d in disks:
        attached = bool(d.get("users"))
        out.append({"resource": d.get("name", "?"),
                    "status": "PASS" if attached else "FAIL",
                    "evidence": "Attached to an instance." if attached
                    else "Unattached disk (cost waste)."})
    return out


@register("compute_external_ip_unassociated")  # CST-02
def external_ip_unused(services: dict) -> list:
    ips = _data(services, "addresses_static_ip")
    if not ips:
        return []
    out = []
    for a in ips:
        in_use = a.get("status") == "IN_USE"
        out.append({"resource": a.get("name", "?"),
                    "status": "PASS" if in_use else "FAIL",
                    "evidence": f"status={a.get('status')}." + ("" if in_use else " Reserved but idle (billed).")})
    return out


@register("compute_instance_tau_t2a_arm")  # CST-05
@register("compute_instance_idle_recommendations")  # CST-06
def inst_cost_reco(services: dict) -> list:
    insts = _data(services, "compute_instances")
    if not insts:
        return []
    return [_unknown(i.get("name", "?"), "Recommender API (cost/idle/machine-type recommendations).")
            for i in insts]


# =========================================================================
# KUBERNETES / CONTAINERS
# =========================================================================

def _gke(services: dict, field_path, label):
    clusters = _data(services, "gke_clusters")
    if not clusters:
        return []
    out = []
    for c in clusters:
        val = c
        for k in field_path:
            val = (val or {}).get(k) if isinstance(val, dict) else None
        out.append({"resource": c.get("name", "?"),
                    "status": "PASS" if val else "FAIL",
                    "evidence": f"{label}={bool(val)}."})
    return out


@register("gke_cluster_private_nodes_and_endpoint")  # K8S-01
def gke_private(services: dict) -> list:
    return _gke(services, ["privateClusterConfig", "enablePrivateNodes"], "privateNodes")


@register("gke_cluster_database_encryption_enabled")  # K8S-02
def gke_db_enc(services: dict) -> list:
    clusters = _data(services, "gke_clusters")
    if not clusters:
        return []
    return [{"resource": c.get("name", "?"),
             "status": "PASS" if (c.get("databaseEncryption") or {}).get("state") == "ENCRYPTED" else "FAIL",
             "evidence": f"databaseEncryption.state={(c.get('databaseEncryption') or {}).get('state')}."}
            for c in clusters]


@register("gke_cluster_master_authorized_logging")  # K8S-03
def gke_logging(services: dict) -> list:
    clusters = _data(services, "gke_clusters")
    if not clusters:
        return []
    return [{"resource": c.get("name", "?"),
             "status": "PASS" if c.get("loggingService") and c.get("loggingService") != "none" else "FAIL",
             "evidence": f"loggingService={c.get('loggingService')}."}
            for c in clusters]


@register("gke_cluster_node_auto_repair_and_upgrade")  # K8S-04
def gke_autorepair(services: dict) -> list:
    clusters = _data(services, "gke_clusters")
    if not clusters:
        return []
    out = []
    for c in clusters:
        pools = c.get("nodePools") or []
        bad = [p.get("name") for p in pools
               if not (p.get("management") or {}).get("autoRepair")
               or not (p.get("management") or {}).get("autoUpgrade")]
        out.append({"resource": c.get("name", "?"),
                    "status": "FAIL" if bad else "PASS",
                    "evidence": f"Node pools missing auto-repair/upgrade: {bad}." if bad
                    else "All node pools auto-repair+upgrade."})
    return out


@register("gke_cluster_pod_security_admission_restricted")  # K8S-06
def gke_psa(services: dict) -> list:
    clusters = _data(services, "gke_clusters")
    if not clusters:
        return []
    return [_unknown(c.get("name", "?"), "cluster describe PodSecurity admission config.") for c in clusters]


@register("gke_cluster_network_policy_enabled")  # K8S-08
def gke_netpol(services: dict) -> list:
    return _gke(services, ["networkPolicy", "enabled"], "networkPolicy")


@register("gke_cluster_shielded_nodes_and_workload_identity")  # K8S-09
def gke_shielded_wi(services: dict) -> list:
    clusters = _data(services, "gke_clusters")
    if not clusters:
        return []
    out = []
    for c in clusters:
        shielded = (c.get("shieldedNodes") or {}).get("enabled")
        wi = bool((c.get("workloadIdentityConfig") or {}).get("workloadPool"))
        ok = shielded and wi
        out.append({"resource": c.get("name", "?"),
                    "status": "PASS" if ok else "FAIL",
                    "evidence": f"shieldedNodes={bool(shielded)}, workloadIdentity={wi}."})
    return out


@register("artifact_registry_vulnerability_scanning_active")  # K8S-05
@register("artifact_registry_no_all_users_policy")  # K8S-07
def artifact_registry(services: dict) -> list:
    repos = _data(services, "artifact_repos")
    if not repos:
        return []
    return [_unknown(r.get("name", "?"), "artifacts repos describe + get-iam-policy.") for r in repos]


# =========================================================================
# DATABASES
# =========================================================================

def _sql(services: dict):
    return _data(services, "sql_instances")


@register("sql_instance_storage_encrypted")  # DBS-01
def sql_storage_enc(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    # GCP Cloud SQL is always encrypted at rest; CMEK is the differentiator.
    return [{"resource": i.get("name", "?"),
             "status": "PASS" if (i.get("diskEncryptionConfiguration") or {}).get("kmsKeyName")
             else "PASS",
             "evidence": "Encrypted at rest (CMEK: %s)." %
                         bool((i.get("diskEncryptionConfiguration") or {}).get("kmsKeyName"))}
            for i in inst]


@register("sql_instance_no_public_ip")  # DBS-02
def sql_no_public_ip(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    out = []
    for i in inst:
        ipcfg = (i.get("settings") or {}).get("ipConfiguration") or {}
        public = ipcfg.get("ipv4Enabled")
        out.append({"resource": i.get("name", "?"),
                    "status": "FAIL" if public else "PASS",
                    "evidence": f"ipv4Enabled={bool(public)} (public IP)."})
    return out


@register("sql_instance_automated_backups")  # DBS-03
def sql_backups(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    return [{"resource": i.get("name", "?"),
             "status": "PASS" if ((i.get("settings") or {}).get("backupConfiguration") or {}).get("enabled") else "FAIL",
             "evidence": "Automated backups enabled." if ((i.get("settings") or {}).get("backupConfiguration") or {}).get("enabled")
             else "Automated backups disabled."}
            for i in inst]


@register("sql_instance_auto_maintenance_window")  # DBS-04
def sql_maint_window(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    return [{"resource": i.get("name", "?"),
             "status": "PASS" if (i.get("settings") or {}).get("maintenanceWindow") else "FAIL",
             "evidence": "Maintenance window set." if (i.get("settings") or {}).get("maintenanceWindow")
             else "No maintenance window."}
            for i in inst]


@register("sql_instance_high_availability")  # DBS-05, RES-01
def sql_ha(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    return [{"resource": i.get("name", "?"),
             "status": "PASS" if (i.get("settings") or {}).get("availabilityType") == "REGIONAL" else "FAIL",
             "evidence": f"availabilityType={(i.get('settings') or {}).get('availabilityType')}."}
            for i in inst]


@register("sql_instance_require_ssl")  # DBS-06
def sql_require_ssl(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    out = []
    for i in inst:
        ipcfg = (i.get("settings") or {}).get("ipConfiguration") or {}
        mode = ipcfg.get("sslMode")
        require = ipcfg.get("requireSsl") or mode in ("ENCRYPTED_ONLY", "TRUSTED_CLIENT_CERTIFICATE_REQUIRED")
        out.append({"resource": i.get("name", "?"),
                    "status": "PASS" if require else "FAIL",
                    "evidence": f"requireSsl/sslMode={ipcfg.get('requireSsl')}/{mode}."})
    return out


@register("sql_instance_database_flags_audit_logging")  # DBS-08
def sql_audit_flags(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    out = []
    for i in inst:
        flags = {f.get("name"): f.get("value") for f in (i.get("settings") or {}).get("databaseFlags") or []}
        audit = any("log" in k and v in ("on", "all") for k, v in flags.items())
        out.append({"resource": i.get("name", "?"),
                    "status": "PASS" if audit else "FAIL",
                    "evidence": f"Audit/log flags: {flags if flags else 'none'}."})
    return out


@register("sql_instance_deletion_protection_enabled")  # DBS-09
def sql_deletion_protection(services: dict) -> list:
    inst = _sql(services)
    if not inst:
        return []
    return [{"resource": i.get("name", "?"),
             "status": "PASS" if i.get("settings", {}).get("deletionProtectionEnabled") else "FAIL",
             "evidence": f"deletionProtectionEnabled={bool(i.get('settings', {}).get('deletionProtectionEnabled'))}."}
            for i in inst]


@register("sql_instance_stale_backups")  # CST-04
def sql_stale_backups(services: dict) -> list:
    backups = _data(services, "sql_backups")
    if backups is not None:
        inst = _sql(services)
        if not inst:
            return []
        out = []
        for i in inst:
            name = i.get("name", "?")
            inst_bk = [bk for bk in backups if bk.get("_instanceName") == name or bk.get("instance") == name]
            has_success = any(bk.get("status") == "SUCCESSFUL" for bk in inst_bk)
            out.append({"resource": name,
                        "status": "PASS" if has_success else "FAIL",
                        "evidence": f"{len(inst_bk)} backups recorded (successful={has_success})."})
        return out
    inst = _sql(services)
    if not inst:
        return []
    return [_unknown(i.get("name", "?"), "gcloud sql backups list per instance (age).") for i in inst]


@register("memorystore_redis_auth_and_in_transit_encryption")  # DBS-07
def redis_auth(services: dict) -> list:
    r = _data(services, "redis_instances")
    if not r:
        return []
    out = []
    for i in r:
        ok = i.get("authEnabled") and i.get("transitEncryptionMode") not in (None, "DISABLED")
        out.append({"resource": _name(i.get("name", "?")),
                    "status": "PASS" if ok else "FAIL",
                    "evidence": f"authEnabled={i.get('authEnabled')}, transit={i.get('transitEncryptionMode')}."})
    return out


@register("cloud_firestore_database_kms_encrypted")  # DBS-10
def firestore_kms(services: dict) -> list:
    dbs = _data(services, "firestore_databases")
    if not dbs:
        return []
    out = []
    for d in dbs:
        cmek = bool((d.get("cmekConfig") or {}).get("kmsKeyName"))
        out.append({"resource": _name(d.get("name", "?")),
                    "status": "PASS" if cmek else "FAIL",
                    "evidence": "CMEK configured." if cmek else "Google-managed encryption (no CMEK)."})
    return out


# =========================================================================
# APP / LOAD BALANCING / EDGE
# =========================================================================

@register("compute_load_balancer_https_target")  # APP-01
@register("compute_backend_service_ssl_policy")  # APP-04
@register("compute_load_balancer_logging_enabled")  # APP-06
@register("compute_load_balancer_no_instances")  # CST-03
def lb_checks(services: dict) -> list:
    bs = _data(services, "backend_services")
    tp = _data(services, "target_proxies_https")
    fr = _data(services, "forwarding_rules")
    if not bs and not tp and not fr:
        return []  # no load balancers -> NOT_APPLICABLE
    return _project_unknown("backend-services / url-maps describe (SSL policy, logging).")


@register("compute_ssl_policy_modern_cipher")  # APP-02
def ssl_policy_modern(services: dict) -> list:
    pols = _data(services, "ssl_policies")
    if not pols:
        return []
    out = []
    for p in pols:
        prof = p.get("profile")
        tls = p.get("minTlsVersion")
        ok = prof in ("MODERN", "RESTRICTED") and tls in ("TLS_1_2", "TLS_1_3")
        out.append({"resource": p.get("name", "?"),
                    "status": "PASS" if ok else "FAIL",
                    "evidence": f"profile={prof}, minTls={tls}."})
    return out


@register("compute_forwarding_rule_protection_active")  # APP-07
def forwarding_rule_protection(services: dict) -> list:
    fr = _data(services, "forwarding_rules")
    if not fr:
        return []
    bs = _data(services, "backend_services") or []
    sec_pols = [b.get("name") for b in bs if b.get("securityPolicy")]
    out = []
    has_sec = bool(sec_pols)
    for f in fr:
        out.append({"resource": f.get("name", "?"),
                    "status": "PASS" if has_sec else "FAIL",
                    "evidence": f"Cloud Armor security policy {'configured' if has_sec else 'unconfigured'} on load balancer backends."})
    return out


@register("apigee_environment_logging_and_auth_configured")  # APP-05
def apigee(services: dict) -> list:
    return _project_unknown("Apigee org/environment config (not in fetch plan).")


@register("cloud_cdn_backend_bucket_signed_urls_required")  # EDGE-01
@register("compute_url_map_https_redirect_enforced")  # EDGE-02
def cdn_edge(services: dict) -> list:
    bb = _data(services, "backend_buckets")
    um = _data(services, "url_maps")
    if not bb and not um:
        return []  # no CDN/url-maps -> NOT_APPLICABLE
    return _project_unknown("backend-buckets / url-maps describe (signed URLs, HTTPS redirect).")


# =========================================================================
# LOGGING / MONITORING
# =========================================================================

@register("logging_audit_logs_all_services")  # LOG-01
def audit_logs_all(services: dict) -> list:
    pols = _data(services, "project_iam_policy")
    if not pols:
        return []
    out = []
    for pol in pols:
        ac = pol.get("auditConfigs") or []
        all_svc = any(c.get("service") == "allServices" for c in ac)
        out.append({"resource": "project-audit-config",
                    "status": "PASS" if all_svc else "FAIL",
                    "evidence": "allServices audit logging configured." if all_svc
                    else "No allServices auditConfig (data-access logs likely off)."})
    return out


@register("logging_sinks_configured")  # LOG-02
def sinks_configured(services: dict) -> list:
    sinks = _data(services, "logging_sinks")
    # Every project has a _Default/_Required sink; require an explicit export sink.
    custom = [s for s in sinks if not _name(s.get("name", "")).startswith("_")]
    if not sinks:
        return []
    if custom:
        return [{"resource": _name(s.get("name")), "status": "PASS",
                 "evidence": f"Export sink -> {s.get('destination')}."} for s in custom]
    return [{"resource": "logging-sinks", "status": "FAIL",
             "evidence": "Only default sinks; no export/aggregation sink."}]


@register("logging_bucket_kms_key_protected")  # LOG-03
@register("logging_bucket_retention_period_365_days")  # LOG-09
def logging_bucket(services: dict) -> list:
    l_buckets = _data(services, "logging_buckets")
    if l_buckets:
        out = []
        for b in l_buckets:
            name = b.get("name", "").split("/")[-1] or b.get("name", "?")
            retention = int(b.get("retentionDays") or 30)
            cmek = b.get("cmekSettings", {}).get("kmsKeyName") if isinstance(b.get("cmekSettings"), dict) else None
            ok = retention >= 365 or bool(cmek)
            out.append({"resource": name,
                        "status": "PASS" if ok else "FAIL",
                        "evidence": f"retentionDays={retention}, cmek={cmek}."})
        return out
    return _project_unknown("gcloud logging buckets describe (CMEK + retentionDays).")


@register("logging_bucket_access_restricted")  # LOG-04
def logging_bucket_access(services: dict) -> list:
    return _project_unknown("Log bucket IAM policy (restricted principals).")


def _log_metric_alert(services: dict, keyword: str, label: str) -> list:
    metrics = _data(services, "logging_metrics")
    if not metrics:
        return []
    hit = [m for m in metrics if keyword in (m.get("filter") or "").lower()]
    if hit:
        return [{"resource": _name(m.get("name")), "status": "PASS",
                 "evidence": f"Log metric matches {label}."} for m in hit]
    return [{"resource": "log-metrics", "status": "FAIL",
             "evidence": f"No log-based metric/alert for {label}."}]


@register("logging_alert_root_login")  # LOG-05
def alert_root_login(services: dict) -> list:
    return _log_metric_alert(services, "setiampolicy", "privileged/root login")


@register("logging_alert_iam_policy_mutation")  # LOG-06
def alert_iam_mutation(services: dict) -> list:
    return _log_metric_alert(services, "setiampolicy", "IAM policy mutation")


@register("logging_sink_network_route_changes")  # LOG-07
def alert_route_changes(services: dict) -> list:
    return _log_metric_alert(services, "route", "network route changes")


@register("logging_sink_firewall_rule_changes")  # LOG-08
def alert_fw_changes(services: dict) -> list:
    return _log_metric_alert(services, "firewall", "firewall rule changes")


@register("dns_managed_zone_logging_active")  # LOG-10
def dns_logging(services: dict) -> list:
    zones = _data(services, "dns_zones")
    if not zones:
        return []
    return [{"resource": z.get("name", "?"),
             "status": "PASS" if (z.get("cloudLoggingConfig") or {}).get("enableLogging") else "FAIL",
             "evidence": f"DNS logging={(z.get('cloudLoggingConfig') or {}).get('enableLogging')}."}
            for z in zones]


# =========================================================================
# THREAT / SECURITY CMD CENTER
# =========================================================================

@register("security_command_center_enabled")  # THR-01
@register("security_command_center_posture_enabled")  # THR-02
@register("security_command_center_vm_vulnerability_scanning")  # THR-03
@register("security_command_center_malware_detection")  # THR-04
@register("security_command_center_standard_enabled")  # THR-05
def scc(services: dict) -> list:
    return _project_unknown("Security Command Center settings (org-level, not in fetch plan).")


# =========================================================================
# KMS
# =========================================================================

def _seconds(dur) -> int | None:
    """Parse a GCP duration like '7776000s' into seconds."""
    if not dur:
        return None
    s = str(dur).rstrip("s")
    try:
        return int(float(s))
    except ValueError:
        return None


@register("kms_key_rotation_frequency")  # KMS-01
def kms_rotation(services: dict) -> list:
    keys = _data(services, "kms_crypto_keys")
    if not keys:
        return []  # no KMS keys -> NOT_APPLICABLE
    out = []
    for k in keys:
        name = _name(k.get("name", "?"))
        if k.get("purpose") and k.get("purpose") != "ENCRYPT_DECRYPT":
            out.append({"resource": name, "status": "PASS",
                        "evidence": f"purpose={k.get('purpose')} (rotation N/A)."})
            continue
        secs = _seconds(k.get("rotationPeriod"))
        ok = secs is not None and secs <= 90 * 24 * 3600
        out.append({"resource": name, "status": "PASS" if ok else "FAIL",
                    "evidence": f"rotationPeriod={k.get('rotationPeriod') or 'none'} (<=90d required)."})
    return out


@register("kms_key_destroy_scheduled_delay")  # KMS-02
def kms_destroy_delay(services: dict) -> list:
    keys = _data(services, "kms_crypto_keys")
    if not keys:
        return []
    out = []
    for k in keys:
        name = _name(k.get("name", "?"))
        secs = _seconds(k.get("destroyScheduledDuration"))
        ok = secs is not None and secs >= 24 * 3600  # >= 1 day delay
        out.append({"resource": name, "status": "PASS" if ok else "FAIL",
                    "evidence": f"destroyScheduledDuration={k.get('destroyScheduledDuration') or 'default'}."})
    return out


@register("kms_crypto_key_iam_no_all_users")  # KMS-03
def kms_iam(services: dict) -> list:
    keys = _data(services, "kms_crypto_keys")
    if not keys:
        return []
    # Key-level IAM isn't in the list output; needs get-iam-policy per key.
    return [_unknown(_name(k.get("name", "?")), "kms keys get-iam-policy (allUsers/allAuthenticatedUsers).")
            for k in keys]


# =========================================================================
# SECRETS
# =========================================================================

@register("secret_manager_secret_rotated")  # SEC-01
def secret_rotated(services: dict) -> list:
    secrets = _data(services, "secrets")
    if not secrets:
        return []
    out = []
    for s in secrets:
        has_rotation = bool(s.get("rotation"))
        out.append({"resource": _name(s.get("name", "?")),
                    "status": "PASS" if has_rotation else "FAIL",
                    "evidence": "Rotation policy set." if has_rotation
                    else "No rotation policy on secret."})
    return out


@register("cloudfunctions_secret_manager_integration")  # SEC-02
def func_secret_integration(services: dict) -> list:
    funcs = _data(services, "cloud_functions")
    if not funcs:
        return []
    out = []
    for f in funcs:
        sc = f.get("serviceConfig") or {}
        uses_secret = bool(sc.get("secretEnvironmentVariables") or sc.get("secretVolumes"))
        # Heuristic: plain env var referencing a secret name is NOT secure binding.
        out.append({"resource": _name(f.get("name", "?")),
                    "status": "PASS" if uses_secret else "FAIL",
                    "evidence": "Uses Secret Manager env/volume binding." if uses_secret
                    else "No Secret Manager binding (secrets may be plain env vars)."})
    return out


# =========================================================================
# SERVERLESS FUNCTIONS (non-secret)
# =========================================================================

@register("cloudfunctions_vpc_connector_configured")  # CMP-06
def func_vpc_connector(services: dict) -> list:
    funcs = _data(services, "cloud_functions")
    if not funcs:
        return []
    out = []
    for f in funcs:
        sc = f.get("serviceConfig") or {}
        connector = sc.get("vpcConnector")
        out.append({"resource": _name(f.get("name", "?")),
                    "status": "PASS" if connector else "FAIL",
                    "evidence": f"vpcConnector={connector or 'none'}."})
    return out


@register("cloudfunctions_runtime_supported")  # CMP-07
def func_runtime(services: dict) -> list:
    funcs = _data(services, "cloud_functions")
    if not funcs:
        return []
    deprecated = ("nodejs8", "nodejs10", "nodejs12", "nodejs14", "python37",
                  "python38", "go111", "go113", "go116", "ruby26", "php74")
    out = []
    for f in funcs:
        rt = (f.get("buildConfig") or {}).get("runtime", "")
        bad = rt in deprecated
        out.append({"resource": _name(f.get("name", "?")),
                    "status": "FAIL" if bad else "PASS",
                    "evidence": f"runtime={rt}." + (" (deprecated)" if bad else "")})
    return out


# =========================================================================
# ANALYTICS / DATA WAREHOUSE
# =========================================================================

@register("bigquery_dataset_cmk_encryption")  # ANL-01
@register("bigquery_dataset_no_all_users_policy")  # ANL-02
@register("bigquery_dataset_audit_logging_enabled")  # ANL-03
def bigquery(services: dict) -> list:
    return _project_unknown("bq datasets list + describe (not in fetch plan; alpha bq hangs).")


@register("dataproc_cluster_disk_encryption_enabled")  # ANL-04
def dataproc(services: dict) -> list:
    return _project_unknown("gcloud dataproc clusters list (not in fetch plan).")


# =========================================================================
# MESSAGING
# =========================================================================

@register("pubsub_topic_kms_encryption_enabled")  # MSG-01
def pubsub_kms(services: dict) -> list:
    details = _data(services, "pubsub_topics_detailed")
    if details:
        out = []
        for t in details:
            name = t.get("name", "?")
            kms = t.get("kmsKeyName")
            ok = bool(kms)
            out.append({"resource": name,
                        "status": "PASS" if ok else "FAIL",
                        "evidence": f"kmsKeyName={kms}." if ok else "Default Google-managed encryption only (no CMEK)."})
        return out
    topics = _data(services, "pubsub_topics")
    if not topics:
        return []
    # topics list returns only name+labels; kmsKeyName needs describe.
    return [_unknown(_name(t.get("name", "?")), "pubsub topics describe (kmsKeyName).") for t in topics]


@register("pubsub_topic_restricted_iam_principals")  # MSG-02
def pubsub_iam(services: dict) -> list:
    details = _data(services, "pubsub_topics_detailed")
    if details:
        out = []
        for t in details:
            name = t.get("name", "?")
            policy = t.get("iamPolicy") or {}
            bindings = policy.get("bindings") or []
            public = any(m in ("allUsers", "allAuthenticatedUsers") for b in bindings for m in b.get("members", []))
            out.append({"resource": name,
                        "status": "FAIL" if public else "PASS",
                        "evidence": "Public IAM access detected (allUsers/allAuthenticatedUsers)." if public else "IAM access restricted to authorized principals."})
        return out
    topics = _data(services, "pubsub_topics")
    if not topics:
        return []
    return [_unknown(_name(t.get("name", "?")), "pubsub topics get-iam-policy (allUsers).") for t in topics]


@register("pubsub_subscription_dead_letter_policy")  # MSG-03
@register("pubsub_subscription_dead_letter_configured")  # MSG-04
def pubsub_dlq(services: dict) -> list:
    subs = _data(services, "pubsub_subscriptions")
    if not subs:
        return []
    out = []
    for s in subs:
        dlq = bool(s.get("deadLetterPolicy"))
        out.append({"resource": _name(s.get("name", "?")),
                    "status": "PASS" if dlq else "FAIL",
                    "evidence": "Dead-letter policy configured." if dlq
                    else "No dead-letter policy."})
    return out


# =========================================================================
# AI / ML
# =========================================================================

@register("vertex_ai_dataset_cmk_encryption")  # AIML-01
@register("vertex_ai_endpoint_private_service_connect")  # AIML-02
@register("vertex_ai_notebook_no_external_ip")  # AIML-03
def vertex(services: dict) -> list:
    return _project_unknown("Vertex AI datasets/endpoints/notebooks (not in fetch plan).")


# =========================================================================
# SEARCH
# =========================================================================

@register("elasticsearch_instance_encryption_enabled")  # SRCH-01
@register("elasticsearch_instance_private_service_access")  # SRCH-02
@register("elasticsearch_instance_audit_logs_enabled")  # SRCH-03
def elasticsearch(services: dict) -> list:
    return _project_unknown("Elasticsearch/managed-search service (not a native GCP fetch).")


# =========================================================================
# CERTIFICATES
# =========================================================================

@register("certificate_manager_certificates_validity_check")  # CERT-01
@register("certificate_manager_strong_cryptographic_algorithms")  # CERT-02
def cert_manager(services: dict) -> list:
    certs = _data(services, "certificate_manager") + _data(services, "ssl_certificates")
    if not certs:
        return []  # no managed certificates -> NOT_APPLICABLE
    return [_unknown(c.get("name", "?"), "certificate describe (expiry + algorithm).") for c in certs]


# =========================================================================
# RESILIENCE / BACKUP / OPS
# =========================================================================

@register("backup_plan_cross_region_copy")  # RES-02
def backup_cross_region(services: dict) -> list:
    return _project_unknown("Backup & DR / snapshot schedule cross-region config.")


@register("compute_disk_resource_policy_daily_backup")  # OPS-02
def disk_backup_policy(services: dict) -> list:
    disks = _data(services, "compute_disks")
    if not disks:
        return []
    out = []
    for d in disks:
        has = bool(d.get("resourcePolicies"))
        out.append({"resource": d.get("name", "?"),
                    "status": "PASS" if has else "FAIL",
                    "evidence": "Snapshot schedule resource policy attached." if has
                    else "No snapshot schedule policy."})
    return out


@register("orgpolicy_resource_labels_enforced")  # OPS-01
def orgpolicy_labels(services: dict) -> list:
    pols = _data(services, "org_policies")
    label_pol = [p for p in pols if "label" in str(p.get("name", "")).lower()
                 or "label" in str(p.get("constraint", "")).lower()]
    if label_pol:
        return [{"resource": "org-policies", "status": "PASS",
                 "evidence": "Resource-label org policy enforced."}]
    return [{"resource": "org-policies", "status": "FAIL",
             "evidence": "No required-resource-label org policy."}]


@register("deployment_manager_audit_logging_enabled")  # OPS-03
def deployment_manager(services: dict) -> list:
    return _project_unknown("Deployment Manager / IaC audit logging config.")


# =========================================================================
# PERFORMANCE
# =========================================================================

@register("compute_disk_hyperdisk_or_pd_extreme")  # PERF-01
def disk_perf_type(services: dict) -> list:
    disks = _data(services, "compute_disks")
    if not disks:
        return []
    out = []
    for d in disks:
        t = _name(d.get("type", ""))
        fast = any(x in t for x in ("hyperdisk", "pd-extreme", "pd-ssd"))
        out.append({"resource": d.get("name", "?"),
                    "status": "PASS" if fast else "FAIL",
                    "evidence": f"disk type={t}."})
    return out


@register("compute_instance_group_regional_distribution")  # PERF-02
def mig_regional(services: dict) -> list:
    migs = _data(services, "instance_groups_managed")
    if not migs:
        return []  # no managed instance groups -> NOT_APPLICABLE
    out = []
    for m in migs:
        regional = "/regions/" in str(m.get("region") or m.get("selfLink") or "")
        out.append({"resource": m.get("name", "?"),
                    "status": "PASS" if regional else "FAIL",
                    "evidence": "Regional (multi-zone) MIG." if regional else "Zonal MIG (single zone)."})
    return out


@register("compute_instance_group_autohealing_policy_active")  # RES-04
def mig_autoheal(services: dict) -> list:
    migs = _data(services, "instance_groups_managed")
    if not migs:
        return []
    out = []
    for m in migs:
        heal = bool(m.get("autoHealingPolicies"))
        out.append({"resource": m.get("name", "?"),
                    "status": "PASS" if heal else "FAIL",
                    "evidence": f"autoHealingPolicies={'set' if heal else 'none'}."})
    return out


# =========================================================================
# CI/CD
# =========================================================================

@register("cloudbuild_trigger_secrets_manager_configured")  # CICD-01
def cloudbuild_triggers(services: dict) -> list:
    triggers = _data(services, "build_triggers")
    if not triggers:
        return []  # no build triggers -> NOT_APPLICABLE
    return [_unknown(t.get("name", "?"), "trigger describe (availableSecrets / secretManager).")
            for t in triggers]


@register("source_repository_iam_commit_access_restricted")  # CICD-02
def source_repo_iam(services: dict) -> list:
    repos = services.get("source_repos")
    if repos and repos.get("ok") and not _data(services, "source_repos"):
        return []  # fetched, none -> NOT_APPLICABLE
    return _project_unknown("Cloud Source Repositories list + IAM (API access).")
