import { useState } from 'react';
import { useApp, Cloud, LensType } from '../context';
import { AwsWordmark, AzureMark, GcpMark } from '../components/CloudLogo';

export function Onboarding() {
  const { selectCloud, setSelectedLens, setIsNewUser } = useApp();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedFeature, setSelectedFeature] = useState<number>(1);
  
  // Step 2 & 3 State
  const [chosenLens, setChosenLens] = useState<LensType>('wafr');
  const [chosenCloud, setChosenCloud] = useState<Cloud>('aws');
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; title: string } | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notified, setNotified] = useState(false);

  const totalSteps = 3;
  const progressPercent = currentStep === 1 ? 33 : currentStep === 2 ? 66 : 100;

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (chosenLens === 'wafr') {
        setSelectedLens('wafr');
        setCurrentStep(3);
      } else {
        setComingSoonModal({
          open: true,
          title: chosenLens === 'genai' ? 'GenAI Lens' : 'FinOps Lens',
        });
      }
    } else if (currentStep === 3) {
      setIsNewUser(false);
      setSelectedLens('wafr');
      selectCloud(chosenCloud);
    }
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkipTour = () => {
    setIsNewUser(false);
    setSelectedLens('wafr');
    selectCloud('aws');
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 select-none relative overflow-hidden"
      style={{
        backgroundColor: '#0F172A',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.12) 0px, transparent 50%)',
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-3xl flex flex-col gap-4 relative z-10">

        {/* Interactive Step Stepper & Progress Bar */}
        <div className="bg-[#1E293B]/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 px-4 flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 sm:gap-4">
              {[
                { step: 1, label: 'Overview' },
                { step: 2, label: 'Select Lens' },
                { step: 3, label: 'Cloud Provider' },
              ].map(s => {
                const isActive = currentStep === s.step;
                const isCompleted = currentStep > s.step;
                return (
                  <button
                    key={s.step}
                    type="button"
                    onClick={() => setCurrentStep(s.step)}
                    className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                      isActive
                        ? 'text-blue-400 font-bold'
                        : isCompleted
                        ? 'text-emerald-400 hover:text-white'
                        : 'text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : isCompleted
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      {isCompleted ? '✓' : s.step}
                    </span>
                    <span className="hidden xs:inline">{s.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="text-slate-300 font-mono text-[11px] font-bold">
              Step {currentStep} of {totalSteps} ({progressPercent}%)
            </span>
          </div>

          <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Central Card */}
        <div className="w-full bg-[#1E293B]/90 backdrop-blur-xl border border-slate-700/60 rounded-2xl shadow-2xl p-6 sm:p-8 text-white flex flex-col justify-between min-h-[500px]">
          
          {/* Header section */}
          <div className="flex flex-col items-center text-center mb-5">
            <div className="w-11 h-11 rounded-2xl bg-blue-600/15 border border-blue-500/30 flex items-center justify-center mb-3 text-blue-400">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="6" stroke="#3B82F6" strokeWidth="1.5" />
                <circle cx="12" cy="12" r="2" fill="#60A5FA" />
              </svg>
            </div>

            {currentStep === 1 && (
              <>
                <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  <span>Welcome to</span>
                  <span className="text-blue-400 font-extrabold tracking-wider">
                    LENS
                  </span>
                </h1>
                <p className="text-xs text-slate-300 mt-1 max-w-lg leading-relaxed">
                  CloudifyOps Multi-Cloud Architecture Review & Well-Architected Framework Assessment Platform
                </p>
              </>
            )}

            {currentStep === 2 && (
              <>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Select Assessment Framework
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the specialized evaluation lens for your workloads
                </p>
              </>
            )}

            {currentStep === 3 && (
              <>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Select Cloud Provider
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the cloud infrastructure to review with the Well-Architected Framework
                </p>
              </>
            )}
          </div>

          {/* STEP 1: Simple, Clean 3-Capability Overview (No Phase 1, Phase 2, Phase 3) */}
          {currentStep === 1 && (
            <div className="flex flex-col gap-3 my-auto">
              {/* Feature 1: Automated Discovery */}
              <div
                onClick={() => setSelectedFeature(1)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  selectedFeature === 1
                    ? 'border-blue-500/70 bg-blue-950/30'
                    : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">
                    Automated Workload Discovery & Drift
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Connect your AWS, Azure, or GCP accounts with secure read-only roles to discover live resource inventories, topology maps, and configuration drift in minutes.
                  </p>
                </div>
              </div>

              {/* Feature 2: 5-Pillar WAFR Evaluation */}
              <div
                onClick={() => setSelectedFeature(2)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  selectedFeature === 2
                    ? 'border-blue-500/70 bg-blue-950/30'
                    : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">
                    5-Pillar Well-Architected Evaluation
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Continuously evaluate workloads across Security, Reliability, Performance, Cost Optimization, and Operational Excellence with quantified posture scoring.
                  </p>
                </div>
              </div>

              {/* Feature 3: Actionable AI Remediation */}
              <div
                onClick={() => setSelectedFeature(3)}
                className={`p-4 rounded-xl border transition-all cursor-pointer flex items-start gap-3.5 ${
                  selectedFeature === 3
                    ? 'border-blue-500/70 bg-blue-950/30'
                    : 'border-slate-700/60 bg-slate-900/40 hover:border-slate-600'
                }`}
              >
                <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-white">
                    Actionable Remediation & Milestones
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    Turn architectural findings directly into verified Terraform and CloudFormation pull requests, tracking posture improvement across milestone releases.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Select Lens Framework */}
          {currentStep === 2 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-auto">
              {/* WAFR Lens */}
              <button
                type="button"
                onClick={() => setChosenLens('wafr')}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                  chosenLens === 'wafr'
                    ? 'border-blue-500 bg-blue-950/40 ring-1 ring-blue-500 shadow-lg'
                    : 'border-slate-700/70 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-400 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-sm font-bold text-white">WAFR Lens</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Full 5-pillar Well-Architected Framework reviews with automated checks and IaC fixes.
                  </p>
                </div>
                <div className="text-xs font-semibold text-blue-400 flex items-center gap-1 pt-2 border-t border-slate-800">
                  <span>Available Now</span>
                  <span>✓</span>
                </div>
              </button>

              {/* GenAI Lens */}
              <button
                type="button"
                onClick={() => {
                  setChosenLens('genai');
                  setNotified(false);
                  setComingSoonModal({ open: true, title: 'GenAI Lens' });
                }}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                  chosenLens === 'genai'
                    ? 'border-purple-500 bg-purple-950/40 ring-1 ring-purple-500 shadow-lg'
                    : 'border-slate-700/70 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-sm font-bold text-white">GenAI Lens</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                      Preview
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    LLM security guardrails, prompt defense, token latency & inference cost tracking.
                  </p>
                </div>
                <div className="text-xs font-semibold text-purple-400 pt-2 border-t border-slate-800">
                  Coming Soon
                </div>
              </button>

              {/* FinOps Lens */}
              <button
                type="button"
                onClick={() => {
                  setChosenLens('finops');
                  setNotified(false);
                  setComingSoonModal({ open: true, title: 'FinOps Lens' });
                }}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-3 cursor-pointer ${
                  chosenLens === 'finops'
                    ? 'border-emerald-500 bg-emerald-950/40 ring-1 ring-emerald-500 shadow-lg'
                    : 'border-slate-700/70 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-sm font-bold text-white">FinOps Lens</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      Preview
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Cloud spend anomaly detection, unit economics & idle infrastructure reduction.
                  </p>
                </div>
                <div className="text-xs font-semibold text-emerald-400 pt-2 border-t border-slate-800">
                  Coming Soon
                </div>
              </button>
            </div>
          )}

          {/* STEP 3: Select Cloud Provider as CARDS (No illogical assessment counts for new users) */}
          {currentStep === 3 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 my-auto">
              {/* AWS Card */}
              <button
                type="button"
                onClick={() => setChosenCloud('aws')}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                  chosenCloud === 'aws'
                    ? 'border-amber-400 bg-amber-950/25 ring-1 ring-amber-400/50 shadow-lg'
                    : 'border-slate-700/70 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="w-12 h-10 rounded-xl bg-white flex items-center justify-center p-1 mb-3 shadow-sm">
                    <AwsWordmark width={38} height={24} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Amazon Web Services
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Connect via Cross-Account IAM Role to evaluate EC2, S3, RDS, Lambda, VPC & 200+ AWS services.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-amber-400">AWS Native WAFR</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                    chosenCloud === 'aws' ? 'bg-amber-400 border-amber-400 text-slate-900 font-bold' : 'border-slate-500'
                  }`}>
                    {chosenCloud === 'aws' ? '✓' : ''}
                  </div>
                </div>
              </button>

              {/* Azure Card */}
              <button
                type="button"
                onClick={() => setChosenCloud('azure')}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                  chosenCloud === 'azure'
                    ? 'border-blue-400 bg-blue-950/25 ring-1 ring-blue-400/50 shadow-lg'
                    : 'border-slate-700/70 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="w-12 h-10 rounded-xl bg-white flex items-center justify-center p-1 mb-3 shadow-sm">
                    <AzureMark size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Microsoft Azure
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Connect via Service Principal to evaluate VMs, AKS, Azure SQL, Blob Storage & VNets.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-blue-400">Azure WAF</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                    chosenCloud === 'azure' ? 'bg-blue-400 border-blue-400 text-slate-900 font-bold' : 'border-slate-500'
                  }`}>
                    {chosenCloud === 'azure' ? '✓' : ''}
                  </div>
                </div>
              </button>

              {/* GCP Card */}
              <button
                type="button"
                onClick={() => setChosenCloud('gcp')}
                className={`text-left p-5 rounded-2xl border transition-all flex flex-col justify-between gap-4 cursor-pointer ${
                  chosenCloud === 'gcp'
                    ? 'border-sky-400 bg-sky-950/25 ring-1 ring-sky-400/50 shadow-lg'
                    : 'border-slate-700/70 bg-slate-900/50 hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="w-12 h-10 rounded-xl bg-white flex items-center justify-center p-1 mb-3 shadow-sm">
                    <GcpMark size={28} />
                  </div>
                  <h3 className="text-sm font-bold text-white mb-1">
                    Google Cloud Platform
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Connect via Service Account to evaluate GKE, BigQuery, Cloud SQL, Compute & VPC.
                  </p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                  <span className="text-[11px] font-semibold text-sky-400">Google Cloud AF</span>
                  <div className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ${
                    chosenCloud === 'gcp' ? 'bg-sky-400 border-sky-400 text-slate-900 font-bold' : 'border-slate-500'
                  }`}>
                    {chosenCloud === 'gcp' ? '✓' : ''}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Bottom Bar: Back on Left (Step 2/3), Skip Tour & Continue on Right */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-800 mt-5">
            <div>
              {currentStep > 1 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 transition-colors cursor-pointer"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                  <span>Back</span>
                </button>
              ) : (
                <div className="text-[11px] text-slate-400 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <span>Interactive Walkthrough</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSkipTour}
                className="text-xs text-slate-400 hover:text-white transition-colors cursor-pointer px-2 font-medium"
              >
                Skip Tour
              </button>

              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md cursor-pointer"
              >
                <span>{currentStep === totalSteps ? 'Start Assessment' : 'Continue'}</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

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
                <h2 className="text-lg font-bold text-white mt-1">{comingSoonModal.title} is in Development</h2>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed mb-4">
              The <strong className="text-white">{comingSoonModal.title}</strong> framework is currently in technical preview. You can proceed with <strong className="text-cyan-400">WAFR Lens</strong> today for full multi-cloud architecture evaluation and AI remediation.
            </p>

            {/* Email notification */}
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
                onClick={() => {
                  setChosenLens('wafr');
                  setSelectedLens('wafr');
                  setComingSoonModal(null);
                  setCurrentStep(3);
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors shadow-lg cursor-pointer"
              >
                <span>Continue with WAFR Lens</span>
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
