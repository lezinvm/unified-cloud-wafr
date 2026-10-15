import json
import os
from pymongo import MongoClient

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DB_NAME = os.getenv("DB_NAME", "wafr_db")

AZURE_CHECKS_OVERRIDE = {
    "REL-CHK-101": ("Azure App Gateway cross-zone redundancy enabled across all backend pools", "Ensures even traffic distribution across Azure Availability Zones to prevent backend degradation."),
    "REL-CHK-102": ("Zone-redundant HA enabled for Azure SQL Database & Cosmos DB clusters", "Automates synchronous multi-region standby replication for sub-second failover."),
    "REL-CHK-103": ("Azure Traffic Manager / Front Door latency routing configured for failover", "Routes end users to the closest and healthiest Azure region automatically."),
    "REL-019": ("Azure Application Gateway backend health probe unconfigured", "Azure Application Gateway backend pool lacks custom HTTP/HTTPS health probes, risking traffic distribution to degraded backend Virtual Machine Scale Sets."),
    "REL-CHK-202": ("Azure Monitor metric alerts configured for CPU, memory, and DTU consumption", "Proactively alerts operations teams when resource utilization breaches safe operational thresholds."),
    "REL-CHK-203": ("Automated synthetic transaction monitoring on critical user journey endpoints", "Regularly validates end-to-end availability and API response latency from distributed edge locations."),
    "REL-CHK-301": ("Azure Service Bus queue missing dead-lettering on max delivery count", "Asynchronous transaction queues do not have dead-letter routing configured, leading to infinite redelivery loops and message poison pills."),
    "REL-CHK-302": ("Exponential backoff and retry jitter implemented in Azure SDK client libraries", "Prevents thundering herd problems and cascading failures against downstream Azure APIs and databases."),
    "REL-CHK-401": ("Cross-region automated backup and Geo-Replication configured for Azure SQL", "Guarantees database survivability and point-in-time restore across secondary Azure paired regions."),
    "REL-CHK-402": ("Azure Blob Storage Geo-Redundant Replication (GZRS) enabled with CMK", "Replicates storage container objects across physically separated data centers in primary and secondary regions."),
    "REL-CHK-403": ("Documented Recovery Time Objective (RTO < 1h) and RPO validated via automated drills", "Ensures recovery procedures are tested and meet strict organizational business continuity SLAs."),

    "SEC-047": ("Azure Managed Identity assigned wildcard Owner/Contributor roles on Subscription", "System and User-Assigned Managed Identities granted broad subscription-level privileges violating the principle of least privilege."),
    "SEC-CHK-102": ("Microsoft Entra ID service principals and credentials unused for 90+ days deactivated", "Stale credentials and inactive client secrets pose lingering risks of credential leakage and unauthorized access."),
    "SEC-CHK-103": ("MFA enforced for all Microsoft Entra ID admin users via Conditional Access", "Eliminates single-factor credential stuffing vulnerabilities across administrative accounts."),
    "SEC-CHK-104": ("Global Administrator role count minimized and PIM (Privileged Identity Management) enabled", "Ensures just-in-time privilege escalation with mandatory approval workflows."),
    "SEC-061": ("Network Security Group (NSG) allows inbound SSH (port 22) from Internet (0.0.0.0/0)", "Production subnets and VM network interfaces expose management port 22 directly to public IP ranges without Azure Bastion or VPN restrictions."),
    "SEC-CHK-202": ("Azure Web Application Firewall (WAF) policy active on Application Gateway", "Mitigates OWASP Top 10 web vulnerabilities including SQLi, XSS, and command injection at the ingress tier."),
    "SEC-CHK-203": ("Virtual Network (VNet) Flow Logs enabled with Traffic Analytics", "Captures IP traffic passing through network security groups for forensic audit and threat hunting."),
    "SEC-024": ("Azure Storage Account blob containers allow anonymous public read access", "Storage accounts hosting proprietary customer data do not enforce private container access levels or SAS token restrictions."),
    "SEC-CHK-302": ("Azure Storage & Managed Disk server-side encryption enabled with Customer-Managed Keys (CMK)", "Guarantees complete organization cryptographic governance and key lifecycle ownership via Azure Key Vault."),
    "SEC-CHK-303": ("TLS 1.3 enforced on Azure Front Door and App Service HTTPS endpoints", "Disables deprecated TLS 1.0/1.1 cipher suites and enforces strict modern encryption in transit."),
    "SEC-033": ("Azure Key Vault automated key rotation policy is not enabled", "Cryptographic keys and secrets stored in Azure Key Vault lack automated rotation schedules, increasing blast radius in the event of credential leakage."),
    "SEC-CHK-402": ("Microsoft Defender for Cloud threat protection enabled across subscriptions", "Provides continuous security posture management (CSPM) and real-time workload threat detection."),
    "SEC-CHK-403": ("Azure Policy initiative standards (CIS Microsoft Azure Foundations Benchmark) enforced", "Applies automated compliance controls and prevents deployment of non-compliant cloud resources."),

    "COST-008": ("Unattached Azure Managed Disks incurring unallocated storage spend", "Detached OS and data disks from deprovisioned Virtual Machines continue to incur full provisioned GB charges without storing active data."),
    "COST-CHK-102": ("Unassociated Azure Public IP addresses released to eliminate idle hourly fees", "Disassociated static and dynamic public IP addresses continue billing hourly allocation rates until deleted."),
    "COST-CHK-103": ("Automated retention and deletion policies configured for outdated VM snapshots", "Retains only recent incremental snapshots and automatically purges backups older than retention policy."),
    "COST-CHK-201": ("Azure Blob lifecycle management rules configured for cool/archive tier transitions", "Automatically migrates infrequent access blobs to Cool and Archive storage tiers to minimize storage expense."),
    "COST-CHK-202": ("Azure Dpsv5/Epsv5 (Ampere Altra ARM) VM families evaluated for compute savings", "Adopts energy-efficient ARM-based architectures providing up to 50% better price-performance."),
    "COST-CHK-203": ("Virtual Machine Scale Sets autoscale rules tuned to minimize over-provisioning", "Utilizes metric-driven scale-in rules to scale compute down during off-peak hours."),
    "COST-CHK-301": ("Azure Reserved VM Instances & Savings Plan coverage is at 42% (recommended: 70%)", "Steady-state workload baseline compute is paid at higher on-demand pay-as-you-go rates instead of discounted commitments."),
    "COST-CHK-302": ("Azure Cost Management anomaly alerts monitor daily spending spikes", "Automated anomaly detection identifies unplanned budget consumption and anomalous resource spikes."),

    "OPS-014": ("Azure Monitor Diagnostic Settings not streaming Activity Logs to Log Analytics", "Critical Azure resources and subscriptions lack diagnostic settings configured to stream telemetry and platform logs to a centralized Log Analytics workspace."),
    "OPS-CHK-102": ("Structured JSON telemetry and distributed tracing configured via Application Insights", "Standardizes application telemetry schemas for rich queryability in Azure Monitor Workbooks."),
    "OPS-CHK-103": ("OpenTelemetry instrumentation integrated across containerized workloads", "Ensures cloud-agnostic telemetry ingestion with vendor-neutral distributed tracing standards."),
    "OPS-CHK-201": ("Azure DevOps / GitHub Actions deployment pipelines require automated quality gates", "Blocks promotion of code containing unit test failures, lint errors, or security vulnerabilities."),
    "OPS-CHK-202": ("Blue/Green deployment slots enabled on Azure App Service and Container Apps", "Enables zero-downtime releases and rapid instantaneous rollback capabilities."),
    "OPS-CHK-203": ("Infrastructure defined entirely via version-controlled Bicep / Terraform templates", "Enforces immutable infrastructure patterns and prevents manual drift through the Azure Portal."),
    "OPS-CHK-301": ("Azure Monitor action groups not linked to automated runbooks or PagerDuty", "Operational alerts do not trigger automated remediation scripts or notify primary on-call engineers."),
    "OPS-CHK-302": ("Post-Incident Review (PIR) retrospectives and action items tracked to completion", "Formalizes blameless incident reviews and incorporates preventative architectural improvements."),

    "PERF-CHK-101": ("Azure Front Door / CDN configured for global edge caching and Brotli compression", "Caches static assets at Microsoft edge PoPs to drastically reduce round-trip latency and origin load."),
    "PERF-CHK-102": ("Azure Cache for Redis cluster active for frequent caching layer queries", "Maintains high-throughput, sub-millisecond in-memory cache for session data and frequent database reads."),
    "PERF-CHK-103": ("Latest generation Azure compute sizes (v5 series) utilized for high-throughput workloads", "Deploys compute instances on modern Intel Ice Lake and AMD EPYC processors for optimal compute density."),
    "PERF-CHK-201": ("Azure Front Door / CDN endpoint missing origin caching policy", "Azure Front Door endpoint lacks caching configuration rules for static content, forcing all user requests to traverse back to the origin backend."),
    "PERF-CHK-202": ("Azure Premium SSD v2 provisioned IOPS and throughput tuned for disk workloads", "Prevents I/O bottlenecks on database workloads by matching provisioned disk performance to application IOPS peaks."),
    "PERF-CHK-203": ("Accelerated Networking enabled on Azure Virtual Machines", "Bypasses the virtualization host to achieve single-digit microsecond network latency and high throughput."),
}

