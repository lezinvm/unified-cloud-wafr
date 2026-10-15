import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn

def create_element(name):
    return OxmlElement(name)

def set_cell_background(cell, fill_hex):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=120, bottom=120, left=150, right=150):
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {nsdecls("w")}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def set_cell_borders(cell, top="none", bottom="none", left="none", right="none", 
                     color="CCCCCC", sz="4"):
    tcPr = cell._tc.get_or_add_tcPr()
    borders = parse_xml(f'''
        <w:tcBorders {nsdecls("w")}>
            <w:top w:val="{top}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:left w:val="{left}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:bottom w:val="{bottom}" w:sz="{sz}" w:space="0" w:color="{color}"/>
            <w:right w:val="{right}" w:sz="{sz}" w:space="0" w:color="{color}"/>
        </w:tcBorders>
    ''')
    tcPr.append(borders)

def add_callout(doc, title, text, bg_hex="F0FDF4", border_color="059669"):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_background(cell, bg_hex)
    set_cell_margins(cell, top=140, bottom=140, left=200, right=200)
    set_cell_borders(cell, left="single", color=border_color, sz="24")
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(4)
    run_t = p.add_run(f"✦  {title}")
    run_t.font.name = "Segoe UI"
    run_t.font.size = Pt(10.5)
    run_t.font.bold = True
    run_t.font.color.rgb = RGBColor.from_string(border_color)
    
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_before = Pt(0)
    p2.paragraph_format.space_after = Pt(2)
    run_b = p2.add_run(text)
    run_b.font.name = "Segoe UI"
    run_b.font.size = Pt(9.5)
    run_b.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def add_code_block(doc, code_text):
    tbl = doc.add_table(rows=1, cols=1)
    tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl.autofit = False
    tbl.columns[0].width = Inches(6.5)
    
    cell = tbl.cell(0, 0)
    set_cell_background(cell, "0F172A")
    set_cell_margins(cell, top=140, bottom=140, left=180, right=180)
    set_cell_borders(cell, left="none", right="none", top="none", bottom="none")
    
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    run = p.add_run(code_text)
    run.font.name = "Consolas"
    run.font.size = Pt(8.5)
    run.font.color.rgb = RGBColor(0xF8, 0xFA, 0xFC)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(4)

