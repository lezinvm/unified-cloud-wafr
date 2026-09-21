/**
 * Dark-navy top navigation bar — reusable across Dashboard and other main screens.
 * Always renders dark navy (#0F172A) regardless of light/dark page theme.
 */
import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context';
import { CloudifyOpsSymbol } from './CloudLogo';

const NAV_BG   = '#0F172A';
const NAV_TEXT = 'rgba(255,255,255,.75)';

export function TopNav() {
  const { go, theme, toggleTheme } = useApp();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [profileOpen]);

  return (
    <header
      className="h-14 flex items-center px-6 gap-6 shrink-0 z-40 relative"
      style={{ backgroundColor: NAV_BG, borderBottom: '1px solid rgba(255,255,255,.06)' }}
    >
      {/* Logo */}
      <button
        onClick={() => go('dashboard')}
        className="flex items-center gap-2.5 shrink-0 cursor-pointer"
      >
        <CloudifyOpsSymbol height={24} />
        <span className="font-semibold text-sm text-white tracking-tight">CloudifyOps</span>
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right cluster */}
      <div className="flex items-center gap-3">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors cursor-pointer"
          style={{ color: NAV_TEXT, backgroundColor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.1)' }}
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={e => { e.currentTarget.style.color = NAV_TEXT; }}
        >
          {theme === 'dark' ? (
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

        {/* User Profile with Dropdown (containing Settings) */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl transition-all cursor-pointer"
            style={{
              backgroundColor: profileOpen ? 'rgba(255,255,255,.1)' : 'rgba(255,255,255,.04)',
              border: '1px solid rgba(255,255,255,.08)',
            }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'rgba(255,255,255,.08)'; }}
            onMouseLeave={e => { if (!profileOpen) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,.04)'; }}
          >
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #1B6FC9, #10B981)' }}
            >
              LV
            </div>
            <div className="hidden sm:block text-left">
              <div className="text-[12px] font-medium leading-tight text-white">Lezin VM</div>
              <div className="text-[10px] leading-tight" style={{ color: NAV_TEXT }}>Admin</div>
            </div>
            <svg
              width="10"
              height="10"
              viewBox="0 0 20 20"
              fill="currentColor"
              className={`text-white/50 transition-transform duration-150 ${profileOpen ? 'rotate-180' : ''}`}
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {/* Profile Dropdown Menu */}
          {profileOpen && (
            <div
              className="absolute right-0 mt-2 w-56 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-top-1 duration-150"
              style={{
                backgroundColor: '#1E293B',
                border: '1px solid rgba(255,255,255,.12)',
                boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5)',
              }}
            >
              {/* User Header */}
              <div className="px-3 py-2.5 border-b border-white/10">
                <div className="text-xs font-semibold text-white">Lezin VM</div>
                <div className="text-[11px] text-white/50 truncate mt-0.5">lezin.menath@cloudifyops.com</div>
                <span className="inline-block text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded mt-1.5 border border-emerald-500/20">
                  Workspace Admin
                </span>
              </div>

              {/* Menu items */}
              <div className="py-1 flex flex-col gap-0.5">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    go('settings');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-white/85 hover:text-white hover:bg-white/10 transition-colors text-left cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/60">
                    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span>Settings</span>
                </button>
              </div>

              {/* Logout */}
              <div className="pt-1 mt-1 border-t border-white/10">
                <button
                  onClick={() => {
                    setProfileOpen(false);
                    go('login');
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors text-left cursor-pointer"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
