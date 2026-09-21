import { useState, useEffect } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { AssessmentMilestone } from '../data/assessmentData';

export const MILESTONE_PILLARS = [
  {
    key: 'security',
    label: 'Security',
  },
  {
    key: 'reliability',
    label: 'Reliability',
  },
  {
    key: 'performance',
    label: 'Performance Efficiency',
  },
  {
    key: 'cost',
    label: 'Cost Optimization',
  },
  {
    key: 'operations',
    label: 'Operational Excellence',
  },
] as const;

export function getPillarHighRisks(m: AssessmentMilestone, key: string): number {
  if (m.pillarHighRisks && typeof m.pillarHighRisks[key as keyof typeof m.pillarHighRisks] === 'number') {
    return m.pillarHighRisks[key as keyof typeof m.pillarHighRisks];
  }
  const score = m.pillarScores?.[key as keyof typeof m.pillarScores] ?? 80;
  if (score < 60) return 3;
  if (score < 75) return 2;
  if (score < 85) return 1;
  return 0;
}

function MilestonePillarRow({
  p,
  pScore,
  pHighRisks,
  T,
  isDark,
}: {
  p: typeof MILESTONE_PILLARS[number];
  pScore: number;
  pHighRisks: number;
  T: Tokens;
  isDark: boolean;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1000;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(easeOut * pScore));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [pScore]);

  return (
    <div
      className="p-3 rounded-xl border flex items-center justify-between gap-4 transition-colors"
      style={{
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF',
        borderColor: T.border,
      }}
    >
      {/* Left: Pillar Title & Score */}
      <div>
        <div className="text-xs font-semibold" style={{ color: T.text }}>
          {p.label}
        </div>
        <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
          Score: <span className="font-medium tabular-nums" style={{ color: T.text }}>{animatedScore}%</span>
        </div>
      </div>

      {/* Right: High Risk Badge (Red for high risk, Green for 0 risk) */}
      <div className="shrink-0 text-right">
        {pHighRisks > 0 ? (
          <span
            className="px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1.5"
            style={{
              backgroundColor: isDark ? 'rgba(239,68,68,0.12)' : '#FEF2F2',
              color: isDark ? '#F87171' : '#DC2626',
              border: `1px solid ${isDark ? 'rgba(239,68,68,0.3)' : '#FECACA'}`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{pHighRisks} High Risk{pHighRisks > 1 ? 's' : ''}</span>
          </span>
        ) : (
          <span
            className="px-2.5 py-1 rounded-lg text-xs font-medium inline-flex items-center gap-1.5"
            style={{
              backgroundColor: isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5',
              color: T.success,
              border: `1px solid ${isDark ? 'rgba(82,183,136,0.25)' : '#A7F3D0'}`,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>0 High Risks</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function Milestones() {
  const {
    currentAssessment,
    currentMilestones,
    addMilestone,
    deleteMilestone,
    go,
    theme,
  } = useApp();

  const isDark = theme === 'dark';
  const T: Tokens = isDark ? DARK : LIGHT;

  // Safe fallback for currentAssessment
  const assessment = currentAssessment || {
    id: 'A-001',
    name: 'Production — us-east-1 Full Review',
    accountName: 'acme-production',
    accountId: '124890123456',
    region: 'us-east-1',
    cloud: 'aws' as const,
    status: 'complete' as const,
    score: 84,
    lastRun: '2h ago',
    checks: 45,
    pillars: {
      reliability: 88,
      security: 79,
      cost: 91,
      operations: 82,
      performance: 80,
    },
  };

  const milestoneList: AssessmentMilestone[] = Array.isArray(currentMilestones) ? currentMilestones : [];

  // Modal states
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<AssessmentMilestone | null>(null);

  // Form states for new milestone
  const nextNum = milestoneList.length + 1;
  const [milestoneName, setMilestoneName] = useState(`Milestone ${nextNum} - Review Checkpoint`);
  const [version, setVersion] = useState(`v1.${nextNum}`);
  const [notes, setNotes] = useState('');
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const handleOpenSaveModal = () => {
    const num = milestoneList.length + 1;
    setMilestoneName(`Milestone ${num} - Architecture Review`);
    setVersion(`v1.${num}`);
    setNotes('');
    setSaveModalOpen(true);
  };

  const handleSaveMilestone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!milestoneName.trim()) return;

    const livePillarHighRisks = {
      reliability: 1,
      security: 3,
      cost: 0,
      operations: 0,
      performance: 1,
    };

    const saved = addMilestone({
      milestoneName: milestoneName.trim(),
      version: version.trim() || `v1.${nextNum}`,
      notes: notes.trim(),
      score: assessment.score ?? 84,
      highRisks: 5,
      mediumRisks: 5,
      lowRisks: 2,
      pillarScores: assessment.pillars ?? {
        reliability: 88,
        security: 79,
        cost: 91,
        operations: 82,
        performance: 80,
      },
      pillarHighRisks: livePillarHighRisks,
    });

    setSaveModalOpen(false);
    setSuccessToast(`Milestone "${saved.milestoneName}" saved successfully.`);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  const handleOpenSnapshot = (m: AssessmentMilestone) => {
    setSelectedSnapshot(m);
  };

  const handleDeleteMilestone = (m: AssessmentMilestone) => {
    deleteMilestone(m.id);
    if (selectedSnapshot?.id === m.id) {
      setSelectedSnapshot(null);
    }
    setSuccessToast(`Milestone "${m.milestoneName}" deleted.`);
    setTimeout(() => setSuccessToast(null), 3000);
  };

  const currentScore = assessment.score ?? 84;

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen" style={{ backgroundColor: T.bg }}>
        {/* Clean Header */}
        <div className="px-6 py-4 border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
          {/* Breadcrumb & Navigation */}
          <div className="flex items-center justify-between gap-4 mb-2">
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button
                type="button"
                onClick={() => go('dashboard')}
                className="hover:underline transition-colors cursor-pointer"
                style={{ color: T.primary }}
              >
                Home
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => go('assessment-list')}
                className="hover:underline transition-colors cursor-pointer"
                style={{ color: T.textSub }}
              >
                Assessments
              </button>
              <span>/</span>
              <button
                type="button"
                onClick={() => go('report')}
                className="hover:underline transition-colors cursor-pointer"
                style={{ color: T.primary }}
              >
                {assessment.name}
              </button>
              <span>/</span>
              <span className="font-semibold" style={{ color: T.text }}>
                Milestones
              </span>
            </nav>
          </div>

          {/* Title & Primary Action */}
          <div className="flex items-center justify-between flex-wrap gap-4 pt-1">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold" style={{ color: T.text }}>
                  Milestones
                </h1>
                <span
                  className="text-xs font-mono px-2.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  {assessment.id}
                </span>
                <span
                  className="text-xs font-semibold px-2.5 py-0.5 rounded-md"
                  style={{
                    backgroundColor: isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5',
                    color: T.success,
                    border: `1px solid ${isDark ? 'rgba(82,183,136,0.3)' : '#A7F3D0'}`,
                  }}
                >
                  Live Score: {currentScore}%
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: T.textSub }}>
                Point-in-time compliance snapshots and historical versions for <span className="font-medium" style={{ color: T.text }}>{assessment.name}</span>
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenSaveModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
              style={{ background: 'linear-gradient(135deg, #1B6FC9, #14A085)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Save Milestone</span>
            </button>
          </div>
        </div>

        {/* Success Toast */}
        {successToast && (
          <div
            className="mx-6 mt-4 p-3 rounded-lg border flex items-center justify-between shadow-sm text-xs font-semibold"
            style={{
              backgroundColor: isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5',
              borderColor: T.success,
              color: T.success,
            }}
          >
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span>{successToast}</span>
            </div>
            <button
              type="button"
              onClick={() => setSuccessToast(null)}
              className="text-xs font-bold cursor-pointer opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Simple Table / Content */}
        <div className="p-6">
          {milestoneList.length === 0 ? (
            <div
              className="p-12 text-center rounded-xl border flex flex-col items-center justify-center gap-3"
              style={{ backgroundColor: T.card, borderColor: T.border }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xs"
                style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', color: T.textSub }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                  <line x1="4" y1="22" x2="4" y2="15" />
                </svg>
              </div>
              <div className="font-semibold text-sm" style={{ color: T.text }}>
                No Milestones Saved
              </div>
              <p className="text-xs max-w-sm" style={{ color: T.textSub }}>
                Save a milestone to record a point-in-time compliance checkpoint for this assessment.
              </p>
              <button
                type="button"
                onClick={handleOpenSaveModal}
                className="mt-2 px-4 py-2 rounded-lg text-xs font-semibold text-white cursor-pointer shadow-sm"
                style={{ backgroundColor: T.primary }}
              >
                Save Milestone
              </button>
            </div>
          ) : (
            <div
              className="rounded-xl border overflow-hidden"
              style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
            >
              {/* Clean Table Header */}
              <div
                className="grid grid-cols-12 gap-4 px-5 py-3 border-b text-xs font-semibold uppercase tracking-wider"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  borderColor: T.border,
                  color: T.textSub,
                }}
              >
                <div className="col-span-4">Milestone</div>
                <div className="col-span-3">Recorded</div>
                <div className="col-span-2 text-center">Score</div>
                <div className="col-span-1 text-center">High Risks</div>
                <div className="col-span-2 text-right">Actions</div>
              </div>

              {/* Table Rows */}
              <div className="divide-y" style={{ borderColor: T.border }}>
                {milestoneList.map((m, idx) => {
                  const isLatest = idx === 0;
                  const scoreColor =
                    m.score >= 80 ? T.success : m.score >= 65 ? T.warning : T.error;

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleOpenSnapshot(m)}
                      className="grid grid-cols-12 gap-4 px-5 py-4 items-center transition-colors cursor-pointer group"
                      style={{
                        backgroundColor: isLatest
                          ? (isDark ? 'rgba(59,130,246,0.04)' : 'rgba(239,246,255,0.5)')
                          : 'transparent',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = isDark
                          ? 'rgba(255,255,255,0.03)'
                          : '#F8FAFC';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = isLatest
                          ? (isDark ? 'rgba(59,130,246,0.04)' : 'rgba(239,246,255,0.5)')
                          : 'transparent';
                      }}
                    >
                      {/* Milestone Name & Version */}
                      <div className="col-span-4 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-mono font-bold px-2 py-0.5 rounded"
                            style={{
                              backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                              color: T.primary,
                              border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#DBEAFE'}`,
                            }}
                          >
                            {m.version}
                          </span>
                          <span className="text-sm font-semibold truncate group-hover:text-blue-500 transition-colors" style={{ color: T.text }}>
                            {m.milestoneName}
                          </span>
                          {isLatest && (
                            <span
                              className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5',
                                color: T.success,
                                border: `1px solid ${isDark ? 'rgba(82,183,136,0.3)' : '#A7F3D0'}`,
                              }}
                            >
                              Latest
                            </span>
                          )}
                        </div>
                        {m.notes && (
                          <div className="text-xs mt-1 truncate" style={{ color: T.textSub }}>
                            {m.notes}
                          </div>
                        )}
                      </div>

                      {/* Recorded Date */}
                      <div className="col-span-3 text-xs" style={{ color: T.textSub }}>
                        <div className="font-medium" style={{ color: T.text }}>
                          {m.recordedAt}
                        </div>
                      </div>

                      {/* Compliance Score */}
                      <div className="col-span-2 text-center">
                        <span
                          className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold"
                          style={{
                            color: scoreColor,
                            backgroundColor:
                              m.score >= 80
                                ? (isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5')
                                : m.score >= 65
                                ? (isDark ? 'rgba(251,191,36,0.15)' : '#FFFBEB')
                                : (isDark ? 'rgba(251,113,133,0.15)' : '#FFF1F2'),
                          }}
                        >
                          {m.score}%
                        </span>
                      </div>

                      {/* High Risks */}
                      <div className="col-span-1 text-center">
                        <span
                          className="inline-flex items-center justify-center text-xs font-semibold px-2.5 py-0.5 rounded-full"
                          style={{
                            color: m.highRisks > 0 ? (isDark ? '#FB7185' : '#E11D48') : T.success,
                            backgroundColor:
                              m.highRisks > 0
                                ? (isDark ? 'rgba(251,113,133,0.12)' : '#FFF1F2')
                                : (isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5'),
                            border: `1px solid ${
                              m.highRisks > 0
                                ? (isDark ? 'rgba(251,113,133,0.3)' : '#FECDD3')
                                : (isDark ? 'rgba(82,183,136,0.25)' : '#A7F3D0')
                            }`,
                          }}
                        >
                          {m.highRisks}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenSnapshot(m);
                          }}
                          className="px-2.5 py-1 text-xs font-medium rounded-lg border transition-colors cursor-pointer"
                          style={{ borderColor: T.border, color: T.textSub }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = T.primary;
                            e.currentTarget.style.borderColor = T.primary;
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = T.textSub;
                            e.currentTarget.style.borderColor = T.border;
                          }}
                        >
                          View
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMilestone(m);
                          }}
                          title="Delete Milestone"
                          aria-label="Delete Milestone"
                          className="p-1.5 text-xs rounded-lg border transition-all cursor-pointer flex items-center justify-center"
                          style={{ borderColor: T.border, color: T.textSub }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#EF4444';
                            e.currentTarget.style.borderColor = isDark ? 'rgba(239,68,68,0.4)' : '#FCA5A5';
                            e.currentTarget.style.backgroundColor = isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = T.textSub;
                            e.currentTarget.style.borderColor = T.border;
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <svg
                            width="13"
                            height="13"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── SAVE MILESTONE MODAL ──────────────────────────────────────────────── */}
      {saveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-md rounded-2xl border shadow-2xl p-5 flex flex-col gap-4 animate-scale-up"
            style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: T.border }}>
              <div>
                <h3 className="text-sm font-bold" style={{ color: T.text }}>
                  Save Assessment Milestone
                </h3>
                <p className="text-xs" style={{ color: T.textSub }}>
                  Record current checkpoint for {assessment.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaveModalOpen(false)}
                className="w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold cursor-pointer border transition-colors"
                style={{ borderColor: T.border, color: T.textSub }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveMilestone} className="flex flex-col gap-3.5">
              {/* Snapshot preview box */}
              <div
                className="p-3.5 rounded-xl border flex flex-col gap-2"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold text-xs" style={{ color: T.text }}>Current Assessment Snapshot</div>
                    <div className="text-[11px]" style={{ color: T.textSub }}>
                      Live compliance checkpoint & pillar risks
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-bold" style={{ color: T.success }}>{currentScore}%</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: T.border }}>
                  <div className="text-[11px]" style={{ color: T.textSub }}>
                    Total High Risks: <span className="font-bold text-red-500">5 High Risks</span>
                  </div>
                  <div className="text-[11px] text-right" style={{ color: T.textSub }}>
                    Pillars: <span className="font-semibold" style={{ color: T.text }}>5 Evaluated</span>
                  </div>
                </div>
              </div>

              {/* Milestone Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: T.text }}>
                  Milestone Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={milestoneName}
                  onChange={e => setMilestoneName(e.target.value)}
                  placeholder="e.g. Pre-Production Audit Baseline"
                  className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none transition-colors border"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    borderColor: T.border,
                    color: T.text,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                />
              </div>

              {/* Version Tag */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: T.text }}>
                  Version Tag
                </label>
                <input
                  type="text"
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="e.g. v1.2"
                  className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none transition-colors border"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    borderColor: T.border,
                    color: T.text,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                />
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold" style={{ color: T.text }}>
                  Milestone Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Optional notes or context for this milestone…"
                  className="w-full px-3 py-2 rounded-xl text-xs focus:outline-none transition-colors border resize-none"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                    borderColor: T.border,
                    color: T.text,
                  }}
                  onFocus={e => { e.currentTarget.style.borderColor = T.primary; }}
                  onBlur={e => { e.currentTarget.style.borderColor = T.border; }}
                />
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                <button
                  type="button"
                  onClick={() => setSaveModalOpen(false)}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl border transition-colors cursor-pointer"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-xl text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm bg-blue-600 hover:bg-blue-700"
                >
                  Save Milestone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── VIEW SNAPSHOT DETAILS MODAL (WITH PILLAR-LEVEL HIGH RISKS) ────────── */}
      {selectedSnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 flex flex-col gap-5 animate-scale-up"
            style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b pb-4 shrink-0" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-3">
                <span
                  className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg"
                  style={{
                    backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF',
                    color: T.primary,
                    border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#DBEAFE'}`,
                  }}
                >
                  {selectedSnapshot.version}
                </span>
                <div>
                  <h3 className="text-base font-bold" style={{ color: T.text }}>
                    {selectedSnapshot.milestoneName}
                  </h3>
                  <p className="text-xs" style={{ color: T.textSub }}>
                    Checkpoint recorded on <span className="font-medium" style={{ color: T.text }}>{selectedSnapshot.recordedAt}</span>
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold border transition-colors cursor-pointer"
                style={{ borderColor: T.border, color: T.textSub }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = T.text;
                  e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
                aria-label="Close"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Overall Score & Stats Grid */}
            <div className="grid grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl border flex flex-col items-center justify-center text-center" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <div className="text-[11px] font-medium" style={{ color: T.textSub }}>Overall Score</div>
                <div className="text-xl font-bold mt-1" style={{ color: selectedSnapshot.score >= 80 ? T.success : selectedSnapshot.score >= 65 ? T.warning : T.error }}>
                  {selectedSnapshot.score}%
                </div>
              </div>

              <div
                className="p-3 rounded-xl border flex flex-col items-center justify-center text-center"
                style={{
                  borderColor: selectedSnapshot.highRisks > 0 ? (isDark ? 'rgba(239,68,68,0.3)' : '#FECACA') : (isDark ? 'rgba(82,183,136,0.3)' : '#A7F3D0'),
                  backgroundColor: selectedSnapshot.highRisks > 0 ? (isDark ? 'rgba(239,68,68,0.08)' : '#FEF2F2') : (isDark ? 'rgba(82,183,136,0.08)' : '#ECFDF5'),
                }}
              >
                <div
                  className="text-[11px] font-semibold"
                  style={{
                    color: selectedSnapshot.highRisks > 0 ? (isDark ? '#F87171' : '#DC2626') : T.success,
                  }}
                >
                  Total High Risks
                </div>
                <div
                  className="text-xl font-bold mt-1"
                  style={{
                    color: selectedSnapshot.highRisks > 0 ? (isDark ? '#F87171' : '#DC2626') : T.success,
                  }}
                >
                  {selectedSnapshot.highRisks}
                </div>
              </div>

              <div className="p-3 rounded-xl border flex flex-col items-center justify-center text-center" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <div className="text-[11px] font-medium" style={{ color: T.textSub }}>Best Practices</div>
                <div className="text-sm font-bold mt-1.5" style={{ color: T.text }}>
                  {selectedSnapshot.passedBps}/{selectedSnapshot.totalBestPractices}
                </div>
              </div>

              <div className="p-3 rounded-xl border flex flex-col items-center justify-center text-center" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <div className="text-[11px] font-medium" style={{ color: T.textSub }}>Passed Checks</div>
                <div className="text-sm font-bold mt-1.5" style={{ color: T.text }}>
                  {selectedSnapshot.passedChecks}/{selectedSnapshot.totalChecks}
                </div>
              </div>
            </div>

            {/* ── PILLAR-LEVEL HIGH RISKS BREAKDOWN ─────────────────────────── */}
            <div
              className="p-4 rounded-xl border flex flex-col gap-3"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FAFBFD',
                borderColor: T.border,
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider" style={{ color: T.text }}>
                    Pillar-Level High Risks & Compliance Breakdown
                  </h4>
                  <p className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
                    High risk findings and compliance status evaluated per Well-Architected pillar
                  </p>
                </div>
                <span
                  className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
                    color: T.textSub,
                    border: `1px solid ${T.border}`,
                  }}
                >
                  5 Pillars Evaluated
                </span>
              </div>

              <div className="flex flex-col gap-2 mt-1">
                {MILESTONE_PILLARS.map(p => {
                  const pScore = selectedSnapshot.pillarScores?.[p.key as keyof typeof selectedSnapshot.pillarScores] ?? 80;
                  const pHighRisks = getPillarHighRisks(selectedSnapshot, p.key);

                  return (
                    <MilestonePillarRow
                      key={p.key}
                      p={p}
                      pScore={pScore}
                      pHighRisks={pHighRisks}
                      T={T}
                      isDark={isDark}
                    />
                  );
                })}
              </div>
            </div>

            {/* Notes Section */}
            {selectedSnapshot.notes && (
              <div className="p-3.5 rounded-xl border text-xs" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <div className="font-semibold mb-1" style={{ color: T.text }}>Milestone Notes:</div>
                <p className="leading-relaxed" style={{ color: T.textSub }}>{selectedSnapshot.notes}</p>
              </div>
            )}

            {/* Workload info */}
            <div className="flex items-center justify-between text-xs px-1" style={{ color: T.textSub }}>
              <div>Workload ID: <span className="font-mono font-medium" style={{ color: T.text }}>{selectedSnapshot.assessmentId}</span></div>
              <div>Snapshot ID: <span className="font-mono font-medium" style={{ color: T.text }}>{selectedSnapshot.id}</span></div>
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between pt-3 border-t shrink-0" style={{ borderColor: T.border }}>
              <button
                type="button"
                onClick={() => handleDeleteMilestone(selectedSnapshot)}
                className="px-3.5 py-2 text-xs font-semibold rounded-xl text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
                <span>Delete Milestone</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedSnapshot(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors cursor-pointer shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
