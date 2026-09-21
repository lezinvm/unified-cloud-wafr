import { Severity } from '../components/FindingUI';

export interface CheckItem {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  status: 'fail' | 'pass';
  effort?: 'Low' | 'Medium' | 'High';
}

export interface BestPractice {
  id: string;
  title: string;
  description: string;
  status: 'fail' | 'pass';
  checks: CheckItem[];
}

export interface PillarData {
  id: string;
  label: string;
  short: string;
  score: number;
  color: string;
  bestPractices: BestPractice[];
}

export const PILLARS_DATA: PillarData[] = [
  {
    id: 'reliability',
    label: 'Reliability',
    short: 'R',
    score: 88,
    color: '#3B82F6',
    bestPractices: [
      {
        id: 'REL-01',
        title: 'How do you design your workload service architecture?',
        description: 'Adopt distributed service architectures and loosely coupled components to withstand component degradation.',
        status: 'pass',
        checks: [
          {
            id: 'REL-CHK-101',
            title: 'ALB cross-zone load balancing enabled across all targets',
            description: 'Ensures even traffic distribution across multiple Availability Zones to prevent target overload.',
            severity: 'low',
            status: 'pass',
          },
          {
            id: 'REL-CHK-102',
            title: 'Multi-AZ redundancy enabled for production RDS & Aurora clusters',
            description: 'Automates synchronous standby replication for rapid failover during AZ outages.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'REL-CHK-103',
            title: 'Route 53 latency-based DNS routing configured for failover',
            description: 'Routes end users to the healthiest and lowest-latency region automatically.',
            severity: 'medium',
            status: 'pass',
          },
        ],
      },
      {
        id: 'REL-02',
        title: 'How do you monitor workload resources to prevent degradation?',
        description: 'Implement real-time health checks, metrics, and automated alerts on all ingress and compute paths.',
        status: 'fail',
        checks: [
          {
            id: 'REL-019',
            title: 'ALB target group missing active health check configuration',
            description: 'Target groups without active health checks will route live traffic to unhealthy or terminated instances.',
            severity: 'high',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'REL-CHK-202',
            title: 'CloudWatch alarms configured for CPU, memory, and disk IOPS thresholds',
            description: 'Sends automated P1/P2 paging notifications when utilization spikes beyond 80%.',
            severity: 'medium',
            status: 'pass',
          },
          {
            id: 'REL-CHK-203',
            title: 'Automated synthetic canary monitoring on critical API endpoints',
            description: 'Continuously validates login and checkout user journeys every 60 seconds.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
      {
        id: 'REL-03',
        title: 'How do you design distributed systems to mitigate cascading failures?',
        description: 'Use queues, throttling, dead-letter queues, and graceful degradation for resilient messaging.',
        status: 'fail',
        checks: [
          {
            id: 'REL-CHK-301',
            title: 'SQS Dead Letter Queue (DLQ) missing for asynchronous order processing queue',
            description: 'Poison-pill messages can stall consumer workers indefinitely without a configured dead-letter queue.',
            severity: 'medium',
            status: 'fail',
            effort: 'Medium',
          },
          {
            id: 'REL-CHK-302',
            title: 'Exponential backoff and retry jitter implemented in microservice clients',
            description: 'Prevents thundering herd problems when downstream services recover from blips.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
      {
        id: 'REL-04',
        title: 'How do you plan for disaster recovery (DR)?',
        description: 'Establish automated backups, cross-region replication, and validated recovery objectives.',
        status: 'pass',
        checks: [
          {
            id: 'REL-CHK-401',
            title: 'Cross-region automated snapshot copying configured for PostgreSQL databases',
            description: 'Preserves daily incremental backups in a secondary geographic region.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'REL-CHK-402',
            title: 'S3 Cross-Region Replication (CRR) active with versioning for critical storage',
            description: 'Protects critical business documents against regional storage partition failures.',
            severity: 'medium',
            status: 'pass',
          },
          {
            id: 'REL-CHK-403',
            title: 'Documented Recovery Time Objective (RTO < 1h) and RPO (< 15m) validation',
            description: 'Regular automated drills verify restore times against business SLAs.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    short: 'S',
    score: 72,
    color: '#FB7185',
    bestPractices: [
      {
        id: 'SEC-01',
        title: 'How do you manage identities and permissions for people and machines?',
        description: 'Apply principle of least privilege, enforce multi-factor authentication, and rotate machine credentials.',
        status: 'fail',
        checks: [
          {
            id: 'SEC-047',
            title: 'IAM role with wildcard resource permission (*) on S3 and DynamoDB',
            description: 'Production worker role grants overly permissive Action: * on sensitive data stores.',
            severity: 'critical',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'SEC-CHK-102',
            title: 'IAM credentials and access keys unused for 90+ days deactivated',
            description: 'Stale access keys pose an unauthorized credential harvesting vector.',
            severity: 'medium',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'SEC-CHK-103',
            title: 'MFA enforced for all console and IAM administrative users',
            description: 'Hardware or TOTP virtual MFA is mandated on all privileged login sessions.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'SEC-CHK-104',
            title: 'Root account access keys deleted and hardware MFA enabled',
            description: 'Root credentials are locked in a vault with no active API keys present.',
            severity: 'critical',
            status: 'pass',
          },
        ],
      },
      {
        id: 'SEC-02',
        title: 'How do you protect network boundaries and traffic?',
        description: 'Layer network perimeters, restrict ingress rules, and inspect inbound traffic via WAF.',
        status: 'fail',
        checks: [
          {
            id: 'SEC-061',
            title: 'Security group allows open ingress 0.0.0.0/0 on port 22 (SSH)',
            description: 'Public bastion security group exposes SSH to the global internet without VPN restriction.',
            severity: 'high',
            status: 'fail',
            effort: 'Medium',
          },
          {
            id: 'SEC-CHK-202',
            title: 'AWS WAF attached to public Application Load Balancers',
            description: 'Inspects web traffic with AWS managed rule sets against SQLi and XSS exploits.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'SEC-CHK-203',
            title: 'VPC Flow Logs enabled and delivered to centralized S3 security bucket',
            description: 'Captures IP traffic metadata for continuous forensic analysis.',
            severity: 'medium',
            status: 'pass',
          },
        ],
      },
      {
        id: 'SEC-03',
        title: 'How do you classify and protect data at rest and in transit?',
        description: 'Enforce ubiquitous cryptographic protection, KMS key rotation, and strict transport layer security.',
        status: 'fail',
        checks: [
          {
            id: 'SEC-024',
            title: 'S3 bucket missing server access logging and object lock protection',
            description: 'Audit trails and immutability are disabled on customer telemetry storage.',
            severity: 'high',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'SEC-CHK-302',
            title: 'Default EBS volume encryption enabled using AWS KMS Customer Managed Keys',
            description: 'All newly provisioned block volumes are encrypted at rest with CMK envelope keys.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'SEC-CHK-303',
            title: 'TLS 1.3 enforced on CloudFront distributions and ALB listeners',
            description: 'Modern cipher suites are enforced with SSLv3 and TLS 1.0/1.1 disabled.',
            severity: 'high',
            status: 'pass',
          },
        ],
      },
      {
        id: 'SEC-04',
        title: 'How do you detect and investigate security events?',
        description: 'Aggregate audit trails, enable continuous threat detection, and automate incident dispatch.',
        status: 'fail',
        checks: [
          {
            id: 'SEC-033',
            title: 'AWS CloudTrail multi-region logging not enabled in secondary active regions',
            description: 'API calls in us-west-2 and eu-west-1 are not captured in the master audit trail.',
            severity: 'medium',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'SEC-CHK-402',
            title: 'Amazon GuardDuty threat detection enabled across all active regions',
            description: 'Uses machine learning to identify anomalous DNS queries and unauthorized IAM activity.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'SEC-CHK-403',
            title: 'AWS Security Hub standards (CIS Benchmark & AWS Foundational) activated',
            description: 'Aggregates security findings across all organizational accounts.',
            severity: 'medium',
            status: 'pass',
          },
        ],
      },
    ],
  },
  {
    id: 'cost',
    label: 'Cost Optimization',
    short: 'C',
    score: 91,
    color: '#34D399',
    bestPractices: [
      {
        id: 'COST-01',
        title: 'How do you de-provision unneeded resources and avoid waste?',
        description: 'Audit idle storage, unattached elastic IPs, and orphaned snapshots on a recurring schedule.',
        status: 'fail',
        checks: [
          {
            id: 'COST-008',
            title: '14 unattached EBS volumes incurring idle monthly charges ($342/mo)',
            description: 'Detached volumes left over from terminated EC2 instances continue billing at provisioned rates.',
            severity: 'medium',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'COST-CHK-102',
            title: 'Idle Elastic IP addresses not attached to running instances released',
            description: 'Unallocated public IPv4 addresses have been released to avoid hourly idle surcharges.',
            severity: 'low',
            status: 'pass',
          },
          {
            id: 'COST-CHK-103',
            title: 'Automated lifecycle cleanup for outdated EBS snapshots older than 90 days',
            description: 'Snapshots are pruned according to data governance retention rules.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
      {
        id: 'COST-02',
        title: 'How do you evaluate cost when selecting and rightsizing services?',
        description: 'Leverage modern tiering, ARM64 architecture, and dynamic autoscaling to minimize baseline spend.',
        status: 'pass',
        checks: [
          {
            id: 'COST-CHK-201',
            title: 'S3 Lifecycle transition policies active for infrequent access & Glacier',
            description: 'Objects older than 30 days automatically move to Glacier Instant Retrieval.',
            severity: 'medium',
            status: 'pass',
          },
          {
            id: 'COST-CHK-202',
            title: 'Graviton3 (ARM64) instance families evaluated and deployed for container workloads',
            description: 'Delivers up to 25% better compute price-performance over comparable x86 instances.',
            severity: 'low',
            status: 'pass',
          },
          {
            id: 'COST-CHK-203',
            title: 'Auto-scaling dynamic scaling policies tuned to match real-time traffic demand',
            description: 'Target tracking policies scale down compute capacity during off-peak hours.',
            severity: 'high',
            status: 'pass',
          },
        ],
      },
      {
        id: 'COST-03',
        title: 'How do you manage pricing models and commitments?',
        description: 'Model workload baseline utilization and apply Savings Plans and Reserved Instances.',
        status: 'fail',
        checks: [
          {
            id: 'COST-CHK-301',
            title: 'Compute Savings Plans coverage is at 42% (recommended minimum: 70%)',
            description: 'On-Demand compute spend can be optimized by extending 1-year No Upfront Compute Savings Plans.',
            severity: 'medium',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'COST-CHK-302',
            title: 'AWS Cost Anomaly Detection monitors daily spend anomalies with Slack alerts',
            description: 'Automated machine learning identifies unexpected spend spikes within 24 hours.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
    ],
  },
  {
    id: 'operational-excellence',
    label: 'Operational Excellence',
    short: 'O',
    score: 82,
    color: '#FBBF24',
    bestPractices: [
      {
        id: 'OPS-01',
        title: 'How do you understand workload health and telemetry?',
        description: 'Define telemetry standards, centralized log aggregation, and automated recovery procedures.',
        status: 'fail',
        checks: [
          {
            id: 'OPS-014',
            title: 'No automated backup retention policy configured for Amazon RDS instances',
            description: 'Backup window and automated snapshot retention are not enforced via AWS Backup policy.',
            severity: 'medium',
            status: 'fail',
            effort: 'Medium',
          },
          {
            id: 'OPS-CHK-102',
            title: 'Structured JSON logging enabled across all backend microservices',
            description: 'Standardized schemas enable rapid query parsing in OpenSearch and CloudWatch Insights.',
            severity: 'low',
            status: 'pass',
          },
          {
            id: 'OPS-CHK-103',
            title: 'OpenTelemetry distributed tracing integrated across API gateways',
            description: 'Traces request journeys end-to-end through message queues and microservices.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
      {
        id: 'OPS-02',
        title: 'How do you reduce deployment friction and operational risk?',
        description: 'Use Infrastructure as Code, CI/CD pipelines, and automated rollback strategies.',
        status: 'pass',
        checks: [
          {
            id: 'OPS-CHK-201',
            title: 'CI/CD deployment pipelines require automated pre-merge testing & linting',
            description: 'Prevents defective build artifacts from reaching production environments.',
            severity: 'medium',
            status: 'pass',
          },
          {
            id: 'OPS-CHK-202',
            title: 'Blue/Green canary deployment strategy enabled on Amazon ECS Fargate services',
            description: 'Routes 10% canary traffic before committing 100% of live workload traffic.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'OPS-CHK-203',
            title: 'Infrastructure defined entirely via version-controlled Terraform modules',
            description: 'No manual console modifications are permitted in production VPCs.',
            severity: 'high',
            status: 'pass',
          },
        ],
      },
      {
        id: 'OPS-03',
        title: 'How do you evolve operations and respond to incidents?',
        description: 'Maintain actionable runbooks, automate post-mortems, and test incident escalation paths.',
        status: 'fail',
        checks: [
          {
            id: 'OPS-CHK-301',
            title: 'Incident runbooks not linked to critical CloudWatch alarm notifications',
            description: 'On-call engineers lack immediate step-by-step remediation links inside alert payloads.',
            severity: 'low',
            status: 'fail',
            effort: 'Low',
          },
          {
            id: 'OPS-CHK-302',
            title: 'Post-Incident Review (PIR) retrospectives and action tracking documented',
            description: 'Action items from outages are tracked in Jira with mandatory SLA closure.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
    ],
  },
  {
    id: 'performance-efficiency',
    label: 'Performance Efficiency',
    short: 'P',
    score: 80,
    color: '#3B82F6',
    bestPractices: [
      {
        id: 'PERF-01',
        title: 'How do you select the best performing architecture?',
        description: 'Utilize edge caching, dedicated in-memory data tiers, and optimized compute instances.',
        status: 'pass',
        checks: [
          {
            id: 'PERF-CHK-101',
            title: 'CloudFront CDN configured for global caching of static assets and API responses',
            description: 'Reduces latency by terminating TLS and caching dynamic responses at 450+ edge PoPs.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'PERF-CHK-102',
            title: 'ElastiCache Redis cluster caching frequent database read queries',
            description: 'Offloads high-frequency read queries to sub-millisecond in-memory cache.',
            severity: 'high',
            status: 'pass',
          },
          {
            id: 'PERF-CHK-103',
            title: 'Modern 6th/7th generation EC2 instance families utilized for core compute',
            description: 'Replaced legacy c4/m4 instances with nitro-based c6i/m6i compute nodes.',
            severity: 'medium',
            status: 'pass',
          },
        ],
      },
      {
        id: 'PERF-02',
        title: 'How do you monitor and optimize compute & data performance?',
        description: 'Identify data bottlenecks, scale read operations, and optimize storage IOPS.',
        status: 'fail',
        checks: [
          {
            id: 'PERF-CHK-201',
            title: 'RDS database read replica missing for high-volume analytics queries',
            description: 'Heavy reporting queries run against the primary DB writer, causing CPU contention.',
            severity: 'high',
            status: 'fail',
            effort: 'Medium',
          },
          {
            id: 'PERF-CHK-202',
            title: 'EBS volume provisioned IOPS (gp3) configured for optimal disk throughput',
            description: 'Allocated 3,000 IOPS and 125 MB/s throughput independently of storage capacity.',
            severity: 'medium',
            status: 'pass',
          },
          {
            id: 'PERF-CHK-203',
            title: 'Enhanced networking (ENA) and jumbo frames active on internal VPC links',
            description: 'Maximizes packet throughput between compute clusters and distributed storage.',
            severity: 'low',
            status: 'pass',
          },
        ],
      },
    ],
  },
];