def build_document():
    doc = docx.Document()
    
    # Page setup - 0.8 inch margins
    sections = doc.sections
    for section in sections:
        section.top_margin = Inches(0.8)
        section.bottom_margin = Inches(0.8)
        section.left_margin = Inches(0.8)
        section.right_margin = Inches(0.8)
        
        # Header / Footer
        footer = section.footer
        f_p = footer.paragraphs[0]
        f_p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        f_run = f_p.add_run("CloudifyOps Unified Cloud WAFR · Confidential Product Documentation")
        f_run.font.name = "Segoe UI"
        f_run.font.size = Pt(8)
        f_run.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)
    
    # ── COVER / HEADER BLOCK ──
    p_org = doc.add_paragraph()
    p_org.paragraph_format.space_before = Pt(10)
    p_org.paragraph_format.space_after = Pt(2)
    r_org = p_org.add_run("CLOUDIFYOPS TECHNOLOGIES")
    r_org.font.name = "Segoe UI"
    r_org.font.size = Pt(11)
    r_org.font.bold = True
    r_org.font.color.rgb = RGBColor(0x25, 0x63, 0xEB)
    
    p_title = doc.add_paragraph()
    p_title.paragraph_format.space_before = Pt(2)
    p_title.paragraph_format.space_after = Pt(6)
    r_title = p_title.add_run("Unified Cloud WAFR Platform")
    r_title.font.name = "Segoe UI"
    r_title.font.size = Pt(24)
    r_title.font.bold = True
    r_title.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    
    p_sub = doc.add_paragraph()
    p_sub.paragraph_format.space_before = Pt(0)
    p_sub.paragraph_format.space_after = Pt(14)
    r_sub = p_sub.add_run("Enterprise Product Documentation, Architecture Specification & Security Whitepaper")
    r_sub.font.name = "Segoe UI"
    r_sub.font.size = Pt(12)
    r_sub.font.color.rgb = RGBColor(0x64, 0x74, 0x8B)
    
    # Meta Box
    tbl_meta = doc.add_table(rows=2, cols=2)
    tbl_meta.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_meta.columns[0].width = Inches(3.25)
    tbl_meta.columns[1].width = Inches(3.25)
    
    meta_info = [
        [("Document Classification:", " Confidential · Enterprise Brief"), ("Multi-Cloud Scope:", " AWS · Azure · Google Cloud (GCP)")],
        [("Target Stakeholders:", " CIO, CISO, Cloud Architects, SecOps"), ("Platform Version:", " Release v2.4 (Enterprise Edition)")]
    ]
    
    for r_idx, row in enumerate(meta_info):
        for c_idx, (label, val) in enumerate(row):
            c = tbl_meta.cell(r_idx, c_idx)
            set_cell_background(c, "F8FAFC")
            set_cell_margins(c, top=80, bottom=80, left=120, right=120)
            set_cell_borders(c, "single", "single", "single", "single", "E2E8F0", "4")
            p = c.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            rl = p.add_run(label)
            rl.font.name = "Segoe UI"
            rl.font.size = Pt(8.5)
            rl.font.bold = True
            rl.font.color.rgb = RGBColor(0x47, 0x55, 0x69)
            rv = p.add_run(val)
            rv.font.name = "Segoe UI"
            rv.font.size = Pt(8.5)
            rv.font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
    
    doc.add_paragraph().paragraph_format.space_after = Pt(8)
    
    # ── SECTION 1: EXECUTIVE SUMMARY ──
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("1. Executive Summary & Strategic Value Proposition")
    r.font.name = "Segoe UI"
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(6)
    p.paragraph_format.line_spacing = 1.15
    p.add_run(
        "The CloudifyOps Unified Cloud WAFR (Well-Architected Framework Review) Platform is an enterprise-grade "
        "cloud governance, automated architectural evaluation, and remediation orchestration platform. It is engineered "
        "to eliminate the gap between high-level architectural governance and engineering execution across "
        "Amazon Web Services (AWS), Microsoft Azure, and Google Cloud Platform (GCP)."
    ).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    p.paragraph_format.line_spacing = 1.15
    p.add_run(
        "Traditionally, Well-Architected Framework Reviews were manual, labor-intensive, and subjective consulting engagements "
        "requiring weeks of interviews, resulting in static spreadsheets or 100-page PDF reports that quickly gathered dust. "
        "CloudifyOps Unified Cloud WAFR transforms this paradigm into a continuous, data-driven, and AI-accelerated standard."
    ).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    # Stakeholder Table
    doc.add_heading("Stakeholder Value Matrix", level=2).paragraph_format.space_after = Pt(4)
    tbl_stake = doc.add_table(rows=5, cols=3)
    tbl_stake.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_stake.columns[0].width = Inches(1.8)
    tbl_stake.columns[1].width = Inches(2.3)
    tbl_stake.columns[2].width = Inches(2.4)
    
    headers = ["Stakeholder Role", "Industry Pain Points & Challenges", "Unified Cloud WAFR Solution & Value"]
    for i, h in enumerate(headers):
        cell = tbl_stake.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.name = "Segoe UI"
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        
    stake_data = [
        ("C-Level Leadership\n(CIO / CISO / CTO)",
         "• Multi-cloud blind spots\n• High audit fatigue\n• Compliance breach liability",
         "• Real-time Executive Multi-Cloud Scorecards\n• Milestone risk burndown tracking over time\n• Auditable mapping to CIS, SOC 2, HIPAA, ISO"),
        ("Finance & FinOps\nLeaders",
         "• Uncontrolled cloud spend\n• Orphaned compute/storage\n• Low RI / Savings Plan coverage",
         "• Automated waste sweeper (idle IPs, disks)\n• Commitment arbitrage to hit >70% coverage\n• Direct ROI: dollar-for-dollar monthly savings"),
        ("Cloud Architects &\nEngineering Leads",
         "• Subjective, manual reviews\n• Lack of topology dependency view\n• Undetected architectural drift",
         "• Automated scanner: 270+ telemetry checks\n• Interactive topology diagram with live alerts\n• Dual-scope: org policies + workload reality"),
        ("DevOps & SecOps\nEngineers",
         "• Report fatigue (zero code guidance)\n• Tedious manual Terraform writing\n• Fear of breaking production",
         "• 1-Click AI Fix: production-grade Terraform (.tf)\n• Affected resource ARNs with blast radius\n• Verified console playbooks with rollbacks")
    ]
    
    for row_idx, row in enumerate(stake_data, start=1):
        bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(row):
            cell = tbl_stake.cell(row_idx, col_idx)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            set_cell_borders(cell, "single", "single", "single", "single", "E2E8F0", "4")
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Segoe UI"
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
            if col_idx == 0:
                r.font.bold = True
                
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # ── SECTION 2: 5 CORE PILLARS ──
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("2. The Five Foundational Well-Architected Pillars")
    r.font.name = "Segoe UI"
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    p.add_run(
        "The platform natively evaluates cloud environments across the five foundational pillars established by "
        "leading hyperscaler frameworks (AWS Well-Architected Tool, Azure WAF, and GCP Architecture Framework):"
    ).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    pillars = [
        ("1. Reliability (R)", "0078D4", 
         "Ensures workloads perform intended functions consistently and recover gracefully from outages.",
         [
             "Multi-AZ standby automated failover for RDS, Aurora, and Azure SQL databases.",
             "Application Load Balancer cross-zone routing and aggressive health check configurations.",
             "Asynchronous Dead Letter Queues (SQS DLQ) preventing cascading poison-pill stalls.",
             "Validated Disaster Recovery objectives (RTO < 1h, RPO < 15m) with cross-region replication."
         ]),
        ("2. Security (S)", "E11D48",
         "Protects data, identities, and cloud perimeters through defense-in-depth and least privilege.",
         [
             "IAM least-privilege enforcement: flags wildcard resource and action grants (Action: *).",
             "Zero open public ingress: flags 0.0.0.0/0 on sensitive ports (SSH 22, RDP 3389).",
             "Ubiquitous encryption: AWS KMS Customer Managed Keys (CMK) with annual rotation.",
             "Centralized multi-region VPC Flow Logs, AWS WAF rules, and GuardDuty threat analytics."
         ]),
        ("3. Cost Optimization (C)", "059669",
         "Eliminates wasteful cloud expenditures while maximizing business output per dollar spent.",
         [
             "Automated waste sweeper: flags detached EBS volumes ($342+/mo) and idle Elastic IPs.",
             "Snapshot lifecycle governance: automated purging of obsolete snapshots older than 90 days.",
             "Commitment portfolio arbitrage: tunes Compute Savings Plans & RIs to achieve >70% coverage.",
             "Workload modernization: evaluates ARM64 Graviton3 instances delivering 25% price-performance gain."
         ]),
        ("4. Operational Excellence (O)", "D97706",
         "Enables safe continuous deployments, complete observability, and automated incident recovery.",
         [
             "100% Infrastructure as Code (IaC) verification to eliminate unversioned console drift.",
             "Blue/Green canary deployment validation on ECS Fargate and EKS clusters.",
             "Standardized structured JSON logging and OpenTelemetry distributed tracing across APIs.",
             "Actionable incident runbooks linked directly to CloudWatch and Azure Monitor alert notifications."
         ]),
        ("5. Performance Efficiency (P)", "2563EB",
         "Maintains optimal compute, networking, and data throughput under fluctuating demand.",
         [
             "Edge caching: CloudFront and Azure Front Door distribution with TLS 1.3 edge termination.",
             "In-memory data tiers: ElastiCache Redis clusters offloading heavy database query traffic.",
             "Database read replicas dedicated to analytics queries to protect primary transactional clusters.",
             "Detached EBS gp3 provisioned IOPS ensuring storage throughput matches workload needs."
         ])
    ]
    
    for title, color_hex, summary, checks in pillars:
        h2 = doc.add_heading(title, level=2)
        h2.paragraph_format.space_before = Pt(8)
        h2.paragraph_format.space_after = Pt(2)
        h2.runs[0].font.color.rgb = RGBColor.from_string(color_hex)
        
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        r_sum = p.add_run(summary)
        r_sum.font.bold = True
        r_sum.font.size = Pt(9.5)
        r_sum.font.color.rgb = RGBColor(0x1E, 0x29, 0x3B)
        
        for chk in checks:
            p_c = doc.add_paragraph(style='List Bullet')
            p_c.paragraph_format.space_before = Pt(0)
            p_c.paragraph_format.space_after = Pt(2)
            r_c = p_c.add_run(chk)
            r_c.font.size = Pt(8.5)
            r_c.font.color.rgb = RGBColor(0x47, 0x55, 0x69)
            
    doc.add_paragraph().paragraph_format.space_after = Pt(10)
    
    # ── SECTION 3: SPECIALIZED LENSES ──
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("3. Modular Architecture Lenses")
    r.font.name = "Segoe UI"
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    p.add_run(
        "Modern cloud estates extend beyond traditional web applications. The platform provides modular specialized "
        "lenses tailored to emerging enterprise technologies:"
    ).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    lenses = [
        ("WAFR Core Lens (Active & Available)", "0EA5E9",
         "Complete Well-Architected Framework Reviews across AWS, Azure, and Google Cloud with 270+ automated telemetry checks, interactive topology mapping, and 1-click Terraform PR generation."),
        ("GenAI & LLM Lens (Specialized Module)", "8B5CF6",
         "Architectural governance for Large Language Models (LLMs) and RAG pipelines: audits prompt injection exposure, vector database latency/scale, token economics, and model safety guardrails."),
        ("Autonomous FinOps Lens (Specialized Module)", "10B981",
         "Cloud unit economics, squad-level cost attribution, automated commitment arbitrage (Reserved Instances vs Savings Plans), and machine-learning spend anomaly alerting.")
    ]
    
    for l_title, l_col, l_desc in lenses:
        add_callout(doc, l_title, l_desc, bg_hex="F8FAFC", border_color=l_col)
        
    # ── SECTION 4: ENTERPRISE SECURITY & DATA ENCRYPTION ──
    doc.add_page_break()
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("4. Enterprise Security, Privacy & Data Encryption")
    r.font.name = "Segoe UI"
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    add_callout(
        doc,
        "ZERO-TRUST & BANK-GRADE SECURITY GUARANTEES",
        "The CloudifyOps Unified Cloud WAFR Platform is engineered with non-invasive read-only least privilege, "
        "zero customer application data storage, hardware-grade cryptography, and strict data retention controls.",
        bg_hex="F0FDF4",
        border_color="059669"
    )
    
    sec_points = [
        ("Zero Customer Application Data Access (Control-Plane Metadata Only)",
         "The platform never inspects, queries, or reads customer application databases, S3 object contents, file systems, "
         "or runtime memory. It interacts exclusively with cloud provider control-plane metadata APIs (e.g., verifying whether "
         "an S3 bucket policy enforces encryption, or if a database snapshot has automated multi-AZ replication). "
         "Zero customer PII, customer payloads, or sensitive records are ever accessed or stored."),
        ("Non-Invasive, Least-Privilege Identity Architecture",
         "Authentication utilizes native cloud cross-account identity mechanisms:\n"
         "• AWS: sts:AssumeRole with mandatory secret ExternalId validation to permanently eliminate the Confused Deputy vulnerability.\n"
         "• Azure: Microsoft Entra ID Service Principal with scoped Reader RBAC permissions.\n"
         "• GCP: Service Account with Viewer role at the organization/project level.\n"
         "All granted policies are strictly constrained to Get*, List*, and Describe* actions. The platform possesses zero technical capability to create, alter, or terminate customer workloads."),
        ("Hardware-Grade Cryptography (In-Transit & At-Rest)",
         "• In-Transit Protection: All network communications—between client browsers, platform backend, and cloud provider APIs—are enforced over TLS 1.3 (with TLS 1.2 fallback) utilizing modern secure cipher suites. Legacy protocols (SSLv3, TLS 1.0/1.1) are permanently disabled.\n"
         "• At-Rest Protection: All stored posture databases, cached findings, and audit snapshots are encrypted with AES-256 using AWS KMS Customer Managed Keys (CMK) with automated annual rotation.\n"
         "• Secrets Isolation: API tokens and credentials reside in dedicated hardware security modules with automated lifecycle rotation."),
        ("Configurable Data Retention, Sovereignty & Automated Purging",
         "Clients maintain complete sovereignty over their data. Via the Settings console, administrators configure custom retention thresholds:\n"
         "• Raw Configuration Snapshots: 7 to 365 days (default: 60 days).\n"
         "• Findings & Reports: 30 to 730 days (default: 365 days).\n"
         "An automated background deletion engine executes daily at 02:00 UTC to permanently shred expired data records.\n"
         "Private Deployment Option: For banking, defense, and healthcare clients, the platform can be deployed as a single-tenant container inside the client's own dedicated AWS VPC or Azure VNet.")
    ]
    
    for s_title, s_desc in sec_points:
        h3 = doc.add_heading(s_title, level=3)
        h3.paragraph_format.space_before = Pt(8)
        h3.paragraph_format.space_after = Pt(2)
        h3.runs[0].font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.add_run(s_desc).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        
    doc.add_heading("Regulatory Compliance Alignment", level=2).paragraph_format.space_after = Pt(4)
    tbl_reg = doc.add_table(rows=5, cols=3)
    tbl_reg.alignment = WD_TABLE_ALIGNMENT.CENTER
    tbl_reg.columns[0].width = Inches(1.8)
    tbl_reg.columns[1].width = Inches(2.6)
    tbl_reg.columns[2].width = Inches(2.1)
    
    reg_headers = ["Compliance Standard", "Scope of Evaluation", "Audit Artifacts Generated"]
    for i, h in enumerate(reg_headers):
        cell = tbl_reg.cell(0, i)
        set_cell_background(cell, "1E3A8A")
        set_cell_margins(cell, top=100, bottom=100, left=120, right=120)
        p = cell.paragraphs[0]
        r = p.add_run(h)
        r.font.name = "Segoe UI"
        r.font.size = Pt(9)
        r.font.bold = True
        r.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
        
    reg_data = [
        ("SOC 2 Type II", "Evaluates Trust Services Criteria for Security, Availability, and Confidentiality across multi-cloud accounts.", "Automated evidence exports, IAM access logs, and encryption verification reports."),
        ("ISO/IEC 27001:2022", "Annex A controls for information security, asset management, and cryptographic boundaries.", "Milestone baseline reports proving continuous security posture governance."),
        ("CIS Benchmarks (L1/L2)", "Multi-cloud foundation benchmark checks across AWS, Azure, and Google Cloud estates.", "Point-by-point compliance scorecard with pass/fail telemetry breakdown."),
        ("HIPAA & PCI-DSS v4.0", "Data encryption at rest/transit, multi-region audit immutability, and network perimeter isolation.", "Technical readiness checklists verifying KMS envelope encryption and zero public access.")
    ]
    
    for row_idx, row in enumerate(reg_data, start=1):
        bg = "F8FAFC" if row_idx % 2 == 1 else "FFFFFF"
        for col_idx, text in enumerate(row):
            cell = tbl_reg.cell(row_idx, col_idx)
            set_cell_background(cell, bg)
            set_cell_margins(cell, top=80, bottom=80, left=100, right=100)
            set_cell_borders(cell, "single", "single", "single", "single", "E2E8F0", "4")
            p = cell.paragraphs[0]
            r = p.add_run(text)
            r.font.name = "Segoe UI"
            r.font.size = Pt(8.5)
            r.font.color.rgb = RGBColor(0x33, 0x41, 0x55)
            if col_idx == 0:
                r.font.bold = True
                
    doc.add_paragraph().paragraph_format.space_after = Pt(12)
    
    # ── SECTION 5: TECHNICAL CAPABILITIES ──
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("5. Technical Architecture & Remediation Engine")
    r.font.name = "Segoe UI"
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    tech_modules = [
        ("1. Dual-Scope Intelligent Questionnaire System",
         "Unlike superficial scanners that only inspect API flags, the platform correlates cloud telemetry with organizational realities:\n"
         "• Organizational Scope: Central IT policies, SOC 2 compliance goals, FinOps tagging conventions, hardware MFA policies, and enterprise DR SLAs.\n"
         "• Account/Workload Scope: Telemetry pipelines, database multi-AZ failover configurations, CI/CD canary automation, and KMS key rotation.\n"
         "• Auditor Guidance: Every question provides explicit 'Why It Matters', 'How to Verify (CLI commands)', and 'Audit Evidence Requirements'."),
        ("2. Interactive Visual Architecture Topology",
         "Renders an interactive topology diagram of the workload network:\n"
         "• Structural Subnet Grouping: Public Ingress, Private Compute, and Private Data/Storage tiers.\n"
         "• Live Status Correlation: Healthy resources display clean indicators; nodes with active vulnerabilities pulse in high-visibility alerts.\n"
         "• Click-to-Remediate Drilldown: Clicking any node (e.g. ALB, RDS, Lambda) instantly opens its specific WAFR finding and remediation playbook."),
        ("3. AI-Powered Remediation Engine (IaC-Ready)",
         "To solve the industry's Assessment-to-Remediation gap, every failing finding includes production-ready code:\n"
         "• Production Terraform (.tf): Modular, variable-parameterized code ready for pull-request submission.\n"
         "• CloudFormation & Azure Bicep: Declarative templates for native cloud orchestration.\n"
         "• Executable CLI Scripts: Verified command-line scripts for fast staging validation.\n"
         "• Step-by-Step Console Playbooks: Click-by-click instructions for manual operations.\n"
         "• Blast Radius & Resource ARNs: Exact lists of affected resource identifiers and estimated fix duration (e.g., 'Low Effort · 15 min').")
    ]
    
    for t_title, t_desc in tech_modules:
        h3 = doc.add_heading(t_title, level=3)
        h3.paragraph_format.space_before = Pt(8)
        h3.paragraph_format.space_after = Pt(2)
        h3.runs[0].font.color.rgb = RGBColor(0x0F, 0x17, 0x2A)
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(6)
        p.add_run(t_desc).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
        
    doc.add_heading("Example Remediation Output: Production Terraform Snippet", level=3)
    add_code_block(doc, 
'''# Production Terraform Fix for REL-019 (ALB Target Group Health Check)
resource "aws_lb_target_group" "prod_api" {
  name     = "prod-api-tg"
  port     = 80
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  health_check {
    path                = "/healthz"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 2
  }

  tags = {
    Environment = "production"
    ManagedBy   = "Terraform"
  }
}''')

    doc.add_heading("4. Milestone Engine & Historical Drift Tracking", level=3)
    p = doc.add_paragraph()
    p.add_run(
        "Architectural governance is an ongoing journey. The platform enables engineering teams to record versioned "
        "milestone snapshots (e.g., 'v1.0 Initial Baseline', 'v1.1 Sprint 1 Remediation', 'v2.0 Production Hardening'). "
        "The milestone engine tracks delta comparisons over 30, 60, 90, or 365-day intervals, quantifying High-Risk Items (HRI) "
        "resolved, pillar score improvements (+12% Security, +9% Reliability), and proving measurable ROI to leadership."
    ).font.color.rgb = RGBColor(0x33, 0x41, 0x55)
    
    # ── SECTION 6: STRATEGIC PERSPECTIVES ──
    h1 = doc.add_heading(level=1)
    h1.paragraph_format.space_before = Pt(16)
    h1.paragraph_format.space_after = Pt(6)
    r = h1.add_run("6. Strategic Perspectives & Industry Recommendations")
    r.font.name = "Segoe UI"
    r.font.color.rgb = RGBColor(0x1E, 0x3A, 0x8A)
    
    thoughts = [
        ("1. Close the 'Shelf-Ware' Dilemma via Automated Remediation",
         "The most common failure mode in cloud architecture reviews is the Assessment-to-Remediation gap. "
         "Enterprises pay substantial fees for 100-page assessment documents that sit untouched because engineering teams "
         "lack the bandwidth to write boilerplate code. By immediately pairing findings with syntax-validated Terraform and "
         "console playbooks, the platform compresses remediation time from months to minutes."),
        ("2. Transition from Annual Audits to Continuous Milestone Posture",
         "Annual reviews foster an unhealthy cycle of 'drift, panic, audit, scramble, and decay.' Modern cloud workloads "
         "change daily with automated CI/CD pipelines. Establishing monthly or sprint-based WAFR milestones keeps teams "
         "continuously audit-ready and aligns architecture with ongoing sprint goals."),
        ("3. Shift Architectural Governance Left into CI/CD Pipelines",
         "While control-plane scanning detects runtime misconfigurations, ideal architecture practice prevents defective configurations "
         "from ever reaching production. Integrating the WAFR rule catalog into pre-merge pull-request linters ensures that "
         "open security groups or unencrypted databases are blocked prior to deployment."),
        ("4. Prepare for the Wave of Generative AI Workloads",
         "As organizations embed Large Language Models and vector search into production, standard cloud reviews fail to address "
         "AI-specific vulnerabilities: prompt injection attacks, vector database latency degradation, and runaway token expenses. "
         "The platform's GenAI Lens equips engineering teams with targeted safeguards for foundation model operations.")
    ]
    
    for t_num, t_text in thoughts:
        add_callout(doc, t_num, t_text, bg_hex="F8FAFC", border_color="2563EB")
        
    # Final Sign-off block
    p_end = doc.add_paragraph()
    p_end.paragraph_format.space_before = Pt(20)
    p_end.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r_end = p_end.add_run("CloudifyOps Unified Cloud WAFR Platform · Product Documentation & Technical Whitepaper · cloudifyops.com")
    r_end.font.name = "Segoe UI"
    r_end.font.size = Pt(8.5)
    r_end.font.color.rgb = RGBColor(0x94, 0xA3, 0xB8)
    
    output_filename = "CloudifyOps_Unified_Cloud_WAFR_Product_Documentation.docx"
    doc.save(output_filename)
    print(f"Successfully generated Word document: {output_filename}")

if __name__ == "__main__":
    build_document()
