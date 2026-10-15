import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import {
  AssessmentInfo,
  AssessmentMilestone,
  INITIAL_ASSESSMENTS,
  INITIAL_MILESTONES,
} from './data/assessmentData';
import { QuestionnaireItem, INITIAL_ORG_QUESTIONS } from './data/questionnaireData';
import { ScheduledAssessment, INITIAL_SCHEDULED_ASSESSMENTS } from './data/scheduleData';
import {
  IntegrationsState,
  INITIAL_INTEGRATIONS,
  LinkedJiraTicket,
  INITIAL_JIRA_TICKETS,
  AlertLogItem,
  INITIAL_ALERT_LOGS,
} from './data/integrationData';
import {
  ComplianceFramework,
  INITIAL_COMPLIANCE_FRAMEWORKS,
} from './data/complianceData';
import { PillarData, PILLARS_DATA } from './data/wafrData';
import { api } from './services/apiClient';


export type Cloud = 'aws' | 'azure' | 'gcp';
export type Theme = 'light' | 'dark';
export type LensType = 'wafr' | 'genai' | 'finops';

export type Screen =
  | 'login'
  | 'dashboard'
  | 'org-questions'
  | 'select-cloud'
  | 'select-lens'
  | 'assessment-list'
  | 'wizard'
  | 'live-scan'
  | 'report'
  | 'pillar-detail'
  | 'milestones'
  | 'remediation'
  | 'ai-fix'
  | 'diagram'
  | 'integrations'
  | 'compliance'
  | 'settings'
  | 'admin'
  | 'onboarding';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  avatar?: string;
  company?: string;
  orgId?: string;
  isNewUser?: boolean;
}

export const PRESET_USERS: UserProfile[] = [
  {
    id: '3bb7b2e4-bcf7-4f12-820b-a1c7a7c434e0',
    name: 'Lezin V M',
    email: 'lezin.menath@cloudifyops.com',
    role: 'user',
    company: 'CloudifyOps',
    orgId: 'org_lezin_menath',
    isNewUser: false,
  },
  {
    id: 'user-new',
    name: 'Alex Rivera',
    email: 'newuser@cloudifyops.com',
    role: 'user',
    company: 'Acme Corp',
    orgId: 'org_new_user',
    isNewUser: true,
  },
  {
    id: 'user-admin',
    name: 'Administrator',
    email: 'admin@cloudifyops.com',
    role: 'admin',
    company: 'CloudifyOps Admin',
    orgId: 'org_admin',
    isNewUser: false,
  },
];

interface UserDataStore {
  assessments: AssessmentInfo[];
  milestones: AssessmentMilestone[];
  scheduledAssessments: ScheduledAssessment[];
  integrations: IntegrationsState;
  jiraTickets?: Record<string, LinkedJiraTicket>;
  alertLogs?: AlertLogItem[];
  complianceFrameworks?: ComplianceFramework[];
  pinnedComplianceIds?: Record<string, boolean>;
  configuredAccount: ConfiguredAccount | null;
  configuredAccounts: Record<Cloud, ConfiguredAccount | null>;
  repoConfig: RepoConfig;
  solvedCheckIds: Record<string, boolean>;
  resourceRemediations: Record<string, { status: 'fixed' | 'cant_fix' | 'pending'; note?: string }>;
  orgQuestions: QuestionnaireItem[];
  theme: Theme;
}

export interface ToastItem {
  id: string;
  message: string;
  type: 'slack' | 'jira' | 'gchat' | 'success' | 'info';
  details?: string;
}

