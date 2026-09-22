import React, { useState } from 'react';
import { useApp } from '../context';
import { QuestionnaireItem } from '../data/questionnaireData';
import { CloudifyOpsSymbol } from '../components/CloudLogo';

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderSubtle: '#F1F5F9',
  text: '#0F172A',
  textSub: '#64748B',
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  primaryBorder: '#BFDBFE',
  success: '#059669',
  successBg: '#ECFDF5',
  successBorder: '#A7F3D0',
  purple: '#7E22CE',
  purpleBg: '#FAF5FF',
  purpleBorder: '#E9D5FF',
  shadow: '0 1px 3px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,0.06), 0 2px 4px -2px rgba(0,0,0,0.04)',
};

const DARK = {
  bg: '#0B1220',
  card: '#111B2E',
  border: '#1E293B',
  borderSubtle: '#172238',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,0.12)',
  primaryBorder: 'rgba(59,130,246,0.3)',
  success: '#10B981',
  successBg: 'rgba(16,185,129,0.12)',
  successBorder: 'rgba(16,185,129,0.3)',
  purple: '#A855F7',
  purpleBg: 'rgba(168,85,247,0.12)',
  purpleBorder: 'rgba(168,85,247,0.3)',
  shadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,0.35), 0 2px 4px rgba(0,0,0,0.25)',
};

const CAT_STYLES: Record<string, { lightBg: string; lightText: string; darkBg: string; darkText: string }> = {
  'Security & Governance': {
    lightBg: '#EFF6FF',
    lightText: '#1D4ED8',
    darkBg: 'rgba(59,130,246,0.15)',
    darkText: '#93C5FD',
  },
  'Security & Auditing': {
    lightBg: '#FDF2F8',
    lightText: '#BE185D',
    darkBg: 'rgba(236,72,153,0.15)',
    darkText: '#F472B6',
  },
  'Cost Optimization': {
    lightBg: '#ECFDF5',
    lightText: '#047857',
    darkBg: 'rgba(16,185,129,0.15)',
    darkText: '#6EE7B7',
  },
  'Operational Excellence': {
    lightBg: '#FFFBEB',
    lightText: '#B45309',
    darkBg: 'rgba(245,158,11,0.15)',
    darkText: '#FCD34D',
  },
  'Compliance & Standards': {
    lightBg: '#FAF5FF',
    lightText: '#6D28D9',
    darkBg: 'rgba(139,92,246,0.15)',
    darkText: '#C4B5FD',
  },
};

