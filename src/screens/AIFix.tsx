import { useState, useEffect } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { SeverityPill } from '../components/FindingUI';
import { PILLARS_DATA } from '../data/wafrData';
import { REMEDIATION_DATABASE } from './AIRemediation';

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
  const { go, theme, remediationFindingId, previousScreen, selectedPillarId, currentAssessment, solvedCheckIds, toggleCheckSolved } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const targetCheckId = remediationFindingId && REMEDIATION_DATABASE[remediationFindingId]
    ? remediationFindingId
    : 'REL-019';

  const checkData = REMEDIATION_DATABASE[targetCheckId] || REMEDIATION_DATABASE['REL-019'];
  const isSolved = Boolean(solvedCheckIds[targetCheckId]);

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

              <button
                type="button"
                onClick={() => toggleCheckSolved(targetCheckId)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-sm shrink-0"
                style={{
                  backgroundColor: isSolved
                    ? (isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5')
                    : (isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF'),
                  borderColor: isSolved
                    ? (isDark ? 'rgba(52,211,153,0.35)' : '#A7F3D0')
                    : T.border,
                  color: isSolved
                    ? (isDark ? '#6EE7B7' : '#059669')
                    : T.text,
                }}
                title={isSolved ? 'Click to mark as unresolved' : 'Click to mark as solved'}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{isSolved ? 'Marked as Solved' : 'Mark as Solved'}</span>
              </button>
            </div>

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
                  return (
                    <div
                      key={i}
                      className="px-3.5 py-2.5 rounded-xl text-xs font-mono flex items-center justify-between border transition-colors"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                        borderColor: T.border,
                        color: T.text,
                      }}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: isDark ? '#94A3B8' : '#64748B' }}
                        />
                        <span className="truncate select-all">{res}</span>
                      </div>
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
                      CloudFormation (.yml)
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
                      onClick={() => handleDownloadCode(checkData.iac[iacLanguage], iacLanguage === 'tf' ? 'tf' : 'yml')}
                      className="px-3.5 py-1.5 text-xs font-semibold rounded-xl border transition-colors cursor-pointer"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      ↓ Download {iacLanguage === 'tf' ? '.tf' : '.yml'}
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
                      onClick={() => toggleCheckSolved(targetCheckId)}
                      className="px-3 py-1 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
                      style={{
                        backgroundColor: isSolved
                          ? (isDark ? 'rgba(52,211,153,0.25)' : '#D1FAE5')
                          : '#059669',
                        color: isSolved
                          ? (isDark ? '#6EE7B7' : '#065F46')
                          : '#FFFFFF',
                      }}
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
                      Command Line Interface (CLI Script)
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
                    Cloud Management Console Guided Steps
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    Follow these step-by-step instructions inside the management console to remediate this finding.
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
      </div>
    </AppLayout>
  );
}