GCP_CHECKS_OVERRIDE = {
    "REL-CHK-101": ("Cloud Load Balancing cross-region traffic distribution enabled", "Ensures even traffic distribution across Google Cloud regions to prevent backend degradation."),
    "REL-CHK-102": ("Regional High Availability enabled for Cloud SQL & Cloud Spanner", "Automates synchronous multi-zone standby replication for sub-second failover."),
    "REL-CHK-103": ("Cloud DNS latency-based routing policies configured for multi-region failover", "Routes end users to the closest and healthiest GCP region automatically."),
    "REL-019": ("Cloud Load Balancing backend service missing configured health check", "External HTTP(S) Load Balancer backend service lacks a functioning health check endpoint, risking traffic routing to unhealthy Compute Engine VM instances."),
    "REL-CHK-202": ("Cloud Monitoring alerting policies configured for compute utilization", "Proactively alerts operations teams when CPU, memory, or disk utilization breaches safe thresholds."),
    "REL-CHK-203": ("Automated synthetic canary monitoring on critical user journey endpoints", "Regularly validates end-to-end availability and API response latency using Cloud Monitoring uptime checks."),
    "REL-CHK-301": ("Cloud Pub/Sub subscription missing configured Dead Letter Topic", "Asynchronous messaging subscriptions do not have dead-letter routing configured, leading to continuous redelivery attempts."),
    "REL-CHK-302": ("Exponential backoff and retry jitter implemented in Google Cloud client libraries", "Prevents thundering herd problems and cascading failures against downstream GCP APIs."),
    "REL-CHK-401": ("Cross-region automated backups configured for Cloud SQL and Spanner", "Guarantees database survivability and point-in-time restore across secondary Google Cloud regions."),
    "REL-CHK-402": ("Dual-region / Multi-region Cloud Storage buckets configured with Turbo Replication", "Replicates storage bucket objects across geographically separated regions within a 15-minute SLA."),
    "REL-CHK-403": ("Documented Recovery Time Objective (RTO < 1h) and RPO validated via automated drills", "Ensures recovery procedures are tested and meet strict organizational business continuity SLAs."),

    "SEC-047": ("IAM Service Account granted broad Owner/Editor role on project", "Compute Engine and GKE service accounts are granted overly permissive Owner or Editor roles across the GCP project."),
    "SEC-CHK-102": ("Service account keys unused for 90+ days disabled or deleted", "Stale user-managed service account keys pose lingering risks of credential leakage and unauthorized access."),
    "SEC-CHK-103": ("2-Step Verification (2SV) enforced for all Google Cloud admin accounts", "Eliminates single-factor credential stuffing vulnerabilities across administrative accounts."),
    "SEC-CHK-104": ("Organization Administrator role count minimized and Privileged Access Manager enabled", "Ensures just-in-time privilege escalation with mandatory approval workflows."),
    "SEC-061": ("VPC firewall rule allows unrestricted ingress on SSH port 22 (0.0.0.0/0)", "VPC ingress firewall rules expose port 22 directly to public IP ranges without Identity-Aware Proxy (IAP) or VPN restrictions."),
    "SEC-CHK-202": ("Cloud Armor DDoS & WAF security policies attached to external HTTPS load balancers", "Mitigates OWASP Top 10 web vulnerabilities including SQLi, XSS, and command injection at the ingress tier."),
    "SEC-CHK-203": ("VPC Flow Logs enabled on all subnets and exported to Cloud Logging", "Captures IP traffic passing through network interfaces for forensic audit and threat hunting."),
    "SEC-024": ("Cloud Storage bucket has uniform bucket-level access disabled and public read enabled", "Cloud Storage buckets hosting sensitive data do not enforce uniform bucket-level access and permit anonymous public read access via allUsers."),
    "SEC-CHK-302": ("Customer-Managed Encryption Keys (CMEK) enabled with Cloud KMS", "Guarantees complete organization cryptographic governance and key lifecycle ownership via Cloud KMS."),
    "SEC-CHK-303": ("TLS 1.3 enforced on Cloud Load Balancing HTTPS proxies", "Disables deprecated TLS 1.0/1.1 cipher suites and enforces strict modern encryption in transit."),
    "SEC-033": ("Cloud KMS crypto keys do not have automated rotation enabled", "Cryptographic keys stored in Cloud KMS lack automated 90-day rotation schedules, increasing blast radius in the event of credential leakage."),
    "SEC-CHK-402": ("Security Command Center (SCC) Premium threat detection enabled for project", "Provides continuous security posture management (CSPM) and real-time workload threat detection."),
    "SEC-CHK-403": ("Organization Policy constraints (e.g., restrictPublicIp, uniformBucketLevelAccess) enforced", "Applies automated organization-level guardrails preventing deployment of insecure cloud resources."),

    "COST-008": ("Unattached persistent disks incurring unnecessary storage costs", "Persistent disks left detached after GCE instance or GKE node pool deletion continue to accrue storage fees."),
    "COST-CHK-102": ("Unused static external IP addresses released to prevent idle reservation fees", "Static external IP addresses not assigned to running instances continue billing hourly idle reservation rates."),
    "COST-CHK-103": ("Automated snapshot lifecycle policies configured to purge outdated disk backups", "Retains only recent incremental snapshots and automatically purges backups older than retention policy."),
    "COST-CHK-201": ("Cloud Storage Object Lifecycle Management active for Nearline/Coldline transitions", "Automatically migrates infrequent access objects to Nearline and Coldline storage tiers to minimize expense."),
    "COST-CHK-202": ("Tau T2A (Ampere Altra ARM) compute instances evaluated for compute workloads", "Adopts energy-efficient ARM-based architectures providing up to 50% better price-performance."),
    "COST-CHK-203": ("Compute Engine Autoscaler tuned with predictive autoscaling to minimize waste", "Utilizes metric-driven scale-in rules to scale compute down during off-peak hours."),
    "COST-CHK-301": ("Committed Use Discounts (CUDs) compute coverage is at 42% (recommended: 70%)", "Steady-state workload baseline compute is paid at higher on-demand rates instead of discounted commitments."),
    "COST-CHK-302": ("Cloud Billing budget alerts and anomaly notifications active", "Automated anomaly detection identifies unplanned budget consumption and anomalous resource spikes."),

    "OPS-014": ("Cloud Logging log sinks missing for administrative activity audit logs", "GCP project lacks centralized BigQuery/Storage log sinks configured to aggregate administrative activity audit logs."),
    "OPS-CHK-102": ("Structured JSON logging enabled across all containerized workloads", "Standardizes application telemetry schemas for rich queryability in Cloud Logging and Log Analytics."),
    "OPS-CHK-103": ("Cloud Trace distributed tracing integrated across microservices", "Ensures cloud-agnostic telemetry ingestion with vendor-neutral distributed tracing standards."),
    "OPS-CHK-201": ("Cloud Build / GitHub Actions deployment pipelines require automated quality gates", "Blocks promotion of code containing unit test failures, lint errors, or security vulnerabilities."),
    "OPS-CHK-202": ("Traffic splitting canary deployments enabled on Cloud Run and GKE", "Enables zero-downtime releases and rapid instantaneous rollback capabilities."),
    "OPS-CHK-203": ("Infrastructure defined entirely via version-controlled Terraform templates", "Enforces immutable infrastructure patterns and prevents manual drift through Google Cloud Console."),
    "OPS-CHK-301": ("Cloud Monitoring alerting policies missing notification channels and incident runbooks", "Alerting policies do not trigger automated Pub/Sub incident webhooks or notify on-call engineers."),
    "OPS-CHK-302": ("Post-Incident Review (PIR) retrospectives and action items tracked to completion", "Formalizes blameless incident reviews and incorporates preventative architectural improvements."),

    "PERF-CHK-101": ("Cloud CDN enabled for global edge delivery with Brotli caching", "Caches static assets at Google edge PoPs to drastically reduce round-trip latency and origin load."),
    "PERF-CHK-102": ("Memorystore for Redis cluster caching frequently queried database records", "Maintains high-throughput, sub-millisecond in-memory cache for session data and frequent database reads."),
    "PERF-CHK-103": ("Latest generation C3/N4 compute instance families utilized for workloads", "Deploys compute instances on modern Intel Xeon and Titanium offload cards for optimal compute density."),
    "PERF-CHK-201": ("Cloud CDN not enabled on external HTTP(S) load balancer backend service", "External HTTP(S) Load Balancer backend service lacks Cloud CDN enablement, resulting in high latency for global clients."),
    "PERF-CHK-202": ("Hyperdisk Balanced / Extreme provisioned IOPS matched to database IO peaks", "Prevents I/O bottlenecks on database workloads by matching provisioned disk performance to application IOPS peaks."),
    "PERF-CHK-203": ("Tier_1 networking performance enabled on Compute Engine instances", "Achieves up to 100 Gbps network bandwidth with ultra-low latency inter-VM networking."),
}

