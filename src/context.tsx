import { createContext, useContext, useState, ReactNode } from 'react';
import {
  AssessmentInfo,
  AssessmentMilestone,
  INITIAL_ASSESSMENTS,
  INITIAL_MILESTONES,
} from './data/assessmentData';

export type Cloud = 'aws' | 'azure' | 'gcp';
export type Theme = 'light' | 'dark';
export type LensType = 'wafr' | 'genai' | 'finops';

export type Screen =
  | 'login'
  | 'dashboard'
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
  | 'settings'
  | 'admin'
  | 'onboarding';

interface AppState {
  screen: Screen;
  previousScreen: Screen;
  cloud: Cloud | null;
  selectedLens: LensType;
  setSelectedLens: (l: LensType) => void;
  selectedAssessmentId: string;
  setSelectedAssessmentId: (id: string) => void;
  selectAssessment: (id: string, targetScreen?: Screen) => void;
  assessments: AssessmentInfo[];
  currentAssessment: AssessmentInfo;
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
  wizardStep: 1 | 2 | 3;
  theme: Theme;
  isNewUser: boolean;
  setIsNewUser: (b: boolean) => void;
  userRole: 'user' | 'admin';
  setUserRole: (r: 'user' | 'admin') => void;
  adminTab: 'users' | 'tokens';
  setAdminTab: (t: 'users' | 'tokens') => void;
  go: (s: Screen) => void;
  selectCloud: (c: Cloud) => void;
  setWizardStep: (s: 1 | 2 | 3) => void;
  toggleTheme: () => void;
  accent: string;
  accentLight: string;
  cloudLabel: string;
  cloudShort: string;
}

const AppContext = createContext<AppState>({} as AppState);

const ACCENTS: Record<Cloud, string> = { aws: '#FF9900', azure: '#0078D4', gcp: '#4285F4' };
const ACCENT_LIGHTS: Record<Cloud, string> = { aws: '#FFF4E0', azure: '#E5F1FB', gcp: '#E8F0FE' };
const LABELS: Record<Cloud, string> = { aws: 'Amazon Web Services', azure: 'Microsoft Azure', gcp: 'Google Cloud' };
const SHORTS: Record<Cloud, string> = { aws: 'AWS', azure: 'Azure', gcp: 'GCP' };

export function AppProvider({ children }: { children: ReactNode }) {
  const [screen, setScreen] = useState<Screen>('login');
  const [previousScreen, setPreviousScreen] = useState<Screen>('dashboard');
  const [cloud, setCloud] = useState<Cloud | null>(null);
  const [selectedLens, setSelectedLens] = useState<LensType>('wafr');
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>('A-001');
  const [assessments, setAssessments] = useState<AssessmentInfo[]>(INITIAL_ASSESSMENTS);
  const [milestones, setMilestones] = useState<AssessmentMilestone[]>(INITIAL_MILESTONES);
  const [selectedPillarId, setSelectedPillarId] = useState<string>('reliability');
  const [remediationFindingId, setRemediationFindingId] = useState<string | null>(null);
  const [solvedCheckIds, setSolvedCheckIds] = useState<Record<string, boolean>>({});
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);
  const [theme, setTheme] = useState<Theme>('light');
  const [isNewUser, setIsNewUser] = useState<boolean>(false);
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');
  const [adminTab, setAdminTab] = useState<'users' | 'tokens'>('users');

  const toggleCheckSolved = (id: string) => {
    setSolvedCheckIds(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const markCheckSolved = (id: string, solved = true) => {
    setSolvedCheckIds(prev => ({
      ...prev,
      [id]: solved,
    }));
  };

  const currentAssessment: AssessmentInfo =
    assessments.find((a) => a.id === selectedAssessmentId) || assessments[0] || INITIAL_ASSESSMENTS[0];

  const currentMilestones: AssessmentMilestone[] = milestones.filter(
    (m) => m.assessmentId === (currentAssessment?.id || selectedAssessmentId)
  );

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
    }
    setRemediationFindingId(null);
    setPreviousScreen(screen);
    setScreen('remediation');
  };

  const goToAIFix = (checkId: string) => {
    setRemediationFindingId(checkId);
    setPreviousScreen(screen);
    setScreen('ai-fix');
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
    const existing = milestones.filter((ms) => ms.assessmentId === selectedAssessmentId);
    const nextNumber = existing.length + 1;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }) + `, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

    const newMs: AssessmentMilestone = {
      id: `MS-${selectedAssessmentId}-${Date.now()}`,
      assessmentId: selectedAssessmentId,
      milestoneNumber: nextNumber,
      milestoneName: m.milestoneName.trim() || `Milestone ${nextNumber} Review`,
      version: m.version.trim() || `v1.${nextNumber}`,
      recordedAt: dateStr,
      recordedBy: 'Lezin VM (Lead Architect)',
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
    return newMs;
  };

  const deleteMilestone = (id: string) => {
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <AppContext.Provider
      value={{
        screen,
        previousScreen,
        cloud,
        selectedLens,
        setSelectedLens,
        selectedAssessmentId,
        setSelectedAssessmentId,
        selectAssessment,
        assessments,
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
        wizardStep,
        theme,
        isNewUser,
        setIsNewUser,
        userRole,
        setUserRole,
        adminTab,
        setAdminTab,
        go: navigate,
        selectCloud: (c) => {
          setCloud(c);
          setWizardStep(1);
          navigate('wizard');
        },
        setWizardStep,
        toggleTheme: () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
        accent,
        accentLight,
        cloudLabel,
        cloudShort,
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
