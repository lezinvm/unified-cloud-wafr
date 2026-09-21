import { useState, useEffect } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';

const LIGHT = { bg:'#F8FAFC', card:'#FFFFFF', border:'#E2E8F0', text:'#0F172A', textSub:'#64748B', primary:'#2563EB', primaryBg:'#EFF6FF', success:'#059669', successBg:'#ECFDF5', successBar:'#10B981', error:'#E11D48', errorBg:'#FFF1F2', errorBar:'#FB7185', warning:'#D97706', warningBg:'#FFFBEB', warningBar:'#FBBF24', muted:'#94A3B8', progress:'#10B981', activeNavBg:'#EFF6FF', shadow:'0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)', shadowMd:'0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)' };
const DARK  = { bg:'#0B1220', card:'#111B2E', border:'#1E293B', text:'#F1F5F9', textSub:'#94A3B8', primary:'#3B82F6', primaryBg:'rgba(59,130,246,.15)', success:'#52B788', successBg:'rgba(82,183,136,.12)', successBar:'rgba(82,183,136,.75)', error:'#FB7185', errorBg:'rgba(251,113,133,.12)', errorBar:'rgba(251,113,133,.65)', warning:'#FBBF24', warningBg:'rgba(251,191,36,.12)', warningBar:'rgba(251,191,36,.65)', muted:'#94A3B8', progress:'#52B788', activeNavBg:'rgba(59,130,246,.12)', shadow:'0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)', shadowMd:'0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)' };

const STAGES = [
  { id: 'discovery', label: 'Resource Discovery', desc: 'Enumerating accounts and resources', duration: 2000 },
  { id: 'config', label: 'Configuration Checks', desc: '272 checks across 5 pillars', duration: 5000 },
  { id: 'relational', label: 'Relational Analysis', desc: 'Cross-resource dependency mapping', duration: 1500 },
  { id: 'eval', label: 'Evaluation & Scoring', desc: 'Aggregating findings and pillar scores', duration: 1000 },
];

export function LiveScan() {
  const { go, theme } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;
  const [progress, setProgress] = useState(56);
  const [stageIndex, setStageIndex] = useState(1);
  const [stats, setStats] = useState({ pass: 167, fail: 31, warn: 16 });

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => go('report'), 600);
          return 100;
        }
        return p + 0.4;
      });
      setStats(s => ({
        pass: Math.min(s.pass + 1, 214),
        fail: s.fail,
        warn: s.warn,
      }));
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (progress > 25 && stageIndex === 0) setStageIndex(1);
    if (progress > 75 && stageIndex === 1) setStageIndex(2);
    if (progress > 90 && stageIndex === 2) setStageIndex(3);
  }, [progress]);

  const checksTotal = 272;
  const checksDone = Math.floor((progress / 100) * checksTotal);

  return (
    <AppLayout>
      <div className="overflow-auto p-6" style={{ backgroundColor: T.bg, minHeight: '100%' }}>
        <div className="max-w-3xl mx-auto flex flex-col gap-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => go('assessment-list')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
                style={{ border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: 'transparent' }}
                onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'; }}
                onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                ← Back to Assessments
              </button>
              <div>
                <nav className="text-xs flex items-center gap-1.5 mb-1" style={{ color: T.textSub }}>
                  <button onClick={() => go('dashboard')} className="hover:underline transition-colors" style={{ color: T.textSub }}>Home</button>
                  <span>/</span>
                  <button onClick={() => go('assessment-list')} className="hover:underline transition-colors" style={{ color: T.textSub }}>Assessments</button>
                  <span>/</span><span style={{ color: T.text }}>Live Scan</span>
                </nav>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: T.primary }} />
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: T.primary }}>Live Scan Running</span>
                </div>
                <h1 className="font-semibold text-xl" style={{ color: T.text }}>Production — Q3 2026 WAF Review</h1>
                <p className="text-sm mt-0.5" style={{ color: T.textSub }}>Started 14:03:22 · acme-production (124890123456) · us-east-1 · 272 checks</p>
              </div>
            </div>
            <button
              onClick={() => go('assessment-list')}
              className="px-4 py-2 text-sm rounded-full transition-colors cursor-pointer"
              style={{ border: `1px solid ${T.border}`, color: T.textSub }}
              onMouseEnter={e => { e.currentTarget.style.color = T.error; e.currentTarget.style.borderColor = T.error; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.borderColor = T.border; }}>
              Cancel Scan
            </button>
          </div>

          {/* Overall progress */}
          <div className="p-5 flex flex-col gap-3" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium" style={{ color: T.text }}>Overall Progress</span>
              <span className="text-sm font-semibold tabular-nums" style={{ color: T.primary }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: T.border }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#2563EB,#22C55E)' }}
              />
            </div>
            <div className="flex items-center justify-between text-[11px]" style={{ color: T.textSub }}>
              <span>{checksDone} of {checksTotal} checks complete</span>
              <span>Est. {Math.max(0, Math.ceil((100 - progress) / 10))} min remaining</span>
            </div>
          </div>

          {/* Stages */}
          <div className="p-5 flex flex-col gap-3" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}>
            <h3 className="text-sm font-medium mb-1" style={{ color: T.text }}>Scan Stages</h3>
            {STAGES.map((stage, i) => {
              const done = i < stageIndex;
              const active = i === stageIndex;
              return (
                <div key={stage.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0"
                    style={done
                      ? { backgroundColor: T.successBg, color: T.success }
                      : active
                      ? { backgroundColor: T.primaryBg, color: T.primary }
                      : { backgroundColor: T.border, color: T.textSub }
                    }>
                    {done ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    ) : active ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                      </svg>
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium" style={{ color: done ? T.success : active ? T.text : T.textSub }}>
                        {stage.label}
                        {active && stage.id === 'config' && (
                          <span className="ml-2 text-xs font-normal tabular-nums" style={{ color: T.textSub }}>
                            {checksDone}/{checksTotal}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px]" style={{ color: T.textSub }}>{done ? 'Complete' : active ? 'In progress…' : 'Pending'}</span>
                    </div>
                    {active && stage.id === 'config' && (
                      <div className="mt-1.5 h-1 rounded-full overflow-hidden" style={{ backgroundColor: T.border }}>
                        <div className="h-full rounded-full" style={{ width: `${progress}%`, backgroundColor: T.progress }} />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Live stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                label: 'Checks Passed', value: stats.pass, color: T.success, bg: T.successBg,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.success} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ),
              },
              {
                label: 'Checks Failed', value: stats.fail, color: T.error, bg: T.errorBg,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.error} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                ),
              },
              {
                label: 'Warnings', value: stats.warn, color: T.warning, bg: T.warningBg,
                icon: (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.warning} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                ),
              },
            ].map(s => (
              <div key={s.label} className="p-4 flex items-center gap-3" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: s.bg, color: s.color }}>
                  {s.icon}
                </div>
                <div>
                  <div className="text-2xl font-bold tabular-nums" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[11px]" style={{ color: T.textSub }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
