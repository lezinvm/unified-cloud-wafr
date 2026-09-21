import { useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { CloudChip, CloudId } from '../components/CloudLogo';

const LIGHT = { bg:'#F8FAFC', card:'#FFFFFF', border:'#E2E8F0', text:'#0F172A', textSub:'#64748B', primary:'#2563EB', primaryBg:'#EFF6FF', success:'#059669', successBg:'#ECFDF5', successBar:'#10B981', error:'#E11D48', errorBg:'#FFF1F2', errorBar:'#FB7185', warning:'#D97706', warningBg:'#FFFBEB', warningBar:'#FBBF24', muted:'#94A3B8', progress:'#10B981', activeNavBg:'#EFF6FF', shadow:'0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)', shadowMd:'0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)' };
const DARK  = { bg:'#0B1220', card:'#111B2E', border:'#1E293B', text:'#F1F5F9', textSub:'#94A3B8', primary:'#3B82F6', primaryBg:'rgba(59,130,246,.15)', success:'#52B788', successBg:'rgba(82,183,136,.12)', successBar:'rgba(82,183,136,.75)', error:'#FB7185', errorBg:'rgba(251,113,133,.12)', errorBar:'rgba(251,113,133,.65)', warning:'#FBBF24', warningBg:'rgba(251,191,36,.12)', warningBar:'rgba(251,191,36,.65)', muted:'#94A3B8', progress:'#52B788', activeNavBg:'rgba(59,130,246,.12)', shadow:'0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)', shadowMd:'0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)' };

type Tokens = typeof LIGHT;

const SIDEBAR: { id: string; label: string; icon: (color: string) => React.ReactNode }[] = [
  {
    id: 'config',
    label: 'Cloud Config',
    icon: (c) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    ),
  },
  {
    id: 'retention',
    label: 'Data Retention',
    icon: (c) => (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="9" ry="3"/>
        <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/>
        <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>
      </svg>
    ),
  },
];

const CLOUD_CONFIGS = [
  { cloud: 'AWS', name: 'acme-production (12 accounts)', method: 'IAM Role / Cross-Account', status: 'active', lastSync: '2h ago' },
  { cloud: 'Azure', name: 'Acme Corp Tenant (8 subscriptions)', method: 'Service Principal', status: 'active', lastSync: '1d ago' },
  { cloud: 'GCP', name: 'acme-org (4 projects)', method: 'Service Account', status: 'warning', lastSync: '3d ago' },
];

