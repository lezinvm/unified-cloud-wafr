import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { api } from '../services/apiClient';

type ReqStatus = 'fail' | 'not_assessed' | 'pass' | 'not_applicable';

interface ReqControl {
  control_id: string;
  title: string;
  severity: string;
  verdict: 'PASS' | 'FAIL' | 'UNKNOWN' | 'NOT_APPLICABLE' | 'NOT_IMPLEMENTED';
  failing_resources: number;
}
interface Requirement {
  id: string;
  status: ReqStatus;
  level: string | null;
  converted_from: string[] | null;
  controls: ReqControl[];
}
interface FrameworkScore {
  id: string;
  framework_id: string;
  short_name: string;
  name: string;
  version: string | null;
  mapping_note: string | null;
  score: number | null;
  coverage: number | null;
  total_requirements: number;
  passed: number;
  failed: number;
  not_assessed: number;
  not_applicable: number;
  controls_passed: number;
  controls_failed: number;
  controls_unassessed: number;
  controls_total: number;
  control_pass_rate: number | null;
  generated_at: string;
  requirements: Requirement[];
}

const STATUS_LABEL: Record<ReqStatus, string> = {
  fail: 'Failing',
  not_assessed: 'Not assessed',
  pass: 'Passing',
  not_applicable: 'Not applicable',
};
const VERDICT_LABEL: Record<ReqControl['verdict'], string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  UNKNOWN: 'Not assessed',
  NOT_IMPLEMENTED: 'Not assessed',
  NOT_APPLICABLE: 'N/A',
};

