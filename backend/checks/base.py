"""
Shared check-engine framework — cloud-agnostic.

This module defines the pieces every provider (GCP, AWS, Azure) reuses so that
adding a new cloud means writing ONE checks file in the same format, with no
changes to the engine.

Core concepts
-------------
Provider
    A named registry of checks for one cloud. Create one per cloud module:

        from .base import Provider
        gcp = Provider("gcp", catalog_column="gcp_checks", scope_label="project")

    then register checks against it:

        @gcp.check("compute_firewall_allow_ingress_from_internet_to_ssh_rdp")
        def fw_ssh_rdp(resources):
            ...

Check function
    Receives the fetched resource map for ONE scope (a GCP project / an AWS
    account+region / an Azure subscription) and returns a list of
    ResourceResult dicts:

        { "resource": <str>, "status": "PASS"|"FAIL"|"UNKNOWN", "evidence": <str> }

Verdict rollup (done by the engine, identical for every cloud):
    any FAIL            -> FAIL
    >=1 PASS, no FAIL   -> PASS
    only UNKNOWN        -> UNKNOWN          (resources exist, extra data needed)
    [] (no resources)   -> NOT_APPLICABLE
    token not registered-> NOT_IMPLEMENTED

Honesty rule
    Never return PASS unless the fetched data proves the control. If the needed
    field/service isn't in the fetch, return UNKNOWN via `unknown(...)` with a
    note describing exactly what data is required.
"""
from __future__ import annotations

from typing import Callable

# A check takes the per-scope resource map and returns a list of result dicts.
CheckFn = Callable[[dict], list]

# provider name -> Provider instance (filled as provider modules import).
PROVIDERS: dict[str, "Provider"] = {}


class Provider:
    """A per-cloud registry of checks plus its catalog metadata."""

    def __init__(self, name: str, catalog_column: str, scope_label: str = "scope"):
        #: short cloud id, e.g. "gcp" / "aws" / "azure"
        self.name = name
        #: which control_catalog.csv column holds this cloud's check tokens,
        #: e.g. "gcp_checks" / "aws_checks" / "azure_checks"
        self.catalog_column = catalog_column
        #: label for one assessed unit, e.g. "project" / "account" / "subscription"
        self.scope_label = scope_label
        #: token -> check function
        self.registry: dict[str, CheckFn] = {}
        PROVIDERS[name] = self

    def check(self, *tokens: str):
        """Decorator: register a function for one or more catalog tokens."""
        def deco(fn: CheckFn):
            for t in tokens:
                self.registry[t] = fn
            return fn
        return deco

    def get(self, token: str) -> CheckFn | None:
        return self.registry.get(token)

    def __contains__(self, token: str) -> bool:
        return token in self.registry


def get_provider(name: str) -> Provider:
    """Import the provider module on demand and return its Provider."""
    if name not in PROVIDERS:
        # Import the matching module so its @provider.check decorators run.
        try:
            __import__(f"backend.checks.{name}_checks")
        except ModuleNotFoundError:
            __import__(f"checks.{name}_checks")
    if name not in PROVIDERS:
        raise ValueError(f"Unknown provider '{name}'. Available: {sorted(PROVIDERS)}")
    return PROVIDERS[name]


# ---- generic result helpers (shared by every provider's checks) ----------

def resource_list(resources: dict, key: str) -> list:
    """Return the resource list stored under `key`, or [] if absent/blocked.

    Works with the fetch shape { key: {ok, count, data: [...]} }.
    """
    svc = resources.get(key)
    if not svc or not svc.get("ok"):
        return []
    data = svc.get("data")
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        return [data]
    return []


def short_name(url) -> str:
    """Trim a long selfLink/ARN/resource-id down to its trailing name."""
    return url.rsplit("/", 1)[-1] if isinstance(url, str) else str(url)


def passed(resource: str, evidence: str) -> dict:
    return {"resource": resource, "status": "PASS", "evidence": evidence}


def failed(resource: str, evidence: str) -> dict:
    return {"resource": resource, "status": "FAIL", "evidence": evidence}


def unknown(resource: str, need: str) -> dict:
    """Resource exists but the data needed to judge it wasn't fetched."""
    return {"resource": resource, "status": "UNKNOWN", "evidence": f"Needs: {need}"}


def scope_unknown(need: str) -> list:
    """A single scope-level UNKNOWN (service not fetched at all)."""
    return [unknown("(scope)", need)]


def evaluate(resources: dict, key: str, name_field: str, predicate,
             pass_msg: str, fail_msg: str) -> list:
    """Generic one-result-per-item PASS/FAIL evaluator over a resource list."""
    out = []
    for item in resource_list(resources, key):
        rid = short_name(item.get(name_field, "?"))
        ok = predicate(item)
        out.append(passed(rid, pass_msg) if ok else failed(rid, fail_msg))
    return out


# ---- verdict rollup (identical across clouds) ----------------------------

def rollup(resource_results: list[dict]) -> str:
    if not resource_results:
        return "NOT_APPLICABLE"
    statuses = {r["status"] for r in resource_results}
    if "FAIL" in statuses:
        return "FAIL"
    if "PASS" in statuses:
        return "PASS"
    if statuses == {"UNKNOWN"}:
        return "UNKNOWN"
    return "PASS"
