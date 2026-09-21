export interface AssessmentInfo {
  id: string;
  name: string;
  accountName: string;
  accountId: string;
  region: string;
  cloud: 'aws' | 'azure' | 'gcp';
  status: 'complete' | 'running' | 'fail' | 'warning' | 'draft';
  score: number;
  lastRun: string;
  checks: number;
  pillars: {
    reliability: number;
    security: number;
    cost: number;
    operations: number;
    performance: number;
  };
}

export interface AssessmentMilestone {
  id: string;
  assessmentId: string;
  milestoneNumber: number;
  milestoneName: string;
  version: string;
  recordedAt: string;
  recordedBy: string;
  score: number;
  totalBestPractices: number;
  passedBps: number;
  failedBps: number;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  highRisks: number;
  mediumRisks: number;
  lowRisks: number;
  notes: string;
  pillarScores: {
    reliability: number;
    security: number;
    cost: number;
    operations: number;
    performance: number;
  };
  pillarHighRisks?: {
    reliability: number;
    security: number;
    cost: number;
    operations: number;
    performance: number;
  };
}

export const INITIAL_ASSESSMENTS: AssessmentInfo[] = [
  {
    id: 'A-001',
    name: 'Production — us-east-1 Full Review',
    accountName: 'acme-production',
    accountId: '124890123456',
    region: 'us-east-1',
    cloud: 'aws',
    status: 'complete',
    score: 84,
    lastRun: '2h ago',
    checks: 45,
    pillars: { reliability: 88, security: 79, cost: 91, operations: 82, performance: 80 },
  },
  {
    id: 'A-002',
    name: 'Staging — us-west-2 Review',
    accountName: 'acme-staging',
    accountId: '987654321098',
    region: 'us-west-2',
    cloud: 'aws',
    status: 'running',
    score: 71,
    lastRun: 'In progress',
    checks: 45,
    pillars: { reliability: 72, security: 68, cost: 75, operations: 70, performance: 70 },
  },
  {
    id: 'A-003',
    name: 'Azure Data Platform Review',
    accountName: 'AcmeCorp-DataSub',
    accountId: 'sub-4891-2394',
    region: 'eastus',
    cloud: 'azure',
    status: 'complete',
    score: 78,
    lastRun: '1d ago',
    checks: 45,
    pillars: { reliability: 78, security: 74, cost: 82, operations: 80, performance: 76 },
  },
  {
    id: 'A-004',
    name: 'Dev Baseline Review',
    accountName: 'acme-dev',
    accountId: '456789012345',
    region: 'us-east-2',
    cloud: 'aws',
    status: 'warning',
    score: 67,
    lastRun: '3d ago',
    checks: 45,
    pillars: { reliability: 70, security: 60, cost: 72, operations: 65, performance: 68 },
  },
  {
    id: 'A-005',
    name: 'GKE Production Review',
    accountName: 'acme-gcp-prod',
    accountId: 'proj-gcp-9941',
    region: 'us-central1',
    cloud: 'gcp',
    status: 'complete',
    score: 91,
    lastRun: '4d ago',
    checks: 45,
    pillars: { reliability: 92, security: 89, cost: 94, operations: 90, performance: 90 },
  },
  {
    id: 'A-006',
    name: 'Cost Optimisation Review',
    accountName: 'acme-production',
    accountId: '124890123456',
    region: 'eu-west-1',
    cloud: 'aws',
    status: 'complete',
    score: 92,
    lastRun: '5d ago',
    checks: 45,
    pillars: { reliability: 89, security: 95, cost: 96, operations: 90, performance: 90 },
  },
  {
    id: 'A-007',
    name: 'AKS Security Hardening Review',
    accountName: 'AcmeCorp-CoreSub',
    accountId: 'sub-7712-9901',
    region: 'westeurope',
    cloud: 'azure',
    status: 'fail',
    score: 54,
    lastRun: '1wk ago',
    checks: 45,
    pillars: { reliability: 55, security: 48, cost: 60, operations: 52, performance: 55 },
  },
];