function RetentionPanel({ T, isDark }: { T: Tokens; isDark: boolean }) {
  const [rawDays, setRawDays] = useState(60);
  const [findingsDays, setFindingsDays] = useState(365);
  const [autoDelete, setAutoDelete] = useState(true);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-semibold text-lg" style={{ color: T.text }}>Data Retention Rules</h2>
        <p className="text-sm mt-1" style={{ color: T.textSub }}>Control how long raw configuration snapshots and findings data are stored.</p>
      </div>

      {/* Raw config retention */}
      <div className="p-5 flex flex-col gap-5" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold" style={{ color: T.text }}>Raw Configuration Snapshots</h3>
            <p className="text-sm mt-0.5" style={{ color: T.textSub }}>Full API responses from cloud provider enumeration. Stored encrypted in your configured backend.</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: T.warningBg, color: T.warning }}>Storage-heavy</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: T.textSub }}>Retention period</span>
            <span className="font-semibold" style={{ color: T.primary }}>{rawDays} days</span>
          </div>
          <input type="range" min={7} max={365} value={rawDays} onChange={e => setRawDays(+e.target.value)}
            className="w-full" style={{ accentColor: T.primary }} />
          <div className="flex justify-between text-[10px]" style={{ color: T.textSub }}>
            <span>7 days (min)</span><span>90 days</span><span>1 year</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          {[
            { label: 'Current usage', value: '47.2 GB' },
            { label: 'Est. monthly cost', value: '$1.12' },
            { label: 'Next purge', value: 'Oct 17, 2026' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3" style={{ backgroundColor: isDark ? 'rgba(0,0,0,.2)' : '#F8FAFC' }}>
              <div className="font-semibold text-base" style={{ color: T.text }}>{s.value}</div>
              <div className="text-[10px] mt-0.5" style={{ color: T.textSub }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Findings retention */}
      <div className="p-5 flex flex-col gap-5" style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: '1.25rem' }}>
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold" style={{ color: T.text }}>Findings & Reports</h3>
            <p className="text-sm mt-0.5" style={{ color: T.textSub }}>Processed findings, pillar scores, questionnaire answers, and PDF reports.</p>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: T.successBg, color: T.success }}>Low overhead</span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: T.textSub }}>Retention period</span>
            <span className="font-semibold" style={{ color: T.primary }}>{findingsDays >= 365 ? '1 year' : `${findingsDays} days`}</span>
          </div>
          <input type="range" min={30} max={730} value={findingsDays} onChange={e => setFindingsDays(+e.target.value)}
            className="w-full" style={{ accentColor: T.primary }} />
          <div className="flex justify-between text-[10px]" style={{ color: T.textSub }}>
            <span>30 days</span><span>1 year</span><span>2 years</span>
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer">
          <div className="w-10 h-5 rounded-full transition-colors relative"
            style={{ backgroundColor: autoDelete ? T.primary : T.border }}
            onClick={() => setAutoDelete(!autoDelete)}>
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${autoDelete ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <div>
            <div className="text-sm font-medium" style={{ color: T.text }}>Auto-delete on schedule</div>
            <div className="text-xs" style={{ color: T.textSub }}>Run deletion job daily at 02:00 UTC</div>
          </div>
        </label>
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="px-4 py-2.5 text-sm rounded-full transition-colors cursor-pointer"
          style={{ border: `1px solid ${T.border}`, color: T.textSub }}
          onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
          onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
        >
          Reset to Defaults
        </button>
        <button
          type="button"
          className="px-5 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
          style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)', color: '#FFFFFF' }}
        >
          Save Retention Rules
        </button>
      </div>
    </div>
  );
}

interface CloudConfigItem {
  id: string;
  cloud: 'AWS' | 'Azure' | 'GCP';
  name: string;
  method: string;
  authType: string;
  status: 'active' | 'warning' | 'paused';
  lastSync: string;
  roleArn?: string;
  externalId?: string;
  accessKey?: string;
  secretKey?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string;
  gcpProject?: string;
  saEmail?: string;
  autoSync: boolean;
  syncIntervalHours: number;
}

const INITIAL_CLOUD_CONFIGS: CloudConfigItem[] = [
  {
    id: 'cfg-aws-01',
    cloud: 'AWS',
    name: 'acme-production (12 accounts)',
    method: 'IAM Role / Cross-Account',
    authType: 'role',
    status: 'active',
    lastSync: '2h ago',
    roleArn: 'arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole',
    externalId: 'cfops-wafr-tenant-9941',
    autoSync: true,
    syncIntervalHours: 6,
  },
  {
    id: 'cfg-az-01',
    cloud: 'Azure',
    name: 'Acme Corp Tenant (8 subscriptions)',
    method: 'Service Principal',
    authType: 'sp',
    status: 'active',
    lastSync: '1d ago',
    tenantId: '72f988bf-86f1-41af-91ab-2d7cd011db47',
    clientId: 'e892c901-44bb-4e31-8902-124890123456',
    autoSync: true,
    syncIntervalHours: 24,
  },
  {
    id: 'cfg-gcp-01',
    cloud: 'GCP',
    name: 'acme-org (4 projects)',
    method: 'Service Account',
    authType: 'sa',
    status: 'warning',
    lastSync: '3d ago',
    gcpProject: 'acme-gcp-prod-9941',
    saEmail: 'wafr-scanner@acme-gcp-prod.iam.gserviceaccount.com',
    autoSync: false,
    syncIntervalHours: 12,
  },
];

