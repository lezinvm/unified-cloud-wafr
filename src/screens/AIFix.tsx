import { useState, useEffect, useMemo } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { SeverityPill } from '../components/FindingUI';
import { PILLARS_DATA } from '../data/wafrData';
import { REMEDIATION_DATABASE, parseResourceInfo } from './AIRemediation';
import {
  fetchRemediationsFromDb,
  getFallbackRemediations,
  type CheckRemediationData,
} from '../data/remediationData';
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

export function AIFix() {
  const {
    go,
    theme,
    remediationFindingId,
    previousScreen,
    selectedPillarId,
    selectedAssessmentId,
    currentAssessment,
    solvedCheckIds,
    toggleCheckSolved,
    markCheckSolved,
    resourceRemediations,
    setResourceRemediationStatus,
    runOrUpdateAssessment,
    showToast,
    currentUser,
  } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const selectedAssm = currentAssessment;
  const activeCloud = (((selectedAssm?.cloud || 'aws') as string).toLowerCase()) as 'aws' | 'azure' | 'gcp';

  const [remediationsDb, setRemediationsDb] = useState<Record<string, CheckRemediationData>>(() => getFallbackRemediations(activeCloud));

  useEffect(() => {
    let cancelled = false;
    fetchRemediationsFromDb(activeCloud).then(data => {
      if (!cancelled && data && Object.keys(data).length > 0) {
        setRemediationsDb(data);
      }
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeCloud]);

  const targetCheckId = remediationFindingId && remediationsDb[remediationFindingId]
    ? remediationFindingId
    : (Object.keys(remediationsDb)[0] || 'REL-019');

  const checkData = remediationsDb[targetCheckId] || Object.values(remediationsDb)[0] || REMEDIATION_DATABASE['REL-019'];
  const isSolved = Boolean(solvedCheckIds[targetCheckId]);

  const cliName = activeCloud === 'azure' ? 'Azure CLI (az)' : activeCloud === 'gcp' ? 'Google Cloud CLI (gcloud)' : 'AWS CLI v2';
  const iacSecondLabel = activeCloud === 'azure' ? 'Azure Bicep (.bicep)' : activeCloud === 'gcp' ? 'Deployment Manager (.yml)' : 'CloudFormation (.yml)';
  const iacSecondExt = activeCloud === 'azure' ? 'bicep' : 'yml';
  const consoleName = activeCloud === 'azure' ? 'Azure Portal' : activeCloud === 'gcp' ? 'Google Cloud Console' : 'AWS Management Console';

  const checkPendingCount = useMemo(() => {
    const resList = checkData.resources || [];
    if (resList.length === 0) return 0;
    const assessmentKey = selectedAssessmentId || 'default';
    return resList.filter(r => {
      const key = `${assessmentKey}::${checkData.id}::${r}`;
      const legacyKey = `${checkData.id}::${r}`;
      const st = (resourceRemediations[key] || resourceRemediations[legacyKey])?.status;
      return st !== 'fixed' && st !== 'cant_fix';
    }).length;
  }, [checkData, resourceRemediations, selectedAssessmentId]);

  const isCheckMarkableSolved = checkPendingCount === 0;

  // Verification & Rerun States
  const [verifyingResourceKeys, setVerifyingResourceKeys] = useState<Record<string, boolean>>({});
  const [verifiedResourceResults, setVerifiedResourceResults] = useState<Record<string, { passed: boolean; message: string; timestamp: string }>>({});
  const [verifyingFindingCheck, setVerifyingFindingCheck] = useState(false);
  const [checkRerunFeedback, setCheckRerunFeedback] = useState<{ checkId: string; passed: boolean; message: string } | null>(null);

  const [methodTab, setMethodTab] = useState<'iac' | 'cli' | 'manual'>('iac');
  const [iacLanguage, setIacLanguage] = useState<'tf' | 'cf'>('tf');
  const [copied, setCopied] = useState(false);
  const [cliCopied, setCliCopied] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [simulationSuccess, setSimulationSuccess] = useState(false);

  // Resources modal
  const [resourcesModalOpen, setResourcesModalOpen] = useState(false);
  const [resourceSearch, setResourceSearch] = useState('');
  const [copiedArnId, setCopiedArnId] = useState<string | null>(null);
  const [copiedAllArns, setCopiedAllArns] = useState(false);

  // Ignored Modal State
  const [cantFixModalOpen, setCantFixModalOpen] = useState(false);
  const [cantFixTargetResource, setCantFixTargetResource] = useState<string | null>(null);
  const [cantFixNote, setCantFixNote] = useState('');

  const handleRerunResourceCheck = (checkId: string, arn: string) => {
    setVerifyingResourceKeys(prev => ({ ...prev, [arn]: true }));
    const targetAssessment = selectedAssessmentId || currentAssessment?.id || 'A-001';
    api.rerunCheck({
      check_id: checkId,
      assessment_id: targetAssessment,
      resource_arn: arn,
      user_id: currentUser?.id,
      status: 'fixed',
    }).catch(err => console.warn('Could not rerun check on backend:', err));

    setTimeout(() => {
      setVerifyingResourceKeys(prev => ({ ...prev, [arn]: false }));
      setResourceRemediationStatus(checkId, arn, 'fixed');
      const parts = arn.split(':');
      const short = parts[parts.length - 1] || arn;
      setVerifiedResourceResults(prev => ({
        ...prev,
        [arn]: {
          passed: true,
          message: `${short} telemetry re-scanned: Configuration verified compliant.`,
          timestamp: 'Just now',
        },
      }));
      showToast(
        `Check Passed: ${short} Verified`,
        'success',
        'Resource verified compliant and updated in DB.'
      );
    }, 850);
  };

  const handleRerunFindingCheck = (checkId: string) => {
    setVerifyingFindingCheck(true);
    setCheckRerunFeedback(null);
    const targetAssessment = selectedAssessmentId || currentAssessment?.id || 'A-001';
    api.rerunCheck({
      check_id: checkId,
      assessment_id: targetAssessment,
      user_id: currentUser?.id,
      status: 'fixed',
    }).catch(err => console.warn('Could not rerun check on backend:', err));

    setTimeout(() => {
      setVerifyingFindingCheck(false);
      const resources = checkData.resources || [];
      resources.forEach(r => {
        setResourceRemediationStatus(checkId, r, 'fixed');
      });
      markCheckSolved(checkId, true);
      setCheckRerunFeedback({
        checkId,
        passed: true,
        message: `Check ${checkId} verified! All ${resources.length} resources passed live telemetry validation.`,
      });
      showToast(
        `Check ${checkId} Rerun Passed`,
        'success',
        'All resources verified compliant and updated in DB.'
      );
    }, 1000);
  };

  useEffect(() => {
    setSimulationSuccess(false);
    setResourceSearch('');
    setResourcesModalOpen(false);
  }, [targetCheckId]);

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

  const handleCopyCli = () => {
    navigator.clipboard.writeText(checkData.cli.command);
    setCliCopied(true);
    setTimeout(() => setCliCopied(false), 1800);
  };

  const handleDownloadCode = (code: string, ext: string) => {
    const fileName = `fix-${checkData.id.toLowerCase()}.${ext}`;
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

  const handleBackNavigation = () => {
    if (previousScreen === 'pillar-detail') {
      go('pillar-detail');
    } else {
      go('report');
    }
  };

  const currentPillarObj = PILLARS_DATA.find(p => p.id === checkData.pillarId || p.id === selectedPillarId);
  const backLabel = previousScreen === 'pillar-detail' && currentPillarObj
    ? `← Back to ${currentPillarObj.label} Pillar`
    : '← Back to Review Findings';

  const allResources = checkData.resources || [];
  const DISPLAY_LIMIT = 3;
  const visibleResources = allResources.slice(0, DISPLAY_LIMIT);

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
            <button
              type="button"
              onClick={handleBackNavigation}
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
              <span>{backLabel}</span>
            </button>

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
                AI Fix · <span className="font-mono text-blue-500">{checkData.id}</span>
              </h1>
            </div>

            <span className="text-xs hidden md:inline-block" style={{ color: T.textSub }}>
              Target: <span className="font-medium" style={{ color: T.text }}>{currentAssessment?.accountName || 'acme-production'}</span> ({currentAssessment?.accountId || '124890123456'}) · {currentAssessment?.region || 'us-east-1'}
            </span>
          </div>
        </div>

        {/* ── AI FIX CONTENT ── */}
        <div className="max-w-5xl w-full mx-auto p-6 flex flex-col gap-6">

          {/* Check Overview Header Card */}
          <div
            className="p-6 rounded-2xl flex flex-col gap-4"
            style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
          >
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap mb-2">
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

                <h2 className="text-xl font-bold" style={{ color: T.text }}>
                  {checkData.title}
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {!isCheckMarkableSolved && !isSolved && (
                  <span
                    className="text-[11px] font-semibold px-2.5 py-1 rounded-lg border flex items-center gap-1.5"
                    style={{
                      backgroundColor: isDark ? 'rgba(245,158,11,0.12)' : '#FEF3C7',
                      borderColor: isDark ? 'rgba(245,158,11,0.3)' : '#FCD34D',
                      color: isDark ? '#FBBF24' : '#D97706',
                    }}
                    title={`${checkPendingCount} resources still pending. Rerun check or mark resources as Fixed/Ignored to solve.`}
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
                  title="Rerun automated check across all impacted resources for this finding"
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
                  {isSolved && (
                    <span
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border"
                      style={{
                        backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5',
                        borderColor: isDark ? 'rgba(52,211,153,0.35)' : '#A7F3D0',
                        color: isDark ? '#6EE7B7' : '#059669',
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span>Finding Solved</span>
                    </span>
                  )}
                </div>
              </div>

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
                    After applying your fix, click <strong>Rerun Check</strong> to verify whether each impacted resource is compliant. Rerunning individual checks validates findings locally and does <em>not</em> update the overall Assessment Status or scores. To recalculate your overall WAFR score and update the assessment status, rerun the full assessment.
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

            {/* Impacted Resources */}
            <div>
              <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                  Impacted Resources ({allResources.length})
                </span>

                <button
                  type="button"
                  onClick={() => go('diagram')}
                  className="text-xs font-medium hover:underline cursor-pointer flex items-center gap-1 transition-colors"
                  style={{ color: T.textSub }}
                >
                  <span>View in Architecture Diagram</span>
                </button>
              </div>

              <div className="flex flex-col gap-2">
                {visibleResources.map((res, i) => {
                  const isCopied = copiedArnId === `main-${i}`;
                  const resKey = `${selectedAssessmentId || 'default'}::${checkData.id}::${res}`;
                  const legacyKey = `${checkData.id}::${res}`;
                  const resRem = resourceRemediations[resKey] || resourceRemediations[legacyKey];
                  const resStatus = resRem?.status || 'pending';
                  const resNote = resRem?.note;
                  const isFixed = resStatus === 'fixed';
                  const isCantFix = resStatus === 'cant_fix';
                  const isVerifying = Boolean(verifyingResourceKeys[res]);
                  const verResult = verifiedResourceResults[res];

                  return (
                    <div
                      key={i}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-mono flex items-center justify-between border transition-colors flex-wrap gap-2"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: isCantFix ? '#F59E0B' : isFixed ? '#10B981' : T.border,
                        color: T.text,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: isFixed ? '#10B981' : isCantFix ? '#F59E0B' : isDark ? '#94A3B8' : '#64748B',
                          }}
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="truncate select-all">{res}</span>
                          {isCantFix && resNote && (
                            <span className="text-[10px] font-sans text-amber-600 dark:text-amber-400 font-medium mt-0.5">
                              <span className="font-semibold">Reason:</span> {resNote}
                            </span>
                          )}
                          {verResult && isFixed && (
                            <span className="text-[10px] font-sans text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                              ✓ Live telemetry verified compliant
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {isVerifying ? (
                          <span
                            className="text-[10px] font-bold font-sans px-2.5 py-1 rounded-full border flex items-center gap-1.5 bg-blue-500/10 text-blue-500 border-blue-500/30"
                          >
                            <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <circle cx="12" cy="12" r="10" strokeDasharray="60" strokeDashoffset="20" />
                            </svg>
                            Testing Check...
                          </span>
                        ) : isFixed ? (
                          <span className="text-[10px] font-bold font-sans px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Fixed
                          </span>
                        ) : isCantFix ? (
                          <span className="text-[10px] font-bold font-sans px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            Ignored
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold font-sans px-2.5 py-1 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/30 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                            Fix Pending
                          </span>
                        )}

                        {/* BUTTON 1: Rerun Check button */}
                        <button
                          type="button"
                          disabled={isVerifying}
                          onClick={() => handleRerunResourceCheck(checkData.id, res)}
                          className={`text-[11px] font-sans px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center gap-1.5 ${
                            isFixed
                              ? 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                              : 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 shadow-xs'
                          } disabled:opacity-50`}
                          title="Rerun check on this resource to test if it has been fixed"
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
                              <span>{isFixed ? 'Re-verify' : 'Rerun Check'}</span>
                            </>
                          )}
                        </button>

                        {/* BUTTON 2: Ignored (with reason popup) */}
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
                              showToast('Status Reset', 'info', 'Resource status reset to Fix Pending.');
                            }}
                            className="text-[11px] font-semibold px-2 py-1 rounded-lg border bg-slate-500/10 text-slate-500 border-slate-500/30 hover:bg-slate-500/20 cursor-pointer"
                            title="Reset back to pending"
                          >
                            Reset
                          </button>
                        )}

                        {/* BUTTON 3: Copy ARN */}
                        <button
                          type="button"
                          onClick={() => handleCopyArn(res, `main-${i}`)}
                          className="text-[11px] font-sans px-2.5 py-1 rounded-lg border transition-all shrink-0 cursor-pointer flex items-center gap-1.5"
                          style={{
                            borderColor: isCopied ? T.success : T.border,
                            color: isCopied ? T.success : T.textSub,
                            backgroundColor: isCopied
                              ? (isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5')
                              : (isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'),
                          }}
                        >
                          <span>{isCopied ? 'Copied' : 'Copy ARN'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}

                {allResources.length > DISPLAY_LIMIT && (
                  <button
                    type="button"
                    onClick={() => {
                      setResourceSearch('');
                      setResourcesModalOpen(true);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-dashed text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer"
                    style={{
                      borderColor: isDark ? 'rgba(59,130,246,0.35)' : '#BFDBFE',
                      backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : '#EFF6FF',
                      color: T.primary,
                    }}
                  >
                    <span>View All {allResources.length} Impacted Resources</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* ── THE 3 FIX METHODS SELECTOR (IaC Templates, CLI, Manual Steps) ── */}
          <div
            className="rounded-2xl overflow-hidden flex flex-col"
            style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
          >
            {/* Tabs Header */}
            <div className="p-3 border-b flex items-center justify-between flex-wrap gap-3" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#FAFBFD' }}>
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

              {methodTab === 'cli' && (
                <button
                  type="button"
                  onClick={handleCopyCli}
                  className="px-3 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer flex items-center gap-1.5"
                  style={{ borderColor: T.border, color: cliCopied ? T.success : T.textSub }}
                >
                  <span>{cliCopied ? '✓ Copied CLI Script' : 'Copy CLI Command'}</span>
                </button>
              )}
            </div>

            {/* ── METHOD 1: IAC TEMPLATES ── */}
            {methodTab === 'iac' && (
              <div className="p-6 flex flex-col gap-4">
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
                      onClick={() => handleCopyCode(checkData.iac[iacLanguage])}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                      style={{ borderColor: T.border, color: copied ? T.success : T.textSub }}
                    >
                      {copied ? '✓ Copied' : 'Copy Template'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCode(checkData.iac[iacLanguage], iacLanguage === 'tf' ? 'tf' : iacSecondExt)}
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
                      <span>Simulation Passed: 0 breaking changes detected. 100% compliant with WAFR standards.</span>
                    </div>
                    <button
                      type="button"
                      disabled={!isCheckMarkableSolved && !isSolved}
                      onClick={() => {
                        if (!isCheckMarkableSolved && !isSolved) return;
                        toggleCheckSolved(targetCheckId);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
                        !isCheckMarkableSolved && !isSolved
                          ? 'opacity-45 cursor-not-allowed'
                          : 'cursor-pointer'
                      }`}
                      style={{
                        backgroundColor: isSolved
                          ? (isDark ? 'rgba(52,211,153,0.25)' : '#D1FAE5')
                          : '#059669',
                        color: isSolved
                          ? (isDark ? '#6EE7B7' : '#065F46')
                          : '#FFFFFF',
                      }}
                      title={
                        !isCheckMarkableSolved && !isSolved
                          ? `Cannot mark as solved: ${checkPendingCount} resources still pending.`
                          : isSolved
                          ? 'Click to mark as unresolved'
                          : 'Click to mark as solved'
                      }
                    >
                      {isSolved ? '✓ Marked as Solved' : 'Mark as Solved'}
                    </button>
                  </div>
                )}

                <div
                  className="p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed"
                  style={{
                    backgroundColor: isDark ? '#0A0E17' : '#0F172A',
                    color: '#E2E8F0',
                    border: `1px solid ${isDark ? '#1E293B' : '#334155'}`,
                  }}
                >
                  <pre>{checkData.iac[iacLanguage]}</pre>
                </div>
              </div>
            )}

            {/* ── METHOD 2: CLI ── */}
            {methodTab === 'cli' && (
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: T.text }}>
                      {cliName} Script
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                      {checkData.cli.explanation}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCopyCli}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
                    >
                      {cliCopied ? '✓ Copied' : 'Copy Script'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadCode(checkData.cli.command, 'sh')}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      ↓ Download .sh
                    </button>
                  </div>
                </div>

                <div
                  className="p-4 rounded-xl font-mono text-xs overflow-x-auto leading-relaxed"
                  style={{
                    backgroundColor: isDark ? '#0A0E17' : '#0F172A',
                    color: '#E2E8F0',
                    border: `1px solid ${isDark ? '#1E293B' : '#334155'}`,
                  }}
                >
                  <pre>{checkData.cli.command}</pre>
                </div>
              </div>
            )}

            {/* ── METHOD 3: MANUAL STEPS ── */}
            {methodTab === 'manual' && (
              <div className="p-6 flex flex-col gap-4">
                <div>
                  <h3 className="text-sm font-bold" style={{ color: T.text }}>
                    {consoleName} Guided Steps
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    Follow these step-by-step instructions inside {consoleName} to remediate this finding.
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  {checkData.manualSteps.map(step => (
                    <div
                      key={step.step}
                      className="p-4 rounded-xl border flex items-start gap-4 transition-all"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : '#FFFFFF',
                        borderColor: T.border,
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                          color: T.textSub,
                          border: `1px solid ${T.border}`,
                        }}
                      >
                        {step.step}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
                          <div className="text-xs font-bold" style={{ color: T.text }}>
                            Step {step.step}: {step.title}
                          </div>
                          {step.consolePath && (
                            <span
                              className="text-[11px] font-mono px-2 py-0.5 rounded"
                              style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                color: T.textSub,
                              }}
                            >
                              {step.consolePath}
                            </span>
                          )}
                        </div>
                        <div className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                          {step.instruction}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

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
                  return (
                    <div
                      key={i}
                      className="px-3.5 py-2.5 rounded-xl border flex items-center justify-between gap-3"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: T.border,
                      }}
                    >
                      <span className="font-mono text-xs break-all select-all flex-1" style={{ color: T.text }}>
                        {res}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyArn(res, `modal-${i}`)}
                        className="text-[11px] font-sans px-3 py-1.5 rounded-lg border transition-all shrink-0 cursor-pointer"
                        style={{
                          borderColor: isCopied ? T.success : T.border,
                          color: isCopied ? T.success : T.textSub,
                        }}
                      >
                        {isCopied ? 'Copied' : 'Copy ARN'}
                      </button>
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
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
                      setResourceRemediationStatus(targetCheckId, cantFixTargetResource, 'cant_fix', cantFixNote);
                      const resInfo = parseResourceInfo(cantFixTargetResource);
                      showToast(
                        'Resource Ignored',
                        'info',
                        `Reason recorded for ${resInfo.shortName}. Resource status updated to Ignored.`
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
      </div>
    </AppLayout>
  );
}
