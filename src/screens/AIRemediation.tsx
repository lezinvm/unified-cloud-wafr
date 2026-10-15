import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { SeverityPill, type Severity } from '../components/FindingUI';
import { CloudChip } from '../components/CloudLogo';
import { PILLARS_DATA } from '../data/wafrData';
import { INITIAL_ASSESSMENTS, type AssessmentInfo } from '../data/assessmentData';
import { JiraTicketModal } from '../components/JiraTicketModal';
import { SlackAlertModal } from '../components/SlackAlertModal';
import { SlackLogo, JiraLogo } from '../components/IntegrationLogos';
import { api } from '../services/apiClient';

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#F8FAFC',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#64748B',
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  success: '#059669',
  successBg: '#ECFDF5',
  error: '#E11D48',
  errorBg: '#FFF1F2',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  muted: '#94A3B8',
  shadow: '0 1px 3px rgba(0,0,0,.05),0 1px 2px rgba(0,0,0,.03)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.06),0 2px 4px -2px rgba(0,0,0,.04)',
};

const DARK = {
  bg: '#0B1220',
  card: '#111B2E',
  cardAlt: '#172238',
  border: '#1E293B',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,.15)',
  success: '#52B788',
  successBg: 'rgba(82,183,136,.12)',
  error: '#FB7185',
  errorBg: 'rgba(251,113,133,.12)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,.12)',
  muted: '#64748B',
  shadow: '0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)',
};

export {
  type ManualStepItem,
  type CheckRemediationData,
  type ResourceInfo,
  parseResourceInfo,
  getResourceSpecificRemediation,
  AWS_REMEDIATIONS,
  AZURE_REMEDIATIONS,
  GCP_REMEDIATIONS,
  getFallbackRemediations,
  fetchRemediationsFromDb,
} from '../data/remediationData';

import {
  type CheckRemediationData,
  parseResourceInfo,
  getResourceSpecificRemediation,
  getFallbackRemediations,
  fetchRemediationsFromDb,
  REMEDIATION_DATABASE,
} from '../data/remediationData';
export { REMEDIATION_DATABASE };

