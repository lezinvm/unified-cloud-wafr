import { useState, useEffect } from 'react';
import { useApp, Cloud } from '../context';
import { AwsWordmark, AzureMark, GcpMark, CloudifyOpsSymbol } from '../components/CloudLogo';
import { INITIAL_ORG_QUESTIONS } from '../data/questionnaireData';

const STEPS = [
  { n: 1, label: 'Configure Cloud' },
  { n: 2, label: 'Client Questionnaire' },
  { n: 3, label: 'Review & Start' },
];

/* ── Cloud metadata & options ── */
const CLOUD_OPTIONS: { id: Cloud; label: string; short: string; accent: string; desc: string }[] = [
  { id: 'aws', label: 'Amazon Web Services', short: 'AWS', accent: '#FF9900', desc: 'IAM Role / Cross-Account WAF review' },
  { id: 'azure', label: 'Microsoft Azure', short: 'Azure', accent: '#0078D4', desc: 'Subscription / Service Principal review' },
  { id: 'gcp', label: 'Google Cloud Platform', short: 'GCP', accent: '#4285F4', desc: 'Project / Service Account review' },
];

const CLOUD_ACCOUNTS: Record<Cloud, { id: string; name: string; num: string; env: string; resources: string }[]> = {
  aws: [
    { id: 'acc-aws-01', name: 'acme-production', num: '124890123456', env: 'Production', resources: '1,204 resources' },
    { id: 'acc-aws-02', name: 'acme-staging', num: '987654321098', env: 'Staging', resources: '487 resources' },
    { id: 'acc-aws-03', name: 'acme-dev', num: '456789012345', env: 'Development', resources: '198 resources' },
  ],
  azure: [
    { id: 'acc-az-01', name: 'AcmeCorp-ProductionSub', num: 'sub-1248-9012', env: 'Production', resources: '892 resources' },
    { id: 'acc-az-02', name: 'AcmeCorp-DataSub', num: 'sub-4891-2394', env: 'Data Platform', resources: '512 resources' },
    { id: 'acc-az-03', name: 'AcmeCorp-CoreSub', num: 'sub-7712-9901', env: 'Shared Services', resources: '240 resources' },
  ],
  gcp: [
    { id: 'acc-gcp-01', name: 'acme-gcp-prod', num: 'proj-gcp-9941', env: 'Production', resources: '620 resources' },
    { id: 'acc-gcp-02', name: 'acme-gcp-staging', num: 'proj-gcp-4821', env: 'Staging', resources: '310 resources' },
    { id: 'acc-gcp-03', name: 'acme-gcp-dev', num: 'proj-gcp-1102', env: 'Development', resources: '150 resources' },
  ],
};

