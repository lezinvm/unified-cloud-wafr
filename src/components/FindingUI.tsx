import { useState } from 'react';

export type Severity = 'critical' | 'high' | 'medium' | 'low';

const lightSeverity: Record<Severity, { bg: string; text: string; dot: string }> = {
  critical: { bg: '#FFF1F2', text: '#E11D48', dot: '#FB7185' },
  high: { bg: '#FFFBEB', text: '#D97706', dot: '#FBBF24' },
  medium: { bg: '#EFF6FF', text: '#2563EB', dot: '#60A5FA' },
  low: { bg: '#ECFDF5', text: '#059669', dot: '#10B981' },
};

const darkSeverity: Record<Severity, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'rgba(251,113,133,.12)', text: '#FECDD3', dot: '#FB7185' },
  high: { bg: 'rgba(251,191,36,.12)', text: '#FDE68A', dot: '#FBBF24' },
  medium: { bg: 'rgba(59,130,246,.12)', text: '#93C5FD', dot: '#60A5FA' },
  low: { bg: 'rgba(82,183,136,.12)', text: '#74C69D', dot: '#74C69D' },
};

export function severityColors(severity: Severity, dark = false) {
  return (dark ? darkSeverity : lightSeverity)[severity];
}

export function SeverityPill({ severity, dark = false }: { severity: Severity; dark?: boolean }) {
  const color = severityColors(severity, dark);
  return <span className="inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize" style={{ backgroundColor: color.bg, color: color.text }}>{severity}</span>;
}

export function StatusDot({ severity, dark = false, className = 'w-1.5 h-1.5' }: { severity: Severity; dark?: boolean; className?: string }) {
  return <span aria-hidden="true" className={`${className} shrink-0 rounded-full`} style={{ backgroundColor: severityColors(severity, dark).dot }} />;
}

export function InlineCode({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <code className="rounded px-1.5 py-0.5 font-mono text-[11px]" style={{ backgroundColor: dark ? 'rgba(148,163,184,.14)' : '#F1F5F9', color: dark ? '#CBD5E1' : '#334155' }}>{children}</code>;
}

type CodeTab = 'cli' | 'tf' | 'cf';
const labels: Record<CodeTab, string> = { cli: 'CLI', tf: 'Terraform', cf: 'CloudFormation' };

export function IaCSnippet({ snippets, dark = false }: { snippets: Record<CodeTab, string>; dark?: boolean }) {
  const [tab, setTab] = useState<CodeTab>('tf');
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const surface = dark ? '#172033' : '#F8FAFC';
  const border = dark ? '#334155' : '#E2E8F0';
  const text = dark ? '#E2E8F0' : '#334155';
  const muted = dark ? '#94A3B8' : '#64748B';

  const copy = async () => {
    try { await navigator.clipboard?.writeText(snippets[tab]); } catch { /* Prototype remains usable without clipboard permission. */ }
    setCopied(true); setTimeout(() => setCopied(false), 1600);
  };
  const regenerate = () => { setRegenerating(true); setTimeout(() => setRegenerating(false), 900); };

  return <div className="mt-3 overflow-hidden" style={{ backgroundColor: surface, border: `1px solid ${border}`, borderRadius: '0.9rem' }}>
    <div className="flex items-center gap-1 border-b p-1.5" style={{ borderColor: border }}>
      {(Object.keys(labels) as CodeTab[]).map(item => <button key={item} onClick={() => setTab(item)} className="rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors" style={tab === item ? { backgroundColor: dark ? '#26354E' : '#E2E8F0', color: text } : { color: muted }}>{labels[item]}</button>)}
    </div>
    <pre className="max-h-72 overflow-auto px-3.5 py-3 text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: text, fontFamily: 'var(--font-mono, ui-monospace, monospace)' }}>{snippets[tab]}</pre>
    <div className="flex justify-end gap-1.5 border-t px-2.5 py-2" style={{ borderColor: border }}>
      <button onClick={copy} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ border: `1px solid ${border}`, color: copied ? (dark ? '#34D399' : '#059669') : muted }}>{copied ? 'Copied' : 'Copy'}</button>
      <button onClick={regenerate} className="rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ border: `1px solid ${border}`, color: muted }}>{regenerating ? 'Regenerating…' : 'Regenerate'}</button>
    </div>
  </div>;
}
