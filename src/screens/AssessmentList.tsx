import { useState, useEffect } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { StatusPill } from '../components/StatusPill';
import { CloudChip } from '../components/CloudLogo';
import { SlackLogo, GChatLogo, JiraLogo } from '../components/IntegrationLogos';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { ScheduledAssessment } from '../data/scheduleData';
import { AssessmentInfo } from '../data/assessmentData';

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#64748B',
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  success: '#059669',
  successBg: '#ECFDF5',
  successBar: '#10B981',
  error: '#E11D48',
  errorBg: '#FFF1F2',
  errorBar: '#FB7185',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBar: '#FBBF24',
  muted: '#94A3B8',
  progress: '#10B981',
  activeNavBg: '#EFF6FF',
  shadow: '0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)',
};
const DARK = {
  bg: '#0B1220',
  card: '#111B2E',
  border: '#1E293B',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,.15)',
  success: '#52B788',
  successBg: 'rgba(82,183,136,.12)',
  successBar: 'rgba(82,183,136,.75)',
  error: '#FB7185',
  errorBg: 'rgba(251,113,133,.12)',
  errorBar: 'rgba(251,113,133,.65)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,.12)',
  warningBar: 'rgba(251,191,36,.65)',
  muted: '#94A3B8',
  progress: '#52B788',
  activeNavBg: 'rgba(59,130,246,.12)',
  shadow: '0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)',
};

