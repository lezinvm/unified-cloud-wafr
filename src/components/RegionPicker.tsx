import { useEffect, useMemo, useState } from 'react';
import { api, type CloudAccountAccess } from '../services/apiClient';

/** "1 region" / "us-central1, asia-south1" / "All regions". */
export function regionsLabel(regions: string[]): string {
  return regions.length ? regions.join(', ') : 'All regions';
}

/**
 * Real region choice for one cloud account (real-data-only builds).
 * value [] = all regions. Regions come from the backend (provider list plus
 * any region seen in the account's last fetch, with resource counts).
 */
export function RegionPicker({
  cloudAccountId,
  value,
  onChange,
}: {
  cloudAccountId: string | null;
  value: string[];
  onChange: (regions: string[]) => void;
}) {
  const [access, setAccess] = useState<CloudAccountAccess | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'all' | 'some'>(value.length ? 'some' : 'all');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    if (!cloudAccountId) { setAccess(null); return; }
    let cancelled = false;
    setAccess(null);
    setError(null);
    api.getCloudAccountAccess(cloudAccountId)
      .then(a => { if (!cancelled) setAccess(a); })
      .catch(e => { if (!cancelled) setError(e?.message || String(e)); });
    return () => { cancelled = true; };
  }, [cloudAccountId]);

  const list = useMemo(() => {
    if (!access) return [];
    const counts = access.region_resources || {};
    const seen = Object.keys(counts); // most resources first
    const all = [...seen, ...access.regions.filter(r => !counts[r])];
    const f = filter.trim().toLowerCase();
    return f ? all.filter(r => r.includes(f)) : all;
  }, [access, filter]);

  const setAll = (m: 'all' | 'some') => {
    setMode(m);
    if (m === 'all') onChange([]);
  };
  const toggle = (r: string) =>
    onChange(value.includes(r) ? value.filter(x => x !== r) : [...value, r].sort());

  if (!cloudAccountId) return <p className="text-xs text-gray-500">Select a connected account first.</p>;
  if (error) return <p role="alert" className="text-xs text-rose-600">Could not load regions: {error}</p>;
  if (!access) return <p className="text-xs text-gray-500">Loading regions…</p>;

  const hasCounts = Object.keys(access.region_resources || {}).length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div role="radiogroup" aria-label="Region scope" className="flex gap-2">
        {([['all', 'All regions'], ['some', 'Selected regions']] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setAll(m)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${
              mode === m ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'some' && (
        <>
          <div className="flex items-center gap-2">
            <label htmlFor="region-filter" className="sr-only">Filter regions</label>
            <input
              id="region-filter"
              type="search"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Filter regions…"
              className="flex-1 px-3 py-1.5 rounded-lg text-xs border border-gray-200 outline-none focus:border-blue-400"
            />
            <span className="text-[11px] text-gray-500 shrink-0">{value.length} selected</span>
          </div>
          <fieldset className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-1">
            <legend className="sr-only">Regions to include</legend>
            {list.map(r => {
              const n = access.region_resources?.[r];
              const sel = value.includes(r);
              return (
                <label
                  key={r}
                  className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs cursor-pointer ${
                    sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <input type="checkbox" checked={sel} onChange={() => toggle(r)} />
                  <span className="font-mono text-gray-800 truncate">{r}</span>
                  {n ? <span className="ml-auto text-[11px] text-gray-500">{n}</span> : null}
                </label>
              );
            })}
          </fieldset>
          <p className="text-[11px] text-gray-500">
            {hasCounts
              ? 'Numbers are resources found in each region by the last scan of this account.'
              : 'This account has not been scanned yet, so resource counts are not known.'}
          </p>
        </>
      )}

      <p className="text-[11px] text-gray-500">
        IAM, org policies, VPC networks and firewall rules apply to the whole account and are checked in every assessment.
      </p>
    </div>
  );
}
