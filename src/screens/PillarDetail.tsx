import { useState, useEffect } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { SeverityPill } from '../components/FindingUI';
import { PILLARS_DATA, BestPractice, PillarData } from '../data/wafrData';

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

function PillarScoreGauge({ score, color, T }: { score: number; color: string; T: typeof LIGHT }) {
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setAnimatedScore(Math.round(easeOut * score));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [score]);

  const r = 44;
  const circ = 2 * Math.PI * r;
  const progress = (animatedScore / 100) * circ * 0.75;
  const offset = circ * 0.25;

  return (
    <svg width="115" height="90" viewBox="0 0 120 95">
      <circle
        cx="60"
        cy="70"
        r={r}
        fill="none"
        stroke={T.border}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
        strokeDashoffset={-offset}
      />
      <circle
        cx="60"
        cy="70"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="9"
        strokeLinecap="round"
        strokeDasharray={`${progress} ${circ - progress}`}
        strokeDashoffset={-offset}
      />
      <text x="60" y="65" textAnchor="middle" fill={T.text} fontSize="22" fontWeight="700" fontFamily="Inter">{animatedScore}%</text>
      <text x="60" y="79" textAnchor="middle" fill={T.textSub} fontSize="10" fontFamily="Inter">Score</text>
    </svg>
  );
}

