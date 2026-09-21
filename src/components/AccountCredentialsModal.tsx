import { useState } from 'react';
import { CloudChip, CloudId } from './CloudLogo';
import { LIGHT, DARK } from '../context';

interface Props {
  isOpen: boolean;
  onClose?: () => void;
  onSave: (account: { cloud: CloudId; name: string; id: string }) => void;
  isDark: boolean;
  canDismiss?: boolean;
}

export function AccountCredentialsModal({
  isOpen,
  onClose,
  onSave,
  isDark,
  canDismiss = true,
}: Props) {
  const T = isDark ? DARK : LIGHT;

  const [selectedCloud, setSelectedCloud] = useState<CloudId>('aws');
  const [authType, setAuthType] = useState<'role' | 'keys'>('role');
  
  // AWS Fields
  const [roleArn, setRoleArn] = useState('arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole');
  const [externalId] = useState('cfops-wafr-tenant-9941');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');

  // Azure Fields
  const [tenantId, setTenantId] = useState('tenant-9901-4412-2291');
  const [clientId, setClientId] = useState('client-5541-8890-1122');
  const [clientSecret, setClientSecret] = useState('');

  // GCP Fields
  const [gcpProject, setGcpProject] = useState('proj-gcp-prod-9941');
  const [saEmail, setSaEmail] = useState('wafr-scanner@proj-gcp-prod-9941.iam.gserviceaccount.com');

  // Scope & Account Details (No Region here - decided at assessment time)
  const [accountName, setAccountName] = useState('acme-production');
  const [accountId, setAccountId] = useState('124890123456');

  // Test state
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  if (!isOpen) return null;

  const handleCloudChange = (c: CloudId) => {
    setSelectedCloud(c);
    setTestStatus('idle');
    if (c === 'aws') {
      setAccountName('acme-aws-production');
      setAccountId('124890123456');
    } else if (c === 'azure') {
      setAccountName('AcmeCorp-AzureSub');
      setAccountId('sub-4891-2394-8172');
    } else {
      setAccountName('acme-gcp-prod');
      setAccountId('proj-gcp-prod-9941');
    }
  };

  const handleTestConnection = () => {
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus('success');
    }, 1000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      cloud: selectedCloud,
      name: accountName || `${selectedCloud.toUpperCase()} Production`,
      id: accountId || (selectedCloud === 'aws' ? '124890123456' : selectedCloud === 'azure' ? 'sub-4891-2394' : 'proj-gcp-9941'),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
        onClick={canDismiss ? onClose : undefined}
      />

      {/* Modal Dialog */}
      <div
        className="relative w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] z-10"
        style={{
          backgroundColor: T.card,
          border: `1px solid ${T.border}`,
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-5 border-b shrink-0"
          style={{
            borderColor: T.border,
            backgroundColor: isDark ? 'rgba(0,0,0,0.25)' : '#F8FAFC',
          }}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3.5">
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold shrink-0"
                style={{ background: 'linear-gradient(135deg, #1B6FC9, #10B981)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-semibold" style={{ color: T.text }}>
                    Connect Cloud Credentials
                  </h2>
                  {!canDismiss && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                  Select your cloud provider and provide read-only credentials to connect your account
                </p>
              </div>
            </div>

            {canDismiss && onClose && (
              <button
                onClick={onClose}
                className="p-1.5 rounded-xl transition-colors cursor-pointer"
                style={{ color: T.textSub }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 flex flex-col gap-6 flex-1">
          {/* STEP 1: Select Cloud Provider */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.primary }}>
                Step 1: Select Cloud Provider <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px]" style={{ color: T.textSub }}>Choose cloud platform</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {(['aws', 'azure', 'gcp'] as const).map(c => {
                const isSel = selectedCloud === c;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleCloudChange(c)}
                    className="p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{
                      borderColor: isSel ? '#2563EB' : T.border,
                      backgroundColor: isSel ? (isDark ? 'rgba(37,99,235,0.14)' : '#EFF6FF') : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CloudChip id={c} size="sm" isDark={isDark} />
                      <span className="text-xs font-semibold truncate" style={{ color: T.text }}>
                        {c.toUpperCase()}
                      </span>
                    </div>
                    {isSel && (
                      <div className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* STEP 2: Cloud Authentication Credentials */}
          <div
            className="p-4 rounded-2xl flex flex-col gap-3.5"
            style={{
              backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F8FAFC',
              border: `1px solid ${T.border}`,
            }}
          >
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.primary }}>
                Step 2: Cloud Credentials & Authentication <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px]" style={{ color: T.textSub }}>
                {selectedCloud === 'aws' ? 'Choose authentication method' : 'Enter API credentials'}
              </span>
            </div>

            {selectedCloud === 'aws' && (
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                  Authentication Method
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setAuthType('role')}
                    className="p-3.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{
                      borderColor: authType === 'role' ? '#2563EB' : T.border,
                      backgroundColor: authType === 'role' ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF') : (isDark ? '#111B2E' : '#FFFFFF'),
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: authType === 'role' ? '#2563EB' : '#94A3B8' }}
                      >
                        {authType === 'role' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold" style={{ color: authType === 'role' ? (isDark ? '#93C5FD' : '#1D4ED8') : T.text }}>
                          IAM Role
                        </div>
                        <div className="text-[10px] truncate" style={{ color: T.textSub }}>
                          Cross-account ARN & External ID
                        </div>
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-1.5"
                      style={{
                        backgroundColor: authType === 'role' ? (isDark ? 'rgba(37,99,235,0.3)' : '#DBEAFE') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                        color: authType === 'role' ? (isDark ? '#93C5FD' : '#1D4ED8') : T.textSub,
                      }}
                    >
                      Recommended
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthType('keys')}
                    className="p-3.5 rounded-xl border-2 flex items-center justify-between transition-all cursor-pointer text-left"
                    style={{
                      borderColor: authType === 'keys' ? '#2563EB' : T.border,
                      backgroundColor: authType === 'keys' ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF') : (isDark ? '#111B2E' : '#FFFFFF'),
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
                        style={{ borderColor: authType === 'keys' ? '#2563EB' : '#94A3B8' }}
                      >
                        {authType === 'keys' && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold" style={{ color: authType === 'keys' ? (isDark ? '#93C5FD' : '#1D4ED8') : T.text }}>
                          Access Keys
                        </div>
                        <div className="text-[10px] truncate" style={{ color: T.textSub }}>
                          Access Key ID & Secret Key
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {selectedCloud === 'aws' && authType === 'role' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    Target IAM Role ARN
                  </label>
                  <input
                    type="text"
                    required
                    value={roleArn}
                    onChange={e => setRoleArn(e.target.value)}
                    placeholder="arn:aws:iam::124890123456:role/CloudifyOpsWAFRReadOnlyRole"
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none transition-all"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                    onFocus={e => (e.currentTarget.style.borderColor = '#2563EB')}
                    onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                  />
                  <p className="text-[11px] mt-1" style={{ color: T.textSub }}>
                    Role must include <span className="font-mono text-blue-600 dark:text-blue-400">SecurityAudit</span> and <span className="font-mono text-blue-600 dark:text-blue-400">ViewOnlyAccess</span> policies.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    External ID (For IAM Trust Relationship)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={externalId}
                      className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none opacity-85"
                      style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                    />
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(externalId)}
                      className="px-3.5 py-2 text-xs font-medium rounded-xl border shrink-0 transition-colors cursor-pointer"
                      style={{ borderColor: T.border, color: T.textSub }}
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedCloud === 'aws' && authType === 'keys' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    AWS Access Key ID
                  </label>
                  <input
                    type="text"
                    value={accessKey}
                    onChange={e => setAccessKey(e.target.value)}
                    placeholder="AKIAIOSFODNN7EXAMPLE"
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    AWS Secret Access Key
                  </label>
                  <input
                    type="password"
                    value={secretKey}
                    onChange={e => setSecretKey(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="w-full px-3.5 py-2 rounded-xl text-xs outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
              </div>
            )}

            {selectedCloud === 'azure' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    Directory (Tenant) ID
                  </label>
                  <input
                    type="text"
                    required
                    value={tenantId}
                    onChange={e => setTenantId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    Application (Client) ID
                  </label>
                  <input
                    type="text"
                    required
                    value={clientId}
                    onChange={e => setClientId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    Client Secret
                  </label>
                  <input
                    type="password"
                    value={clientSecret}
                    onChange={e => setClientSecret(e.target.value)}
                    placeholder="••••••••••••••••••••"
                    className="w-full px-3.5 py-2 rounded-xl text-xs outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
              </div>
            )}

            {selectedCloud === 'gcp' && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    GCP Project ID
                  </label>
                  <input
                    type="text"
                    required
                    value={gcpProject}
                    onChange={e => setGcpProject(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                    Service Account Email
                  </label>
                  <input
                    type="email"
                    required
                    value={saEmail}
                    onChange={e => setSaEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none"
                    style={{ backgroundColor: isDark ? '#111B2E' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  />
                </div>
              </div>
            )}

            {/* Test Connection Button & Status */}
            <div className="pt-2 flex items-center justify-between border-t" style={{ borderColor: T.border }}>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer"
                style={{ borderColor: T.border, color: T.text, backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF' }}
              >
                {testStatus === 'testing' ? (
                  <>
                    <svg className="animate-spin h-3.5 w-3.5 text-blue-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    <span>Verifying credentials…</span>
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <span>Test Connection</span>
                  </>
                )}
              </button>

              {testStatus === 'success' && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span>Read-only credentials verified</span>
                </div>
              )}
            </div>
          </div>

          {/* STEP 3: Target Account Details */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.primary }}>
                Step 3: Account Details <span className="text-red-400">*</span>
              </label>
              <span className="text-[11px]" style={{ color: T.textSub }}>Account identifier</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                  {selectedCloud === 'aws' ? 'AWS Account Name' : selectedCloud === 'azure' ? 'Subscription Name' : 'Project Name'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountName}
                  onChange={e => setAccountName(e.target.value)}
                  placeholder="e.g. acme-production"
                  className="w-full px-3.5 py-2 rounded-xl text-xs outline-none transition-all"
                  style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#2563EB')}
                  onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: T.text }}>
                  {selectedCloud === 'aws' ? 'Account ID (12 digits)' : selectedCloud === 'azure' ? 'Subscription ID' : 'Project ID'} <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={accountId}
                  onChange={e => setAccountId(e.target.value)}
                  placeholder={selectedCloud === 'aws' ? '124890123456' : selectedCloud === 'azure' ? 'sub-4891-2394' : 'proj-gcp-9941'}
                  className="w-full px-3.5 py-2 rounded-xl text-xs font-mono outline-none transition-all"
                  style={{ backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#FFFFFF', border: `1px solid ${T.border}`, color: T.text }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#2563EB')}
                  onBlur={e => (e.currentTarget.style.borderColor = T.border)}
                />
              </div>
            </div>

            <p className="text-[11px] mt-2.5" style={{ color: T.textSub }}>
              Evaluation regions will be selected individually when running assessments.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 flex items-center justify-between border-t shrink-0 mt-2" style={{ borderColor: T.border }}>
            <div className="text-xs" style={{ color: T.textSub }}>
              {!canDismiss ? (
                <span className="flex items-center gap-1.5 text-amber-500 font-medium">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  Setup credentials to unlock platform
                </span>
              ) : (
                <span>All credentials encrypted in transit</span>
              )}
            </div>

            <button
              type="submit"
              className="flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90 shadow-md cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #1B6FC9, #14A085, #10B981)' }}
            >
              <span>Save & Connect Account</span>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
