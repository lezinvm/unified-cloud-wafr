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
  totalBestPractices?: number;
  passedBps?: number;
  failedBps?: number;
  totalChecks?: number;
  passedChecks?: number;
  failedChecks?: number;
  highRisks?: number;
  mediumRisks?: number;
  lowRisks?: number;
  rerunCount?: number;
  isRerun?: boolean;
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

export const INITIAL_ASSESSMENTS: AssessmentInfo[] = [];

export const INITIAL_MILESTONES: AssessmentMilestone[] = [];
