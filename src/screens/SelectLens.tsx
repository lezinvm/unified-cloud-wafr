import { useState } from 'react';
import { useApp, LensType } from '../context';
import { CloudifyOpsSymbol } from '../components/CloudLogo';

interface LensOption {
  id: LensType;
  title: string;
  badge: string;
  status: 'active' | 'coming-soon';
  desc: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  activeBorderColor: string;
  features: string[];
}

const LENS_OPTIONS: LensOption[] = [
  {
    id: 'wafr',
    title: 'WAFR Lens',
    badge: 'Active & Available',
    status: 'active',
    desc: 'Complete Well-Architected Framework Reviews across AWS, Azure, and Google Cloud with automated telemetry scans and AI-assisted remediation.',
    iconBg: 'bg-cyan-500/20',
    iconColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    activeBorderColor: 'border-cyan-400 ring-2 ring-cyan-400/40 shadow-xl shadow-cyan-950/60',
    features: [
      '5 Core Pillars (Security, Resiliency, Cost, Performance, Ops)',
      'Agentless multi-cloud discovery & live telemetry scanner',
      'Automated Infrastructure-as-Code (Terraform) PR generator',
      'Milestone baseline scoring & drift tracking',
    ],
  },
  {
    id: 'genai',
    title: 'GenAI Lens',
    badge: 'Coming Soon',
    status: 'coming-soon',
    desc: 'Specialized architecture framework for Large Language Models, RAG pipelines, foundation model security, prompt guardrails, and token cost economics.',
    iconBg: 'bg-purple-500/20',
    iconColor: 'text-purple-400',
    borderColor: 'border-purple-500/20',
    activeBorderColor: 'border-purple-400 ring-2 ring-purple-400/30 shadow-xl shadow-purple-950/60',
    features: [
      'Prompt injection & LLM data leakage vulnerability audit',
      'Vector database scalability & retrieval latency benchmarking',
      'Token consumption & per-request inference cost tracking',
      'Model safety guardrails & compliance assurance',
    ],
  },
  {
    id: 'finops',
    title: 'FinOps Lens',
    badge: 'Coming Soon',
    status: 'coming-soon',
    desc: 'Autonomous cloud cost intelligence, unit economic modeling, commitment portfolio arbitrage (RIs / Savings Plans), and automated idle waste elimination.',
    iconBg: 'bg-emerald-500/20',
    iconColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/20',
    activeBorderColor: 'border-emerald-400 ring-2 ring-emerald-400/30 shadow-xl shadow-emerald-950/60',
    features: [
      'Real-time idle instance & orphaned disk detection',
      'RI / Savings Plans utilization & coverage arbitrage',
      'Squad & microservice unit cost attribution',
      'Anomaly detection with automated budget alerting',
    ],
  },
];