interface AppState {
  screen: Screen;
  previousScreen: Screen;
  currentUser: UserProfile;
  setCurrentUser: (u: UserProfile) => void;
  loginUser: (email: string, role?: 'user' | 'admin', name?: string, isNew?: boolean, customUserId?: string, customOrgId?: string) => void;
  logoutUser: () => void;
  switchUser: (userId: string) => void;
  cloud: Cloud | null;
  setCloud: (c: Cloud | null) => void;
  selectedLens: LensType;
  setSelectedLens: (l: LensType) => void;
  selectedAssessmentId: string;
  setSelectedAssessmentId: (id: string) => void;
  selectAssessment: (id: string, targetScreen?: Screen) => void;
  assessments: AssessmentInfo[];
  runOrUpdateAssessment: (config: {
    cloud: Cloud;
    accountId: string;
    accountName?: string;
    region: string;
    name?: string;
  }) => { isRerun: boolean; assessment: AssessmentInfo };
  completeAssessment: (id: string, score?: number) => void;
  deleteAssessment: (id: string) => Promise<void>;
  currentAssessment: AssessmentInfo | null;
  milestones: AssessmentMilestone[];
  currentMilestones: AssessmentMilestone[];
  addMilestone: (m: {
    milestoneName: string;
    version: string;
    notes: string;
    score?: number;
    totalBestPractices?: number;
    passedBps?: number;
    failedBps?: number;
    totalChecks?: number;
    passedChecks?: number;
    failedChecks?: number;
    highRisks?: number;
    mediumRisks?: number;
    lowRisks?: number;
    pillarScores?: {
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
  }) => AssessmentMilestone;
  deleteMilestone: (id: string) => void;
  selectedPillarId: string;
  setSelectedPillarId: (id: string) => void;
  selectPillar: (id: string) => void;
  remediationFindingId: string | null;
  setRemediationFindingId: (id: string | null) => void;
  goToRemediation: (assessmentId?: string) => void;
  goToAIFix: (checkId: string) => void;
  solvedCheckIds: Record<string, boolean>;
  toggleCheckSolved: (id: string) => void;
  markCheckSolved: (id: string, solved?: boolean) => void;
  resourceRemediations: Record<string, { status: 'fixed' | 'cant_fix' | 'pending'; note?: string }>;
  setResourceRemediationStatus: (
    checkId: string,
    resourceRaw: string,
    status: 'fixed' | 'cant_fix' | 'pending',
    note?: string
  ) => void;
  getCheckRemediationStatus: (checkId: string, resources: string[]) => 'fixed' | 'in_progress' | 'cant_fix' | 'pending';
  repoConfig: RepoConfig;
  setRepoConfig: React.Dispatch<React.SetStateAction<RepoConfig>>;
  orgQuestions: QuestionnaireItem[];
  setOrgQuestions: React.Dispatch<React.SetStateAction<QuestionnaireItem[]>>;
  updateOrgQuestion: (id: string, ans: string, answered?: boolean) => void;
  toggleOrgCheck: (questionId: string, checkId: string) => void;
  toggleAllOrgChecks: (questionId: string, verified: boolean) => void;
  wizardStep: 1 | 2 | 3;
  theme: Theme;
  isNewUser: boolean;
  setIsNewUser: (b: boolean) => void;
  scheduledAssessments: ScheduledAssessment[];
  addScheduledAssessment: (data: Omit<ScheduledAssessment, 'id' | 'createdAt' | 'status'>) => ScheduledAssessment;
  updateScheduledAssessment: (id: string, updates: Partial<ScheduledAssessment>) => void;
  deleteScheduledAssessment: (id: string) => void;
  toggleScheduleStatus: (id: string) => void;
  runScheduledAssessmentNow: (id: string) => void;
  integrations: IntegrationsState;
  updateIntegrations: (updates: Partial<IntegrationsState>) => void;
  jiraTickets: Record<string, LinkedJiraTicket>;
  alertLogs: AlertLogItem[];
  createJiraTicketForCheck: (checkId: string, title: string, severity?: string, details?: string) => LinkedJiraTicket;
  updateJiraTicketStatus: (checkId: string, status: LinkedJiraTicket['status']) => void;
  sendSlackNotification: (payload: { title: string; message: string; severity?: 'critical' | 'high' | 'info'; channel?: string; checkId?: string }) => void;
  sendGChatNotification: (payload: { title: string; message: string; severity?: 'critical' | 'high' | 'info'; spaceName?: string; checkId?: string }) => void;
  bulkCreateJiraTickets: (checks: { id: string; title: string; severity: string }[]) => number;
  addAlertLog: (log: Omit<AlertLogItem, 'id' | 'timestamp'>) => void;
  toast: ToastItem | null;
  showToast: (message: string, type?: 'slack' | 'jira' | 'gchat' | 'success' | 'info', details?: string) => void;
  clearToast: () => void;
  pillars: PillarData[];
  setPillars: React.Dispatch<React.SetStateAction<PillarData[]>>;
  complianceFrameworks: ComplianceFramework[];
  selectedComplianceFrameworkId: string | null;
  setSelectedComplianceFrameworkId: (id: string | null) => void;
  pinnedComplianceIds: Record<string, boolean>;
  togglePinComplianceFramework: (id: string) => void;
  goToComplianceFramework: (id: string) => void;
  configuredAccount: ConfiguredAccount | null;
  setConfiguredAccount: (acc: ConfiguredAccount | null) => void;
  configuredAccounts: Record<Cloud, ConfiguredAccount | null>;
  cloudAccounts: any[];
  setCloudAccounts: React.Dispatch<React.SetStateAction<any[]>>;
  isCloudConfigured: (c: Cloud) => boolean;
  getConfiguredAccount: (c: Cloud) => ConfiguredAccount | null;
  userRole: 'user' | 'admin';
  setUserRole: (r: 'user' | 'admin') => void;
  adminTab: 'users' | 'tokens';
  setAdminTab: (t: 'users' | 'tokens') => void;
  go: (s: Screen) => void;
  selectCloud: (c: Cloud) => void;
  setWizardStep: (s: 1 | 2 | 3) => void;
  toggleTheme: () => void;
  isTourOpen: boolean;
  setIsTourOpen: (b: boolean) => void;
  startTour: () => void;
  closeTour: () => void;
  accent: string;
  accentLight: string;
  cloudLabel: string;
  cloudShort: string;
  dbConnected: boolean;
  refreshFromDb: () => Promise<void>;
}

export interface RepoConfig {
  provider: 'github' | 'gitlab' | 'bitbucket';
  repoName: string;
  branch: string;
  pat: string;
  connected: boolean;
  lastSync?: string;
  autoCreatePr?: boolean;
}

export interface ConfiguredAccount {
  cloud: Cloud;
  name: string;
  id: string;
  authType?: string;
  roleArn?: string;
  tenantId?: string;
  projectId?: string;
}

const AppContext = createContext<AppState>({} as AppState);

const ACCENTS: Record<Cloud, string> = { aws: '#FF9900', azure: '#0078D4', gcp: '#4285F4' };
const ACCENT_LIGHTS: Record<Cloud, string> = { aws: '#FFF4E0', azure: '#E5F1FB', gcp: '#E8F0FE' };
const LABELS: Record<Cloud, string> = { aws: 'Amazon Web Services', azure: 'Microsoft Azure', gcp: 'Google Cloud' };
const SHORTS: Record<Cloud, string> = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' };

const STORAGE_PREFIX = 'lens_user_data_v3_';

function getDefaultUserData(userId: string): UserDataStore {
  const isDemo = userId === 'user-admin';
  if (!isDemo) {
    return {
      assessments: [],
      milestones: [],
      scheduledAssessments: [],
      integrations: INITIAL_INTEGRATIONS,
      jiraTickets: {},
      alertLogs: [],
      configuredAccount: null,
      configuredAccounts: {
        aws: null,
        azure: null,
        gcp: null,
      },
      repoConfig: {
        provider: 'github',
        repoName: '',
        branch: 'main',
        pat: '',
        connected: false,
      },
      complianceFrameworks: INITIAL_COMPLIANCE_FRAMEWORKS,
      pinnedComplianceIds: {
        'cis-8.1': true,
        'fedramp-ksi': true,
        'soc2-type2': true,
        'iso-27001': true,
        'aws-fsbp': true,
      },
      solvedCheckIds: {},
      resourceRemediations: {},
      orgQuestions: INITIAL_ORG_QUESTIONS.map(q => ({ ...q, answered: false, ans: '' })),
      theme: 'light',
    };
  }

  // Default active user (Lezin VM demo)
  return {
    assessments: INITIAL_ASSESSMENTS,
    milestones: INITIAL_MILESTONES,
    scheduledAssessments: INITIAL_SCHEDULED_ASSESSMENTS,
    integrations: INITIAL_INTEGRATIONS,
    jiraTickets: INITIAL_JIRA_TICKETS,
    alertLogs: INITIAL_ALERT_LOGS,
    complianceFrameworks: INITIAL_COMPLIANCE_FRAMEWORKS,
    pinnedComplianceIds: {
      'cis-8.1': true,
      'fedramp-ksi': true,
      'soc2-type2': true,
      'iso-27001': true,
      'aws-fsbp': true,
    },
    configuredAccount: {
      cloud: 'aws',
      name: 'acme-production',
      id: '124890123456',
      authType: 'role',
      roleArn: 'arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole',
    },
    configuredAccounts: {
      aws: {
        cloud: 'aws',
        name: 'acme-production',
        id: '124890123456',
        authType: 'role',
        roleArn: 'arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole',
      },
      azure: {
        cloud: 'azure',
        name: 'AcmeCorp-ProductionSub',
        id: 'sub-1248-9012',
        authType: 'service-principal',
        tenantId: 'tenant-9901-4412-2291',
      },
      gcp: {
        cloud: 'gcp',
        name: 'acme-gcp-prod',
        id: 'proj-gcp-9941',
        authType: 'service-account',
        projectId: 'proj-gcp-prod-9941',
      },
    },
    repoConfig: {
      provider: 'github',
      repoName: 'acme-corp/terraform-aws-infrastructure',
      branch: 'main',
      pat: 'ghp_live983274982374982374982374',
      connected: true,
      lastSync: '10m ago',
      autoCreatePr: true,
    },
    solvedCheckIds: {},
    resourceRemediations: {},
    orgQuestions: INITIAL_ORG_QUESTIONS,
    theme: 'light',
  };
}

function loadUserData(userId: string): UserDataStore {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_PREFIX + userId) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.configuredAccounts) {
        parsed.configuredAccounts = {
          aws: parsed.configuredAccount?.cloud === 'aws' ? parsed.configuredAccount : null,
          azure: parsed.configuredAccount?.cloud === 'azure' ? parsed.configuredAccount : null,
          gcp: parsed.configuredAccount?.cloud === 'gcp' ? parsed.configuredAccount : null,
        };
      }
      const isDemo = userId === 'user-admin';
      if (!parsed.scheduledAssessments) {
        parsed.scheduledAssessments = isDemo ? INITIAL_SCHEDULED_ASSESSMENTS : [];
      }
      parsed.integrations = {
        slack: { ...INITIAL_INTEGRATIONS.slack, ...(parsed.integrations?.slack || {}) },
        jira: { ...INITIAL_INTEGRATIONS.jira, ...(parsed.integrations?.jira || {}) },
        gchat: { ...INITIAL_INTEGRATIONS.gchat, ...(parsed.integrations?.gchat || {}) },
      };
      if (!parsed.jiraTickets) {
        parsed.jiraTickets = isDemo ? INITIAL_JIRA_TICKETS : {};
      }
      if (!parsed.alertLogs) {
        parsed.alertLogs = isDemo ? INITIAL_ALERT_LOGS : [];
      }
      return parsed;
    }
  } catch (e) {
    console.error('Error loading user data:', e);
  }
  return getDefaultUserData(userId);
}