export function AssessmentList() {
  const {
    go,
    cloud,
    accent,
    cloudShort,
    theme,
    assessments,
    selectAssessment,
    runOrUpdateAssessment,
    deleteAssessment,
    scheduledAssessments,
    toggleScheduleStatus,
    deleteScheduledAssessment,
    runScheduledAssessmentNow,
    selectedLens,
    setSelectedLens,
    refreshFromDb,
  } = useApp();

  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  useEffect(() => {
    refreshFromDb();
  }, []);

  const [activeTab, setActiveTab] = useState<'runs' | 'schedules'>('runs');
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('lastRun');

  // Schedule modal state
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<ScheduledAssessment | null>(null);
  const [scheduleForAssessment, setScheduleForAssessment] = useState<AssessmentInfo | null>(null);

  const ScoreBar = ({ score }: { score: number }) => {
    if (score === 0) return <span style={{ color: T.muted, fontSize: '12px' }}>—</span>;
    const color = score >= 80 ? T.success : score >= 65 ? T.warning : T.error;
    return (
      <div className="flex items-center gap-2 min-w-[80px]">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.border }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs font-medium tabular-nums" style={{ color }}>
          {score}%
        </span>
      </div>
    );
  };

  const runsByCloud = assessments.filter(a => !cloud || (a.cloud || '').toLowerCase() === cloud.toLowerCase());
  const schedulesByCloud = scheduledAssessments.filter(s => !cloud || (s.cloud || '').toLowerCase() === cloud.toLowerCase());

  const filteredRuns = runsByCloud.filter(a => {
    const matchSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName.toLowerCase().includes(search.toLowerCase()) ||
      a.accountId.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const filteredSchedules = schedulesByCloud.filter(s => {
    const matchSearch =
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.accountName.toLowerCase().includes(search.toLowerCase()) ||
      s.accountId.toLowerCase().includes(search.toLowerCase()) ||
      s.region.toLowerCase().includes(search.toLowerCase()) ||
      s.frequency.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const activeSchedulesCount = schedulesByCloud.filter(s => s.status === 'active').length;

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ backgroundColor: T.bg, minHeight: '100%' }}>
        {/* Page header */}
        <div className="px-6 py-4" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button
                onClick={() => go('dashboard')}
                className="hover:underline transition-colors cursor-pointer"
                style={{ color: T.primary }}
              >
                Home
              </button>
              <span>/</span>
              {cloudShort && (
                <>
                  <span style={{ color: accent }} className="font-medium">
                    {cloudShort}
                  </span>
                  <span>/</span>
                </>
              )}
              <span style={{ color: T.text }}>Assessments</span>
            </nav>

            <button
              onClick={() => go('dashboard')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer"
              style={{ borderColor: T.border, color: T.textSub }}
            >
              ← Back to Home
            </button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-semibold text-xl" style={{ color: T.text }}>
                Assessments & Schedules
              </h1>
              <p className="text-sm mt-0.5" style={{ color: T.textSub }}>
                Continuous architectural review scans, historical runs, and automated schedules
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Lens Selector Dropdown */}
              <div
                className="flex items-center gap-2 px-3 py-2 rounded-full border text-xs shadow-xs"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center gap-1.5 font-bold" style={{ color: selectedLens === 'finops' ? '#10B981' : selectedLens === 'genai' ? '#8B5CF6' : '#2563EB' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="4" />
                  </svg>
                  <span>Lens:</span>
                </div>
                <select
                  value={selectedLens}
                  onChange={e => setSelectedLens(e.target.value as any)}
                  className="bg-transparent font-bold text-xs outline-none cursor-pointer pr-1"
                  style={{ color: T.text }}
                  aria-label="Select Architecture Lens"
                >
                  <option value="wafr" style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', color: T.text }}>WAFR Lens (Well-Architected)</option>
                  <option value="finops" style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', color: T.text }}>FinOps Lens (Compliance & Cost)</option>
                  <option value="genai" style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', color: T.text }}>GenAI Lens (Generative AI)</option>
                </select>
              </div>

              {/* Schedule Assessment Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingSchedule(null);
                  setIsScheduleModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-semibold border transition-all hover:border-blue-500 cursor-pointer shadow-xs"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderColor: T.border,
                  color: T.text,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Schedule Assessment</span>
              </button>

              {/* Start Immediate Assessment Button */}
              <button
                type="button"
                onClick={() => go('org-questions')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)', color: '#FFFFFF', boxShadow: T.shadow }}
              >
                <span>+ New Assessment</span>
              </button>
            </div>
          </div>

          {/* Primary View Switcher Tabs */}
          <div className="flex items-center gap-2 mt-5 border-b -mb-4 pb-0" style={{ borderColor: T.border }}>
            <button
              type="button"
              onClick={() => setActiveTab('runs')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'runs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>All Assessment Runs</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px]"
                style={{
                  backgroundColor: activeTab === 'runs' ? (isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  color: activeTab === 'runs' ? '#2563EB' : T.textSub,
                }}
              >
                {runsByCloud.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('schedules')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'schedules'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              <span>Scheduled Reviews</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: activeTab === 'schedules' ? (isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  color: activeTab === 'schedules' ? '#2563EB' : T.textSub,
                }}
              >
                {schedulesByCloud.length} ({activeSchedulesCount} active)
              </span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* TAB 1: ALL ASSESSMENT RUNS */}
          {activeTab === 'runs' && (
            <>
              {/* Filters bar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-xs">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2"
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
                    placeholder="Search by name, account ID, region…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none transition-colors"
                    style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#2563EB';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm focus:outline-none cursor-pointer"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <option value="all">All Statuses</option>
                  <option value="complete">Complete</option>
                  <option value="running">Running</option>
                  <option value="warning">Warning</option>
                  <option value="fail">Fail</option>
                  <option value="draft">Draft</option>
                </select>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm focus:outline-none cursor-pointer"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <option value="lastRun">Sort: Last Run</option>
                  <option value="score">Sort: Score</option>
                  <option value="name">Sort: Name</option>
                </select>
                <div className="ml-auto flex items-center gap-1 text-xs" style={{ color: T.textSub }}>
                  <span>
                    {filteredRuns.length} of {assessments.length} results
                  </span>
                </div>
              </div>

              {/* Table */}
              <div
                className="overflow-hidden"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
              >
                {/* Table header */}
                <div
                  className="grid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    gridTemplateColumns: '1.4fr 1.3fr 110px 100px 110px 100px 90px',
                    backgroundColor: isDark ? 'rgba(0,0,0,.15)' : '#F8FAFC',
                    borderBottom: `1px solid ${T.border}`,
                    color: T.textSub,
                  }}
                >
                  <span>Assessment</span>
                  <span>Account & Account ID</span>
                  <span>Region</span>
                  <span>Status</span>
                  <span>Score</span>
                  <span>Last Run</span>
                  <span className="text-right">Actions</span>
                </div>

                {/* Rows */}
                {filteredRuns.map(a => (
                  <div
                    key={a.id}
                    className="grid items-center px-4 py-3 cursor-pointer transition-colors"
                    style={{ gridTemplateColumns: '1.4fr 1.3fr 110px 100px 110px 100px 90px', borderBottom: `1px solid ${T.border}` }}
                    onClick={() => selectAssessment(a.id, 'report')}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.02)' : '#F8FAFC')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {/* Name */}
                    <div className="pr-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                          style={{
                            color: T.textSub,
                            backgroundColor: isDark ? 'rgba(0,0,0,.3)' : '#F8FAFC',
                            border: `1px solid ${T.border}`,
                          }}
                        >
                          {a.id}
                        </span>
                        <span className="text-sm font-medium" style={{ color: T.text }}>
                          {a.name}
                        </span>
                        {a.rerunCount && a.rerunCount > 1 ? (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                            Rerun #{a.rerunCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>
                        1 account · 1 region review
                      </div>
                    </div>

                    {/* Account Name & Account ID */}
                    <div className="pr-3">
                      <div className="text-xs font-semibold" style={{ color: T.text }}>
                        {a.accountName}
                      </div>
                      <div className="mt-1">
                        <span
                          className="inline-block text-[11px] font-mono px-2 py-0.5 rounded"
                          style={{
                            backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                            color: isDark ? '#93C5FD' : '#2563EB',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#E2E8F0'}`,
                          }}
                        >
                          ID: {a.accountId}
                        </span>
                      </div>
                    </div>

                    {/* Single Region */}
                    <div className="pr-2">
                      <span className="inline-block text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-500/10 text-gray-700 dark:text-gray-300">
                        {a.region}
                      </span>
                    </div>

                    {/* Status */}
                    <div onClick={e => e.stopPropagation()}>
                      <StatusPill status={a.status} dark={isDark} />
                    </div>

                    {/* Score */}
                    <ScoreBar score={a.score} />

                    {/* Last run */}
                    <span className="text-xs font-mono" style={{ color: T.textSub }}>
                      {a.lastRun}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => selectAssessment(a.id, 'report')}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer"
                        style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                        onMouseEnter={e => {
                          e.currentTarget.style.color = T.primary;
                          e.currentTarget.style.borderColor = '#2563EB';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.color = T.textSub;
                          e.currentTarget.style.borderColor = T.border;
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => {
                          runOrUpdateAssessment({
                            cloud: a.cloud,
                            accountId: a.accountId,
                            accountName: a.accountName,
                            region: a.region,
                            name: a.name,
                          });
                          go('live-scan');
                        }}
                        className="px-2.5 py-1 text-[11px] font-semibold rounded-full transition-colors cursor-pointer"
                        style={{ border: `1px solid ${T.border}`, color: T.primary, backgroundColor: T.primaryBg }}
                        title="Rerun assessment for this configuration"
                      >
                        Re-run
                      </button>
                      <button
                        onClick={() => {
                          setEditingSchedule(null);
                          setScheduleForAssessment(a);
                          setIsScheduleModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer flex items-center gap-1"
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
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                        <span>Schedule</span>
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Are you sure you want to delete "${a.name}"? This will remove it from MongoDB.`)) {
                            deleteAssessment(a.id);
                          }
                        }}
                        className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer flex items-center gap-1 text-rose-500 hover:text-rose-600 hover:border-rose-400"
                        style={{ border: `1px solid ${isDark ? 'rgba(244,63,94,0.3)' : '#FECDD3'}`, backgroundColor: isDark ? 'rgba(244,63,94,0.1)' : '#FFF1F2' }}
                        title="Delete this assessment from database"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))}

                {filteredRuns.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF', color: T.primary }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </div>
                    <div className="font-semibold text-sm" style={{ color: T.text }}>
                      {assessments.length === 0 ? 'No assessments yet' : 'No assessments match your search'}
                    </div>
                    <div className="text-xs max-w-sm" style={{ color: T.textSub }}>
                      {assessments.length === 0
                        ? 'Start your first Well-Architected Framework review to discover security, reliability, and cost findings.'
                        : 'Try adjusting your search query or clear your active status filter.'}
                    </div>
                    {assessments.length === 0 && (
                      <button
                        type="button"
                        onClick={() => go('org-questions')}
                        className="mt-2 px-5 py-2 rounded-full text-xs font-bold text-white shadow-sm cursor-pointer hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)' }}
                      >
                        + Start First Assessment
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between mt-3 text-xs" style={{ color: T.textSub }}>
                <span>
                  Showing {filteredRuns.length} of {assessments.length} assessments
                </span>
                <div className="flex items-center gap-1">
                  <button
                    className="px-2.5 py-1 rounded-full transition-colors"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = T.border;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    ← Prev
                  </button>
                  <button
                    className="px-2.5 py-1 rounded-full font-medium"
                    style={{ border: `1px solid ${T.border}`, backgroundColor: T.primaryBg, color: T.primary }}
                  >
                    1
                  </button>
                  <button
                    className="px-2.5 py-1 rounded-full transition-colors"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = T.border;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </>
          )}

          {/* TAB 2: SCHEDULED ASSESSMENTS */}
          {activeTab === 'schedules' && (
            <>
              {/* Schedules Filters & Search */}
              <div className="flex items-center gap-3 mb-4">
                <div className="relative flex-1 max-w-xs">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2"
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
                    placeholder="Search schedules by name, frequency, account…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none transition-colors"
                    style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                    onFocus={e => {
                      e.currentTarget.style.borderColor = '#2563EB';
                      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)';
                    }}
                    onBlur={e => {
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>

                <select
                  value={filterStatus}
                  onChange={e => setFilterStatus(e.target.value)}
                  className="rounded-xl px-3 py-2 text-sm focus:outline-none cursor-pointer"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Schedules</option>
                  <option value="paused">Paused</option>
                </select>

                <div className="ml-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingSchedule(null);
                      setIsScheduleModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white shadow-xs cursor-pointer hover:opacity-95"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #22C55E)' }}
                  >
                    <span>+ New Schedule</span>
                  </button>
                </div>
              </div>

              {/* Schedules Table */}
              <div
                className="overflow-hidden"
                style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}
              >
                {/* Table Header */}
                <div
                  className="grid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
                  style={{
                    gridTemplateColumns: '1.5fr 1.2fr 130px 150px 100px 90px 110px',
                    backgroundColor: isDark ? 'rgba(0,0,0,.15)' : '#F8FAFC',
                    borderBottom: `1px solid ${T.border}`,
                    color: T.textSub,
                  }}
                >
                  <span>Schedule Name</span>
                  <span>Target Account & Cloud</span>
                  <span>Recurrence</span>
                  <span>Next Execution</span>
                  <span>Notifications</span>
                  <span>Status</span>
                  <span className="text-right">Actions</span>
                </div>

                {/* Schedule Rows */}
                {filteredSchedules.map(s => {
                  const isActive = s.status === 'active';
                  return (
                    <div
                      key={s.id}
                      className="grid items-center px-4 py-3.5 transition-colors"
                      style={{
                        gridTemplateColumns: '1.5fr 1.2fr 130px 150px 100px 90px 110px',
                        borderBottom: `1px solid ${T.border}`,
                      }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.02)' : '#F8FAFC')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Name & ID */}
                      <div className="pr-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                            style={{
                              color: T.textSub,
                              backgroundColor: isDark ? 'rgba(0,0,0,.3)' : '#F8FAFC',
                              border: `1px solid ${T.border}`,
                            }}
                          >
                            {s.id}
                          </span>
                          <span className="text-sm font-semibold truncate" style={{ color: T.text }}>
                            {s.name}
                          </span>
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
                          Created: {s.createdAt} · Last run: {s.lastRun || 'Never'}
                        </div>
                      </div>

                      {/* Target Account & Cloud */}
                      <div className="pr-3">
                        <div className="flex items-center gap-2">
                          <CloudChip id={s.cloud} size="xs" isDark={isDark} />
                          <span className="text-xs font-semibold truncate" style={{ color: T.text }}>
                            {s.accountName}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono mt-0.5" style={{ color: T.textSub }}>
                          {s.accountId} · {s.region}
                        </div>
                      </div>

                      {/* Recurrence Frequency */}
                      <div className="pr-2">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold capitalize bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                          </svg>
                          {s.frequency}
                        </span>
                        <div className="text-[11px] font-mono mt-1" style={{ color: T.textSub }}>
                          {s.time}
                        </div>
                      </div>

                      {/* Next Execution */}
                      <div className="pr-2">
                        <div className="text-xs font-medium" style={{ color: isActive ? T.text : T.textSub }}>
                          {s.nextRun}
                        </div>
                        {isActive && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                            ● Auto-trigger enabled
                          </div>
                        )}
                      </div>

                      {/* Notifications Badges */}
                      <div className="flex items-center gap-1.5">
                        {s.notifySlack && (
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center p-1 bg-emerald-500/10 border border-emerald-500/20"
                            title={`Slack alerts: ${s.slackWebhook || 'Configured webhook'}`}
                          >
                            <SlackLogo className="w-full h-full" />
                          </span>
                        )}
                        {s.notifyGChat && (
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center p-1 bg-blue-500/10 border border-blue-500/20"
                            title={`Google Chat alerts: ${s.gchatWebhook || 'Configured webhook'}`}
                          >
                            <GChatLogo className="w-full h-full" />
                          </span>
                        )}
                        {s.notifyJira && (
                          <span
                            className="w-6 h-6 rounded-lg flex items-center justify-center p-1 bg-blue-500/10 border border-blue-500/20"
                            title="Jira: Auto-create tickets for Critical & High risk findings"
                          >
                            <JiraLogo className="w-full h-full" />
                          </span>
                        )}
                        {!s.notifySlack && !s.notifyGChat && !s.notifyJira && (
                          <span className="text-xs" style={{ color: T.muted }}>
                            —
                          </span>
                        )}
                      </div>

                      {/* Status Toggle / Badge */}
                      <div>
                        <button
                          type="button"
                          onClick={() => toggleScheduleStatus(s.id)}
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20'
                              : 'bg-gray-500/10 text-gray-500 border border-gray-500/20 hover:bg-gray-500/20'
                          }`}
                          title={`Click to ${isActive ? 'pause' : 'activate'} schedule`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          <span>{isActive ? 'Active' : 'Paused'}</span>
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => runScheduledAssessmentNow(s.id)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-full transition-colors cursor-pointer"
                          style={{
                            backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF',
                            color: '#2563EB',
                            border: '1px solid rgba(37,99,235,0.3)',
                          }}
                          title="Trigger assessment now immediately"
                        >
                          Run Now
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSchedule(s);
                            setIsScheduleModalOpen(true);
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer border hover:text-blue-500 hover:border-blue-500/30"
                          style={{ borderColor: T.border, color: T.textSub }}
                          title="Edit Schedule"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Are you sure you want to delete schedule "${s.name}"?`)) {
                              deleteScheduledAssessment(s.id);
                            }
                          }}
                          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors cursor-pointer text-rose-500 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20"
                          title="Delete Schedule"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  );
                })}

                {filteredSchedules.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF', color: T.primary }}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>
                    <div className="font-semibold text-sm" style={{ color: T.text }}>
                      {scheduledAssessments.length === 0 ? 'No recurring schedules configured' : 'No schedules match your search'}
                    </div>
                    <div className="text-xs max-w-sm" style={{ color: T.textSub }}>
                      {scheduledAssessments.length === 0
                        ? 'Set up automatic weekly, monthly, or daily assessments to continuously audit your cloud workloads.'
                        : 'Try adjusting your search query or clear status filters.'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSchedule(null);
                        setIsScheduleModalOpen(true);
                      }}
                      className="mt-2 px-5 py-2 rounded-full text-xs font-bold text-white shadow-sm cursor-pointer hover:opacity-90"
                      style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)' }}
                    >
                      + Create First Schedule
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Schedule Assessment Modal */}
      <ScheduleAssessmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setEditingSchedule(null);
          setScheduleForAssessment(null);
        }}
        isAssessmentRerun={Boolean(scheduleForAssessment)}
        assessmentId={scheduleForAssessment?.id}
        initialCloud={scheduleForAssessment?.cloud || cloud || undefined}
        initialAccountId={scheduleForAssessment?.accountId}
        initialAccountName={scheduleForAssessment?.accountName}
        initialRegion={scheduleForAssessment?.region}
        initialName={scheduleForAssessment?.name}
        editingSchedule={editingSchedule}
        onSuccess={() => {
          setIsScheduleModalOpen(false);
          setEditingSchedule(null);
          setScheduleForAssessment(null);
          setActiveTab('schedules');
        }}
      />
    </AppLayout>
  );
}