export const INITIAL_MILESTONES: AssessmentMilestone[] = [
  {
    id: 'MS-001-1',
    assessmentId: 'A-001',
    milestoneNumber: 1,
    milestoneName: 'Initial Cloud Migration Baseline',
    version: 'v1.0',
    recordedAt: 'Aug 14, 2026, 11:20 AM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 68,
    totalBestPractices: 16,
    passedBps: 8,
    failedBps: 8,
    totalChecks: 45,
    passedChecks: 26,
    failedChecks: 19,
    highRisks: 9,
    mediumRisks: 7,
    lowRisks: 3,
    notes: 'Baseline architecture evaluation immediately following cloud migration. Identified multiple missing backup schedules and unencrypted EBS volumes.',
    pillarScores: {
      reliability: 65,
      security: 58,
      cost: 74,
      operations: 70,
      performance: 73,
    },
    pillarHighRisks: {
      reliability: 2,
      security: 4,
      cost: 1,
      operations: 1,
      performance: 1,
    },
  },
  {
    id: 'MS-001-2',
    assessmentId: 'A-001',
    milestoneNumber: 2,
    milestoneName: 'Q3 Security & Reliability Hardening Sprint',
    version: 'v1.1',
    recordedAt: 'Sep 05, 2026, 03:45 PM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 79,
    totalBestPractices: 16,
    passedBps: 11,
    failedBps: 5,
    totalChecks: 45,
    passedChecks: 33,
    failedChecks: 12,
    highRisks: 5,
    mediumRisks: 5,
    lowRisks: 2,
    notes: 'Completed S3 bucket public access blocks, enforced KMS CMK customer-managed keys, and added RDS Multi-AZ failover configurations.',
    pillarScores: {
      reliability: 82,
      security: 74,
      cost: 85,
      operations: 76,
      performance: 78,
    },
    pillarHighRisks: {
      reliability: 1,
      security: 3,
      cost: 0,
      operations: 0,
      performance: 1,
    },
  },
  {
    id: 'MS-002-1',
    assessmentId: 'A-002',
    milestoneNumber: 1,
    milestoneName: 'Staging Environment Architecture Baseline',
    version: 'v1.0',
    recordedAt: 'Sep 10, 2026, 09:15 AM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 68,
    totalBestPractices: 16,
    passedBps: 9,
    failedBps: 7,
    totalChecks: 45,
    passedChecks: 28,
    failedChecks: 17,
    highRisks: 7,
    mediumRisks: 6,
    lowRisks: 4,
    notes: 'Initial staging review prior to automated CI/CD pipeline integration.',
    pillarScores: {
      reliability: 70,
      security: 65,
      cost: 72,
      operations: 66,
      performance: 67,
    },
    pillarHighRisks: {
      reliability: 2,
      security: 3,
      cost: 1,
      operations: 0,
      performance: 1,
    },
  },
  {
    id: 'MS-003-1',
    assessmentId: 'A-003',
    milestoneNumber: 1,
    milestoneName: 'Azure Data Platform Architecture Review',
    version: 'v1.0',
    recordedAt: 'Sep 01, 2026, 02:00 PM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 74,
    totalBestPractices: 16,
    passedBps: 10,
    failedBps: 6,
    totalChecks: 45,
    passedChecks: 31,
    failedChecks: 14,
    highRisks: 6,
    mediumRisks: 5,
    lowRisks: 3,
    notes: 'Assessment of Azure Synapse and Data Lake Storage Gen2 security boundary.',
    pillarScores: {
      reliability: 74,
      security: 70,
      cost: 78,
      operations: 75,
      performance: 73,
    },
    pillarHighRisks: {
      reliability: 1,
      security: 3,
      cost: 0,
      operations: 1,
      performance: 1,
    },
  },
  {
    id: 'MS-004-1',
    assessmentId: 'A-004',
    milestoneNumber: 1,
    milestoneName: 'Dev Baseline Environment Review',
    version: 'v1.0',
    recordedAt: 'Sep 02, 2026, 11:00 AM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 62,
    totalBestPractices: 16,
    passedBps: 9,
    failedBps: 7,
    totalChecks: 45,
    passedChecks: 27,
    failedChecks: 18,
    highRisks: 8,
    mediumRisks: 6,
    lowRisks: 4,
    notes: 'Dev cluster initial configuration review before staging rollout.',
    pillarScores: {
      reliability: 68,
      security: 55,
      cost: 70,
      operations: 60,
      performance: 65,
    },
    pillarHighRisks: {
      reliability: 2,
      security: 4,
      cost: 1,
      operations: 1,
      performance: 0,
    },
  },
  {
    id: 'MS-005-1',
    assessmentId: 'A-005',
    milestoneNumber: 1,
    milestoneName: 'GKE Cluster Production Readiness',
    version: 'v1.0',
    recordedAt: 'Sep 04, 2026, 04:30 PM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 86,
    totalBestPractices: 16,
    passedBps: 13,
    failedBps: 3,
    totalChecks: 45,
    passedChecks: 39,
    failedChecks: 6,
    highRisks: 2,
    mediumRisks: 3,
    lowRisks: 1,
    notes: 'GKE cluster network policies and workload identity verification completed.',
    pillarScores: {
      reliability: 88,
      security: 85,
      cost: 90,
      operations: 86,
      performance: 88,
    },
    pillarHighRisks: {
      reliability: 0,
      security: 2,
      cost: 0,
      operations: 0,
      performance: 0,
    },
  },
  {
    id: 'MS-006-1',
    assessmentId: 'A-006',
    milestoneNumber: 1,
    milestoneName: 'Q3 Compute & Storage Optimization',
    version: 'v1.0',
    recordedAt: 'Sep 12, 2026, 10:30 AM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 85,
    totalBestPractices: 16,
    passedBps: 13,
    failedBps: 3,
    totalChecks: 45,
    passedChecks: 38,
    failedChecks: 7,
    highRisks: 2,
    mediumRisks: 4,
    lowRisks: 1,
    notes: 'Applied Compute Savings Plans and lifecycle policies on historical S3 buckets.',
    pillarScores: {
      reliability: 84,
      security: 90,
      cost: 92,
      operations: 85,
      performance: 85,
    },
    pillarHighRisks: {
      reliability: 1,
      security: 0,
      cost: 1,
      operations: 0,
      performance: 0,
    },
  },
  {
    id: 'MS-007-1',
    assessmentId: 'A-007',
    milestoneNumber: 1,
    milestoneName: 'AKS Security Audit Baseline',
    version: 'v1.0',
    recordedAt: 'Sep 08, 2026, 01:15 PM',
    recordedBy: 'Lezin VM (Lead Architect)',
    score: 48,
    totalBestPractices: 16,
    passedBps: 7,
    failedBps: 9,
    totalChecks: 45,
    passedChecks: 22,
    failedChecks: 23,
    highRisks: 11,
    mediumRisks: 8,
    lowRisks: 4,
    notes: 'Identified missing Azure Defender for Containers and open NSG inbound rules.',
    pillarScores: {
      reliability: 50,
      security: 42,
      cost: 58,
      operations: 48,
      performance: 50,
    },
    pillarHighRisks: {
      reliability: 3,
      security: 5,
      cost: 1,
      operations: 1,
      performance: 1,
    },
  },
];