export function PillarDetail() {
  const { go, theme, selectedPillarId, setSelectedPillarId, goToAIFix, currentMilestones, currentAssessment } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const currentPillar: PillarData =
    PILLARS_DATA.find(p => p.id === selectedPillarId) || PILLARS_DATA[0];

  const [bpFilter, setBpFilter] = useState<'all' | 'fail' | 'pass'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedBps, setExpandedBps] = useState<Record<string, boolean>>({});

  const totalBps = currentPillar.bestPractices.length;
  const failedBps = currentPillar.bestPractices.filter(bp => bp.status === 'fail').length;
  const passedBps = totalBps - failedBps;
  const allChecksInPillar = currentPillar.bestPractices.flatMap(bp => bp.checks);
  const totalChecks = allChecksInPillar.length;
  const failedChecksCount = allChecksInPillar.filter(c => c.status === 'fail').length;
  const passedChecksCount = totalChecks - failedChecksCount;

  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedTotalBps, setAnimatedTotalBps] = useState(0);
  const [animatedPassedBps, setAnimatedPassedBps] = useState(0);
  const [animatedFailedBps, setAnimatedFailedBps] = useState(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const duration = 1200;
    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setAnimatedScore(Math.round(easeOut * currentPillar.score));
      setAnimatedTotalBps(Math.round(easeOut * totalBps));
      setAnimatedPassedBps(Math.round(easeOut * passedBps));
      setAnimatedFailedBps(Math.round(easeOut * failedBps));

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [currentPillar.id, currentPillar.score, totalBps, passedBps, failedBps]);

  const toggleBp = (bpId: string) => {
    setExpandedBps(prev => ({
      ...prev,
      [bpId]: !prev[bpId],
    }));
  };

  const expandAll = (bps: BestPractice[]) => {
    const next: Record<string, boolean> = { ...expandedBps };
    bps.forEach(bp => {
      next[bp.id] = true;
    });
    setExpandedBps(next);
  };

  const collapseAll = (bps: BestPractice[]) => {
    const next: Record<string, boolean> = { ...expandedBps };
    bps.forEach(bp => {
      next[bp.id] = false;
    });
    setExpandedBps(next);
  };

  const filteredBps = currentPillar.bestPractices.filter(bp => {
    if (bpFilter === 'fail' && bp.status !== 'fail') return false;
    if (bpFilter === 'pass' && bp.status !== 'pass') return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchBp = bp.id.toLowerCase().includes(q) || bp.title.toLowerCase().includes(q) || bp.description.toLowerCase().includes(q);
      const matchCheck = bp.checks.some(c => c.id.toLowerCase().includes(q) || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
      return matchBp || matchCheck;
    }
    return true;
  });

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ backgroundColor: T.bg, minHeight: '100%' }}>
        {/* Page Header */}
        <div className="px-6 py-4" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          {/* Breadcrumbs */}
          <div className="flex items-center justify-between mb-2">
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button onClick={() => go('dashboard')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.primary }}>Home</button>
              <span>/</span>
              <button onClick={() => go('assessment-list')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.textSub }}>Assessments</button>
              <span>/</span>
              <button onClick={() => go('report')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.primary }}>Review Findings</button>
              <span>/</span>
              <span style={{ color: T.text }} className="font-semibold">{currentPillar.label} Pillar</span>
            </nav>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 mt-2">
            <div className="flex items-center gap-3.5">
              <div
                className="w-11 h-11 rounded-2xl flex items-center justify-center text-lg font-bold shadow-sm"
                style={{ backgroundColor: currentPillar.color + '20', color: currentPillar.color }}
              >
                {currentPillar.short}
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="font-bold text-xl" style={{ color: T.text }}>
                    {currentPillar.label} Pillar Findings
                  </h1>
                  <span
                    className="text-xs font-semibold px-2.5 py-0.5 rounded-full"
                    style={{
                      backgroundColor: currentPillar.score >= 80 ? (isDark ? 'rgba(52,211,153,.2)' : '#ECFDF5') : (isDark ? 'rgba(251,113,133,.2)' : '#FFF1F2'),
                      color: currentPillar.score >= 80 ? T.success : T.error,
                    }}
                  >
                    Score: {currentPillar.score}%
                  </span>
                </div>
                <div className="text-xs mt-1" style={{ color: T.textSub }}>
                  Detailed Best Practices & Technical Checks breakdown for <span className="font-medium" style={{ color: T.text }}>acme-production</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => go('milestones')}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border transition-colors cursor-pointer"
                style={{
                  borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
                  color: T.primary,
                  backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
                }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                  <line x1="4" y1="22" x2="4" y2="15"/>
                </svg>
                <span>Milestones ({currentMilestones.length})</span>
              </button>
            </div>
          </div>

          {/* Quick Switcher for all 5 Pillars */}
          <div className="flex items-center gap-2 mt-4 pt-3 border-t overflow-x-auto pb-1" style={{ borderColor: T.border }}>
            <span className="text-xs font-semibold uppercase tracking-wider shrink-0 mr-1" style={{ color: T.textSub }}>
              Pillars:
            </span>
            {PILLARS_DATA.map(p => {
              const active = p.id === currentPillar.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedPillarId(p.id);
                    setBpFilter('all');
                    setExpandedBps({});
                  }}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-xl border transition-all cursor-pointer whitespace-nowrap"
                  style={{
                    borderColor: active ? p.color : T.border,
                    backgroundColor: active ? (isDark ? 'rgba(59,130,246,0.15)' : '#EFF6FF') : 'transparent',
                    color: active ? (isDark ? '#93C5FD' : '#2563EB') : T.textSub,
                    boxShadow: active ? T.shadow : 'none',
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                  <span>{p.label}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}>
                    {p.score}%
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Container */}
        <div className="p-6 flex flex-col gap-5">
          {/* Pillar KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Score Card */}
            <div
              className="p-4 flex items-center justify-between"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
            >
              <div>
                <div className="text-xs font-semibold" style={{ color: T.textSub }}>Pillar Score</div>
                <div className="text-2xl font-bold mt-1 tabular-nums" style={{ color: currentPillar.color }}>{animatedScore}%</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
                  {currentPillar.score >= 80 ? 'Well-Architected' : 'Requires Improvements'}
                </div>
              </div>
              <PillarScoreGauge score={currentPillar.score} color={currentPillar.color} T={T} />
            </div>

            {/* Total Best Practices */}
            <div
              className="p-5 flex flex-col justify-between gap-1"
              style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold" style={{ color: T.textSub }}>Total Best Practices</span>
                <span className="p-2 rounded-xl" style={{ backgroundColor: T.primaryBg }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: T.text }}>{animatedTotalBps}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>{totalChecks} underlying checks</div>
              </div>
            </div>

            {/* BP Passed with info (i) */}
            <div
              className="p-5 flex flex-col justify-between gap-1"
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
                <span className="p-2 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(52,211,153,.15)' : '#ECFDF5' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: T.success }}>{animatedPassedBps}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>{passedChecksCount} checks passing</div>
              </div>
            </div>

            {/* BP Failed with info (i) */}
            <div
              className="p-5 flex flex-col justify-between gap-1"
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
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                  </svg>
                </span>
              </div>
              <div>
                <div className="text-3xl font-bold tabular-nums" style={{ color: T.error }}>{animatedFailedBps}</div>
                <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>{failedChecksCount} failing checks</div>
              </div>
            </div>
          </div>

          {/* Filter & Action Toolbar for Best Practices */}
          <div
            className="p-4 rounded-2xl flex items-center justify-between flex-wrap gap-3"
            style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow }}
          >
            {/* Filter pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold" style={{ color: T.textSub }}>Filter BPs:</span>
              <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : '#F1F5F9' }}>
                <button
                  onClick={() => setBpFilter('all')}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer"
                  style={{
                    backgroundColor: bpFilter === 'all' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                    color: bpFilter === 'all' ? T.text : T.textSub,
                    boxShadow: bpFilter === 'all' ? T.shadow : 'none',
                  }}
                >
                  All BPs ({totalBps})
                </button>
                <button
                  onClick={() => setBpFilter('fail')}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: bpFilter === 'fail' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                    color: bpFilter === 'fail' ? T.error : T.textSub,
                    boxShadow: bpFilter === 'fail' ? T.shadow : 'none',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.error }} />
                  <span>BP Failed ({failedBps})</span>
                </button>
                <button
                  onClick={() => setBpFilter('pass')}
                  className="px-3 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: bpFilter === 'pass' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                    color: bpFilter === 'pass' ? T.success : T.textSub,
                    boxShadow: bpFilter === 'pass' ? T.shadow : 'none',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: T.success }} />
                  <span>BP Passed ({passedBps})</span>
                </button>
              </div>
            </div>

            {/* Search + Expand / Collapse */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search BPs or checks…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 pl-8 text-xs rounded-xl border transition-colors outline-none w-52"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF',
                    borderColor: T.border,
                    color: T.text,
                  }}
                />
                <svg
                  className="absolute left-2.5 top-2.5"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={T.muted}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8"/>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
              </div>
            </div>
          </div>

          {/* ── BEST PRACTICES & CHECKS HIERARCHICAL LIST ─────────────────────── */}
          <div className="flex flex-col gap-3">
            {filteredBps.length === 0 ? (
              <div
                className="p-8 text-center rounded-2xl"
                style={{ background: T.card, border: `1px solid ${T.border}` }}
              >
                <p className="text-sm" style={{ color: T.textSub }}>No best practices found matching the current filters.</p>
              </div>
            ) : (
              filteredBps.map((bp) => {
                const isExpanded = !!expandedBps[bp.id];
                const failingChecks = bp.checks.filter(c => c.status === 'fail');
                const isFailed = bp.status === 'fail';

                return (
                  <div
                    key={bp.id}
                    className="overflow-hidden transition-all duration-200"
                    style={{
                      background: T.card,
                      border: `1px solid ${isFailed && isExpanded ? (isDark ? 'rgba(251,113,133,0.35)' : '#FECDD3') : T.border}`,
                      borderRadius: '1.25rem',
                      boxShadow: T.shadow,
                    }}
                  >
                    {/* Best Practice Row (Click to toggle Checks) */}
                    <div
                      onClick={() => toggleBp(bp.id)}
                      className="p-4 sm:p-5 flex items-start justify-between gap-4 cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isExpanded
                          ? (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC')
                          : 'transparent',
                      }}
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        {/* Chevron */}
                        <div
                          className="mt-1 w-6 h-6 rounded-lg flex items-center justify-center transition-transform shrink-0"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                            color: T.textSub,
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                          }}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6"/>
                          </svg>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span
                              className="text-xs font-mono font-bold px-2 py-0.5 rounded-md"
                              style={{
                                backgroundColor: isDark ? 'rgba(59,130,246,0.2)' : '#EFF6FF',
                                color: isDark ? '#93C5FD' : '#2563EB',
                                border: `1px solid ${isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE'}`,
                              }}
                            >
                              {bp.id}
                            </span>
                            <h3 className="text-sm font-semibold truncate" style={{ color: T.text }}>
                              {bp.title}
                            </h3>
                          </div>
                          <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                            {bp.description}
                          </p>
                        </div>
                      </div>

                      {/* Status Badge & Check Count */}
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right hidden sm:block">
                          <div className="text-xs font-medium" style={{ color: isFailed ? T.error : T.success }}>
                            {isFailed ? `${failingChecks.length} of ${bp.checks.length} checks failed` : `All ${bp.checks.length} checks passed`}
                          </div>
                          <div className="text-[10px]" style={{ color: T.textSub }}>
                            Click to {isExpanded ? 'collapse' : 'view'} checks
                          </div>
                        </div>

                        {isFailed ? (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: isDark ? 'rgba(251,113,133,0.15)' : '#FFF1F2',
                              color: isDark ? '#FECDD3' : '#E11D48',
                              border: `1px solid ${isDark ? 'rgba(251,113,133,0.3)' : '#FFE4E6'}`,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.error }} />
                            <span>BP Failed</span>
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: isDark ? 'rgba(52,211,153,0.15)' : '#ECFDF5',
                              color: isDark ? '#6EE7B7' : '#059669',
                              border: `1px solid ${isDark ? 'rgba(52,211,153,0.3)' : '#A7F3D0'}`,
                            }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: T.success }} />
                            <span>BP Passed</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* ── CHECKS ACCORDION CONTENT ───────────────────────────── */}
                    {isExpanded && (
                      <div
                        className="border-t p-4 sm:p-5 flex flex-col gap-3"
                        style={{
                          borderColor: T.border,
                          backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#FAFBFD',
                        }}
                      >
                        <div className="flex items-center justify-between text-xs font-semibold tracking-wide uppercase mb-1" style={{ color: T.textSub }}>
                          <div className="flex items-center gap-1.5">
                            <span>Checks for {bp.id}</span>
                            <span>({bp.checks.length} Total: {bp.checks.filter(c => c.status === 'pass').length} Passed, {failingChecks.length} Failed)</span>
                          </div>
                        </div>

                        <div className="flex flex-col gap-2.5">
                          {bp.checks.map((check) => {
                            const checkFailed = check.status === 'fail';

                            return (
                              <div
                                key={check.id}
                                className="p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all"
                                style={{
                                  backgroundColor: T.card,
                                  borderColor: checkFailed ? (isDark ? 'rgba(251,113,133,0.25)' : '#FECDD3') : T.border,
                                  boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                                }}
                              >
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                  {/* Icon */}
                                  <div className="mt-0.5 shrink-0">
                                    {checkFailed ? (
                                      <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: isDark ? 'rgba(251,113,133,0.2)' : '#FFE4E6', color: T.error }}
                                      >
                                        ✕
                                      </span>
                                    ) : (
                                      <span
                                        className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                                        style={{ backgroundColor: isDark ? 'rgba(52,211,153,0.2)' : '#D1FAE5', color: T.success }}
                                      >
                                        ✓
                                      </span>
                                    )}
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                                      <span className="text-[11px] font-mono font-medium" style={{ color: T.textSub }}>
                                        {check.id}
                                      </span>
                                      <SeverityPill severity={check.severity} dark={isDark} />
                                      <span className="text-xs font-semibold truncate" style={{ color: T.text }}>
                                        {check.title}
                                      </span>
                                    </div>
                                    <p className="text-[11px] leading-relaxed" style={{ color: T.textSub }}>
                                      {check.description}
                                    </p>
                                  </div>
                                </div>

                                {/* Action / Status */}
                                <div className="flex items-center gap-2.5 shrink-0">
                                  {checkFailed ? (
                                    <>
                                      {check.effort && (
                                        <span className="text-[11px] hidden sm:inline-block" style={{ color: T.textSub }}>
                                          Effort: <span className="font-medium" style={{ color: T.text }}>{check.effort}</span>
                                        </span>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => goToAIFix(check.id)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-full hover:opacity-90 transition-opacity cursor-pointer text-white shadow-sm"
                                        style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                                      >
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                                        </svg>
                                        <span>AI Fix</span>
                                      </button>
                                    </>
                                  ) : (
                                    <span
                                      className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                                      style={{
                                        backgroundColor: isDark ? 'rgba(82,183,136,0.12)' : '#ECFDF5',
                                        color: isDark ? '#74C69D' : '#059669',
                                      }}
                                    >
                                      Compliant
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