function saveUserData(userId: string, data: UserDataStore) {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_PREFIX + userId, JSON.stringify(data));
    }
  } catch (e) {
    console.error('Error saving user data:', e);
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<UserProfile>(() => {
    try {
      const savedUser = typeof window !== 'undefined' ? localStorage.getItem('lens_active_user') : null;
      if (savedUser) return JSON.parse(savedUser);
    } catch {}
    return PRESET_USERS[0];
  });

  const initialData = loadUserData(currentUser.id);

  const [screen, setScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('dashboard');
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [selectedLens, setSelectedLens] = useState<LensType>('wafr');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(
    initialData.assessments[0]?.id || 'A-001'
  );
  const [assessments, setAssessments] = useState<AssessmentInfo[]>(initialData.assessments);
  const [milestones, setMilestones] = useState<AssessmentMilestone[]>(initialData.milestones);
  const [scheduledAssessments, setScheduledAssessments] = useState<ScheduledAssessment[]>(
    initialData.scheduledAssessments || []
  );
  const [integrations, setIntegrations] = useState<IntegrationsState>(
    initialData.integrations || INITIAL_INTEGRATIONS
  );
  const [jiraTickets, setJiraTickets] = useState<Record<string, LinkedJiraTicket>>(
    initialData.jiraTickets || INITIAL_JIRA_TICKETS
  );
  const [alertLogs, setAlertLogs] = useState<AlertLogItem[]>(
    initialData.alertLogs || INITIAL_ALERT_LOGS
  );
  const [toast, setToast] = useState<ToastItem | null>(null);

  const showToast = (message: string, type: ToastItem['type'] = 'info', details?: string) => {
    const id = `toast-${Date.now()}`;
    setToast({ id, message, type, details });
  };

  const clearToast = () => setToast(null);

  const addAlertLog = (log: Omit<AlertLogItem, 'id' | 'timestamp'>) => {
    const item: AlertLogItem = {
      ...log,
      id: `ALT-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: 'Just now',
    };
    setAlertLogs(prev => [item, ...prev]);

    // Persist alert log directly to MongoDB
    api.saveAlertLog({
      id: item.id,
      service: item.service,
      title: item.title,
      details: item.details,
      status: item.status,
      severity: item.severity,
      assessment_name: item.assessmentName,
      timestamp: item.timestamp,
      created_at: new Date().toISOString(),
    }).catch(err => console.warn('Could not persist alert log to MongoDB:', err));
  };

  const createJiraTicketForCheck = (
    checkId: string,
    title: string,
    severity: string = 'high',
    details?: string
  ): LinkedJiraTicket => {
    const nextNum = 140 + Object.keys(jiraTickets).length + 1;
    const projectKey = integrations.jira.projectKey || 'WAFR';
    const key = `${projectKey}-${nextNum}`;
    const priorityMap: Record<string, 'Highest' | 'High' | 'Medium' | 'Low'> = {
      critical: 'Highest',
      high: 'High',
      medium: 'Medium',
      low: 'Low',
    };
    const priority = priorityMap[severity.toLowerCase()] || 'High';

    const newTicket: LinkedJiraTicket = {
      id: `jira-${checkId}-${Date.now()}`,
      checkId,
      key,
      summary: title,
      description:
        details ||
        `Well-Architected Framework Finding: ${title}. Requires architectural remediation in accordance with security & reliability best practices.`,
      priority,
      status: 'To Do',
      assignee: integrations.jira.defaultAssignee || currentUser.name || 'Lead Architect',
      projectKey,
      createdAt: 'Just now',
      url: `https://${integrations.jira.host || 'cloudifyops.atlassian.net'}/browse/${key}`,
    };

    setJiraTickets(prev => ({
      ...prev,
      [checkId]: newTicket,
    }));

    // Persist Jira ticket directly to MongoDB
    api.saveJiraTicket({
      id: newTicket.id,
      check_id: newTicket.checkId,
      key: newTicket.key,
      summary: newTicket.summary,
      description: newTicket.description,
      priority: newTicket.priority,
      status: newTicket.status,
      assignee: newTicket.assignee,
      project_key: newTicket.projectKey,
      url: newTicket.url,
      created_at: new Date().toISOString(),
    }).catch(err => console.warn('Could not persist jira ticket to MongoDB:', err));

    addAlertLog({
      service: 'jira',
      title: `Created Jira Issue: ${key} (${title})`,
      details: `Dispatched ${priority} priority ticket to Jira Project ${projectKey}. Assigned to ${newTicket.assignee}.`,
      status: 'delivered',
      severity: severity.toLowerCase() === 'critical' ? 'critical' : 'high',
      assessmentName: currentAssessment?.name,
    });

    showToast(`Created Jira Ticket ${key}`, 'jira', title);

    return newTicket;
  };

  const updateJiraTicketStatus = (checkId: string, status: LinkedJiraTicket['status']) => {
    setJiraTickets(prev => {
      const existing = prev[checkId];
      if (!existing) return prev;
      const updated = { ...existing, status };
      return { ...prev, [checkId]: updated };
    });

    const ticket = jiraTickets[checkId];
    if (ticket) {
      // Sync update to MongoDB
      api.saveJiraTicket({
        ...ticket,
        status,
        check_id: checkId,
        updated_at: new Date().toISOString(),
      }).catch(err => console.warn('Could not update jira ticket status in MongoDB:', err));

      addAlertLog({
        service: 'jira',
        title: `Jira Ticket ${ticket.key} Status Synced: ${status}`,
        details: `Issue ${ticket.key} status synchronized in Jira Software to ${status}.`,
        status: 'delivered',
        severity: 'info',
        assessmentName: currentAssessment?.name,
      });
      showToast(`Jira ${ticket.key} updated to ${status}`, 'jira', ticket.summary);
    }
  };

  const sendSlackNotification = (payload: {
    title: string;
    message: string;
    severity?: 'critical' | 'high' | 'info';
    channel?: string;
    checkId?: string;
  }) => {
    const channel = payload.channel || integrations.slack.channel || '#cloud-security-alerts';
    addAlertLog({
      service: 'slack',
      title: payload.title,
      details: `${payload.message} (Dispatched to ${channel})`,
      status: 'delivered',
      severity: payload.severity || 'info',
      assessmentName: currentAssessment?.name,
    });
    showToast(`Slack Alert Sent to ${channel}`, 'slack', payload.title);
  };

  const sendGChatNotification = (payload: {
    title: string;
    message: string;
    severity?: 'critical' | 'high' | 'info';
    spaceName?: string;
    checkId?: string;
  }) => {
    const space = payload.spaceName || integrations.gchat.spaceName || 'Cloud Architecture & Security Alerts';
    addAlertLog({
      service: 'gchat',
      title: payload.title,
      details: `${payload.message} (Dispatched to Google Chat space "${space}")`,
      status: 'delivered',
      severity: payload.severity || 'info',
      assessmentName: currentAssessment?.name,
    });
    showToast(`Google Chat Alert Sent to ${space}`, 'gchat', payload.title);
  };

  const bulkCreateJiraTickets = (checks: { id: string; title: string; severity: string }[]): number => {
    let createdCount = 0;
    checks.forEach(c => {
      if (!jiraTickets[c.id]) {
        createJiraTicketForCheck(c.id, c.title, c.severity);
        createdCount++;
      }
    });
    if (createdCount > 0) {
      showToast(`Created ${createdCount} Jira Tickets in Project ${integrations.jira.projectKey || 'WAFR'}`, 'jira');
    }
    return createdCount;
  };
  const [selectedPillarId, setSelectedPillarId] = useState<string>('reliability');
  const [remediationFindingId, setRemediationFindingId] = useState<string | null>(null);
  const [solvedCheckIds, setSolvedCheckIds] = useState<Record<string, boolean>>(initialData.solvedCheckIds);
  const [resourceRemediations, setResourceRemediations] = useState<
    Record<string, { status: 'fixed' | 'cant_fix' | 'pending'; note?: string }>
  >(initialData.resourceRemediations);
  const [repoConfig, setRepoConfigState] = useState<RepoConfig>(initialData.repoConfig);
  const setRepoConfig: React.Dispatch<React.SetStateAction<RepoConfig>> = (action) => {
    setRepoConfigState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      api.saveRepository({
        provider: next.provider,
        repo_name: next.repoName,
        branch: next.branch,
        pat: next.pat,
        connected: next.connected,
        last_sync: next.lastSync || 'Recently',
        auto_create_pr: next.autoCreatePr ?? true,
        user_id: currentUser?.id,
        org_id: currentUser?.orgId || `org_${currentUser?.id}`,
      }).catch(err => console.warn('Could not persist repository config to DB:', err));
      return next;
    });
  };
  const [orgQuestions, setOrgQuestions] = useState<QuestionnaireItem[]>(initialData.orgQuestions);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [theme, setTheme] = useState<Theme>(initialData.theme || 'light');
  const [isNewUser, setIsNewUser] = useState<boolean>(currentUser.isNewUser || initialData.assessments.length === 0);
  const [configuredAccounts, setConfiguredAccounts] = useState<Record<Cloud, ConfiguredAccount | null>>(
    initialData.configuredAccounts || {
      aws: initialData.configuredAccount?.cloud === 'aws' ? initialData.configuredAccount : null,
      azure: initialData.configuredAccount?.cloud === 'azure' ? initialData.configuredAccount : null,
      gcp: initialData.configuredAccount?.cloud === 'gcp' ? initialData.configuredAccount : null,
    }
  );
  const [configuredAccount, setConfiguredAccountState] = useState<ConfiguredAccount | null>(
    initialData.configuredAccount
  );
  const [cloudAccounts, setCloudAccounts] = useState<any[]>([]);

  const setConfiguredAccount = (acc: ConfiguredAccount | null) => {
    setConfiguredAccountState(acc);
    if (acc) {
      setConfiguredAccounts(prev => ({
        ...prev,
        [acc.cloud]: acc,
      }));
    }
  };

  const isCloudConfigured = (c: Cloud): boolean => {
    return Boolean(configuredAccounts[c]);
  };

  const getConfiguredAccount = (c: Cloud): ConfiguredAccount | null => {
    return configuredAccounts[c] || null;
  };

  const [pillars, setPillars] = useState<PillarData[]>(PILLARS_DATA);
  const [complianceFrameworks, setComplianceFrameworks] = useState<ComplianceFramework[]>(
    initialData.complianceFrameworks || INITIAL_COMPLIANCE_FRAMEWORKS
  );
  const [selectedComplianceFrameworkId, setSelectedComplianceFrameworkId] = useState<string | null>(null);
  const [pinnedComplianceIds, setPinnedComplianceIds] = useState<Record<string, boolean>>(
    initialData.pinnedComplianceIds || {
      'cis-8.1': true,
      'fedramp-ksi': true,
      'soc2-type2': true,
      'iso-27001': true,
      'aws-fsbp': true,
    }
  );

  const togglePinComplianceFramework = (id: string) => {
    setPinnedComplianceIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const goToComplianceFramework = (id: string) => {
    setSelectedComplianceFrameworkId(id);
    setPreviousScreen(screen);
    setScreen('compliance');
  };

  const [userRole, setUserRole] = useState<'user' | 'admin'>(currentUser.role);
  const [adminTab, setAdminTab] = useState<'users' | 'tokens'>('users');
  const [isTourOpen, setIsTourOpen] = useState<boolean>(false);
  const [dbConnected, setDbConnected] = useState<boolean>(false);

  const startTour = () => setIsTourOpen(true);
  const closeTour = () => setIsTourOpen(false);

  // Sync assessments and accounts from MongoDB API scoped to the active user
  const refreshFromDb = async (targetUser?: UserProfile) => {
    const userToUse = targetUser || currentUser;
    try {
      const health = await api.checkHealth();
      if (health.status === 'ok') {
        setDbConnected(true);

        let currentUserId = userToUse.id;
        let currentOrgId = userToUse.orgId;

        // Automatically sync real user ID and org ID from MongoDB
        if (userToUse.email) {
          try {
            const dbUsers = await api.getUsers(undefined, userToUse.email);
            if (Array.isArray(dbUsers) && dbUsers.length > 0) {
              const matchedUser = dbUsers[0];
              currentUserId = matchedUser.id || currentUserId;
              currentOrgId = matchedUser.org_id || currentOrgId;
              if (currentUser.id !== matchedUser.id || currentUser.orgId !== matchedUser.org_id) {
                const updated: UserProfile = {
                  ...currentUser,
                  id: matchedUser.id,
                  orgId: matchedUser.org_id,
                  name: matchedUser.name || currentUser.name,
                };
                setCurrentUser(updated);
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lens_active_user', JSON.stringify(updated));
                }
              }
            }
          } catch {}
        }

        const userOrgId = currentOrgId || `org_${currentUserId}`;

        const [dbAssessments, dbAccounts] = await Promise.all([
          api.getAssessments(userOrgId, currentUserId),
          api.getCloudAccounts(userOrgId, currentUserId),
        ]);

        // Sync all cloud accounts for this specific user/organization
        setCloudAccounts(Array.isArray(dbAccounts) ? dbAccounts : []);

        if (Array.isArray(dbAccounts) && dbAccounts.length > 0) {
          const awsAcc = dbAccounts.find((a: any) => a.cloud?.toLowerCase() === 'aws');
          const azAcc = dbAccounts.find((a: any) => a.cloud?.toLowerCase() === 'azure');
          const gcpAcc = dbAccounts.find((a: any) => a.cloud?.toLowerCase() === 'gcp');

          setConfiguredAccounts({
            aws: awsAcc ? { cloud: 'aws', name: awsAcc.account_name, id: String(awsAcc.account_identifier || awsAcc.id) } : null,
            azure: azAcc ? { cloud: 'azure', name: azAcc.account_name, id: String(azAcc.account_identifier || azAcc.id) } : null,
            gcp: gcpAcc ? { cloud: 'gcp', name: gcpAcc.account_name, id: String(gcpAcc.account_identifier || gcpAcc.id) } : null,
          });

          if (awsAcc) {
            setConfiguredAccountState({ cloud: 'aws', name: awsAcc.account_name, id: String(awsAcc.account_identifier || awsAcc.id) });
          } else if (azAcc) {
            setConfiguredAccountState({ cloud: 'azure', name: azAcc.account_name, id: String(azAcc.account_identifier || azAcc.id) });
          } else if (gcpAcc) {
            setConfiguredAccountState({ cloud: 'gcp', name: gcpAcc.account_name, id: String(gcpAcc.account_identifier || gcpAcc.id) });
          } else {
            setConfiguredAccountState(null);
          }
        } else {
          setConfiguredAccounts({ aws: null, azure: null, gcp: null });
          setConfiguredAccountState(null);
        }

        if (Array.isArray(dbAssessments) && dbAssessments.length > 0) {
          const mapped: AssessmentInfo[] = dbAssessments.map((a: any) => {
            const acc = (dbAccounts || []).find((x: any) => x.id === a.cloud_account_id) || {};
            const rawStatus = (a.status || '').toLowerCase();
            const mappedStatus =
              rawStatus === 'running' || rawStatus === 'in_progress'
                ? 'running'
                : rawStatus === 'failed' || rawStatus === 'fail'
                ? 'fail'
                : rawStatus === 'warning'
                ? 'warning'
                : 'complete';

            return {
              id: a.id,
              name: a.name || 'Cloud Review',
              accountName: a.account_name || acc.account_name || 'Production Account',
              accountId: String(a.account_identifier || acc.account_identifier || acc.id || '124890123456'),
              region: a.region || acc.default_region || 'us-east-1',
              cloud: (a.cloud || acc.cloud as Cloud) || 'aws',
              status: mappedStatus,
              score: Number(a.score) || 84,
              lastRun: rawStatus === 'running' ? 'In progress' : (a.last_run_at ? 'Recently' : '2h ago'),
              checks: Number(a.total_checks || a.checks_count) || 46,
              pillars: a.pillar_scores || {
                reliability: 88,
                security: Number(a.score) || 82,
                cost: 90,
                operations: 85,
                performance: 84,
              },
              totalBestPractices: Number(a.total_best_practices) || 16,
              passedBps: Number(a.passed_bps) || 12,
              failedBps: Number(a.failed_bps) || 4,
              totalChecks: Number(a.total_checks || a.checks_count) || 46,
              passedChecks: Number(a.passed_checks) || 36,
              failedChecks: Number(a.failed_checks) || 10,
              highRisks: Number(a.high_risks) || 3,
              mediumRisks: Number(a.medium_risks) || 5,
              lowRisks: Number(a.low_risks) || 2,
            };
          });

          setAssessments(mapped);
          if (mapped[0]) {
            setSelectedAssessmentId(mapped[0].id);
          }
        } else {
          setAssessments([]);
          setSelectedAssessmentId('');
        }

        // Sync milestones directly from MongoDB scoped to this user's assessments
        try {
          const dbMilestones = await api.getMilestones();
          if (Array.isArray(dbMilestones) && dbMilestones.length > 0 && Array.isArray(dbAssessments) && dbAssessments.length > 0) {
            const userAssessmentIds = new Set(dbAssessments.map((a: any) => a.id));
            const userMilestones = dbMilestones.filter((m: any) => userAssessmentIds.has(m.assessment_id));
            const mappedMilestones: AssessmentMilestone[] = userMilestones.map((m: any) => ({
              id: m.id,
              assessmentId: m.assessment_id,
              milestoneNumber: Number(m.milestone_number) || 1,
              milestoneName: m.milestone_name || 'Pre-Audit Baseline',
              version: m.version || 'v1.0.0',
              recordedAt: m.recorded_at || 'Recently',
              recordedBy: m.recorded_by || 'Admin',
              score: Number(m.score) || 84,
              totalBestPractices: Number(m.total_best_practices) || 16,
              passedBps: Number(m.passed_bps) || 12,
              failedBps: Number(m.failed_bps) || 4,
              totalChecks: Number(m.total_checks) || 46,
              passedChecks: Number(m.passed_checks) || 36,
              failedChecks: Number(m.failed_checks) || 10,
              highRisks: Number(m.high_risks) || 3,
              mediumRisks: Number(m.medium_risks) || 5,
              lowRisks: Number(m.low_risks) || 2,
              notes: m.notes || 'Baseline milestone state.',
              pillarScores: m.pillar_scores || {
                reliability: 88,
                security: 82,
                cost: 90,
                operations: 85,
                performance: 84,
              },
              pillarHighRisks: m.pillar_high_risks,
            }));
            setMilestones(mappedMilestones);
          } else {
            setMilestones([]);
          }
        } catch (mErr) {
          console.warn('Could not sync milestones:', mErr);
        }

        // Also sync scheduled assessments, pillars, compliance, integrations, logs, and questions from MongoDB
        try {
          const detectedCloud = ((dbAssessments?.[0]?.cloud || awsAcc?.cloud || azAcc?.cloud || gcpAcc?.cloud || cloud || 'aws') as string).toLowerCase();
          const [
            dbSchedules,
            dbPillars,
            dbFrameworks,
            dbIntegrations,
            dbAlertLogs,
            dbQuestions,
            dbStatuses,
            dbRepos,
            dbJiraTickets,
          ] = await Promise.all([
            api.getScheduledAssessments(userOrgId, userToUse.id),
            api.getPillars(detectedCloud),
            api.getComplianceFrameworks(),
            api.getIntegrations(),
            api.getAlertLogs(),
            api.getQuestionnaireQuestions(),
            api.getRemediationStatuses(),
            api.getRepositories(userOrgId, userToUse.id),
            api.getJiraTickets(),
          ]);

          if (Array.isArray(dbSchedules)) {
            const mappedSchedules: ScheduledAssessment[] = dbSchedules.map((s: any) => ({
              id: s.id,
              name: s.name || 'Automated Review',
              cloud: (s.cloud || (s.name?.toLowerCase().includes('azure') ? 'azure' : s.name?.toLowerCase().includes('gcp') ? 'gcp' : 'aws')) as Cloud,
              accountId: s.cloud_account_id || '123456789012',
              accountName: s.account_name || (s.cloud === 'azure' || s.name?.includes('Azure') ? 'AcmeCorp-AzureSub' : s.cloud === 'gcp' || s.name?.includes('GCP') ? 'AcmeCorp-GCP' : 'Production-AWS'),
              region: s.region || (s.cloud === 'gcp' ? 'us-central1' : s.cloud === 'azure' ? 'eastus' : 'us-east-1'),
              frequency: s.frequency || 'weekly',
              time: s.time_of_day ? `${s.time_of_day} ${s.timezone || 'UTC'}` : '02:00 UTC',
              cronExpression: s.cron_expression || '0 2 * * 1',
              timezone: s.timezone || 'UTC',
              status: s.is_active ? 'active' : 'paused',
              nextRun: s.next_run_at || 'Next scheduled window',
              lastRun: s.last_run_at || 'Never',
              notifySlack: Boolean(s.notify_slack),
              notifyGChat: Boolean(s.notify_gchat),
              notifyJira: Boolean(s.notify_jira),
              autoCreateMilestone: Boolean(s.auto_create_milestone),
              createdAt: s.created_at || 'Recently',
            }));
            setScheduledAssessments(mappedSchedules);
          } else {
            setScheduledAssessments([]);
          }

          if (Array.isArray(dbPillars) && dbPillars.length > 0) {
            const mergedPillars: PillarData[] = PILLARS_DATA.map(staticPillar => {
              const dbP = dbPillars.find((p: any) => p.id === staticPillar.id);
              if (dbP) {
                return {
                  ...staticPillar,
                  label: dbP.label || staticPillar.label,
                  short: dbP.short || staticPillar.short,
                  score: typeof dbP.score === 'number' ? dbP.score : staticPillar.score,
                  color: dbP.color || staticPillar.color,
                  bestPractices: Array.isArray(dbP.bestPractices) && dbP.bestPractices.length > 0 ? dbP.bestPractices : staticPillar.bestPractices || [],
                };
              }
              return staticPillar;
            });
            setPillars(mergedPillars);
          }

          if (Array.isArray(dbStatuses) && dbStatuses.length > 0) {
            const resMap: Record<string, { status: 'fixed' | 'cant_fix' | 'pending'; note?: string }> = {};
            const solvedMap: Record<string, boolean> = {};
            for (const s of dbStatuses) {
              const assm = s.assessment_id || 'default';
              if (s.resource_raw === '__check_level__') {
                const isSolved = s.status === 'fixed';
                solvedMap[`${assm}::${s.check_id}`] = isSolved;
                solvedMap[s.check_id] = isSolved;
              } else {
                const key = `${assm}::${s.check_id}::${s.resource_raw}`;
                const legacyKey = `${s.check_id}::${s.resource_raw}`;
                resMap[key] = { status: s.status, note: s.note };
                resMap[legacyKey] = { status: s.status, note: s.note };
              }
            }
            setResourceRemediations(prev => ({ ...prev, ...resMap }));
            setSolvedCheckIds(prev => ({ ...prev, ...solvedMap }));
          }

          if (Array.isArray(dbFrameworks) && dbFrameworks.length > 0) {
            setComplianceFrameworks(dbFrameworks);
          }

          if (Array.isArray(dbIntegrations) && dbIntegrations.length > 0) {
            const slack = dbIntegrations.find((i: any) => i.service_type === 'slack') || {};
            const jira = dbIntegrations.find((i: any) => i.service_type === 'jira') || {};
            const gchat = dbIntegrations.find((i: any) => i.service_type === 'gchat') || {};
            setIntegrations(prev => ({
              slack: { ...prev.slack, ...slack },
              jira: { ...prev.jira, ...jira },
              gchat: { ...prev.gchat, ...gchat },
            }));
          }

          if (Array.isArray(dbAlertLogs) && dbAlertLogs.length > 0) {
            setAlertLogs(dbAlertLogs);
          }

          if (Array.isArray(dbQuestions) && dbQuestions.length > 0) {
            setOrgQuestions(dbQuestions);
          }

          if (Array.isArray(dbRepos) && dbRepos.length > 0) {
            const r = dbRepos[0];
            setRepoConfigState({
              provider: r.provider || 'github',
              repoName: r.repo_name || r.repoName || '',
              branch: r.branch || 'main',
              pat: r.pat || '',
              connected: r.connected !== undefined ? r.connected : Boolean((r.repo_name || r.repoName) && r.pat),
              lastSync: r.last_sync || r.lastSync || 'Recently',
              autoCreatePr: r.auto_create_pr ?? r.autoCreatePr ?? true,
            });
          }

          if (Array.isArray(dbJiraTickets) && dbJiraTickets.length > 0) {
            const ticketMap: Record<string, LinkedJiraTicket> = {};
            for (const t of dbJiraTickets) {
              const cId = t.check_id || t.checkId;
              if (cId) {
                ticketMap[cId] = {
                  id: t.id,
                  checkId: cId,
                  key: t.key,
                  summary: t.summary,
                  description: t.description,
                  priority: t.priority,
                  status: t.status,
                  assignee: t.assignee,
                  projectKey: t.project_key || t.projectKey,
                  createdAt: t.created_at || t.createdAt || 'Recently',
                  url: t.url,
                };
              }
            }
            setJiraTickets(ticketMap);
          }
        } catch (subErr) {
          console.warn('Could not sync secondary datasets from MongoDB:', subErr);
        }
      }
    } catch (e) {
      console.warn('API/MongoDB not reachable, using local storage state.', e);
      setDbConnected(false);
    }
  };

  useEffect(() => {
    refreshFromDb();
  }, []);

  const lastSavedUserIdRef = useRef<string>(currentUser.id);

  // Auto-sync current user data to storage whenever any data state changes
  useEffect(() => {
    // Prevent saving if the user ID just changed (wait until current user's state is applied)
    if (lastSavedUserIdRef.current !== currentUser.id) {
      lastSavedUserIdRef.current = currentUser.id;
      return;
    }

    saveUserData(currentUser.id, {
      assessments,
      milestones,
      scheduledAssessments,
      integrations,
      jiraTickets,
      alertLogs,
      configuredAccount,
      configuredAccounts,
      repoConfig,
      solvedCheckIds,
      resourceRemediations,
      orgQuestions,
      theme,
    });
    try {
      localStorage.setItem('lens_active_user', JSON.stringify(currentUser));
    } catch {}
  }, [
    currentUser,
    assessments,
    milestones,
    scheduledAssessments,
    integrations,
    jiraTickets,
    alertLogs,
    configuredAccount,
    configuredAccounts,
    repoConfig,
    solvedCheckIds,
    resourceRemediations,
    orgQuestions,
    theme,
  ]);

  const applyUserData = (user: UserProfile) => {
    setCurrentUser(user);
    setUserRole(user.role);
    setIsNewUser(user.isNewUser ?? false);

    const data = loadUserData(user.id);
    setAssessments(data.assessments);
    setMilestones(data.milestones);
    setScheduledAssessments(data.scheduledAssessments || []);
    setIntegrations(data.integrations || INITIAL_INTEGRATIONS);
    setConfiguredAccountState(data.configuredAccount);
    setConfiguredAccounts(data.configuredAccounts || {
      aws: data.configuredAccount?.cloud === 'aws' ? data.configuredAccount : null,
      azure: data.configuredAccount?.cloud === 'azure' ? data.configuredAccount : null,
      gcp: data.configuredAccount?.cloud === 'gcp' ? data.configuredAccount : null,
    });
    setRepoConfig(data.repoConfig);
    setSolvedCheckIds(data.solvedCheckIds);
    setResourceRemediations(data.resourceRemediations);
    setOrgQuestions(data.orgQuestions);
    setTheme(data.theme || 'light');

    const isDemo = user.id === 'user-admin' || user.role === 'admin' || user.email === 'admin@cloudifyops.com';
    if (user.isNewUser || (!isDemo && data.assessments.length === 0)) {
      setCloudAccounts([]);
      setConfiguredAccountState(null);
      setConfiguredAccounts({ aws: null, azure: null, gcp: null });
      setScheduledAssessments([]);
      setMilestones([]);
    }

    if (data.assessments.length > 0) {
      setSelectedAssessmentId(data.assessments[0].id);
      setCloud(data.assessments[0].cloud);
    } else {
      setSelectedAssessmentId('');
      setCloud(null);
    }
  };

  const loginUser = (
    email: string,
    role?: 'user' | 'admin',
    name?: string,
    isNew?: boolean,
    customUserId?: string,
    customOrgId?: string
  ) => {
    const normalized = email.trim().toLowerCase();
    let user: UserProfile;

    if (normalized === 'admin@cloudifyops.com' || role === 'admin') {
      user = PRESET_USERS[2];
    } else if (normalized === 'newuser@cloudifyops.com' || isNew) {
      const generatedId = customUserId || `usr-${Date.now()}`;
      const generatedOrgId = customOrgId || `org_${normalized.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
      user = {
        id: generatedId,
        orgId: generatedOrgId,
        name: name?.trim() || (normalized ? normalized.split('@')[0].replace('.', ' ') : 'New User'),
        email: normalized || 'newuser@cloudifyops.com',
        role: 'user',
        company: 'CloudifyOps Client',
        isNewUser: true,
      };
      // Initialize fresh storage
      saveUserData(generatedId, getDefaultUserData(generatedId));
    } else if (normalized === 'lezin.menath@cloudifyops.com') {
      user = {
        ...PRESET_USERS[0],
        id: customUserId || PRESET_USERS[0].id,
        orgId: customOrgId || PRESET_USERS[0].orgId,
      };
    } else {
      const generatedId = customUserId || `usr-${normalized.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const generatedOrgId = customOrgId || `org_${normalized.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
      user = {
        id: generatedId,
        orgId: generatedOrgId,
        name: name?.trim() || normalized.split('@')[0].replace('.', ' ') || 'User',
        email: normalized,
        role: role || 'user',
        company: 'CloudifyOps Workload',
        isNewUser: false,
      };
    }

    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('lens_active_user', JSON.stringify(user));
      }
    } catch {}

    applyUserData(user);
    refreshFromDb(user);

    if (user.role === 'admin') {
      navigate('admin');
    } else if (user.isNewUser) {
      navigate('onboarding');
    } else {
      navigate('dashboard');
    }
  };

  const switchUser = (userId: string) => {
    const target = PRESET_USERS.find(u => u.id === userId) || {
      id: userId,
      name: 'Switched User',
      email: `${userId}@cloudifyops.com`,
      role: 'user' as const,
      isNewUser: false,
    };
    applyUserData(target);
    if (target.role === 'admin') {
      navigate('admin');
    } else {
      navigate('dashboard');
    }
  };

  const logoutUser = () => {
    setUserRole('user');
    navigate('login');
  };

  const setResourceRemediationStatus = (
    checkId: string,
    resourceRaw: string,
    status: 'fixed' | 'cant_fix' | 'pending',
    note?: string
  ) => {
    const assessmentKey = selectedAssessmentId || 'default';
    const key = `${assessmentKey}::${checkId}::${resourceRaw}`;
    const legacyKey = `${checkId}::${resourceRaw}`;
    setResourceRemediations(prev => ({
      ...prev,
      [key]: { status, note },
      [legacyKey]: { status, note },
    }));

    api.saveRemediationStatus({
      assessment_id: selectedAssessmentId || 'default',
      check_id: checkId,
      resource_raw: resourceRaw,
      status,
      note,
      user_id: currentUser?.id,
    }).catch(err => console.warn('Could not persist remediation status:', err));
  };

  const getCheckRemediationStatus = (
    checkId: string,
    resources: string[]
  ): 'fixed' | 'in_progress' | 'cant_fix' | 'pending' => {
    const assessmentKey = selectedAssessmentId || 'default';
    const checkSolvedKey = `${assessmentKey}::${checkId}`;

    if (!resources || resources.length === 0) {
      if (solvedCheckIds[checkSolvedKey] || solvedCheckIds[checkId]) return 'fixed';
      return 'pending';
    }

    let fixedCount = 0;
    let cantFixCount = 0;
    let pendingCount = 0;

    for (const res of resources) {
      const key = `${assessmentKey}::${checkId}::${res}`;
      const legacyKey = `${checkId}::${res}`;
      const item = resourceRemediations[key] || resourceRemediations[legacyKey];
      const status = item?.status || 'pending';
      if (status === 'fixed') fixedCount++;
      else if (status === 'cant_fix') cantFixCount++;
      else pendingCount++;
    }

    if (fixedCount === resources.length) return 'fixed';
    if (cantFixCount > 0 && pendingCount === 0 && fixedCount === 0) return 'cant_fix';
    if (fixedCount > 0 || (cantFixCount > 0 && pendingCount > 0)) return 'in_progress';
    if (solvedCheckIds[checkSolvedKey] || solvedCheckIds[checkId]) return 'fixed';

    return 'pending';
  };

  const updateOrgQuestion = (id: string, ans: string, answered = true) => {
    setOrgQuestions(prev => prev.map(q => q.id === id ? { ...q, ans, answered: ans.trim().length > 0 ? answered : false } : q));
  };

  const toggleOrgCheck = (questionId: string, checkId: string) => {
    setOrgQuestions(prev => prev.map(q => {
      if (q.id !== questionId || !q.manualChecks) return q;
      return {
        ...q,
        manualChecks: q.manualChecks.map(c => c.id === checkId ? { ...c, verified: !c.verified } : c),
      };
    }));
  };

  const toggleAllOrgChecks = (questionId: string, verified: boolean) => {
    setOrgQuestions(prev => prev.map(q => {
      if (q.id !== questionId || !q.manualChecks) return q;
      return {
        ...q,
        manualChecks: q.manualChecks.map(c => ({ ...c, verified })),
      };
    }));
  };

  const toggleCheckSolved = (id: string) => {
    const assessmentKey = selectedAssessmentId || 'default';
    const key = `${assessmentKey}::${id}`;
    const newSolved = !solvedCheckIds[key];
    setSolvedCheckIds(prev => ({
      ...prev,
      [key]: newSolved,
      [id]: newSolved,
    }));

    api.saveRemediationStatus({
      assessment_id: selectedAssessmentId || 'default',
      check_id: id,
      resource_raw: '__check_level__',
      status: newSolved ? 'fixed' : 'pending',
      user_id: currentUser?.id,
    }).catch(err => console.warn('Could not persist check solved status:', err));
  };

  const markCheckSolved = (id: string, solved = true) => {
    const assessmentKey = selectedAssessmentId || 'default';
    const key = `${assessmentKey}::${id}`;
    setSolvedCheckIds(prev => ({
      ...prev,
      [key]: solved,
      [id]: solved,
    }));

    api.saveRemediationStatus({
      assessment_id: selectedAssessmentId || 'default',
      check_id: id,
      resource_raw: '__check_level__',
      status: solved ? 'fixed' : 'pending',
      user_id: currentUser?.id,
    }).catch(err => console.warn('Could not persist check solved status:', err));
  };

  const currentAssessment: AssessmentInfo | null =
    assessments.find((a) => a.id === selectedAssessmentId) || assessments[0] || null;

  const currentMilestones: AssessmentMilestone[] = currentAssessment
    ? milestones.filter((m) => m.assessmentId === currentAssessment.id)
    : [];

  const effectiveCloud = cloud || currentAssessment?.cloud || 'aws';
  const accent = ACCENTS[effectiveCloud] || '#2563EB';
  const accentLight = ACCENT_LIGHTS[effectiveCloud] || '#EFF6FF';
  const cloudLabel = LABELS[effectiveCloud] || '';
  const cloudShort = SHORTS[effectiveCloud] || '';

  const navigate = (nextScreen: Screen) => {
    setPreviousScreen(screen);
    setScreen(nextScreen);
  };

  const selectAssessment = (id: string, targetScreen: Screen = 'report') => {
    setSelectedAssessmentId(id);
    const target = assessments.find((a) => a.id === id);
    if (target) {
      setCloud(target.cloud);
    }
    setPreviousScreen(screen);
    setScreen(targetScreen);
  };

  const selectPillar = (pillarId: string) => {
    setSelectedPillarId(pillarId);
    setPreviousScreen(screen);
    setScreen('pillar-detail');
  };

  const goToRemediation = (assessmentId?: string) => {
    if (assessmentId) {
      setSelectedAssessmentId(assessmentId);
      const target = assessments.find(a => a.id === assessmentId);
      if (target) setCloud(target.cloud);
    }
    setRemediationFindingId(null);
    setPreviousScreen(screen);
    setScreen('remediation');
  };

  const goToAIFix = (checkId: string) => {
    setRemediationFindingId(checkId);
    setPreviousScreen(screen);
    setScreen('remediation');
  };

  const addMilestone = (m: {
    milestoneName: string;
    version: string;
    notes: string;
    score?: number;
    totalBestPractices?: number;
    passedBps?: number;
    failedBps?: number;
    totalChecks?: number;
    passedChecks?: number;
    failedChecks?: number;
    highRisks?: number;
    mediumRisks?: number;
    lowRisks?: number;
    pillarScores?: {
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
  }): AssessmentMilestone => {
    const targetAssessmentId = selectedAssessmentId || currentAssessment?.id || 'A-001';
    const existing = milestones.filter((ms) => ms.assessmentId === targetAssessmentId);
    const nextNumber = existing.length + 1;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }) + `, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const newMs: AssessmentMilestone = {
      id: `MS-${targetAssessmentId}-${Date.now()}`,
      assessmentId: targetAssessmentId,
      milestoneNumber: nextNumber,
      milestoneName: m.milestoneName.trim() || `Milestone ${nextNumber} Review`,
      version: m.version.trim() || `v1.${nextNumber}`,
      recordedAt: dateStr,
      recordedBy: `${currentUser.name} (${currentUser.role === 'admin' ? 'Admin' : 'Lead Architect'})`,
      score: m.score ?? currentAssessment?.score ?? 84,
      totalBestPractices: m.totalBestPractices ?? 16,
      passedBps: m.passedBps ?? 11,
      failedBps: m.failedBps ?? 5,
      totalChecks: m.totalChecks ?? 45,
      passedChecks: m.passedChecks ?? 34,
      failedChecks: m.failedChecks ?? 11,
      highRisks: m.highRisks ?? 4,
      mediumRisks: m.mediumRisks ?? 7,
      lowRisks: m.lowRisks ?? 3,
      notes: m.notes.trim() || 'Milestone state recorded for Well-Architected Framework review compliance.',
      pillarScores: m.pillarScores ?? currentAssessment?.pillars ?? {
        reliability: 88,
        security: 79,
        cost: 91,
        operations: 82,
        performance: 80,
      },
      pillarHighRisks: m.pillarHighRisks ?? {
        reliability: 1,
        security: 3,
        cost: 0,
        operations: 0,
        performance: 1,
      },
    };

    setMilestones((prev) => [newMs, ...prev]);

    // Persist to MongoDB
    api.saveMilestone({
      id: newMs.id,
      assessment_id: newMs.assessmentId,
      milestone_number: newMs.milestoneNumber,
      milestone_name: newMs.milestoneName,
      version: newMs.version,
      score: newMs.score,
      total_best_practices: newMs.totalBestPractices,
      passed_bps: newMs.passedBps,
      failed_bps: newMs.failedBps,
      total_checks: newMs.totalChecks,
      passed_checks: newMs.passedChecks,
      failed_checks: newMs.failedChecks,
      high_risks: newMs.highRisks,
      medium_risks: newMs.mediumRisks,
      low_risks: newMs.lowRisks,
      pillar_scores: newMs.pillarScores,
      pillar_high_risks: newMs.pillarHighRisks,
      notes: newMs.notes,
      recorded_by: newMs.recordedBy,
      recorded_at: new Date().toISOString(),
    }).catch(err => console.warn('Could not persist milestone to MongoDB:', err));

    return newMs;
  };

  const deleteMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
    api.deleteMilestone(id).catch(err => console.warn('Could not delete milestone from MongoDB:', err));
  };

  const completeAssessment = (id: string, score: number = 84) => {
    setAssessments(prev => prev.map(a => {
      if (a.id === id) {
        return {
          ...a,
          status: 'complete',
          score,
          lastRun: 'Just now',
        };
      }
      return a;
    }));

    // Update status to COMPLETED in MongoDB
    api.saveAssessment({
      id,
      status: 'COMPLETED',
      score,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(err => console.warn('Could not update completed status in MongoDB:', err));
  };

  const deleteAssessment = async (id: string) => {
    // 1. Optimistically update local state
    setAssessments(prev => prev.filter(a => a.id !== id));
    if (selectedAssessmentId === id) {
      const remaining = assessments.filter(a => a.id !== id);
      setSelectedAssessmentId(remaining[0]?.id || '');
    }

    // 2. Call backend API to delete from MongoDB
    try {
      await api.deleteAssessment(id);
      showToast('Assessment deleted successfully', 'info');
    } catch (err) {
      console.error('Failed to delete assessment from MongoDB:', err);
      showToast('Deleted locally, but backend could not be reached', 'info');
    }
  };

  const runOrUpdateAssessment = (config: {
    cloud: Cloud;
    accountId: string;
    accountName?: string;
    region: string;
    name?: string;
  }): { isRerun: boolean; assessment: AssessmentInfo } => {
    // If it was a new user, they now have created an assessment
    setIsNewUser(false);

    const existingIndex = assessments.findIndex((a) =>
      a.cloud.toLowerCase() === config.cloud.toLowerCase() &&
      (a.accountId.toLowerCase() === config.accountId.toLowerCase() ||
       (config.accountName && a.accountName.toLowerCase() === config.accountName.toLowerCase())) &&
      a.region.toLowerCase() === config.region.toLowerCase()
    );

    if (existingIndex !== -1) {
      const existing = assessments[existingIndex];
      const count = (existing.rerunCount || 1) + 1;
      const updated: AssessmentInfo = {
        ...existing,
        name: config.name || existing.name,
        status: 'running',
        lastRun: 'Just now (Rerun)',
        rerunCount: count,
        isRerun: true,
      };

      const copy = [...assessments];
      copy[existingIndex] = updated;
      setAssessments(copy);
      setSelectedAssessmentId(updated.id);
      setCloud(updated.cloud);

      // Persist rerun to MongoDB with metric recomputation, milestone logging, and audit logs
      api.rerunAssessment(updated.id).then(res => {
        if (res?.assessment) {
          setAssessments(prev => prev.map(a => a.id === updated.id ? {
            ...a,
            score: Number(res.assessment.score) || a.score,
            passedChecks: Number(res.assessment.passed_checks) || a.passedChecks,
            failedChecks: Number(res.assessment.failed_checks) || a.failedChecks,
            highRisks: Number(res.assessment.high_risks) || a.highRisks,
          } : a));
        }
      }).catch(() => {
        api.saveAssessment({
          id: updated.id,
          status: 'RUNNING',
          rerun_count: count,
          last_run_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }).catch(err => console.warn('Could not persist rerun assessment to MongoDB:', err));
      });

      return { isRerun: true, assessment: updated };
    } else {
      const newId = `A-${String(assessments.length + 1).padStart(3, '0')}`;
      const created: AssessmentInfo = {
        id: newId,
        name: config.name || `${config.cloud.toUpperCase()} ${config.accountName || config.accountId} — ${config.region} Review`,
        accountName: config.accountName || 'Connected Account',
        accountId: config.accountId,
        region: config.region,
        cloud: config.cloud,
        status: 'running',
        score: 84,
        lastRun: 'Just now',
        checks: 46,
        pillars: { reliability: 88, security: 80, cost: 88, operations: 82, performance: 84 },
        totalBestPractices: 16,
        passedBps: 12,
        failedBps: 4,
        totalChecks: 46,
        passedChecks: 36,
        failedChecks: 10,
        highRisks: 3,
        mediumRisks: 5,
        lowRisks: 2,
        rerunCount: 1,
        isRerun: false,
      };

      setAssessments((prev) => [created, ...prev]);
      setSelectedAssessmentId(created.id);
      setCloud(created.cloud);

      const userOrg = currentUser.orgId || `org_${currentUser.id}`;

      // Asynchronously persist to MongoDB with user scoping and full metrics
      api.saveAssessment({
        id: created.id,
        name: created.name,
        org_id: userOrg,
        user_id: currentUser.id,
        cloud_account_id: config.accountId,
        cloud: created.cloud,
        account_name: created.accountName,
        region: created.region,
        lens: 'aws-well-architected',
        status: created.status.toUpperCase(),
        score: created.score,
        checks_count: created.checks,
        total_best_practices: 16,
        passed_bps: 12,
        failed_bps: 4,
        total_checks: 46,
        passed_checks: 36,
        failed_checks: 10,
        high_risks: 3,
        medium_risks: 5,
        low_risks: 2,
        pillar_scores: created.pillars,
        rerun_count: created.rerunCount || 0,
        last_run_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).catch(err => console.warn('Could not persist assessment to MongoDB:', err));

      return { isRerun: false, assessment: created };
    }
  };

  const addScheduledAssessment = (
    data: Omit<ScheduledAssessment, 'id' | 'createdAt' | 'status'>
  ): ScheduledAssessment => {
    const newId = `SCHED-${String(scheduledAssessments.length + 1).padStart(3, '0')}`;
    const newSched: ScheduledAssessment = {
      ...data,
      id: newId,
      status: 'active',
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
    };
    setScheduledAssessments((prev) => [newSched, ...prev]);

    const userOrg = currentUser.orgId || `org_${currentUser.id}`;

    // Persist new schedule to MongoDB
    api.saveSchedule({
      id: newSched.id,
      org_id: userOrg,
      user_id: currentUser.id,
      cloud: newSched.cloud,
      account_name: newSched.accountName,
      cloud_account_id: newSched.accountId || 'acc_01',
      name: newSched.name,
      frequency: newSched.frequency,
      cron_expression: newSched.cronExpression || '0 2 * * 1',
      time_of_day: newSched.time || '02:00',
      timezone: newSched.timezone || 'UTC',
      is_active: newSched.status === 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).catch(err => console.warn('Could not persist schedule to MongoDB:', err));

    return newSched;
  };

  const updateScheduledAssessment = (id: string, updates: Partial<ScheduledAssessment>) => {
    setScheduledAssessments((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const updated = { ...s, ...updates };
          api.saveSchedule({
            id: updated.id,
            name: updated.name,
            frequency: updated.frequency,
            cron_expression: updated.cronExpression,
            time_of_day: updated.time,
            timezone: updated.timezone,
            is_active: updated.status === 'active',
            last_run_at: updated.lastRun,
            next_run_at: updated.nextRun,
            updated_at: new Date().toISOString(),
          }).catch(err => console.warn('Could not update schedule in MongoDB:', err));
          return updated;
        }
        return s;
      })
    );
  };

  const deleteScheduledAssessment = (id: string) => {
    setScheduledAssessments((prev) => prev.filter((s) => s.id !== id));
    api.deleteSchedule(id).catch(err => console.warn('Could not delete schedule from MongoDB:', err));
  };

  const toggleScheduleStatus = (id: string) => {
    setScheduledAssessments((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const nextStatus = s.status === 'active' ? 'paused' : 'active';
          const updated = {
            ...s,
            status: nextStatus,
            nextRun:
              nextStatus === 'active'
                ? s.frequency === 'daily'
                  ? 'Tomorrow at ' + s.time
                  : `Next ${s.dayOfWeek || 'run'} at ${s.time}`
                : 'Paused',
          };
          api.saveSchedule({
            id: updated.id,
            is_active: nextStatus === 'active',
            next_run_at: updated.nextRun,
            updated_at: new Date().toISOString(),
          }).catch(err => console.warn('Could not toggle schedule status in MongoDB:', err));
          return updated;
        }
        return s;
      })
    );
  };

  const runScheduledAssessmentNow = (id: string) => {
    const target = scheduledAssessments.find((s) => s.id === id);
    if (!target) return;
    const nowStr =
      new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ` at ${target.time || '12:00 UTC'}`;
    updateScheduledAssessment(id, { lastRun: nowStr });
    runOrUpdateAssessment({
      cloud: target.cloud,
      accountId: target.accountId,
      accountName: target.accountName,
      region: target.region,
      name: target.name,
    });
    navigate('live-scan');
  };

  const updateIntegrations = (updates: Partial<IntegrationsState>) => {
    setIntegrations((prev) => {
      const next = { ...prev, ...updates };
      if (updates.slack) {
        api.saveIntegration({ ...next.slack, service_type: 'slack' }).catch(err => console.warn('Could not persist slack integration to DB:', err));
      }
      if (updates.jira) {
        api.saveIntegration({ ...next.jira, service_type: 'jira' }).catch(err => console.warn('Could not persist jira integration to DB:', err));
      }
      if (updates.gchat) {
        api.saveIntegration({ ...next.gchat, service_type: 'gchat' }).catch(err => console.warn('Could not persist gchat integration to DB:', err));
      }
      return next;
    });
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        previousScreen,
        currentUser,
        setCurrentUser,
        loginUser,
        logoutUser,
        switchUser,
        cloud,
        setCloud,
        selectedLens,
        setSelectedLens,
        selectedAssessmentId,
        setSelectedAssessmentId,
        selectAssessment,
        assessments,
        runOrUpdateAssessment,
        completeAssessment,
        deleteAssessment,
        currentAssessment,
        milestones,
        currentMilestones,
        addMilestone,
        deleteMilestone,
        selectedPillarId,
        setSelectedPillarId,
        selectPillar,
        remediationFindingId,
        setRemediationFindingId,
        goToRemediation,
        goToAIFix,
        solvedCheckIds,
        toggleCheckSolved,
        markCheckSolved,
        resourceRemediations,
        setResourceRemediationStatus,
        getCheckRemediationStatus,
        repoConfig,
        setRepoConfig,
        orgQuestions,
        setOrgQuestions,
        updateOrgQuestion,
        toggleOrgCheck,
        toggleAllOrgChecks,
        wizardStep,
        theme,
        isNewUser,
        setIsNewUser,
        scheduledAssessments,
        addScheduledAssessment,
        updateScheduledAssessment,
        deleteScheduledAssessment,
        toggleScheduleStatus,
        runScheduledAssessmentNow,
        integrations,
        updateIntegrations,
        jiraTickets,
        alertLogs,
        createJiraTicketForCheck,
        updateJiraTicketStatus,
        sendSlackNotification,
        sendGChatNotification,
        bulkCreateJiraTickets,
        addAlertLog,
        toast,
        showToast,
        clearToast,
        pillars,
        setPillars,
        complianceFrameworks,
        selectedComplianceFrameworkId,
        setSelectedComplianceFrameworkId,
        pinnedComplianceIds,
        togglePinComplianceFramework,
        goToComplianceFramework,
        configuredAccount,
        setConfiguredAccount,
        configuredAccounts,
        cloudAccounts,
        setCloudAccounts,
        isCloudConfigured,
        getConfiguredAccount,
        userRole,
        setUserRole,
        adminTab,
        setAdminTab,
        go: navigate,
        selectCloud: (c) => {
          setCloud(c);
          const match = assessments.find((a) => a.cloud?.toLowerCase() === c.toLowerCase());
          if (match) {
            setSelectedAssessmentId(match.id);
          }
          setWizardStep(1);
          navigate('wizard');
        },
        setWizardStep,
        toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
        isTourOpen,
        setIsTourOpen,
        startTour,
        closeTour,
        accent,
        accentLight,
        cloudLabel,
        cloudShort,
        dbConnected,
        refreshFromDb,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);

/* ── Shared token helper — import this in every screen ── */
export const LIGHT = {
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  border:      '#E2E8F0',
  text:        '#0F172A',
  textSub:     '#64748B',
  primary:     '#2563EB',
  primaryBg:   '#EFF6FF',
  success:     '#059669',
  successBg:   '#ECFDF5',
  successBar:  '#10B981',
  error:       '#E11D48',
  errorBg:     '#FFF1F2',
  errorBar:    '#FB7185',
  warning:     '#D97706',
  warningBg:   '#FFFBEB',
  warningBar:  '#FBBF24',
  muted:       '#94A3B8',
  progress:    '#10B981',
  activeNavBg: '#EFF6FF',
  activeNavBar:'#10B981',
  rowHover:    '#F8FAFC',
  shadow:      '0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)',
  shadowMd:    '0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)',
  shadowLg:    '0 10px 15px -3px rgba(0,0,0,.07),0 4px 6px -4px rgba(0,0,0,.05)',
};

export const DARK = {
  bg:          '#0B1220',
  card:        '#111B2E',
  border:      '#1E293B',
  text:        '#F1F5F9',
  textSub:     '#94A3B8',
  primary:     '#3B82F6',
  primaryBg:   'rgba(59,130,246,.15)',
  success:     '#52B788',
  successBg:   'rgba(82,183,136,.12)',
  successBar:  'rgba(82,183,136,.75)',
  error:       '#FB7185',
  errorBg:     'rgba(251,113,133,.12)',
  errorBar:    'rgba(251,113,133,.65)',
  warning:     '#FBBF24',
  warningBg:   'rgba(251,191,36,.12)',
  warningBar:  'rgba(251,191,36,.65)',
  muted:       '#94A3B8',
  progress:    '#52B788',
  activeNavBg: 'rgba(59,130,246,.12)',
  activeNavBar:'#52B788',
  rowHover:    'rgba(255,255,255,0.03)',
  shadow:      '0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)',
  shadowMd:    '0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)',
  shadowLg:    '0 10px 15px rgba(0,0,0,.4),0 4px 6px rgba(0,0,0,.3)',
};

export type Tokens = typeof LIGHT;