function EditCloudConfigModal({
  config,
  isCreating,
  isDark,
  T,
  onClose,
  onSave,
}: {
  config: CloudConfigItem;
  isCreating: boolean;
  isDark: boolean;
  T: Tokens;
  onClose: () => void;
  onSave: (saved: CloudConfigItem) => void;
}) {
  const [formData, setFormData] = useState<CloudConfigItem>({ ...config });
  const [testState, setTestState] = useState<'idle' | 'testing' | 'success'>('idle');

  const handleCloudChange = (c: 'AWS' | 'Azure' | 'GCP') => {
    setTestState('idle');
    if (c === 'AWS') {
      setFormData(prev => ({
        ...prev,
        cloud: 'AWS',
        method: 'IAM Role / Cross-Account',
        authType: 'role',
        roleArn: prev.roleArn || 'arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole',
        externalId: prev.externalId || 'cfops-wafr-9941',
      }));
    } else if (c === 'Azure') {
      setFormData(prev => ({
        ...prev,
        cloud: 'Azure',
        method: 'Service Principal',
        authType: 'sp',
        tenantId: prev.tenantId || '72f988bf-86f1-41af-91ab-2d7cd011db47',
        clientId: prev.clientId || 'e892c901-44bb-4e31-8902-124890123456',
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        cloud: 'GCP',
        method: 'Service Account',
        authType: 'sa',
        gcpProject: prev.gcpProject || 'acme-gcp-prod-9941',
        saEmail: prev.saEmail || 'wafr-scanner@acme-gcp-prod.iam.gserviceaccount.com',
      }));
    }
  };

  const handleTestConnection = () => {
    setTestState('testing');
    setTimeout(() => {
      setTestState('success');
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal dialog */}
      <div
        className="relative w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] z-10"
        style={{
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4.5 border-b flex items-center justify-between shrink-0"
          style={{ borderColor: T.border }}
        >
          <div>
            <h2 className="text-base font-bold" style={{ color: T.text }}>
              {isCreating ? 'Add Cloud Configuration' : 'Edit Cloud Configuration'}
            </h2>
            <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
              Configure cloud provider authentication credentials and sync options.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors cursor-pointer"
            style={{ color: T.textSub }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : '#F1F5F9')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            ×
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-5 flex-1 text-xs">
          {/* Cloud Platform Selection (Only visible when adding a new configuration) */}
          {isCreating ? (
            <div className="flex flex-col gap-1.5">
              <label className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: T.textSub }}>
                Cloud Provider <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(['AWS', 'Azure', 'GCP'] as const).map(c => {
                  const isSel = formData.cloud === c;
                  const cloudId = c.toLowerCase() as CloudId;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => handleCloudChange(c)}
                      className="p-3 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer text-left"
                      style={{
                        borderColor: isSel ? '#2563EB' : T.border,
                        backgroundColor: isSel ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF') : (isDark ? '#111B2E' : '#FFFFFF'),
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <CloudChip id={cloudId} size="sm" isDark={isDark} />
                        <span className="font-bold text-xs" style={{ color: isSel ? (isDark ? '#93C5FD' : '#1D4ED8') : T.text }}>
                          {c}
                        </span>
                      </div>
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: isSel ? '#2563EB' : '#94A3B8' }}
                      >
                        {isSel && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-between p-3.5 rounded-2xl"
              style={{
                backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC',
                border: `1px solid ${T.border}`,
              }}
            >
              <div className="flex items-center gap-3">
                <CloudChip id={formData.cloud.toLowerCase() as CloudId} size="sm" isDark={isDark} />
                <div>
                  <div className="font-semibold text-xs" style={{ color: T.text }}>
                    {formData.cloud === 'AWS'
                      ? 'Amazon Web Services (AWS)'
                      : formData.cloud === 'Azure'
                      ? 'Microsoft Azure'
                      : 'Google Cloud Platform (GCP)'}
                  </div>
                  <div className="text-[10px]" style={{ color: T.textSub }}>
                    Cloud Provider · Configured in environment
                  </div>
                </div>
              </div>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#E2E8F0',
                  color: T.textSub,
                }}
              >
                Fixed
              </span>
            </div>
          )}

          {/* Configuration Name */}
          <div className="flex flex-col gap-1.5">
            <label className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: T.textSub }}>
              Configuration Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. acme-production (12 accounts)"
              className="w-full px-3.5 py-2.5 rounded-xl text-xs outline-none transition-all"
              style={{
                backgroundColor: isDark ? '#0B1220' : '#FFFFFF',
                border: `1px solid ${T.border}`,
                color: T.text,
              }}
              onFocus={e => (e.currentTarget.style.borderColor = '#2563EB')}
              onBlur={e => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>

          {/* Authentication Method Selector */}
          <div className="flex flex-col gap-2.5 p-4 rounded-2xl" style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC', border: `1px solid ${T.border}` }}>
            <div className="flex items-center justify-between">
              <label className="font-semibold uppercase tracking-wider text-[11px]" style={{ color: T.primary }}>
                Authentication Credentials <span className="text-red-400">*</span>
              </label>
              <span className="text-[10px]" style={{ color: T.textSub }}>Read-only evaluation</span>
            </div>

            {/* AWS Auth Options */}
            {formData.cloud === 'AWS' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: 'role', method: 'IAM Role / Cross-Account' })}
                    className="p-2.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{
                      borderColor: formData.authType === 'role' ? '#2563EB' : T.border,
                      backgroundColor: formData.authType === 'role' ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF') : (isDark ? '#111B2E' : '#FFFFFF'),
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: formData.authType === 'role' ? '#2563EB' : '#94A3B8' }}>
                        {formData.authType === 'role' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      </div>
                      <span className="font-semibold" style={{ color: formData.authType === 'role' ? (isDark ? '#93C5FD' : '#1D4ED8') : T.text }}>IAM Role</span>
                    </div>
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">Rec.</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, authType: 'keys', method: 'Access Keys' })}
                    className="p-2.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{
                      borderColor: formData.authType === 'keys' ? '#2563EB' : T.border,
                      backgroundColor: formData.authType === 'keys' ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF') : (isDark ? '#111B2E' : '#FFFFFF'),
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center" style={{ borderColor: formData.authType === 'keys' ? '#2563EB' : '#94A3B8' }}>
                        {formData.authType === 'keys' && <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
                      </div>
                      <span className="font-semibold" style={{ color: formData.authType === 'keys' ? (isDark ? '#93C5FD' : '#1D4ED8') : T.text }}>Access Keys</span>
                    </div>
                  </button>
                </div>

                {formData.authType === 'role' ? (
                  <div className="flex flex-col gap-2.5 mt-1">
                    <div>
                      <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                        Target IAM Role ARN
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.roleArn || ''}
                        onChange={e => setFormData({ ...formData, roleArn: e.target.value })}
                        placeholder="arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole"
                        className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none"
                        style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                        External ID
                      </label>
                      <input
                        type="text"
                        value={formData.externalId || ''}
                        onChange={e => setFormData({ ...formData, externalId: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none opacity-90"
                        style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                        Access Key ID
                      </label>
                      <input
                        type="text"
                        value={formData.accessKey || ''}
                        onChange={e => setFormData({ ...formData, accessKey: e.target.value })}
                        placeholder="AKIAIOSFODNN7EXAMPLE"
                        className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none"
                        style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                        Secret Access Key
                      </label>
                      <input
                        type="password"
                        value={formData.secretKey || '••••••••••••••••••••'}
                        onChange={e => setFormData({ ...formData, secretKey: e.target.value })}
                        placeholder="••••••••••••••••••••"
                        className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                        style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Azure Auth Options */}
            {formData.cloud === 'Azure' && (
              <div className="flex flex-col gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                      Directory (Tenant) ID
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.tenantId || ''}
                      onChange={e => setFormData({ ...formData, tenantId: e.target.value })}
                      placeholder="72f988bf-86f1-41af-91ab-2d7cd011db47"
                      className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none"
                      style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                      Application (Client) ID
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.clientId || ''}
                      onChange={e => setFormData({ ...formData, clientId: e.target.value })}
                      placeholder="e892c901-44bb-4e31-8902-124890123456"
                      className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none"
                      style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={formData.clientSecret || '••••••••••••••••••••'}
                    onChange={e => setFormData({ ...formData, clientSecret: e.target.value })}
                    placeholder="••••••••••••••••••••"
                    className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
              </div>
            )}

            {/* GCP Auth Options */}
            {formData.cloud === 'GCP' && (
              <div className="flex flex-col gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                    GCP Project ID
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.gcpProject || ''}
                    onChange={e => setFormData({ ...formData, gcpProject: e.target.value })}
                    placeholder="acme-gcp-prod-9941"
                    className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                    Service Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={formData.saEmail || ''}
                    onChange={e => setFormData({ ...formData, saEmail: e.target.value })}
                    placeholder="wafr-scanner@acme-gcp-prod.iam.gserviceaccount.com"
                    className="w-full px-3 py-2 rounded-xl font-mono text-xs outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
              </div>
            )}

            {/* Test Connection Button */}
            <div className="pt-2 flex items-center justify-between border-t" style={{ borderColor: T.border }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testState === 'testing'}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                style={{ borderColor: T.border, color: T.text, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }}
              >
                {testState === 'testing' ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Testing...</span>
                  </>
                ) : (
                  <span>Test Connection</span>
                )}
              </button>
              {testState === 'success' && (
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Verified
                </span>
              )}
            </div>
          </div>

          {/* Sync & Status Settings */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                Sync Interval
              </label>
              <select
                value={formData.syncIntervalHours}
                onChange={e => setFormData({ ...formData, syncIntervalHours: +e.target.value })}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
              >
                <option value={2}>Every 2 hours</option>
                <option value={6}>Every 6 hours (Recommended)</option>
                <option value={12}>Every 12 hours</option>
                <option value={24}>Every 24 hours</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium mb-1" style={{ color: T.text }}>
                Status
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as 'active' | 'warning' | 'paused' })}
                className="w-full px-3 py-2 rounded-xl text-xs outline-none"
                style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
              >
                <option value="active">Active</option>
                <option value="warning">Warning / Degraded</option>
                <option value="paused">Paused</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-end gap-2 border-t shrink-0" style={{ borderColor: T.border }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full border transition-colors cursor-pointer"
              style={{ borderColor: T.border, color: T.textSub }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold rounded-full text-white cursor-pointer shadow-sm hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #2563EB, #10B981)' }}
            >
              {isCreating ? 'Add Configuration' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CloudConfigPanel({ T, isDark }: { T: Tokens; isDark: boolean }) {
  const [configs, setConfigs] = useState<CloudConfigItem[]>(INITIAL_CLOUD_CONFIGS);
  const [editingConfig, setEditingConfig] = useState<CloudConfigItem | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleEdit = (c: CloudConfigItem) => {
    setEditingConfig({ ...c });
    setIsCreating(false);
  };

  const handleCreateNew = () => {
    setEditingConfig({
      id: `cfg-${Date.now()}`,
      cloud: 'AWS',
      name: '',
      method: 'IAM Role / Cross-Account',
      authType: 'role',
      status: 'active',
      lastSync: 'Never',
      roleArn: 'arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole',
      externalId: `cfops-wafr-${Math.floor(Math.random() * 8999 + 1000)}`,
      autoSync: true,
      syncIntervalHours: 6,
    });
    setIsCreating(true);
  };

  const handleSave = (saved: CloudConfigItem) => {
    if (isCreating) {
      setConfigs(prev => [...prev, saved]);
      showToast(`Added cloud configuration "${saved.name || saved.cloud}" successfully.`);
    } else {
      setConfigs(prev => prev.map(c => (c.id === saved.id ? saved : c)));
      showToast(`Updated configuration "${saved.name}" successfully.`);
    }
    setEditingConfig(null);
  };

  const handleSyncNow = (id: string, name: string) => {
    setSyncingId(id);
    setTimeout(() => {
      setConfigs(prev =>
        prev.map(c => (c.id === id ? { ...c, lastSync: 'Just now', status: 'active' } : c))
      );
      setSyncingId(null);
      showToast(`Synchronized "${name}" successfully.`);
    }, 1200);
  };

  const handleDelete = (id: string) => {
    const target = configs.find(c => c.id === id);
    setConfigs(prev => prev.filter(c => c.id !== id));
    setDeletingId(null);
    showToast(`Removed configuration "${target?.name || 'Cloud'}" successfully.`);
  };

  const CC_COLORS: Record<string, { bg: string; text: string }> = {
    AWS:   { bg: 'rgba(255,153,0,.12)',  text: '#FF9900' },
    Azure: { bg: 'rgba(0,120,212,.12)',  text: '#0078D4' },
    GCP:   { bg: 'rgba(66,133,244,.12)', text: '#4285F4' },
  };

  return (
    <div className="flex flex-col gap-6 relative">
      {/* Toast notification banner */}
      {toastMessage && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-semibold animate-bounce"
          style={{
            backgroundColor: isDark ? '#111B2E' : '#FFFFFF',
            borderColor: '#10B981',
            color: '#10B981',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-lg" style={{ color: T.text }}>Cloud Config</h2>
          <p className="text-sm mt-1" style={{ color: T.textSub }}>Manage and edit cloud provider credentials, accounts, and automated collectors.</p>
        </div>
        <button
          type="button"
          onClick={handleCreateNew}
          className="px-4 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
          style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)', color: '#FFFFFF' }}
        >
          + Add Cloud Config
        </button>
      </div>

      {/* Config list */}
      <div className="flex flex-col gap-3">
        {configs.map(c => {
          const cc = CC_COLORS[c.cloud] || CC_COLORS.AWS;
          const isDeleting = deletingId === c.id;
          const isSyncing = syncingId === c.id;

          return (
            <div
              key={c.id}
              className="p-5 flex items-center gap-4 transition-all"
              style={{
                background: T.card,
                border: `1px solid ${T.border}`,
                boxShadow: T.shadow,
                borderRadius: '1.25rem',
              }}
            >
              <CloudChip
                id={c.cloud.toLowerCase() as CloudId}
                size="sm"
                isDark={isDark}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="font-semibold text-sm truncate" style={{ color: T.text }}>{c.name}</div>
                  <span
                    className="text-[10px] font-mono px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9', color: T.textSub }}
                  >
                    Sync: {c.syncIntervalHours}h
                  </span>
                </div>
                <div className="text-[11px] mt-0.5 truncate" style={{ color: T.textSub }}>
                  {c.method} · Last synced: <span className="font-medium">{c.lastSync}</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: c.status === 'active' ? T.success : c.status === 'warning' ? T.warning : T.muted,
                  }}
                />
                <span className="text-xs capitalize" style={{ color: T.textSub }}>{c.status}</span>
              </div>

              {/* Actions */}
              {isDeleting ? (
                <div className="flex items-center gap-1.5 shrink-0 bg-red-500/10 p-1 rounded-xl border border-red-500/20">
                  <span className="text-xs font-semibold text-red-500 px-1">Delete?</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="px-2.5 py-1 text-xs rounded-lg font-bold bg-red-600 text-white cursor-pointer hover:bg-red-700 transition-colors"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeletingId(null)}
                    className="px-2 py-1 text-xs rounded-lg font-medium cursor-pointer"
                    style={{ color: T.textSub }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleSyncNow(c.id, c.name)}
                    disabled={isSyncing}
                    className="px-2.5 py-1 text-xs rounded-full border transition-colors cursor-pointer flex items-center gap-1"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                    onMouseEnter={e => (e.currentTarget.style.color = T.primary)}
                    onMouseLeave={e => (e.currentTarget.style.color = T.textSub)}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={isSyncing ? 'animate-spin text-blue-600' : ''}
                    >
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                    </svg>
                    <span>{isSyncing ? 'Syncing…' : 'Sync'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEdit(c)}
                    className="px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer font-medium"
                    style={{ border: `1px solid ${T.border}`, color: T.text }}
                    onMouseEnter={e => {
                      e.currentTarget.style.backgroundColor = isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF';
                      e.currentTarget.style.borderColor = '#2563EB';
                      e.currentTarget.style.color = '#2563EB';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                      e.currentTarget.style.borderColor = T.border;
                      e.currentTarget.style.color = T.text;
                    }}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingId(c.id)}
                    className="px-2.5 py-1 text-xs rounded-full transition-colors cursor-pointer"
                    style={{ border: `1px solid ${T.border}`, color: T.textSub }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = T.error;
                      e.currentTarget.style.borderColor = T.error;
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = T.textSub;
                      e.currentTarget.style.borderColor = T.border;
                    }}
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit / Add Modal */}
      {editingConfig && (
        <EditCloudConfigModal
          config={editingConfig}
          isCreating={isCreating}
          isDark={isDark}
          T={T}
          onClose={() => setEditingConfig(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

export function Settings() {
  const { go, theme } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;
  const [activeSection, setActiveSection] = useState('config');

  return (
    <AppLayout>
      <div className="flex flex-col overflow-hidden h-full" style={{ backgroundColor: T.bg }}>
        {/* Header bar */}
        <div className="px-6 py-3 shrink-0 flex items-center justify-between" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => go('dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer"
              style={{ border: `1px solid ${T.border}`, color: T.textSub, backgroundColor: 'transparent' }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#F1F5F9'; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textSub; e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              ← Back to Home
            </button>
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button type="button" onClick={() => go('dashboard')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.textSub }}>Home</button>
              <span>/</span><span style={{ color: T.text }}>Settings</span>
            </nav>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Settings sidebar */}
          <aside className="w-52 flex flex-col shrink-0 pt-4" style={{ backgroundColor: T.card, borderRight: `1px solid ${T.border}` }}>
            <div className="px-4 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: T.muted }}>Settings</span>
            </div>
            {SIDEBAR.map(s => {
              const active = activeSection === s.id;
              const iconColor = active ? T.primary : T.textSub;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className="flex items-center gap-2.5 px-4 py-2.5 text-sm transition-all text-left border-l-2 cursor-pointer"
                  style={active
                    ? { color: T.primary, borderLeftColor: T.primary, backgroundColor: T.primaryBg, fontWeight: 600 }
                    : { color: T.textSub, borderLeftColor: 'transparent' }
                  }
                >
                  <span className="w-5 flex items-center justify-center shrink-0">{s.icon(iconColor)}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Content */}
          <main className="flex-1 overflow-auto p-8" style={{ backgroundColor: T.bg }}>
            <div className="max-w-2xl mx-auto">
              {activeSection === 'config'    && <CloudConfigPanel T={T} isDark={isDark} />}
              {activeSection === 'retention' && <RetentionPanel T={T} isDark={isDark} />}
            </div>
          </main>
        </div>
      </div>
    </AppLayout>
  );
}
