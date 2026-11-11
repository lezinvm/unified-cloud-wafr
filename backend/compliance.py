"""
Compliance scoring from real scan verdicts.

Frameworks in scope: CIS (per cloud), SOC 2, ISO/IEC 27001:2022, HIPAA Security Rule.
Mappings come from backend/seed_data/control_catalog.csv; one control can satisfy
requirements in several frameworks, so every check runs once and is reused here.

Hierarchy:  framework -> requirement (framework id, e.g. CC6.1) -> catalog controls
            -> per-cloud checks -> resources

Requirement status (from the verdicts of its mapped controls in ONE assessment):
    fail            any mapped control FAILED
    pass            no failure, >=1 control passed, none left unassessed
    not_assessed    no failure, but >=1 control is UNKNOWN / NOT_IMPLEMENTED
                    (the scan could not decide it; never counted as passed)
    not_applicable  every mapped control is NOT_APPLICABLE (no such resources)

Framework score = pass / (pass + fail) * 100, shown together with coverage =
(pass + fail) / (requirements that apply), so a high score can never hide
requirements that weren't checked.

Not covered here (needs manual attestation, parked by decision): policies,
procedures, training and other non-technical requirements of SOC 2, ISO and HIPAA.
"""
from __future__ import annotations

import re
from collections import defaultdict

# ISO/IEC 27001:2013 Annex A ids found in the catalog -> 27001:2022 equivalents
# (ISO/IEC 27002:2022 Annex B correspondence). 2022 removed the A.6/A.9 clauses.
ISO_2013_TO_2022 = {
    "A.6.1.3": "A.5.5",    # Contact with authorities
    "A.8.1": "A.5.9",      # Inventory of assets (catalog uses it for asset hygiene)
    "A.9.1.1": "A.5.15",   # Access control
    "A.9.2.1": "A.5.16",   # Identity management
    "A.9.2.3": "A.8.2",    # Privileged access rights
    "A.9.2.6": "A.5.18",   # Access rights (removal/adjustment)
    "A.9.4.1": "A.8.3",    # Information access restriction
    "A.9.4.2": "A.8.5",    # Secure authentication
    "A.9.4.3": "A.5.17",   # Authentication information
}

FRAMEWORKS = [
    {
        "id": "cis", "short": "CIS", "column": None,  # per cloud: cis_<provider>
        "name": "CIS Foundations Benchmark",
        "mapping_note": ("Benchmark section numbers come from the control catalog and have not been "
                         "validated against the official CIS benchmark text."),
    },
    {"id": "soc2", "short": "SOC 2", "column": "soc2_ids",
     "name": "SOC 2 (Trust Services Criteria)", "version": "2017 TSC", "mapping_note": None},
    {"id": "iso27001", "short": "ISO 27001", "column": "iso27001_ids",
     "name": "ISO/IEC 27001", "version": "2022 Annex A",
     "mapping_note": "Catalog ids from the 2013 edition are converted to their 2022 equivalents."},
    {"id": "hipaa", "short": "HIPAA", "column": "hipaa_ids",
     "name": "HIPAA Security Rule", "version": "45 CFR 164 Subpart C", "mapping_note": None},
]

STATUS_ORDER = {"fail": 0, "not_assessed": 1, "pass": 2, "not_applicable": 3}
_CIS_RE = re.compile(r"^\s*([\d.]+)\s*(?:\((v[\d.]+)\s*(L\d)?\))?\s*$")


def _ids(cell: str) -> list[str]:
    return [x.strip() for x in (cell or "").split(";") if x.strip()]


def _requirement_ids(fw: dict, provider: str, ctrl: dict) -> list[dict]:
    """Requirement refs for one control: [{id, version?, level?, source_id?}]."""
    if fw["id"] == "cis":
        out = []
        for raw in _ids(ctrl.get(f"cis_{provider}", "")):
            m = _CIS_RE.match(raw)
            out.append({"id": m.group(1), "version": m.group(2), "level": m.group(3)} if m else {"id": raw})
        return out
    refs = []
    for raw in _ids(ctrl.get(fw["column"], "")):
        if fw["id"] == "iso27001" and raw in ISO_2013_TO_2022:
            refs.append({"id": ISO_2013_TO_2022[raw], "source_id": raw})
        else:
            refs.append({"id": raw})
    return refs


