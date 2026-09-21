import { ReactNode, useState } from 'react';
import { useApp, Screen, LIGHT, DARK, Tokens } from '../context';
import { CloudifyOpsSymbol } from './CloudLogo';
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
    currentAssessment,
    currentMilestones,
    userRole,
    setUserRole,
    adminTab,
    setAdminTab,
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
  const isAssessmentContext = !isAdmin && [
    'report',
    'pillar-detail',
    'milestones',
    'remediation',
    'diagram',
  ].includes(screen);

  const handleSignOut = () => {
    setUserRole('user');
    go('login');
  };

  return (
    <div className="flex flex-col h-screen" style={{ backgroundColor: T.bg, color: T.text, fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top bar ── */}
      <header className="h-14 flex items-center px-5 shrink-0 z-30"
        style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}`, boxShadow: T.shadow }}>

        {/* Left: logo */}
        <button
          onClick={() => (isAdmin ? go('admin') : go('dashboard'))}
          className="flex items-center gap-2.5 mr-6 shrink-0 cursor-pointer"
        >
          <CloudifyOpsSymbol height={24} />
          <span className="font-semibold text-sm" style={{ color: T.text }}>CloudifyOps</span>
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
          /* Active Cloud Indicator for standard users */
          pill && cloud && (
            <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold"
              style={{ backgroundColor: pill.bg, color: pill.text }}>
              <span>Cloud: {cloudShort}</span>
            </div>
          )
        )}

        {/* Right: Actions + theme toggle + avatar */}
        <div className="ml-auto flex items-center gap-2.5">
          {!isAdmin && (
            <button
              type="button"
              onClick={() => go('onboarding')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
              style={{
                color: T.textSub,
                backgroundColor: isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA',
                border: `1px solid ${T.border}`,
              }}
              title="Launch Interactive Platform Introduction"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <span className="hidden md:inline">Platform Tour</span>
            </button>
          )}

          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: T.textSub, backgroundColor: isDark ? 'rgba(255,255,255,.04)' : '#F5F7FA', border: `1px solid ${T.border}` }}
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            {isDark ? (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>

          {/* User / Admin Profile Block */}
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 p-1 rounded-xl">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 bg-emerald-600">
                  AD
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-[12px] font-semibold leading-tight text-emerald-400">Administrator</div>
                  <div className="text-[10px] leading-tight" style={{ color: T.textSub }}>admin@cloudifyops.com</div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-400 hover:bg-rose-500/10 border border-rose-500/20 transition-colors cursor-pointer"
                title="Sign out of Admin session"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <button
              onClick={() => go('settings')}
              className="flex items-center gap-2.5 p-1 rounded-xl transition-colors cursor-pointer hover:opacity-80"
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}>LV</div>
              <div className="hidden sm:block text-left">
                <div className="text-[12px] font-semibold leading-tight" style={{ color: T.text }}>Lezin VM</div>
                <div className="text-[10px] leading-tight" style={{ color: T.textSub }}>User</div>
              </div>
            </button>
          )}
        </div>
      </header>

      {/* ── Body: sidebar + content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <aside className="w-64 shrink-0 flex flex-col z-20 overflow-y-auto"
          style={{ backgroundColor: T.card, borderRight: `1px solid ${T.border}` }}>

          {/* ════════════════════════════════════════════════════════
              ADMINISTRATOR SIDEBAR (Only needed required admin tools)
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

              {/* Admin Footer Sign Out */}
              <div className="pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign Out of Admin</span>
                </button>
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

                  {/* Settings Tab */}
                  <button
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
