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

export const INITIAL_JIRA_TICKETS: Record<string, LinkedJiraTicket> = {};

export const INITIAL_ALERT_LOGS: AlertLogItem[] = [];
