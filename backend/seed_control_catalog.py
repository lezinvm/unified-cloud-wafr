"""
Loader for the unified control catalog (compliance + WAFR).

Reads backend/seed_data/control_catalog.csv and loads it into the MongoDB
`control_catalog` collection. Each CSV row is one control. This is reference
data (a catalog), not per-tenant data — it is the single source of truth that
both WAFR and the compliance frameworks (CIS, SOC 2, HIPAA, ISO 27001) are
derived from.

Per-cloud check lists and framework id lists are stored as arrays so the
scoring engine can query them directly. A control "belongs to" a framework
when its list for that framework is non-empty.

Run standalone:  python seed_control_catalog.py
Or import and call seed_control_catalog(db) from the master seed.
"""
import csv
import os

CSV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed_data", "control_catalog.csv")


def _split(value: str):
    """Split a ';'-separated cell into a clean list; empty cell -> []."""
    if not value:
        return []
    return [part.strip() for part in value.split(";") if part.strip()]


def parse_catalog_rows(csv_path: str = CSV_PATH):
    """Parse the CSV into a list of normalized control documents."""
    controls = []
    with open(csv_path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        for row in reader:
            control_id = (row.get("control_id") or "").strip()
            if not control_id:
                continue

            # Per-framework id lists (a control is "in" a framework iff non-empty)
            cis = {
                "aws": _split(row.get("cis_aws")),
                "azure": _split(row.get("cis_azure")),
                "gcp": _split(row.get("cis_gcp")),
            }
            soc2 = _split(row.get("soc2_ids"))
            iso = _split(row.get("iso27001_ids"))
            hipaa = _split(row.get("hipaa_ids"))
            wafr = _split(row.get("well_architected_ids"))

            # Which frameworks this control participates in (derived)
            frameworks = []
            if wafr:
                frameworks.append("wafr")
            if cis["aws"] or cis["azure"] or cis["gcp"]:
                frameworks.append("cis")
            if soc2:
                frameworks.append("soc2")
            if iso:
                frameworks.append("iso27001")
            if hipaa:
                frameworks.append("hipaa")

            controls.append({
                "control_id": control_id,
                "domain_id": (row.get("domain_id") or "").strip(),
                "domain_name": (row.get("domain_name") or "").strip(),
                "pillar": (row.get("pillar") or "").strip(),
                "title": (row.get("title") or "").strip(),
                "description": (row.get("description") or "").strip(),
                "severity": (row.get("severity") or "").strip().lower(),
                "evaluation_mode": (row.get("evaluation_mode") or "").strip().lower(),
                "resource_type": (row.get("resource_type") or "").strip(),
                # Per-cloud check references (the deterministic checks that verify this control)
                "checks": {
                    "aws": _split(row.get("aws_checks")),
                    "azure": _split(row.get("azure_checks")),
                    "gcp": _split(row.get("gcp_checks")),
                },
                # Framework mappings
                "frameworks": frameworks,
                "well_architected_ids": wafr,
                "cis": cis,
                "soc2_ids": soc2,
                "iso27001_ids": iso,
                "hipaa_ids": hipaa,
            })
    return controls


def seed_control_catalog(db):
    """Load the catalog into db['control_catalog'] (drop + insert)."""
    controls = parse_catalog_rows()
    db["control_catalog"].drop()
    if controls:
        db["control_catalog"].insert_many([dict(c) for c in controls])

    # Quick derived counts for the console summary
    def count_in(fw):
        return sum(1 for c in controls if fw in c["frameworks"])

    print(f"[OK] Loaded {len(controls)} controls into 'control_catalog'.")
    print(f"      WAFR:  {count_in('wafr')}")
    print(f"      CIS:   {count_in('cis')}")
    print(f"      SOC 2: {count_in('soc2')}")
    print(f"      ISO:   {count_in('iso27001')}")
    print(f"      HIPAA: {count_in('hipaa')}")
    return controls


if __name__ == "__main__":
    from pymongo import MongoClient

    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DB_NAME", "wafr_db")
    print(f"Connecting to MongoDB at {mongo_uri} [db: {db_name}]...")
    client = MongoClient(mongo_uri)
    seed_control_catalog(client[db_name])
    print("[DONE] Control catalog seed complete.")
