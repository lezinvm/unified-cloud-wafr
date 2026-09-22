import { useState, useEffect } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { TopNav } from '../components/TopNav';
import { CloudChip, CloudId } from '../components/CloudLogo';
import { AccountCredentialsModal } from '../components/AccountCredentialsModal';

/* ── Types & Theme Tokens ────────────────────────────────────────────────────── */

/* ── Data ────────────────────────────────────────────────────────────────────── */
const CLOUD_META: Record<CloudId, { label: string; accent: string }> = {
  aws:   { label: 'Amazon Web Services', accent: '#FF9900' },
  azure: { label: 'Microsoft Azure',     accent: '#0078D4' },
  gcp:   { label: 'Google Cloud',        accent: '#4285F4' },
};

const CLOUD_STATS: { id: CloudId; avg: number; pass: number; warn: number; fail: number; accounts: number; resources: string }[] = [
  { id: 'aws',   avg: 79, pass: 9,  warn: 4, fail: 5, accounts: 12, resources: '1.2k' },
  { id: 'azure', avg: 66, pass: 5,  warn: 3, fail: 2, accounts: 8,  resources: '487'  },
  { id: 'gcp',   avg: 91, pass: 3,  warn: 1, fail: 0, accounts: 4,  resources: '312'  },
];

type AssessmentStatus = 'completed' | 'running' | 'failed';

