"""
Generate a multi-tab Excel workbook from the control catalog.

Produces compliance_frameworks.xlsx with 4 tabs (CIS, SOC 2, HIPAA, ISO 27001).
Each tab lists, one row per control mapped to that framework:
  Control ID | Question | Best Practice | AWS Checks | Azure Checks | GCP Checks | Framework Reference | Severity | Pillar | Domain

Reads backend/seed_data/control_catalog.csv.
Run:  python make_compliance_sheet.py
Requires openpyxl (already in requirements.txt).
"""
import csv
import os
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment

BASE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(BASE, "seed_data", "control_catalog.csv")
OUT_PATH = os.path.join(BASE, "compliance_frameworks.xlsx")

# Each framework tab: (sheet name, which catalog column(s) hold its control ref)
FRAMEWORKS = [
    ("CIS", ["cis_aws", "cis_azure", "cis_gcp"]),
    ("SOC 2", ["soc2_ids"]),
    ("HIPAA", ["hipaa_ids"]),
    ("ISO 27001", ["iso27001_ids"]),
]

HEADERS = [
    "Control ID", "Question", "Best Practice (Description)",
    "AWS Checks", "Azure Checks", "GCP Checks",
    "Framework Reference", "Severity", "Pillar", "Domain",
]


def to_question(title: str) -> str:
    t = (title or "").strip()
    if not t:
        return ""
    return f"Is the control '{t}' satisfied?"


def ref_for(row: dict, columns: list) -> str:
    parts = []
    for col in columns:
        val = (row.get(col) or "").strip()
        if val:
            label = col.replace("cis_", "").upper() if col.startswith("cis_") else ""
            parts.append(f"{label}: {val}" if label else val)
    return " | ".join(parts)


def load_rows():
    with open(CSV_PATH, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def build():
    rows = load_rows()
    wb = Workbook()
    wb.remove(wb.active)

    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F4E78")
    wrap = Alignment(vertical="top", wrap_text=True)

    for sheet_name, columns in FRAMEWORKS:
        ws = wb.create_sheet(title=sheet_name)
        ws.append(HEADERS)
        for col_idx in range(1, len(HEADERS) + 1):
            c = ws.cell(row=1, column=col_idx)
            c.font = header_font
            c.fill = header_fill
            c.alignment = Alignment(vertical="center")

        count = 0
        for row in rows:
            ref = ref_for(row, columns)
            if not ref:
                continue
            ws.append([
                row.get("control_id", "").strip(),
                to_question(row.get("title", "")),
                row.get("description", "").strip(),
                (row.get("aws_checks") or "").replace(";", "\n"),
                (row.get("azure_checks") or "").replace(";", "\n"),
                (row.get("gcp_checks") or "").replace(";", "\n"),
                ref,
                row.get("severity", "").strip(),
                row.get("pillar", "").strip(),
                row.get("domain_name", "").strip(),
            ])
            count += 1

        widths = [12, 38, 50, 30, 30, 30, 24, 10, 18, 28]
        for i, w in enumerate(widths, start=1):
            ws.column_dimensions[ws.cell(row=1, column=i).column_letter].width = w
        for r in ws.iter_rows(min_row=2):
            for cell in r:
                cell.alignment = wrap
        ws.freeze_panes = "A2"
        print(f"[OK] {sheet_name}: {count} controls")

    wb.save(OUT_PATH)
    print(f"[DONE] Wrote {OUT_PATH}")


if __name__ == "__main__":
    build()