def _sort_key(req_id: str):
    return [int(p) if p.isdigit() else p for p in re.split(r"[^0-9A-Za-z]+", req_id) if p]


def requirement_status(verdicts: list[str]) -> str:
    v = set(verdicts)
    if "FAIL" in v:
        return "fail"
    if v & {"UNKNOWN", "NOT_IMPLEMENTED"}:
        return "not_assessed"
    if "PASS" in v:
        return "pass"
    return "not_applicable"


def score_framework(fw: dict, provider: str, provider_label: str, controls: list[dict]) -> dict:
    """controls: [{control_id, title, severity, verdict, failing_resources, <framework cols>}]"""
    reqs: dict[str, dict] = {}
    for c in controls:
        for ref in _requirement_ids(fw, provider, c):
            r = reqs.setdefault(ref["id"], {"id": ref["id"], "controls": [], "source_ids": set(),
                                             "levels": set(), "versions": set()})
            if ref.get("source_id"):
                r["source_ids"].add(ref["source_id"])
            if ref.get("level"):
                r["levels"].add(ref["level"])
            if ref.get("version"):
                r["versions"].add(ref["version"])
            r["controls"].append({
                "control_id": c["control_id"], "title": c["title"], "severity": c["severity"],
                "verdict": c["verdict"], "failing_resources": c["failing_resources"],
            })

    counts = defaultdict(int)
    requirements = []
    for r in reqs.values():
        status = requirement_status([c["verdict"] for c in r["controls"]])
        counts[status] += 1
        requirements.append({
            "id": r["id"], "status": status,
            "level": "/".join(sorted(r["levels"])) or None,
            "converted_from": sorted(r["source_ids"]) or None,
            "controls": sorted(r["controls"], key=lambda c: c["control_id"]),
        })
    requirements.sort(key=lambda r: (STATUS_ORDER[r["status"]], _sort_key(r["id"])))

    decided = counts["pass"] + counts["fail"]
    applicable = decided + counts["not_assessed"]
    # Secondary view: distinct mapped controls that pass (a requirement fails on
    # any one failure, so this shows progress inside failing requirements).
    distinct = {c["control_id"]: c["verdict"] for r in reqs.values() for c in r["controls"]}
    c_pass = sum(1 for v in distinct.values() if v == "PASS")
    c_fail = sum(1 for v in distinct.values() if v == "FAIL")
    versions = sorted({v for r in reqs.values() for v in r["versions"]})
    name = fw["name"] if fw["id"] != "cis" else f"CIS {provider_label} Foundations Benchmark"
    return {
        "framework_id": fw["id"], "short_name": fw["short"], "name": name,
        "version": fw.get("version") or (", ".join(versions) if versions else None),
        "mapping_note": fw["mapping_note"],
        "score": round(counts["pass"] / decided * 100) if decided else None,
        "coverage": round(decided / applicable * 100) if applicable else None,
        "total_requirements": len(requirements),
        "passed": counts["pass"], "failed": counts["fail"],
        "not_assessed": counts["not_assessed"], "not_applicable": counts["not_applicable"],
        "controls_passed": c_pass, "controls_failed": c_fail,
        "controls_unassessed": sum(1 for v in distinct.values() if v in ("UNKNOWN", "NOT_IMPLEMENTED")),
        "controls_total": len(distinct),
        "control_pass_rate": round(c_pass / (c_pass + c_fail) * 100) if (c_pass + c_fail) else None,
        "requirements": requirements,
    }


def build_scores(provider: str, provider_label: str, assessment_id: str, controls: list[dict],
                 generated_at: str) -> list[dict]:
    """One document per framework for an assessment (stored in assessment_compliance_scores)."""
    out = []
    for fw in FRAMEWORKS:
        s = score_framework(fw, provider, provider_label, controls)
        if s["total_requirements"] == 0:
            continue
        s.update({"id": f"CS-{assessment_id}-{fw['id']}", "assessment_id": assessment_id,
                  "cloud": provider, "source": "live-scan", "generated_at": generated_at})
        out.append(s)
    return out
