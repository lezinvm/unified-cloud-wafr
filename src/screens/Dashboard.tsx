import { useState, useEffect } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { CloudChip, CloudId } from '../components/CloudLogo';
import { AccountCredentialsModal } from '../components/AccountCredentialsModal';
import { ScheduleAssessmentModal } from '../components/ScheduleAssessmentModal';
import { AssessmentInfo } from '../data/assessmentData';

/* ── Types & Theme Tokens ────────────────────────────────────────────────────── */

/* ── Data ────────────────────────────────────────────────────────────────────── */
const CLOUD_META: Record<CloudId, { label: string; accent: string }> = {
  aws:   { label: 'Amazon Web Services', accent: '#FF9900' },
  azure: { label: 'Microsoft Azure',     accent: '#0078D4' },
  gcp:   { label: 'Google Cloud',        accent: '#4285F4' },
};

interface CloudStatItem {
  id: CloudId;
  avg: number;
  pass: number;
  warn: number;
  fail: number;
  accounts: number;
  resources: string;
}

/* ── Sub-components ──────────────────────────────────────────────────────────── */

function StatCard({ value, label, color, T }: { value: string; label: string; color?: string; T: Tokens }) {
  return (
    <div className="flex flex-col gap-1.5 p-5"
      style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '1.25rem', boxShadow: T.shadow }}>
      <span className="text-[13px]" style={{ color: T.textSub }}>{label}</span>
      <span className="text-3xl font-semibold tabular-nums tracking-tight"
        style={{ color: color ?? T.text }}>{value}</span>
    </div>
  );
}