export function OrgQuestions() {
  const {
    go,
    theme,
    toggleTheme,
    orgQuestions,
    setOrgQuestions,
    updateOrgQuestion,
    toggleOrgCheck,
    toggleAllOrgChecks,
  } = useApp();

  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [activeQuestionId, setActiveQuestionId] = useState<string | null>('ORG-01');
  const [selectedInfoQuestion, setSelectedInfoQuestion] = useState<QuestionnaireItem | null>(null);

  // Statistics
  const totalQuestions = orgQuestions.length;
  const answeredQuestions = orgQuestions.filter(q => q.ans && q.ans.trim().length > 0).length;
  const allChecks = orgQuestions.flatMap(q => q.manualChecks || []);
  const verifiedChecks = allChecks.filter(c => c.verified).length;
  const totalChecks = allChecks.length;
  const progressPct = totalQuestions > 0 ? Math.round((answeredQuestions / totalQuestions) * 100) : 0;

  const handlePreFillAll = () => {
    setOrgQuestions(prev =>
      prev.map(q => {
        let ans = q.ans;
        if (!ans || ans.trim().length === 0) {
          if (q.id === 'ORG-01') {
            ans = 'AWS Organizations with AWS Control Tower enforces foundational SCPs denying unauthorized regions, root user usage, and public S3 bucket creation across all member accounts.';
          } else if (q.id === 'ORG-02') {
            ans = 'Organization-wide CloudTrail logs and VPC Flow Logs are replicated to a dedicated secure Log Archive account with SIEM ingestion.';
          } else if (q.id === 'ORG-03') {
            ans = 'AWS Cost Categories and mandatory Cost Center tagging policies enforced via AWS Organizations with monthly budget threshold alerts sent to Slack.';
          } else if (q.id === 'ORG-04') {
            ans = 'P1 disaster recovery runbooks with cross-region replication SLAs (RPO < 15 min, RTO < 1 hour) and bi-weekly PagerDuty on-call drill reviews.';
          } else if (q.id === 'ORG-05') {
            ans = 'SOC 2 Type II and ISO 27001 compliance standards are enforced organization-wide using AWS Security Hub and AWS Config conformance packs across all member accounts.';
          }
        }
        return {
          ...q,
          ans,
          answered: true,
          manualChecks: q.manualChecks?.map(c => ({ ...c, verified: true })),
        };
      })
    );
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: T.bg, color: T.text }}>
      {/* ── TOP HEADER BAR ── */}
      <header
        className="h-14 flex items-center px-6 gap-4 shrink-0 z-30 sticky top-0 border-b"
        style={{
          backgroundColor: isDark ? '#0B1220' : '#FFFFFF',
          borderColor: T.border,
          boxShadow: T.shadow,
        }}
      >
        <button
          type="button"
          onClick={() => go('dashboard')}
          className="flex items-center gap-2 cursor-pointer transition-opacity hover:opacity-85"
        >
          <CloudifyOpsSymbol height={24} />
          <span className="font-semibold text-sm tracking-tight" style={{ color: T.text }}>
            CloudifyOps
          </span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full border hidden sm:inline-block"
            style={{
              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
              color: isDark ? '#93C5FD' : '#2563EB',
              borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
            }}
          >
            WAFR Lens
          </span>
        </button>

        <div className="h-4 w-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold" style={{ color: T.textSub }}>
            New Assessment
          </span>
          <span style={{ color: T.textSub }}>/</span>
          <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
            Organisation Questions
          </span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer border"
            style={{
              borderColor: T.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
              color: T.textSub,
            }}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          <button
            type="button"
            onClick={() => go('dashboard')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer"
            style={{
              borderColor: T.border,
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
              color: T.textSub,
            }}
          >
            <span>Exit to Dashboard</span>
          </button>
        </div>
      </header>

      {/* ── STEP-BY-STEP PROGRESS BAR (Simple & Perfect) ── */}
      <div
        className="px-6 py-3 border-b flex items-center justify-between flex-wrap gap-3"
        style={{
          backgroundColor: isDark ? '#111B2E' : '#F1F5F9',
          borderColor: T.border,
        }}
      >
        <div className="flex items-center gap-3 sm:gap-4 flex-wrap text-xs font-semibold">
          {/* Step 1: Active */}
          <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              1
            </span>
            <span className="font-bold">Organisation Questions</span>
          </div>

          <div className="w-8 h-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          {/* Step 2: Next */}
          <div className="flex items-center gap-2 opacity-60 text-slate-500 dark:text-slate-400">
            <span className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs">
              2
            </span>
            <span>Select Cloud Provider</span>
          </div>

          <div className="w-8 h-px bg-slate-300 dark:bg-slate-700 hidden sm:block" />

          {/* Step 3: Upcoming */}
          <div className="flex items-center gap-2 opacity-40 text-slate-400 dark:text-slate-500">
            <span className="w-6 h-6 rounded-full border border-slate-300 dark:border-slate-700 flex items-center justify-center font-bold text-xs">
              3
            </span>
            <span>Configure Assessment</span>
          </div>
        </div>

        {/* Completion Counter */}
        <div className="flex items-center gap-2">
          <div className="text-xs font-semibold" style={{ color: T.textSub }}>
            {answeredQuestions} of {totalQuestions} answered
          </div>
          <div className="w-24 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300 bg-blue-600"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT AREA ── */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 sm:p-8 flex flex-col gap-6">
        {/* Page Title & Context Header */}
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-2 border"
              style={{
                backgroundColor: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF',
                borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#BFDBFE',
                color: isDark ? '#93C5FD' : '#2563EB',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Organisation-Level Baseline & Governance</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{ color: T.text }}>
              Organisation-Specific Questions
            </h1>
            <p className="text-xs sm:text-sm mt-1.5 max-w-2xl leading-relaxed" style={{ color: T.textSub }}>
              These architectural baseline questions apply across all accounts in your organization. Answer them now before choosing your cloud provider to ensure standardized compliance guardrails.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePreFillAll}
              className="px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs hover:opacity-90"
              style={{
                backgroundColor: isDark ? 'rgba(52,211,153,0.12)' : '#ECFDF5',
                borderColor: isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0',
                color: isDark ? '#6EE7B7' : '#059669',
              }}
              title="Pre-fill sample verified answers for wireframe demonstration"
            >
              <span>Auto-Fill Verified Answers</span>
            </button>
          </div>
        </div>

        {/* Informational Guidance Alert */}
        <div
          className="p-4 rounded-2xl border flex items-start gap-3.5"
          style={{
            backgroundColor: isDark ? 'rgba(59,130,246,0.08)' : '#EFF6FF',
            borderColor: isDark ? 'rgba(59,130,246,0.25)' : '#DBEAFE',
          }}
        >
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
            style={{ backgroundColor: T.primary, color: '#FFFFFF' }}
          >
            i
          </div>
          <div className="text-xs leading-relaxed" style={{ color: T.text }}>
            <span className="font-bold block mb-0.5">Enterprise Baseline Verification</span>
            Each question includes technical manual checks and an <span className="font-serif italic font-bold text-blue-600 dark:text-blue-400">i</span> (Info) button with step-by-step verification guidance, WAFR framework references, and required audit evidence.
          </div>
        </div>

        {/* ── QUESTION CARDS LIST ── */}
        <div className="flex flex-col gap-4">
          {orgQuestions.map((q, idx) => {
            const isOpen = activeQuestionId === q.id;
            const isAnswered = q.ans && q.ans.trim().length > 0;
            const categoryStyle = CAT_STYLES[q.cat] || {
              lightBg: '#F1F5F9',
              lightText: '#475569',
              darkBg: 'rgba(255,255,255,0.05)',
              darkText: '#94A3B8',
            };

            const verifiedCount = q.manualChecks?.filter(c => c.verified).length || 0;
            const totalChecksCount = q.manualChecks?.length || 0;

            return (
              <div
                key={q.id}
                className="rounded-2xl border transition-all overflow-hidden"
                style={{
                  backgroundColor: T.card,
                  borderColor: isOpen ? T.primary : T.border,
                  boxShadow: isOpen ? T.shadowMd : T.shadow,
                }}
              >
                {/* Card Header Row */}
                <div
                  onClick={() => setActiveQuestionId(isOpen ? null : q.id)}
                  className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer hover:bg-slate-500/5 transition-colors"
                >
                  <div className="flex items-start gap-3.5 flex-1 min-w-0">
                    <span
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5"
                      style={{
                        backgroundColor: isAnswered ? (isDark ? 'rgba(52,211,153,0.2)' : '#D1FAE5') : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                        color: isAnswered ? (isDark ? '#6EE7B7' : '#059669') : T.textSub,
                      }}
                    >
                      {isAnswered ? '✓' : idx + 1}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {q.id}
                        </span>
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: isDark ? categoryStyle.darkBg : categoryStyle.lightBg,
                            color: isDark ? categoryStyle.darkText : categoryStyle.lightText,
                          }}
                        >
                          {q.cat}
                        </span>
                        {isAnswered && (
                          <span
                            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5',
                              color: isDark ? '#6EE7B7' : '#059669',
                            }}
                          >
                            Answered
                          </span>
                        )}
                        {totalChecksCount > 0 && (
                          <span
                            className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{
                              borderColor: verifiedCount === totalChecksCount ? (isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0') : T.border,
                              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                              color: verifiedCount === totalChecksCount ? (isDark ? '#6EE7B7' : '#059669') : T.textSub,
                            }}
                          >
                            {verifiedCount}/{totalChecksCount} checks verified
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm sm:text-base font-bold leading-snug" style={{ color: T.text }}>
                        {q.q}
                      </h3>
                      <p className="text-xs mt-1 leading-relaxed" style={{ color: T.textSub }}>
                        {q.desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Info Button with 'i' */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedInfoQuestion(q);
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer"
                      style={{
                        backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                        borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
                        color: isDark ? '#93C5FD' : '#2563EB',
                      }}
                      title="View WAFR framework verification guidance and audit evidence"
                    >
                      <span className="font-serif italic font-bold">i</span>
                      <span className="hidden sm:inline">Info</span>
                    </button>

                    <span
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-transform"
                      style={{
                        color: T.textSub,
                        transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      }}
                    >
                      ▼
                    </span>
                  </div>
                </div>

                {/* Expanded Card Details */}
                {isOpen && (
                  <div
                    className="p-5 border-t flex flex-col gap-4"
                    style={{
                      borderColor: T.border,
                      backgroundColor: isDark ? 'rgba(255,255,255,0.015)' : '#F8FAFC',
                    }}
                  >
                    {/* Manual Checks Checklist */}
                    {q.manualChecks && q.manualChecks.length > 0 && (
                      <div
                        className="p-4 rounded-xl border flex flex-col gap-3"
                        style={{
                          backgroundColor: isDark ? '#111B2E' : '#FFFFFF',
                          borderColor: T.border,
                        }}
                      >
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.textSub }}>
                              Manual Verification Checks
                            </span>
                            <span
                              className="text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold"
                              style={{
                                backgroundColor: verifiedCount === totalChecksCount ? (isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                                color: verifiedCount === totalChecksCount ? (isDark ? '#6EE7B7' : '#059669') : T.textSub,
                              }}
                            >
                              {verifiedCount}/{totalChecksCount} Verified
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={() => toggleAllOrgChecks(q.id, true)}
                              className="text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-semibold"
                            >
                              Check all
                            </button>
                            <span style={{ color: T.textSub }}>·</span>
                            <button
                              type="button"
                              onClick={() => toggleAllOrgChecks(q.id, false)}
                              className="text-slate-400 hover:underline cursor-pointer"
                            >
                              Uncheck all
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {q.manualChecks.map(chk => (
                            <div
                              key={chk.id}
                              onClick={() => toggleOrgCheck(q.id, chk.id)}
                              className="flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer"
                              style={{
                                borderColor: chk.verified ? (isDark ? 'rgba(52,211,153,0.35)' : '#A7F3D0') : T.border,
                                backgroundColor: chk.verified ? (isDark ? 'rgba(52,211,153,0.08)' : '#F0FDF4') : (isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF'),
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={chk.verified}
                                onChange={() => toggleOrgCheck(q.id, chk.id)}
                                className="mt-0.5 rounded text-emerald-600 h-4 w-4 border-gray-300 cursor-pointer"
                              />
                              <div className="flex-1 min-w-0">
                                <div
                                  className={`text-xs ${chk.verified ? 'font-semibold text-emerald-700 dark:text-emerald-300' : 'font-medium'}`}
                                  style={{ color: chk.verified ? undefined : T.text }}
                                >
                                  {chk.label}
                                </div>
                                {chk.guidance && (
                                  <div
                                    className="text-[11px] mt-1 font-mono px-2 py-0.5 rounded border inline-flex items-center gap-1.5"
                                    style={{
                                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                                      borderColor: T.border,
                                      color: T.textSub,
                                    }}
                                  >
                                    <span className="font-bold text-blue-600 dark:text-blue-400">Hint:</span>
                                    <span>{chk.guidance}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Architecture Response Textarea */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-xs font-bold" style={{ color: T.text }}>
                          Organisation Architectural Implementation & Governance Practice
                        </label>
                        <span className="text-[11px]" style={{ color: T.textSub }}>
                          Saved automatically
                        </span>
                      </div>
                      <textarea
                        value={q.ans || ''}
                        onChange={(e) => updateOrgQuestion(q.id, e.target.value)}
                        rows={3}
                        placeholder="Describe your organization's policy enforcement, central services, and governance models…"
                        className="w-full text-xs sm:text-sm rounded-xl px-3.5 py-2.5 resize-none outline-none border transition-all"
                        style={{
                          backgroundColor: isDark ? '#0B1220' : '#FFFFFF',
                          borderColor: T.border,
                          color: T.text,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── BOTTOM ACTION BAR ── */}
        <div
          className="p-5 rounded-2xl border flex items-center justify-between flex-wrap gap-4 mt-2"
          style={{
            backgroundColor: T.card,
            borderColor: T.border,
            boxShadow: T.shadow,
          }}
        >
          <div>
            <div className="text-sm font-bold" style={{ color: T.text }}>
              Ready to select your cloud provider?
            </div>
            <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
              {answeredQuestions} of {totalQuestions} organisation baseline questions completed · Answers carry forward into the assessment.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => go('dashboard')}
              className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
              style={{
                borderColor: T.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                color: T.textSub,
              }}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => go('select-cloud')}
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs sm:text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
              style={{
                background: 'linear-gradient(135deg, #2563EB, #10B981)',
              }}
            >
              <span>Next: Select Cloud Provider</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* ── QUESTION INFO MODAL ('i' Button Guidance Popup) ── */}
      {selectedInfoQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-xl rounded-2xl shadow-2xl border overflow-hidden flex flex-col max-h-[85vh]"
            style={{
              backgroundColor: isDark ? '#111B2E' : '#FFFFFF',
              borderColor: T.border,
            }}
          >
            {/* Modal Header */}
            <div
              className="px-5 py-4 border-b flex items-start justify-between"
              style={{
                borderColor: T.border,
                background: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
              }}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-serif italic font-bold text-base shrink-0 shadow-xs mt-0.5"
                >
                  i
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                      {selectedInfoQuestion.id}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                      {selectedInfoQuestion.cat}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Organisation Scope
                    </span>
                  </div>
                  <h3 className="text-sm font-bold leading-snug" style={{ color: T.text }}>
                    {selectedInfoQuestion.q}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfoQuestion(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors cursor-pointer shrink-0 ml-2"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              {/* Framework Reference */}
              {selectedInfoQuestion.info?.frameworkRef && (
                <div
                  className="p-3 rounded-xl border flex items-center justify-between"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                    borderColor: T.border,
                  }}
                >
                  <div>
                    <span className="font-semibold block mb-0.5" style={{ color: T.textSub }}>
                      WAFR Framework Reference
                    </span>
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                      {selectedInfoQuestion.info.frameworkRef}
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5',
                      color: isDark ? '#6EE7B7' : '#059669',
                    }}
                  >
                    Enterprise Standard
                  </span>
                </div>
              )}

              {/* Why It Matters */}
              {selectedInfoQuestion.info?.whyItMatters && (
                <div>
                  <h4 className="font-bold mb-1" style={{ color: T.text }}>
                    Why It Matters
                  </h4>
                  <p className="leading-relaxed" style={{ color: T.textSub }}>
                    {selectedInfoQuestion.info.whyItMatters}
                  </p>
                </div>
              )}

              {/* How To Verify Checklist */}
              {selectedInfoQuestion.info?.howToVerify && selectedInfoQuestion.info.howToVerify.length > 0 && (
                <div>
                  <h4 className="font-bold mb-1.5" style={{ color: T.text }}>
                    How to Verify in Cloud Consoles
                  </h4>
                  <div className="space-y-1.5">
                    {selectedInfoQuestion.info.howToVerify.map((step, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2 rounded-lg"
                        style={{
                          backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                        }}
                      >
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300 font-bold flex items-center justify-center shrink-0 text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="leading-relaxed" style={{ color: T.text }}>
                          {step}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Audit Evidence */}
              {selectedInfoQuestion.info?.auditEvidence && (
                <div
                  className="p-3 rounded-xl border"
                  style={{
                    backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : '#F0FDF4',
                    borderColor: isDark ? 'rgba(16,185,129,0.25)' : '#BBF7D0',
                  }}
                >
                  <span className="font-bold block mb-1 text-emerald-800 dark:text-emerald-300">
                    Recommended Audit Evidence
                  </span>
                  <p className="text-emerald-900 dark:text-emerald-200 leading-relaxed font-mono text-[11px]">
                    {selectedInfoQuestion.info.auditEvidence}
                  </p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="px-5 py-3 border-t flex justify-end"
              style={{
                borderColor: T.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
              }}
            >
              <button
                type="button"
                onClick={() => setSelectedInfoQuestion(null)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
                style={{ backgroundColor: T.primary }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