/** Compliance from real scan results: CIS, SOC 2, ISO 27001:2022, HIPAA. */
export function ComplianceReal() {
  const { theme, currentAssessment, goToAIFix } = useApp();
  const isDark = theme === 'dark';
  const c = {
    bg: isDark ? '#0B1220' : '#F8FAFC',
    card: isDark ? '#111B2E' : '#FFFFFF',
    border: isDark ? '#1E293B' : '#E2E8F0',
    text: isDark ? '#F1F5F9' : '#0F172A',
    sub: isDark ? '#94A3B8' : '#64748B',
    fail: isDark ? '#FB7185' : '#BE123C',
    pass: isDark ? '#52B788' : '#047857',
    warn: isDark ? '#FBBF24' : '#B45309',
    muted: isDark ? '#64748B' : '#94A3B8',
    accent: isDark ? '#3B82F6' : '#2563EB',
  };
  const statusColor: Record<ReqStatus, string> = { fail: c.fail, not_assessed: c.warn, pass: c.pass, not_applicable: c.muted };

  const [scores, setScores] = useState<FrameworkScore[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>('');
  const [filter, setFilter] = useState<'all' | ReqStatus>('all');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const assessmentId = currentAssessment?.id;
  useEffect(() => {
    let cancelled = false;
    setScores(null);
    setError(null);
    if (!assessmentId) { setScores([]); return; }
    api.getComplianceScores(assessmentId)
      .then(rows => {
        if (cancelled) return;
        const order = ['cis', 'soc2', 'iso27001', 'hipaa'];
        const list = (rows as FrameworkScore[]).sort((a, b) => order.indexOf(a.framework_id) - order.indexOf(b.framework_id));
        setScores(list);
        setSelected(prev => (list.some(s => s.framework_id === prev) ? prev : list[0]?.framework_id || ''));
      })
      .catch(e => { if (!cancelled) setError(e?.message || 'Could not load compliance scores'); });
    return () => { cancelled = true; };
  }, [assessmentId]);

  const fw = useMemo(() => scores?.find(s => s.framework_id === selected) || null, [scores, selected]);
  const reqs = useMemo(
    () => (fw ? fw.requirements.filter(r => filter === 'all' || r.status === filter) : []),
    [fw, filter],
  );

  const pct = (v: number | null) => (v === null || v === undefined ? '—' : `${v}%`);

  return (
    <AppLayout>
      <div className="h-full overflow-y-auto" style={{ background: c.bg, color: c.text }}>
        <div className="max-w-6xl mx-auto p-6 flex flex-col gap-5">
          <header>
            <h1 className="text-xl font-semibold">Compliance</h1>
            <p className="text-sm mt-1" style={{ color: c.sub }}>
              {currentAssessment
                ? <>From the latest scan of <strong style={{ color: c.text }}>{currentAssessment.accountName}</strong>
                    {fw?.generated_at ? ` · ${new Date(fw.generated_at).toLocaleString()}` : ''}</>
                : 'Select an assessment to see its compliance.'}
            </p>
          </header>

          {error && <div role="alert" className="text-sm p-3 rounded-lg" style={{ border: `1px solid ${c.fail}`, color: c.fail }}>{error}</div>}
          {scores === null && !error && <p className="text-sm" style={{ color: c.sub }}>Loading…</p>}
          {scores && scores.length === 0 && !error && (
            <p className="text-sm p-4 rounded-xl" style={{ background: c.card, border: `1px solid ${c.border}`, color: c.sub }}>
              No compliance results for this assessment yet. Run a scan to generate them.
            </p>
          )}

          {scores && scores.length > 0 && (
            <>
              {/* Framework cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3" role="tablist" aria-label="Frameworks">
                {scores.map(s => {
                  const active = s.framework_id === selected;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => { setSelected(s.framework_id); setFilter('all'); }}
                      className="text-left rounded-2xl p-4 flex flex-col gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                      style={{ background: c.card, border: `2px solid ${active ? c.accent : c.border}`, outlineColor: c.accent }}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{s.short_name}</span>
                        <span className="text-2xl font-bold">{pct(s.score)}</span>
                      </div>
                      <div className="text-xs" style={{ color: c.sub }}>{s.name}{s.version ? ` · ${s.version}` : ''}</div>
                      <div className="text-xs flex flex-wrap gap-x-3 gap-y-1">
                        <span style={{ color: c.fail }}>{s.failed} failing</span>
                        <span style={{ color: c.pass }}>{s.passed} passing</span>
                        <span style={{ color: c.warn }}>{s.not_assessed} not assessed</span>
                      </div>
                      <div className="text-xs" style={{ color: c.sub }}>
                        Coverage {pct(s.coverage)} · controls passing {pct(s.control_pass_rate)}
                      </div>
                    </button>
                  );
                })}
              </div>

              {fw && (
                <section className="rounded-2xl" style={{ background: c.card, border: `1px solid ${c.border}` }} aria-label={`${fw.short_name} requirements`}>
                  <div className="p-4 flex flex-col gap-2" style={{ borderBottom: `1px solid ${c.border}` }}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <h2 className="font-semibold">{fw.name} requirements</h2>
                      <label className="text-sm flex items-center gap-2" style={{ color: c.sub }}>
                        Show
                        <select
                          value={filter}
                          onChange={e => setFilter(e.target.value as any)}
                          className="rounded-lg px-2 py-1 text-sm"
                          style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                        >
                          <option value="all">All ({fw.total_requirements})</option>
                          <option value="fail">Failing ({fw.failed})</option>
                          <option value="not_assessed">Not assessed ({fw.not_assessed})</option>
                          <option value="pass">Passing ({fw.passed})</option>
                          <option value="not_applicable">Not applicable ({fw.not_applicable})</option>
                        </select>
                      </label>
                    </div>
                    <p className="text-xs" style={{ color: c.sub }}>
                      A requirement fails if any of its controls fails. "Not assessed" means the scan couldn't decide a
                      control, so it isn't counted as passing. Score = passing ÷ (passing + failing); coverage = share of
                      requirements the scan could decide. Policy, procedure and training requirements need manual
                      evidence and aren't covered.
                    </p>
                    {fw.mapping_note && (
                      <p className="text-xs" style={{ color: c.warn }}>Note: {fw.mapping_note}</p>
                    )}
                  </div>

                  <ul>
                    {reqs.map(r => {
                      const key = `${fw.framework_id}:${r.id}`;
                      const expanded = !!open[key];
                      const failing = r.controls.filter(x => x.verdict === 'FAIL').length;
                      return (
                        <li key={key} style={{ borderTop: `1px solid ${c.border}` }}>
                          <button
                            type="button"
                            aria-expanded={expanded}
                            onClick={() => setOpen(o => ({ ...o, [key]: !o[key] }))}
                            className="w-full text-left p-4 flex items-center gap-3 focus-visible:outline focus-visible:outline-2"
                            style={{ outlineColor: c.accent }}
                          >
                            <span className="font-mono text-sm w-40 shrink-0">{r.id}</span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0"
                                  style={{ color: statusColor[r.status], border: `1px solid ${statusColor[r.status]}` }}>
                              {STATUS_LABEL[r.status]}
                            </span>
                            <span className="text-sm flex-1 min-w-0" style={{ color: c.sub }}>
                              {r.controls.length} control{r.controls.length === 1 ? '' : 's'}
                              {failing ? ` · ${failing} failing` : ''}
                              {r.level ? ` · ${r.level}` : ''}
                              {r.converted_from ? ` · from ISO 27001:2013 ${r.converted_from.join(', ')}` : ''}
                            </span>
                            <span aria-hidden="true" style={{ color: c.sub }}>{expanded ? '▾' : '▸'}</span>
                          </button>
                          {expanded && (
                            <table className="w-full text-sm mb-3">
                              <caption className="sr-only">Controls mapped to {r.id}</caption>
                              <thead>
                                <tr className="text-xs" style={{ color: c.sub }}>
                                  <th scope="col" className="text-left font-medium pl-8 py-1">Control</th>
                                  <th scope="col" className="text-left font-medium py-1">Severity</th>
                                  <th scope="col" className="text-left font-medium py-1">Result</th>
                                  <th scope="col" className="text-left font-medium py-1 pr-4">Failing resources</th>
                                </tr>
                              </thead>
                              <tbody>
                                {r.controls.map(ctl => (
                                  <tr key={ctl.control_id}>
                                    <td className="pl-8 py-1.5 pr-3">
                                      <span className="font-mono text-xs mr-2">{ctl.control_id}</span>{ctl.title}
                                    </td>
                                    <td className="py-1.5 capitalize" style={{ color: c.sub }}>{ctl.severity}</td>
                                    <td className="py-1.5" style={{
                                      color: ctl.verdict === 'FAIL' ? c.fail : ctl.verdict === 'PASS' ? c.pass
                                        : ctl.verdict === 'NOT_APPLICABLE' ? c.muted : c.warn,
                                    }}>{VERDICT_LABEL[ctl.verdict]}</td>
                                    <td className="py-1.5 pr-4">
                                      {ctl.verdict === 'FAIL' ? (
                                        <button
                                          type="button"
                                          onClick={() => goToAIFix(ctl.control_id)}
                                          className="underline focus-visible:outline focus-visible:outline-2"
                                          style={{ color: c.accent, outlineColor: c.accent }}
                                        >
                                          {ctl.failing_resources} · fix
                                        </button>
                                      ) : '—'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </li>
                      );
                    })}
                    {reqs.length === 0 && (
                      <li className="p-4 text-sm" style={{ color: c.sub }}>No requirements with this status.</li>
                    )}
                  </ul>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
