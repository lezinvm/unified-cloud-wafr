export interface ManualCheckItem {
  id: string;
  label: string;
  verified: boolean;
  guidance?: string;
}

export interface QuestionInfoGuidance {
  whyItMatters: string;
  howToVerify: string[];
  auditEvidence: string;
  frameworkRef: string;
}

export interface QuestionnaireItem {
  id: string;
  scope: 'account' | 'organization';
  cat: string;
  q: string;
  desc: string;
  answered: boolean;
  ans?: string;
  manualChecks?: ManualCheckItem[];
  info?: QuestionInfoGuidance;
}

export const INITIAL_ORG_QUESTIONS: QuestionnaireItem[] = [
  {
    id: 'ORG-01',
    scope: 'organization',
    cat: 'Security & Governance',
    q: 'How does the organization enforce Service Control Policies (SCPs) and Landing Zone guardrails?',
    desc: 'Preventive guardrails across multi-account hierarchy, region restrictions, and root lockouts.',
    answered: true,
    ans: 'AWS Organizations with AWS Control Tower enforces foundational SCPs denying unauthorized regions, root user usage, and public S3 bucket creation across all member accounts.',
    info: {
      frameworkRef: 'AWS WAFR: SEC-02 · Azure Management Groups · GCP Resource Manager',
      whyItMatters: 'Centralized SCPs prevent member accounts from altering security baselines, enabling programmatic compliance at enterprise scale.',
      howToVerify: [
        'Open AWS Organizations > Policies > Service control policies (or Azure Policy initiative definitions).',
        'Verify SCPs denying unapproved regions, disabling CloudTrail/Activity Logs, and preventing public storage bucket creation.',
        'Validate that root user accounts have no active programmatic access keys and hardware MFA is enforced.',
      ],
      auditEvidence: 'AWS Organizations SCP JSON policy attachments list and Control Tower guardrail status report.',
    },
    manualChecks: [
      {
        id: 'ORG-01-MC1',
        label: 'Service Control Policies (SCPs) active across all member accounts enforcing region & service restrictions',
        verified: true,
        guidance: 'Verify SCP attachments in AWS Organizations root / OU levels or Azure Management Group policies',
      },
      {
        id: 'ORG-01-MC2',
        label: 'Root user account access restricted with hardware MFA and automated security alarm notifications',
        verified: true,
        guidance: 'Inspect IAM Credential Report for root user last activity and verify SNS alarm on root login',
      },
    ],
  },
  {
    id: 'ORG-02',
    scope: 'organization',
    cat: 'Security & Auditing',
    q: 'How is centralized audit logging and SIEM integration configured across accounts?',
    desc: 'Aggregated CloudTrail logs, central Log Archive account, and real-time security alerts.',
    answered: true,
    ans: 'Organization-wide CloudTrail logs and VPC Flow Logs are replicated to a dedicated secure Log Archive account with SIEM ingestion.',
    info: {
      frameworkRef: 'AWS WAFR: SEC-04 · Centralized Audit Architecture',
      whyItMatters: 'Centralizing audit telemetry in an immutable, restricted-access account prevents tampering during security incidents and enables comprehensive cross-account forensic investigation.',
      howToVerify: [
        'Verify organization trail in master account sending logs to a dedicated Log Archive S3 bucket.',
        'Confirm destination S3 bucket has Object Lock (WORM compliance) and MFA Delete enabled.',
        'Check connector status for enterprise SIEM (Datadog, Splunk, Microsoft Sentinel) streaming cross-account audit events.',
      ],
      auditEvidence: 'Organization CloudTrail configuration export and SIEM ingestion heartbeat dashboard screenshot.',
    },
    manualChecks: [
      {
        id: 'ORG-02-MC1',
        label: 'Immutable log archive bucket configured with Object Lock (WORM) & MFA Delete enabled',
        verified: true,
        guidance: 'Inspect central S3 / Blob storage compliance settings in dedicated Log Archive account',
      },
      {
        id: 'ORG-02-MC2',
        label: 'SIEM connector (Datadog / Splunk / Sentinel) actively streaming cross-account telemetry and alarms',
        verified: true,
        guidance: 'Confirm active data stream ingestion rate and real-time alerting rule triggers',
      },
    ],
  },
  {
    id: 'ORG-03',
    scope: 'organization',
    cat: 'Cost Optimization',
    q: 'How does the organization manage centralized budgets, cost allocation tags, and showback/chargeback?',
    desc: 'Enterprise tagging policies, AWS Cost Categories, and centralized consolidated billing governance.',
    answered: true,
    ans: 'AWS Cost Categories and mandatory Cost Center tagging policies enforced via AWS Organizations with monthly budget threshold alerts sent to Slack.',
    info: {
      frameworkRef: 'AWS WAFR: COST-01 & COST-02 · FinOps Foundation Standards',
      whyItMatters: 'Standardized cost allocation tags and automated budget notifications foster engineering accountability, eliminate orphaned resource waste, and prevent budget overruns.',
      howToVerify: [
        'Inspect Tag Policies in AWS Organizations for mandatory tags (Environment, Owner, CostCenter, Project).',
        'Verify AWS Budgets threshold alerts connected to finance and engineering Slack / email distribution channels.',
        'Review Cost Categories and monthly FinOps unit economics reporting hierarchy.',
      ],
      auditEvidence: 'AWS Tag Policy compliance report and AWS Budgets threshold notification settings export.',
    },
    manualChecks: [
      {
        id: 'ORG-03-MC1',
        label: 'Mandatory organizational cost tags enforced via Tag Policies (Owner, CostCenter, Env, Project)',
        verified: true,
        guidance: 'Inspect Tag Policies under AWS Organizations console or Azure Policy tag governance',
      },
      {
        id: 'ORG-03-MC2',
        label: 'Consolidated billing budget alerts configured with multi-tiered notification thresholds (80%, 100%)',
        verified: true,
        guidance: 'Verify AWS Budgets or Azure Cost Management threshold alerts routed to finance channels',
      },
    ],
  },
  {
    id: 'ORG-04',
    scope: 'organization',
    cat: 'Operational Excellence',
    q: 'How are organization-wide disaster recovery and incident escalation runbooks standardized?',
    desc: 'Cross-account disaster recovery SLAs, enterprise on-call rotations, and executive post-mortem reviews.',
    answered: true,
    ans: 'P1 disaster recovery runbooks with cross-region replication SLAs (RPO < 15 min, RTO < 1 hour) and bi-weekly PagerDuty on-call drill reviews.',
    info: {
      frameworkRef: 'AWS WAFR: OPS-10 & REL-13 · Enterprise Incident Management',
      whyItMatters: 'Well-rehearsed disaster recovery procedures and clear escalation hierarchies guarantee predictable, rapid operational response during major enterprise disruptions.',
      howToVerify: [
        'Review the enterprise incident severity matrix (P1–P4) and on-call paging rotations in PagerDuty / Opsgenie.',
        'Verify cross-region backup replication schedules, RPO/RTO validation tests, and annual DR exercise sign-offs.',
        'Confirm Post-Incident Review (PIR) template and central repository in Confluence / Notion.',
      ],
      auditEvidence: 'Annual DR Exercise Signoff document and post-incident review (PIR) archive.',
    },
    manualChecks: [
      {
        id: 'ORG-04-MC1',
        label: 'Standardized incident severity matrix (P1–P4) with documented paging rotations and SLAs',
        verified: true,
        guidance: 'Review runbook repository and escalation ladder in on-call management tooling',
      },
      {
        id: 'ORG-04-MC2',
        label: 'Annual enterprise DR game day or cross-region failover drill conducted and formally documented',
        verified: true,
        guidance: 'Review sign-off report and recovery timeline from the most recent failover drill',
      },
    ],
  },
  {
    id: 'ORG-05',
    scope: 'organization',
    cat: 'Compliance & Standards',
    q: 'Which organizational compliance frameworks and data residency standards are mandated across accounts?',
    desc: 'Enterprise compliance baselines (SOC2, ISO 27001, HIPAA, PCI-DSS) and sovereign boundary controls.',
    answered: false,
    ans: 'SOC 2 Type II and ISO 27001 compliance standards are enforced organization-wide using AWS Security Hub and AWS Config conformance packs across all member accounts.',
    info: {
      frameworkRef: 'AWS WAFR: SEC-01 · Enterprise Compliance & Risk Management',
      whyItMatters: 'Embedding mandated regulatory standards into automated guardrails early prevents costly compliance remediation and guarantees sovereign data boundaries.',
      howToVerify: [
        'Inspect automated compliance monitoring in AWS Security Hub / Microsoft Defender for Cloud / GCP Security Command Center.',
        'Confirm continuous compliance scoring against CIS Benchmarks and SOC 2 / ISO 27001 standards.',
        'Verify data residency boundaries preventing data replication outside designated sovereign jurisdictions.',
      ],
      auditEvidence: 'Security Hub CIS Benchmark score export or third-party compliance audit certificate.',
    },
    manualChecks: [
      {
        id: 'ORG-05-MC1',
        label: 'Automated continuous compliance monitoring enabled (Security Hub / Defender for Cloud / AWS Config)',
        verified: false,
        guidance: 'Check Security Hub standards activation (CIS AWS Foundations Benchmark & AWS Foundational Best Practices)',
      },
      {
        id: 'ORG-05-MC2',
        label: 'Data sovereignty and geographic boundary restrictions formally documented and enforced',
        verified: false,
        guidance: 'Review SCP region restrictions and database backup replication target regions',
      },
    ],
  },
];
