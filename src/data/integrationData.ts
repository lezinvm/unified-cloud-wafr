export interface SlackIntegration {
  connected: boolean;
  webhookUrl: string;
  channel: string;
  botName: string;
  notifyCriticalHri: boolean;
  notifyHighHri: boolean;
  notifyScanComplete: boolean;
  notifyScoreDrop: boolean;
  scoreDropThreshold: number; // e.g. 75
  notifyRemediationPr: boolean;
  dailyDigest: boolean;
  lastTested?: string;
}

export interface JiraIntegration {
  connected: boolean;
  host: string; // e.g. "cloudifyops.atlassian.net"
  projectKey: string; // e.g. "WAFR"
  issueType: string; // e.g. "Security Finding"
  userEmail: string;
  apiToken: string;
  autoCreateCriticalTickets: boolean;
  autoCreateHighTickets: boolean;
  syncResolutions: boolean;
  defaultAssignee: string;
  priorityMapping: {
    critical: string;
    high: string;
    medium: string;
    low: string;
  };
  lastTested?: string;
}

export interface GChatIntegration {
  connected: boolean;
  webhookUrl: string;
  spaceName: string; // e.g. "Cloud Architecture Alerts"
  notifyCriticalHri: boolean;
  notifyHighHri: boolean;
  notifyScanComplete: boolean;
  notifyScoreDrop: boolean;
  scoreDropThreshold: number; // e.g. 80
  notifyRemediationPr: boolean;
  lastTested?: string;
}

export interface IntegrationsState {
  slack: SlackIntegration;
  jira: JiraIntegration;
  gchat: GChatIntegration;
}

export interface AlertLogItem {
  id: string;
  timestamp: string;
  service: 'slack' | 'jira' | 'gchat';
  title: string;
  details: string;
  status: 'delivered' | 'failed' | 'queued';
  severity: 'critical' | 'high' | 'info';
  assessmentName?: string;
}

export const INITIAL_INTEGRATIONS: IntegrationsState = {
  slack: {
    connected: true,
    webhookUrl: 'https://hooks.slack.com/services/T04A99/B06X11/99248a91283',
    channel: '#cloud-security-alerts',
    botName: 'CloudifyOps WAFR Bot',
    notifyCriticalHri: true,
    notifyHighHri: true,
    notifyScanComplete: true,
    notifyScoreDrop: true,
    scoreDropThreshold: 80,
    notifyRemediationPr: true,
    dailyDigest: true,
    lastTested: '10m ago (Success)',
  },
  jira: {
    connected: true,
    host: 'cloudifyops.atlassian.net',
    projectKey: 'WAFR',
    issueType: 'Security Finding',
    userEmail: 'devops-bot@cloudifyops.com',
    apiToken: '••••••••••••••••••••••••••••••••',
    autoCreateCriticalTickets: true,
    autoCreateHighTickets: true,
    syncResolutions: true,
    defaultAssignee: 'Lezin VM (Lead Architect)',
    priorityMapping: {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    },
    lastTested: '1h ago (Connected)',
  },
  gchat: {
    connected: true,
    webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAAA12948/messages?key=AIzaSyB...&token=xyz123',
    spaceName: 'Cloud Architecture & Security Alerts',
    notifyCriticalHri: true,
    notifyHighHri: true,
    notifyScanComplete: true,
    notifyScoreDrop: true,
    scoreDropThreshold: 80,
    notifyRemediationPr: true,
    lastTested: '25m ago (Success)',
  },
};

export interface LinkedJiraTicket {
  id: string;
  checkId: string;
  key: string; // e.g. "WAFR-142"
  summary: string;
  description: string;
  priority: 'Highest' | 'High' | 'Medium' | 'Low';
  status: 'To Do' | 'In Progress' | 'In Review' | 'Done';
  assignee: string;
  projectKey: string;
  createdAt: string;
  url: string;
}

export const INITIAL_JIRA_TICKETS: Record<string, LinkedJiraTicket> = {
  'sec-01': {
    id: 'jira-sec-01',
    checkId: 'sec-01',
    key: 'WAFR-142',
    summary: 'S3 Buckets Lack Default Server-Side Encryption (KMS)',
    description: 'Enforce AWS KMS CMK default encryption on all production S3 buckets across us-east-1 to comply with Security Pillar best practices.',
    priority: 'Highest',
    status: 'In Progress',
    assignee: 'Lezin VM (Lead Architect)',
    projectKey: 'WAFR',
    createdAt: '2 hours ago',
    url: 'https://cloudifyops.atlassian.net/browse/WAFR-142',
  },
  'sec-02': {
    id: 'jira-sec-02',
    checkId: 'sec-02',
    key: 'WAFR-143',
    summary: 'IAM Root User Account Has Active Access Keys',
    description: 'Root account access keys detected in active state. Delete root access keys and enforce break-glass IAM roles with MFA.',
    priority: 'Highest',
    status: 'To Do',
    assignee: 'Security Operations',
    projectKey: 'WAFR',
    createdAt: '2 hours ago',
    url: 'https://cloudifyops.atlassian.net/browse/WAFR-143',
  },
  'rel-01': {
    id: 'jira-rel-01',
    checkId: 'rel-01',
    key: 'WAFR-144',
    summary: 'Single-AZ Database Instance Deployment in Production',
    description: 'RDS Aurora cluster has no Multi-AZ replica configured in secondary availability zone, posing high availability outage risk.',
    priority: 'High',
    status: 'To Do',
    assignee: 'Database Platform Team',
    projectKey: 'WAFR',
    createdAt: '3 hours ago',
    url: 'https://cloudifyops.atlassian.net/browse/WAFR-144',
  },
};

export const INITIAL_ALERT_LOGS: AlertLogItem[] = [
  {
    id: 'ALT-1092',
    timestamp: '2 hours ago',
    service: 'slack',
    title: 'Scan Completed: AWS Production — us-east-1 Full Review',
    details: 'WAFR score: 84%. Found 4 HRIs (Security: 3, Reliability: 1). Dispatched to #cloud-security-alerts.',
    status: 'delivered',
    severity: 'info',
    assessmentName: 'AWS Production — us-east-1 Full Review',
  },
  {
    id: 'ALT-1091',
    timestamp: '2 hours ago',
    service: 'jira',
    title: 'Auto-Created Jira Ticket: WAFR-142 (S3 Public Access Block Missing)',
    details: 'Created Security Finding ticket in project WAFR. Assigned to Lezin VM.',
    status: 'delivered',
    severity: 'critical',
    assessmentName: 'AWS Production — us-east-1 Full Review',
  },
  {
    id: 'ALT-1090',
    timestamp: '2 hours ago',
    service: 'gchat',
    title: 'High Risk Alert Triggered: IAM Wildcard Admin Permissions',
    details: 'Dispatched alert card to Google Chat space "Cloud Architecture & Security Alerts".',
    status: 'delivered',
    severity: 'critical',
    assessmentName: 'AWS Production — us-east-1 Full Review',
  },
];