function ProviderCard({
  stat, active, onClick, T, isDark, accountsCount, disabled,
}: {
  stat: CloudStatItem;
  active: boolean;
  onClick: () => void;
  T: Tokens;
  isDark: boolean;
  accountsCount: number;
  disabled?: boolean;
}) {
  const meta = CLOUD_META[stat.id];

  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={`text-left flex items-center justify-between p-4 transition-all rounded-2xl ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
      style={{
        backgroundColor: T.card,
        border: active ? `2px solid ${meta.accent}` : `1px solid ${T.border}`,
        boxShadow: active ? `0 0 0 3px ${meta.accent}22, ${T.shadow}` : T.shadow,
      }}
      onMouseEnter={e => { if (!active && !disabled) e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,.08)'; }}
      onMouseLeave={e => { if (!active && !disabled) e.currentTarget.style.boxShadow = T.shadow; }}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        <CloudChip id={stat.id} size="sm" selected={active} isDark={isDark} />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate" style={{ color: T.text }}>{meta.label}</div>
          <div className="text-[11px] mt-0.5" style={{ color: T.textSub }}>
            {accountsCount} {accountsCount === 1 ? 'account' : 'accounts'}
          </div>
        </div>
      </div>

      {active && (
        <span
          className="text-[11px] font-semibold px-2.5 py-1 rounded-full shrink-0"
          style={{
            backgroundColor: `${meta.accent}15`,
            color: meta.accent,
            border: `1px solid ${meta.accent}33`,
          }}
        >
          Selected
        </span>
      )}
    </button>
  );
}

const STATUS_LIGHT: Record<AssessmentStatus, { bg: string; dot: string; text: string; label: string }> = {
  completed: { bg: '#ECFDF5', dot: '#10B981', text: '#059669', label: 'Completed' },
  running:   { bg: '#EFF6FF', dot: '#60A5FA', text: '#2563EB', label: 'Running'   },
  failed:    { bg: '#FFF1F2', dot: '#FB7185', text: '#E11D48', label: 'Failed'    },
};
const STATUS_DARK: Record<AssessmentStatus, { bg: string; dot: string; text: string; label: string }> = {
  completed: { bg: 'rgba(82,183,136,.12)',  dot: '#74C69D', text: '#74C69D', label: 'Completed' },
  running:   { bg: 'rgba(59,130,246,.12)',  dot: '#60A5FA', text: '#93C5FD', label: 'Running'   },
  failed:    { bg: 'rgba(251,113,133,.12)', dot: '#FB7185', text: '#FECDD3', label: 'Failed'    },
};

function StatusDot({ status, isDark }: { status: AssessmentStatus; isDark: boolean }) {
  const cfg = (isDark ? STATUS_DARK : STATUS_LIGHT)[status] ?? STATUS_LIGHT.completed;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={{ backgroundColor: cfg.bg, color: cfg.text }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: cfg.dot }} />
      {cfg.label}
    </span>
  );
}

/* ── Dashboard (Home) ────────────────────────────────────────────────────────── */
export function Dashboard() {
  const {
    go,
    selectCloud,
    selectAssessment,
    theme,
    isNewUser,
    setIsNewUser,
    configuredAccount,
    setConfiguredAccount,
    configuredAccounts,
    cloudAccounts,
    assessments,
    scheduledAssessments,
    runOrUpdateAssessment,
    deleteAssessment,
    dbConnected,
    refreshFromDb,
  } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [showCredsModal, setShowCredsModal] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleForAssessment, setScheduleForAssessment] = useState<AssessmentInfo | null>(null);
  const [cloudFilter, setCloudFilter] = useState<'all' | CloudId>('all');
  const [search, setSearch] = useState('');

  // Strictly synchronize live data from MongoDB on mount
  useEffect(() => {
    refreshFromDb();
  }, []);

  const activeAssessments = assessments;

  const filtered = activeAssessments.filter(a => {
    const matchCloud  = cloudFilter === 'all' || a.cloud === cloudFilter;
    const matchSearch = search === '' ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName.toLowerCase().includes(search.toLowerCase()) ||
      a.accountId.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase());
    return matchCloud && matchSearch;
  });

  // Account counts come SOLELY from cloudAccounts (the authoritative source).
  // Deriving a fallback count from assessments produced the "N accounts vs M
  // assessments" mismatch, so it is removed.
  const getAccountsCountForCloud = (cId: CloudId) => {
    if (!cloudAccounts || cloudAccounts.length === 0) return 0;
    return cloudAccounts.filter((a: any) => (a.cloud || '').toLowerCase() === cId).length;
  };

  const totalAccounts = (cloudAccounts && cloudAccounts.length > 0) ? cloudAccounts.length : 0;
  const totalAssessments = activeAssessments.length;
  // Real "Open findings" = sum of failed checks across the user's assessments
  // (was a fabricated score<80?9:4 heuristic). Falls back to high risks if a
  // record has no failedChecks recorded.
  const openFindingsCount = activeAssessments.reduce(
    (acc, a) => acc + (Number(a.failedChecks) || Number(a.highRisks) || 0),
    0
  );
  // Real "Resources scanned" = distinct resources across the user's
  // assessments if available, else total checks evaluated. No invented numbers.
  const resourcesScannedText = String(
    activeAssessments.reduce((acc, a) => acc + (Number(a.totalChecks) || 0), 0)
  );

  const dynamicCloudStats = (['aws', 'azure', 'gcp'] as CloudId[]).map(cId => {
    const cloudAssessments = activeAssessments.filter(a => a.cloud === cId);
    const accountsCount = getAccountsCountForCloud(cId);
    const avgScore = cloudAssessments.length > 0 ? Math.round(cloudAssessments.reduce((sum, a) => sum + a.score, 0) / cloudAssessments.length) : 0;
    // Derive pass/warn/fail from real per-assessment status, not multipliers.
    const passCount = cloudAssessments.filter(a => a.status === 'complete' && a.score >= 80).length;
    const warnCount = cloudAssessments.filter(a => a.status === 'warning' || (a.score >= 70 && a.score < 80)).length;
    const failCount = cloudAssessments.filter(a => a.status === 'fail' || a.score < 70).length;
    return {
      id: cId,
      avg: avgScore,
      pass: passCount,
      warn: warnCount,
      fail: failCount,
      accounts: accountsCount,
      resources: String(cloudAssessments.reduce((acc, a) => acc + (Number(a.totalChecks) || 0), 0)),
    };
  });

  const handleSaveCredentials = (account: { cloud: CloudId; name: string; id: string }) => {
    setIsNewUser(false);
    setShowCredsModal(false);
    setConfiguredAccount(account);
    runOrUpdateAssessment({
      cloud: account.cloud,
      name: `${account.name} — Initial Architecture Review`,
      accountName: account.name,
      accountId: account.id,
      region: account.cloud === 'aws' ? 'us-east-1' : account.cloud === 'azure' ? 'eastus' : 'us-central1',
    });
    go('live-scan');
  };

  return (
    <AppLayout>
      <div className="p-8 max-w-7xl mx-auto">
        {/* ── Page header ── */}
        <div className="pb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: T.text }}>
              Home
            </h1>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border"
              style={{
                backgroundColor: dbConnected ? (isDark ? 'rgba(16,185,129,0.1)' : '#ECFDF5') : (isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2'),
                borderColor: dbConnected ? (isDark ? 'rgba(16,185,129,0.2)' : '#A7F3D0') : (isDark ? 'rgba(239,68,68,0.2)' : '#FECACA'),
                color: dbConnected ? '#10B981' : '#EF4444',
              }}
              title={dbConnected ? 'Live MongoDB connected via FastAPI' : 'MongoDB offline, using local cache'}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${dbConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span>{dbConnected ? 'MongoDB Live' : 'Offline Cache'}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isNewUser && (
              <button
                onClick={() => setShowCredsModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer"
                style={{ borderColor: T.border, color: T.text, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-1-1l-2 2M3 21l2-2m-1 1l2-2M15 4l-4 4-2-2 4-4a2.828 2.828 0 0 1 4 4zM7 12l-4 4 2 2 4-4a2.828 2.828 0 0 0-4-4z"/>
                </svg>
                Connect Credentials
              </button>
            )}

            {/* Schedule Assessment Button */}
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs hover:border-blue-500"
              style={{
                borderColor: T.border,
                color: T.text,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span>Schedule Assessment</span>
            </button>

            <button
              id="tour-new-assessment-btn"
              type="button"
              onClick={() => {
                // Use the authoritative plural map (not the stale singular
                // configuredAccount, which can point at a deconfigured cloud).
                const firstConfigured = (['aws', 'azure', 'gcp'] as CloudId[])
                  .map(c => configuredAccounts[c])
                  .find(Boolean);
                if (firstConfigured) {
                  selectCloud(firstConfigured.cloud);
                } else if (!isNewUser) {
                  go('wizard');
                } else {
                  go('org-questions');
                }
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm text-white hover:opacity-90 cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #1B6FC9, #14A085, #2EBD59)' }}
              title="Start a new architecture assessment"
            >
              <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
              </svg>
              <span>New assessment</span>
            </button>
          </div>
        </div>

        <div className="px-8 pb-10 flex flex-col gap-7">

          {/* ── Stat row: Total accounts -> Total assessments -> Open findings -> Resources scanned ── */}
          <div id="tour-dashboard-stats" className="grid grid-cols-4 gap-4">
            <StatCard value={String(totalAccounts)} label="Total accounts" T={T} />
            <StatCard value={String(totalAssessments)} label="Total assessments" T={T} />
            <StatCard value={String(openFindingsCount)} label="Open findings" color={openFindingsCount > 0 ? T.error : undefined} T={T} />
            <StatCard value={resourcesScannedText} label="Resources scanned" T={T} />
          </div>



          {/* ── Provider row ── */}
          <div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: T.text }}>
              Cloud health
              <span className="font-normal ml-2 text-[12px]" style={{ color: T.muted }}>
                Click to filter assessments
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {dynamicCloudStats.map(stat => (
                <ProviderCard
                  key={stat.id}
                  stat={stat}
                  accountsCount={getAccountsCountForCloud(stat.id)}
                  active={cloudFilter === stat.id}
                  onClick={() => setCloudFilter(cloudFilter === stat.id ? 'all' : stat.id)}
                  T={T}
                  isDark={isDark}
                  disabled={stat.accounts === 0}
                />
              ))}
            </div>
          </div>

          {/* ── Assessment table ── */}
          <div>
            {/* Table header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold" style={{ color: T.text }}>
                Recent assessments
                {cloudFilter !== 'all' && (
                  <button
                    onClick={() => setCloudFilter('all')}
                    className="ml-2 text-[11px] font-normal hover:underline cursor-pointer"
                    style={{ color: '#2563EB' }}>
                    — clear filter ×
                  </button>
                )}
              </h2>

              {/* Search */}
              <div className="relative">
                <svg
                  className="absolute left-2.5 top-2.5 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: T.muted }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2"
                >
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
                </svg>
                <input
                  type="text" placeholder="Search by name, account ID, region…" value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-xl w-60 outline-none transition-all"
                  style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                  onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
                />
              </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, borderRadius: '1.25rem', boxShadow: T.shadow, overflow: 'hidden' }}>
              {/* Column headings */}
              <div className="grid items-center px-5 py-3 text-[12px] font-medium"
                style={{
                  gridTemplateColumns: '70px 1.4fr 1.3fr 90px 105px 70px 90px 240px',
                  backgroundColor: isDark ? 'rgba(0,0,0,.15)' : '#F8FAFC',
                  borderBottom: `1px solid ${T.border}`,
                  color: T.textSub,
                }}>
                <span>Cloud</span>
                <span>Assessment</span>
                <span>Account & Account ID</span>
                <span>Region</span>
                <span>Status</span>
                <span>Score</span>
                <span>Last ran</span>
                <span className="text-right">Actions</span>
              </div>

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-4">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                      <polyline points="14 2 14 8 20 8"/>
                      <line x1="16" y1="13" x2="8" y2="13"/>
                      <line x1="16" y1="17" x2="8" y2="17"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: T.text }}>
                      {isNewUser ? 'Welcome! No accounts or assessments connected yet' : 'No assessments match your search'}
                    </div>
                    <div className="text-xs mt-1 max-w-md" style={{ color: T.textSub }}>
                      {isNewUser ? 'Get started by filling in your cloud credentials to connect your first target account and region.' : 'Try changing your search term or clearing the active cloud filter.'}
                    </div>
                  </div>
                  {isNewUser && (
                    <div className="flex items-center gap-3 mt-2">
                      <button
                        onClick={() => setShowCredsModal(true)}
                        className="px-5 py-2.5 rounded-full text-xs font-semibold text-white transition-all hover:opacity-90 shadow-sm cursor-pointer"
                        style={{ background: 'linear-gradient(135deg, #1B6FC9, #10B981)' }}
                      >
                        Fill in Account Credentials →
                      </button>
                      <button
                        onClick={() => go('wizard')}
                        className="px-4 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer"
                        style={{ borderColor: T.border, color: T.textSub }}
                      >
                        Run Custom Wizard
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                filtered.map((a, idx) => {
                  const scoreColor = a.score >= 80 ? T.success : a.score >= 60 ? T.warning : T.error;
                  return (
                    <div
                      key={a.id}
                      className="grid items-center px-5 py-3.5 cursor-pointer transition-colors"
                      style={{
                        gridTemplateColumns: '70px 1.4fr 1.3fr 90px 105px 70px 90px 240px',
                        borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border}` : 'none',
                      }}
                      onClick={() => { selectAssessment(a.id, 'report'); }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = T.rowHover)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      {/* Cloud logo chip */}
                      <div onClick={e => e.stopPropagation()}>
                        <CloudChip id={a.cloud} size="sm" isDark={isDark} />
                      </div>

                      {/* Assessment name */}
                      <div className="min-w-0 pr-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate" style={{ color: T.text }}>{a.name}</span>
                          {a.rerunCount && a.rerunCount > 1 ? (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 border border-amber-500/30">
                              Rerun #{a.rerunCount}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>1 account · 1 region review</div>
                      </div>

                      {/* Account Name & Account ID */}
                      <div className="min-w-0 pr-3">
                        <div className="text-xs font-semibold truncate" style={{ color: T.text }}>{a.accountName}</div>
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

                      {/* Region */}
                      <div className="pr-2">
                        <span className="inline-block text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-500/10 text-gray-700 dark:text-gray-300">
                          {a.region}
                        </span>
                      </div>

                      {/* Status */}
                      <div onClick={e => e.stopPropagation()}>
                        <StatusDot status={a.status === 'fail' ? 'failed' : a.status === 'running' ? 'running' : 'completed'} isDark={isDark} />
                      </div>

                      {/* Score */}
                      <div>
                        {a.score > 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold tabular-nums" style={{ color: scoreColor }}>
                              {a.score}%
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-mono" style={{ color: T.muted }}>—</span>
                        )}
                      </div>

                      {/* Last run */}
                      <span className="text-xs font-mono" style={{ color: T.textSub }}>{a.lastRun}</span>

                      {/* Actions */}
                      <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { selectAssessment(a.id, 'report'); }}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer"
                          style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#2563EB';
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
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <AccountCredentialsModal
        isOpen={showCredsModal}
        onClose={() => setShowCredsModal(false)}
        onSave={handleSaveCredentials}
        isDark={isDark}
        canDismiss={!isNewUser}
      />

      <ScheduleAssessmentModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setScheduleForAssessment(null);
        }}
        isAssessmentRerun={Boolean(scheduleForAssessment)}
        assessmentId={scheduleForAssessment?.id}
        initialCloud={scheduleForAssessment?.cloud}
        initialAccountId={scheduleForAssessment?.accountId}
        initialAccountName={scheduleForAssessment?.accountName}
        initialRegion={scheduleForAssessment?.region}
        initialName={scheduleForAssessment?.name}
        onSuccess={() => {
          setIsScheduleModalOpen(false);
          setScheduleForAssessment(null);
          go('assessment-list');
        }}
      />
    </AppLayout>
  );
}
