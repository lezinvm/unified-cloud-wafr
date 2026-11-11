import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { api, type CloudAccountAccess, type Environment } from '../services/apiClient';

const ENVIRONMENTS: { id: Environment; label: string; sub: string }[] = [
  { id: 'dev', label: 'Dev', sub: 'Development / Sandbox' },
  { id: 'pre-prod', label: 'Pre-Prod', sub: 'Staging / UAT / QA' },
  { id: 'prod', label: 'Prod', sub: 'Production Live' },
];
const SCOPE_LABEL: Record<string, string> = { gcp: 'Project', aws: 'Account', azure: 'Subscription' };

/**
 * New assessment (real-data-only build): one cloud account + environment +
 * regions, then a real scan. One account can have many assessments.
 * Account-wide settings (IAM, org policy...) are checked in every assessment.
 */
export function NewAssessmentReal() {
  const { theme, go, cloudAccounts, startAccountScan, newAssessmentAccountId, setNewAssessmentAccountId } = useApp();
  const isDark = theme === 'dark';
  const c = {
    card: isDark ? '#111B2E' : '#FFFFFF',
    border: isDark ? '#1E293B' : '#E2E8F0',
    text: isDark ? '#F1F5F9' : '#0F172A',
    sub: isDark ? '#94A3B8' : '#64748B',
    field: isDark ? '#0B1220' : '#FFFFFF',
    sel: isDark ? '#3B82F6' : '#2563EB',
    selBg: isDark ? 'rgba(59,130,246,0.12)' : '#EFF6FF',
    err: isDark ? '#FB7185' : '#E11D48',
  };

  const accounts = Array.isArray(cloudAccounts) ? cloudAccounts : [];
  const [accountId, setAccountId] = useState<string>(newAssessmentAccountId || accounts[0]?.id || '');
  const [environment, setEnvironment] = useState<Environment | null>(null);
  const [allRegions, setAllRegions] = useState(true);
  const [regions, setRegions] = useState<string[]>([]);
  const [name, setName] = useState('');
  const [access, setAccess] = useState<CloudAccountAccess | null>(null);
  const [accessError, setAccessError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Preselection is used once.
  useEffect(() => () => setNewAssessmentAccountId(null), []);
  useEffect(() => {
    if (!accountId && accounts[0]?.id) setAccountId(accounts[0].id);
  }, [accounts.length]);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    setAccess(null);
    setAccessError(null);
    setRegions([]);
    api.getCloudAccountAccess(accountId)
      .then(a => { if (!cancelled) setAccess(a); })
      .catch(e => { if (!cancelled) setAccessError(e?.message || String(e)); });
    return () => { cancelled = true; };
  }, [accountId]);

  const account = accounts.find(a => a.id === accountId);
  const scopeLabel = SCOPE_LABEL[access?.provider || account?.cloud || ''] || 'Scope';

  // Regions with resources (from the last fetch) first, then the rest.
  const regionList = useMemo(() => {
    if (!access) return [];
    // Regions seen in the fetch are offered even if the static list lags behind.
    const counts = access.region_resources || {};
    const withRes = Object.keys(counts);
    return [...withRes, ...access.regions.filter(r => !counts[r])];
  }, [access]);

  const toggleRegion = (r: string) =>
    setRegions(prev => (prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]));

  const blocker =
    !account ? 'Add a cloud account in Settings first.'
    : accessError ? accessError
    : !access ? 'Loading account…'
    : !access.can_scan ? `Live scanning is not available for ${account.cloud?.toUpperCase()} yet.`
    : !access.valid_scope ? `This account has no valid ${scopeLabel.toLowerCase()} id. Edit it in Settings.`
    : !environment ? 'Choose an environment.'
    : !allRegions && regions.length === 0 ? 'Pick at least one region, or choose all regions.'
    : null;

  const start = async () => {
    if (blocker || !environment) return;
    setSubmitting(true);
    const ok = await startAccountScan(accountId, {
      name: name.trim() || undefined,
      environment,
      regions: allRegions ? [] : regions,
    });
    setSubmitting(false);
    if (ok) go('live-scan');
  };

  const box = { background: c.card, border: `1px solid ${c.border}` };
  const btnFocus = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';

  return (
    <AppLayout>
      <div className="p-8 max-w-3xl mx-auto flex flex-col gap-5">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: c.text }}>New assessment</h1>
          <p className="text-sm mt-1" style={{ color: c.sub }}>
            One cloud account can have several assessments, for example per environment or region.
            Account-wide settings such as IAM are checked in every assessment.
          </p>
        </div>

        {/* 1. Account */}
        <section className="rounded-2xl p-5 flex flex-col gap-3" style={box}>
          <label htmlFor="na-account" className="text-sm font-semibold" style={{ color: c.text }}>
            1. Cloud account <span aria-hidden="true" style={{ color: c.err }}>*</span>
          </label>
          {accounts.length === 0 ? (
            <div className="text-sm" style={{ color: c.sub }}>
              No cloud accounts yet.{' '}
              <button type="button" onClick={() => go('settings')} className={`underline ${btnFocus}`} style={{ color: c.sel }}>
                Add one in Settings
              </button>
            </div>
          ) : (
            <select
              id="na-account"
              value={accountId}
              onChange={e => setAccountId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm"
              style={{ background: c.field, border: `1px solid ${c.border}`, color: c.text }}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {(a.cloud || '').toUpperCase()} · {a.account_name || a.id}
                  {a.gcp_project ? ` (${a.gcp_project})` : a.account_identifier && a.account_identifier !== a.id ? ` (${a.account_identifier})` : ''}
                </option>
              ))}
            </select>
          )}
          {access && (
            <div className="text-xs" style={{ color: c.sub }}>
              {scopeLabel}: <span className="font-mono">{access.scope || 'not set'}</span>
              {access.last_fetched_at ? ` · last fetched ${new Date(access.last_fetched_at).toLocaleString()}` : ' · never scanned'}
            </div>
          )}
        </section>

        {/* 2. Environment */}
        <section className="rounded-2xl p-5 flex flex-col gap-3" style={box}>
          <div className="flex items-center justify-between">
            <span id="na-env" className="text-sm font-semibold" style={{ color: c.text }}>
              2. Account type / environment <span aria-hidden="true" style={{ color: c.err }}>*</span>
            </span>
            <span className="text-xs" style={{ color: c.sub }}>Workload lifecycle environment</span>
          </div>
          <div role="radiogroup" aria-labelledby="na-env" className="grid grid-cols-3 gap-3">
            {ENVIRONMENTS.map(env => {
              const sel = environment === env.id;
              return (
                <button
                  key={env.id}
                  type="button"
                  role="radio"
                  aria-checked={sel}
                  onClick={() => setEnvironment(env.id)}
                  className={`p-3 rounded-xl text-left flex flex-col gap-0.5 ${btnFocus}`}
                  style={{ border: `${sel ? 2 : 1}px solid ${sel ? c.sel : c.border}`, background: sel ? c.selBg : 'transparent' }}
                >
                  <span className="text-sm font-semibold" style={{ color: c.text }}>{env.label}</span>
                  <span className="text-xs" style={{ color: c.sub }}>{env.sub}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. Regions */}
        <section className="rounded-2xl p-5 flex flex-col gap-3" style={box}>
          <span id="na-regions" className="text-sm font-semibold" style={{ color: c.text }}>
            3. Regions <span aria-hidden="true" style={{ color: c.err }}>*</span>
          </span>
          <div role="radiogroup" aria-labelledby="na-regions" className="flex gap-3">
            {[{ v: true, l: 'All regions' }, { v: false, l: 'Selected regions' }].map(o => (
              <button
                key={o.l}
                type="button"
                role="radio"
                aria-checked={allRegions === o.v}
                onClick={() => setAllRegions(o.v)}
                className={`px-3 py-1.5 rounded-lg text-sm ${btnFocus}`}
                style={{ border: `1px solid ${allRegions === o.v ? c.sel : c.border}`, background: allRegions === o.v ? c.selBg : 'transparent', color: c.text }}
              >
                {o.l}
              </button>
            ))}
          </div>
          {!allRegions && access && (
            <>
              <p className="text-xs" style={{ color: c.sub }}>
                {Object.keys(access.region_resources || {}).length
                  ? 'Resource counts come from the last fetch of this account.'
                  : 'No fetch of this account yet, so resource counts are unknown.'}
              </p>
              <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-auto pr-1">
                <legend className="sr-only">Regions to include</legend>
                {regionList.map(r => {
                  const n = access.region_resources?.[r];
                  return (
                    <label key={r} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded-lg cursor-pointer"
                      style={{ border: `1px solid ${regions.includes(r) ? c.sel : c.border}`, color: c.text }}>
                      <input type="checkbox" checked={regions.includes(r)} onChange={() => toggleRegion(r)} />
                      <span className="font-mono text-xs">{r}</span>
                      {n ? <span className="ml-auto text-xs" style={{ color: c.sub }}>{n}</span> : null}
                    </label>
                  );
                })}
              </fieldset>
            </>
          )}
          <p className="text-xs" style={{ color: c.sub }}>
            Global and account-wide resources (IAM, org policies, VPC networks, firewall rules) are always included.
          </p>
        </section>

        {/* 4. Name */}
        <section className="rounded-2xl p-5 flex flex-col gap-2" style={box}>
          <label htmlFor="na-name" className="text-sm font-semibold" style={{ color: c.text }}>4. Assessment name</label>
          <input
            id="na-name"
            type="text"
            maxLength={120}
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={`${account?.account_name || 'Account'} — ${ENVIRONMENTS.find(e => e.id === environment)?.label || 'Env'} — ${allRegions ? 'All regions' : regions.join(', ') || 'regions'}`}
            className="w-full px-3 py-2 rounded-xl text-sm"
            style={{ background: c.field, border: `1px solid ${c.border}`, color: c.text }}
          />
          <p className="text-xs" style={{ color: c.sub }}>Optional. Leave empty to use the name shown.</p>
        </section>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={Boolean(blocker) || submitting}
            className={`px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 ${btnFocus}`}
          >
            {submitting ? 'Starting…' : 'Create and scan'}
          </button>
          <button type="button" onClick={() => go('assessment-list')} className={`px-4 py-2 rounded-lg text-sm ${btnFocus}`}
            style={{ border: `1px solid ${c.border}`, color: c.text }}>
            Cancel
          </button>
          {blocker && <span role="status" className="text-xs" style={{ color: c.sub }}>{blocker}</span>}
        </div>
      </div>
    </AppLayout>
  );
}
