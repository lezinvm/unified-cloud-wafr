import { useState, useEffect, useMemo } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { StatusPill } from '../components/StatusPill';
import { SeverityPill } from '../components/FindingUI';
import { PILLARS_DATA, PillarData } from '../data/wafrData';
import {
  ComplianceFramework,
  CloudProvider,
  INITIAL_COMPLIANCE_FRAMEWORKS,
} from '../data/complianceData';
import { ArchitectureDiagramModal } from '../components/ArchitectureDiagramModal';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { JiraTicketModal } from '../components/JiraTicketModal';
import { SlackAlertModal } from '../components/SlackAlertModal';
import { SlackLogo, JiraLogo } from '../components/IntegrationLogos';
import { REMEDIATION_DATABASE } from './AIRemediation';
import {
  fetchRemediationsFromDb,
  getFallbackRemediations,
  type CheckRemediationData,
} from '../data/remediationData';

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

/* ── Graph 1: Assessment Findings Breakdown Component ──────────────────────── */

function FindingsBreakdownGraph({
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

  const size = 170;
  const center = size / 2;
  const radius = 60;
  const strokeWidth = 18;
  const circ = 2 * Math.PI * radius;

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
      className="p-5 flex flex-col justify-between"
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        borderRadius: '1.25rem',
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3.5 mb-3 border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF', color: T.primary }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
              <path d="M22 12A10 10 0 0 0 12 2v10z"/>
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm" style={{ color: T.text }}>Assessment Findings Breakdown</h2>
              <InfoTooltip
                title="Assessment Findings Breakdown"
                content="Evaluated findings from scan: Passed checks vs Critical, High, Medium, and Low severity failures."
                isDark={isDark}
                T={T}
              />
            </div>
            <p className="text-[11px]" style={{ color: T.textSub }}>
              {totalChecks} checks evaluated · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{passingChecksCount} Passed</span> · <span className="text-rose-500 font-semibold">{failingChecksCount} Failed</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-1">
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            <circle cx={center} cy={center} r={radius} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} strokeWidth={strokeWidth} />
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
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
            {activeHovered ? (
              <div>
                <div className="text-xl font-bold tabular-nums" style={{ color: activeHovered.color }}>
                  {activeHovered.count}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider line-clamp-1" style={{ color: T.text }}>
                  {activeHovered.label}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xl font-bold tabular-nums" style={{ color: passRate >= 70 ? T.success : passRate >= 50 ? T.warning : T.error }}>
                  {passRate}%
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                  Pass Rate
                </div>
                <div className="text-[10px]" style={{ color: T.textSub }}>
                  {passingChecksCount}/{totalChecks} Passed
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          {segments.map(seg => {
            const isHovered = hoveredId === seg.id;
            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => onViewChecks(seg.status, seg.severity)}
                className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border transition-all cursor-pointer"
                style={{
                  backgroundColor: isHovered ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC'),
                  borderColor: isHovered ? seg.color : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs font-medium truncate" style={{ color: isHovered ? T.text : T.textSub }}>
                    {seg.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold tabular-nums" style={{ color: T.text }}>
                    {seg.count}
                  </span>
                  <span className="text-[10px] tabular-nums" style={{ color: T.textSub }}>
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

/* ── Graph 2: Live Remediation Sync Status Component ──────────────────────── */

function RemediationSyncGraph({
  totalChecks,
  fixedCount,
  inProgressCount,
  cantFixCount,
  pendingCount,
  T,
  isDark,
  onViewChecks,
  onOpenCantFixModal,
}: {
  totalChecks: number;
  fixedCount: number;
  inProgressCount: number;
  cantFixCount: number;
  pendingCount: number;
  T: Tokens;
  isDark: boolean;
  onViewChecks: (status: 'all' | 'fail' | 'pass', severity?: string) => void;
  onOpenCantFixModal?: () => void;
}) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const segments: FixSegment[] = [
    {
      id: 'fixed',
      label: 'Fixed / Solved',
      count: fixedCount,
      color: '#10B981',
      sublabel: 'All impacted resources remediated',
      status: 'pass',
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      count: inProgressCount,
      color: '#3B82F6',
      sublabel: 'Partial fixes underway across resources',
      status: 'fail',
    },
    {
      id: 'cant_fix',
      label: "Ignored",
      count: cantFixCount,
      color: '#F59E0B',
      sublabel: 'Waivered / Code dependency constraints',
      status: 'fail',
    },
    {
      id: 'pending',
      label: 'Pending Fixes',
      count: pendingCount,
      color: '#E11D48',
      sublabel: 'Requires architectural remediation',
      status: 'fail',
    },
  ];

  const activeSegments = segments.filter(s => s.count > 0);
  const syncRate = totalChecks > 0 ? Math.round(((fixedCount + cantFixCount) / totalChecks) * 100) : 0;

  const size = 170;
  const center = size / 2;
  const radius = 60;
  const strokeWidth = 18;
  const circ = 2 * Math.PI * radius;

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

  const handleSegmentClick = (seg: FixSegment) => {
    if (seg.id === 'cant_fix' && onOpenCantFixModal) {
      onOpenCantFixModal();
    } else {
      onViewChecks(seg.status);
    }
  };

  return (
    <div
      className="p-5 flex flex-col justify-between"
      style={{
        background: T.card,
        border: `1px solid ${T.border}`,
        boxShadow: T.shadow,
        borderRadius: '1.25rem',
      }}
    >
      <div className="flex items-center justify-between flex-wrap gap-2 pb-3.5 mb-3 border-b" style={{ borderColor: T.border }}>
        <div className="flex items-center gap-2">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5', color: '#10B981' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="font-semibold text-sm" style={{ color: T.text }}>Live Remediation Sync Status</h2>
              <InfoTooltip
                title="Live Remediation Sync Status"
                content="Real-time remediation progress synced from resource-level actions: Fixed (all resources done), In Progress (partial fixes), Ignored (notes saved), and Pending."
                isDark={isDark}
                T={T}
              />
            </div>
            <p className="text-[11px]" style={{ color: T.textSub }}>
              Synced live · <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{fixedCount} Fixed</span> · <span className="text-blue-600 dark:text-blue-400 font-semibold">{inProgressCount} In Progress</span> · <span onClick={() => onOpenCantFixModal?.()} className="text-amber-600 dark:text-amber-400 font-semibold cursor-pointer hover:underline">{cantFixCount} Ignored</span> · <span className="text-red-500 font-semibold">{pendingCount} Pending</span>
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 py-1">
        <div className="relative flex items-center justify-center shrink-0">
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
            <circle cx={center} cy={center} r={radius} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'} strokeWidth={strokeWidth} />
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
                  onClick={() => handleSegmentClick(seg)}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none px-2">
            {activeHovered ? (
              <div>
                <div className="text-xl font-bold tabular-nums" style={{ color: activeHovered.color }}>
                  {activeHovered.count}
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider line-clamp-1" style={{ color: T.text }}>
                  {activeHovered.label}
                </div>
              </div>
            ) : (
              <div>
                <div className="text-xl font-bold tabular-nums" style={{ color: syncRate >= 70 ? T.success : syncRate >= 40 ? T.warning : T.error }}>
                  {syncRate}%
                </div>
                <div className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                  Remediated
                </div>
                <div className="text-[10px]" style={{ color: T.textSub }}>
                  {fixedCount + cantFixCount}/{totalChecks} Resolved
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1.5 w-full">
          {segments.map(seg => {
            const isHovered = hoveredId === seg.id;
            return (
              <div
                key={seg.id}
                onMouseEnter={() => setHoveredId(seg.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleSegmentClick(seg)}
                className="flex items-center justify-between gap-3 px-3 py-1.5 rounded-xl border transition-all cursor-pointer"
                style={{
                  backgroundColor: isHovered ? (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC'),
                  borderColor: isHovered ? seg.color : (isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'),
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: seg.color }} />
                  <span className="text-xs font-medium truncate" style={{ color: isHovered ? T.text : T.textSub }}>
                    {seg.label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-bold tabular-nums" style={{ color: T.text }}>
                    {seg.count}
                  </span>
                  <span className="text-[10px] tabular-nums" style={{ color: T.textSub }}>
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

  const fallbackP = PILLARS_DATA.find(sp => sp.id === p.id);
  const bps = Array.isArray(p.bestPractices) && p.bestPractices.length > 0 ? p.bestPractices : (fallbackP?.bestPractices || []);
  const totalBps = bps.length;
  const failedBps = bps.filter(bp => bp?.status === 'fail').length;
  const passedBps = totalBps - failedBps;
  const totalChecks = bps.reduce((acc, bp) => acc + (bp?.checks?.length || 0), 0);

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

/* ── Provider Chip Component ────────────────────────────────────────────── */
function ProviderChip({ provider }: { provider: CloudProvider }) {
  if (provider === 'aws') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#FF9900]/15 text-[#FF9900] border border-[#FF9900]/30" title="Amazon Web Services">
        AWS
      </span>
    );
  }
  if (provider === 'azure') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#0078D4]/15 text-[#0078D4] border border-[#0078D4]/30" title="Microsoft Azure">
        AZ
      </span>
    );
  }
  if (provider === 'gcp') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/30" title="Google Cloud">
        GCP
      </span>
    );
  }
  if (provider === 'github') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-500/15 text-purple-400 border border-purple-500/30" title="GitHub Actions">
        GH
      </span>
    );
  }
  if (provider === 'k8s') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30" title="Kubernetes">
        K8s
      </span>
    );
  }
  return null;
}

/* ── Compliance Framework Card in FinOps Lens ────────────────────────────── */
function ComplianceFrameworkReportCard({
  fw,
  T,
  isDark,
  isPinned,
  onTogglePin,
  onSelect,
}: {
  fw: ComplianceFramework;
  T: Tokens;
  isDark: boolean;
  isPinned: boolean;
  onTogglePin: () => void;
  onSelect: () => void;
}) {
  const scoreColor = fw.score >= 80 ? '#10B981' : fw.score >= 30 ? '#F59E0B' : '#E11D48';

  return (
    <div
      onClick={onSelect}
      className="p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 group relative hover:shadow-lg hover:-translate-y-0.5"
      style={{
        backgroundColor: T.card,
        borderColor: isPinned ? (isDark ? 'rgba(16,185,129,0.35)' : '#A7F3D0') : T.border,
        boxShadow: T.shadow,
      }}
    >
      <div>
        {/* Card Header with Badge, Title, and Bookmark Pin */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 border"
              style={{
                backgroundColor: fw.badgeBg + '25',
                color: fw.badgeColor,
                borderColor: fw.badgeBg + '40',
              }}
            >
              {fw.badge}
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold truncate group-hover:text-emerald-500 transition-colors" style={{ color: T.text }}>
                {fw.name}
              </h3>
              <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>
                {fw.passingRequirements} / {fw.totalRequirements} Passing Requirements
              </span>
            </div>
          </div>

          {/* Bookmark / Pin Toggle */}
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              onTogglePin();
            }}
            className="p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
            style={{
              color: isPinned ? '#10B981' : (isDark ? '#64748B' : '#94A3B8'),
              backgroundColor: isPinned ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : 'transparent',
            }}
            title={isPinned ? 'Remove from watchlist' : 'Pin to watchlist'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
            </svg>
          </button>
        </div>

        {/* Score Bar */}
        <div className="flex flex-col gap-1 my-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Score:</span>
            <span className="text-xs font-bold font-mono" style={{ color: scoreColor }}>
              {fw.score}%
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${fw.score}%`, backgroundColor: scoreColor }}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Provider Badges & Stats */}
      <div className="pt-2 border-t flex flex-col gap-2" style={{ borderColor: T.border }}>
        <div className="flex items-center justify-between gap-2">
          {/* Provider Icons */}
          <div className="flex items-center gap-1">
            {fw.providers.map(p => (
              <ProviderChip key={p} provider={p} />
            ))}
          </div>

          {/* Breakdown Stats */}
          <div className="text-[10px] font-medium" style={{ color: T.textSub }}>
            {fw.failingRequirements > 0 ? (
              <span className="text-rose-500 font-bold">{fw.failingRequirements} failed · </span>
            ) : (
              <span className="text-slate-400">0 failed · </span>
            )}
            <span>{fw.manualRequirements} manual</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Compliance Framework Detail Modal ───────────────────────────────────── */
function ComplianceFrameworkDetailModal({
  fw,
  isOpen,
  onClose,
  T,
  isDark,
  onTriggerSlack,
  onTriggerJira,
  onGoToAIFix,
}: {
  fw: ComplianceFramework;
  isOpen: boolean;
  onClose: () => void;
  T: Tokens;
  isDark: boolean;
  onTriggerSlack: (target: { title: string; message: string; severity: 'critical' | 'high' | 'info'; checkId?: string }) => void;
  onTriggerJira: (target: { checkId: string; title: string; severity?: string; description?: string }) => void;
  onGoToAIFix: (checkId: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'sec-8': true, 'sec-3': true, 'sec-1': true });
  const [reqFilter, setReqFilter] = useState<'all' | 'fail' | 'pass'>('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const toggleSection = (id: string) => {
    setExpandedSections(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
        style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border, backgroundColor: isDark ? '#111B2E' : '#F8FAFC' }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border"
              style={{ backgroundColor: fw.badgeBg + '25', color: fw.badgeColor, borderColor: fw.badgeBg + '40' }}
            >
              {fw.badge}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ color: T.text }}>{fw.name}</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold">
                  {fw.version}
                </span>
              </div>
              <p className="text-xs" style={{ color: T.textSub }}>{fw.description}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border transition-colors cursor-pointer"
            style={{ borderColor: T.border, color: T.textSub }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC', borderColor: T.border }}>
              <span className="text-xs font-semibold" style={{ color: T.textSub }}>Compliance Score</span>
              <div className="text-2xl font-bold font-mono mt-1" style={{ color: fw.score >= 80 ? '#10B981' : fw.score >= 30 ? '#F59E0B' : '#E11D48' }}>
                {fw.score}%
              </div>
              <span className="text-[10px]" style={{ color: T.textSub }}>{fw.passingRequirements} / {fw.totalRequirements} Passing Requirements</span>
            </div>

            <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC', borderColor: T.border }}>
              <span className="text-xs font-semibold" style={{ color: T.textSub }}>Failed Requirements</span>
              <div className="text-2xl font-bold font-mono mt-1 text-rose-500">
                {fw.failingRequirements}
              </div>
              <span className="text-[10px]" style={{ color: T.textSub }}>Immediate security remediation needed</span>
            </div>

            <div className="p-4 rounded-xl border flex flex-col justify-between" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC', borderColor: T.border }}>
              <span className="text-xs font-semibold" style={{ color: T.textSub }}>Manual Audit Requirements</span>
              <div className="text-2xl font-bold font-mono mt-1 text-slate-400">
                {fw.manualRequirements}
              </div>
              <span className="text-[10px]" style={{ color: T.textSub }}>Periodic policy review required</span>
            </div>
          </div>

          {/* Section Requirements Accordion */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-sm font-bold" style={{ color: T.text }}>Framework Requirement Sections</h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Filter controls..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="px-2.5 py-1 text-xs rounded-lg border outline-none w-44"
                  style={{ backgroundColor: isDark ? '#0B1220' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {fw.sections.map(sec => {
                const isExpanded = !!expandedSections[sec.id];
                const failedCount = (sec.requirements || []).filter(r => r?.status === 'fail').length;
                const filteredReqs = (sec.requirements || []).filter(r => {
                  if (reqFilter === 'fail' && r?.status !== 'fail') return false;
                  if (reqFilter === 'pass' && r?.status !== 'pass') return false;
                  if (search.trim()) {
                    const q = search.toLowerCase().trim();
                    return r.code.toLowerCase().includes(q) || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
                  }
                  return true;
                });

                if (filteredReqs.length === 0 && search.trim()) return null;

                return (
                  <div key={sec.id} className="rounded-xl border overflow-hidden" style={{ borderColor: T.border, backgroundColor: isDark ? '#111B2E' : '#FFFFFF' }}>
                    <div
                      onClick={() => toggleSection(sec.id)}
                      className="p-3.5 flex items-center justify-between gap-3 cursor-pointer select-none"
                      style={{ backgroundColor: isExpanded ? (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC') : 'transparent' }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs transition-transform" style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
                        <span className="text-xs font-bold" style={{ color: T.text }}>{sec.title}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>{sec.requirements.length} Requirements</span>
                        {failedCount > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500">
                            {failedCount} Fail
                          </span>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3.5 border-t flex flex-col gap-2.5" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#FAFBFD' }}>
                        {filteredReqs.map(req => (
                          <div key={req.id} className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3" style={{ backgroundColor: T.card, borderColor: req.status === 'fail' ? (isDark ? 'rgba(244,63,94,0.3)' : '#FECDD3') : T.border }}>
                            <div className="flex items-start gap-2.5 min-w-0 flex-1">
                              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${req.status === 'pass' ? 'bg-emerald-500/15 text-emerald-500' : req.status === 'fail' ? 'bg-rose-500/15 text-rose-500' : 'bg-slate-500/15 text-slate-400'}`}>
                                {req.status === 'pass' ? '✓' : req.status === 'fail' ? '✕' : 'M'}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                  <span className="font-mono text-[10px] font-bold text-blue-500">{req.code}</span>
                                  <SeverityPill severity={req.severity} dark={isDark} />
                                  <span className="text-xs font-bold" style={{ color: T.text }}>{req.title}</span>
                                </div>
                                <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>{req.description}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                              <button
                                type="button"
                                onClick={() => onTriggerSlack({
                                  title: `Compliance Alert [${fw.name}]: ${req.code} - ${req.title}`,
                                  message: `Control ${req.code} required under ${fw.name}.\n\n${req.description}`,
                                  severity: req.severity === 'critical' ? 'critical' : req.severity === 'high' ? 'high' : 'info',
                                  checkId: req.checkId,
                                })}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg border text-[#E01E5A] dark:text-[#ECB22E] cursor-pointer"
                                style={{ borderColor: isDark ? 'rgba(236,178,46,0.3)' : 'rgba(224,30,90,0.2)' }}
                              >
                                # Slack
                              </button>

                              <button
                                type="button"
                                onClick={() => onTriggerJira({
                                  checkId: req.checkId || req.id,
                                  title: `[${fw.shortName}] ${req.code}: ${req.title}`,
                                  severity: req.severity,
                                  description: req.description,
                                })}
                                className="px-2 py-1 text-[10px] font-bold rounded-lg border text-[#0052CC] dark:text-[#388BFF] cursor-pointer"
                                style={{ borderColor: isDark ? 'rgba(56,139,255,0.3)' : 'rgba(0,82,204,0.2)' }}
                              >
                                + Jira
                              </button>

                              {req.status === 'fail' && req.checkId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onGoToAIFix(req.checkId!);
                                  }}
                                  className="px-2.5 py-1 text-[10px] font-bold rounded-full text-white cursor-pointer shadow-xs"
                                  style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                                >
                                  AI Fix
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex items-center justify-between shrink-0" style={{ borderColor: T.border, backgroundColor: isDark ? '#111B2E' : '#F8FAFC' }}>
          <span className="text-xs" style={{ color: T.textSub }}>Showing full control checklist for <strong>{fw.name}</strong></span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white cursor-pointer"
            style={{ backgroundColor: T.primary }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Main Assessment Report Component ────────────────────────────────────── */

export function AssessmentReport() {
  const {
    go,
    selectPillar,
    goToAIFix,
    theme,
    currentAssessment,
    currentMilestones,
    resourceRemediations,
    getCheckRemediationStatus,
    runOrUpdateAssessment,
    jiraTickets,
    bulkCreateJiraTickets,
    selectedLens,
    setSelectedLens,
    complianceFrameworks,
    pinnedComplianceIds,
    togglePinComplianceFramework,
    pillars,
  } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [tab, setTab] = useState<'pillar' | 'check' | 'questionnaire'>('pillar');
  const [showArchitectureModal, setShowArchitectureModal] = useState(false);
  const [showCantFixModal, setShowCantFixModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [activeComplianceModal, setActiveComplianceModal] = useState<ComplianceFramework | null>(null);

  // Jira and Slack Modal states
  const [jiraModalTarget, setJiraModalTarget] = useState<{
    checkId: string;
    title: string;
    severity?: string;
    description?: string;
  } | null>(null);

  const [slackModalTarget, setSlackModalTarget] = useState<{
    title: string;
    message?: string;
    severity?: 'critical' | 'high' | 'info';
    checkId?: string;
  } | null>(null);

  // Filter state for "By Check" tab
  const [checkSearch, setCheckSearch] = useState('');
  const [checkPillar, setCheckPillar] = useState('all');
  const [checkSeverity, setCheckSeverity] = useState('all');
  const [checkStatus, setCheckStatus] = useState('all');

  const activeCloud = (((currentAssessment?.cloud || 'aws') as string).toLowerCase()) as 'aws' | 'azure' | 'gcp';
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

  const remediationCheckStats = useMemo(() => {
    let fixed = 0;
    let inProgress = 0;
    let cantFix = 0;
    let pending = 0;

    const allDbChecks = Object.values(remediationsDb);
    allDbChecks.forEach(c => {
      const st = getCheckRemediationStatus(c.id, c.resources || []);
      if (st === 'fixed') fixed++;
      else if (st === 'in_progress') inProgress++;
      else if (st === 'cant_fix') cantFix++;
      else pending++;
    });

    return { fixed, inProgress, cantFix, pending, total: allDbChecks.length };
  }, [remediationsDb, resourceRemediations, getCheckRemediationStatus]);

  const excludedResourcesList = useMemo(() => {
    const list: Array<{ checkId: string; checkTitle: string; resource: string; note: string; severity: string }> = [];
    if (!resourceRemediations) return list;
    Object.entries(resourceRemediations).forEach(([key, val]) => {
      if (val.status === 'cant_fix') {
        const [checkId, ...resParts] = key.split('::');
        const resource = resParts.join('::');
        const checkData = remediationsDb[checkId] || REMEDIATION_DATABASE[checkId];
        list.push({
          checkId,
          checkTitle: checkData?.title || checkId,
          resource,
          note: val.note || 'Code dependency constraint',
          severity: checkData?.severity || 'medium',
        });
      }
    });
    return list;
  }, [remediationsDb, resourceRemediations]);

  const activePillars = useMemo(() => {
    const raw = Array.isArray(pillars) && pillars.length > 0 ? pillars : PILLARS_DATA;
    return raw.map(p => {
      const fallbackP = PILLARS_DATA.find(sp => sp.id === p.id) || PILLARS_DATA[0];
      return {
        ...fallbackP,
        ...p,
        bestPractices: Array.isArray(p.bestPractices) && p.bestPractices.length > 0 ? p.bestPractices : fallbackP.bestPractices,
      };
    });
  }, [pillars]);

  // Calculate totals across active pillars
  const allBps = activePillars.flatMap(p => p.bestPractices || []);
  const staticTotalBps = allBps.length;
  const staticFailedBps = allBps.filter(bp => bp?.status === 'fail').length;
  const staticPassedBps = staticTotalBps - staticFailedBps;
  const allChecks = allBps.flatMap(bp => bp?.checks || []);
  const staticPassingChecks = allChecks.filter(c => c?.status === 'pass');
  const staticFailingChecks = allChecks.filter(c => c?.status === 'fail');

  // Pull metrics dynamically directly from currentAssessment (MongoDB document)
  const overallScore = currentAssessment?.score ?? Math.round(activePillars.reduce((s, p) => s + ((currentAssessment?.pillars as Record<string, number> | undefined)?.[p.id] ?? p.score), 0) / activePillars.length);
  const totalBps = currentAssessment?.totalBestPractices ?? staticTotalBps;
  const passedBps = currentAssessment?.passedBps ?? staticPassedBps;
  const failedBps = currentAssessment?.failedBps ?? staticFailedBps;
  const totalChecksCount = currentAssessment?.totalChecks ?? allChecks.length;
  const passingChecksCount = currentAssessment?.passedChecks ?? staticPassingChecks.length;
  const failingChecksCount = currentAssessment?.failedChecks ?? staticFailingChecks.length;
  const criticalFailsCount = staticFailingChecks.filter(c => c?.severity === 'critical').length;
  const highFailsCount = currentAssessment?.highRisks ?? staticFailingChecks.filter(c => c?.severity === 'high').length;
  const mediumFailsCount = currentAssessment?.mediumRisks ?? staticFailingChecks.filter(c => c?.severity === 'medium').length;
  const lowFailsCount = currentAssessment?.lowRisks ?? staticFailingChecks.filter(c => c?.severity === 'low').length;

  // Flatten checks with pillar and best-practice metadata for the "By Check" tab
  const flattenedChecks = activePillars.flatMap(pillar =>
    (pillar.bestPractices || []).flatMap(bp =>
      (bp?.checks || []).map(check => ({
        ...check,
        pillarId: pillar.id,
        pillarLabel: pillar.label,
        pillarShort: pillar.short,
        pillarColor: pillar.color,
        bpId: bp?.id || '',
        bpTitle: bp?.title || '',
      }))
    )
  );

  // Apply filters to checks
  const filteredChecks = flattenedChecks.filter(c => {
    if (checkPillar !== 'all' && c.pillarId !== checkPillar) return false;
    if (checkSeverity !== 'all' && (c.severity || '').toLowerCase() !== checkSeverity.toLowerCase()) return false;
    if (checkStatus !== 'all' && (c.status || '').toLowerCase() !== checkStatus.toLowerCase()) return false;
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
              {/* Lens Selector */}
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs shadow-xs"
                style={{
                  backgroundColor: isDark ? '#111B2E' : '#F1F5F9',
                  borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#CBD5E1',
                }}
              >
                <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Lens:</span>
                <select
                  value={selectedLens}
                  onChange={e => setSelectedLens(e.target.value as any)}
                  aria-label="Select Architecture Lens"
                  className="bg-transparent text-xs font-bold outline-none cursor-pointer pr-1"
                  style={{ color: T.text }}
                >
                  <option value="wafr" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">WAFR Lens (Well-Architected)</option>
                  <option value="finops" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">FinOps Lens (Compliance & Cost)</option>
                  <option value="genai" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">GenAI Lens (Generative AI)</option>
                </select>
              </div>

              {/* Instant Rerun Assessment Button */}
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
                    go('live-scan');
                  }
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer text-white shadow-xs hover:opacity-90 active:scale-98"
                style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}
                title="Immediately trigger a fresh live scan of this assessment"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                </svg>
                <span>Rerun Assessment</span>
              </button>

              {/* Schedule Recurring Assessment Button */}
              <button
                type="button"
                onClick={() => setShowScheduleModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer"
                style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#2563EB';
                  e.currentTarget.style.borderColor = '#2563EB';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = T.textSub;
                  e.currentTarget.style.borderColor = T.border;
                }}
                title="Schedule automated recurring reruns for this assessment"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                  <line x1="16" y1="2" x2="16" y2="6"/>
                  <line x1="8" y1="2" x2="8" y2="6"/>
                  <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
                <span>Schedule Recurring Rerun</span>
              </button>

              {/* Send Slack Alert Button */}
              <button
                type="button"
                onClick={() => {
                  setSlackModalTarget({
                    title: `WAFR Assessment Alert: ${currentAssessment?.name || 'Production Review'}`,
                    message: `Assessment score is ${overallScore}%. ${failingChecksCount} failing checks evaluated (${criticalFailsCount} Critical, ${highFailsCount} High HRIs).`,
                    severity: criticalFailsCount > 0 ? 'critical' : highFailsCount > 0 ? 'high' : 'info',
                  });
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer text-[#4A154B] dark:text-[#ECB22E]"
                style={{
                  border: `1px solid ${isDark ? 'rgba(236,178,46,0.3)' : 'rgba(74,21,75,0.2)'}`,
                  backgroundColor: isDark ? 'rgba(74,21,75,0.2)' : '#FDF4FF',
                }}
                title="Broadcast assessment status and critical HRIs to Slack"
              >
                <SlackLogo size={13} />
                <span>Notify Slack</span>
              </button>

              {/* Bulk Jira Sync Button */}
              <button
                type="button"
                onClick={() => {
                  const failingChecksToSync = flattenedChecks
                    .filter(c => c?.status === 'fail')
                    .map(c => ({ id: c.id, title: c.title, severity: c.severity }));
                  bulkCreateJiraTickets(failingChecksToSync);
                }}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-full transition-colors cursor-pointer text-[#0052CC] dark:text-[#388BFF]"
                style={{
                  border: `1px solid ${isDark ? 'rgba(56,139,255,0.3)' : 'rgba(0,82,204,0.2)'}`,
                  backgroundColor: isDark ? 'rgba(0,82,204,0.15)' : '#EFF6FF',
                }}
                title="Automatically create and sync Jira tickets for all failing findings"
              >
                <JiraLogo size={13} />
                <span>Sync to Jira</span>
              </button>

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

          {/* ── 2 GRAPHS: ASSESSMENT FINDINGS vs REMEDIATION SYNC STATUS ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Graph 1: Assessment Scan Findings Breakdown */}
            <FindingsBreakdownGraph
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
            />

            {/* Graph 2: Live Remediation Sync Status */}
            <RemediationSyncGraph
              totalChecks={remediationCheckStats.total}
              fixedCount={remediationCheckStats.fixed}
              inProgressCount={remediationCheckStats.inProgress}
              cantFixCount={remediationCheckStats.cantFix}
              pendingCount={remediationCheckStats.pending}
              T={T}
              isDark={isDark}
              onViewChecks={handleViewChecksWithFilter}
              onOpenCantFixModal={() => setShowCantFixModal(true)}
            />
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center justify-between border-b pb-0 flex-wrap gap-2" style={{ borderColor: T.border }}>
            <div className="flex items-center gap-2">
              {([
                ['pillar', selectedLens === 'finops' ? 'Compliance Frameworks' : 'By Pillar'],
                ['check', 'By Check'],
                ['questionnaire', 'Questionnaire Responses']
              ] as const).map(([id, label]) => (
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

          {/* ── TAB 1: BY PILLAR OR COMPLIANCE FRAMEWORKS (FINOPS LENS) ── */}
          {tab === 'pillar' && selectedLens === 'finops' && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-bold" style={{ color: T.text }}>Compliance Frameworks & Standards</h2>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-bold border border-emerald-500/20">
                    {complianceFrameworks.length} Frameworks Active
                  </span>
                </div>
                <p className="text-xs" style={{ color: T.textSub }}>
                  FinOps Lens maps Well-Architected controls to regulatory standards across multi-cloud infrastructure. Click any card for detailed audit checklists.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {complianceFrameworks.map(fw => (
                  <ComplianceFrameworkReportCard
                    key={fw.id}
                    fw={fw}
                    T={T}
                    isDark={isDark}
                    isPinned={Boolean(pinnedComplianceIds?.[fw.id])}
                    onTogglePin={() => togglePinComplianceFramework(fw.id)}
                    onSelect={() => setActiveComplianceModal(fw)}
                  />
                ))}
              </div>
            </div>
          )}

          {tab === 'pillar' && selectedLens !== 'finops' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activePillars.map(p => {
                const pScore = (currentAssessment?.pillars as Record<string, number> | undefined)?.[p.id] ?? p.score;
                return (
                  <PillarCard
                    key={p.id}
                    p={{ ...p, score: pScore }}
                    T={T}
                    isDark={isDark}
                    onSelect={(id) => selectPillar(id)}
                  />
                );
              })}
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
                        {filteredChecks.filter(c => c?.status === 'fail').length} Failed
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        {filteredChecks.filter(c => c?.status === 'pass').length} Passed
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
                      gridTemplateColumns: '80px 130px 80px 1fr 85px 85px 230px',
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
                    <span className="text-right">Actions & Integrations</span>
                  </div>

                  {filteredChecks.map((c) => {
                    const isFail = c?.status === 'fail';

                    return (
                      <div
                        key={c.id}
                        className="grid items-center px-4 py-3 transition-colors"
                        style={{
                          gridTemplateColumns: '80px 130px 80px 1fr 85px 85px 230px',
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
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isFail ? (
                            <>
                              {/* Slack Alert button */}
                              <button
                                type="button"
                                onClick={() =>
                                  setSlackModalTarget({
                                    title: `[${c.severity.toUpperCase()} HRI] ${c.title}`,
                                    message: `${c.description}. Pillar: ${c.pillarLabel}, Check ID: ${c.id}. Requires immediate architectural review.`,
                                    severity: c.severity === 'critical' ? 'critical' : 'high',
                                    checkId: c.id,
                                  })
                                }
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer text-[#4A154B] dark:text-[#ECB22E]"
                                style={{
                                  borderColor: isDark ? 'rgba(236,178,46,0.3)' : 'rgba(74,21,75,0.2)',
                                  backgroundColor: isDark ? 'rgba(74,21,75,0.2)' : '#FDF4FF',
                                }}
                                title="Post alert to Slack channel"
                              >
                                <SlackLogo size={11} />
                                <span>Slack</span>
                              </button>

                              {/* Jira Ticket button / Linked badge */}
                              {jiraTickets[c.id] ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setJiraModalTarget({
                                      checkId: c.id,
                                      title: c.title,
                                      severity: c.severity,
                                      description: c.description,
                                    })
                                  }
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg transition-colors cursor-pointer text-[#0052CC] dark:text-[#388BFF]"
                                  style={{
                                    borderColor: isDark ? 'rgba(56,139,255,0.3)' : 'rgba(0,82,204,0.2)',
                                    backgroundColor: isDark ? 'rgba(0,82,204,0.15)' : '#EFF6FF',
                                    border: '1px solid',
                                  }}
                                  title={`Jira ticket ${jiraTickets[c.id].key} is ${jiraTickets[c.id].status}. Click to view/edit.`}
                                >
                                  <JiraLogo size={11} />
                                  <span>{jiraTickets[c.id].key}</span>
                                  <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-blue-500/20">
                                    {jiraTickets[c.id].status}
                                  </span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setJiraModalTarget({
                                      checkId: c.id,
                                      title: c.title,
                                      severity: c.severity,
                                      description: c.description,
                                    })
                                  }
                                  className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer text-[#0052CC] dark:text-[#388BFF]"
                                  style={{
                                    borderColor: isDark ? 'rgba(56,139,255,0.3)' : 'rgba(0,82,204,0.2)',
                                    backgroundColor: isDark ? 'rgba(0,82,204,0.15)' : '#EFF6FF',
                                  }}
                                  title="Create and link Jira ticket for this finding"
                                >
                                  <JiraLogo size={11} />
                                  <span>+ Jira</span>
                                </button>
                              )}

                              {/* AI Fix button */}
                              <button
                                type="button"
                                onClick={() => goToAIFix(c.id)}
                                className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full hover:opacity-90 transition-opacity cursor-pointer text-white shadow-xs"
                                style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                              >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                                </svg>
                                <span>Fix</span>
                              </button>
                            </>
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

      {/* Ignored Excluded Findings Popup Modal */}
      {showCantFixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl rounded-2xl border p-6 shadow-2xl flex flex-col gap-4 max-h-[85vh] overflow-hidden"
            style={{
              backgroundColor: isDark ? '#0F172A' : '#FFFFFF',
              borderColor: isDark ? '#334155' : '#E2E8F0',
              color: T.text,
            }}
          >
            <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-2.5">
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-bold text-sm">
                  !
                </span>
                <div>
                  <h3 className="font-bold text-base" style={{ color: T.text }}>
                    Excluded Findings (Ignored)
                  </h3>
                  <p className="text-xs" style={{ color: T.textSub }}>
                    Waivered checks and resources with documented code/architecture dependency notes
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowCantFixModal(false)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold border transition-colors cursor-pointer"
                style={{ borderColor: T.border, color: T.textSub }}
              >
                ✕
              </button>
            </div>

            <div className="overflow-y-auto flex flex-col gap-3 pr-1">
              {excludedResourcesList.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center gap-2" style={{ color: T.textSub }}>
                  <div className="w-10 h-10 rounded-full bg-slate-500/10 flex items-center justify-center text-slate-400">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </div>
                  <p className="text-xs font-medium">No resources have been marked as "Ignored" yet.</p>
                  <p className="text-[11px] opacity-70">Mark resources as "Ignored" in AI Remediation with a reason note to view them here.</p>
                </div>
              ) : (
                excludedResourcesList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border flex flex-col gap-2"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#F8FAFC',
                      borderColor: isDark ? 'rgba(245,158,11,0.25)' : '#FCD34D',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-amber-600 dark:text-amber-400">{item.checkId}</span>
                        <SeverityPill severity={item.severity as any} dark={isDark} />
                        <span className="text-xs font-semibold" style={{ color: T.text }}>{item.checkTitle}</span>
                      </div>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        Excluded on Rerun
                      </span>
                    </div>
                    <div className="font-mono text-[11px] px-2.5 py-1.5 rounded-lg border bg-black/20 text-slate-400 truncate" style={{ borderColor: T.border }}>
                      Resource: {item.resource}
                    </div>
                    <div className="text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20">
                      <span className="font-bold">Reason / Constraint Note:</span> {item.note}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-3 border-t flex items-center justify-between text-xs" style={{ borderColor: T.border }}>
              <span style={{ color: T.textSub }}>Total Excluded: <strong>{excludedResourcesList.length}</strong> resources</span>
              <button
                type="button"
                onClick={() => setShowCantFixModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-white cursor-pointer"
                style={{ backgroundColor: T.primary }}
              >
                Close Modal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Schedule Assessment Modal */}
      <ScheduleAssessmentModal
        isOpen={showScheduleModal}
        onClose={() => setShowScheduleModal(false)}
        isAssessmentRerun={true}
        assessmentId={currentAssessment?.id}
        initialCloud={currentAssessment?.cloud}
        initialAccountId={currentAssessment?.accountId}
        initialAccountName={currentAssessment?.accountName}
        initialRegion={currentAssessment?.region}
        initialName={currentAssessment?.name || 'Production Architecture Review'}
        onSuccess={() => {
          setShowScheduleModal(false);
        }}
      />

      {/* Linked Jira Ticket Modal */}
      {jiraModalTarget && (
        <JiraTicketModal
          isOpen={true}
          onClose={() => setJiraModalTarget(null)}
          checkId={jiraModalTarget.checkId}
          checkTitle={jiraModalTarget.title}
          severity={jiraModalTarget.severity}
          checkDescription={jiraModalTarget.description}
          existingTicket={jiraTickets[jiraModalTarget.checkId]}
        />
      )}

      {/* Slack Alert Modal */}
      {slackModalTarget && (
        <SlackAlertModal
          isOpen={true}
          onClose={() => setSlackModalTarget(null)}
          initialTitle={slackModalTarget.title}
          initialMessage={slackModalTarget.message}
          initialSeverity={slackModalTarget.severity}
          checkId={slackModalTarget.checkId}
        />
      )}

      {/* Compliance Framework Detail Modal */}
      {activeComplianceModal && (
        <ComplianceFrameworkDetailModal
          fw={activeComplianceModal}
          isOpen={true}
          onClose={() => setActiveComplianceModal(null)}
          T={T}
          isDark={isDark}
          onTriggerSlack={(target) => setSlackModalTarget(target)}
          onTriggerJira={(target) => setJiraModalTarget(target)}
          onGoToAIFix={(checkId) => goToAIFix(checkId)}
        />
      )}
    </AppLayout>
  );
}