def seed_cloud_checks():
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    print(f"Connecting to MongoDB at {MONGO_URI} [db: {DB_NAME}]...")

    json_path = os.path.join(os.path.dirname(__file__), "platform_data_dump.json")
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    all_checks = []
    
    # 1. AWS Checks
    for p in data.get("pillars", []):
        for bp in p.get("bestPractices", []):
            for c in bp.get("checks", []):
                all_checks.append({
                    "id": c.get("id"),
                    "pillar_id": p.get("id"),
                    "best_practice_id": bp.get("id"),
                    "title": c.get("title"),
                    "description": c.get("description"),
                    "severity": c.get("severity", "medium").lower(),
                    "status": c.get("status", "pass"),
                    "effort": c.get("effort", "Medium"),
                    "cloud_provider": "aws",
                })

    # 2. Azure Checks
    for p in data.get("pillars", []):
        for bp in p.get("bestPractices", []):
            for c in bp.get("checks", []):
                chk_id = c.get("id")
                override = AZURE_CHECKS_OVERRIDE.get(chk_id)
                title = override[0] if override else c.get("title")
                desc = override[1] if override else c.get("description")
                all_checks.append({
                    "id": chk_id,
                    "pillar_id": p.get("id"),
                    "best_practice_id": bp.get("id"),
                    "title": title,
                    "description": desc,
                    "severity": c.get("severity", "medium").lower(),
                    "status": c.get("status", "pass"),
                    "effort": c.get("effort", "Medium"),
                    "cloud_provider": "azure",
                })

    # 3. GCP Checks
    for p in data.get("pillars", []):
        for bp in p.get("bestPractices", []):
            for c in bp.get("checks", []):
                chk_id = c.get("id")
                override = GCP_CHECKS_OVERRIDE.get(chk_id)
                title = override[0] if override else c.get("title")
                desc = override[1] if override else c.get("description")
                all_checks.append({
                    "id": chk_id,
                    "pillar_id": p.get("id"),
                    "best_practice_id": bp.get("id"),
                    "title": title,
                    "description": desc,
                    "severity": c.get("severity", "medium").lower(),
                    "status": c.get("status", "pass"),
                    "effort": c.get("effort", "Medium"),
                    "cloud_provider": "gcp",
                })

    db["checks"].drop()
    db["checks"].insert_many(all_checks)
    print(f"[OK] Successfully seeded {len(all_checks)} cloud-specific checks (AWS: 46, Azure: 46, GCP: 46) into 'checks' collection.")

if __name__ == "__main__":
    seed_cloud_checks()