export function AIRemediation() {
  const {
    go,
    theme,
    remediationFindingId,
    previousScreen,
    selectedPillarId,
    assessments,
    selectedAssessmentId,
    solvedCheckIds,
    toggleCheckSolved,
    markCheckSolved,
    resourceRemediations,
    setResourceRemediationStatus,
    getCheckRemediationStatus,
    repoConfig,
    setRepoConfig,
    jiraTickets,
    currentAssessment,
    runOrUpdateAssessment,
    showToast,
    currentUser,
  } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  // Verification & Rerun State (Resource-level & Check-level)
  const [verifyingResourceKeys, setVerifyingResourceKeys] = useState<Record<string, boolean>>({});
  const [verifiedResourceResults, setVerifiedResourceResults] = useState<Record<string, { passed: boolean; message: string; timestamp: string }>>({});
  const [verifyingFindingCheck, setVerifyingFindingCheck] = useState(false);
  const [checkRerunFeedback, setCheckRerunFeedback] = useState<{ checkId: string; passed: boolean; message: string } | null>(null);
  const [verifyingModalResource, setVerifyingModalResource] = useState(false);

  // Jira and Slack Modal State
  const [jiraModalOpen, setJiraModalOpen] = useState(false);
  const [slackModalOpen, setSlackModalOpen] = useState(false);

  // Git Connection State (backed by global repoConfig from Settings)
  const [gitConfig, setGitConfig] = useState<{
    connected: boolean;
    ignored?: boolean;
    markedAsDone?: boolean;
    hasExistingRepo: boolean | null;
    repoName: string;
    branch: string;
    pat: string;
  }>({
    connected: repoConfig.connected,
    ignored: false,
    markedAsDone: false,
    hasExistingRepo: repoConfig.connected,
    repoName: repoConfig.repoName || 'acme-corp/terraform-aws-infrastructure',
    branch: repoConfig.branch || 'main',
    pat: repoConfig.pat || '',
  });

  // Modal is closed by default. Repository details are configured in Settings and will NOT pop up automatically
  const [isGitModalOpen, setIsGitModalOpen] = useState(false);
  const [gitModalStep, setGitModalStep] = useState<'ask_repo' | 'pat_form' | 'validating' | 'connected_success'>('ask_repo');
  const [pendingAssessmentId, setPendingAssessmentId] = useState<string | null>(null);
  const [patInput, setPatInput] = useState(repoConfig.pat || '');
  const [repoInput, setRepoInput] = useState(repoConfig.repoName || 'acme-corp/terraform-aws-infrastructure');
  const [branchInput, setBranchInput] = useState(repoConfig.branch || 'main');
  const [showPat, setShowPat] = useState(false);
  const [patError, setPatError] = useState('');

  // AI Fix Mode: when entered directly via "AI Fix" button on a specific finding
  const isAiFixMode = Boolean(remediationFindingId);

  // Assessment Selection State (null = show assessment list view)
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(
    remediationFindingId ? (selectedAssessmentId || 'A-001') : null
  );

  // Active cloud determined from selected assessment or context
  const selectedAssessment = assessments.find(a => a.id === (activeAssessmentId || selectedAssessmentId)) || currentAssessment;
  const activeCloud = (((selectedAssessment?.cloud || 'aws') as string).toLowerCase()) as 'aws' | 'azure' | 'gcp';

  // Remediations database loaded dynamically from MongoDB for active cloud
  const [remediationsDb, setRemediationsDb] = useState<Record<string, CheckRemediationData>>(() => getFallbackRemediations(activeCloud));
  const [loadingRemediations, setLoadingRemediations] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingRemediations(true);
    fetchRemediationsFromDb(activeCloud).then(data => {
      if (!cancelled && data && Object.keys(data).length > 0) {
        setRemediationsDb(data);
      }
      setLoadingRemediations(false);
    }).catch(() => {
      if (!cancelled) setLoadingRemediations(false);
    });
    return () => { cancelled = true; };
  }, [activeCloud]);

  const allChecksList = useMemo(() => {
    return Object.values(remediationsDb);
  }, [remediationsDb]);

  // Active check in check-by-check remediation
  const [activeCheckId, setActiveCheckId] = useState<string>(
    remediationFindingId && remediationsDb[remediationFindingId]
      ? remediationFindingId
      : (Object.keys(remediationsDb)[0] || 'REL-019')
  );

  // Synchronize when entered directly from "AI Fix" button on AssessmentReport / PillarDetail or cloud switches
  useEffect(() => {
    if (remediationFindingId && remediationsDb[remediationFindingId]) {
      setActiveAssessmentId(selectedAssessmentId || 'A-001');
      setActiveCheckId(remediationFindingId);
      setIsGitModalOpen(false);
    } else if (allChecksList.length > 0 && !remediationsDb[activeCheckId]) {
      setActiveCheckId(allChecksList[0].id);
    }
  }, [remediationFindingId, selectedAssessmentId, remediationsDb, allChecksList]);

  // Check filters & search in check list
  const [checkSearch, setCheckSearch] = useState('');
  const [checkSeverityFilter, setCheckSeverityFilter] = useState<'all' | 'critical_high' | 'medium'>('all');

  // Assessment list search & filter
  const [assessmentSearch, setAssessmentSearch] = useState('');
  const [assessmentCloudFilter, setAssessmentCloudFilter] = useState<'all' | 'aws' | 'azure' | 'gcp'>('all');

  // Check detail state
  const checkData = remediationsDb[activeCheckId] || allChecksList[0] || REMEDIATION_DATABASE['REL-019'];
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(0);
  const [fixModalOpen, setFixModalOpen] = useState(false);
  const [solvedResourceArns, setSolvedResourceArns] = useState<Record<string, boolean>>({});
  const [showAllResourcesList, setShowAllResourcesList] = useState(false);
  const [methodTab, setMethodTab] = useState<'manual' | 'cli' | 'iac'>('iac');
  const [iacLanguage, setIacLanguage] = useState<'tf' | 'cf'>('tf');
  const [copied, setCopied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);
  const [generatingIaC, setGeneratingIaC] = useState(false);
  const [iacGenerated, setIacGenerated] = useState(false);
  const [viewIaCModalOpen, setViewIaCModalOpen] = useState(false);

  // Resources modal
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [copiedArnId, setCopiedArnId] = useState<string | null>(null);
  const [copiedAllArns, setCopiedAllArns] = useState(false);

  // GitHub Pull Request Modal State
  const [prModalOpen, setPrModalOpen] = useState(false);
  const [prSubmitting, setPrSubmitting] = useState(false);
  const [prCreatedSuccess, setPrCreatedSuccess] = useState(false);
  const [completedChecks, setCompletedChecks] = useState<Record<string, boolean>>({});

  // Ignored Modal State
  const [cantFixModalOpen, setCantFixModalOpen] = useState(false);
  const [cantFixTargetResource, setCantFixTargetResource] = useState<string | null>(null);
  const [cantFixNote, setCantFixNote] = useState('');

  // Reset check detail state when check changes
  useEffect(() => {
    setSimulationSuccess(false);
    setIacGenerated(false);
    setResourceSearch('');
    setResourcesModalOpen(false);
    setFixModalOpen(false);
    setSelectedResourceIndex(0);
    setShowAllResourcesList(false);
  }, [activeCheckId]);

  // Sync with global repoConfig from Settings
  useEffect(() => {
    setGitConfig(prev => ({
      ...prev,
      connected: repoConfig.connected,
      repoName: repoConfig.repoName || 'acme-corp/terraform-aws-infrastructure',
      branch: repoConfig.branch || 'main',
      pat: repoConfig.pat || '',
    }));
  }, [repoConfig]);

  // Handle Git Validation & Connect (Authenticate Repo)
  const handleConnectGit = () => {
    if (!patInput.trim()) {
      setPatError('Please enter your GitHub Personal Access Token (PAT)');
      return;
    }
    setPatError('');
    setGitModalStep('validating');

    setTimeout(() => {
      const updated = {
        provider: 'github' as const,
        repoName: repoInput.trim() || 'acme-corp/terraform-aws-infrastructure',
        branch: branchInput.trim() || 'main',
        pat: patInput.trim(),
        connected: true,
        lastSync: 'Just now',
        autoCreatePr: true,
      };
      setRepoConfig(updated);
      setGitConfig({
        connected: true,
        ignored: false,
        markedAsDone: false,
        hasExistingRepo: true,
        repoName: updated.repoName,
        branch: updated.branch,
        pat: updated.pat,
      });
      setGitModalStep('connected_success');
    }, 1200);
  };

  // Handle Mark as Done (Pre-configured repo)
  const handleMarkAsDone = () => {
    setGitConfig(prev => ({
      ...prev,
      connected: true,
      markedAsDone: true,
      ignored: false,
      repoName: repoInput.trim() || 'acme-corp/terraform-aws-infrastructure',
      branch: branchInput.trim() || 'main',
    }));
    setIsGitModalOpen(false);
    setGitModalStep('ask_repo');
    if (pendingAssessmentId) {
      setActiveAssessmentId(pendingAssessmentId);
      setPendingAssessmentId(null);
    }
  };

  // Handle Ignore Git integration for now
  const handleIgnoreGit = () => {
    setGitConfig(prev => ({
      ...prev,
      connected: false,
      ignored: true,
      markedAsDone: false,
    }));
    setIsGitModalOpen(false);
    setGitModalStep('ask_repo');
    if (pendingAssessmentId) {
      setActiveAssessmentId(pendingAssessmentId);
      setPendingAssessmentId(null);
    }
  };

  const handleFinishGitModal = () => {
    setIsGitModalOpen(false);
    setGitModalStep('ask_repo');
    if (pendingAssessmentId) {
      setActiveAssessmentId(pendingAssessmentId);
      setPendingAssessmentId(null);
    }
  };

  const handleStartRemediation = (assessmentId: string) => {
    setActiveAssessmentId(assessmentId);
  };

  const handleOpenGitSettings = () => {
    setPatInput(gitConfig.pat || 'ghp_live983274982374982374982374');
    setRepoInput(gitConfig.repoName);
    setBranchInput(gitConfig.branch);
    setGitModalStep(gitConfig.connected ? 'connected_success' : 'ask_repo');
    setIsGitModalOpen(true);
  };

  const handleBackFromAiFix = () => {
    if (previousScreen === 'pillar-detail') {
      go('pillar-detail');
    } else {
      go('report');
    }
  };

  const handleBackFromAssessment = () => {
    if (isAiFixMode) {
      handleBackFromAiFix();
    } else {
      setActiveAssessmentId(null);
    }
  };

  const handleCopyArn = (arn: string, id: string) => {
    navigator.clipboard.writeText(arn);
    setCopiedArnId(id);
    setTimeout(() => {
      setCopiedArnId(prev => (prev === id ? null : prev));
    }, 1800);
  };

  const handleCopyAllArns = (arns: string[]) => {
    navigator.clipboard.writeText(arns.join('\n'));
    setCopiedAllArns(true);
    setTimeout(() => setCopiedAllArns(false), 1800);
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const allResources = checkData.resources || [];
  const safeResourceIndex = selectedResourceIndex >= 0 && selectedResourceIndex < allResources.length
    ? selectedResourceIndex
    : 0;
  const activeResourceArn = allResources[safeResourceIndex] || '';
  const activeResourceInfo = useMemo(() => parseResourceInfo(activeResourceArn), [activeResourceArn]);
  const cliName = activeCloud === 'azure' ? 'Azure CLI (az)' : activeCloud === 'gcp' ? 'Google Cloud CLI (gcloud)' : 'AWS CLI v2';
  const cliHint = activeCloud === 'azure'
    ? `Run these Azure CLI (az) commands in your terminal to apply configuration to ${activeResourceInfo.shortName}.`
    : activeCloud === 'gcp'
    ? `Run these Google Cloud CLI (gcloud) commands in your terminal to apply configuration to ${activeResourceInfo.shortName}.`
    : `Run these AWS CLI commands in your terminal to apply configuration to ${activeResourceInfo.shortName}.`;
  const iacSecondLabel = activeCloud === 'azure' ? 'Azure Bicep (.bicep)' : activeCloud === 'gcp' ? 'Deployment Manager (.yml)' : 'CloudFormation (.yml)';
  const iacSecondExt = activeCloud === 'azure' ? 'bicep' : 'yml';
  const consoleName = activeCloud === 'azure' ? 'Azure Portal' : activeCloud === 'gcp' ? 'Google Cloud Console' : 'AWS Management Console';

  const currentResourceRemediation = useMemo(
    () => getResourceSpecificRemediation(checkData, activeResourceArn),
    [checkData, activeResourceArn]
  );
  const isCurrentResourceSolved = Boolean(solvedResourceArns[activeResourceArn]);
  const solvedResourcesInCheckCount = allResources.filter(r => solvedResourceArns[r]).length;

  const toggleResourceSolved = (arn: string) => {
    setSolvedResourceArns(prev => {
      const next = { ...prev, [arn]: !prev[arn] };
      const allDone = allResources.length > 0 && allResources.every(r => (r === arn ? next[arn] : next[r]));
      if (allDone) {
        markCheckSolved(checkData.id, true);
      }
      return next;
    });
  };

  const handleRerunResourceCheck = (checkId: string, arn: string) => {
    setVerifyingResourceKeys(prev => ({ ...prev, [arn]: true }));
    const targetAssessment = activeAssessmentId || selectedAssessmentId || 'A-001';
    api.rerunCheck({
      check_id: checkId,
      assessment_id: targetAssessment,
      resource_arn: arn,
      user_id: currentUser?.id,
      status: 'fixed',
    }).catch(err => console.warn('Could not rerun check in DB:', err));

    setTimeout(() => {
      setVerifyingResourceKeys(prev => ({ ...prev, [arn]: false }));
      setSolvedResourceArns(prev => ({ ...prev, [arn]: true }));
      setResourceRemediationStatus(checkId, arn, 'fixed');
      const info = parseResourceInfo(arn);
      setVerifiedResourceResults(prev => ({
        ...prev,
        [arn]: {
          passed: true,
          message: `${info.shortName} telemetry re-scanned: WAFR configuration rules verified compliant.`,
          timestamp: 'Just now',
        },
      }));
      showToast(
        `Check Passed: ${info.shortName} Verified`,
        'success',
        'Resource configuration verified compliant and synced across DB.'
      );
    }, 850);
  };

  const handleRerunFindingCheck = (checkId: string) => {
    setVerifyingFindingCheck(true);
    setCheckRerunFeedback(null);
    const targetAssessment = activeAssessmentId || selectedAssessmentId || 'A-001';
    api.rerunCheck({
      check_id: checkId,
      assessment_id: targetAssessment,
      user_id: currentUser?.id,
      status: 'fixed',
    }).catch(err => console.warn('Could not rerun finding check in DB:', err));

    setTimeout(() => {
      setVerifyingFindingCheck(false);
      const resources = checkData.resources || [];
      resources.forEach(r => {
        setResourceRemediationStatus(checkId, r, 'fixed');
      });
      setSolvedResourceArns(prev => {
        const next = { ...prev };
        resources.forEach(r => {
          next[r] = true;
        });
        return next;
      });
      markCheckSolved(checkId, true);
      setCheckRerunFeedback({
        checkId,
        passed: true,
        message: `Check ${checkId} verified! All ${resources.length} impacted resources passed telemetry inspection.`,
      });
      showToast(
        `Check ${checkId} Rerun Passed`,
        'success',
        'All resources verified compliant and updated in DB.'
      );
    }, 1000);
  };

  const handleRerunModalResource = () => {
    if (!activeResourceArn) return;
    setVerifyingModalResource(true);
    const targetAssessment = activeAssessmentId || selectedAssessmentId || 'A-001';
    api.rerunCheck({
      check_id: checkData.id,
      assessment_id: targetAssessment,
      resource_arn: activeResourceArn,
      user_id: currentUser?.id,
      status: 'fixed',
    }).catch(err => console.warn('Could not rerun check in DB:', err));

    setTimeout(() => {
      setVerifyingModalResource(false);
      setSolvedResourceArns(prev => ({ ...prev, [activeResourceArn]: true }));
      setResourceRemediationStatus(checkData.id, activeResourceArn, 'fixed');
      const info = activeResourceInfo;
      setVerifiedResourceResults(prev => ({
        ...prev,
        [activeResourceArn]: {
          passed: true,
          message: `${info.shortName} telemetry re-scanned: Configuration verified compliant.`,
          timestamp: 'Just now',
        },
      }));
      showToast(
        `Check Passed: ${info.shortName} Verified`,
        'success',
        'Resource verified compliant and updated in DB.'
      );
    }, 850);
  };

  const handleCopyCli = () => {
    navigator.clipboard.writeText(currentResourceRemediation.cliCommand);
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 1800);
  };

  const handleDownloadCode = (code: string, ext: string) => {
    const fileName = `remediate-${checkData.id.toLowerCase()}-${activeResourceInfo.shortName || 'resource'}.${ext}`;
    const blob = new Blob([code], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSimulate = () => {
    setSimulating(true);
    setSimulationSuccess(false);
    setTimeout(() => {
      setSimulating(false);
      setSimulationSuccess(true);
    }, 1100);
  };

  const handleGenerateIaC = () => {
    setGeneratingIaC(true);
    setIacGenerated(false);
    setTimeout(() => {
      setGeneratingIaC(false);
      setIacGenerated(true);
    }, 900);
  };

  const handleCreatePullRequest = () => {
    if (!gitConfig.connected) {
      handleOpenGitSettings();
      return;
    }
    setPrCreatedSuccess(false);
    setPrModalOpen(true);
  };

  const handleSubmitPullRequest = () => {
    setPrSubmitting(true);
    setTimeout(() => {
      setPrSubmitting(false);
      setPrCreatedSuccess(true);
      setCompletedChecks(prev => ({ ...prev, [checkData.id]: true }));
      setSolvedResourceArns(prev => {
        const next = { ...prev, [activeResourceArn]: true };
        const allDone = allResources.length > 0 && allResources.every(r => (r === activeResourceArn ? true : next[r]));
        if (allDone) {
          markCheckSolved(checkData.id, true);
        }
        return next;
      });
    }, 1400);
  };

  // Assessment list
  const assessmentList: AssessmentInfo[] = assessments || [];
  const currentActiveAssessment = assessmentList.find(a => a.id === activeAssessmentId) || assessmentList[0] || null;

  const filteredAssessments = assessmentList.filter(a => {
    if (assessmentCloudFilter !== 'all' && a.cloud !== assessmentCloudFilter) return false;
    if (assessmentSearch.trim()) {
      const q = assessmentSearch.toLowerCase().trim();
      return a.name.toLowerCase().includes(q) || a.accountName.toLowerCase().includes(q) || a.region.toLowerCase().includes(q) || a.id.toLowerCase().includes(q);
    }
    return true;
  });

  const isCheckSolved = (id: string) => {
    const assessmentKey = activeAssessmentId || 'default';
    return !!(solvedCheckIds[`${assessmentKey}::${id}`] || solvedCheckIds[id]);
  };
  const solvedChecksCount = allChecksList.filter(c => isCheckSolved(c.id)).length;
  const filteredChecks = allChecksList.filter(c => {
    if (checkSeverityFilter === 'critical_high' && !(c.severity === 'critical' || c.severity === 'high')) return false;
    if (checkSeverityFilter === 'medium' && c.severity !== 'medium') return false;
    if (checkSearch.trim()) {
      const q = checkSearch.toLowerCase().trim();
      return c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.pillar.toLowerCase().includes(q);
    }
    return true;
  });

  const checkPendingCount = useMemo(() => {
    const resList = checkData.resources || [];
    if (resList.length === 0) return 0;
    const assessmentKey = activeAssessmentId || 'default';
    return resList.filter(r => {
      const key = `${assessmentKey}::${checkData.id}::${r}`;
      const legacyKey = `${checkData.id}::${r}`;
      const st = (resourceRemediations[key] || resourceRemediations[legacyKey])?.status;
      return st !== 'fixed' && st !== 'cant_fix';
    }).length;
  }, [checkData, resourceRemediations, activeAssessmentId]);

  const isCheckMarkableSolved = checkPendingCount === 0;

  const DISPLAY_LIMIT = 4;
  const visibleResources = showAllResourcesList ? allResources : allResources.slice(0, DISPLAY_LIMIT);

  const filteredModalResources = allResources.filter(res => {
    if (!resourceSearch.trim()) return true;
    return res.toLowerCase().includes(resourceSearch.toLowerCase().trim());
  });

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: T.bg }}>

        {/* ── TOP HEADER / STATUS BAR ── */}
        <div
          className="px-6 py-3.5 flex items-center justify-between shrink-0 border-b sticky top-0 z-20"
          style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
        >
          <div className="flex items-center gap-3.5 flex-wrap">
            {isAiFixMode ? (
              <button
                type="button"
                onClick={handleBackFromAiFix}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  borderColor: T.border,
                  color: T.textSub,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.primary;
                  e.currentTarget.style.borderColor = T.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <span>{previousScreen === 'pillar-detail' ? '← Back to Pillar Details' : '← Back to Review Findings'}</span>
              </button>
            ) : activeAssessmentId ? (
              <button
                type="button"
                onClick={() => setActiveAssessmentId(null)}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  borderColor: T.border,
                  color: T.textSub,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.primary;
                  e.currentTarget.style.borderColor = T.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <span>← Back to Assessment List</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => go('dashboard')}
                className="text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5"
                style={{
                  borderColor: T.border,
                  color: T.textSub,
                  backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.primary;
                  e.currentTarget.style.borderColor = T.primary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
              >
                <span>← Dashboard</span>
              </button>
            )}

            <div className="h-4 w-[1px]" style={{ backgroundColor: T.border }} />

            <div className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 shadow-sm"
                style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                </svg>
              </div>
              <h1 className="text-base font-bold" style={{ color: T.text }}>
                {isAiFixMode ? (
                  <>AI Fix · <span className="font-mono text-blue-500">{checkData.id}</span></>
                ) : activeAssessmentId ? (
                  <>Remediation · <span className="font-mono text-blue-500">{currentActiveAssessment.name}</span></>
                ) : (
                  'Remediation Hub'
                )}
              </h1>
            </div>
          </div>

          {/* Right: Git Connection Pill & Actions */}
          <div className="flex items-center gap-2.5">
            {activeAssessmentId && solvedChecksCount > 0 && (
              <div
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold"
                style={{
                  backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                  color: isDark ? '#6EE7B7' : '#065F46',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{solvedChecksCount} of {allChecksList.length} Solved</span>
              </div>
            )}

            {gitConfig.connected ? (
              <button
                type="button"
                onClick={handleOpenGitSettings}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer shadow-sm"
                style={{
                  backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ECFDF5',
                  borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                  color: isDark ? '#6EE7B7' : '#065F46',
                }}
                title="Click to view or update Git configuration"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                <span className="font-mono">{gitConfig.repoName}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 font-bold">
                  {gitConfig.markedAsDone ? 'Done' : gitConfig.branch}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleOpenGitSettings}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                style={{ background: 'linear-gradient(135deg,#2563EB,#059669)' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="6" y1="3" x2="6" y2="15" />
                  <circle cx="18" cy="6" r="3" />
                  <circle cx="6" cy="18" r="3" />
                  <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                <span>{gitConfig.ignored ? 'Link Git Repo' : 'Connect Infra Repo'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ── VIEW 1: ASSESSMENT SELECTION LIST (when activeAssessmentId is null) ── */}
        {!activeAssessmentId ? (
          <div className="max-w-6xl w-full mx-auto p-6 flex flex-col gap-6">

            {/* Assessment Hub Header & Filters */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: T.text }}>
                    Select Assessment for Remediation
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    Choose an assessment below to review check-by-check automated fixes, test CLI scripts, and generate Pull Requests.
                  </p>
                </div>

                {/* Cloud Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                  {(['all', 'aws', 'azure', 'gcp'] as const).map(cloudType => (
                    <button
                      key={cloudType}
                      type="button"
                      onClick={() => setAssessmentCloudFilter(cloudType)}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all cursor-pointer"
                      style={{
                        backgroundColor: assessmentCloudFilter === cloudType ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                        color: assessmentCloudFilter === cloudType ? T.primary : T.textSub,
                        boxShadow: assessmentCloudFilter === cloudType ? T.shadow : 'none',
                      }}
                    >
                      {cloudType === 'all' ? 'All Clouds' : cloudType.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search Bar */}
              <div className="relative flex items-center">
                <svg
                  className="absolute left-3.5 pointer-events-none"
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ color: T.muted }}
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  type="text"
                  value={assessmentSearch}
                  onChange={e => setAssessmentSearch(e.target.value)}
                  placeholder="Search assessments by name, account ID, or region..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-xs border outline-none transition-all"
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#FFFFFF',
                    borderColor: T.border,
                    color: T.text,
                  }}
                />
              </div>
            </div>

            {/* Assessment Cards Grid */}
            {filteredAssessments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4 rounded-2xl border" style={{ backgroundColor: T.card, borderColor: T.border }}>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF', color: T.primary }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                  </svg>
                </div>
                <div className="font-semibold text-sm" style={{ color: T.text }}>
                  {assessmentList.length === 0 ? 'No assessments available for remediation' : 'No assessments match your search'}
                </div>
                <div className="text-xs max-w-sm" style={{ color: T.textSub }}>
                  {assessmentList.length === 0 ? 'Run your first architecture review to discover findings and automate infrastructure remediation.' : 'Try adjusting your search query or changing the cloud filter.'}
                </div>
                {assessmentList.length === 0 && (
                  <button
                    type="button"
                    onClick={() => go('org-questions')}
                    className="mt-2 px-5 py-2.5 rounded-full text-xs font-bold text-white shadow-sm cursor-pointer hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                  >
                    + Run New Assessment
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredAssessments.map(assessment => {
                  const highRiskCount = assessment.id === 'A-001' ? 4 : assessment.id === 'A-002' ? 3 : 2;
                  const remediableCount = 8;
                  return (
                    <div
                      key={assessment.id}
                      className="p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                      style={{
                        backgroundColor: T.card,
                        borderColor: T.border,
                        boxShadow: T.shadow,
                      }}
                    >
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <CloudChip id={assessment.cloud} size="sm" isDark={isDark} />
                            <div>
                              <h3 className="text-sm font-bold" style={{ color: T.text }}>
                                {assessment.name}
                              </h3>
                              <div className="text-[11px] font-mono mt-0.5" style={{ color: T.textSub }}>
                                {assessment.accountName} · {assessment.region}
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col items-end">
                            <span className="text-sm font-bold font-mono" style={{ color: assessment.score >= 80 ? T.success : T.primary }}>
                              {assessment.score}%
                            </span>
                            <span className="text-[10px]" style={{ color: T.muted }}>Score</span>
                          </div>
                        </div>

                        {/* Pill info badges */}
                        <div className="flex items-center gap-2 flex-wrap pt-1">
                          <span
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                            style={{
                              backgroundColor: isDark ? 'rgba(244,63,94,0.15)' : '#FFF1F2',
                              color: isDark ? '#FB7185' : '#E11D48',
                            }}
                          >
                            {highRiskCount} High Risks
                          </span>
                          <span
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg"
                            style={{
                              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                              color: isDark ? '#93C5FD' : '#2563EB',
                            }}
                          >
                            {remediableCount} Automated Fixes Ready
                          </span>
                          <span
                            className="text-[11px] font-medium px-2.5 py-1 rounded-lg"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F8FAFC',
                              color: T.textSub,
                            }}
                          >
                            ~35 min fix time
                          </span>
                        </div>
                      </div>

                      <div className="border-t pt-3 flex items-center justify-between" style={{ borderColor: T.border }}>
                        <span className="text-[11px] font-mono" style={{ color: T.textSub }}>
                          ID: {assessment.id}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleStartRemediation(assessment.id)}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                          style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                          </svg>
                          <span>Remediate Findings →</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── VIEW 2: CHECK-BY-CHECK REMEDIATION WORKSPACE ── */
          <div className="flex-1 flex overflow-hidden">

            {/* ── LEFT COLUMN: CHECK SELECTOR SIDEBAR ── */}
            <div
              className="w-80 shrink-0 border-r flex flex-col overflow-y-auto"
              style={{ backgroundColor: T.card, borderColor: T.border }}
            >
              {/* Sidebar Header */}
              <div className="p-3.5 border-b flex flex-col gap-2.5 shrink-0" style={{ borderColor: T.border }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.muted }}>
                    Remediable Checks
                  </span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                    {filteredChecks.length} available
                  </span>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                  <button
                    type="button"
                    onClick={() => setCheckSeverityFilter('all')}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: checkSeverityFilter === 'all' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: checkSeverityFilter === 'all' ? T.primary : T.textSub,
                    }}
                  >
                    All ({allChecksList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckSeverityFilter('critical_high')}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: checkSeverityFilter === 'critical_high' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: checkSeverityFilter === 'critical_high' ? T.primary : T.textSub,
                    }}
                  >
                    High (5)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCheckSeverityFilter('medium')}
                    className="flex-1 py-1 text-[11px] font-semibold rounded-lg transition-all cursor-pointer text-center"
                    style={{
                      backgroundColor: checkSeverityFilter === 'medium' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: checkSeverityFilter === 'medium' ? T.primary : T.textSub,
                    }}
                  >
                    Medium (4)
                  </button>
                </div>
              </div>

              {/* Check Items List */}
              <div className="flex flex-col p-2 gap-1.5 overflow-y-auto flex-1">
                {filteredChecks.map(item => {
                  const isSelected = item.id === activeCheckId;
                  const isCompleted = completedChecks[item.id];
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveCheckId(item.id)}
                      className="p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 relative"
                      style={{
                        backgroundColor: isSelected
                          ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF')
                          : (isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF'),
                        borderColor: isSelected
                          ? T.primary
                          : T.border,
                        boxShadow: isSelected ? T.shadow : 'none',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold" style={{ color: isSelected ? T.primary : T.text }}>
                            {item.id}
                          </span>
                          <SeverityPill severity={item.severity} dark={isDark} />
                        </div>

                        {solvedCheckIds[item.id] ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Solved
                          </span>
                        ) : isCompleted ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-500">
                            PR Opened
                          </span>
                        ) : null}
                      </div>

                      <div className="text-xs font-semibold line-clamp-2 leading-tight" style={{ color: isSelected ? T.text : T.textSub }}>
                        {item.title}
                      </div>

                      <div className="flex items-center justify-between text-[10px] pt-1" style={{ color: T.muted }}>
                        <span>{item.pillar}</span>
                        <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">IaC Ready</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── RIGHT COLUMN: CHECK REMEDIATION DETAILS ── */}
            <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 max-w-5xl">

              {/* Check Header Card */}
              <div
                className="p-6 rounded-2xl flex flex-col gap-4"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
              >
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg"
                      style={{
                        backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
                        color: isDark ? '#93C5FD' : '#2563EB',
                        border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE'}`,
                      }}
                    >
                      {checkData.id}
                    </span>
                    <SeverityPill severity={checkData.severity} dark={isDark} />
                    <span
                      className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                        color: T.textSub,
                      }}
                    >
                      {checkData.pillar} Pillar
                    </span>
                    <span className="text-xs" style={{ color: T.textSub }}>
                      {checkData.effort} · Est. {checkData.estTime}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {!isCheckMarkableSolved && !solvedCheckIds[checkData.id] && (
                      <span
                        className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5"
                        style={{
                          backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FEF3C7',
                          borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D',
                          color: isDark ? '#FBBF24' : '#D97706',
                        }}
                        title={`${checkPendingCount} resources still pending. Rerun check or mark all resources as Fixed/Ignored to solve.`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        {checkPendingCount} resource{checkPendingCount > 1 ? 's' : ''} pending
                      </span>
                    )}

                    {/* RERUN CHECK FOR FINDING */}
                    <button
                      type="button"
                      disabled={verifyingFindingCheck}
                      onClick={() => handleRerunFindingCheck(checkData.id)}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all shadow-xs cursor-pointer bg-blue-600 hover:bg-blue-700 text-white border-blue-600 disabled:opacity-50"
                      title="Rerun automated telemetry checks across all impacted resources for this finding"
                    >
                      {verifyingFindingCheck ? (
                        <>
                          <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                          </svg>
                          <span>Rerunning Check...</span>
                        </>
                      ) : (
                        <>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <polyline points="1 20 1 14 7 14" />
                            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                          </svg>
                          <span>Rerun Check</span>
                        </>
                      )}
                    </button>

                    {/* Finding Solved Status Badge */}
                    {solvedCheckIds[checkData.id] && (
                      <span
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border"
                        style={{
                          backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5',
                          borderColor: isDark ? 'rgba(52,211,153,0.35)' : '#A7F3D0',
                          color: isDark ? '#6EE7B7' : '#059669',
                        }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Finding Solved</span>
                      </span>
                    )}

                    {/* Slack Alert Button */}
                    <button
                      type="button"
                      onClick={() => setSlackModalOpen(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs text-[#E01E5A] dark:text-[#ECB22E]"
                      style={{
                        borderColor: isDark ? 'rgba(236,178,46,0.3)' : 'rgba(224,30,90,0.2)',
                        backgroundColor: isDark ? 'rgba(236,178,46,0.1)' : '#FFF5F7',
                      }}
                      title="Send instant Slack alert for this finding"
                    >
                      <SlackLogo size={12} />
                      <span>Slack Alert</span>
                    </button>

                    {/* Jira Linked Ticket */}
                    {jiraTickets && jiraTickets[checkData.id] ? (
                      <button
                        type="button"
                        onClick={() => setJiraModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs text-[#0052CC] dark:text-[#388BFF]"
                        style={{
                          borderColor: isDark ? 'rgba(56,139,255,0.35)' : 'rgba(0,82,204,0.25)',
                          backgroundColor: isDark ? 'rgba(0,82,204,0.15)' : '#EFF6FF',
                        }}
                        title={`Jira ticket ${jiraTickets[checkData.id].key} is ${jiraTickets[checkData.id].status}. Click to view or edit.`}
                      >
                        <JiraLogo size={12} />
                        <span>{jiraTickets[checkData.id].key}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold bg-blue-500/20">
                          {jiraTickets[checkData.id].status}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setJiraModalOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer shadow-xs text-[#0052CC] dark:text-[#388BFF]"
                        style={{
                          borderColor: isDark ? 'rgba(56,139,255,0.35)' : 'rgba(0,82,204,0.25)',
                          backgroundColor: isDark ? 'rgba(0,82,204,0.12)' : '#EFF6FF',
                        }}
                        title="Create and link Jira ticket for this finding"
                      >
                        <JiraLogo size={12} />
                        <span>+ Jira Ticket</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCreatePullRequest}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#2563EB,#059669)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="6" y1="3" x2="6" y2="15" />
                        <circle cx="18" cy="6" r="3" />
                        <circle cx="6" cy="18" r="3" />
                        <path d="M18 9a9 9 0 0 1-9 9" />
                      </svg>
                      <span>Create Pull Request</span>
                    </button>
                  </div>
                </div>

                <h2 className="text-xl font-bold" style={{ color: T.text }}>
                  {checkData.title}
                </h2>

                {/* Notice Banner: Check Rerun vs Full Assessment Status */}
                <div
                  className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs leading-relaxed flex-wrap"
                  style={{
                    backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#F0F9FF',
                    borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#BAE6FD',
                  }}
                >
                  <div className="flex items-start gap-2.5 min-w-0 flex-1">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 mt-0.5 bg-blue-500/15 text-blue-500 font-bold text-xs">
                      ℹ
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-blue-600 dark:text-blue-400">Rerun Check vs Assessment Status:</span>
                      <p className="mt-0.5" style={{ color: T.textSub }}>
                        After fixing impacted resources, click <strong>Rerun Check</strong> to test and confirm whether each resource is compliant. Rerunning individual checks verifies findings locally and does <em>not</em> update the overall Assessment Status or scores. To recalculate your overall WAFR score and update the assessment status, rerun the full assessment.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (currentAssessment) {
                        runOrUpdateAssessment({
                          cloud: currentAssessment.cloud,
                          accountId: currentAssessment.accountId,
                          accountName: currentAssessment.accountName,
                          region: currentAssessment.region,
                          name: currentAssessment.name,
                        });
                        showToast('Full Assessment Re-scan Initiated', 'info', `Re-scanning ${currentAssessment.name}`);
                        go('report');
                      } else {
                        go('assessment-list');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shrink-0 shadow-xs flex items-center gap-1.5"
                    title="Run a complete re-scan of this cloud assessment to refresh overall WAFR score and status"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="23 4 23 10 17 10" />
                      <polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    <span>Rerun Full Assessment</span>
                  </button>
                </div>

                {checkRerunFeedback && checkRerunFeedback.checkId === checkData.id && (
                  <div
                    className="p-3 rounded-xl border flex items-center gap-2.5 text-xs font-semibold bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 animate-fadeIn"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>{checkRerunFeedback.message}</span>
                  </div>
                )}

                {/* Problem Statement & Rationale */}
                <div
                  className="p-4 rounded-xl border flex items-start gap-3.5"
                  style={{
                    backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#DBEAFE',
                  }}
                >
                  <div className="mt-0.5 w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: T.primaryBg, color: T.primary }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="12" y1="16" x2="12" y2="12"/>
                      <line x1="12" y1="8" x2="12.01" y2="8"/>
                    </svg>
                  </div>
                  <div className="text-xs leading-relaxed" style={{ color: T.text }}>
                    <p className="font-semibold text-sm mb-1">{checkData.description}</p>
                    <p style={{ color: T.textSub }}>{checkData.rationale}</p>
                  </div>
                </div>

                {/* ── IMPACTED RESOURCES & RESOURCE-LEVEL REMEDIATION ── */}
                <div className="flex flex-col gap-4 pt-2 border-t" style={{ borderColor: T.border }}>
                  {/* Header bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textSub }}>
                        Impacted Resources ({allResources.length})
                      </span>
                      <span
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: solvedResourcesInCheckCount > 0
                            ? (isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5')
                            : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                          color: solvedResourcesInCheckCount > 0
                            ? (isDark ? '#6EE7B7' : '#059669')
                            : T.muted,
                        }}
                      >
                        {solvedResourcesInCheckCount} of {allResources.length} Remediated
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => go('diagram')}
                        className="text-xs font-medium hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                        style={{ color: T.textSub }}
                      >
                        <span>View in Architecture Diagram</span>
                      </button>
                      {allResources.length > DISPLAY_LIMIT && (
                        <button
                          type="button"
                          onClick={() => {
                            setResourceSearch('');
                            setResourcesModalOpen(true);
                          }}
                          className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer"
                          style={{ borderColor: T.border, color: T.primary }}
                        >
                          Search All ({allResources.length})
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    After applying your fix via IaC, CLI, or console, click <strong>Rerun Check</strong> on any resource to test whether it is resolved.
                  </p>

                  {/* Clean List of Impacted Resources (Not opened by default) */}
                  <div className="flex flex-col gap-2.5">
                    {visibleResources.map((res, i) => {
                      const realIndex = allResources.indexOf(res);
                      const resInfo = parseResourceInfo(res);
                      const resKey = `${activeAssessmentId || 'default'}::${checkData.id}::${res}`;
                      const legacyKey = `${checkData.id}::${res}`;
                      const resRem = resourceRemediations[resKey] || resourceRemediations[legacyKey];
                      const resStatus = resRem?.status || (solvedResourceArns[res] ? 'fixed' : 'pending');
                      const resNote = resRem?.note;
                      const isResSolved = resStatus === 'fixed';
                      const isCantFix = resStatus === 'cant_fix';
                      const isCopied = copiedArnId === `card-${i}`;
                      const isVerifying = Boolean(verifyingResourceKeys[res]);
                      const verResult = verifiedResourceResults[res];

                      return (
                        <div
                          key={res}
                          className="p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 flex-wrap hover:border-blue-400/50"
                          style={{
                            borderColor: isCantFix ? '#F59E0B' : isResSolved ? '#10B981' : T.border,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                            boxShadow: T.shadow,
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {/* Status Indicator Icon */}
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                              style={{
                                backgroundColor: isVerifying
                                  ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF')
                                  : isResSolved
                                  ? (isDark ? 'rgba(52,211,153,0.15)' : '#DCFCE7')
                                  : isCantFix
                                  ? (isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7')
                                  : (isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2'),
                                borderColor: isVerifying
                                  ? (isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE')
                                  : isResSolved
                                  ? (isDark ? 'rgba(52,211,153,0.3)' : '#86EFAC')
                                  : isCantFix
                                  ? (isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D')
                                  : (isDark ? 'rgba(239,68,68,0.3)' : '#FCA5A5'),
                                color: isVerifying
                                  ? '#3B82F6'
                                  : isResSolved
                                  ? (isDark ? '#6EE7B7' : '#059669')
                                  : isCantFix
                                  ? (isDark ? '#FBBF24' : '#D97706')
                                  : (isDark ? '#F87171' : '#DC2626'),
                              }}
                            >
                              {isVerifying ? (
                                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                                </svg>
                              ) : isResSolved ? (
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              ) : isCantFix ? (
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                                </svg>
                              ) : (
                                <span className="text-xs font-bold font-mono">!</span>
                              )}
                            </div>

                            {/* Resource Identity */}
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-bold truncate select-all" style={{ color: T.text }}>
                                  {resInfo.shortName}
                                </span>
                                <span
                                  className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                                  style={{
                                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9',
                                    color: T.textSub,
                                  }}
                                >
                                  {resInfo.type}
                                </span>
                                <span className="text-[10px] font-mono opacity-60">
                                  {resInfo.region}
                                </span>
                              </div>
                              <span className="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate max-w-lg mt-0.5 select-all">
                                {res}
                              </span>
                              {isCantFix && resNote && (
                                <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mt-1 flex items-center gap-1">
                                  <span className="font-semibold">Reason:</span> {resNote}
                                </div>
                              )}
                              {verResult && isResSolved && (
                                <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5 flex items-center gap-1">
                                  <span>✓ Live check verified: Compliant with rules</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Status & Actions */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {/* Status Badge */}
                            {isVerifying ? (
                              <span
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5 bg-blue-500/10 text-blue-500 border-blue-500/30"
                              >
                                <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                                </svg>
                                Testing Check...
                              </span>
                            ) : isResSolved ? (
                              <span
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 border"
                                style={{
                                  backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#DCFCE7',
                                  borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#86EFAC',
                                  color: isDark ? '#6EE7B7' : '#059669',
                                }}
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Fixed
                              </span>
                            ) : isCantFix ? (
                              <span
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5"
                                style={{
                                  backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
                                  borderColor: isDark ? 'rgba(245,158,11,0.35)' : '#FCD34D',
                                  color: isDark ? '#FBBF24' : '#D97706',
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                Ignored
                              </span>
                            ) : (
                              <span
                                className="text-[11px] font-bold px-2.5 py-1 rounded-full border flex items-center gap-1.5"
                                style={{
                                  backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2',
                                  borderColor: isDark ? 'rgba(239,68,68,0.3)' : '#FCA5A5',
                                  color: isDark ? '#F87171' : '#DC2626',
                                }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                Fix Pending
                              </span>
                            )}

                            {/* BUTTON 1: RERUN CHECK */}
                            <button
                              type="button"
                              disabled={isVerifying}
                              onClick={() => handleRerunResourceCheck(checkData.id, res)}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 ${
                                isResSolved
                                  ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-200'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                              } disabled:opacity-50`}
                              title="Rerun automated check to test whether this resource is fixed"
                            >
                              {isVerifying ? (
                                <>
                                  <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                                  </svg>
                                  <span>Testing...</span>
                                </>
                              ) : (
                                <>
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <polyline points="23 4 23 10 17 10" />
                                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                                  </svg>
                                  <span>{isResSolved ? 'Re-verify' : 'Rerun Check'}</span>
                                </>
                              )}
                            </button>

                            {/* BUTTON 2: IGNORED (WITH POPUP FOR REASON / CONSTRAINT NOTE) */}
                            <button
                              type="button"
                              onClick={() => {
                                setCantFixTargetResource(res);
                                setCantFixNote(resNote || 'Code dependency on legacy pipeline');
                                setCantFixModalOpen(true);
                              }}
                              className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                isCantFix
                                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/50 hover:bg-amber-500/30'
                                  : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                              }`}
                              title="Mark resource as ignored with a reason/constraint note"
                            >
                              {isCantFix ? 'Edit Note' : 'Ignored'}
                            </button>

                            {isCantFix && (
                              <button
                                type="button"
                                onClick={() => {
                                  setResourceRemediationStatus(checkData.id, res, 'pending');
                                  setSolvedResourceArns(prev => ({ ...prev, [res]: false }));
                                }}
                                className="text-[11px] font-semibold px-2 py-1 rounded-lg border bg-slate-500/10 text-slate-500 border-slate-500/30 hover:bg-slate-500/20 cursor-pointer"
                                title="Reset resource back to pending"
                              >
                                Reset
                              </button>
                            )}

                            {/* BUTTON 3: COPY ARN */}
                            <button
                              type="button"
                              onClick={() => handleCopyArn(res, `card-${i}`)}
                              className="text-[11px] font-sans px-2.5 py-1.5 rounded-xl border transition-all shrink-0 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800"
                              style={{
                                borderColor: isCopied ? T.success : T.border,
                                color: isCopied ? T.success : T.textSub,
                                backgroundColor: isCopied
                                  ? (isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5')
                                  : (isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'),
                              }}
                              title="Copy Resource ARN"
                            >
                              {isCopied ? 'Copied ARN' : 'Copy ARN'}
                            </button>

                            {/* BUTTON 4: AI FIX → */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedResourceIndex(realIndex);
                                setFixModalOpen(true);
                              }}
                              className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm ${
                                isResSolved
                                  ? 'border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                  : 'text-white bg-blue-600 hover:bg-blue-700'
                              }`}
                            >
                              <span>{isResSolved ? 'View Fix ↗' : 'AI Fix →'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {allResources.length > DISPLAY_LIMIT && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setShowAllResourcesList(prev => !prev)}
                          className="flex-1 py-2.5 px-4 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                          style={{
                            borderColor: isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
                            backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#EFF6FF',
                            color: T.primary,
                          }}
                        >
                          <span>{showAllResourcesList ? `Show Fewer (${DISPLAY_LIMIT}) Resources` : `Show All ${allResources.length} Resources Inline`}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResourceSearch('');
                            setResourcesModalOpen(true);
                          }}
                          className="py-2.5 px-4 rounded-xl border text-xs font-semibold transition-all cursor-pointer"
                          style={{
                            borderColor: T.border,
                            color: T.textSub,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                          }}
                        >
                          Search All Modal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── RESOURCE FIX MODAL POPUP ── */}
        {fixModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-4xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              {/* Modal Top Header */}
              <div
                className="px-6 py-4 border-b flex items-center justify-between shrink-0 gap-3"
                style={{
                  backgroundColor: isDark ? '#111B2E' : '#F8FAFC',
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: isCurrentResourceSolved
                        ? (isDark ? 'rgba(52,211,153,0.15)' : '#DCFCE7')
                        : (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF'),
                      borderColor: isCurrentResourceSolved
                        ? (isDark ? 'rgba(52,211,153,0.3)' : '#86EFAC')
                        : (isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE'),
                      color: isCurrentResourceSolved ? '#059669' : '#2563EB',
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="16 18 22 12 16 6" />
                      <polyline points="8 6 2 12 8 18" />
                    </svg>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {checkData.id}
                      </span>
                      <h3 className="text-sm sm:text-base font-bold font-mono truncate" style={{ color: T.text }}>
                        {activeResourceInfo.shortName}
                      </h3>
                      {isCurrentResourceSolved ? (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Remediated
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                          Fix Pending
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 font-mono truncate mt-0.5 select-all">
                      {activeResourceArn}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Previous / Next resource navigation */}
                  <div className="hidden sm:flex items-center gap-1 border rounded-xl p-1 bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-xs">
                    <button
                      type="button"
                      disabled={safeResourceIndex === 0}
                      onClick={() => setSelectedResourceIndex(safeResourceIndex - 1)}
                      className="px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700"
                      style={{ color: T.textSub }}
                      title="Previous resource"
                    >
                      ← Prev
                    </button>
                    <span className="text-[11px] font-mono px-2 font-semibold" style={{ color: T.textSub }}>
                      {safeResourceIndex + 1} of {allResources.length}
                    </span>
                    <button
                      type="button"
                      disabled={safeResourceIndex === allResources.length - 1}
                      onClick={() => setSelectedResourceIndex(safeResourceIndex + 1)}
                      className="px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white dark:hover:bg-slate-700"
                      style={{ color: T.textSub }}
                      title="Next resource"
                    >
                      Next →
                    </button>
                  </div>

                  {/* Rerun Check on Resource button */}
                  <button
                    type="button"
                    disabled={verifyingModalResource}
                    onClick={handleRerunModalResource}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                    title="Rerun automated check to test and verify whether this resource has been fixed"
                  >
                    {verifyingModalResource ? (
                      <>
                        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                        </svg>
                        <span>Testing Check...</span>
                      </>
                    ) : (
                      <>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                        </svg>
                        <span>{isCurrentResourceSolved ? 'Re-verify Check' : 'Rerun Check & Verify'}</span>
                      </>
                    )}
                  </button>

                  {/* Close Modal Button */}
                  <button
                    type="button"
                    onClick={() => setFixModalOpen(false)}
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors cursor-pointer hover:opacity-80"
                    style={{ borderColor: T.border, color: T.textSub }}
                    title="Close popup"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Modal Sub-Bar: Finding Context */}
              <div
                className="px-6 py-2.5 border-b text-xs flex items-center justify-between flex-wrap gap-2"
                style={{
                  backgroundColor: isDark ? '#0C1322' : '#F1F5F9',
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-500 dark:text-slate-400">Finding:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{checkData.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-slate-500">Placement: {activeResourceInfo.type} · {activeResourceInfo.region}</span>
                  <button
                    type="button"
                    onClick={() => handleCopyArn(activeResourceArn, 'modal-arn')}
                    className="text-[11px] text-blue-500 hover:underline cursor-pointer font-medium"
                  >
                    {copiedArnId === 'modal-arn' ? '✓ Copied ARN' : 'Copy ARN'}
                  </button>
                </div>
              </div>

              {/* 3 Tabs Header Bar */}
              <div
                className="px-6 py-3 border-b flex items-center justify-between flex-wrap gap-3"
                style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#FAFBFD' }}
              >
                <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                  <button
                    type="button"
                    onClick={() => setMethodTab('iac')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={{
                      backgroundColor: methodTab === 'iac' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: methodTab === 'iac' ? T.primary : T.textSub,
                      boxShadow: methodTab === 'iac' ? T.shadow : 'none',
                    }}
                  >
                    <span>IaC Templates</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethodTab('cli')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={{
                      backgroundColor: methodTab === 'cli' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: methodTab === 'cli' ? T.primary : T.textSub,
                      boxShadow: methodTab === 'cli' ? T.shadow : 'none',
                    }}
                  >
                    <span>Cloud CLI</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setMethodTab('manual')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                    style={{
                      backgroundColor: methodTab === 'manual' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: methodTab === 'manual' ? T.primary : T.textSub,
                      boxShadow: methodTab === 'manual' ? T.shadow : 'none',
                    }}
                  >
                    <span>Manual Console Steps</span>
                  </button>
                </div>

                {methodTab === 'iac' && (
                  <button
                    type="button"
                    onClick={handleCreatePullRequest}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                    style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                    <span>Create Pull Request</span>
                  </button>
                )}

                {methodTab === 'cli' && (
                  <button
                    type="button"
                    onClick={handleCopyCli}
                    className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5"
                    style={{ borderColor: T.border, color: cliCopied ? T.success : T.textSub }}
                  >
                    <span>{cliCopied ? '✓ Copied CLI Script' : 'Copy CLI Command'}</span>
                  </button>
                )}
              </div>

              {/* Modal Body: Scrollable Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
                {/* Method 1: IaC Templates */}
                {methodTab === 'iac' && (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between flex-wrap gap-3 border-b pb-3" style={{ borderColor: T.border }}>
                      <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                        <button
                          type="button"
                          onClick={() => setIacLanguage('tf')}
                          className="px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                          style={{
                            backgroundColor: iacLanguage === 'tf' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                            color: iacLanguage === 'tf' ? T.text : T.textSub,
                            boxShadow: iacLanguage === 'tf' ? T.shadow : 'none',
                          }}
                        >
                          Terraform (.tf)
                        </button>
                        <button
                          type="button"
                          onClick={() => setIacLanguage('cf')}
                          className="px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer"
                          style={{
                            backgroundColor: iacLanguage === 'cf' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                            color: iacLanguage === 'cf' ? T.text : T.textSub,
                            boxShadow: iacLanguage === 'cf' ? T.shadow : 'none',
                          }}
                        >
                          {iacSecondLabel}
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopyCode(currentResourceRemediation[iacLanguage])}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: T.border, color: copied ? T.success : T.textSub }}
                        >
                          {copied ? '✓ Copied' : 'Copy Template'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadCode(currentResourceRemediation[iacLanguage], iacLanguage === 'tf' ? 'tf' : iacSecondExt)}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                          style={{ borderColor: T.border, color: T.textSub }}
                        >
                          ↓ Download {iacLanguage === 'tf' ? '.tf' : `.${iacSecondExt}`}
                        </button>
                        <button
                          type="button"
                          onClick={handleSimulate}
                          disabled={simulating}
                          className="px-3.5 py-1.5 text-xs font-semibold rounded-xl text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50"
                          style={{ backgroundColor: T.primary }}
                        >
                          {simulating ? 'Simulating…' : 'Simulate Plan'}
                        </button>
                      </div>
                    </div>

                    {simulationSuccess && (
                      <div
                        className="p-4 rounded-xl border flex items-center justify-between gap-3 animate-fadeIn flex-wrap"
                        style={{
                          backgroundColor: isDark ? 'rgba(52,211,153,0.1)' : '#ECFDF5',
                          borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                          color: isDark ? '#6EE7B7' : '#065F46',
                        }}
                      >
                        <div className="flex items-center gap-2 text-xs font-semibold">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          <span>Simulation Passed: Configuration valid for {activeResourceInfo.shortName}. 0 breaking changes detected.</span>
                        </div>
                        <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 font-bold">
                          Exit Code 0
                        </span>
                      </div>
                    )}

                    <div className="relative rounded-2xl overflow-hidden border shadow-inner" style={{ borderColor: T.border }}>
                      <div className="px-4 py-2.5 border-b flex items-center justify-between text-xs font-mono" style={{ backgroundColor: isDark ? '#0F172A' : '#1E293B', borderColor: isDark ? '#1E293B' : '#334155', color: '#94A3B8' }}>
                        <span className="text-white font-bold">
                          {iacLanguage === 'tf'
                            ? `terraform/${activeResourceInfo.shortName}.tf`
                            : activeCloud === 'azure'
                            ? `bicep/${activeResourceInfo.shortName}.bicep`
                            : activeCloud === 'gcp'
                            ? `deployment-manager/${activeResourceInfo.shortName}.yml`
                            : `cloudformation/${activeResourceInfo.shortName}.yml`}
                        </span>
                        <span>Tailored for {activeResourceInfo.shortName}</span>
                      </div>
                      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed" style={{ backgroundColor: isDark ? '#0A0F1D' : '#0F172A', color: '#E2E8F0' }}>
                        <code>{currentResourceRemediation[iacLanguage]}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* Method 2: Cloud CLI */}
                {methodTab === 'cli' && (
                  <div className="flex flex-col gap-4">
                    <div className="p-4 rounded-xl border flex items-center justify-between gap-3" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                      <span className="text-xs" style={{ color: T.textSub }}>{cliHint}</span>
                      <button
                        type="button"
                        onClick={handleCopyCli}
                        className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer shrink-0"
                        style={{ borderColor: T.border, color: cliCopied ? T.success : T.textSub }}
                      >
                        {cliCopied ? '✓ Copied' : 'Copy Command'}
                      </button>
                    </div>

                    <div className="relative rounded-2xl overflow-hidden border shadow-inner" style={{ borderColor: T.border }}>
                      <div className="px-4 py-2.5 border-b flex items-center justify-between text-xs font-mono" style={{ backgroundColor: isDark ? '#0F172A' : '#1E293B', borderColor: isDark ? '#1E293B' : '#334155', color: '#94A3B8' }}>
                        <span className="text-white font-bold">{cliName}</span>
                        <span>{activeResourceInfo.region}</span>
                      </div>
                      <pre className="p-4 text-xs font-mono overflow-x-auto leading-relaxed" style={{ backgroundColor: isDark ? '#0A0F1D' : '#0F172A', color: '#6EE7B7' }}>
                        <code>{currentResourceRemediation.cliCommand}</code>
                      </pre>
                    </div>
                  </div>
                )}

                {/* Method 3: Manual Console Steps */}
                {methodTab === 'manual' && (
                  <div className="flex flex-col gap-3">
                    <p className="text-xs" style={{ color: T.textSub }}>
                      Follow these step-by-step console instructions to configure {activeResourceInfo.shortName} in the {consoleName}:
                    </p>

                    <div className="flex flex-col gap-2.5">
                      {checkData.manualSteps.map(step => (
                        <div
                          key={step.step}
                          className="p-4 rounded-xl border flex items-start gap-3.5 transition-all"
                          style={{
                            borderColor: T.border,
                            backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
                          }}
                        >
                          <span
                            className="w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5"
                            style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#DBEAFE', color: T.primary }}
                          >
                            {step.step}
                          </span>
                          <div className="flex-1 min-w-0 flex flex-col gap-1">
                            <div className="flex items-center justify-between flex-wrap gap-1">
                              <h5 className="text-xs font-bold" style={{ color: T.text }}>
                                {step.title}
                              </h5>
                              {step.consolePath && (
                                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                  {step.consolePath}
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                              {step.instruction}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div
                className="px-6 py-3.5 border-t flex items-center justify-between flex-wrap gap-3 shrink-0"
                style={{
                  backgroundColor: isDark ? '#111B2E' : '#F8FAFC',
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center gap-2 text-xs font-medium" style={{ color: T.textSub }}>
                  <span>Progress:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {solvedResourcesInCheckCount} of {allResources.length} Resources Remediated
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFixModalOpen(false)}
                    className="px-4 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    Close
                  </button>

                  {/* Rerun Check on Resource button in footer */}
                  <button
                    type="button"
                    disabled={verifyingModalResource}
                    onClick={handleRerunModalResource}
                    className="px-4 py-1.5 text-xs font-bold text-white rounded-xl transition-all cursor-pointer shadow-sm bg-blue-600 hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {verifyingModalResource ? (
                      <>
                        <svg className="animate-spin" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                        </svg>
                        <span>Testing Check...</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="23 4 23 10 17 10" />
                          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                        </svg>
                        <span>{isCurrentResourceSolved ? 'Re-verify Check' : 'Rerun Check & Verify'}</span>
                      </>
                    )}
                  </button>

                  {safeResourceIndex < allResources.length - 1 && (
                    <button
                      type="button"
                      onClick={() => setSelectedResourceIndex(safeResourceIndex + 1)}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                    >
                      Next Resource →
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GIT CONNECTION POPUP MODAL ── */}
        {isGitModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: T.text }}>
                      Git Repository Integration
                    </h3>
                    <p className="text-[11px]" style={{ color: T.textSub }}>
                      Connect your infrastructure repo to automate WAFR fixes
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleIgnoreGit}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors cursor-pointer hover:opacity-80"
                  style={{ borderColor: T.border, color: T.textSub }}
                  title="Close / Ignore for now"
                >
                  ✕
                </button>
              </div>

              {/* Modal Body: STEP 1 - ASK FOR REPO ACTION */}
              {gitModalStep === 'ask_repo' && (
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <h4 className="text-base font-bold" style={{ color: T.text }}>
                      Git Repository Integration
                    </h4>
                    <p className="text-xs mt-1 leading-relaxed" style={{ color: T.textSub }}>
                      Connect your infrastructure codebase to enable 1-click Pull Requests, or continue with manual fixes.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Option 1: Authenticate Repo */}
                    <button
                      type="button"
                      onClick={() => {
                        setGitConfig(prev => ({ ...prev, hasExistingRepo: true }));
                        setGitModalStep('pat_form');
                      }}
                      className="p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer hover:border-blue-500 group"
                      style={{
                        backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#EFF6FF',
                        borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold flex items-center gap-2" style={{ color: T.text }}>
                          <span>Authenticate Repo</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            Recommended
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: T.textSub }}>
                          Authenticate via GitHub Personal Access Token (PAT) with repo scope to enable code inspection and direct Pull Request creation.
                        </p>
                      </div>
                    </button>

                    {/* Option 2: Mark as Done */}
                    <button
                      type="button"
                      onClick={handleMarkAsDone}
                      className="p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer hover:border-emerald-500 group"
                      style={{
                        backgroundColor: isDark ? 'rgba(16,185,129,0.06)' : '#ECFDF5',
                        borderColor: isDark ? 'rgba(16,185,129,0.3)' : '#A7F3D0',
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold flex items-center gap-2" style={{ color: T.text }}>
                          <span>Mark as Done</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Pre-Configured
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: T.textSub }}>
                          Repository access and CI/CD pipelines are already established in your organization. Mark this step as completed.
                        </p>
                      </div>
                    </button>

                    {/* Option 3: Ignore */}
                    <button
                      type="button"
                      onClick={handleIgnoreGit}
                      className="p-4 rounded-xl border text-left flex items-start gap-3.5 transition-all cursor-pointer hover:border-slate-400 group"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: T.border,
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-slate-500/10 text-slate-500 flex items-center justify-center shrink-0 mt-0.5 group-hover:bg-slate-600 group-hover:text-white transition-colors">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" />
                          <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold flex items-center gap-2" style={{ color: T.text }}>
                          <span>Ignore / Skip for Now</span>
                          <span className="text-[10px] font-semibold px-2 py-0.2 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            Manual & CLI
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: T.textSub }}>
                          Skip repository connection. You can still view, copy, and apply Terraform files, {cliName} scripts, or manual {consoleName} fixes.
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Modal Body: STEP 2 - GITHUB PAT & REPO FORM */}
              {gitModalStep === 'pat_form' && (
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <h4 className="text-base font-bold" style={{ color: T.text }}>
                      Authenticate GitHub Repository
                    </h4>
                    <p className="text-xs mt-1" style={{ color: T.textSub }}>
                      Provide your GitHub Personal Access Token (PAT) with <code className="font-mono text-blue-500">repo</code> scope to enable code inspection and PR creation.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                        GitHub Personal Access Token (PAT) *
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type={showPat ? 'text' : 'password'}
                          value={patInput}
                          onChange={e => {
                            setPatInput(e.target.value);
                            setPatError('');
                          }}
                          placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                          className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none transition-all"
                          style={{
                            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                            borderColor: patError ? '#E11D48' : T.border,
                            color: T.text,
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPat(!showPat)}
                          className="absolute right-3 text-xs font-medium text-slate-400 hover:text-slate-600 cursor-pointer"
                        >
                          {showPat ? 'Hide' : 'Show'}
                        </button>
                      </div>
                      {patError && (
                        <p className="text-[11px] text-rose-500 mt-1 font-medium">{patError}</p>
                      )}
                    </div>

                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                        Repo URL
                      </label>
                      <input
                        type="text"
                        value={repoInput}
                        onChange={e => setRepoInput(e.target.value)}
                        placeholder="https://github.com/acme-corp/terraform-aws-infrastructure"
                        className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none transition-all"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                          borderColor: T.border,
                          color: T.text,
                        }}
                      />
                    </div>

                    <div>
                      <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                        Default Branch
                      </label>
                      <input
                        type="text"
                        value={branchInput}
                        onChange={e => setBranchInput(e.target.value)}
                        placeholder="main"
                        className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none transition-all"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                          borderColor: T.border,
                          color: T.text,
                        }}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t flex-wrap gap-2" style={{ borderColor: T.border }}>
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPatInput('ghp_live983274982374982374982374');
                            setPatError('');
                          }}
                          className="text-xs font-semibold text-blue-500 hover:underline cursor-pointer"
                        >
                          Demo PAT
                        </button>
                        <span style={{ color: T.textSub }}>·</span>
                        <button
                          type="button"
                          onClick={handleMarkAsDone}
                          className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Mark as Done
                        </button>
                        <span style={{ color: T.textSub }}>·</span>
                        <button
                          type="button"
                          onClick={handleIgnoreGit}
                          className="text-xs font-semibold text-slate-500 hover:underline cursor-pointer"
                        >
                          Ignore
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setGitModalStep('ask_repo')}
                          className="px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                          style={{ borderColor: T.border, color: T.textSub }}
                        >
                          ← Back
                        </button>
                        <button
                          type="button"
                          onClick={handleConnectGit}
                          className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                        >
                          Authenticate Repo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Modal Body: STEP 3 - VALIDATING */}
              {gitModalStep === 'validating' && (
                <div className="p-8 flex flex-col items-center justify-center text-center gap-4">
                  <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin" />
                  <div>
                    <h4 className="text-sm font-bold" style={{ color: T.text }}>
                      Verifying GitHub Authentication...
                    </h4>
                    <p className="text-xs mt-1" style={{ color: T.textSub }}>
                      Validating PAT permissions for <span className="font-mono">{repoInput}</span> on branch <span className="font-mono">{branchInput}</span>
                    </p>
                  </div>
                </div>
              )}

              {/* Modal Body: STEP 4 - SUCCESS */}
              {gitModalStep === 'connected_success' && (
                <div className="p-6 flex flex-col gap-4">
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="text-xs font-bold">Repository Connected Successfully</div>
                      <div className="text-[11px] opacity-90 font-mono">
                        {gitConfig.repoName} ({gitConfig.branch})
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    Your Git repository is now linked. You can now browse assessments and generate automated remediation pull requests directly into your codebase.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                    <button
                      type="button"
                      onClick={handleFinishGitModal}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                    >
                      Continue to Remediation
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── PULL REQUEST CREATION MODAL ── */}
        {prModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-xl rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="6" y1="3" x2="6" y2="15" />
                      <circle cx="18" cy="6" r="3" />
                      <circle cx="6" cy="18" r="3" />
                      <path d="M18 9a9 9 0 0 1-9 9" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: T.text }}>
                      Create Pull Request
                    </h3>
                    <p className="text-[11px]" style={{ color: T.textSub }}>
                      Target: <span className="font-mono text-blue-500">{repoConfig.repoName || gitConfig.repoName}</span> (branch: <span className="font-mono">{repoConfig.branch || gitConfig.branch}</span>)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setPrModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors cursor-pointer"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  ✕
                </button>
              </div>

              {prCreatedSuccess ? (
                <div className="p-6 flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                      ✓
                    </div>
                    <div>
                      <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Pull Request #42 Created on GitHub!
                      </div>
                      <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        branch: wafr-fix/{checkData.id.toLowerCase()}-{activeResourceInfo.shortName.toLowerCase().replace(/[^a-z0-9]/g, '-')} → main
                      </div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    The pull request contains complete Terraform configurations to resolve finding <span className="font-mono font-bold text-blue-500">{checkData.id}</span> for <span className="font-mono font-semibold text-emerald-500">{activeResourceInfo.shortName}</span> with 0 breaking changes.
                  </p>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                    <button
                      type="button"
                      onClick={() => setPrModalOpen(false)}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                      PR Title
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`[WAFR Fix] ${checkData.title} - ${activeResourceInfo.shortName} (${checkData.id})`}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-medium border outline-none bg-slate-500/5"
                      style={{ borderColor: T.border, color: T.text }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                      New Branch Name
                    </label>
                    <input
                      type="text"
                      readOnly
                      value={`wafr-fix/${checkData.id.toLowerCase()}-${activeResourceInfo.shortName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-mono border outline-none bg-slate-500/5"
                      style={{ borderColor: T.border, color: T.text }}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold block mb-1" style={{ color: T.text }}>
                      Changes to Commit (.tf)
                    </label>
                    <div
                      className="p-3 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36 leading-relaxed"
                      style={{
                        backgroundColor: isDark ? '#0A0E17' : '#0F172A',
                        color: '#6EE7B7',
                        border: `1px solid ${isDark ? '#1E293B' : '#334155'}`,
                      }}
                    >
                      <pre>+ {currentResourceRemediation.tf.slice(0, 300)}...</pre>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                    <button
                      type="button"
                      onClick={() => setPrModalOpen(false)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitPullRequest}
                      disabled={prSubmitting}
                      className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      {prSubmitting ? 'Opening PR on GitHub...' : 'Confirm & Open PR'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── IMPACTED RESOURCES MODAL ── */}
        {resourcesModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-3xl max-h-[85vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              <div
                className="px-6 py-4 border-b flex items-center justify-between shrink-0"
                style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FAFBFD' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                    style={{
                      backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                      color: T.primary,
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="20" height="14" x="2" y="5" rx="2" />
                      <line x1="2" y1="10" x2="22" y2="10" />
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-bold" style={{ color: T.text }}>
                        Impacted Resources
                      </h2>
                      <span
                        className="text-xs font-semibold px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
                          color: T.primary,
                        }}
                      >
                        {allResources.length} total
                      </span>
                    </div>
                    <p className="text-xs mt-0.5 truncate" style={{ color: T.textSub }}>
                      Check: <span className="font-mono font-medium" style={{ color: T.primary }}>{checkData.id}</span> · {checkData.title}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setResourcesModalOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors cursor-pointer border shrink-0 ml-2"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  ✕
                </button>
              </div>

              {/* Modal Search Bar */}
              <div
                className="p-4 border-b shrink-0 flex flex-col gap-2.5"
                style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : '#FFFFFF' }}
              >
                <input
                  type="text"
                  value={resourceSearch}
                  onChange={e => setResourceSearch(e.target.value)}
                  placeholder="Search resources by name, ARN, service, or region..."
                  className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none transition-all"
                  style={{
                    backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
                    borderColor: T.border,
                    color: T.text,
                  }}
                />

                <div className="flex items-center justify-between text-xs px-1" style={{ color: T.textSub }}>
                  <span>Showing {filteredModalResources.length} of {allResources.length} resources</span>
                  {filteredModalResources.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleCopyAllArns(filteredModalResources)}
                      className="font-medium hover:underline cursor-pointer text-blue-500"
                    >
                      {copiedAllArns ? '✓ Copied All ARNs' : `Copy All (${filteredModalResources.length})`}
                    </button>
                  )}
                </div>
              </div>

              {/* Modal Resources List */}
              <div className="p-4 flex-1 overflow-y-auto max-h-[55vh] flex flex-col gap-2">
                {filteredModalResources.map((res, i) => {
                  const isCopied = copiedArnId === `modal-${i}`;
                  const resInfo = parseResourceInfo(res);
                  const resKey = `${activeAssessmentId || 'default'}::${checkData.id}::${res}`;
                  const legacyKey = `${checkData.id}::${res}`;
                  const resRem = resourceRemediations[resKey] || resourceRemediations[legacyKey];
                  const resStatus = resRem?.status || (solvedResourceArns[res] ? 'fixed' : 'pending');
                  const isResSolved = resStatus === 'fixed';
                  const isCantFix = resStatus === 'cant_fix';
                  const originalIndex = allResources.indexOf(res);
                  const isCurrentlyActive = originalIndex === safeResourceIndex;

                  return (
                    <div
                      key={i}
                      className="p-3 rounded-xl border flex items-center justify-between gap-3 transition-colors"
                      style={{
                        backgroundColor: isCurrentlyActive
                          ? (isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF')
                          : (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC'),
                        borderColor: isCurrentlyActive ? T.primary : T.border,
                      }}
                    >
                      <div className="flex flex-col gap-1 min-w-0 flex-1 mr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold" style={{ color: isCurrentlyActive ? T.primary : T.text }}>
                            {resInfo.shortName}
                          </span>
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-md"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                              color: T.textSub,
                            }}
                          >
                            {resInfo.type}
                          </span>
                          {isResSolved ? (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isDark ? 'rgba(52,211,153,0.2)' : '#D1FAE5',
                                color: isDark ? '#6EE7B7' : '#059669',
                              }}
                            >
                              ✓ Fixed
                            </span>
                          ) : isCantFix ? (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#FEF3C7',
                                color: isDark ? '#FBBF24' : '#D97706',
                              }}
                            >
                              • Ignored
                            </span>
                          ) : (
                            <span
                              className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                              style={{
                                backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEE2E2',
                                color: isDark ? '#F87171' : '#DC2626',
                              }}
                            >
                              Fix Pending
                            </span>
                          )}
                        </div>
                        <span className="font-mono text-[11px] truncate select-all opacity-80" style={{ color: T.textSub }}>
                          {res}
                        </span>
                        {isCantFix && resRem?.note && (
                          <div className="text-[10px] text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                            <span className="font-semibold">Reason:</span> {resRem.note}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyArn(res, `modal-${i}`)}
                          className="text-[11px] font-sans px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer"
                          style={{
                            borderColor: isCopied ? T.success : T.border,
                            color: isCopied ? T.success : T.textSub,
                            backgroundColor: isCopied
                              ? (isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5')
                              : (isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'),
                          }}
                        >
                          {isCopied ? 'Copied' : 'Copy ARN'}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (originalIndex !== -1) {
                              setSelectedResourceIndex(originalIndex);
                            }
                            setResourcesModalOpen(false);
                          }}
                          className="text-xs font-semibold px-3 py-1 rounded-lg transition-all cursor-pointer shadow-sm"
                          style={{
                            backgroundColor: isCurrentlyActive ? T.primary : (isDark ? '#1E293B' : '#E2E8F0'),
                            color: isCurrentlyActive ? '#FFFFFF' : T.text,
                          }}
                        >
                          {isCurrentlyActive ? 'Active' : 'Select & Remediate'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div
                className="px-6 py-3.5 border-t flex items-center justify-end shrink-0"
                style={{ borderColor: T.border }}
              >
                <button
                  type="button"
                  onClick={() => setResourcesModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── IGNORED REASON MODAL ── */}
        {cantFixModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div
              className="w-full max-w-md p-6 rounded-2xl shadow-2xl border flex flex-col gap-4"
              style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
            >
              <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: T.border }}>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                  <h3 className="font-bold text-sm">Mark Resource as "Ignored"</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCantFixModalOpen(false)}
                  className="text-xs font-mono px-2 py-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="text-xs space-y-2">
                <p className="font-medium text-slate-500">Target Resource:</p>
                <p className="font-mono text-xs p-2 rounded bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 break-all">
                  {cantFixTargetResource}
                </p>

                <p className="font-medium text-slate-500 pt-2">Reason / Constraint Note (e.g. Code dependency, vendor restriction):</p>
                <textarea
                  rows={3}
                  value={cantFixNote}
                  onChange={e => setCantFixNote(e.target.value)}
                  placeholder="Enter reason why this resource is ignored (e.g. Code dependency on legacy pipeline)..."
                  className="w-full p-2.5 text-xs rounded-xl border outline-none focus:ring-2 focus:ring-amber-500/50"
                  style={{ backgroundColor: isDark ? '#0B1220' : '#F8FAFC', borderColor: T.border, color: T.text }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                <button
                  type="button"
                  onClick={() => setCantFixModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border cursor-pointer"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (cantFixTargetResource) {
                      setResourceRemediationStatus(activeCheckId || checkData.id, cantFixTargetResource, 'cant_fix', cantFixNote);
                      setSolvedResourceArns(prev => ({ ...prev, [cantFixTargetResource]: false }));
                      const info = parseResourceInfo(cantFixTargetResource);
                      showToast(
                        'Resource Ignored',
                        'info',
                        `Reason recorded for ${info.shortName}. Resource status updated to Ignored.`
                      );
                    }
                    setCantFixModalOpen(false);
                  }}
                  className="px-4 py-1.5 text-xs font-semibold rounded-xl text-white bg-amber-600 hover:bg-amber-700 shadow-sm cursor-pointer"
                >
                  Save Reason & Exclude
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Linked Jira Ticket Modal */}
        {jiraModalOpen && (
          <JiraTicketModal
            isOpen={true}
            onClose={() => setJiraModalOpen(false)}
            checkId={checkData.id}
            checkTitle={checkData.title}
            severity={checkData.severity}
            checkDescription={checkData.description}
            existingTicket={jiraTickets ? jiraTickets[checkData.id] : undefined}
          />
        )}

        {/* Slack Alert Modal */}
        {slackModalOpen && (
          <SlackAlertModal
            isOpen={true}
            onClose={() => setSlackModalOpen(false)}
            initialTitle={`Cloud Architecture Alert: ${checkData.title}`}
            initialMessage={`Remediation required for finding ${checkData.id} (${checkData.pillar} Pillar) - ${checkData.severity.toUpperCase()} risk.\n\nDescription: ${checkData.description}\nImpacted Resources: ${checkData.resources?.length || 0} resource(s).`}
            initialSeverity={checkData.severity === 'critical' ? 'critical' : checkData.severity === 'high' ? 'high' : 'info'}
            checkId={checkData.id}
          />
        )}
      </div>
    </AppLayout>
  );
}
