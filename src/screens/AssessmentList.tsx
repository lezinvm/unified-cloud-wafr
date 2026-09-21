import { useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { StatusPill } from '../components/StatusPill';

const LIGHT = { bg:'#F8FAFC', card:'#FFFFFF', border:'#E2E8F0', text:'#0F172A', textSub:'#64748B', primary:'#2563EB', primaryBg:'#EFF6FF', success:'#059669', successBg:'#ECFDF5', successBar:'#10B981', error:'#E11D48', errorBg:'#FFF1F2', errorBar:'#FB7185', warning:'#D97706', warningBg:'#FFFBEB', warningBar:'#FBBF24', muted:'#94A3B8', progress:'#10B981', activeNavBg:'#EFF6FF', shadow:'0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)', shadowMd:'0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)' };
const DARK  = { bg:'#0B1220', card:'#111B2E', border:'#1E293B', text:'#F1F5F9', textSub:'#94A3B8', primary:'#3B82F6', primaryBg:'rgba(59,130,246,.15)', success:'#52B788', successBg:'rgba(82,183,136,.12)', successBar:'rgba(82,183,136,.75)', error:'#FB7185', errorBg:'rgba(251,113,133,.12)', errorBar:'rgba(251,113,133,.65)', warning:'#FBBF24', warningBg:'rgba(251,191,36,.12)', warningBar:'rgba(251,191,36,.65)', muted:'#94A3B8', progress:'#52B788', activeNavBg:'rgba(59,130,246,.12)', shadow:'0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)', shadowMd:'0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)' };

const ASSESSMENTS = [
  { id: 'A-001', name: 'Production — us-east-1 Full Review', accountName: 'acme-production', accountId: '124890123456', region: 'us-east-1', status: 'complete' as const, score: 84, pillars: { R: 88, S: 79, C: 91, O: 82, P: 80 }, lastRun: '2h ago', checks: 380 },
  { id: 'A-002', name: 'Staging — us-west-2 Review', accountName: 'acme-staging', accountId: '987654321098', region: 'us-west-2', status: 'running' as const, score: 71, pillars: { R: 72, S: 68, C: 75, O: 70, P: 70 }, lastRun: 'In progress', checks: 214 },
  { id: 'A-003', name: 'Data Platform — BigQuery Review', accountName: 'acme-data-platform', accountId: 'proj-data-4821', region: 'us-central1', status: 'fail' as const, score: 54, pillars: { R: 55, S: 40, C: 62, O: 58, P: 55 }, lastRun: '1d ago', checks: 280 },
  { id: 'A-004', name: 'Dev Baseline Review', accountName: 'acme-dev', accountId: '456789012345', region: 'us-east-2', status: 'warning' as const, score: 67, pillars: { R: 70, S: 60, C: 72, O: 65, P: 68 }, lastRun: '3d ago', checks: 195 },
  { id: 'A-005', name: 'Security Posture Review', accountName: 'acme-security-hub', accountId: '334455667788', region: 'eu-west-1', status: 'draft' as const, score: 0, pillars: { R: 0, S: 0, C: 0, O: 0, P: 0 }, lastRun: 'Not started', checks: 0 },
  { id: 'A-006', name: 'Cost Optimization Review', accountName: 'acme-production', accountId: '124890123456', region: 'us-east-1', status: 'complete' as const, score: 92, pillars: { R: 89, S: 95, C: 96, O: 90, P: 90 }, lastRun: '5d ago', checks: 145 },
];

export function AssessmentList() {
  const { go, accent, cloudShort, theme, assessments, selectAssessment } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('lastRun');

  const ScoreBar = ({ score }: { score: number }) => {
    if (score === 0) return <span style={{ color: T.muted, fontSize: '12px' }}>—</span>;
    const color = score >= 80 ? T.success : score >= 65 ? T.warning : T.error;
    return (
      <div className="flex items-center gap-2 min-w-[80px]">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: T.border }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: color }} />
        </div>
        <span className="text-xs font-medium tabular-nums" style={{ color }}>{score}%</span>
      </div>
    );
  };

  const filtered = assessments.filter(a => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.accountName.toLowerCase().includes(search.toLowerCase()) ||
      a.accountId.toLowerCase().includes(search.toLowerCase()) ||
      a.region.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ backgroundColor: T.bg, minHeight: '100%' }}>
        {/* Page header */}
        <div className="px-6 py-4" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button onClick={() => go('dashboard')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.primary }}>Home</button>
              <span>/</span>
              {cloudShort && (
                <>
                  <span style={{ color: accent }} className="font-medium">{cloudShort}</span>
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

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-xl" style={{ color: T.text }}>Assessments</h1>
              <p className="text-sm mt-0.5" style={{ color: T.textSub }}>{filtered.length} reviews · 1 account & 1 region per review</p>
            </div>
            <button
              type="button"
              onClick={() => { go('select-cloud'); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
              style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)', color: '#FFFFFF', boxShadow: T.shadow }}
            >
              <span>+ New Assessment</span>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Filters bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: T.muted }} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                type="text"
                placeholder="Search by name, account ID, region…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm focus:outline-none transition-colors"
                style={{ backgroundColor: T.card, border: `1px solid ${T.border}`, color: T.text }}
                onFocus={e => { e.currentTarget.style.borderColor = '#2563EB'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37,99,235,.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.boxShadow = 'none'; }}
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
              <span>{filtered.length} of {ASSESSMENTS.length} results</span>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-hidden" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}>
            {/* Table header */}
            <div className="grid px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ gridTemplateColumns: '1.4fr 1.3fr 110px 100px 110px 100px 90px', backgroundColor: isDark ? 'rgba(0,0,0,.15)' : '#F8FAFC', borderBottom: `1px solid ${T.border}`, color: T.textSub }}>
              <span>Assessment</span>
              <span>Account & Account ID</span>
              <span>Region</span>
              <span>Status</span>
              <span>Score</span>
              <span>Last Run</span>
              <span className="text-right">Actions</span>
            </div>

            {/* Rows */}
            {filtered.map((a) => (
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
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: T.textSub, backgroundColor: isDark ? 'rgba(0,0,0,.3)' : '#F8FAFC', border: `1px solid ${T.border}` }}>{a.id}</span>
                    <span className="text-sm font-medium" style={{ color: T.text }}>{a.name}</span>
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>1 account · 1 region review</div>
                </div>

                {/* Account Name & Account ID */}
                <div className="pr-3">
                  <div className="text-xs font-semibold" style={{ color: T.text }}>{a.accountName}</div>
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
                <span className="text-xs font-mono" style={{ color: T.textSub }}>{a.lastRun}</span>

                {/* Actions */}
                <div className="flex items-center justify-end gap-1.5" onClick={e => e.stopPropagation()}>
                  <button
                    onClick={() => selectAssessment(a.id, 'report')}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors cursor-pointer"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.primary; e.currentTarget.style.borderColor = '#2563EB'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = T.border; }}
                  >
                    View
                  </button>
                  <button
                    onClick={() => go('live-scan')}
                    className="px-2.5 py-1 text-[11px] font-medium rounded-full transition-colors"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.primary; e.currentTarget.style.borderColor = '#2563EB'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = T.border; }}
                  >
                    Re-run
                  </button>
                  <button className="w-7 h-7 rounded-full flex items-center justify-center transition-colors" style={{ color: T.textSub }}
                    onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.backgroundColor = T.border; }}
                    onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.backgroundColor = 'transparent'; }}>
                    <svg width="14" height="14" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: T.border, color: T.textSub }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
                <div className="font-medium text-sm" style={{ color: T.textSub }}>No assessments found</div>
                <div className="text-xs" style={{ color: T.muted }}>Try adjusting your search or filters</div>
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-3 text-xs" style={{ color: T.textSub }}>
            <span>Showing {filtered.length} of {ASSESSMENTS.length} assessments</span>
            <div className="flex items-center gap-1">
              <button className="px-2.5 py-1 rounded-full transition-colors" style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = T.border; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>← Prev</button>
              <button className="px-2.5 py-1 rounded-full font-medium" style={{ border: `1px solid ${T.border}`, backgroundColor: T.primaryBg, color: T.primary }}>1</button>
              <button className="px-2.5 py-1 rounded-full transition-colors" style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                onMouseEnter={e => { e.currentTarget.style.backgroundColor = T.border; }}
                onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}>Next →</button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
