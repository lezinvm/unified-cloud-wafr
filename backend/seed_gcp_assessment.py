"""
Seed GCP environment with VM 'lens-multicloud' (machine type: e2-medium),
including cloud account, failed GCP assessment, findings, remediations with
Terraform & gcloud CLI, resource inventory, and remediation statuses.
"""
import asyncio
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient

import os
MONGO_URI = os.getenv("MONGO_URI", "mongodb://127.0.0.1:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

ASSESSMENT_ID = "A-GCP-001"
PROJECT_ID = "proj-gcp-prod-9941"
ACCOUNT_NAME = "acme-gcp-prod"
ZONE = "us-central1-a"
REGION = "us-central1"
VM_NAME = "lens-multicloud"
MACHINE_TYPE = "e2-medium"
NOW = datetime.now(timezone.utc).isoformat()

VM_RESOURCE_URI = f"//compute.googleapis.com/projects/{PROJECT_ID}/zones/{ZONE}/instances/{VM_NAME}"
DISK_RESOURCE_URI = f"//compute.googleapis.com/projects/{PROJECT_ID}/zones/{ZONE}/disks/{VM_NAME}-boot"
BACKEND_URI = f"//compute.googleapis.com/projects/{PROJECT_ID}/global/backendServices/{VM_NAME}-backend"
FIREWALL_URI = f"//compute.googleapis.com/projects/{PROJECT_ID}/global/firewalls/default-allow-ssh"

async def seed():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]

    print("Connecting to MongoDB wafr_db for GCP seeding...")

    # 1. Cloud Account for GCP (accessible by all users)
    account_doc = {
        "id": PROJECT_ID,
        "cloud": "gcp",
        "account_name": ACCOUNT_NAME,
        "account_identifier": PROJECT_ID,
        "gcp_project": PROJECT_ID,
        "auth_type": "service-account",
        "sa_email": f"wafr-scanner@{PROJECT_ID}.iam.gserviceaccount.com",
        "default_region": REGION,
        "status": "connected",
        "is_global": True,
        "user_id": "all",
        "org_id": "global",
        "last_connected_at": NOW,
        "created_at": NOW
    }
    await db["cloud_accounts"].update_one({"id": PROJECT_ID}, {"$set": account_doc}, upsert=True)
    print(f"[OK] GCP Cloud Account '{PROJECT_ID}' seeded.")

    # 2. GCP Architecture Assessment evaluating lens-multicloud
    assessment_doc = {
        "id": ASSESSMENT_ID,
        "name": f"Google Cloud Architecture Review — {VM_NAME} ({REGION})",
        "org_id": "global",
        "user_id": "all",
        "is_global": True,
        "cloud_account_id": PROJECT_ID,
        "account_name": ACCOUNT_NAME,
        "account_identifier": PROJECT_ID,
        "cloud": "gcp",
        "region": REGION,
        "lens": "gcp-architecture-framework",
        "status": "FAIL",
        "score": 42,
        "checks_count": 46,
        "total_checks": 46,
        "passed_checks": 19,
        "failed_checks": 27,
        "total_best_practices": 16,
        "passed_bps": 5,
        "failed_bps": 11,
        "high_risks": 14,
        "medium_risks": 9,
        "low_risks": 4,
        "pillar_scores": {
            "security": 34,
            "reliability": 41,
            "cost": 50,
            "operations": 42,
            "performance": 43
        },
        "rerun_count": 1,
        "last_run_at": NOW,
        "created_at": NOW,
        "updated_at": NOW
    }
    await db["assessments"].update_one({"id": ASSESSMENT_ID}, {"$set": assessment_doc}, upsert=True)
    print(f"[OK] GCP Failed Assessment '{ASSESSMENT_ID}' seeded (Score: 42%).")

    # 3. Findings specifically targeting the lens-multicloud VM instance
    findings_list = [
        {
            "id": f"FND-{ASSESSMENT_ID}-SEC-061",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "SEC-061",
            "remediation_id": "REM-GCP-SEC-061",
            "cloud": "gcp",
            "pillar_id": "security",
            "pillar": "Security",
            "severity": "critical",
            "title": f"VPC Firewall allows unrestricted inbound TCP 22 (SSH) to VM '{VM_NAME}'",
            "description": f"Compute Engine VM '{VM_NAME}' ({MACHINE_TYPE}) has a public external IP attached, and firewall rule 'default-allow-ssh' permits ingress from 0.0.0.0/0 directly to port 22.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "Critical Risk",
            "resources": [
                VM_RESOURCE_URI,
                FIREWALL_URI
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-SEC-047",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "SEC-047",
            "remediation_id": "REM-GCP-SEC-047",
            "cloud": "gcp",
            "pillar_id": "security",
            "pillar": "Security",
            "severity": "critical",
            "title": f"Compute Engine VM '{VM_NAME}' configured with default Compute service account and Project Editor role",
            "description": f"Instance '{VM_NAME}' is using the default Compute Engine service account with excessive 'roles/editor' primitive permissions, violating the principle of least privilege.",
            "status": "fail",
            "effort": "Medium Effort",
            "risk": "Critical Risk",
            "resources": [
                VM_RESOURCE_URI,
                f"//iam.googleapis.com/projects/{PROJECT_ID}/serviceAccounts/124890123-compute@developer.gserviceaccount.com"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-REL-019",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "REL-019",
            "remediation_id": "REM-GCP-REL-019",
            "cloud": "gcp",
            "pillar_id": "reliability",
            "pillar": "Reliability",
            "severity": "high",
            "title": f"Cloud Load Balancing backend service for '{VM_NAME}' missing HTTP/HTTPS health check probe",
            "description": f"Load Balancer backend service '{VM_NAME}-backend' serving traffic to instance '{VM_NAME}' has no configured health check probe, risking traffic routing to crashed services.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "High Risk",
            "resources": [
                BACKEND_URI,
                VM_RESOURCE_URI
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-COST-008",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "COST-008",
            "remediation_id": "REM-GCP-COST-008",
            "cloud": "gcp",
            "pillar_id": "cost",
            "pillar": "Cost Optimization",
            "severity": "medium",
            "title": f"Compute Engine VM '{VM_NAME}' ({MACHINE_TYPE}) boot disk lacks snapshot schedule and idle rightsizing",
            "description": f"The persistent boot disk '{VM_NAME}-boot' has no automated snapshot policy attached, and CPU utilization on {MACHINE_TYPE} averages under 4%, incurring unnecessary costs.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "Medium Risk",
            "resources": [
                DISK_RESOURCE_URI,
                VM_RESOURCE_URI
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-OPS-014",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "OPS-014",
            "remediation_id": "REM-GCP-OPS-014",
            "cloud": "gcp",
            "pillar_id": "operations",
            "pillar": "Operational Excellence",
            "severity": "high",
            "title": f"Cloud Logging sink missing for audit and system logs from VM '{VM_NAME}'",
            "description": f"System event logs and audit logs for '{VM_NAME}' are not exported to a centralized BigQuery dataset or Cloud Storage bucket for 365-day compliance retention.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "High Risk",
            "resources": [
                VM_RESOURCE_URI,
                f"//logging.googleapis.com/projects/{PROJECT_ID}/sinks/audit-logs-sink"
            ],
            "created_at": NOW,
            "updated_at": NOW
        },
        {
            "id": f"FND-{ASSESSMENT_ID}-PRF-201",
            "assessment_id": ASSESSMENT_ID,
            "check_id": "PERF-CHK-201",
            "remediation_id": "REM-GCP-PRF-201",
            "cloud": "gcp",
            "pillar_id": "performance",
            "pillar": "Performance Efficiency",
            "severity": "medium",
            "title": f"Cloud CDN not enabled on Cloud Load Balancing backend service for '{VM_NAME}'",
            "description": f"Backend service '{VM_NAME}-backend' has Cloud CDN caching disabled, resulting in high edge latency and redundant origin requests for static content.",
            "status": "fail",
            "effort": "Low Effort",
            "risk": "Medium Risk",
            "resources": [
                BACKEND_URI
            ],
            "created_at": NOW,
            "updated_at": NOW
        }
    ]

    for f in findings_list:
        await db["findings"].update_one({"id": f["id"]}, {"$set": f}, upsert=True)
    print(f"[OK] Seeded {len(findings_list)} GCP findings targeting '{VM_NAME}'.")

    # 4. Comprehensive Remediations specifically targeting VM lens-multicloud & e2-medium
    remediations_list = [
        {
            "id": "REM-GCP-SEC-061",
            "check_id": "SEC-061",
            "cloud": "gcp",
            "pillar": "Security",
            "pillarId": "security",
            "severity": "critical",
            "title": f"Restrict Inbound SSH Access to IAP CIDR and Remove External IP from '{VM_NAME}'",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "Critical Risk",
            "description": f"Update firewall rules to restrict port 22 access to Google Identity-Aware Proxy (IAP) CIDR range 35.235.240.0/20, and eliminate public external IP on '{VM_NAME}'.",
            "rationale": "Exposing SSH port 22 to 0.0.0.0/0 subjects the VM to automated brute-force attacks and credential stuffing.",
            "resources": [
                VM_RESOURCE_URI,
                FIREWALL_URI
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Update Firewall Rule for IAP",
                    "consolePath": "Google Cloud Console -> VPC network -> Firewall -> default-allow-ssh -> Edit",
                    "instruction": "Change Source IPv4 ranges from 0.0.0.0/0 to '35.235.240.0/20' (Google IAP range)."
                },
                {
                    "step": 2,
                    "title": f"Remove Public External IP from {VM_NAME}",
                    "consolePath": f"Compute Engine -> VM instances -> {VM_NAME} -> Edit -> Network interfaces",
                    "instruction": "Set External IPv4 address to 'None', save changes. Use 'gcloud compute ssh --tunnel-through-iap' for secure access."
                }
            ],
            "cli": {
                "command": f"""# 1. Update firewall rule to permit SSH only from Google IAP:
gcloud compute firewall-rules update default-allow-ssh \\
  --project={PROJECT_ID} \\
  --source-ranges=35.235.240.0/20

# 2. Remove external IP from VM '{VM_NAME}':
gcloud compute instances delete-access-config {VM_NAME} \\
  --project={PROJECT_ID} \\
  --zone={ZONE} \\
  --access-config-name="external-nat"

# 3. Connect securely via IAP tunnel:
gcloud compute ssh {VM_NAME} --project={PROJECT_ID} --zone={ZONE} --tunnel-through-iap""",
                "explanation": "Restricts SSH to Google IAP proxy CIDR and removes the public IP from the instance."
            },
            "iac": {
                "tf": f"""# Google Cloud Compute Instance: {VM_NAME} (e2-medium)
resource "google_compute_instance" "lens_multicloud" {{
  name         = "{VM_NAME}"
  machine_type = "{MACHINE_TYPE}"
  zone         = "{ZONE}"
  project      = "{PROJECT_ID}"

  boot_disk {{
    initialize_params {{
      image = "debian-cloud/debian-12"
      size  = 30
      type  = "pd-balanced"
    }}
  }}

  network_interface {{
    network = "default"
    # No access_config block = Private IP only (no external public IP)
  }}

  metadata = {{
    enable-oslogin = "TRUE"
  }}
}}

resource "google_compute_firewall" "iap_ssh" {{
  name    = "allow-ssh-from-iap"
  network = "default"
  project = "{PROJECT_ID}"

  allow {{
    protocol = "tcp"
    ports    = ["22"]
  }}

  source_ranges = ["35.235.240.0/20"]
  target_tags   = ["iap-ssh"]
}}""",
                "cf": f"""# Deployment Manager Template for {VM_NAME}
resources:
- name: {VM_NAME}
  type: compute.v1.instance
  properties:
    zone: {ZONE}
    machineType: zones/{ZONE}/machineTypes/{MACHINE_TYPE}
    disks:
    - boot: true
      autoDelete: true
      initializeParams:
        sourceImage: projects/debian-cloud/global/images/family/debian-12
    networkInterfaces:
    - network: global/networks/default"""
            }
        },
        {
            "id": "REM-GCP-SEC-047",
            "check_id": "SEC-047",
            "cloud": "gcp",
            "pillar": "Security",
            "pillarId": "security",
            "severity": "critical",
            "title": f"Attach Dedicated Least-Privilege Service Account to '{VM_NAME}'",
            "effort": "Medium Effort",
            "estTime": "15 min",
            "risk": "Critical Risk",
            "description": f"Create a dedicated service account with minimal IAM roles (e.g. logging.logWriter, monitoring.metricWriter) and bind it to VM '{VM_NAME}'.",
            "rationale": "Default Compute service accounts have broad Editor privileges, granting instances access to manipulate databases, storage, and IAM policies.",
            "resources": [
                VM_RESOURCE_URI,
                f"//iam.googleapis.com/projects/{PROJECT_ID}/serviceAccounts/124890123-compute@developer.gserviceaccount.com"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Create Dedicated Service Account",
                    "consolePath": "IAM & Admin -> Service Accounts -> Create service account",
                    "instruction": f"Name: 'sa-{VM_NAME}-runner'. Grant roles: 'Logs Writer' and 'Monitoring Metric Writer'."
                },
                {
                    "step": 2,
                    "title": f"Stop VM and Assign New Service Account",
                    "consolePath": f"Compute Engine -> VM instances -> {VM_NAME} -> Stop -> Edit -> Service account",
                    "instruction": f"Select 'sa-{VM_NAME}-runner', save, and start the VM instance."
                }
            ],
            "cli": {
                "command": f"""# 1. Create custom service account:
gcloud iam service-accounts create sa-{VM_NAME}-runner \\
  --project={PROJECT_ID} \\
  --display-name="Service Account for {VM_NAME}"

# 2. Grant least privilege monitoring & logging:
gcloud projects add-iam-policy-binding {PROJECT_ID} \\
  --member="serviceAccount:sa-{VM_NAME}-runner@{PROJECT_ID}.iam.gserviceaccount.com" \\
  --role="roles/logging.logWriter"

# 3. Attach to {VM_NAME}:
gcloud compute instances stop {VM_NAME} --zone={ZONE} --project={PROJECT_ID}
gcloud compute instances set-service-account {VM_NAME} \\
  --zone={ZONE} \\
  --project={PROJECT_ID} \\
  --service-account="sa-{VM_NAME}-runner@{PROJECT_ID}.iam.gserviceaccount.com" \\
  --scopes="https://www.googleapis.com/auth/cloud-platform"
gcloud compute instances start {VM_NAME} --zone={ZONE} --project={PROJECT_ID}""",
                "explanation": "Replaces primitive Editor default compute account with a targeted least-privilege runner account."
            },
            "iac": {
                "tf": f"""resource "google_service_account" "vm_sa" {{
  account_id   = "sa-{VM_NAME}-runner"
  display_name = "Service Account for {VM_NAME}"
  project      = "{PROJECT_ID}"
}}

resource "google_project_iam_member" "log_writer" {{
  project = "{PROJECT_ID}"
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${{google_service_account.vm_sa.email}}"
}}

resource "google_project_iam_member" "metric_writer" {{
  project = "{PROJECT_ID}"
  role    = "roles/monitoring.metricWriter"
  member  = "serviceAccount:${{google_service_account.vm_sa.email}}"
}}""",
                "cf": f"""# CloudFormation / Deployment Manager template for custom IAM SA"""
            }
        },
        {
            "id": "REM-GCP-REL-019",
            "check_id": "REL-019",
            "cloud": "gcp",
            "pillar": "Reliability",
            "pillarId": "reliability",
            "severity": "high",
            "title": f"Configure Active HTTP Health Check on Backend Service '{VM_NAME}-backend'",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "High Risk",
            "description": f"Create and attach a persistent HTTP /healthz probe with 10s interval and 5s timeout to backend service '{VM_NAME}-backend'.",
            "rationale": "Without an active health check, Google Cloud Load Balancing cannot detect hung application processes on the VM instance.",
            "resources": [
                BACKEND_URI,
                VM_RESOURCE_URI
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Create Health Check Probe",
                    "consolePath": "Network services -> Load balancing -> Health checks -> Create health check",
                    "instruction": "Protocol: HTTP, Port: 80, Request path: /healthz, Check interval: 10, Timeout: 5, Healthy threshold: 2, Unhealthy: 2."
                },
                {
                    "step": 2,
                    "title": f"Attach Probe to {VM_NAME}-backend",
                    "consolePath": f"Load balancing -> Backends -> {VM_NAME}-backend -> Edit -> Health check",
                    "instruction": "Select the newly created health check and click 'Update'."
                }
            ],
            "cli": {
                "command": f"""# 1. Create HTTP health check:
gcloud compute health-checks create http hc-{VM_NAME} \\
  --project={PROJECT_ID} \\
  --port=80 \\
  --request-path="/healthz" \\
  --check-interval=10s \\
  --timeout=5s \\
  --healthy-threshold=2 \\
  --unhealthy-threshold=2

# 2. Attach to backend service:
gcloud compute backend-services update {VM_NAME}-backend \\
  --project={PROJECT_ID} \\
  --global \\
  --health-checks=hc-{VM_NAME}""",
                "explanation": "Creates and binds an active health check to ensure automatic failover and instance eviction upon failure."
            },
            "iac": {
                "tf": f"""resource "google_compute_health_check" "http" {{
  name               = "hc-{VM_NAME}"
  project            = "{PROJECT_ID}"
  check_interval_sec = 10
  timeout_sec        = 5
  healthy_threshold  = 2
  unhealthy_threshold= 2

  http_health_check {{
    port         = 80
    request_path = "/healthz"
  }}
}}

resource "google_compute_backend_service" "backend" {{
  name          = "{VM_NAME}-backend"
  project       = "{PROJECT_ID}"
  health_checks = [google_compute_health_check.http.id]
}}""",
                "cf": f"""# Deployment Manager template for Backend Service Health Check"""
            }
        },
        {
            "id": "REM-GCP-COST-008",
            "check_id": "COST-008",
            "cloud": "gcp",
            "pillar": "Cost Optimization",
            "pillarId": "cost",
            "severity": "medium",
            "title": f"Attach Snapshot Schedule to Boot Disk '{VM_NAME}-boot' and Evaluate Committed Use",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "Medium Risk",
            "description": f"Attach a daily automated snapshot schedule with 14-day retention to disk '{VM_NAME}-boot' and evaluate 1-year CUD for {MACHINE_TYPE}.",
            "rationale": "Automated snapshot schedules guarantee disaster recovery without manual intervention while 1-year CUD saves 37% on instance costs.",
            "resources": [
                DISK_RESOURCE_URI,
                VM_RESOURCE_URI
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Create Snapshot Schedule",
                    "consolePath": "Compute Engine -> Snapshots -> Snapshot schedules -> Create snapshot schedule",
                    "instruction": "Schedule: Daily at 02:00 UTC, Retention: 14 days, Region: Regional (us-central1)."
                },
                {
                    "step": 2,
                    "title": f"Attach Schedule to {VM_NAME}-boot",
                    "consolePath": f"Compute Engine -> Disks -> {VM_NAME}-boot -> Edit -> Snapshot schedule",
                    "instruction": "Select snapshot schedule and save."
                }
            ],
            "cli": {
                "command": f"""# 1. Create snapshot schedule:
gcloud compute resource-policies create snapshot-schedule sched-daily-boot \\
  --project={PROJECT_ID} \\
  --region={REGION} \\
  --max-retention-days=14 \\
  --daily-schedule \\
  --start-time=02:00

# 2. Attach to {VM_NAME}-boot disk:
gcloud compute disks add-resource-policies {VM_NAME}-boot \\
  --project={PROJECT_ID} \\
  --zone={ZONE} \\
  --resource-policies=sched-daily-boot""",
                "explanation": "Configures automated daily backup schedule with automated pruning after 14 days."
            },
            "iac": {
                "tf": f"""resource "google_compute_resource_policy" "daily_snapshot" {{
  name    = "sched-daily-boot"
  project = "{PROJECT_ID}"
  region  = "{REGION}"

  snapshot_schedule_policy {{
    schedule {{
      daily_schedule {{
        days_in_cycle = 1
        start_time    = "02:00"
      }}
    }}
    retention_policy {{
      max_retention_days    = 14
      on_source_disk_delete = "KEEP_AUTOMATIC_SNAPSHOTS"
    }}
  }}
}}

resource "google_compute_disk_resource_policy_attachment" "attachment" {{
  name    = google_compute_resource_policy.daily_snapshot.name
  disk    = "{VM_NAME}-boot"
  zone    = "{ZONE}"
  project = "{PROJECT_ID}"
}}""",
                "cf": f"""# Deployment Manager template for disk snapshot policy"""
            }
        },
        {
            "id": "REM-GCP-OPS-014",
            "check_id": "OPS-014",
            "cloud": "gcp",
            "pillar": "Operational Excellence",
            "pillarId": "operations",
            "severity": "high",
            "title": f"Create BigQuery Audit Log Sink for '{VM_NAME}' and Compute Engine",
            "effort": "Low Effort",
            "estTime": "15 min",
            "risk": "High Risk",
            "description": f"Create an aggregated log sink routing Admin Activity and System Event audit logs to BigQuery for analysis and compliance.",
            "rationale": "Exporting audit logs to BigQuery enables long-term retention compliance, forensic investigation, and real-time SIEM queries.",
            "resources": [
                VM_RESOURCE_URI,
                f"//logging.googleapis.com/projects/{PROJECT_ID}/sinks/audit-logs-sink"
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Create BigQuery Log Sink",
                    "consolePath": "Logging -> Log Router -> Create sink -> BigQuery",
                    "instruction": "Filter: resource.type=\"gce_instance\" OR logName:\"cloudaudit.googleapis.com\", Destination: BigQuery dataset."
                }
            ],
            "cli": {
                "command": f"""gcloud logging sinks create audit-logs-sink \\
  bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/security_audit_logs \\
  --log-filter='resource.type="gce_instance" OR logName:"cloudaudit.googleapis.com"' \\
  --project={PROJECT_ID}""",
                "explanation": "Creates a centralized log sink routing all cloud audit and compute logs to BigQuery."
            },
            "iac": {
                "tf": f"""resource "google_logging_project_sink" "audit_sink" {{
  name        = "audit-logs-sink"
  project     = "{PROJECT_ID}"
  destination = "bigquery.googleapis.com/projects/{PROJECT_ID}/datasets/security_audit_logs"
  filter      = "resource.type=\\"gce_instance\\" OR logName:\\"cloudaudit.googleapis.com\\""
}}""",
                "cf": f"""# Deployment Manager template for BigQuery log sink"""
            }
        },
        {
            "id": "REM-GCP-PRF-201",
            "check_id": "PERF-CHK-201",
            "cloud": "gcp",
            "pillar": "Performance Efficiency",
            "pillarId": "performance",
            "severity": "medium",
            "title": f"Enable Cloud CDN Edge Caching on Backend Service '{VM_NAME}-backend'",
            "effort": "Low Effort",
            "estTime": "10 min",
            "risk": "Medium Risk",
            "description": f"Enable Cloud CDN with CACHE_ALL_STATIC mode on backend service '{VM_NAME}-backend' to serve web assets directly from Google edge PoPs.",
            "rationale": "Enabling Cloud CDN caches content at Google global edge points of presence, dramatically lowering latency and offloading CPU from {MACHINE_TYPE}.",
            "resources": [
                BACKEND_URI
            ],
            "manualSteps": [
                {
                    "step": 1,
                    "title": "Enable Cloud CDN on Backend Service",
                    "consolePath": f"Network services -> Load balancing -> Backends -> {VM_NAME}-backend -> Edit -> Enable Cloud CDN",
                    "instruction": "Enable Cloud CDN with CACHE_ALL_STATIC mode."
                }
            ],
            "cli": {
                "command": f"""gcloud compute backend-services update {VM_NAME}-backend \\
  --project={PROJECT_ID} \\
  --global \\
  --enable-cdn \\
  --cache-mode=CACHE_ALL_STATIC""",
                "explanation": "Enables Google Cloud CDN with CACHE_ALL_STATIC mode on the backend service."
            },
            "iac": {
                "tf": f"""resource "google_compute_backend_service" "static" {{
  name       = "{VM_NAME}-backend"
  project    = "{PROJECT_ID}"
  enable_cdn = true
  cdn_policy {{
    cache_mode = "CACHE_ALL_STATIC"
  }}
}}""",
                "cf": f"""# Deployment Manager template for Cloud CDN"""
            }
        }
    ]

    for rem in remediations_list:
        await db["remediations"].update_one({"id": rem["id"]}, {"$set": rem}, upsert=True)
    print(f"[OK] Seeded {len(remediations_list)} comprehensive GCP remediations.")

    # 5. Pending Remediation Statuses for interactive Rerun Check / Verify Fix
    statuses_to_insert = []
    for f in findings_list:
        statuses_to_insert.append({
            "key": f"{ASSESSMENT_ID}::{f['check_id']}::__check_level__",
            "assessment_id": ASSESSMENT_ID,
            "check_id": f["check_id"],
            "resource_raw": "__check_level__",
            "status": "pending",
            "note": "Initial failing GCP assessment state",
            "user_id": "all",
            "updated_at": NOW
        })
        for r in f.get("resources", []):
            statuses_to_insert.append({
                "key": f"{ASSESSMENT_ID}::{f['check_id']}::{r}",
                "assessment_id": ASSESSMENT_ID,
                "check_id": f["check_id"],
                "resource_raw": r,
                "status": "pending",
                "note": f"Awaiting remediation fix for {VM_NAME}",
                "user_id": "all",
                "updated_at": NOW
            })

    for s in statuses_to_insert:
        await db["remediation_statuses"].update_one({"key": s["key"]}, {"$set": s}, upsert=True)
    print(f"[OK] Seeded {len(statuses_to_insert)} pending remediation statuses for '{ASSESSMENT_ID}'.")

    # 6. Resource Inventory (including lens-multicloud VM)
    all_res = [
        {
            "id": f"res-gcp-{VM_NAME}",
            "name": VM_NAME,
            "type": "compute.v1.instance",
            "arn": VM_RESOURCE_URI,
            "cloud": "gcp",
            "service": "compute",
            "machine_type": MACHINE_TYPE,
            "zone": ZONE,
            "assessment_id": ASSESSMENT_ID,
            "status": "non_compliant"
        },
        {
            "id": f"res-gcp-{VM_NAME}-boot",
            "name": f"{VM_NAME}-boot",
            "type": "compute.v1.disk",
            "arn": DISK_RESOURCE_URI,
            "cloud": "gcp",
            "service": "compute",
            "size_gb": 30,
            "disk_type": "pd-standard",
            "assessment_id": ASSESSMENT_ID,
            "status": "non_compliant"
        },
        {
            "id": f"res-gcp-{VM_NAME}-backend",
            "name": f"{VM_NAME}-backend",
            "type": "compute.v1.backendService",
            "arn": BACKEND_URI,
            "cloud": "gcp",
            "service": "loadbalancing",
            "assessment_id": ASSESSMENT_ID,
            "status": "non_compliant"
        },
        {
            "id": f"res-gcp-firewall-ssh",
            "name": "default-allow-ssh",
            "type": "compute.v1.firewall",
            "arn": FIREWALL_URI,
            "cloud": "gcp",
            "service": "vpc",
            "assessment_id": ASSESSMENT_ID,
            "status": "non_compliant"
        }
    ]
    for res in all_res:
        await db["resource_inventory"].update_one({"id": res["id"]}, {"$set": res}, upsert=True)
    print(f"[OK] Seeded {len(all_res)} resources in resource inventory (including VM '{VM_NAME}').")

    # 7. Baseline Milestone for A-GCP-001 (Score: 42%)
    milestone_doc = {
        "id": f"MLST-{ASSESSMENT_ID}-1",
        "assessment_id": ASSESSMENT_ID,
        "milestone_number": 1,
        "milestone_name": f"Initial Baseline Architecture Review ({VM_NAME})",
        "version": "v1.0.0",
        "recorded_at": "Today",
        "recorded_by": "Automated Cloud Scanner",
        "score": 42,
        "total_checks": 46,
        "passed_checks": 19,
        "failed_checks": 27,
        "high_risks": 14,
        "medium_risks": 9,
        "low_risks": 4,
        "total_best_practices": 16,
        "passed_bps": 5,
        "failed_bps": 11,
        "notes": f"Pre-remediation architecture scan for GCP VM '{VM_NAME}' ({MACHINE_TYPE}) flagged public SSH, default Editor service account, and missing health checks.",
        "pillar_scores": {
            "security": 34,
            "reliability": 41,
            "cost": 50,
            "operations": 42,
            "performance": 43
        },
        "created_at": NOW
    }
    await db["milestones"].update_one({"id": milestone_doc["id"]}, {"$set": milestone_doc}, upsert=True)
    print(f"[OK] Seeded baseline milestone {milestone_doc['id']}.")

    # 8. Compliance Framework Scores for GCP
    compliance_scores = [
        {"assessment_id": ASSESSMENT_ID, "framework_id": "cis-gcp-2.0", "name": "CIS Google Cloud Computing Foundations v2.0", "score": 36, "passing_controls": 19, "failing_controls": 31, "status": "failing"},
        {"assessment_id": ASSESSMENT_ID, "framework_id": "soc2-type2", "name": "SOC 2 Type II Security & Confidentiality", "score": 38, "passing_controls": 15, "failing_controls": 23, "status": "failing"},
        {"assessment_id": ASSESSMENT_ID, "framework_id": "fedramp-ksi", "name": "FedRAMP High Baseline (NIST SP 800-53)", "score": 32, "passing_controls": 25, "failing_controls": 53, "status": "failing"},
        {"assessment_id": ASSESSMENT_ID, "framework_id": "iso-27001", "name": "ISO/IEC 27001:2022 Information Security", "score": 41, "passing_controls": 17, "failing_controls": 21, "status": "failing"}
    ]
    for cs in compliance_scores:
        await db["assessment_compliance_scores"].update_one(
            {"assessment_id": ASSESSMENT_ID, "framework_id": cs["framework_id"]},
            {"$set": cs},
            upsert=True
        )
    print(f"[OK] Seeded compliance scores for {ASSESSMENT_ID}.")

    # 9. Alert Log
    alert_log = {
        "id": f"ALT-GCP-{int(datetime.now().timestamp())}",
        "service": "wafr",
        "title": f"GCP Architecture Audit Completed with Failures: {VM_NAME}",
        "details": f"Automated inspection for GCP instance '{VM_NAME}' ({MACHINE_TYPE}) completed with 14 High/Critical risks.",
        "severity": "critical",
        "status": "delivered",
        "assessment_name": assessment_doc["name"],
        "timestamp": "Just now",
        "created_at": NOW
    }
    await db["alert_logs"].update_one({"id": alert_log["id"]}, {"$set": alert_log}, upsert=True)
    print(f"[OK] Seeded alert log {alert_log['id']}.")

    print(f"\n=======================================================")
    print(f" SUCCESS: GCP Assessment '{ASSESSMENT_ID}' for VM '{VM_NAME}'")
    print(f" ({MACHINE_TYPE}) seeded into MongoDB 'wafr_db'!")
    print(f"=======================================================\n")

if __name__ == "__main__":
    asyncio.run(seed())
