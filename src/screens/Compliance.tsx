import { useState, useMemo } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { SeverityPill } from '../components/FindingUI';
import {
  ComplianceFramework,
  ComplianceRequirement,
  CloudProvider,
  INITIAL_COMPLIANCE_FRAMEWORKS,
} from '../data/complianceData';
import { JiraTicketModal } from '../components/JiraTicketModal';
import { SlackAlertModal } from '../components/SlackAlertModal';

/* ── Provider Icon Helper ─────────────────────────────────────────────────── */
function ProviderIcon({ provider }: { provider: CloudProvider }) {
  if (provider === 'aws') {
    return (
      <span className="w-5 h-5 rounded-md bg-[#FF9900]/15 text-[#FF9900] border border-[#FF9900]/30 flex items-center justify-center text-[10px] font-bold" title="Amazon Web Services">
        AWS
      </span>
    );
  }
  if (provider === 'azure') {
    return (
      <span className="w-5 h-5 rounded-md bg-[#0078D4]/15 text-[#0078D4] border border-[#0078D4]/30 flex items-center justify-center text-[10px] font-bold" title="Microsoft Azure">
        AZ
      </span>
    );
  }
  if (provider === 'gcp') {
    return (
      <span className="w-5 h-5 rounded-md bg-[#4285F4]/15 text-[#4285F4] border border-[#4285F4]/30 flex items-center justify-center text-[10px] font-bold" title="Google Cloud Platform">
        GCP
      </span>
    );
  }
  if (provider === 'github') {
    return (
      <span className="w-5 h-5 rounded-md bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center text-[10px] font-bold" title="GitHub Actions & CI/CD">
        GH
      </span>
    );
  }
  if (provider === 'k8s') {
    return (
      <span className="w-5 h-5 rounded-md bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center justify-center text-[10px] font-bold" title="Kubernetes Cluster">
        K8s
      </span>
    );
  }
  return null;
}

/* ── Requirements Donut Gauge Component ───────────────────────────────────── */
function RequirementsDonut({
  total,
  passed,
  failed,
  manual,
  isDark,
  T,
}: {
  total: number;
  passed: number;
  failed: number;
  manual: number;
  isDark: boolean;
  T: Tokens;
}) {
  const size = 150;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const passRatio = total > 0 ? passed / total : 0;
  const failRatio = total > 0 ? failed / total : 0;
  const manualRatio = total > 0 ? manual / total : 0;

  const passDash = passRatio * circumference;
  const failDash = failRatio * circumference;
  const manualDash = manualRatio * circumference;

  const manualPercent = total > 0 ? Math.round((manual / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative w-[150px] h-[150px] flex items-center justify-center">
        <svg width={size} height={size} className="-rotate-90 transform">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0'}
            strokeWidth={strokeWidth}
          />
          {/* Pass arc (Green) */}
          {passed > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#10B981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${passDash} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
            />
          )}
          {/* Fail arc (Red) */}
          {failed > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#E11D48"
              strokeWidth={strokeWidth}
              strokeDasharray={`${failDash} ${circumference}`}
              strokeDashoffset={-passDash}
              strokeLinecap="round"
            />
          )}
          {/* Manual arc (Slate) */}
          {manual > 0 && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={isDark ? '#475569' : '#94A3B8'}
              strokeWidth={strokeWidth}
              strokeDasharray={`${manualDash} ${circumference}`}
              strokeDashoffset={-(passDash + failDash)}
              strokeLinecap="round"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold font-mono tracking-tight" style={{ color: T.text }}>
            {total}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
            Total
          </span>
          <span className="text-[9px] px-1.5 py-0.5 mt-0.5 rounded bg-slate-500/15 font-mono text-slate-400">
            {manualPercent}% Manual
          </span>
        </div>
      </div>

      {/* Legend Pills */}
      <div className="flex items-center gap-2 mt-4 flex-wrap justify-center">
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          {passed} Pass
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          {failed} Fail
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          {manual} Manual
        </span>
      </div>
    </div>
  );
}