const CLOUD_REGIONS: Record<Cloud, { id: string; name: string; loc: string }[]> = {
  aws: [
    { id: 'us-east-1', name: 'US East (N. Virginia)', loc: 'Virginia, USA' },
    { id: 'us-east-2', name: 'US East (Ohio)', loc: 'Ohio, USA' },
    { id: 'us-west-2', name: 'US West (Oregon)', loc: 'Oregon, USA' },
    { id: 'eu-west-1', name: 'Europe (Ireland)', loc: 'Dublin, Ireland' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', loc: 'Singapore' },
  ],
  azure: [
    { id: 'eastus', name: 'East US', loc: 'Virginia, USA' },
    { id: 'westus2', name: 'West US 2', loc: 'Washington, USA' },
    { id: 'westeurope', name: 'West Europe', loc: 'Netherlands' },
    { id: 'northeurope', name: 'North Europe', loc: 'Ireland' },
    { id: 'southeastasia', name: 'Southeast Asia', loc: 'Singapore' },
  ],
  gcp: [
    { id: 'us-central1', name: 'Iowa', loc: 'Iowa, USA' },
    { id: 'us-east1', name: 'South Carolina', loc: 'S. Carolina, USA' },
    { id: 'europe-west1', name: 'Belgium', loc: 'Belgium, EU' },
    { id: 'asia-east1', name: 'Taiwan', loc: 'Taiwan' },
  ],
};

/* ── Questionnaire items with 2 distinct scopes ── */
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

const INITIAL_QUESTIONS: QuestionnaireItem[] = [
  // ── Account-Specific Questions with Manual Checks & Info ──
  {
    id: 'ACC-01',
    scope: 'account',
    cat: 'Reliability',
    q: 'How do you monitor the health and telemetry of this workload?',
    desc: 'Observability stack, custom health check endpoints, alarms, and tracing instrumentation.',
    answered: true,
    ans: 'We use CloudWatch dashboards with custom metrics and SNS alerts for P1/P2 severity. All microservices export traces via OpenTelemetry and logs to Datadog.',
    info: {
      frameworkRef: 'AWS WAFR: REL-06 · Azure WAF: Monitoring & Health Modeling',
      whyItMatters: 'Multi-layered observability enables engineering teams to proactively identify and remediate component degradation before end-users experience an outage.',
      howToVerify: [
        'Open CloudWatch / Azure Monitor and verify alarm thresholds on Error Rate (>1%), P99 Latency (>800ms), and 5xx responses.',
        'Validate that P1/P2 alarms dispatch to on-call paging mechanisms via SNS / Opsgenie / Slack.',
        'Confirm synthetic uptime canaries run continuously at <= 5-minute intervals against primary API endpoints.',
      ],
      auditEvidence: 'CloudWatch Alarm ARN list, APM service map export, and Synthetic Canary uptime dashboard screenshot.',
    },
    manualChecks: [
      {
        id: 'ACC-01-MC1',
        label: 'Synthetic canaries or ping health-checks configured for public API endpoints',
        verified: true,
        guidance: 'Verify AWS CloudWatch Synthetics canary status or Route 53 Health Checks',
      },
      {
        id: 'ACC-01-MC2',
        label: 'P1/P2 alarm notifications routed to real-time alerting channels (PagerDuty / Slack)',
        verified: true,
        guidance: 'Inspect SNS topic subscriptions and alarm action triggers',
      },
      {
        id: 'ACC-01-MC3',
        label: 'Distributed APM tracing sampling active on all ingress microservices',
        verified: true,
        guidance: 'Verify OpenTelemetry / AWS X-Ray daemon or agent telemetry streaming',
      },
    ],
  },
  {
    id: 'ACC-02',
    scope: 'account',
    cat: 'Security',
    q: 'How do you protect data at rest and in transit for resources in this account?',
    desc: 'Encryption keys management, TLS enforcement, and secure data storage policies.',
    answered: true,
    ans: 'AES-256 encryption at rest via AWS KMS Customer Managed Keys for all S3 buckets and RDS volumes. TLS 1.3 enforced on all ALB and CloudFront endpoints.',
    info: {
      frameworkRef: 'AWS WAFR: SEC-08 & SEC-09 · Azure Security Benchmark: DP-4',
      whyItMatters: 'Enforcing end-to-end encryption with rotated customer-managed keys protects sensitive tenant data from unauthorized physical or cryptographic exposure.',
      howToVerify: [
        'Check KMS Key Rotation status in AWS KMS console: Key Actions > Key Rotation > Enabled.',
        'Review S3 bucket policy statements for Condition: {"Bool": {"aws:SecureTransport": "false"}} Deny rules.',
        'Verify ALB SSL/TLS security policy uses ELBSecurityPolicy-TLS13-1-2-2021-06 or modern equivalent.',
      ],
      auditEvidence: 'KMS Key Rotation verification JSON, S3 Bucket Policy document, and RDS Storage Encrypted parameter export.',
    },
    manualChecks: [
      {
        id: 'ACC-02-MC1',
        label: 'KMS Customer Managed Keys (CMK) have automated annual key rotation enabled',
        verified: true,
        guidance: 'CLI: aws kms get-key-rotation-status --key-id <key-id>',
      },
      {
        id: 'ACC-02-MC2',
        label: 'Storage buckets & load balancer listeners enforce TLS 1.2+ minimum with HTTPS redirect',
        verified: true,
        guidance: 'Inspect S3 bucket policies for aws:SecureTransport denial and ALB HTTPS listeners',
      },
      {
        id: 'ACC-02-MC3',
        label: 'Database persistent storage volumes and automated snapshot backups are encrypted at rest',
        verified: true,
        guidance: 'Verify RDS/DynamoDB/EBS KMS encryption attribute in volume details',
      },
    ],
  },
  {
    id: 'ACC-03',
    scope: 'account',
    cat: 'Cost Optimization',
    q: 'How do you select instance sizing and compute pricing models for this account?',
    desc: 'Resource rightsizing, Compute Savings Plans, Spot/On-Demand allocations.',
    answered: true,
    ans: 'We use a mix of On-Demand for bursty workloads and 1-year Compute Savings Plans for baseline capacity. RDS instances are committed on 1-year Reserved Instances.',
    info: {
      frameworkRef: 'AWS WAFR: COST-06 & COST-07 · Azure Cost Management Framework',
      whyItMatters: 'Proactive rightsizing and commitment discounts eliminate cloud waste, ensuring budget allocation aligns directly with workload throughput.',
      howToVerify: [
        'Open AWS Compute Optimizer and filter EC2/RDS recommendations for "Over-provisioned".',
        'Review Cost Explorer Coverage tab to ensure steady-state compute has committed discount coverage > 70%.',
        'Query unattached volumes: aws ec2 describe-volumes --filters Name=status,Values=available.',
      ],
      auditEvidence: 'Compute Optimizer recommendations CSV, 30-day Cost Explorer coverage report, and DLM policy configuration.',
    },
    manualChecks: [
      {
        id: 'ACC-03-MC1',
        label: 'Compute instance rightsizing evaluated against CPU/Memory p95 metrics in trailing 14 days',
        verified: true,
        guidance: 'Check AWS Compute Optimizer / Azure Advisor under-utilization findings',
      },
      {
        id: 'ACC-03-MC2',
        label: '1-year or 3-year Savings Plans / Reserved Instances cover >70% of baseline compute',
        verified: true,
        guidance: 'Review AWS Cost Explorer Savings Plans utilization and coverage reports',
      },
      {
        id: 'ACC-03-MC3',
        label: 'Automated lifecycle policies clean up unattached EBS volumes and legacy snapshots (>90 days)',
        verified: true,
        guidance: 'Verify AWS Data Lifecycle Manager (DLM) or custom automation cleanup scripts',
      },
    ],
  },
  {
    id: 'ACC-04',
    scope: 'account',
    cat: 'Reliability',
    q: 'How do you design workload components to withstand Availability Zone outages?',
    desc: 'Multi-AZ database failover, auto-scaling groups across subnets, and load balancer distribution.',
    answered: true,
    ans: 'Multi-AZ deployments for all databases and stateless services across 2 availability zones with auto-scaling groups.',
    info: {
      frameworkRef: 'AWS WAFR: REL-07 & REL-10 · Azure Reliability: Fault Domain Isolation',
      whyItMatters: 'Redundancy across multiple Availability Zones isolates physical datacenter faults, guaranteeing zero-data-loss automated failover.',
      howToVerify: [
        'Inspect EC2 Auto Scaling Groups: ensure subnets in at least 2 distinct AZs are specified with balanced distribution.',
        'Verify Amazon RDS instance configuration has Multi-AZ = Enabled.',
        'Check ALB attributes to ensure cross-zone load balancing is enabled.',
      ],
      auditEvidence: 'RDS Multi-AZ console screenshot, ASG subnet configuration JSON, and ALB listener configuration.',
    },
    manualChecks: [
      {
        id: 'ACC-04-MC1',
        label: 'Compute clusters distributed evenly across a minimum of 2 separate Availability Zones',
        verified: true,
        guidance: 'Audit Auto Scaling Group VPC subnet distribution across az-a and az-b',
      },
      {
        id: 'ACC-04-MC2',
        label: 'Managed databases configured with automated failover Multi-AZ standby instances',
        verified: true,
        guidance: 'Verify Multi-AZ flag on RDS / Aurora cluster topology',
      },
      {
        id: 'ACC-04-MC3',
        label: 'Load balancers configured with cross-zone traffic balancing and aggressive health-check thresholds',
        verified: true,
        guidance: 'Inspect ALB target groups health-check intervals (15s) and unhealthy threshold (2)',
      },
    ],
  },
  {
    id: 'ACC-05',
    scope: 'account',
    cat: 'Operational Excellence',
    q: 'How are deployment pipelines, testing, and rollback strategies managed for this application?',
    desc: 'CI/CD automation, canary or blue/green deployments, and automated rollback triggers.',
    answered: false,
    ans: '',
    info: {
      frameworkRef: 'AWS WAFR: OPS-05 & OPS-07 · Azure DevOps Continuous Improvement',
      whyItMatters: 'Continuous integration testing and automated progressive rollouts prevent human configuration errors and minimize recovery times during failed releases.',
      howToVerify: [
        'Check CI/CD pipeline definition files for automated unit tests, vulnerability scanning, and approval gates.',
        'Review production deployment configuration (e.g. CodeDeploy deployment groups) for canary traffic shifting and rollback alarms.',
        'Check date and results of the most recent automated rollback simulation or drill.',
      ],
      auditEvidence: 'CI/CD pipeline execution history, CodeDeploy deployment group JSON, and quarterly rollback drill test report.',
    },
    manualChecks: [
      {
        id: 'ACC-05-MC1',
        label: 'Automated pipeline runs unit/security tests (SAST) prior to production deployment',
        verified: false,
        guidance: 'Verify GitLab CI / GitHub Actions pipeline YAML test and security stages',
      },
      {
        id: 'ACC-05-MC2',
        label: 'Canary or Blue/Green deployment strategy enabled with automated rollback triggers',
        verified: false,
        guidance: 'Inspect CodeDeploy / ArgoCD rollback alarms on HTTP 5xx errors',
      },
      {
        id: 'ACC-05-MC3',
        label: 'Documented emergency rollback runbook tested within the last quarter (<10 min MTTR)',
        verified: false,
        guidance: 'Review deployment runbook version history and drill record in Confluence',
      },
    ],
  },
  {
    id: 'ACC-06',
    scope: 'account',
    cat: 'Security',
    q: 'How are IAM privileged roles, least privilege policies, and credential lifecycles audited for this account?',
    desc: 'Root user protection, access key rotation periods, and temporary STS token adoption.',
    answered: true,
    ans: 'IAM access keys older than 90 days are automatically deactivated. Root account has hardware MFA with zero active access keys. EC2/EKS workloads utilize IAM Roles with short-lived tokens.',
    info: {
      frameworkRef: 'AWS WAFR: SEC-01 & SEC-03 · CIS AWS Foundations Benchmark 1.x',
      whyItMatters: 'Strict IAM hygiene and elimination of static credentials mitigates the primary attack vector for cloud account takeover.',
      howToVerify: [
        'Generate IAM credential report: aws iam get-credential-report.',
        'Verify root account has no access keys and MFA is enabled in IAM Dashboard.',
        'Verify EC2 instances require IMDSv2 (HttpTokens=required).',
      ],
      auditEvidence: 'IAM Credential Report CSV, IAM Dashboard MFA screenshot, and IMDSv2 configuration check.',
    },
    manualChecks: [
      {
        id: 'ACC-06-MC1',
        label: 'Root account has hardware/virtual MFA enabled and zero active access keys',
        verified: true,
        guidance: 'Inspect IAM Security Credentials page for Root user',
      },
      {
        id: 'ACC-06-MC2',
        label: 'IAM access keys older than 90 days are deactivated or migrated to IAM Roles',
        verified: true,
        guidance: 'Generate and review IAM Credential Report',
      },
      {
        id: 'ACC-06-MC3',
        label: 'EC2/EKS workloads utilize short-lived IAM Instance Profiles instead of long-lived credentials',
        verified: true,
        guidance: 'Audit instance metadata service (IMDSv2) token configuration and attached roles',
      },
    ],
  },
  {
    id: 'ACC-07',
    scope: 'account',
    cat: 'Performance',
    q: 'How are database query performance, indexing, and caching layers monitored and optimized?',
    desc: 'In-memory caching (Redis/Memcached), slow query telemetry, and read-replica distribution.',
    answered: true,
    ans: 'Amazon ElastiCache Redis cluster caches frequent read queries with 92% hit ratio. RDS Performance Insights monitors top SQL queries by wait state with alerts for execution spikes.',
    info: {
      frameworkRef: 'AWS WAFR: PERF-01 & PERF-05 · Azure Performance Best Practices',
      whyItMatters: 'Dedicated caching layers and performance telemetry eliminate database thread contention and prevent query latency degradation during traffic surges.',
      howToVerify: [
        'Open Amazon RDS console, select primary database, and confirm "Performance Insights" is turned On.',
        'Check ElastiCache / Redis metrics: verify CacheHitRate is consistently above 85%.',
        'Review database slow query log parameter group settings (log_min_duration_statement).',
      ],
      auditEvidence: 'RDS Performance Insights dashboard screenshot, Redis CacheHitRate metric graph, and parameter group export.',
    },
    manualChecks: [
      {
        id: 'ACC-07-MC1',
        label: 'ElastiCache / Redis caching layer implemented for high-frequency database read queries',
        verified: true,
        guidance: 'Inspect Redis cache cluster hit-ratio (>85%) in CloudWatch',
      },
      {
        id: 'ACC-07-MC2',
        label: 'Database slow query logging and Performance Insights active with threshold alerts',
        verified: true,
        guidance: 'Verify RDS Performance Insights enabled with retention period >= 7 days',
      },
      {
        id: 'ACC-07-MC3',
        label: 'Read-replicas configured to offload reporting and analytical queries from master DB',
        verified: true,
        guidance: 'Check RDS read-replica endpoint separation in application connection pool',
      },
    ],
  },

  // ── Organization-Specific Questions (Pre-configured prior to cloud selection) ──
  ...INITIAL_ORG_QUESTIONS,
];

const CAT_COLORS: Record<string, { bg: string; text: string }> = {
  'Reliability':          { bg: '#EFF6FF', text: '#2563EB' },
  'Security':             { bg: '#FFF1F2', text: '#E11D48' },
  'Cost Optimization':    { bg: '#ECFDF5', text: '#059669' },
  'Performance':          { bg: '#EFF6FF', text: '#2563EB' },
  'Operational Excellence':{ bg: '#FFFBEB', text: '#D97706' },
};

/* ── Shared Field for inputs ── */
const Field = ({ label, required, ...props }: { label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) => (
  <div>
    <label className="block text-xs font-medium mb-1.5 text-gray-600">
      {label}{required && <span className="ml-0.5 text-red-400">*</span>}
    </label>
    <input
      {...props}
      className="w-full px-3.5 py-2.5 rounded-xl text-sm outline-none transition-all border border-gray-200 bg-white text-gray-900 placeholder-gray-400"
      onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)'; }}
      onBlur={e => { e.target.style.borderColor = '#E5E9EF'; e.target.style.boxShadow = 'none'; }}
    />
  </div>
);

/* ── Step progress strip ── */
function StepProgress({ step }: { step: number }) {
  const { go } = useApp();
  const pct = Math.round(((step - 1) / (STEPS.length - 1)) * 100);
  return (
    <div className="bg-white border-b border-gray-100 px-8 py-4">
      {/* Label row */}
      <div className="flex items-center justify-between mb-2.5 text-xs font-medium" style={{ color: '#64748B' }}>
        <span>Step {step} of {STEPS.length} — {STEPS[step - 1].label}</span>
        <span style={{ color: '#10B981', fontWeight: 600 }}>{pct}%</span>
      </div>
      {/* Thin progress bar */}
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mb-4">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: '#34D399' }} />
      </div>
      {/* Step chips */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => go('org-questions')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors cursor-pointer"
          title="Review or edit Organisation-Specific Questions"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <span>Organisation Questions (Done)</span>
        </button>

        <div className="w-4 h-px bg-slate-200 hidden sm:block" />

        {STEPS.map((s, i) => {
          const done = s.n < step;
          const active = s.n === step;
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold transition-all"
                  style={done
                    ? { background: '#10B981', color: '#fff' }
                    : active
                    ? { background: '#2563EB', color: '#fff' }
                    : { background: '#F1F5F9', color: '#94A3B8' }
                  }
                >
                  {done ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  ) : (
                    s.n
                  )}
                </div>
                <span
                  className="text-xs font-medium hidden sm:block"
                  style={{ color: done ? '#059669' : active ? '#2563EB' : '#94A3B8' }}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="w-12 h-px" style={{ backgroundColor: done ? '#34D399' : '#E5E9EF' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Step 1: Cloud Selection, Credentials & Scope (1 Account + 1 Region) ── */
function Step1({
  selectedCloud,
  selectedAccount,
  setSelectedAccount,
  accountType,
  setAccountType,
  selectedRegion,
  setSelectedRegion,
  assessmentName,
  setAssessmentName,
  onNext,
}: {
  selectedCloud: Cloud;
  selectedAccount: string;
  setSelectedAccount: (id: string) => void;
  accountType: 'prod' | 'pre-prod' | 'dev';
  setAccountType: (t: 'prod' | 'pre-prod' | 'dev') => void;
  selectedRegion: string;
  setSelectedRegion: (id: string) => void;
  assessmentName: string;
  setAssessmentName: (name: string) => void;
  onNext: () => void;
}) {
  const { go } = useApp();
  const [credType, setCredType] = useState<'api' | 'collector'>('api');
  const [awsAuthType, setAwsAuthType] = useState<'role' | 'keys'>('role');
  const [azureAuthType, setAzureAuthType] = useState<'sp' | 'mi'>('sp');
  const [gcpAuthType, setGcpAuthType] = useState<'sa' | 'wif'>('sa');
  const [testState, setTestState] = useState<'idle' | 'testing' | 'ok'>('idle');
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);

  const cloudObj = CLOUD_OPTIONS.find(c => c.id === selectedCloud) || CLOUD_OPTIONS[0];
  const accounts = CLOUD_ACCOUNTS[selectedCloud] || CLOUD_ACCOUNTS.aws;
  const regions = CLOUD_REGIONS[selectedCloud] || CLOUD_REGIONS.aws;
  const activeAccount = accounts.find(a => a.id === selectedAccount) || accounts[0];
  const activeRegion = regions.find(r => r.id === selectedRegion) || regions[0];

  const handleTest = () => {
    setTestState('testing');
    setTimeout(() => setTestState('ok'), 1200);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6">
      <div>
        <h2 className="font-semibold text-lg text-gray-900">Assessment Configuration</h2>
        <p className="text-sm mt-1 text-gray-500">
          Configure target scope, single region, and read-only credentials for your {cloudObj.label} review.
        </p>
      </div>

      {/* ── SELECTED CLOUD PROVIDER BANNER ── */}
      <div
        className="rounded-2xl p-4 flex items-center justify-between border shadow-xs transition-all"
        style={{
          backgroundColor: `${cloudObj.accent}0D`,
          borderColor: `${cloudObj.accent}33`,
        }}
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-2xl bg-white border border-gray-100 flex items-center justify-center p-2 shadow-xs shrink-0">
            {selectedCloud === 'aws' && <AwsWordmark width={38} height={24} />}
            {selectedCloud === 'azure' && <AzureMark size={28} />}
            {selectedCloud === 'gcp' && <GcpMark size={28} />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-bold text-gray-900">{cloudObj.label}</span>
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: `${cloudObj.accent}1A`, color: cloudObj.accent }}
              >
                {cloudObj.short}
              </span>
              <span className="text-xs text-gray-400 font-normal">
                · Well-Architected Framework
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate mt-0.5">{cloudObj.desc}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => go('select-cloud')}
          className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors cursor-pointer shrink-0 ml-3 shadow-2xs"
        >
          Change Cloud
        </button>
      </div>

      {/* ── 1. ASSESSMENT NAME ── */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-sm text-gray-900">1. Assessment Details</h3>
        <Field
          label="Assessment Name"
          required
          type="text"
          value={assessmentName}
          onChange={e => setAssessmentName(e.target.value)}
          placeholder={`e.g. ${cloudObj.short} Production — ${activeRegion.id} Full Review`}
        />
      </div>

      {/* ── 2. ACCOUNT / SUBSCRIPTION / PROJECT SELECTOR (DROPDOWN) ── */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-gray-100 shadow-sm relative">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-sm text-gray-900">
            2. Select {selectedCloud === 'azure' ? 'Subscription' : selectedCloud === 'gcp' ? 'Project' : 'Account'} <span className="text-red-400">*</span>
          </label>
          <span className="text-[11px] text-gray-400">Strictly 1 {selectedCloud === 'azure' ? 'subscription' : selectedCloud === 'gcp' ? 'project' : 'account'}</span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setAccountDropdownOpen(!accountDropdownOpen);
              setRegionDropdownOpen(false);
            }}
            className="w-full p-3.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left bg-white hover:border-blue-400"
            style={{
              borderColor: accountDropdownOpen ? '#2563EB' : '#E2E8F0',
              boxShadow: accountDropdownOpen ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 text-blue-600 font-bold text-xs">
                {selectedCloud === 'aws' ? 'AWS' : selectedCloud === 'azure' ? 'AZ' : 'GCP'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {activeAccount.name}
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                    ID: {activeAccount.num}
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    accountType === 'prod'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : accountType === 'pre-prod'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-sky-50 text-sky-700 border border-sky-200'
                  }`}>
                    {accountType.toUpperCase()}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {activeAccount.resources}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-gray-400 transition-transform duration-200 ${accountDropdownOpen ? 'rotate-180 text-blue-600' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {accountDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setAccountDropdownOpen(false)}
              />
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl flex flex-col gap-1 max-h-64 overflow-y-auto"
              >
                {accounts.map(acc => {
                  const isSel = selectedAccount === acc.id;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => {
                        setSelectedAccount(acc.id);
                        if (acc.env.toLowerCase().includes('prod')) setAccountType('prod');
                        else if (acc.env.toLowerCase().includes('dev')) setAccountType('dev');
                        else if (acc.env.toLowerCase().includes('stage') || acc.env.toLowerCase().includes('pre')) setAccountType('pre-prod');
                        setAccountDropdownOpen(false);
                      }}
                      className="w-full p-3 rounded-xl flex items-center justify-between transition-all cursor-pointer text-left"
                      style={{
                        backgroundColor: isSel ? '#EFF6FF' : 'transparent',
                      }}
                      onMouseEnter={e => {
                        if (!isSel) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={e => {
                        if (!isSel) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: isSel ? '#2563EB' : '#CBD5E1' }}
                        >
                          {isSel && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-semibold text-gray-900 truncate">{acc.name}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {acc.num}
                            </span>
                            <span className="text-[10px] font-medium text-gray-500">
                              · {acc.env}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{acc.resources}</div>
                        </div>
                      </div>

                      {isSel && (
                        <span className="text-xs font-semibold text-blue-600 shrink-0 ml-2">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Account Environment / Type Selector (Dev / Pre-Prod / Prod) */}
        <div className="pt-3 border-t border-gray-100 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <span>Account Type / Environment</span>
              <span className="text-red-400">*</span>
            </label>
            <span className="text-[11px] text-gray-400">Select workload lifecycle environment</span>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            {[
              {
                id: 'dev' as const,
                label: 'Dev',
                sub: 'Development / Sandbox',
                activeClass: 'border-sky-500 bg-sky-50 text-sky-800 ring-2 ring-sky-500/20 shadow-xs',
                idleClass: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                badge: 'Sandbox',
              },
              {
                id: 'pre-prod' as const,
                label: 'Pre-Prod',
                sub: 'Staging / UAT / QA',
                activeClass: 'border-purple-500 bg-purple-50 text-purple-800 ring-2 ring-purple-500/20 shadow-xs',
                idleClass: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                badge: 'Testing',
              },
              {
                id: 'prod' as const,
                label: 'Prod',
                sub: 'Production Live',
                activeClass: 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/20 shadow-xs',
                idleClass: 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                badge: 'Mission-Critical',
              },
            ].map(opt => {
              const isSel = accountType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setAccountType(opt.id)}
                  className={`p-3 rounded-xl border flex flex-col items-start gap-1 transition-all cursor-pointer text-left ${
                    isSel ? opt.activeClass : opt.idleClass
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-bold">{opt.label}</span>
                    {isSel ? (
                      <span className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                        ✓
                      </span>
                    ) : (
                      <span className="w-3.5 h-3.5 rounded-full border border-gray-300" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 leading-tight">{opt.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 3. SINGLE REGION SELECTOR (DROPDOWN) ── */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-3 border border-gray-100 shadow-sm relative">
        <div className="flex items-center justify-between">
          <label className="font-semibold text-sm text-gray-900">
            3. Select Region <span className="text-red-400">*</span>
          </label>
          <span className="text-[11px] text-blue-600 font-medium">Single region only</span>
        </div>
        <p className="text-xs text-gray-500">
          Reviews evaluate architecture and technical resources within one designated {cloudObj.short} region per review run.
        </p>

        <div className="relative">
          <button
            type="button"
            onClick={() => {
              setRegionDropdownOpen(!regionDropdownOpen);
              setAccountDropdownOpen(false);
            }}
            className="w-full p-3.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left bg-white hover:border-blue-400"
            style={{
              borderColor: regionDropdownOpen ? '#2563EB' : '#E2E8F0',
              boxShadow: regionDropdownOpen ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 text-emerald-600">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="2" y1="12" x2="22" y2="12"/>
                  <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                </svg>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-mono font-bold text-gray-900">
                    {activeRegion.id}
                  </span>
                  <span className="text-xs text-gray-700">
                    {activeRegion.name}
                  </span>
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Location: {activeRegion.loc}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 ml-3">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`text-gray-400 transition-transform duration-200 ${regionDropdownOpen ? 'rotate-180 text-blue-600' : ''}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </button>

          {regionDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setRegionDropdownOpen(false)}
              />
              <div
                className="absolute left-0 right-0 top-full mt-1.5 z-20 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl flex flex-col gap-1 max-h-64 overflow-y-auto"
              >
                {regions.map(reg => {
                  const isSel = selectedRegion === reg.id;
                  return (
                    <button
                      key={reg.id}
                      type="button"
                      onClick={() => {
                        setSelectedRegion(reg.id);
                        setRegionDropdownOpen(false);
                      }}
                      className="w-full p-3 rounded-xl flex items-center justify-between transition-all cursor-pointer text-left"
                      style={{
                        backgroundColor: isSel ? '#EFF6FF' : 'transparent',
                      }}
                      onMouseEnter={e => {
                        if (!isSel) e.currentTarget.style.backgroundColor = '#F8FAFC';
                      }}
                      onMouseLeave={e => {
                        if (!isSel) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                          style={{ borderColor: isSel ? '#2563EB' : '#CBD5E1' }}
                        >
                          {isSel && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-gray-900">{reg.id}</span>
                            <span className="text-xs text-gray-700">· {reg.name}</span>
                          </div>
                          <div className="text-[11px] text-gray-400 mt-0.5">{reg.loc}</div>
                        </div>
                      </div>

                      {isSel && (
                        <span className="text-xs font-semibold text-blue-600 shrink-0 ml-2">
                          Selected
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── 4. AUTHENTICATION CREDENTIALS (PRE-CONFIGURED & VIEW ONLY) ── */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm text-gray-900">4. Authentication & Credentials</h3>
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Configured & Verified
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Credentials loaded from active Cloud Config in Settings (view-only).
            </p>
          </div>
          <button
            type="button"
            onClick={() => go('settings')}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
          >
            Manage in Settings →
          </button>
        </div>

        {/* Read-only Method and Details */}
        <div className="rounded-xl border border-gray-200 bg-gray-50/70 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between pb-3 border-b border-gray-200/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                {selectedCloud === 'aws' ? 'IAM' : selectedCloud === 'azure' ? 'SP' : 'SA'}
              </div>
              <div>
                <div className="text-xs font-bold text-gray-900">
                  {selectedCloud === 'aws'
                    ? 'Cross-Account IAM Role (ReadOnlyAccess)'
                    : selectedCloud === 'azure'
                    ? 'Azure Service Principal (Reader Role)'
                    : 'GCP Service Account (Viewer Role)'}
                </div>
                <div className="text-[11px] text-gray-500">
                  {selectedCloud === 'aws'
                    ? 'Direct read-only API evaluation using STS AssumeRole'
                    : selectedCloud === 'azure'
                    ? 'Azure Resource Graph & Management REST API connection'
                    : 'Google Cloud Asset Inventory & Cloud Resource Manager API'}
                </div>
              </div>
            </div>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-gray-200/70 text-gray-700 font-medium">
              Read-Only
            </span>
          </div>

          {/* Credentials Display (Disabled / View-only) */}
          {selectedCloud === 'aws' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Account ID</label>
                <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-gray-700 select-all">
                  124890123456
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">IAM Role ARN</label>
                <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-gray-700 truncate select-all" title="arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole">
                  arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole
                </div>
              </div>
            </div>
          )}

          {selectedCloud === 'azure' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Directory (Tenant) ID</label>
                <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-gray-700 truncate select-all">
                  72f988bf-86f1-41af-91ab-2d7cd011db47
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Application (Client) ID</label>
                <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-gray-700 truncate select-all">
                  e892c901-44bb-4e31-8902-124890123456
                </div>
              </div>
            </div>
          )}

          {selectedCloud === 'gcp' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Project ID</label>
                <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-gray-700 select-all">
                  acme-gcp-prod-9941
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-gray-500 mb-1">Service Account Email</label>
                <div className="px-3 py-2 rounded-lg bg-white border border-gray-200 font-mono text-gray-700 truncate select-all" title="wafr-scanner@acme-gcp-prod.iam.gserviceaccount.com">
                  wafr-scanner@acme-gcp-prod.iam.gserviceaccount.com
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Test Connection Action */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleTest}
            disabled={testState === 'testing'}
            className="flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold border-2 border-blue-600 text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
          >
            {testState === 'testing' && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
            )}
            <span>{testState === 'testing' ? 'Testing…' : 'Test connection'}</span>
          </button>
          {testState === 'ok' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span>Connection active & verified — read permissions confirmed</span>
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center">
        <button
          type="button"
          onClick={() => go('select-cloud')}
          className="px-4 py-2.5 rounded-xl text-xs font-semibold border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-colors cursor-pointer flex items-center gap-1.5"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to Select Cloud</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 cursor-pointer shadow-sm flex items-center gap-2"
          style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}
        >
          <span>Continue to Client Questionnaire</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

/* ── Step 2: Dual-Scope Manual Questionnaire (Account-Specific & Organization-Specific) ── */
function Step2({
  questions,
  setQuestions,
  onNext,
  onBack,
}: {
  questions: QuestionnaireItem[];
  setQuestions: React.Dispatch<React.SetStateAction<QuestionnaireItem[]>>;
  onNext: () => void;
  onBack: () => void;
}) {
  const { go } = useApp();
  const [scopeFilter, setScopeFilter] = useState<'all' | 'account' | 'organization'>('account');
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>('ACC-05');
  const [draftAnswers, setDraftAnswers] = useState<Record<string, string>>({});
  const [selectedInfoQuestion, setSelectedInfoQuestion] = useState<QuestionnaireItem | null>(null);

  const accountQuestions = questions.filter(q => q.scope === 'account');
  const orgQuestions = questions.filter(q => q.scope === 'organization');

  const accountAnswered = accountQuestions.filter(q => q.answered && q.ans && q.ans.trim().length > 0).length;
  const orgAnswered = orgQuestions.filter(q => q.answered && q.ans && q.ans.trim().length > 0).length;
  const totalAnswered = questions.filter(q => q.answered && q.ans && q.ans.trim().length > 0).length;
  const totalQuestions = questions.length;
  const isAllComplete = totalAnswered === totalQuestions;
  const remainingCount = totalQuestions - totalAnswered;

  const allAccountManualChecks = accountQuestions.flatMap(q => q.manualChecks || []);
  const verifiedAccountChecks = allAccountManualChecks.filter(c => c.verified).length;
  const totalAccountChecks = allAccountManualChecks.length;

  const totalPct = Math.round((totalAnswered / totalQuestions) * 100);

  const displayedQuestions = questions.filter(q => {
    if (scopeFilter === 'account') return q.scope === 'account';
    if (scopeFilter === 'organization') return q.scope === 'organization';
    return true;
  });

  const SAMPLE_ANSWERS: Record<string, string> = {
    'ACC-01': 'CloudWatch dashboards with custom metrics and SNS alerts for P1/P2 severity. Microservices export traces via OpenTelemetry and logs to Datadog.',
    'ACC-02': 'AES-256 encryption at rest via AWS KMS Customer Managed Keys for all S3 buckets and RDS volumes. TLS 1.3 enforced on all ALB and CloudFront endpoints.',
    'ACC-03': 'A mix of On-Demand for bursty workloads and 1-year Compute Savings Plans for baseline capacity. RDS instances are committed on 1-year Reserved Instances.',
    'ACC-04': 'Multi-AZ deployments for all databases and stateless services across 2 availability zones with auto-scaling groups.',
    'ACC-05': 'GitLab CI/CD pipelines automate linting, security scans (SonarQube), and canary deployments to ECS/EKS with automated CloudWatch rollback triggers.',
    'ACC-06': 'IAM access keys older than 90 days are automatically deactivated. Root account has hardware MFA with zero active access keys. EC2/EKS workloads utilize IAM Roles with short-lived tokens.',
    'ACC-07': 'Amazon ElastiCache Redis cluster caches frequent read queries with 92% hit ratio. RDS Performance Insights monitors top SQL queries by wait state with alerts for execution spikes.',
    'ORG-01': 'AWS Organizations with AWS Control Tower enforces foundational SCPs denying unauthorized regions, root user usage, and public S3 bucket creation across all member accounts.',
    'ORG-02': 'Organization-wide CloudTrail logs and VPC Flow Logs are replicated to a dedicated secure Log Archive account with SIEM ingestion.',
    'ORG-03': 'AWS Cost Categories and mandatory Cost Center tagging policies enforced via AWS Organizations with monthly budget threshold alerts sent to Slack.',
    'ORG-04': 'P1 disaster recovery runbooks with cross-region replication SLAs (RPO < 15 min, RTO < 1 hour) and bi-weekly PagerDuty on-call drill reviews.',
  };

  const handleToggleSingleCheck = (questionId: string, checkId: string) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== questionId || !q.manualChecks) return q;
        const updatedChecks = q.manualChecks.map(chk =>
          chk.id === checkId ? { ...chk, verified: !chk.verified } : chk
        );
        return {
          ...q,
          manualChecks: updatedChecks,
        };
      })
    );
  };

  const handleToggleAllChecks = (questionId: string, verified: boolean) => {
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== questionId || !q.manualChecks) return q;
        return {
          ...q,
          manualChecks: q.manualChecks.map(c => ({ ...c, verified })),
        };
      })
    );
  };

  const handleSaveAnswer = (id: string) => {
    const text = draftAnswers[id] ?? questions.find(q => q.id === id)?.ans ?? '';
    setQuestions(prev =>
      prev.map(q => {
        if (q.id !== id) return q;
        return {
          ...q,
          answered: text.trim().length > 0,
          ans: text,
        };
      })
    );
    setActiveQuestionId(null);
  };

  const handleAutoFillRemaining = () => {
    setQuestions(prev =>
      prev.map(q => {
        const sample = SAMPLE_ANSWERS[q.id] || 'Verified and implemented according to enterprise architectural best practices and standardized automation policies.';
        const updatedChecks = q.manualChecks?.map(c => ({ ...c, verified: true }));
        return {
          ...q,
          answered: true,
          ans: q.ans && q.ans.trim().length > 0 ? q.ans : sample,
          manualChecks: updatedChecks || q.manualChecks,
        };
      })
    );
    setActiveQuestionId(null);
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wide">
              Step 2 of 3
            </span>
            <span className="text-xs text-gray-500 font-medium">Post-Cloud Configuration</span>
          </div>
          <h2 className="font-semibold text-xl text-gray-900">Client Questionnaire & Manual Checks</h2>
          <p className="text-xs sm:text-sm mt-0.5 text-gray-500">
            Answer architectural questions and verify account-specific technical controls. Use the <span className="font-serif italic font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">i</span> button for WAFR guidance.
          </p>
        </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-gray-900">{totalAnswered} of {questions.length} answered</div>
          <div className="text-[11px] mt-0.5 text-gray-400">≈ 6 min remaining</div>
        </div>
      </div>

      {/* Client Questionnaire Guidance Banner */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-emerald-50/60 border border-blue-100 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
        </div>
        <div className="text-xs text-gray-700 leading-relaxed">
          <span className="font-bold text-gray-900 block mb-0.5">Client & Account Discovery With Manual Verification</span>
          Account-specific questions include actionable manual checks with step-by-step verification guidance accessible via the <span className="font-serif italic font-bold text-blue-700">i</span> info button. Review and verify each control to ensure high-fidelity WAFR scoring.
        </div>
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
          <div className="h-full rounded-full transition-all duration-300" style={{ width: `${totalPct}%`, backgroundColor: '#34D399' }} />
        </div>
        <span className="text-xs font-semibold" style={{ color: '#10B981' }}>{totalPct}% Complete</span>
      </div>

      {/* ── Organisation Questions Status Banner ── */}
      <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-950 flex items-center justify-between gap-3 text-xs flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-[10px]">
            ✓
          </span>
          <span className="font-semibold">
            Organisation-Level Governance: {orgAnswered} of {orgQuestions.length} answered prior to cloud selection
          </span>
        </div>
        <button
          type="button"
          onClick={() => go('org-questions')}
          className="text-xs font-bold text-blue-700 hover:underline cursor-pointer"
        >
          Review / Edit Organisation Questions →
        </button>
      </div>

      {/* ── 2 SCOPE SWITCHER TABS ── */}
      <div className="grid grid-cols-2 gap-3 p-1.5 rounded-2xl bg-gray-100 border border-gray-200/80">
        {/* Account Specific Tab */}
        <button
          type="button"
          onClick={() => setScopeFilter(scopeFilter === 'account' ? 'all' : 'account')}
          className="p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col gap-1"
          style={{
            backgroundColor: scopeFilter === 'account' ? '#FFFFFF' : 'transparent',
            boxShadow: scopeFilter === 'account' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <div className="flex items-center justify-between flex-wrap gap-1">
            <span className="text-xs font-bold text-blue-700 flex items-center gap-1.5">
              <span>Account-Specific</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold">
                Manual Checks
              </span>
            </span>
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100 font-medium">
                {accountAnswered}/{accountQuestions.length} answered
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                {verifiedAccountChecks}/{totalAccountChecks} checks
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-500">
            Workload resources, technical manual checks, and account-level security controls
          </p>
        </button>

        {/* Organization Specific Tab */}
        <button
          type="button"
          onClick={() => setScopeFilter(scopeFilter === 'organization' ? 'all' : 'organization')}
          className="p-3 rounded-xl text-left transition-all cursor-pointer flex flex-col gap-1"
          style={{
            backgroundColor: scopeFilter === 'organization' ? '#FFFFFF' : 'transparent',
            boxShadow: scopeFilter === 'organization' ? '0 2px 6px rgba(0,0,0,0.06)' : 'none',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-700">Organization-Specific</span>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-purple-50 text-purple-600 border border-purple-100">
              {orgAnswered}/{orgQuestions.length} answered
            </span>
          </div>
          <p className="text-[11px] text-gray-500">
            Landing Zone SCPs, centralized logging, budgets, and enterprise governance
          </p>
        </button>
      </div>

      {/* Scope Filter Pill info */}
      <div className="flex items-center justify-between px-1 text-xs text-gray-500">
        <span>
          Showing {displayedQuestions.length} questions {scopeFilter !== 'all' ? `(${scopeFilter === 'account' ? 'Account Scope with Manual Checks' : 'Organization Scope'})` : '(All Scopes)'}
        </span>
        {scopeFilter !== 'all' && (
          <button
            type="button"
            onClick={() => setScopeFilter('all')}
            className="text-blue-600 font-medium hover:underline cursor-pointer"
          >
            Show all questions
          </button>
        )}
      </div>

      {/* ── QUESTION LIST ── */}
      <div className="flex flex-col gap-3">
        {displayedQuestions.map(q => {
          const isOpen = activeQuestionId === q.id;
          const cat = CAT_COLORS[q.cat] ?? { bg: '#F8FAFC', text: '#64748B' };
          const isAccount = q.scope === 'account';
          const verifiedChecksCount = q.manualChecks ? q.manualChecks.filter(c => c.verified).length : 0;
          const totalChecksCount = q.manualChecks ? q.manualChecks.length : 0;
          const allChecksVerified = totalChecksCount > 0 && verifiedChecksCount === totalChecksCount;

          return (
            <div
              key={q.id}
              className="bg-white rounded-2xl overflow-hidden border transition-all"
              style={{ borderColor: isOpen ? '#2563EB' : '#E5E9EF', boxShadow: isOpen ? '0 4px 12px rgba(37,99,235,0.08)' : 'none' }}
            >
              {/* Header row */}
              <div
                onClick={() => setActiveQuestionId(isOpen ? null : q.id)}
                className="flex items-start gap-3 p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
              >
                <div
                  className="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all"
                  style={q.answered
                    ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                    : { borderColor: '#CBD5E1' }
                  }
                >
                  {q.answered && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isAccount ? 'rgba(37,99,235,0.08)' : 'rgba(147,51,234,0.08)',
                        color: isAccount ? '#2563EB' : '#7E22CE',
                        border: `1px solid ${isAccount ? 'rgba(37,99,235,0.2)' : 'rgba(147,51,234,0.2)'}`,
                      }}
                    >
                      {isAccount ? 'Account-Specific' : 'Organization-Specific'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.bg, color: cat.text }}>
                      {q.cat}
                    </span>
                    <span className="text-[11px] font-mono text-gray-400">{q.id}</span>
                    {totalChecksCount > 0 && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 border ${
                        allChecksVerified
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 11 12 14 22 4" />
                          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                        </svg>
                        <span>
                          {verifiedChecksCount}/{totalChecksCount} manual checks
                        </span>
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-gray-800">{q.q}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{q.desc}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0 mt-0.5">
                  {/* i (info) Button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInfoQuestion(q);
                    }}
                    className="w-7 h-7 rounded-full flex items-center justify-center text-blue-600 bg-blue-50 hover:bg-blue-100 hover:text-blue-700 border border-blue-200 transition-all cursor-pointer shadow-xs active:scale-95"
                    title="View manual check verification guidance and WAFR best practices"
                    aria-label={`View info for ${q.id}`}
                  >
                    <span className="font-serif italic font-bold text-xs">i</span>
                  </button>

                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className={`text-gray-400 transition-transform duration-150 ${isOpen ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
              </div>

              {/* Expandable answer panel */}
              {isOpen && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100 bg-gray-50/50 flex flex-col gap-3.5">
                  {/* Manual Checks Section for Account-Specific Question */}
                  {q.manualChecks && q.manualChecks.length > 0 && (
                    <div className="p-3.5 rounded-xl bg-white border border-gray-200 shadow-xs">
                      <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-gray-100 flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="9 11 12 14 22 4" />
                              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                            </svg>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-gray-800">
                              Manual Verification Checks ({verifiedChecksCount}/{totalChecksCount} Verified)
                            </span>
                            <span className="text-[11px] text-gray-500 block">
                              Inspect and check off these technical controls in your cloud environment:
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleAllChecks(q.id, true)}
                            className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                          >
                            Check All
                          </button>
                          <span className="text-gray-300">·</span>
                          <button
                            type="button"
                            onClick={() => handleToggleAllChecks(q.id, false)}
                            className="text-[11px] text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            Uncheck All
                          </button>
                          <button
                            type="button"
                            onClick={() => setSelectedInfoQuestion(q)}
                            className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-lg border border-blue-200 transition-colors cursor-pointer ml-1"
                          >
                            <span className="font-serif italic font-bold text-[11px]">i</span>
                            <span>Info Guide</span>
                          </button>
                        </div>
                      </div>

                      {/* Checklist items */}
                      <div className="space-y-2">
                        {q.manualChecks.map(chk => (
                          <div
                            key={chk.id}
                            onClick={() => handleToggleSingleCheck(q.id, chk.id)}
                            className="flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer hover:bg-slate-50/70"
                            style={{
                              borderColor: chk.verified ? '#A7F3D0' : '#E2E8F0',
                              backgroundColor: chk.verified ? '#F0FDF4' : '#FFFFFF',
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={chk.verified}
                              onChange={() => handleToggleSingleCheck(q.id, chk.id)}
                              className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4 border-gray-300 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <div className={`text-xs font-medium ${chk.verified ? 'text-emerald-950 font-semibold' : 'text-gray-800'}`}>
                                {chk.label}
                              </div>
                              {chk.guidance && (
                                <div className="text-[10px] text-gray-500 mt-1 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-200/60 inline-flex items-center gap-1">
                                  <span className="font-bold text-blue-600">Verification Hint:</span>
                                  <span>{chk.guidance}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contextual Architecture Response */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">
                      Architectural Implementation Notes & Evidence Context
                    </label>
                    <textarea
                      defaultValue={draftAnswers[q.id] ?? q.ans ?? ''}
                      onChange={e => setDraftAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                      rows={3}
                      placeholder="Describe your architectural design, implementation practices, and operational tooling…"
                      className="w-full text-sm rounded-xl px-3.5 py-2.5 resize-none outline-none border border-gray-200 bg-white text-gray-800 placeholder-gray-400 transition-all shadow-xs"
                      onFocus={e => { e.target.style.borderColor = '#2563EB'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)'; }}
                      onBlur={e => { e.target.style.borderColor = '#E5E9EF'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-gray-400">Contextual answers and manual checks are factored into WAFR pillar compliance scoring</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveQuestionId(null)}
                        className="px-3.5 py-1.5 text-xs rounded-full border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveAnswer(q.id)}
                        className="flex items-center gap-1.5 px-4 py-1.5 text-xs rounded-full font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                        style={{ background: '#10B981' }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span>Save Answer</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Navigation Actions & Completion Warning */}
      <div className="flex flex-col gap-3 pt-2">
        {!isAllComplete ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="truncate">
                <strong>Questionnaire Incomplete:</strong> Complete {remainingCount} remaining question{remainingCount > 1 ? 's' : ''} across Account & Organization scopes to proceed.
              </span>
            </div>
            <button
              type="button"
              onClick={handleAutoFillRemaining}
              className="px-3 py-1.5 rounded-xl font-bold text-xs bg-amber-200/80 hover:bg-amber-300 text-amber-950 transition-colors cursor-pointer shrink-0"
            >
              Fill Remaining Answers & Checks (Auto-Fill)
            </button>
          </div>
        ) : (
          <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2 text-xs font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>All {totalQuestions} manual questionnaire responses and {totalAccountChecks} account manual checks completed and verified. Ready for review.</span>
          </div>
        )}

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 rounded-full text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer"
          >
            ← Back to Configure Cloud
          </button>
          <button
            type="button"
            disabled={!isAllComplete}
            onClick={onNext}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm ${
              isAllComplete
                ? 'text-white cursor-pointer hover:opacity-90'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
            }`}
            style={isAllComplete ? { background: 'linear-gradient(135deg, #2563EB, #10B981)' } : undefined}
            title={!isAllComplete ? `Please complete all remaining questions (${totalAnswered}/${totalQuestions})` : undefined}
          >
            <span>Continue to Review & Start</span>
            <span className="text-xs opacity-90">({totalAnswered}/{totalQuestions})</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── MANUAL CHECK INFO MODAL (Opened by 'i' button) ── */}
      {selectedInfoQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-100 flex items-start justify-between bg-gradient-to-r from-blue-50/70 to-indigo-50/40">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-serif italic font-bold text-base shrink-0 shadow-xs mt-0.5">
                  i
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                      {selectedInfoQuestion.id}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                      {selectedInfoQuestion.cat}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {selectedInfoQuestion.scope === 'account' ? 'Account Scope' : 'Organization Scope'}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">
                    {selectedInfoQuestion.q}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfoQuestion(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer shrink-0 ml-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Framework Reference */}
              {selectedInfoQuestion.info?.frameworkRef && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between">
                  <span className="font-semibold text-slate-600">Standard & Framework:</span>
                  <span className="font-mono font-bold text-blue-700">
                    {selectedInfoQuestion.info.frameworkRef}
                  </span>
                </div>
              )}

              {/* Why This Check Matters */}
              {selectedInfoQuestion.info?.whyItMatters && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    Why This Manual Check Matters
                  </h4>
                  <p className="text-gray-600 leading-relaxed bg-blue-50/40 p-3 rounded-xl border border-blue-100/70">
                    {selectedInfoQuestion.info.whyItMatters}
                  </p>
                </div>
              )}

              {/* How to Manually Verify */}
              {selectedInfoQuestion.info?.howToVerify && selectedInfoQuestion.info.howToVerify.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2.5">
                      <polyline points="9 11 12 14 22 4" />
                      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                    </svg>
                    Step-by-Step Manual Verification Procedure
                  </h4>
                  <div className="space-y-1.5">
                    {selectedInfoQuestion.info.howToVerify.map((step, idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-gray-50 border border-gray-200/70 text-gray-700 leading-relaxed font-sans">
                        {step}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist items summary */}
              {selectedInfoQuestion.manualChecks && selectedInfoQuestion.manualChecks.length > 0 && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-1.5 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M9 12l2 2 4-4" />
                    </svg>
                    Manual Checklist Criteria ({selectedInfoQuestion.manualChecks.length} Controls)
                  </h4>
                  <div className="space-y-1">
                    {selectedInfoQuestion.manualChecks.map(chk => (
                      <div key={chk.id} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50/60 border border-slate-200/50">
                        <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shrink-0 ${
                          chk.verified ? 'bg-emerald-500 text-white' : 'border border-gray-300'
                        }`}>
                          {chk.verified && (
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </span>
                        <span className={`text-[11px] ${chk.verified ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {chk.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Required Audit Evidence */}
              {selectedInfoQuestion.info?.auditEvidence && (
                <div>
                  <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-1.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Required Compliance Audit Evidence
                  </h4>
                  <div className="p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/70 text-amber-900 font-mono text-[11px]">
                    {selectedInfoQuestion.info.auditEvidence}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between bg-gray-50">
              <span className="text-[11px] text-gray-500">
                WAFR Account-Specific Manual Inspection
              </span>
              <button
                type="button"
                onClick={() => setSelectedInfoQuestion(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors cursor-pointer shadow-xs"
              >
                Understood & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Step 3: Review & Start ── */
function Step3({
  selectedCloud,
  selectedAccount,
  accountType,
  selectedRegion,
  assessmentName,
  questions,
  onBack,
  onStart,
}: {
  selectedCloud: Cloud;
  selectedAccount: string;
  accountType: 'prod' | 'pre-prod' | 'dev';
  selectedRegion: string;
  assessmentName: string;
  questions: QuestionnaireItem[];
  onBack: () => void;
  onStart: () => void;
}) {
  const [retention, setRetention] = useState('90');

  const cloudObj = CLOUD_OPTIONS.find(c => c.id === selectedCloud) || CLOUD_OPTIONS[0];
  const accounts = CLOUD_ACCOUNTS[selectedCloud] || CLOUD_ACCOUNTS.aws;
  const accObj = accounts.find(a => a.id === selectedAccount) || accounts[0];
  const regions = CLOUD_REGIONS[selectedCloud] || CLOUD_REGIONS.aws;
  const regObj = regions.find(r => r.id === selectedRegion) || regions[0];

  const accountQuestions = questions.filter(q => q.scope === 'account');
  const orgQuestions = questions.filter(q => q.scope === 'organization');
  const accountAnswered = accountQuestions.filter(q => q.answered && q.ans && q.ans.trim().length > 0).length;
  const orgAnswered = orgQuestions.filter(q => q.answered && q.ans && q.ans.trim().length > 0).length;
  const totalAnswered = questions.filter(q => q.answered && q.ans && q.ans.trim().length > 0).length;
  const isAllComplete = totalAnswered === questions.length;

  const allAccountManualChecks = accountQuestions.flatMap(q => q.manualChecks || []);
  const verifiedAccountChecks = allAccountManualChecks.filter(c => c.verified).length;

  const configRows = [
    ['Assessment Name', assessmentName],
    ['Cloud Provider', `${cloudObj.label} (${cloudObj.short})`],
    ['Account Scope', `${accObj.name} (ID: ${accObj.num}) · 1 ${selectedCloud === 'azure' ? 'Subscription' : selectedCloud === 'gcp' ? 'Project' : 'Account'}`],
    ['Account Environment', accountType === 'prod' ? 'Production (Prod)' : accountType === 'pre-prod' ? 'Pre-Production (Staging / QA)' : 'Development (Dev / Sandbox)'],
    ['Target Region', `${regObj.id} (${regObj.name}) · 1 Region`],
    ['Account Questionnaire', `${accountAnswered} of ${accountQuestions.length} answered`],
    ['Account Manual Checks', `${verifiedAccountChecks} of ${allAccountManualChecks.length} checks verified`],
    ['Organization Questionnaire', `${orgAnswered} of ${orgQuestions.length} answered`],
    ['Questionnaire Status', isAllComplete ? 'Complete & Verified (All questions & manual checks verified)' : `Incomplete (${totalAnswered}/${questions.length} answered)`],
    ['Pillars Evaluated', 'Reliability, Security, Cost Optimization, Operational Excellence, Performance'],
    ['Estimated Scan Duration', '6–8 minutes (Non-intrusive read-only scan)'],
  ];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-5">
      <div>
        <h2 className="font-semibold text-lg text-gray-900">Review & Start Assessment</h2>
        <p className="text-sm mt-0.5 text-gray-500">
          Confirm your cloud account scope, environment type, credentials, and manual questionnaire responses before launching the assessment.
        </p>
      </div>

      {!isAllComplete && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>
              <strong>Questionnaire Incomplete:</strong> {questions.length - totalAnswered} question(s) remaining. You cannot launch the assessment without completing all questionnaire answers.
            </span>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="px-3 py-1.5 rounded-xl font-bold bg-rose-600 text-white hover:bg-rose-700 transition-colors cursor-pointer shrink-0"
          >
            ← Complete Questionnaire
          </button>
        </div>
      )}

      {/* Summary Box */}
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
        <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Configuration Summary</span>
          <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: `${cloudObj.accent}15`, color: cloudObj.accent }}>
            {cloudObj.short}
          </span>
        </div>
        {configRows.map(([label, value]) => (
          <div key={label} className="flex items-start gap-4 px-5 py-3 border-b border-gray-50 last:border-0">
            <span className="text-xs w-48 shrink-0 pt-0.5 text-gray-400">{label}</span>
            <span className={`text-sm font-medium flex-1 ${label === 'Questionnaire Status' ? (isAllComplete ? 'text-emerald-600 font-semibold' : 'text-rose-600 font-semibold') : 'text-gray-800'}`}>{value}</span>
          </div>
        ))}
      </div>

      {/* Retention selector */}
      <div className="bg-white rounded-2xl p-5 flex flex-col gap-4 border border-gray-100 shadow-sm">
        <h3 className="font-semibold text-sm text-gray-800">Data Retention Policy</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs mb-1.5 block text-gray-500">Raw configuration snapshots</label>
            <select
              value={retention}
              onChange={e => setRetention(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm border border-gray-200 bg-white text-gray-800 outline-none cursor-pointer"
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days (recommended)</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
          <div>
            <label className="text-xs mb-1.5 block text-gray-500">Findings & reports</label>
            <select
              defaultValue="365"
              className="w-full rounded-xl px-3 py-2.5 text-sm border border-gray-200 bg-white text-gray-800 outline-none cursor-pointer"
            >
              <option value="365">1 year (recommended)</option>
              <option value="730">2 years</option>
              <option value="0">Forever</option>
            </select>
          </div>
        </div>
      </div>

      {/* Duration Info Banner */}
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-blue-50 border border-blue-100">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm text-blue-600">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
        </div>
        <div>
          <div className="text-sm font-semibold text-gray-800">Estimated duration: ~6 minutes</div>
          <div className="text-xs text-gray-500">
            Scanning {regObj.id} resources on {accObj.name} [{accountType.toUpperCase()}] · Read-only access · Zero workload disruption
          </div>
        </div>
      </div>

      {/* Navigation Actions */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-full text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          ← Back to Questionnaire
        </button>
        <button
          type="button"
          disabled={!isAllComplete}
          onClick={onStart}
          className={`flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold shadow-lg transition-all ${
            isAllComplete
              ? 'text-white cursor-pointer hover:opacity-90 hover:scale-[1.02] active:scale-100'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
          style={isAllComplete ? { background: 'linear-gradient(135deg, #2563EB, #22C55E)' } : undefined}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          <span>Start Assessment</span>
        </button>
      </div>
    </div>
  );
}

/* ── Main Wizard Component ── */
export function Wizard() {
  const { go, cloud, setWizardStep, wizardStep: globalStep, orgQuestions } = useApp();
  const [step, setStep] = useState<1 | 2 | 3>(globalStep <= 3 ? (globalStep as 1 | 2 | 3) : 1);

  // Form State
  const [selectedCloud, setSelectedCloud] = useState<Cloud>(cloud || 'aws');
  const [assessmentName, setAssessmentName] = useState('AWS Production — us-east-1 Full Review');
  const [selectedAccount, setSelectedAccount] = useState('acc-aws-01');
  const [accountType, setAccountType] = useState<'prod' | 'pre-prod' | 'dev'>('prod');
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [questions, setQuestions] = useState<QuestionnaireItem[]>(() => {
    return INITIAL_QUESTIONS.map(q => {
      const org = orgQuestions?.find(o => o.id === q.id);
      return org ? { ...org } : q;
    });
  });

  // Sync orgQuestions if they change in AppContext
  useEffect(() => {
    if (orgQuestions?.length) {
      setQuestions(prev =>
        prev.map(q => {
          const org = orgQuestions.find(o => o.id === q.id);
          return org ? { ...q, ans: org.ans, answered: org.answered, manualChecks: org.manualChecks } : q;
        })
      );
    }
  }, [orgQuestions]);

  // Synchronize when user selects a cloud in SelectCloud screen
  useEffect(() => {
    if (cloud) {
      setSelectedCloud(cloud);
      const newAccounts = CLOUD_ACCOUNTS[cloud];
      const newRegions = CLOUD_REGIONS[cloud];
      if (newAccounts?.length) {
        setSelectedAccount(newAccounts[0].id);
        if (newAccounts[0].env.toLowerCase().includes('prod')) setAccountType('prod');
        else if (newAccounts[0].env.toLowerCase().includes('dev')) setAccountType('dev');
        else setAccountType('pre-prod');
      }
      if (newRegions?.length) setSelectedRegion(newRegions[0].id);
      setAssessmentName(`${cloud.toUpperCase()} Production — ${newRegions?.[0]?.id || 'us-east-1'} Full Review`);
    }
  }, [cloud]);

  const advance = () => {
    const n = (step + 1) as 1 | 2 | 3;
    setStep(n);
    setWizardStep(n);
  };
  const back = () => {
    const n = (step - 1) as 1 | 2 | 3;
    setStep(n);
    setWizardStep(n);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Top Header */}
      <header className="h-14 flex items-center px-6 shrink-0 bg-white border-b border-gray-100 shadow-xs">
        <button
          type="button"
          onClick={() => go('dashboard')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors mr-4 cursor-pointer"
        >
          ← Back to Home
        </button>

        <div className="flex items-center gap-2.5 mr-6">
          <CloudifyOpsSymbol height={24} />
          <span className="font-semibold text-sm text-gray-900">CloudifyOps</span>
        </div>
        <span className="text-sm text-gray-400">New Assessment Wizard</span>

        <button
          type="button"
          onClick={() => go('dashboard')}
          className="ml-auto text-xs font-medium text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"
        >
          × Cancel
        </button>
      </header>

      <StepProgress step={step} />

      <div className="flex-1 overflow-auto p-8">
        {step === 1 && (
          <Step1
            selectedCloud={selectedCloud}
            selectedAccount={selectedAccount}
            setSelectedAccount={setSelectedAccount}
            accountType={accountType}
            setAccountType={setAccountType}
            selectedRegion={selectedRegion}
            setSelectedRegion={setSelectedRegion}
            assessmentName={assessmentName}
            setAssessmentName={setAssessmentName}
            onNext={advance}
          />
        )}
        {step === 2 && (
          <Step2
            questions={questions}
            setQuestions={setQuestions}
            onNext={advance}
            onBack={back}
          />
        )}
        {step === 3 && (
          <Step3
            selectedCloud={selectedCloud}
            selectedAccount={selectedAccount}
            accountType={accountType}
            selectedRegion={selectedRegion}
            assessmentName={assessmentName}
            questions={questions}
            onBack={back}
            onStart={() => go('live-scan')}
          />
        )}
      </div>
    </div>
  );
}
