import { useState } from 'react';
import { useApp, Cloud } from '../context';
import { AwsWordmark, AzureMark, GcpMark, CloudifyOpsSymbol } from '../components/CloudLogo';
import { AccountCredentialsModal } from '../components/AccountCredentialsModal';

const CLOUDS: {
  id: Cloud; name: string; desc: string;
  accent: string; accentBg: string; accentBorder: string;
  assessments: number; passing: number; lastRun: string; regions: number; accounts: number;
}[] = [
  { id: 'aws',   name: 'Amazon Web Services', desc: 'EC2, S3, RDS, Lambda, VPC & 200+ services',
    accent: '#FF9900', accentBg: 'rgba(255,153,0,.08)', accentBorder: 'rgba(255,153,0,.3)',
    assessments: 14, passing: 9, lastRun: '2h ago', regions: 6, accounts: 12 },
  { id: 'azure', name: 'Microsoft Azure', desc: 'VMs, AKS, SQL, Blob, VNet & Azure services',
    accent: '#0078D4', accentBg: 'rgba(0,120,212,.08)', accentBorder: 'rgba(0,120,212,.3)',
    assessments: 7,  passing: 5, lastRun: '1d ago', regions: 4, accounts: 8  },
  { id: 'gcp',   name: 'Google Cloud', desc: 'GKE, BigQuery, Cloud SQL, GCS & more',
    accent: '#4285F4', accentBg: 'rgba(66,133,244,.08)', accentBorder: 'rgba(66,133,244,.3)',
    assessments: 3,  passing: 3, lastRun: '3d ago', regions: 3, accounts: 4  },
];

const CloudMark = ({ id }: { id: Cloud }) => {
  if (id === 'aws')   return <AwsWordmark width={44} height={28} />;
  if (id === 'azure') return <AzureMark size={34} />;
  return <GcpMark size={34} />;
};

