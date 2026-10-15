import { useEffect } from 'react';
import { useApp } from '../context';
import { SlackLogo, JiraLogo, GChatLogo } from './IntegrationLogos';

export function IntegrationToast() {
  const { toast, clearToast, go } = useApp();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      clearToast();
    }, 4500);
    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) return null;

  const isSlack = toast.type === 'slack';
  const isJira = toast.type === 'jira';
  const isGChat = toast.type === 'gchat';

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div
        className="flex items-start gap-3 p-4 rounded-2xl shadow-2xl border max-w-md w-full backdrop-blur-md"
        style={{
          backgroundColor: '#0F172A',
          borderColor: isSlack ? '#4A154B' : isJira ? '#0052CC' : isGChat ? '#00AC47' : '#10B981',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        }}
      >
        {/* Service Icon Badge */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm p-1.5"
          style={{
            backgroundColor: isSlack
              ? 'rgba(74, 21, 75, 0.4)'
              : isJira
              ? 'rgba(0, 82, 204, 0.3)'
              : isGChat
              ? 'rgba(0, 172, 71, 0.25)'
              : 'rgba(16, 185, 129, 0.2)',
            border: `1px solid ${
              isSlack
                ? '#ECB22E40'
                : isJira
                ? '#388BFF40'
                : isGChat
                ? '#34D39940'
                : '#10B98140'
            }`,
          }}
        >
          {isSlack ? (
            <SlackLogo className="w-full h-full" />
          ) : isJira ? (
            <JiraLogo className="w-full h-full" />
          ) : isGChat ? (
            <GChatLogo className="w-full h-full" />
          ) : (
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                backgroundColor: isSlack
                  ? '#4A154B'
                  : isJira
                  ? '#0052CC'
                  : isGChat
                  ? '#065F46'
                  : '#065F46',
                color: '#FFFFFF',
              }}
            >
              {isSlack
                ? 'Slack Alert Dispatched'
                : isJira
                ? 'Jira Issue Synced'
                : isGChat
                ? 'Google Chat Alert Dispatched'
                : 'Action Verified'}
            </span>
            <span className="text-[10px] text-slate-400">Just now</span>
          </div>

          <div className="text-xs font-bold text-white mt-1 leading-snug truncate">
            {toast.message}
          </div>

          {toast.details && (
            <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-2 leading-relaxed">
              {toast.details}
            </p>
          )}

          <div className="mt-2.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                clearToast();
                go('integrations');
              }}
              className="text-[11px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer flex items-center gap-1"
            >
              <span>View in Integrations Console</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          type="button"
          onClick={clearToast}
          className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg cursor-pointer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