/* ── Main Compliance Component ────────────────────────────────────────────── */
export function Compliance() {
  const {
    theme,
    complianceFrameworks,
    selectedComplianceFrameworkId,
    setSelectedComplianceFrameworkId,
    pinnedComplianceIds,
    togglePinComplianceFramework,
    goToAIFix,
    jiraTickets,
  } = useApp();

  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  // Overview states
  const [scanMode, setScanMode] = useState<'multiple' | 'single'>('multiple');
  const [providerTypeFilter, setProviderTypeFilter] = useState<string>('all');
  const [providerAccountFilter, setProviderAccountFilter] = useState<string>('all');
  const [providerGroupFilter, setProviderGroupFilter] = useState<string>('all');
  const [showOnlyWatchlist, setShowOnlyWatchlist] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Framework Detail states
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({ 'sec-8': true, 'sec-3': true });
  const [requirementSearch, setRequirementSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail' | 'manual'>('all');
  const [reportMenuOpen, setReportMenuOpen] = useState(false);

  // Jira and Slack Modal targets
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

  const frameworks: ComplianceFramework[] = complianceFrameworks || INITIAL_COMPLIANCE_FRAMEWORKS;

  // Selected framework for detail view
  const currentFramework = useMemo(() => {
    if (!selectedComplianceFrameworkId) return null;
    return frameworks.find(f => f.id === selectedComplianceFrameworkId) || frameworks[0];
  }, [selectedComplianceFrameworkId, frameworks]);

  // Filtered frameworks for overview
  const filteredFrameworks = useMemo(() => {
    return frameworks.filter(fw => {
      if (showOnlyWatchlist && !pinnedComplianceIds[fw.id]) return false;
      if (providerTypeFilter !== 'all' && !fw.providers.includes(providerTypeFilter as CloudProvider)) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        return fw.name.toLowerCase().includes(q) || fw.description.toLowerCase().includes(q) || fw.shortName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [frameworks, showOnlyWatchlist, pinnedComplianceIds, providerTypeFilter, searchQuery]);

  const pinnedCount = Object.values(pinnedComplianceIds || {}).filter(Boolean).length;

  const toggleSection = (secId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [secId]: !prev[secId],
    }));
  };

  const expandAll = () => {
    if (!currentFramework) return;
    const next: Record<string, boolean> = {};
    currentFramework.sections.forEach(s => {
      next[s.id] = true;
    });
    setExpandedSections(next);
  };

  const collapseAll = () => {
    setExpandedSections({});
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-full overflow-y-auto" style={{ backgroundColor: T.bg, color: T.text }}>

        {/* ══════════════════════════════════════════════════════════════════
            VIEW 1: FRAMEWORKS OVERVIEW (Multiple Scan / Single Scan Grid)
           ══════════════════════════════════════════════════════════════════ */}
        {!selectedComplianceFrameworkId ? (
          <div className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">

            {/* Top Title & Mode Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-2xl flex items-center justify-center text-white shadow-sm"
                  style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight" style={{ color: T.text }}>
                    Compliance
                  </h1>
                  <p className="text-xs" style={{ color: T.textSub }}>
                    Universal cloud compliance frameworks aggregated across multi-cloud accounts and services.
                  </p>
                </div>
              </div>

              {/* Watchlist & Search toolbar */}
              <div className="flex items-center gap-3 flex-wrap">
                <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer select-none transition-colors"
                  style={{
                    backgroundColor: showOnlyWatchlist ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : (isDark ? 'rgba(255,255,255,0.03)' : '#FFFFFF'),
                    borderColor: showOnlyWatchlist ? '#10B981' : T.border,
                    color: showOnlyWatchlist ? '#10B981' : T.textSub,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={showOnlyWatchlist}
                    onChange={e => setShowOnlyWatchlist(e.target.checked)}
                    className="accent-emerald-600 rounded cursor-pointer"
                  />
                  <span>Show only watchlist ({pinnedCount} pinned)</span>
                </label>

                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search frameworks..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="px-3 py-1.5 pl-8 text-xs rounded-xl border outline-none w-52 transition-colors focus:border-emerald-500"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderColor: T.border,
                      color: T.text,
                    }}
                  />
                  <svg className="absolute left-2.5 top-2.5 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Subnav Tabs & Filter Bar */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                {/* Mode Selector Tabs */}
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : '#F1F5F9' }}>
                  <button
                    type="button"
                    onClick={() => setScanMode('multiple')}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
                    style={{
                      backgroundColor: scanMode === 'multiple' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: scanMode === 'multiple' ? '#10B981' : T.textSub,
                      boxShadow: scanMode === 'multiple' ? T.shadow : 'none',
                    }}
                  >
                    Multiple Scan
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode('single')}
                    className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer"
                    style={{
                      backgroundColor: scanMode === 'single' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                      color: scanMode === 'single' ? '#10B981' : T.textSub,
                      boxShadow: scanMode === 'single' ? T.shadow : 'none',
                    }}
                  >
                    Single Scan
                  </button>
                </div>

                {/* Dropdown Filters */}
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  <select
                    value={providerTypeFilter}
                    onChange={e => setProviderTypeFilter(e.target.value)}
                    aria-label="Filter by provider type"
                    className="px-3 py-1.5 rounded-xl border outline-none font-medium cursor-pointer transition-colors"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  >
                    <option value="all">Provider type: All</option>
                    <option value="aws">AWS</option>
                    <option value="azure">Azure</option>
                    <option value="gcp">GCP</option>
                    <option value="github">GitHub</option>
                    <option value="k8s">Kubernetes</option>
                  </select>

                  <select
                    value={providerAccountFilter}
                    onChange={e => setProviderAccountFilter(e.target.value)}
                    aria-label="Filter by cloud account"
                    className="px-3 py-1.5 rounded-xl border outline-none font-medium cursor-pointer transition-colors"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  >
                    <option value="all">Providers: All Accounts (4)</option>
                    <option value="aws-prod">AWS · acme-production (124890123456)</option>
                    <option value="azure-sub">Azure · AcmeCorp-ProductionSub</option>
                    <option value="gcp-prod">GCP · acme-gcp-prod (proj-9941)</option>
                  </select>

                  <select
                    value={providerGroupFilter}
                    onChange={e => setProviderGroupFilter(e.target.value)}
                    aria-label="Filter by provider group"
                    className="px-3 py-1.5 rounded-xl border outline-none font-medium cursor-pointer transition-colors"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  >
                    <option value="all">Provider group: All</option>
                    <option value="production">Production Workloads</option>
                    <option value="staging">Staging & Dev</option>
                    <option value="core">Core Shared Infrastructure</option>
                  </select>
                </div>
              </div>

              {/* Section Subheading */}
              <div className="pt-2">
                <h2 className="text-sm font-bold tracking-tight" style={{ color: T.text }}>
                  Across provider types
                </h2>
                <p className="text-xs" style={{ color: T.textSub }}>
                  Universal frameworks aggregated across every compatible provider type, using the latest completed scan of each provider.
                </p>
              </div>
            </div>

            {/* Frameworks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredFrameworks.map(fw => {
                const isPinned = pinnedComplianceIds[fw.id];
                const scoreColor = fw.score >= 80 ? '#10B981' : fw.score >= 30 ? '#F59E0B' : '#E11D48';

                return (
                  <div
                    key={fw.id}
                    onClick={() => setSelectedComplianceFrameworkId(fw.id)}
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
                            togglePinComplianceFramework(fw.id);
                          }}
                          className="p-1.5 rounded-lg transition-colors cursor-pointer shrink-0"
                          style={{
                            color: isPinned ? '#10B981' : (isDark ? '#64748B' : '#94A3B8'),
                            backgroundColor: isPinned ? (isDark ? 'rgba(16,185,129,0.15)' : '#ECFDF5') : 'transparent',
                          }}
                          title={isPinned ? 'Remove from watchlist' : 'Pin to watchlist'}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill={isPinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/>
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
                            <ProviderIcon key={p} provider={p} />
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
              })}
            </div>
          </div>
        ) : (
          /* ══════════════════════════════════════════════════════════════════
              VIEW 2: FRAMEWORK DEEP-DIVE (Interactive Requirements Accordion)
             ══════════════════════════════════════════════════════════════════ */
          currentFramework && (
            <div className="p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">

              {/* Breadcrumb & Framework Header */}
              <div className="flex flex-col gap-4 border-b pb-4" style={{ borderColor: T.border }}>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2 text-xs" style={{ color: T.textSub }}>
                    <button
                      type="button"
                      onClick={() => setSelectedComplianceFrameworkId(null)}
                      className="hover:text-emerald-500 font-semibold cursor-pointer transition-colors flex items-center gap-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="m15 18-6-6 6-6"/>
                      </svg>
                      <span>Compliance</span>
                    </button>
                    <span>/</span>
                    <span className="font-bold truncate" style={{ color: T.text }}>
                      {currentFramework.name}
                    </span>
                  </div>

                  {/* Actions: Report & Rerun */}
                  <div className="flex items-center gap-2 relative">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setReportMenuOpen(prev => !prev)}
                        className="px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                          <polyline points="7 10 12 15 17 10"/>
                          <line x1="12" y1="15" x2="12" y2="3"/>
                        </svg>
                        <span>Report ▾</span>
                      </button>

                      {reportMenuOpen && (
                        <div
                          className="absolute right-0 top-full mt-1 w-48 rounded-xl shadow-xl border z-30 p-1 flex flex-col gap-0.5 text-xs font-medium"
                          style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              window.print();
                              setReportMenuOpen(false);
                            }}
                            className="p-2 rounded-lg text-left hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer"
                          >
                            Export Audit PDF Report
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              alert(`Exported CSV checklist for ${currentFramework.name}`);
                              setReportMenuOpen(false);
                            }}
                            className="p-2 rounded-lg text-left hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer"
                          >
                            Download CSV Checklist
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              alert(`Exported JSON evidence telemetry for ${currentFramework.name}`);
                              setReportMenuOpen(false);
                            }}
                            className="p-2 rounded-lg text-left hover:bg-emerald-500/10 hover:text-emerald-500 cursor-pointer"
                          >
                            Download JSON Evidence
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Framework Title Card */}
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 border"
                      style={{
                        backgroundColor: currentFramework.badgeBg + '25',
                        color: currentFramework.badgeColor,
                        borderColor: currentFramework.badgeBg + '40',
                      }}
                    >
                      {currentFramework.badge}
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h1 className="text-xl font-bold tracking-tight" style={{ color: T.text }}>
                          {currentFramework.name}
                        </h1>
                        <a
                          href={currentFramework.docUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-blue-500 hover:underline flex items-center gap-1"
                        >
                          <span>Documentation</span>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                        </a>
                      </div>
                      <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                        1 of {currentFramework.compatibleProvidersCount} compatible providers scanned · 1 scan aggregated
                      </p>
                    </div>
                  </div>

                  {/* Filter Dropdowns in Detail View */}
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <select
                      aria-label="Provider type"
                      className="px-3 py-1.5 rounded-xl border outline-none font-medium cursor-pointer"
                      style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                    >
                      <option>Provider type: All</option>
                      <option>AWS</option>
                      <option>Azure</option>
                      <option>GCP</option>
                    </select>
                    <select
                      aria-label="Provider account"
                      className="px-3 py-1.5 rounded-xl border outline-none font-medium cursor-pointer"
                      style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                    >
                      <option>Providers: All (4)</option>
                      <option>AWS (acme-production)</option>
                    </select>
                    <select
                      aria-label="Provider group"
                      className="px-3 py-1.5 rounded-xl border outline-none font-medium cursor-pointer"
                      style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', borderColor: T.border, color: T.text }}
                    >
                      <option>Provider group: All</option>
                      <option>Production</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* ── TOP 3 ANALYTICS METRIC CARDS ── */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Card 1: Requirements Status Donut */}
                <div
                  className="p-5 rounded-2xl border flex flex-col justify-between"
                  style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
                >
                  <h3 className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: T.muted }}>
                    Requirements Status
                  </h3>
                  <RequirementsDonut
                    total={currentFramework.totalRequirements}
                    passed={currentFramework.passingRequirements}
                    failed={currentFramework.failingRequirements}
                    manual={currentFramework.manualRequirements}
                    isDark={isDark}
                    T={T}
                  />
                </div>

                {/* Card 2: Provider Coverage */}
                <div
                  className="p-5 rounded-2xl border flex flex-col justify-between gap-3"
                  style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
                >
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: T.muted }}>
                      Provider Coverage
                    </h3>
                    <div className="flex flex-col gap-3">
                      {currentFramework.providerCoverage.map((pc, idx) => (
                        <div key={idx} className="flex flex-col gap-1">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1.5 font-bold">
                              <ProviderIcon provider={pc.provider} />
                              <span style={{ color: T.text }}>{pc.label}</span>
                            </div>
                            <span className="font-mono font-bold text-emerald-500">
                              {pc.score}%
                            </span>
                          </div>
                          <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
                            <div
                              className="h-full rounded-full bg-emerald-500"
                              style={{ width: `${pc.score}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-right" style={{ color: T.textSub }}>
                            {pc.passed}/{pc.total} passed · {pc.manual} manual
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="text-[11px] p-2.5 rounded-xl border bg-blue-500/5 text-blue-500 border-blue-500/20 flex items-center gap-1.5">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>All critical high-risk findings synchronized with AWS Security Pillar.</span>
                  </div>
                </div>

                {/* Card 3: Top Failed Sections */}
                <div
                  className="p-5 rounded-2xl border flex flex-col justify-between gap-3"
                  style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
                >
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider mb-3" style={{ color: T.muted }}>
                      Top Failed Sections
                    </h3>

                    {currentFramework.topFailedSections.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-6 text-center text-xs" style={{ color: T.textSub }}>
                        <span className="w-8 h-8 rounded-full bg-emerald-500/15 text-emerald-500 flex items-center justify-center font-bold mb-2">
                          ✓
                        </span>
                        <span className="font-semibold text-emerald-500">100% Passed</span>
                        <span>No failed requirement sections found!</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {currentFramework.topFailedSections.map((sec, idx) => (
                          <div key={idx} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold truncate max-w-[200px]" style={{ color: T.text }}>
                                {sec.sectionTitle}
                              </span>
                              <span className="font-mono text-xs font-bold text-rose-500">
                                {sec.failRate}% · {sec.failedCount} fail
                              </span>
                            </div>
                            <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
                              <div
                                className="h-full rounded-full bg-rose-500"
                                style={{ width: `${sec.failRate}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="text-[10px]" style={{ color: T.textSub }}>
                    Remediating audit log & KMS encryption will improve compliance by +18%.
                  </div>
                </div>
              </div>

              {/* ── HIERARCHICAL SECTIONS & REQUIREMENTS ACCORDION ── */}
              <div className="flex flex-col gap-3">
                {/* Accordion Toolbar */}
                <div className="flex items-center justify-between flex-wrap gap-3 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={expandAll}
                      className="px-3 py-1 text-xs font-semibold rounded-lg border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      Expand all
                    </button>
                    <button
                      type="button"
                      onClick={collapseAll}
                      className="px-3 py-1 text-xs font-semibold rounded-lg border cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      Collapse all
                    </button>

                    {/* Status filter pills */}
                    <div className="flex items-center gap-1 ml-2 p-1 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.35)' : '#F1F5F9' }}>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('all')}
                        className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                        style={{
                          backgroundColor: statusFilter === 'all' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                          color: statusFilter === 'all' ? T.primary : T.textSub,
                        }}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('fail')}
                        className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                        style={{
                          backgroundColor: statusFilter === 'fail' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                          color: statusFilter === 'fail' ? '#E11D48' : T.textSub,
                        }}
                      >
                        Failing ({currentFramework.failingRequirements})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusFilter('pass')}
                        className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer"
                        style={{
                          backgroundColor: statusFilter === 'pass' ? (isDark ? '#1E293B' : '#FFFFFF') : 'transparent',
                          color: statusFilter === 'pass' ? '#10B981' : T.textSub,
                        }}
                      >
                        Passing ({currentFramework.passingRequirements})
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search requirements or controls..."
                      value={requirementSearch}
                      onChange={e => setRequirementSearch(e.target.value)}
                      className="px-3 py-1.5 pl-8 text-xs rounded-xl border outline-none w-64 transition-colors focus:border-emerald-500"
                      style={{
                        backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                        borderColor: T.border,
                        color: T.text,
                      }}
                    />
                    <svg className="absolute left-2.5 top-2.5 text-slate-400" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="11" cy="11" r="8"/>
                      <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                  </div>
                </div>

                {/* Section Accordions */}
                <div className="flex flex-col gap-3">
                  {currentFramework.sections.map(section => {
                    const isExpanded = !!expandedSections[section.id];
                    const passedReqs = section.requirements.filter(r => r.status === 'pass').length;
                    const failedReqs = section.requirements.filter(r => r.status === 'fail').length;
                    const manualReqs = section.requirements.filter(r => r.status === 'manual').length;
                    const totalSecReqs = section.requirements.length;

                    // Filter requirements inside section
                    const visibleReqs = section.requirements.filter(r => {
                      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
                      if (requirementSearch.trim()) {
                        const q = requirementSearch.toLowerCase().trim();
                        return (
                          r.id.toLowerCase().includes(q) ||
                          r.code.toLowerCase().includes(q) ||
                          r.title.toLowerCase().includes(q) ||
                          r.description.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    });

                    if (visibleReqs.length === 0 && (requirementSearch.trim() || statusFilter !== 'all')) {
                      return null;
                    }

                    return (
                      <div
                        key={section.id}
                        className="rounded-2xl border transition-all overflow-hidden"
                        style={{
                          backgroundColor: T.card,
                          borderColor: failedReqs > 0 ? (isDark ? 'rgba(244,63,94,0.3)' : '#FECDD3') : T.border,
                          boxShadow: T.shadow,
                        }}
                      >
                        {/* Section Header Row */}
                        <div
                          onClick={() => toggleSection(section.id)}
                          className="p-4 flex items-center justify-between gap-4 cursor-pointer transition-colors select-none"
                          style={{
                            backgroundColor: isExpanded ? (isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC') : 'transparent',
                          }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <span
                              className="w-6 h-6 rounded-lg flex items-center justify-center transition-transform shrink-0"
                              style={{
                                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9',
                                color: T.textSub,
                                transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                              }}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="9 18 15 12 9 6"/>
                              </svg>
                            </span>

                            <div className="min-w-0">
                              <h3 className="text-sm font-bold truncate" style={{ color: T.text }}>
                                {section.title}
                              </h3>
                              {section.description && (
                                <p className="text-xs truncate max-w-xl" style={{ color: T.textSub }}>
                                  {section.description}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Section Progress Meter */}
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2 text-xs font-semibold" style={{ color: T.textSub }}>
                              <span>Requirements:</span>
                              <div className="w-24 h-2 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0' }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${totalSecReqs > 0 ? (passedReqs / totalSecReqs) * 100 : 0}%`,
                                    backgroundColor: failedReqs > 0 ? '#F43F5E' : '#10B981',
                                  }}
                                />
                              </div>
                              <span className="font-bold font-mono" style={{ color: T.text }}>
                                {totalSecReqs}
                              </span>
                            </div>

                            {failedReqs > 0 ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/20">
                                {failedReqs} Fail
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                                All Pass
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Requirements List (when expanded) */}
                        {isExpanded && (
                          <div className="border-t p-4 flex flex-col gap-2.5" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.15)' : '#FAFBFD' }}>
                            {visibleReqs.map(req => {
                              const isFailed = req.status === 'fail';
                              const isPass = req.status === 'pass';

                              return (
                                <div
                                  key={req.id}
                                  className="p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                                  style={{
                                    backgroundColor: T.card,
                                    borderColor: isFailed ? (isDark ? 'rgba(244,63,94,0.3)' : '#FECDD3') : T.border,
                                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                                  }}
                                >
                                  {/* Left: Code, Title, and Description */}
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div className="mt-0.5 shrink-0">
                                      {isPass ? (
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-emerald-500/15 text-emerald-500">
                                          ✓
                                        </span>
                                      ) : isFailed ? (
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold bg-rose-500/15 text-rose-500">
                                          ✕
                                        </span>
                                      ) : (
                                        <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-slate-500/15 text-slate-400">
                                          M
                                        </span>
                                      )}
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">
                                          {req.code}
                                        </span>
                                        <SeverityPill severity={req.severity} dark={isDark} />
                                        <h4 className="text-xs font-bold" style={{ color: T.text }}>
                                          {req.title}
                                        </h4>
                                      </div>

                                      <p className="text-[11px] leading-relaxed mb-1" style={{ color: T.textSub }}>
                                        {req.description}
                                      </p>

                                      {/* Rationale / Manual note */}
                                      {req.rationale && (
                                        <div className="text-[11px] font-medium text-rose-600 dark:text-rose-400 bg-rose-500/5 p-2 rounded-lg border border-rose-500/20 mb-1">
                                          <strong>Audit Risk:</strong> {req.rationale}
                                        </div>
                                      )}

                                      {req.manualNote && (
                                        <div className="text-[11px] text-slate-400 italic">
                                          Note: {req.manualNote}
                                        </div>
                                      )}

                                      {/* Impacted resources */}
                                      {req.resources && req.resources.length > 0 && (
                                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                                          <span className="text-[10px] font-semibold uppercase" style={{ color: T.muted }}>Impacted:</span>
                                          {req.resources.map((res, i) => (
                                            <span key={i} className="font-mono text-[10px] px-2 py-0.5 rounded bg-black/20 text-slate-300 border" style={{ borderColor: T.border }}>
                                              {res}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Right: Actions */}
                                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                    {/* Slack Alert Button */}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setSlackModalTarget({
                                          title: `Compliance Alert [${currentFramework.name}]: ${req.code} - ${req.title}`,
                                          message: `Control ${req.code} (${req.severity.toUpperCase()}) required under ${currentFramework.name}.\n\nDescription: ${req.description}`,
                                          severity: req.severity === 'critical' ? 'critical' : req.severity === 'high' ? 'high' : 'info',
                                          checkId: req.checkId,
                                        })
                                      }
                                      className="px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer text-[#E01E5A] dark:text-[#ECB22E]"
                                      style={{
                                        borderColor: isDark ? 'rgba(236,178,46,0.3)' : 'rgba(224,30,90,0.2)',
                                        backgroundColor: isDark ? 'rgba(236,178,46,0.1)' : '#FFF5F7',
                                      }}
                                      title="Dispatch Slack alert for this control"
                                    >
                                      # Slack
                                    </button>

                                    {/* Jira Linked Ticket */}
                                    {req.checkId && jiraTickets && jiraTickets[req.checkId] ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setJiraModalTarget({
                                            checkId: req.checkId!,
                                            title: req.title,
                                            severity: req.severity,
                                            description: req.description,
                                          })
                                        }
                                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer text-[#0052CC] dark:text-[#388BFF]"
                                        style={{
                                          borderColor: isDark ? 'rgba(56,139,255,0.3)' : 'rgba(0,82,204,0.2)',
                                          backgroundColor: isDark ? 'rgba(0,82,204,0.15)' : '#EFF6FF',
                                        }}
                                        title={`Jira ticket ${jiraTickets[req.checkId].key} is ${jiraTickets[req.checkId].status}`}
                                      >
                                        <span>◆</span>
                                        <span>{jiraTickets[req.checkId].key}</span>
                                        <span className="text-[9px] px-1 py-0.2 rounded font-semibold bg-blue-500/20">
                                          {jiraTickets[req.checkId].status}
                                        </span>
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setJiraModalTarget({
                                            checkId: req.checkId || req.id,
                                            title: `[${currentFramework.shortName}] ${req.code}: ${req.title}`,
                                            severity: req.severity,
                                            description: req.description,
                                          })
                                        }
                                        className="px-2 py-1 text-[10px] font-bold rounded-lg border transition-colors cursor-pointer text-[#0052CC] dark:text-[#388BFF]"
                                        style={{
                                          borderColor: isDark ? 'rgba(56,139,255,0.3)' : 'rgba(0,82,204,0.2)',
                                          backgroundColor: isDark ? 'rgba(0,82,204,0.15)' : '#EFF6FF',
                                        }}
                                        title="Create Jira ticket for this requirement"
                                      >
                                        + Jira
                                      </button>
                                    )}

                                    {/* AI Fix button (if checkId or failing) */}
                                    {isFailed && req.checkId && (
                                      <button
                                        type="button"
                                        onClick={() => goToAIFix(req.checkId!)}
                                        className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold rounded-full hover:opacity-90 transition-opacity cursor-pointer text-white shadow-xs"
                                        style={{ background: 'linear-gradient(135deg,#1B6FC9,#14A085,#10B981)' }}
                                      >
                                        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                                        </svg>
                                        <span>AI Fix</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )
        )}

        {/* ── JIRA TICKET MODAL ── */}
        {jiraModalTarget && (
          <JiraTicketModal
            isOpen={true}
            onClose={() => setJiraModalTarget(null)}
            checkId={jiraModalTarget.checkId}
            checkTitle={jiraModalTarget.title}
            severity={jiraModalTarget.severity}
            checkDescription={jiraModalTarget.description}
            existingTicket={jiraTickets ? jiraTickets[jiraModalTarget.checkId] : undefined}
          />
        )}

        {/* ── SLACK ALERT MODAL ── */}
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
      </div>
    </AppLayout>
  );
}