const ASSESSMENTS: {
  id: string; cloud: CloudId; name: string;
  accountName: string; accountId: string; region: string;
  status: AssessmentStatus;
  score: number; lastRun: string;
}[] = [
  { id:'A-001', cloud:'aws',   name:'Production — us-east-1 Full Review',  accountName:'acme-production',  accountId:'124890123456', region:'us-east-1',    status:'completed', score:84, lastRun:'2h ago'   },
  { id:'A-002', cloud:'aws',   name:'Staging — us-west-2 Review',          accountName:'acme-staging',     accountId:'987654321098', region:'us-west-2',    status:'running',   score:0,  lastRun:'Running'  },
  { id:'A-003', cloud:'azure', name:'Azure Data Platform Review',          accountName:'AcmeCorp-DataSub', accountId:'sub-4891-2394', region:'eastus',       status:'completed', score:78, lastRun:'1d ago'   },
  { id:'A-004', cloud:'aws',   name:'Dev Baseline Review',                 accountName:'acme-dev',         accountId:'456789012345', region:'us-east-2',    status:'completed', score:67, lastRun:'3d ago'   },
  { id:'A-005', cloud:'gcp',   name:'GKE Production Review',               accountName:'acme-gcp-prod',    accountId:'proj-gcp-9941', region:'us-central1', status:'completed', score:91, lastRun:'4d ago'   },
  { id:'A-006', cloud:'aws',   name:'Cost Optimisation Review',            accountName:'acme-production',  accountId:'124890123456', region:'eu-west-1',    status:'completed', score:92, lastRun:'5d ago'   },
  { id:'A-007', cloud:'azure', name:'AKS Security Hardening Review',       accountName:'AcmeCorp-CoreSub', accountId:'sub-7712-9901', region:'westeurope',   status:'failed',    score:54, lastRun:'1wk ago'  },
];

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
  stat: typeof CLOUD_STATS[0];
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
            {accountsCount} accounts
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
  const { go, selectCloud, selectAssessment, theme, isNewUser, setIsNewUser } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [showCredsModal, setShowCredsModal] = useState(isNewUser);
  const [createdAssessments, setCreatedAssessments] = useState<typeof ASSESSMENTS>([]);
  const [cloudFilter, setCloudFilter] = useState<'all' | CloudId>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (isNewUser) {
      setShowCredsModal(true);
    }
  }, [isNewUser]);

  const activeAssessments = isNewUser
    ? createdAssessments
    : (createdAssessments.length > 0 ? createdAssessments : ASSESSMENTS);

  const filtered = activeAssessments.filter(a => {
    const matchCloud  = cloudFilter === 'all' || a.cloud === cloudFilter;
    const matchSearch = search === '' ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName.toLowerCase().includes(search.toLowerCase()) ||
      a.accountId.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase());
    return matchCloud && matchSearch;
  });

  const totalAccounts = isNewUser
    ? createdAssessments.length
    : (createdAssessments.length > 0 ? createdAssessments.length : CLOUD_STATS.reduce((s, c) => s + c.accounts, 0));
  const totalAssessments = activeAssessments.length;

  const handleSaveCredentials = (account: { cloud: CloudId; name: string; id: string }) => {
    setIsNewUser(false);
    setShowCredsModal(false);
    setCreatedAssessments([
      {
        id: 'A-001',
        cloud: account.cloud,
        name: `${account.name} — Initial Review`,
        accountName: account.name,
        accountId: account.id,
        region: account.cloud === 'aws' ? 'us-east-1' : account.cloud === 'azure' ? 'eastus' : 'us-central1',
        status: 'completed',
        score: 84,
        lastRun: 'Just now',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: T.bg }}>
      <TopNav />

      <div className="flex-1 overflow-auto">
        {/* ── Page header ── */}
        <div className="px-8 pt-8 pb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight" style={{ color: T.text }}>
              Home
            </h1>
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

            <button
              type="button"
              onClick={() => { if (!isNewUser) go('org-questions'); }}
              disabled={isNewUser}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm ${
                isNewUser
                  ? 'opacity-60 cursor-not-allowed text-gray-400'
                  : 'text-white hover:opacity-90 cursor-pointer'
              }`}
              style={
                isNewUser
                  ? { backgroundColor: isDark ? '#1E293B' : '#E2E8F0', color: isDark ? '#64748B' : '#94A3B8', border: `1px solid ${T.border}`, cursor: 'not-allowed' }
                  : { background: 'linear-gradient(135deg, #1B6FC9, #14A085, #2EBD59)' }
              }
              title={isNewUser ? 'Disabled: Connect account credentials first to enable new assessments' : 'Start a new assessment'}
            >
              {isNewUser ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              ) : (
                <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/>
                </svg>
              )}
              <span>New assessment</span>
            </button>
          </div>
        </div>

        <div className="px-8 pb-10 flex flex-col gap-7">

          {/* ── New User Action Required Banner ── */}
          {isNewUser && (
            <div
              className="p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border"
              style={{
                backgroundColor: isDark ? 'rgba(37,99,235,0.12)' : '#EFF6FF',
                borderColor: isDark ? 'rgba(37,99,235,0.35)' : '#BFDBFE',
              }}
            >
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-blue-600 bg-blue-100 dark:bg-blue-900/40 shrink-0 mt-0.5">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 2l-2 2m-1-1l-2 2M3 21l2-2m-1 1l2-2M15 4l-4 4-2-2 4-4a2.828 2.828 0 0 1 4 4zM7 12l-4 4 2 2 4-4a2.828 2.828 0 0 0-4-4z"/>
                    <line x1="8.5" y1="15.5" x2="15.5" y2="8.5"/>
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: T.text }}>
                    Action Required: Fill in Account Credentials
                  </div>
                  <p className="text-xs mt-0.5 max-w-xl" style={{ color: T.textSub }}>
                    Welcome to CloudifyOps! To evaluate your architecture against Well-Architected Frameworks, please connect your AWS, Azure, or GCP credentials.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowCredsModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-semibold text-white shrink-0 transition-opacity hover:opacity-90 shadow-sm cursor-pointer"
                style={{ background: 'linear-gradient(135deg, #1B6FC9, #10B981)' }}
              >
                <span>Fill Credentials Now</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </button>
            </div>
          )}

          {/* ── Stat row: Total accounts -> Total assessments -> Open findings -> Resources scanned ── */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard value={String(totalAccounts)} label="Total accounts" T={T} />
            <StatCard value={String(totalAssessments)} label="Total assessments" T={T} />
            <StatCard value={isNewUser ? '0' : '59'} label="Open findings" color={isNewUser ? undefined : T.error} T={T} />
            <StatCard value={isNewUser ? '0' : '2.0k'} label="Resources scanned" T={T} />
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
              {CLOUD_STATS.map(stat => (
                <ProviderCard
                  key={stat.id}
                  stat={stat}
                  accountsCount={isNewUser ? 0 : stat.accounts}
                  active={cloudFilter === stat.id}
                  onClick={() => setCloudFilter(cloudFilter === stat.id ? 'all' : stat.id)}
                  T={T}
                  isDark={isDark}
                  disabled={isNewUser}
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
                  gridTemplateColumns: '80px 1.4fr 1.3fr 110px 100px 75px 85px 70px',
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
                        gridTemplateColumns: '80px 1.4fr 1.3fr 110px 100px 75px 85px 70px',
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
                        <div className="text-sm font-medium truncate" style={{ color: T.text }}>{a.name}</div>
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
                        <StatusDot status={a.status} isDark={isDark} />
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
                      <div className="flex items-center justify-end" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => { selectAssessment(a.id, 'report'); }}
                          className="px-3 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer"
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
    </div>
  );
}
