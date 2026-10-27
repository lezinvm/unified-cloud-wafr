import { ReactNode, useState } from 'react';
import { useApp, Screen, LIGHT, DARK, Tokens } from '../context';
import { CloudifyOpsSymbol, LensLogo } from './CloudLogo';
import { AssessmentChat, ChatLauncher } from './AssessmentChat';

export function AppLayout({ children }: { children: ReactNode }) {
  const {
    screen,
    go,
    cloud,
    cloudShort,
    accent,
    theme,
    toggleTheme,
    currentUser,
    logoutUser,
    currentAssessment,
    currentMilestones,
    userRole,
    setUserRole,
    adminTab,
    setAdminTab,
    startTour,
    setSelectedComplianceFrameworkId,
  } = useApp();

  const [isChatOpen, setIsChatOpen] = useState(false);

  const T: Tokens = theme === 'dark' ? DARK : LIGHT;
  const isDark = theme === 'dark';
  const isAdmin = userRole === 'admin' || screen === 'admin';

  // Chat is accessible across home (dashboard), assessments, remediation, and milestones
  const showChat = !isAdmin && [
    'dashboard',
    'assessment-list',
    'report',
    'pillar-detail',
    'diagram',
    'remediation',
    'ai-fix',
    'milestones',
  ].includes(screen);

  const CLOUD_PILL: Record<string, { bg: string; text: string }> = {
    aws:   { bg: 'rgba(255,153,0,.12)',  text: '#FF9900' },
    azure: { bg: 'rgba(0,120,212,.12)',  text: '#0078D4' },
    gcp:   { bg: 'rgba(66,133,244,.12)', text: '#4285F4' },
  };
  const pill = cloud ? CLOUD_PILL[cloud] : null;

  // Determine whether current screen is within a specific assessment context (user mode only)
  const isAssessmentContext = !isAdmin && Boolean(currentAssessment) && [
    'report',
    'pillar-detail',
    'milestones',
    'diagram',
  ].includes(screen);

  const handleSignOut = () => {
    logoutUser();
  };

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="h-14 flex items-center justify-between px-5 shrink-0 z-30"
        style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, boxShadow: T.shadow }}>

        {/* Left: LENS Brand Logo & Context Badges */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => (isAdmin ? go('admin') : go('dashboard'))}
            className="flex items-center gap-2 cursor-pointer hover:opacity-90 transition-opacity"
            title="LENS Cloud WAFR Platform"
          >
            <LensLogo height={28} />
          </button>

          {/* Admin Portal Indicator Badge */}
          {isAdmin ? (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span>Admin Portal</span>
            </div>
          ) : (
            /* Active Cloud Indicator: shown only during cloud-specific reviews, not on multi-cloud Home/Dashboard */
            pill && cloud && ![
              'dashboard',
              'assessment-list',
              'integrations',
              'settings',
            ].includes(screen) && (
              <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold"
                style={{ backgroundColor: pill.bg, color: pill.text }}>
                <span>Cloud: {cloudShort}</span>
              </div>
            )
          )}
        </div>

        {/* Right: CloudifyOps corporate brand logo */}
        <div className="flex items-center">
          <CloudifyOpsSymbol height={30} />
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex flex-col justify-between z-20 overflow-y-auto"
          style={{ backgroundColor: T.card, borderRight: `1px solid ${T.border}` }}>

          {/* ════════════════════════════════════════════════════════
              ADMINISTRATOR SIDEBAR
             ════════════════════════════════════════════════════════ */}
          {isAdmin ? (
            <div className="p-3 flex flex-col justify-between h-full">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider px-3 mb-2 text-emerald-400 flex items-center gap-1.5">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span>Admin Administration</span>
                </div>

                <nav className="flex flex-col gap-1">
                  {/* Tab 1: User Management */}
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab('users');
                      if (screen !== 'admin') go('admin');
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'admin' && adminTab === 'users'
                      ? { backgroundColor: T.activeNavBg, color: '#10B981', fontWeight: 600 }
                      : { color: T.textSub }
                    }
                  >
                    {screen === 'admin' && adminTab === 'users' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: '#10B981' }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'admin' && adminTab === 'users' ? '#10B981' : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </span>
                    User Management
                  </button>

                  {/* Tab 2: Token & AI Spend */}
                  <button
                    type="button"
                    onClick={() => {
                      setAdminTab('tokens');
                      if (screen !== 'admin') go('admin');
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'admin' && adminTab === 'tokens'
                      ? { backgroundColor: T.activeNavBg, color: '#10B981', fontWeight: 600 }
                      : { color: T.textSub }
                    }
                  >
                    {screen === 'admin' && adminTab === 'tokens' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: '#10B981' }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'admin' && adminTab === 'tokens' ? '#10B981' : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    </span>
                    Token & AI Quotas
                  </button>
                </nav>
              </div>

              {/* Admin Footer with Dark Mode + Profile + Sign Out */}
              <div className="pt-3 border-t border-slate-800 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                  style={{ color: T.textSub, backgroundColor: isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA', border: `1px solid ${T.border}` }}
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    )}
                    <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Toggle</span>
                </button>

                <div className="flex items-center justify-between p-2 rounded-xl" style={{ backgroundColor: isDark ? 'rgba(255,255,255,.03)' : '#F8FAFC', border: `1px solid ${T.border}` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 bg-emerald-600">
                      AD
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-[11px] font-semibold leading-tight text-emerald-400 truncate">Administrator</div>
                      <div className="text-[9px] leading-tight truncate" style={{ color: T.textSub }}>admin@cloudifyops.com</div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Sign Out"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* ════════════════════════════════════════════════════════
               STANDARD USER SIDEBAR (Assessments, Remediation, etc.)
               ════════════════════════════════════════════════════════ */
            <>
              {/* General Navigation */}
              <div className="p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider px-3 mb-1.5" style={{ color: T.muted }}>
                  Main Navigation
                </div>
                <nav className="flex flex-col gap-1">
                  {/* Home */}
                  <button
                    onClick={() => go('dashboard')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'dashboard'
                      ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                      : { color: T.textSub }
                    }
                    onMouseEnter={e => { if (screen !== 'dashboard') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                    onMouseLeave={e => { if (screen !== 'dashboard') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                  >
                    {screen === 'dashboard' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'dashboard' ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                        <polyline points="9 22 9 12 15 12 15 22"/>
                      </svg>
                    </span>
                    Home
                  </button>

                  {/* All Assessments */}
                  <button
                    id="tour-nav-assessments"
                    type="button"
                    onClick={() => go('assessment-list')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'assessment-list'
                      ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                      : { color: T.textSub }
                    }
                    onMouseEnter={e => { if (screen !== 'assessment-list') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                    onMouseLeave={e => { if (screen !== 'assessment-list') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                  >
                    {screen === 'assessment-list' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'assessment-list' ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                        <polyline points="14 2 14 8 20 8"/>
                        <line x1="16" y1="13" x2="8" y2="13"/>
                        <line x1="16" y1="17" x2="8" y2="17"/>
                        <polyline points="10 9 9 9 8 9"/>
                      </svg>
                    </span>
                    Assessments
                  </button>

                  {/* Remediation Tab */}
                  <button
                    id="tour-nav-remediation"
                    type="button"
                    onClick={() => {
                      go('remediation');
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'remediation'
                      ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                      : { color: T.textSub }
                    }
                    onMouseEnter={e => { if (screen !== 'remediation') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                    onMouseLeave={e => { if (screen !== 'remediation') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                  >
                    {screen === 'remediation' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'remediation' ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z"/>
                      </svg>
                    </span>
                    Remediation
                  </button>

                  {/* Integrations & Alerts Tab */}
                  <button
                    id="tour-nav-integrations"
                    type="button"
                    onClick={() => go('integrations')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'integrations'
                      ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                      : { color: T.textSub }
                    }
                    onMouseEnter={e => { if (screen !== 'integrations') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                    onMouseLeave={e => { if (screen !== 'integrations') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                  >
                    {screen === 'integrations' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'integrations' ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                      </svg>
                    </span>
                    Integrations
                  </button>

                  {/* Settings Tab */}
                  <button
                    id="tour-nav-settings"
                    type="button"
                    onClick={() => go('settings')}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all relative text-left cursor-pointer"
                    style={screen === 'settings'
                      ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                      : { color: T.textSub }
                    }
                    onMouseEnter={e => { if (screen !== 'settings') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                    onMouseLeave={e => { if (screen !== 'settings') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                  >
                    {screen === 'settings' && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                    )}
                    <span className="w-5 flex items-center justify-center shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={screen === 'settings' ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </span>
                    Settings
                  </button>
                </nav>
              </div>

              {/* ── Assessment-specific navigation (ONLY shown when inside a specific assessment) ── */}
              {isAssessmentContext && (
                <div className="p-3 border-t flex flex-col gap-1.5" style={{ borderColor: T.border }}>
                  <div className="flex items-center justify-between px-3 mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: T.muted }}>
                      Active Assessment
                    </span>
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: T.textSub }}>
                      {currentAssessment?.id || 'A-001'}
                    </span>
                  </div>

                  {/* Assessment Context Card */}
                  <div
                    className="mx-1 mb-2 p-2.5 rounded-xl border flex flex-col gap-1"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <div className="text-xs font-bold truncate" style={{ color: T.text }}>
                      {currentAssessment?.name || 'Production Full Review'}
                    </div>
                    <div className="text-[11px] flex items-center justify-between" style={{ color: T.textSub }}>
                      <span>{currentAssessment?.accountName}</span>
                      <span className="font-semibold text-green-600 dark:text-green-400">{currentAssessment?.score}%</span>
                    </div>
                  </div>

                  {/* Assessment Specific Items */}
                  <nav className="flex flex-col gap-1">
                    {/* Review Findings */}
                    <button
                      onClick={() => go('report')}
                      className="flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-all relative text-left cursor-pointer"
                      style={screen === 'report' || screen === 'pillar-detail'
                        ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                        : { color: T.textSub }
                      }
                      onMouseEnter={e => { if (screen !== 'report' && screen !== 'pillar-detail') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                      onMouseLeave={e => { if (screen !== 'report' && screen !== 'pillar-detail') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                    >
                      {(screen === 'report' || screen === 'pillar-detail') && (
                        <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                      )}
                      <span className="w-5 flex items-center justify-center shrink-0">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={(screen === 'report' || screen === 'pillar-detail') ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="20" x2="18" y2="10"/>
                          <line x1="12" y1="20" x2="12" y2="4"/>
                          <line x1="6" y1="20" x2="6" y2="14"/>
                        </svg>
                      </span>
                      Review Findings
                    </button>

                    {/* Milestones (Strictly on specific assessments) */}
                    <button
                      onClick={() => go('milestones')}
                      className="flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all relative text-left cursor-pointer"
                      style={screen === 'milestones'
                        ? { backgroundColor: T.activeNavBg, color: T.primary, fontWeight: 600 }
                        : { color: T.textSub }
                      }
                      onMouseEnter={e => { if (screen !== 'milestones') { e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA'; e.currentTarget.style.color = T.text; } }}
                      onMouseLeave={e => { if (screen !== 'milestones') { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = T.textSub; } }}
                    >
                      <div className="flex items-center gap-3">
                        {screen === 'milestones' && (
                          <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full" style={{ backgroundColor: T.activeNavBar }} />
                        )}
                        <span className="w-5 flex items-center justify-center shrink-0">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={screen === 'milestones' ? T.primary : T.textSub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
                            <line x1="4" y1="22" x2="4" y2="15"/>
                          </svg>
                        </span>
                        Milestones
                      </div>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded-full"
                        style={{
                          backgroundColor: screen === 'milestones' ? (isDark ? 'rgba(59,130,246,0.25)' : '#DBEAFE') : (isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9'),
                          color: screen === 'milestones' ? T.primary : T.textSub,
                        }}
                      >
                        {currentMilestones.length}
                      </span>
                    </button>
                  </nav>
                </div>
              )}

              {/* ── Sidebar Bottom / Footer: Platform Tour + Theme Toggle + User Profile ── */}
              <div id="tour-theme-controls" className="mt-auto p-3 border-t flex flex-col gap-2 shrink-0" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(0,0,0,0.1)' : '#FBFBFC' }}>
                {/* Platform Tour Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (screen !== 'dashboard') {
                      go('dashboard');
                    }
                    startTour();
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer hover:opacity-90"
                  style={{
                    color: T.text,
                    backgroundColor: isDark ? 'rgba(255,255,255,.04)' : '#FFFFFF',
                    border: `1px solid ${T.border}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  title="Launch Interactive Platform Introduction Tour"
                >
                  <div className="flex items-center gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <span>Product Tour</span>
                  </div>
                  <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                    Guide
                  </span>
                </button>

                {/* Dark / Light Mode Toggle Button */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors cursor-pointer hover:opacity-90"
                  style={{
                    color: T.text,
                    backgroundColor: isDark ? 'rgba(255,255,255,.04)' : '#FFFFFF',
                    border: `1px solid ${T.border}`,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                  title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  <div className="flex items-center gap-2.5">
                    {isDark ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400 shrink-0">
                        <circle cx="12" cy="12" r="5"/>
                        <line x1="12" y1="1" x2="12" y2="3"/>
                        <line x1="12" y1="21" x2="12" y2="23"/>
                        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                        <line x1="1" y1="12" x2="3" y2="12"/>
                        <line x1="21" y1="12" x2="23" y2="12"/>
                        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500 shrink-0">
                        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                      </svg>
                    )}
                    <span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
                  </div>
                  <div className="w-7 h-4 rounded-full p-0.5 flex items-center transition-colors"
                    style={{ backgroundColor: isDark ? '#3B82F6' : '#E2E8F0', justifyContent: isDark ? 'flex-end' : 'flex-start' }}>
                    <div className="w-3 h-3 rounded-full bg-white shadow-xs" />
                  </div>
                </button>

                {/* Profile Card */}
                <div
                  className="flex items-center justify-between p-2 rounded-xl border transition-colors"
                  style={{
                    backgroundColor: isDark ? 'rgba(255,255,255,.03)' : '#FFFFFF',
                    borderColor: T.border,
                    boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => go('settings')}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer hover:opacity-80 transition-opacity flex-1"
                    title="View Settings & Profile"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-xs uppercase"
                      style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}
                    >
                      {currentUser.name
                        ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2)
                        : 'US'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12px] font-semibold leading-tight truncate" style={{ color: T.text }}>
                        {currentUser.name || 'User'}
                      </div>
                      <div className="text-[10px] leading-tight truncate" style={{ color: T.textSub }}>
                        {currentUser.email || 'user@cloudifyops.com'}
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="p-1.5 rounded-lg text-rose-500/80 hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer shrink-0 ml-1"
                    title="Sign Out"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>

      {/* ── LENS AI Chatbot Floating Assistant ── */}
      {showChat && (
        <>
          <ChatLauncher onClick={() => setIsChatOpen(true)} />
          <AssessmentChat
            isOpen={isChatOpen}
            onClose={() => setIsChatOpen(false)}
          />
        </>
      )}
    </div>
  );
}