export function SelectLens() {
  const { go, setSelectedLens } = useApp();
  const [selectedLensId, setSelectedLensId] = useState<LensType>('wafr');
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; lensTitle: string } | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notified, setNotified] = useState(false);

  const handleLensClick = (lens: LensOption) => {
    setSelectedLensId(lens.id);
    if (lens.status === 'coming-soon') {
      setNotified(false);
      setComingSoonModal({ open: true, lensTitle: lens.title });
    }
  };

  const handleProceed = () => {
    if (selectedLensId === 'wafr') {
      setSelectedLens('wafr');
      go('select-cloud');
    } else {
      const activeOption = LENS_OPTIONS.find((l) => l.id === selectedLensId);
      setComingSoonModal({ open: true, lensTitle: activeOption?.title || 'Selected Lens' });
    }
  };

  const handleSelectWAFRDirectly = () => {
    setSelectedLens('wafr');
    setSelectedLensId('wafr');
    setComingSoonModal(null);
    go('select-cloud');
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-hidden select-none"
      style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 40%, #059669 75%, #10b981 100%)',
      }}
    >
      {/* Background Glow Blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,.35), transparent 70%)' }}
        />
        <div
          className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, rgba(255,255,255,.3), transparent 70%)' }}
        />
      </div>

      {/* Top Navigation Header */}
      <header
        className="h-16 flex items-center px-6 shrink-0 relative z-10 border-b border-white/15 bg-white/10 backdrop-blur-xl"
      >
        <button
          type="button"
          onClick={() => go('onboarding')}
          className="flex items-center gap-2 text-white/90 hover:text-white text-xs font-semibold px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all cursor-pointer mr-4"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span>Back to Tour</span>
        </button>

        <div className="flex items-center gap-2.5">
          <CloudifyOpsSymbol height={24} />
          <span className="font-bold text-sm text-white tracking-wide">CloudifyOps LENS</span>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => go('dashboard')}
            className="text-xs text-white/80 hover:text-white transition-colors cursor-pointer hidden sm:block"
          >
            Go to Dashboard
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white bg-white/20 border border-white/30">
            LV
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-6xl mx-auto w-full relative z-10 my-auto">
        {/* Title Header */}
        <div className="text-center max-w-2xl mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/25 border border-white/20 text-white/90 text-[11px] font-bold uppercase tracking-widest mb-3 backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Select Architecture Lens</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Choose Your Lens Assessment Type
          </h1>
          <p className="text-xs sm:text-sm text-white/80 mt-2 leading-relaxed">
            Select the specialized governance and evaluation lens for your cloud infrastructure and modernization goals.
          </p>
        </div>

        {/* 3 Lens Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
          {LENS_OPTIONS.map((lens) => {
            const isSelected = selectedLensId === lens.id;
            const isComingSoon = lens.status === 'coming-soon';

            return (
              <div
                key={lens.id}
                onClick={() => handleLensClick(lens)}
                className={`flex flex-col justify-between rounded-2xl p-6 transition-all duration-200 backdrop-blur-xl relative overflow-hidden cursor-pointer ${
                  isSelected
                    ? `${lens.activeBorderColor} bg-[#0e1626]/95 scale-[1.02]`
                    : `${lens.borderColor} bg-[#0e1626]/85 hover:bg-[#0e1626]/95 hover:border-slate-500`
                } border shadow-xl`}
              >
                {/* Top Badge */}
                <div className="flex items-center justify-between gap-2 mb-4">
                  <div className={`w-10 h-10 rounded-xl ${lens.iconBg} border border-white/10 ${lens.iconColor} flex items-center justify-center shadow-inner`}>
                    {lens.id === 'wafr' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    )}
                    {lens.id === 'genai' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                      </svg>
                    )}
                    {lens.id === 'finops' && (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="1" x2="12" y2="23" />
                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                      </svg>
                    )}
                  </div>

                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      isComingSoon
                        ? 'bg-purple-500/20 text-purple-300 border-purple-500/40'
                        : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    }`}
                  >
                    {lens.badge}
                  </span>
                </div>

                {/* Card Title & Desc */}
                <div className="mb-5">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>{lens.title}</span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    )}
                  </h2>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed line-clamp-3">
                    {lens.desc}
                  </p>
                </div>

                {/* Features List */}
                <div className="space-y-2 mb-6 pt-4 border-t border-slate-800">
                  {lens.features.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isComingSoon ? '#c084fc' : '#34d399'}
                        strokeWidth="2.5"
                        className="shrink-0 mt-0.5"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="leading-tight">{f}</span>
                    </div>
                  ))}
                </div>

                {/* Bottom Card Action */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLensClick(lens);
                    if (!isComingSoon) {
                      handleSelectWAFRDirectly();
                    }
                  }}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                    isComingSoon
                      ? 'bg-slate-800/80 text-purple-300 border border-purple-500/30 hover:bg-slate-800'
                      : 'bg-gradient-to-r from-blue-600 to-emerald-600 hover:from-blue-500 hover:to-emerald-500 text-white shadow-emerald-950/40'
                  }`}
                >
                  <span>{isComingSoon ? 'Explore Preview' : 'Select WAFR Lens'}</span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>

        {/* Proceed Bar */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={handleProceed}
            className="flex items-center gap-2 px-8 py-3 rounded-full text-sm font-bold text-white bg-[#0e1626] border border-cyan-400/50 hover:bg-slate-900 transition-all shadow-xl hover:scale-105 cursor-pointer"
          >
            <span>Proceed with {selectedLensId === 'wafr' ? 'WAFR Lens' : 'Selected Lens'}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="5" y1="12" x2="19" y2="12" />
              <polyline points="12 5 19 12 12 19" />
            </svg>
          </button>
        </div>
      </main>

      {/* Coming Soon Modal Popup */}
      {comingSoonModal?.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
          <div className="w-full max-w-md bg-[#0e1626] border border-purple-500/40 rounded-2xl p-6 text-white shadow-2xl relative">
            <button
              type="button"
              onClick={() => setComingSoonModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            {/* Modal Icon & Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/30">
                  Coming Soon
                </span>
                <h2 className="text-lg font-bold text-white mt-1">{comingSoonModal.lensTitle} is in Development</h2>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              The <strong className="text-white">{comingSoonModal.lensTitle}</strong> framework is currently in private technical preview with our cloud modernization team.
            </p>

            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-xs text-slate-300 mb-5 space-y-2">
              <div className="flex items-center gap-2 text-cyan-400 font-semibold">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Available Today: WAFR Lens</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-normal">
                You can currently run complete Well-Architected Framework Reviews across AWS, Azure, and Google Cloud workloads with automated AI fixes.
              </p>
            </div>

            {/* Email notification sign-up */}
            {!notified ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (notifyEmail.trim()) {
                    setNotified(true);
                  }
                }}
                className="mb-5 flex gap-2"
              >
                <input
                  type="email"
                  value={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.value)}
                  placeholder="Get notified: enter your email"
                  required
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                >
                  Notify Me
                </button>
              </form>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs mb-5 text-center font-medium">
                You will be notified when early access opens!
              </div>
            )}

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setComingSoonModal(null)}
                className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSelectWAFRDirectly}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg cursor-pointer"
              >
                <span>Open WAFR Lens (Select Cloud)</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