export function SelectCloud() {
  const { selectCloud, go, isCloudConfigured, getConfiguredAccount, setConfiguredAccount, currentUser, theme } = useApp();
  const [selected, setSelected] = useState<Cloud | null>(null);
  const [showCredsModal, setShowCredsModal] = useState(false);
  const [targetCloudToConfig, setTargetCloudToConfig] = useState<Cloud>('aws');

  const handleCloudClick = (cloudId: Cloud) => {
    setSelected(cloudId);
    if (isCloudConfigured(cloudId)) {
      selectCloud(cloudId);
    } else {
      setTargetCloudToConfig(cloudId);
      setShowCredsModal(true);
    }
  };

  const handleSaveCredentials = (account: { cloud: Cloud; name: string; id: string; authType?: string; roleArn?: string; tenantId?: string; projectId?: string }) => {
    setConfiguredAccount(account);
    setShowCredsModal(false);
    selectCloud(account.cloud);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-y-auto"
      style={{ background: 'linear-gradient(135deg, #1B6FC9 0%, #14A085 50%, #2EBD59 100%)' }}>

      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-20 -left-20 w-[500px] h-[500px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,.3), transparent 65%)' }} />
        <div className="absolute -bottom-20 -right-20 w-[500px] h-[500px] rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,.25), transparent 65%)' }} />
      </div>

      {/* Mini top bar with Back to Home button */}
      <header className="h-14 flex items-center px-6 shrink-0 relative z-10"
        style={{ borderBottom: '1px solid rgba(255,255,255,.15)', background: 'rgba(255,255,255,.08)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-2 mr-4">
          <button
            type="button"
            onClick={() => go('org-questions')}
            className="flex items-center gap-1.5 text-white/90 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
            title="Return to Organisation-Specific Questions"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span>Organisation Questions</span>
          </button>

          <button
            type="button"
            onClick={() => go('dashboard')}
            className="flex items-center gap-1.5 text-white/80 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            <span>Dashboard</span>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <CloudifyOpsSymbol height={32} />
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-200 border border-cyan-400/30">
            WAFR Lens
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-white/20 uppercase">
            {currentUser.name ? currentUser.name.split(' ').map(n => n[0]).join('').slice(0, 2) : 'US'}
          </div>
          <span className="text-xs text-white/80 font-medium">{currentUser.email || 'user@cloudifyops.com'}</span>
        </div>
      </header>

      {/* ── STEP-BY-STEP BAR ── */}
      <div
        className="px-6 py-2.5 border-b relative z-10 flex items-center justify-between"
        style={{
          backgroundColor: 'rgba(0,0,0,0.15)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <div className="max-w-3xl w-full mx-auto flex items-center justify-center gap-3 sm:gap-6 text-xs font-semibold">
          {/* Step 1: Completed */}
          <button
            type="button"
            onClick={() => go('org-questions')}
            className="flex items-center gap-2 text-emerald-200 hover:text-white transition-colors cursor-pointer"
            title="Click to review or edit Organisation Questions"
          >
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-[10px]">
              ✓
            </span>
            <span>1. Organisation Questions</span>
          </button>

          <div className="w-8 h-px bg-white/20 hidden sm:block" />

          {/* Step 2: Active */}
          <div className="flex items-center gap-2 text-white">
            <span className="w-5 h-5 rounded-full bg-white text-blue-700 flex items-center justify-center font-bold text-[10px] shadow-xs">
              2
            </span>
            <span className="font-bold underline decoration-2 underline-offset-4">2. Select Cloud Provider</span>
          </div>

          <div className="w-8 h-px bg-white/20 hidden sm:block" />

          {/* Step 3: Upcoming */}
          <div className="flex items-center gap-2 text-white/50">
            <span className="w-5 h-5 rounded-full border border-white/30 flex items-center justify-center font-bold text-[10px]">
              3
            </span>
            <span>3. Configure Assessment</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-start sm:justify-center p-8 relative z-10 overflow-y-auto">
        <div className="max-w-3xl w-full">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-5 bg-white/15 text-white border border-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              {currentUser.company || 'Enterprise'} workspace · Architecture Evaluation
            </div>
            <h1 className="text-4xl font-semibold tracking-tight text-white mb-3">Select cloud provider</h1>
            <p className="text-white/75 text-base">Choose a cloud to manage Well-Architected Framework reviews</p>
          </div>

          <div className="grid grid-cols-3 gap-5">
            {CLOUDS.map(cloud => {
              const isSelected = selected === cloud.id;
              const isConfigured = isCloudConfigured(cloud.id);
              const confAcc = getConfiguredAccount(cloud.id);

              return (
                <button key={cloud.id}
                  type="button"
                  onClick={() => handleCloudClick(cloud.id)}
                  className="text-left flex flex-col justify-between gap-5 p-6 rounded-3xl transition-all duration-200 cursor-pointer"
                  style={{
                    background: isSelected ? 'rgba(255,255,255,.98)' : 'rgba(255,255,255,.88)',
                    backdropFilter: 'blur(16px)',
                    border: isSelected ? `2px solid ${cloud.accent}` : isConfigured ? '2px solid rgba(16, 185, 129, 0.4)' : '2px solid transparent',
                    boxShadow: isSelected
                      ? `0 0 0 4px ${cloud.accentBorder}, 0 8px 24px rgba(0,0,0,.12)`
                      : '0 4px 16px rgba(0,0,0,.1)',
                    transform: isSelected ? 'translateY(-3px)' : 'none',
                  }}
                  onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.14)'; }}}
                  onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,.1)'; }}}>

                  <div className="flex items-start justify-between">
                    <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-xs border border-gray-100 p-2">
                      <CloudMark id={cloud.id} />
                    </div>

                    {isConfigured ? (
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Connected
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        Setup Required
                      </span>
                    )}
                  </div>

                  <div>
                    <div className="font-semibold text-gray-900 text-sm flex items-center justify-between">
                      <span>{cloud.name}</span>
                    </div>
                    <div className="text-[11px] mt-1 text-gray-500">{cloud.desc}</div>
                    {confAcc && (
                      <div className="text-[10px] font-mono text-emerald-700 bg-emerald-50/80 px-2 py-1 rounded-md mt-2 truncate border border-emerald-100">
                        {confAcc.name} ({confAcc.id})
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <span className="text-[11px] text-gray-400">
                      {isConfigured ? 'Ready to scan' : 'Creds required'}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: cloud.accent }}>
                      {isConfigured ? (
                        'Select Cloud →'
                      ) : (
                        '+ Connect Creds'
                      )}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs mt-8 text-white/70">
            Manage your connected cloud credentials and multi-cloud accounts in Settings
          </p>
        </div>
      </div>

      {/* Cloud Credentials Modal when clicking an unconfigured cloud */}
      <AccountCredentialsModal
        isOpen={showCredsModal}
        onClose={() => setShowCredsModal(false)}
        onSave={handleSaveCredentials}
        isDark={theme === 'dark'}
        canDismiss={true}
        initialCloud={targetCloudToConfig}
      />
    </div>
  );
}
