import { useState, useEffect } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { StatusPill } from '../components/StatusPill';
import { SeverityPill } from '../components/FindingUI';
import { PILLARS_DATA, PillarData } from '../data/wafrData';
import { ArchitectureDiagramModal } from '../components/ArchitectureDiagramModal';

/* ── Info Tooltip Component ──────────────────────────────────────────────── */

function InfoTooltip({
  title,
  content,
  isDark,
  T,
}: {
  title: string;
  content: string;
  isDark: boolean;
  T: Tokens;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={e => {
          e.stopPropagation();
          setOpen(!open);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors cursor-pointer"
        style={{
          borderColor: isDark ? 'rgba(255,255,255,0.2)' : '#CBD5E1',
          color: isDark ? '#94A3B8' : '#64748B',
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9',
        }}
        title="More information"
        aria-label="Info"
      >
        i
      </button>

      {open && (
        <div
          className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-3 rounded-xl shadow-xl text-left pointer-events-none"
          style={{
            backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
            border: `1px solid ${isDark ? '#334155' : '#E2E8F0'}`,
            color: T.text,
            boxShadow: '0 10px 25px -5px rgba(0,0,0,0.25), 0 8px 10px -6px rgba(0,0,0,0.2)',
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.primary }} />
            <span className="text-xs font-semibold" style={{ color: T.text }}>{title}</span>
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
            {content}
          </p>
          <div
            className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-x-4 border-x-transparent border-t-4"
            style={{ borderTopColor: isDark ? '#1E293B' : '#FFFFFF' }}
          />
        </div>
      )}
    </div>
  );
}

/* ── Score Gauge ──────────────────────────────────────────────────────────── */

function ScoreGauge({ score, T, isDark }: { score: number; T: Tokens; isDark?: boolean }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200; // 1.2s smooth count-up animation
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      
      // easeOutCubic: fast start, soft settle
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(easeOut * score);
      setAnimatedScore(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [score]);

  const r = 54;
  const circ = 2 * Math.PI * r;
  const progress = (animatedScore / 100) * circ * 0.75;
  const offset = circ * 0.25;
  const color = score >= 80 ? T.success : score >= 65 ? T.warning : T.error;

  return (
    <svg width="140" height="110" viewBox="0 0 140 110">
      <circle
        cx="70"
        cy="80"
        r={r}
        fill="none"
        stroke={isDark ? 'rgba(255,255,255,0.08)' : T.border}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={-offset}
      />
      <circle
        cx="70"
        cy="80"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circ - progress}`}
        strokeDashoffset={-offset}
        style={{ opacity: isDark ? 0.9 : 1 }}
      />
      <text x="70" y="74" textAnchor="middle" fill={T.text} fontSize="26" fontWeight="700" fontFamily="Inter">{animatedScore}</text>
      <text x="70" y="90" textAnchor="middle" fill={T.textSub} fontSize="11" fontFamily="Inter">/ 100</text>
    </svg>
  );
}

/* ── Fix Status Donut / Pie Chart Component ──────────────────────────────── */

interface FixSegment {
  id: string;
  label: string;
  count: number;
  color: string;
  sublabel: string;
  status: 'pass' | 'fail';
  severity?: string;
}

function FixStatusGraph({
  totalChecks,
  passingChecksCount,
  failingChecksCount,
  criticalFailsCount,
  highFailsCount,
  mediumFailsCount,
  lowFailsCount,
  T,
  isDark,
  onViewChecks,
  onGoToRemediation,
}: {
  totalChecks: number;
  passingChecksCount: number;
  failingChecksCount: number;
  criticalFailsCount: number;
  highFailsCount: number;
  mediumFailsCount: number;
  lowFailsCount: number;
  T: Tokens;
  isDark: boolean;
  onViewChecks: (status: 'all' | 'fail' | 'pass', severity?: string) => void;
  onGoToRemediation?: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const segments: FixSegment[] = [
    {
      id: 'pass',
      label: 'Passed Checks',
      count: passingChecksCount,
      color: '#10B981',
      sublabel: 'Fully compliant checks',
      status: 'pass',
    },
    {
      id: 'critical',
      label: 'Critical Fixes',
      count: criticalFailsCount,
      color: '#E11D48',
      sublabel: 'Immediate remediation needed',
      status: 'fail',
      severity: 'critical',
    },
    {
      id: 'high',
      label: 'High Priority Fixes',
      count: highFailsCount,
      color: '#F43F5E',
      sublabel: 'High risk security & reliability',
      status: 'fail',
      severity: 'high',
    },
    {
      id: 'medium',
      label: 'Medium Priority Fixes',
      count: mediumFailsCount,
      color: '#F59E0B',
      sublabel: 'Optimization & governance',
      status: 'fail',
      severity: 'medium',
    },
    {
      id: 'low',
      label: 'Low Priority Fixes',
      count: lowFailsCount,
      color: '#0EA5E9',
      sublabel: 'Minor recommendations',
      status: 'fail',
      severity: 'low',
    },
  ];

  const activeSegments = segments.filter(s => s.count > 0);
  const passRate = totalChecks > 0 ? Math.round((passingChecksCount / totalChecks) * 100) : 0;
  const fixRate = totalChecks > 0 ? Math.round((failingChecksCount / totalChecks) * 100) : 0;

  // Donut SVG parameters
  const size = 180;
  const center = size / 2;
  const radius = 64;
  const strokeWidth = 20;
  const circ = 2 * Math.PI * radius;

  // Calculate segment arcs
  let accumulatedLength = 0;
  const segmentArcs = activeSegments.map(seg => {
    const ratio = seg.count / (totalChecks || 1);
    const strokeDash = ratio * circ;
    const gap = activeSegments.length > 1 ? 2.5 : 0;
    const effectiveDash = Math.max(0, strokeDash - gap);
    const offset = -accumulatedLength;
    accumulatedLength += strokeDash;
    return {
      ...seg,
      strokeDash: effectiveDash,
      dashOffset: offset,
      percentage: Math.round(ratio * 100),
    };
  });

  const activeHovered = segments.find(s => s.id === hoveredId);

  return (
    <div
      className="p-5 sm:p-6"
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        borderRadius: '1.25rem',
      }}
    >
      {/* Header with Title and info */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-4 mb-4 border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF', color: T.primary }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm" style={{ color: T.text }}>Checks & Fix Status Breakdown</h2>
              <InfoTooltip
                title="Checks & Fix Status"
                content="Aggregated breakdown of all technical WAFR checks across pillars, distinguishing compliant checks from items requiring architectural fixes."
                isDark={isDark}
                T={T}
              />
            </div>
            <p className="text-[11px]" style={{ color: T.textSub }}>
              {totalChecks} total checks evaluated · {passingChecksCount} passed ({passRate}%) · {failingChecksCount} require fixing ({fixRate}%)
            </p>
          </div>
        </div>
      </div>

      {/* Pie / Donut Chart with Legend */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-8 lg:gap-14 py-2">
        {/* Donut / Pie Chart & Interactive Center */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            {/* Background ring */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
              strokeWidth={strokeWidth}
            />
            {/* Segment arcs */}
            {segmentArcs.map(seg => {
              const isHovered = hoveredId === seg.id;
              return (
                <circle
                  key={seg.id}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${seg.strokeDash} ${circ - seg.strokeDash}`}
                  strokeDashoffset={seg.dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-200 cursor-pointer"
                  style={{
                    opacity: hoveredId && !isHovered ? 0.45 : 1,
                    filter: isHovered ? `drop-shadow(0 0 6px ${seg.color}80)` : 'none',
                  }}
                  onMouseEnter={() => setHoveredId(seg.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  onClick={() => onViewChecks(seg.status, seg.severity)}
                />
              );
            })}
          </svg>

          {/* Center Summary Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-4">
            {activeHovered ? (
              <div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: activeHovered.color }}>
                  {activeHovered.count}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider line-clamp-1" style={{ color: T.text }}>
                  {activeHovered.label}
                </div>
                <div className="text-[10px]" style={{ color: T.textSub }}>
                  {Math.round((activeHovered.count / (totalChecks || 1)) * 100)}% of total
                </div>
              </div>
            ) : (
              <div>
                <div className="text-2xl font-bold tabular-nums" style={{ color: passRate >= 70 ? T.success : passRate >= 50 ? T.warning : T.error }}>
                  {passRate}%
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                  Pass Rate
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: T.textSub }}>
                  {passingChecksCount}/{totalChecks} Checks
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Legend beside the Pie Chart */}
        <div className="flex flex-col gap-2 w-full max-w-sm">
          {activeSegments.map(seg => {
            const isHovered = hoveredId === seg.id;
            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onViewChecks(seg.status, seg.severity)}
                className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-xl border transition-all cursor-pointer"
                style={{
                  backgroundColor: isHovered
                    ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')
                    : (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC'),
                  borderColor: isHovered ? seg.color : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                }}
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs font-medium" style={{ color: isHovered ? T.text : T.textSub }}>
                    {seg.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold tabular-nums" style={{ color: T.text }}>
                    {seg.count}
                  </span>
                  <span className="text-[11px] tabular-nums" style={{ color: T.textSub }}>
                    ({Math.round((seg.count / (totalChecks || 1)) * 100)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Pillar Card in Review Finding List ───────────────────────────────────── */

function PillarCard({
  p,
  T,
  isDark,
  onSelect,
}: {
  p: PillarData;
  T: typeof LIGHT;
  isDark: boolean;
  onSelect: (pillarId: string) => void;
}) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedPassedBps, setAnimatedPassedBps] = useState(0);
  const [animatedFailedBps, setAnimatedFailedBps] = useState(0);

  const totalBps = p.bestPractices.length;
  const failedBps = p.bestPractices.filter(bp => bp.status === 'fail').length;
  const passedBps = totalBps - failedBps;
  const totalChecks = p.bestPractices.reduce((acc, bp) => acc + bp.checks.length, 0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200; // 1.2s smooth count-up animation
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setAnimatedScore(Math.round(easeOut * p.score));
      setAnimatedPassedBps(Math.round(easeOut * passedBps));
      setAnimatedFailedBps(Math.round(easeOut * failedBps));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [p.score, passedBps, failedBps]);

  const scoreColor = p.score >= 80 ? T.success : p.score >= 65 ? T.warning : T.error;

  return (
    <div
      onClick={() => onSelect(p.id)}
      className="p-5 flex flex-col justify-between gap-4 transition-all duration-200 cursor-pointer hover:shadow-lg group"
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        borderRadius: '1.25rem',
      }}
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center text-sm font-bold transition-transform group-hover:scale-105"
              style={{ backgroundColor: p.color + '20', color: p.color }}
            >
              {p.short}
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: T.text }}>
                <span>{p.label}</span>
                <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: T.primary }}>→</span>
              </div>
              <div className="text-[11px]" style={{ color: T.textSub }}>
                {totalBps} Best Practices · {totalChecks} Checks
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold tabular-nums" style={{ color: scoreColor }}>
              {animatedScore}%
            </div>
          </div>
        </div>

        {/* Score bar */}
        <div className="mt-3.5">
          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : T.border }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${animatedScore}%`, backgroundColor: scoreColor, opacity: isDark ? 0.9 : 1 }} />
          </div>
        </div>
      </div>

      {/* Best Practices breakdown badges */}
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="py-2 px-2.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: isDark ? 'rgba(82,183,136,.12)' : '#ECFDF5' }}>
          <span className="text-[11px] font-medium" style={{ color: isDark ? '#74C69D' : '#059669' }}>BP Passed</span>
          <span className="font-bold text-sm tabular-nums" style={{ color: isDark ? '#74C69D' : '#059669' }}>{animatedPassedBps}</span>
        </div>
        <div className="py-2 px-2.5 rounded-xl flex items-center justify-between" style={{ backgroundColor: isDark ? 'rgba(251,113,133,.1)' : '#FFF1F2' }}>
          <span className="text-[11px] font-medium" style={{ color: isDark ? '#FECDD3' : '#E11D48' }}>BP Failed</span>
          <span className="font-bold text-sm tabular-nums" style={{ color: isDark ? '#FB7185' : '#E11D48' }}>{animatedFailedBps}</span>
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect(p.id);
        }}
        className="w-full text-xs font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        style={{
          border: `1px solid ${T.border}`,
          color: T.textSub,
          backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.color = T.primary;
          e.currentTarget.style.borderColor = T.primary;
          e.currentTarget.style.backgroundColor = isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.color = T.textSub;
          e.currentTarget.style.borderColor = T.border;
          e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC';
        }}
      >
        <span>View {p.label} Findings</span>
        <span>→</span>
      </button>
    </div>
  );
}

/* ── Main Assessment Report Component ────────────────────────────────────── */

export function AssessmentReport() {
  const { go, selectPillar, goToAIFix, theme, currentAssessment, currentMilestones } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [tab, setTab] = useState<'pillar' | 'check' | 'questionnaire'>('pillar');
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);

  // Filter state for "By Check" tab
  const [checkSearch, setCheckSearch] = useState('');
  const [checkPillar, setCheckPillar] = useState('all');
  const [checkSeverity, setCheckSeverity] = useState('all');
  const [checkStatus, setCheckStatus] = useState('all');

  // Calculate totals across all pillars
  const allBps = PILLARS_DATA.flatMap(p => p.bestPractices);
  const totalBps = allBps.length;
  const failedBps = allBps.filter(bp => bp.status === 'fail').length;
  const passedBps = totalBps - failedBps;
  const allChecks = allBps.flatMap(bp => bp.checks);
  const passingChecks = allChecks.filter(c => c.status === 'pass');
  const passingChecksCount = passingChecks.length;
  const failingChecks = allChecks.filter(c => c.status === 'fail');
  const failingChecksCount = failingChecks.length;
  const criticalFailsCount = failingChecks.filter(c => c.severity === 'critical').length;
  const highFailsCount = failingChecks.filter(c => c.severity === 'high').length;
  const mediumFailsCount = failingChecks.filter(c => c.severity === 'medium').length;
  const lowFailsCount = failingChecks.filter(c => c.severity === 'low').length;
  const overallScore = Math.round(PILLARS_DATA.reduce((s, p) => s + p.score, 0) / PILLARS_DATA.length);

  // Flatten checks with pillar and best-practice metadata for the "By Check" tab
  const flattenedChecks = PILLARS_DATA.flatMap(pillar =>
    pillar.bestPractices.flatMap(bp =>
      bp.checks.map(check => ({
        ...check,
        pillarId: pillar.id,
        pillarLabel: pillar.label,
        pillarShort: pillar.short,
        pillarColor: pillar.color,
        bpId: bp.id,
        bpTitle: bp.title,
      }))
    )
  );

  // Apply filters to checks
  const filteredChecks = flattenedChecks.filter(c => {
    if (checkPillar !== 'all' && c.pillarId !== checkPillar) return false;
    if (checkSeverity !== 'all' && c.severity.toLowerCase() !== checkSeverity.toLowerCase()) return false;
    if (checkStatus !== 'all' && c.status.toLowerCase() !== checkStatus.toLowerCase()) return false;
    if (checkSearch.trim()) {
      const q = checkSearch.toLowerCase().trim();
      const matchId = c.id.toLowerCase().includes(q);
      const matchTitle = c.title.toLowerCase().includes(q);
      const matchDesc = c.description.toLowerCase().includes(q);
      const matchPillar = c.pillarLabel.toLowerCase().includes(q);
      const matchBp = c.bpId.toLowerCase().includes(q);
      if (!matchId && !matchTitle && !matchDesc && !matchPillar && !matchBp) return false;
    }
    return true;
  });

  const hasActiveCheckFilters = checkSearch.trim() !== '' || checkPillar !== 'all' || checkSeverity !== 'all' || checkStatus !== 'all';
  const resetCheckFilters = () => {
    setCheckSearch('');
    setCheckPillar('all');
    setCheckSeverity('all');
    setCheckStatus('all');
  };

  const handleViewChecksWithFilter = (status: 'all' | 'fail' | 'pass', severity: string = 'all') => {
    setTab('check');
    setCheckStatus(status);
    setCheckSeverity(severity);
    setCheckSearch('');
  };

  const handleLaunchAIFixes = () => {
    const firstFailingCheck = flattenedChecks.find(c => c.status === 'fail');
    if (firstFailingCheck) {
      goToAIFix(firstFailingCheck.id);
    } else {
      go('remediation');
    }
  };

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ backgroundColor: T.bg, minHeight: '100%' }}>
        {/* Page header */}
        <div className="px-6 py-4" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button onClick={() => go('dashboard')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.primary }}>Home</button>
              <span>/</span>
              <button onClick={() => go('assessment-list')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.textSub }}>Assessments</button>
              <span>/</span>
              <span style={{ color: T.text }} className="font-semibold">{currentAssessment?.name || 'Review Findings'}</span>
            </nav>

            <button
              onClick={() => go('assessment-list')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer"
              style={{ borderColor: T.border, color: T.textSub }}
            >
              ← Back to Assessments
            </button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="font-semibold text-xl" style={{ color: T.text }}>
                  {currentAssessment?.name || 'Production — us-east-1 Full Review'}
                </h1>
                <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded border" style={{ borderColor: T.border, color: T.textSub }}>
                  ID: {currentAssessment?.id || 'A-001'}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <StatusPill status={currentAssessment?.status === 'complete' ? 'complete' : 'warning'} dark={isDark} />
                <span className="text-xs" style={{ color: T.textSub }}>
                  {currentAssessment?.accountName || 'acme-production'} ({currentAssessment?.accountId || '124890123456'}) · {currentAssessment?.region || 'us-east-1'} · {totalBps} Best Practices ({allChecks.length} Checks) · Completed {currentAssessment?.lastRun || '2h ago'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => go('milestones')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer"
                style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <span>Milestones ({currentMilestones.length})</span>
              </button>

              {/* Architecture Diagram Button */}
              <button
                type="button"
                onClick={() => setShowArchitectureModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer"
                style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
                title="View interactive architecture topology diagram"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="2" width="6" height="6" rx="1" />
                  <rect x="16" y="2" width="6" height="6" rx="1" />
                  <rect x="9" y="16" width="6" height="6" rx="1" />
                  <path d="M5 8v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                  <path d="M12 12v4" />
                </svg>
                <span>Architecture</span>
              </button>

              <button
                type="button"
                className="px-3.5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer"
                style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
              >
                ↓ Export PDF
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-6">
          {/* Top 4 Stats Cards: Score Gauge + Total Best Practices + BP Passed + BP Failed (Resources Affected removed) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Overall Score Gauge */}
            <div
              className="p-4 flex flex-col items-center justify-center text-center"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
            >
              <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: T.textSub }}>Overall Score</div>
              <ScoreGauge score={overallScore} T={T} isDark={isDark} />
            </div>

            {/* Total Best Practices */}
            <div
              className="p-5 flex flex-col justify-between gap-2"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: T.textSub }}>Total Best Practices</span>
                <span className="p-2 rounded-xl" style={{ backgroundColor: T.primaryBg }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: T.text }}>{totalBps}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>Across 5 WAFR Pillars ({allChecks.length} checks)</div>
              </div>
            </div>

            {/* BP Passed with info (i) */}
            <div
              className="p-5 flex flex-col justify-between gap-2"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: T.textSub }}>BP Passed</span>
                  <InfoTooltip
                    title="What is BP Passed?"
                    content="A Best Practice is considered Passed when all underlying technical checks and architectural controls meet the Well-Architected Framework compliance standards."
                    isDark={isDark}
                    T={T}
                  />
                </div>
                <span className="p-2 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(82,183,136,.12)' : '#ECFDF5' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: T.success }}>{passedBps}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
                  {Math.round((passedBps / totalBps) * 100)}% Best Practices compliant
                </div>
              </div>
            </div>

            {/* BP Failed with info (i) */}
            <div
              className="p-5 flex flex-col justify-between gap-2"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold" style={{ color: T.textSub }}>BP Failed</span>
                  <InfoTooltip
                    title="What is BP Failed?"
                    content="A Best Practice is considered Failed when one or more underlying technical checks or architectural requirements fail compliance rules, requiring remediation."
                    isDark={isDark}
                    T={T}
                  />
                </div>
                <span className="p-2 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(251,113,133,.15)' : '#FFF1F2' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: T.error }}>{failedBps}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
                  {failingChecksCount} checks requiring remediation
                </div>
              </div>
            </div>
          </div>

          {/* Fix Status Donut / Pie Chart & Comprehensive Health Breakdown */}
          <FixStatusGraph
            totalChecks={allChecks.length}
            passingChecksCount={passingChecksCount}
            failingChecksCount={failingChecksCount}
            criticalFailsCount={criticalFailsCount}
            highFailsCount={highFailsCount}
            mediumFailsCount={mediumFailsCount}
            lowFailsCount={lowFailsCount}
            T={T}
            isDark={isDark}
            onViewChecks={handleViewChecksWithFilter}
            onGoToRemediation={handleLaunchAIFixes}
          />

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b pb-0 flex-wrap gap-2" style={{ borderColor: T.border }}>
            <div className="flex items-center gap-2">
              {([['pillar', 'By Pillar'], ['check', 'By Check'], ['questionnaire', 'Questionnaire Responses']] as const).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="px-4 py-2.5 text-sm font-medium border-b-2 transition-all cursor-pointer"
                  style={{
                    borderBottomColor: tab === id ? T.primary : 'transparent',
                    color: tab === id ? T.text : T.textSub,
                    fontWeight: tab === id ? 600 : 500,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowArchitectureModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 mb-1 text-xs font-medium rounded-full transition-colors cursor-pointer"
              style={{ border: `1px solid ${T.border}`, color: T.textSub }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
              title="Open architecture topology diagram popup"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="6" height="6" rx="1" />
                <rect x="16" y="2" width="6" height="6" rx="1" />
                <rect x="9" y="16" width="6" height="6" rx="1" />
                <path d="M5 8v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                <path d="M12 12v4" />
              </svg>
              <span>Architecture</span>
            </button>
          </div>

          {/* ── TAB 1: BY PILLAR (Cards linking to dedicated Pillar Detail pages) ── */}
          {tab === 'pillar' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {PILLARS_DATA.map(p => (
                <PillarCard
                  key={p.id}
                  p={p}
                  T={T}
                  isDark={isDark}
                  onSelect={(id) => selectPillar(id)}
                />
              ))}
            </div>
          )}

          {/* ── TAB 2: BY CHECK ─────────────────────────────────────────────── */}
          {tab === 'check' && (
            <div className="flex flex-col gap-4">
              {/* Filter Controls Bar */}
              <div
                className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 flex-wrap"
                style={{
                  background: T.card,
                  border: `1px solid ${T.border}`,
                  boxShadow: T.shadow,
                  borderRadius: '1.25rem',
                }}
              >
                <div className="flex items-center gap-3 flex-1 flex-wrap min-w-[280px]">
                  {/* Search Input */}
                  <div className="relative flex-1 min-w-[220px]">
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                      style={{ color: T.muted }}
                      width="14"
                      height="14"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.35-4.35" />
                    </svg>
                    <input
                      type="text"
                      placeholder="Search check ID, title, description, best practice..."
                      value={checkSearch}
                      onChange={e => setCheckSearch(e.target.value)}
                      className="w-full pl-9 pr-8 py-2 rounded-xl text-xs focus:outline-none transition-colors"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        border: `1px solid ${T.border}`,
                        color: T.text,
                      }}
                      onFocus={e => {
                        e.currentTarget.style.borderColor = T.primary;
                        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)';
                      }}
                      onBlur={e => {
                        e.currentTarget.style.borderColor = T.border;
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    />
                    {checkSearch && (
                      <button
                        type="button"
                        onClick={() => setCheckSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs w-4 h-4 rounded-full flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0', color: T.textSub }}
                        title="Clear search"
                        aria-label="Clear search"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  {/* Pillar Filter Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Pillar:</span>
                    <select
                      value={checkPillar}
                      onChange={e => setCheckPillar(e.target.value)}
                      className="rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        border: `1px solid ${checkPillar !== 'all' ? T.primary : T.border}`,
                        color: checkPillar !== 'all' ? T.primary : T.text,
                      }}
                      aria-label="Filter by Pillar"
                    >
                      <option value="all">All Pillars ({flattenedChecks.length})</option>
                      {PILLARS_DATA.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Severity Filter Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Severity:</span>
                    <select
                      value={checkSeverity}
                      onChange={e => setCheckSeverity(e.target.value)}
                      className="rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        border: `1px solid ${checkSeverity !== 'all' ? T.primary : T.border}`,
                        color: checkSeverity !== 'all' ? T.primary : T.text,
                      }}
                      aria-label="Filter by Severity"
                    >
                      <option value="all">All Severities</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                      <option value="info">Informational</option>
                    </select>
                  </div>

                  {/* Status Filter Dropdown */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Status:</span>
                    <select
                      value={checkStatus}
                      onChange={e => setCheckStatus(e.target.value)}
                      className="rounded-xl px-2.5 py-2 text-xs font-medium focus:outline-none cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                        border: `1px solid ${checkStatus !== 'all' ? T.primary : T.border}`,
                        color: checkStatus !== 'all' ? T.primary : T.text,
                      }}
                      aria-label="Filter by Status"
                    >
                      <option value="all">All Statuses</option>
                      <option value="fail">Failed</option>
                      <option value="pass">Passed</option>
                    </select>
                  </div>
                </div>

                {/* Filter Summary and Clear Button */}
                <div className="flex items-center gap-2 justify-between md:justify-end">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium" style={{ color: T.textSub }}>
                      Showing <strong style={{ color: T.text }}>{filteredChecks.length}</strong> of {flattenedChecks.length} checks
                    </span>
                    <div className="hidden sm:flex items-center gap-1 text-[10px] font-semibold">
                      <span className="px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
                        {filteredChecks.filter(c => c.status === 'fail').length} Failed
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {filteredChecks.filter(c => c.status === 'pass').length} Passed
                      </span>
                    </div>
                  </div>

                  {hasActiveCheckFilters && (
                    <button
                      type="button"
                      onClick={resetCheckFilters}
                      className="text-xs font-semibold px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer flex items-center gap-1"
                      style={{
                        borderColor: isDark ? 'rgba(244,63,94,0.3)' : '#FECDD3',
                        color: isDark ? '#FDA4AF' : '#E11D48',
                        backgroundColor: isDark ? 'rgba(244,63,94,0.1)' : '#FFF1F2',
                      }}
                      title="Reset all filters"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"/>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                      </svg>
                      <span>Clear Filters</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table of Filtered Checks */}
              {filteredChecks.length === 0 ? (
                <div
                  className="p-12 text-center flex flex-col items-center justify-center gap-3"
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    borderRadius: '1.25rem',
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9', color: T.textSub }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8"/>
                      <path d="m21 21-4.35-4.35"/>
                      <line x1="8" y1="11" x2="14" y2="11"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: T.text }}>No matching checks found</h3>
                    <p className="text-xs mt-1 max-w-sm" style={{ color: T.textSub }}>
                      No checks match your current filter criteria (Pillar: {checkPillar}, Severity: {checkSeverity}, Status: {checkStatus}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetCheckFilters}
                    className="mt-2 px-4 py-2 text-xs font-semibold rounded-xl text-white transition-opacity hover:opacity-90 cursor-pointer"
                    style={{ backgroundColor: T.primary }}
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div
                  className="overflow-hidden"
                  style={{
                    background: T.card,
                    border: `1px solid ${T.border}`,
                    boxShadow: T.shadow,
                    borderRadius: '1.25rem',
                  }}
                >
                  <div
                    className="grid px-4 py-3 text-[11px] font-semibold uppercase tracking-wide"
                    style={{
                      gridTemplateColumns: '90px 140px 90px 1fr 90px 90px 110px',
                      backgroundColor: isDark ? 'rgba(0,0,0,.15)' : '#F8FAFC',
                      borderBottom: `1px solid ${T.border}`,
                      color: T.textSub,
                    }}
                  >
                    <span>Check ID</span>
                    <span>Pillar</span>
                    <span>Best Practice</span>
                    <span>Title & Rule</span>
                    <span>Severity</span>
                    <span>Status</span>
                    <span className="text-right">Action</span>
                  </div>

                  {filteredChecks.map((c) => {
                    const isFail = c.status === 'fail';

                    return (
                      <div
                        key={c.id}
                        className="grid items-center px-4 py-3 transition-colors"
                        style={{
                          gridTemplateColumns: '90px 140px 90px 1fr 90px 90px 110px',
                          borderBottom: `1px solid ${T.border}`,
                        }}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.02)' : '#F8FAFC')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span className="text-[11px] font-mono font-medium" style={{ color: T.textSub }}>{c.id}</span>
                        <div>
                          <button
                            type="button"
                            onClick={() => selectPillar(c.pillarId)}
                            className="text-xs font-semibold hover:underline cursor-pointer flex items-center gap-1.5"
                            style={{ color: c.pillarColor }}
                            title={`View ${c.pillarLabel} pillar`}
                          >
                            <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: c.pillarColor }} />
                            <span className="truncate">{c.pillarLabel}</span>
                          </button>
                        </div>
                        <div>
                          <span
                            className="text-xs font-mono font-medium px-2 py-0.5 rounded border"
                            style={{
                              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F1F5F9',
                              borderColor: isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0',
                              color: T.textSub,
                            }}
                          >
                            {c.bpId}
                          </span>
                        </div>
                        <div className="pr-3 min-w-0">
                          <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{c.title}</div>
                          <div className="text-[11px] truncate mt-0.5" style={{ color: T.textSub }}>{c.description}</div>
                        </div>
                        <div>
                          <SeverityPill severity={c.severity} dark={isDark} />
                        </div>
                        <div>
                          {isFail ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                              Failed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              Passed
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end">
                          {isFail ? (
                            <button
                              type="button"
                              onClick={() => goToAIFix(c.id)}
                              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold rounded-full hover:opacity-90 transition-opacity cursor-pointer text-white shadow-sm"
                              style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                              </svg>
                              <span>AI Fix</span>
                            </button>
                          ) : (
                            <span className="text-[11px]" style={{ color: T.muted }}>—</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: QUESTIONNAIRE RESPONSES ──────────────────────────────── */}
          {tab === 'questionnaire' && (
            <div className="flex flex-col gap-3">
              {[
                {
                  scope: 'account',
                  q: 'How do you monitor the health of your workload?',
                  cat: 'Reliability',
                  bp: 'REL-02',
                  ans: 'We use CloudWatch dashboards with custom metrics and SNS alerts for P1/P2 severity. All microservices export traces via OpenTelemetry and logs to Datadog.',
                  score: 'Good',
                },
                {
                  scope: 'account',
                  q: 'How do you protect data at rest and in transit?',
                  cat: 'Security',
                  bp: 'SEC-03',
                  ans: 'AES-256 encryption at rest via AWS KMS Customer Managed Keys for all S3 buckets and RDS volumes. TLS 1.3 enforced on all ALB and CloudFront endpoints.',
                  score: 'Good',
                },
                {
                  scope: 'organization',
                  q: 'How does the organization enforce Service Control Policies (SCPs) and Landing Zone guardrails?',
                  cat: 'Security & Governance',
                  bp: 'SEC-01',
                  ans: 'AWS Organizations with AWS Control Tower enforces foundational SCPs denying unauthorized regions, root user usage, and public S3 bucket creation across all member accounts.',
                  score: 'Excellent',
                },
                {
                  scope: 'account',
                  q: 'How do you select the appropriate pricing model?',
                  cat: 'Cost Optimization',
                  bp: 'COST-03',
                  ans: 'We use a mix of On-Demand for bursty workloads and 1-year Compute Savings Plans for baseline capacity. RDS instances are committed on 1-year Reserved Instances.',
                  score: 'Excellent',
                },
                {
                  scope: 'organization',
                  q: 'How is centralized audit logging and SIEM integration configured across accounts?',
                  cat: 'Security',
                  bp: 'SEC-04',
                  ans: 'Organization-wide CloudTrail logs and VPC Flow Logs are replicated to a dedicated secure Log Archive account with SIEM ingestion.',
                  score: 'Good',
                },
                {
                  scope: 'account',
                  q: 'How do you evolve operations and respond to incidents?',
                  cat: 'Operational Excellence',
                  bp: 'OPS-03',
                  ans: 'Post-incident reviews (PIRs) are conducted within 48 hours for all high-severity incidents. Runbooks are maintained in Confluence and being integrated into alerts.',
                  score: 'Good',
                },
              ].map((q, i) => (
                <div
                  key={i}
                  className="p-5"
                  style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
                >
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{
                        backgroundColor: q.scope === 'account' ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF') : (isDark ? 'rgba(147,51,234,0.15)' : '#FAF5FF'),
                        color: q.scope === 'account' ? (isDark ? '#93C5FD' : '#2563EB') : (isDark ? '#C084FC' : '#7E22CE'),
                        border: `1px solid ${q.scope === 'account' ? (isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE') : (isDark ? 'rgba(147,51,234,0.3)' : '#E9D5FF')}`,
                      }}
                    >
                      {q.scope === 'account' ? 'Account-Specific' : 'Organization-Specific'}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: T.primaryBg, color: T.primary }}>
                      {q.cat}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: T.textSub }}>
                      {q.bp}
                    </span>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                      style={
                        q.score === 'Excellent'
                          ? { backgroundColor: T.successBg, color: T.success }
                          : { backgroundColor: T.primaryBg, color: T.primary }
                      }
                    >
                      {q.score}
                    </span>
                  </div>
                  <p className="text-sm font-semibold mb-2" style={{ color: T.text }}>{q.q}</p>
                  <p className="text-sm leading-relaxed" style={{ color: T.textSub }}>{q.ans}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Architecture Diagram Popup Modal */}
      <ArchitectureDiagramModal
        isOpen={showArchitectureModal}
        onClose={() => setShowArchitectureModal(false)}
        onGoToRemediation={handleLaunchAIFixes}
      />
    </AppLayout>
  );
}
