import { useEffect, useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import type { ScanStage } from '../services/apiClient';

const SCOPE_LABEL: Record<string, string> = { gcp: 'Project', aws: 'Account', azure: 'Subscription' };
const FETCHER: Record<string, string> = { gcp: 'gcloud', aws: 'AWS', azure: 'Azure' };

const stagesFor = (provider?: string): { id: ScanStage; label: string; desc: string }[] => [
  { id: 'verify', label: 'Check access', desc: 'Confirms the scanner identity can read this scope' },
  { id: 'fetch', label: 'Fetch cloud data', desc: `Official ${FETCHER[provider || ''] || 'cloud'} MCP server reads every service (read-only)` },
  { id: 'check', label: 'Run checks', desc: 'Check engine evaluates the control catalog against the data' },
  { id: 'load', label: 'Save results', desc: 'Findings, remediations and resources written to the database' },
];

function elapsed(fromIso: string, toIso?: string | null): string {
  const ms = (toIso ? new Date(toIso).getTime() : Date.now()) - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/** Live scan progress, driven by the real scan record from the backend. */
export function LiveScanReal() {
  const { theme, go, activeScan, startLiveScan } = useApp();
  const isDark = theme === 'dark';
  const c = {
    card: isDark ? '#111B2E' : '#FFFFFF',
    border: isDark ? '#1E293B' : '#E2E8F0',
    text: isDark ? '#F1F5F9' : '#0F172A',
    sub: isDark ? '#94A3B8' : '#64748B',
    ok: isDark ? '#52B788' : '#059669',
    err: isDark ? '#FB7185' : '#E11D48',
    run: isDark ? '#3B82F6' : '#2563EB',
  };

  // Re-render every second so the elapsed time moves while running.
  const [, setNow] = useState(0);
  const running = activeScan?.status === 'running' || activeScan?.status === 'queued';
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(n => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  const scan = activeScan;
  const scopeLabel = SCOPE_LABEL[scan?.provider || ''] || 'Scope';
  // Older scan records have no 'verify' stage; don't show it as pending forever.
  const stages = stagesFor(scan?.provider).filter(st => st.id !== 'verify' || scan?.stages?.verify);
  const [copied, setCopied] = useState(false);

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: c.text }}>Live scan</h1>
          <p className="text-sm mt-1" style={{ color: c.sub }}>
            {scan ? `${scopeLabel} ${scan.project}` : 'No scan has been started yet.'}
            {scan && scan.status !== 'queued' && ` · started ${new Date(scan.started_at).toLocaleString()} · ${elapsed(scan.started_at, scan.finished_at)}`}
          </p>
        </div>

        {scan?.status === 'queued' && (
          <div role="status" className="rounded-2xl p-4 text-sm" style={{ background: c.card, border: `1px solid ${c.run}`, color: c.text }}>
            Waiting in the queue. Scans run one at a time and this one starts automatically.
          </div>
        )}

        {scan && (
          <ol className="rounded-2xl flex flex-col" style={{ background: c.card, border: `1px solid ${c.border}` }} aria-label="Scan stages">
            {stages.map((st, i) => {
              const state = scan.stages?.[st.id] || 'pending';
              const color = state === 'done' ? c.ok : state === 'failed' ? c.err : state === 'running' ? c.run : c.sub;
              const icon = state === 'done' ? '✓' : state === 'failed' ? '✕' : state === 'running' ? '…' : String(i + 1);
              return (
                <li key={st.id} className="flex items-start gap-4 p-5" style={{ borderTop: i ? `1px solid ${c.border}` : undefined }}>
                  <span
                    aria-hidden="true"
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${state === 'running' ? 'animate-pulse' : ''}`}
                    style={{ color, border: `2px solid ${color}` }}
                  >
                    {icon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold" style={{ color: c.text }}>
                      {st.label} <span className="sr-only">({state})</span>
                      <span className="ml-2 text-xs font-medium" style={{ color }} aria-hidden="true">{state}</span>
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: c.sub }}>
                      {st.desc}
                      {st.id === 'fetch' && scan.fetch_services ? ` · ${scan.fetch_services} services readable` : ''}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}

        <div role="status" aria-live="polite">
          {scan?.status === 'done' && scan.result && (
            <div className="rounded-2xl p-5 text-sm" style={{ background: c.card, border: `1px solid ${c.ok}`, color: c.text }}>
              Scan finished. Score <strong>{scan.result.score}</strong>, {scan.result.passed} passed,{' '}
              {scan.result.failed} failed, {scan.result.resources} resources.
            </div>
          )}
          {scan?.status === 'failed' && (
            <div className="rounded-2xl p-5 text-sm flex flex-col gap-2" style={{ background: c.card, border: `1px solid ${c.err}`, color: c.text }}>
              <div><strong>Scan failed.</strong> {scan.error}</div>
              {scan.access_hint && (
                <div className="flex flex-col gap-2">
                  <div className="font-medium">How to fix</div>
                  <pre className="text-xs whitespace-pre-wrap break-all p-3 rounded-lg" style={{ background: isDark ? '#0B1220' : '#F8FAFC', color: c.text }}>
                    {scan.access_hint}
                  </pre>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(scan.access_hint || '');
                      setCopied(true);
                      window.setTimeout(() => setCopied(false), 2000);
                    }}
                    className="self-start px-3 py-1.5 rounded-lg text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
                    style={{ border: `1px solid ${c.border}`, color: c.text }}
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <div style={{ color: c.sub }}>Then press "Scan again".</div>
                </div>
              )}
              <div style={{ color: c.sub }}>Previous results were not changed.</div>
              {scan.log_tail && (
                <pre className="text-[11px] overflow-auto max-h-48 p-3 rounded-lg" style={{ background: isDark ? '#0B1220' : '#F8FAFC', color: c.sub }}>
                  {scan.log_tail}
                </pre>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => go('report')}
            disabled={running}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            {running ? 'Scanning…' : 'View results'}
          </button>
          {!running && scan && (
            <button
              type="button"
              onClick={() => startLiveScan(scan.assessment_id)}
              className="px-4 py-2 rounded-lg text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
              style={{ border: `1px solid ${c.border}`, color: c.text }}
            >
              Scan again
            </button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
