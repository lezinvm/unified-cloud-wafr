import { useState } from 'react';
import { useApp, Cloud, LensType, ConfiguredAccount } from '../context';
import { AwsWordmark, AzureMark, GcpMark } from '../components/CloudLogo';
import { QuestionnaireItem } from '../data/questionnaireData';
import { api } from '../services/apiClient';

export function Onboarding() {
  const { setSelectedLens, setIsNewUser, setConfiguredAccount, setCloud, orgQuestions, updateOrgQuestion, toggleOrgCheck, go, startTour, currentUser, refreshFromDb } = useApp();
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedFeature, setSelectedFeature] = useState<number>(1);
  
  const [selectedIndustry, setSelectedIndustry] = useState('Fintech / Financial Services');
  const [organizationSize, setOrganizationSize] = useState('51-200 employees');
  
  // Steps State
  const [chosenLens, setChosenLens] = useState<LensType>('wafr');
  const [chosenCloud, setChosenCloud] = useState<Cloud>('aws');
  const [comingSoonModal, setComingSoonModal] = useState<{ open: boolean; title: string } | null>(null);
  const [selectedInfoQuestion, setSelectedInfoQuestion] = useState<QuestionnaireItem | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notified, setNotified] = useState(false);
  const [openHints, setOpenHints] = useState<Record<string, boolean>>({});

  // Account Configuration State (Step 5)
  const [authMethod, setAuthMethod] = useState<'role' | 'keys'>('role');
  const [accountName, setAccountName] = useState('');
  const [accountId, setAccountId] = useState('');
  // AWS Fields
  const [roleArn, setRoleArn] = useState('');
  const [externalId] = useState('cfops-wafr-tenant-9941');
  const [accessKey, setAccessKey] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  // Azure Fields
  const [azureTenantId, setAzureTenantId] = useState('');
  const [azureClientId, setAzureClientId] = useState('');
  const [azureClientSecret, setAzureClientSecret] = useState('');
  // GCP Fields
  const [gcpProjectId, setGcpProjectId] = useState('');
  const [gcpSaEmail, setGcpSaEmail] = useState('');
  const [gcpKeyUploaded, setGcpKeyUploaded] = useState(false);

  // Test Connection
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleSelectCloud = (c: Cloud) => {
    setChosenCloud(c);
    setTestStatus('idle');
  };

  const handleTestConnection = () => {
    setTestStatus('testing');
    setTimeout(() => {
      setTestStatus('success');
    }, 850);
  };

  const handleCopyExternalId = () => {
    navigator.clipboard?.writeText(externalId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleSaveAndGoHome = () => {
    const trimmedId = accountId.trim();
    const trimmedName = accountName.trim();
    const hasAccountInput = Boolean(trimmedId || trimmedName);

    if (hasAccountInput) {
      const generatedId = trimmedId || `acc-${currentUser.id.slice(-6)}-${Date.now().toString().slice(-4)}`;
      const accName = trimmedName || `${currentUser.name || 'My'} ${chosenCloud.toUpperCase()} Account`;

      const acc: ConfiguredAccount = {
        cloud: chosenCloud,
        name: accName,
        id: generatedId,
        authType: chosenCloud === 'aws' ? authMethod : chosenCloud === 'azure' ? 'service-principal' : 'service-account',
        roleArn: chosenCloud === 'aws' && authMethod === 'role' ? roleArn.trim() || undefined : undefined,
        tenantId: chosenCloud === 'azure' ? azureTenantId.trim() || undefined : undefined,
        projectId: chosenCloud === 'gcp' ? gcpProjectId.trim() || undefined : undefined,
      };
      setConfiguredAccount(acc);
      setCloud(chosenCloud);
      setIsNewUser(false);
      setSelectedLens('wafr');

      const userOrg = currentUser.orgId || `org_${currentUser.id}`;
      api.saveCloudAccount({
        id: acc.id,
        org_id: userOrg,
        user_id: currentUser.id,
        cloud: chosenCloud,
        account_name: acc.name,
        account_identifier: acc.id,
        auth_type: acc.authType,
        role_arn: acc.roleArn,
        tenant_id: acc.tenantId,
        gcp_project: acc.projectId,
      }).then(() => {
        refreshFromDb(currentUser);
      }).catch(err => {
        console.warn('Could not save onboarding account to DB:', err);
      });
    } else {
      setIsNewUser(true);
      setConfiguredAccount(null);
      setCloud(null);
    }

    startTour();
    go('dashboard');
  };

  const toggleHint = (key: string) => {
    setOpenHints(prev => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const totalSteps = 5;
  const progressPercent = Math.round((currentStep / totalSteps) * 100);

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      if (chosenLens === 'wafr') {
        setSelectedLens('wafr');
        setCurrentStep(4);
      } else {
        setComingSoonModal({
          open: true,
          title: chosenLens === 'genai' ? 'GenAI Lens' : 'FinOps Lens',
        });
      }
    } else if (currentStep === 4) {
      setCurrentStep(5);
    } else if (currentStep === 5) {
      handleSaveAndGoHome();
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
    startTour();
    go('dashboard');
  };

  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-start py-8 sm:py-12 px-4 sm:px-6 relative overflow-y-auto"
      style={{
        backgroundColor: '#0F172A',
        backgroundImage: 'radial-gradient(at 0% 0%, rgba(37, 99, 235, 0.15) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(16, 185, 129, 0.12) 0px, transparent 50%)',
      }}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-3xl flex flex-col gap-4 relative z-10 my-auto">

        {/* Interactive Step Stepper & Progress Bar */}
        <div className="bg-[#1E293B]/80 backdrop-blur-md border border-slate-700/60 rounded-2xl p-3 px-4 flex flex-col gap-2 shadow-lg">
          <div className="flex items-center justify-between text-xs font-semibold">
            <div className="flex items-center gap-2 sm:gap-4">
              {[
                { step: 1, label: 'Welcome to Lens' },
                { step: 2, label: 'About You' },
                { step: 3, label: 'Select Framework' },
                { step: 4, label: 'Organisation Questions' },
                { step: 5, label: 'Configure Accounts' },
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
                  CloudifyOps Multi-Cloud Architecture Review & Assessment Platform
                </p>
              </>
            )}

            {currentStep === 2 && (
              <>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  We want to know about you
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  That will help us to select the best options for you
                </p>
              </>
            )}

            {currentStep === 3 && (
              <>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Select Assessment Framework
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Choose the specialized evaluation lens for your workloads
                </p>
              </>
            )}

            {currentStep === 4 && (
              <>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Let us know more about your organisation
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Establish enterprise governance, cross-account security policies, and baseline compliance standards
                </p>
              </>
            )}

            {currentStep === 5 && (
              <>
                <h1 className="text-xl font-bold tracking-tight text-white">
                  Configure Cloud Accounts
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Authenticate your cloud credentials to enable automated architecture evaluation and AI remediation
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

          {/* STEP 2: We want to know about you */}
          {currentStep === 2 && (
            <div className="flex flex-col gap-6 my-auto max-w-xl mx-auto w-full py-2">
              {/* Industry Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                  <span>Choose an Industry</span>
                  <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={selectedIndustry}
                    onChange={e => setSelectedIndustry(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-medium text-white appearance-none outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner pr-10"
                  >
                    <option value="Fintech / Financial Services">Financial Services & Banking</option>
                    <option value="Healthcare & Life Sciences">Healthcare & Life Sciences</option>
                    <option value="E-Commerce & Retail">E-Commerce & Retail</option>
                    <option value="SaaS & Technology">SaaS & Technology / Software</option>
                    <option value="Energy & Utilities">Energy & Utilities</option>
                    <option value="Media & Entertainment">Media & Entertainment</option>
                    <option value="Telecommunications">Telecommunications</option>
                    <option value="Manufacturing & Supply Chain">Manufacturing & Logistics</option>
                    <option value="Education & Public Sector">Education & Public Sector</option>
                    <option value="Other Industry">Other Industry</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 leading-normal mt-0.5">
                  Selecting your industry tailors default compliance benchmarks, security controls, and architectural recommendations.
                </p>
              </div>

              {/* Organization Size Dropdown */}
              <div className="flex flex-col gap-2">
                <label className="block text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#34D399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span>Organization Size</span>
                </label>
                <div className="relative">
                  <select
                    value={organizationSize}
                    onChange={e => setOrganizationSize(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700/80 text-xs font-medium text-white appearance-none outline-none focus:border-blue-500 transition-all cursor-pointer shadow-inner pr-10"
                  >
                    <option value="1-50 employees">1 - 50 employees (Startup / Small Team)</option>
                    <option value="51-200 employees">51 - 200 employees (Mid-Market)</option>
                    <option value="201-1000 employees">201 - 1,000 employees (Growing Enterprise)</option>
                    <option value="1000+ employees">1,000+ employees (Large Enterprise)</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Select Lens Framework */}
          {currentStep === 3 && (
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
                    <h3 className="text-sm font-bold text-white">Well-Architected Framework Lens</h3>
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

              {/* GenAI Lens (Disabled) */}
              <button
                type="button"
                disabled
                className="text-left p-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 opacity-50 cursor-not-allowed select-none flex flex-col justify-between gap-3 shadow-inner"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/40 text-slate-500 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-sm font-bold text-slate-400">GenAI Lens</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                      Disabled
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    LLM security guardrails, prompt defense, token latency & inference cost tracking.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Coming Soon</span>
                  <span className="text-[10px] italic">Unavailable</span>
                </div>
              </button>

              {/* FinOps Lens (Disabled) */}
              <button
                type="button"
                disabled
                className="text-left p-5 rounded-2xl border border-slate-800/80 bg-slate-950/40 opacity-50 cursor-not-allowed select-none flex flex-col justify-between gap-3 shadow-inner"
              >
                <div>
                  <div className="w-10 h-10 rounded-xl bg-slate-800/50 border border-slate-700/40 text-slate-500 flex items-center justify-center mb-3">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="1" x2="12" y2="23" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <h3 className="text-sm font-bold text-slate-400">FinOps Lens</h3>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700/60">
                      Disabled
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Cloud spend anomaly detection, unit economics & idle infrastructure reduction.
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                  <span>Coming Soon</span>
                  <span className="text-[10px] italic">Unavailable</span>
                </div>
              </button>
            </div>
          )}

          {/* STEP 4: Organisation-Specific Questions */}
          {currentStep === 4 && (
            <div className="flex flex-col gap-3 my-auto">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-200">
                    Enterprise Governance & Policies ({orgQuestions.length})
                  </span>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                    {orgQuestions.filter(q => q.ans && q.ans.trim().length > 0).length} of {orgQuestions.length} Answered
                  </span>
                </div>
              </div>

              <div className="max-h-[460px] overflow-y-auto pr-1 flex flex-col gap-2.5">
                {orgQuestions.map(q => (
                  <div
                    key={q.id}
                    className="p-3 rounded-xl border border-slate-700/60 bg-slate-900/60 flex flex-col gap-2 transition-all hover:border-slate-600"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 flex-wrap min-w-0">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 shrink-0">
                          {q.id}
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 shrink-0">
                          {q.cat}
                        </span>
                        <h4 className="text-xs font-bold text-white leading-snug">
                          {q.q}
                        </h4>
                      </div>

                      {q.info && (
                        <button
                          type="button"
                          onClick={() => setSelectedInfoQuestion(q)}
                          className="w-5 h-5 rounded-full bg-blue-600/20 text-blue-400 hover:bg-blue-600 hover:text-white flex items-center justify-center font-serif italic font-bold text-[11px] transition-colors cursor-pointer shrink-0 ml-1"
                          title="View Framework Guidance & Evidence"
                        >
                          i
                        </button>
                      )}
                    </div>

                    <textarea
                      rows={2}
                      value={q.ans || ''}
                      onChange={e => updateOrgQuestion(q.id, e.target.value)}
                      placeholder="Enter organizational response, policy details, or baseline configuration notes..."
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all resize-none"
                    />

                    {q.manualChecks && q.manualChecks.length > 0 && (
                      <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-800/80">
                        {q.manualChecks.map(chk => {
                          const hintKey = `${q.id}-${chk.id}`;
                          const isHintOpen = !!openHints[hintKey];

                          return (
                            <div key={chk.id} className="flex flex-col gap-1 p-1 rounded-lg hover:bg-slate-800/30 transition-colors">
                              <div className="flex items-center justify-between gap-2">
                                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={chk.verified}
                                    onChange={() => toggleOrgCheck(q.id, chk.id)}
                                    className="rounded border-slate-700 text-blue-600 focus:ring-0 cursor-pointer shrink-0"
                                  />
                                  <span className={chk.verified ? 'line-through text-slate-500' : ''}>{chk.label}</span>
                                </label>
                                {chk.guidance && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleHint(hintKey);
                                    }}
                                    className={`w-4 h-4 rounded-full flex items-center justify-center font-serif italic font-bold text-[10px] transition-colors cursor-pointer shrink-0 ${
                                      isHintOpen
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-blue-500/20 text-blue-400 hover:bg-blue-600 hover:text-white'
                                    }`}
                                    title={isHintOpen ? 'Hide verification hint' : 'Click to show verification hint'}
                                  >
                                    i
                                  </button>
                                )}
                              </div>
                              {isHintOpen && chk.guidance && (
                                <div className="text-[10px] ml-6 px-2 py-1 rounded bg-blue-950/50 border border-blue-800/50 text-blue-300 font-mono flex items-start gap-1">
                                  <span className="font-bold text-blue-400 shrink-0">Hint:</span>
                                  <span className="leading-tight">{chk.guidance}</span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-[11px] text-slate-400 italic">
                Responses to organisation questions are stored at tenant level and automatically apply across all evaluated cloud accounts.
              </p>
            </div>
          )}

          {/* STEP 5: Configure Cloud Accounts Authentication */}
          {currentStep === 5 && (
            <div className="flex flex-col gap-4 my-auto">
              {/* Cloud Provider Tabs */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  { id: 'aws' as Cloud, name: 'Amazon Web Services', short: 'AWS', badge: 'Cross-Account IAM' },
                  { id: 'azure' as Cloud, name: 'Microsoft Azure', short: 'Azure', badge: 'Service Principal' },
                  { id: 'gcp' as Cloud, name: 'Google Cloud Platform', short: 'GCP', badge: 'Service Account' },
                ].map(c => {
                  const isSel = chosenCloud === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCloud(c.id)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSel
                          ? c.id === 'aws'
                            ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400/50'
                            : c.id === 'azure'
                            ? 'border-blue-400 bg-blue-950/30 ring-1 ring-blue-400/50'
                            : 'border-sky-400 bg-sky-950/30 ring-1 ring-sky-400/50'
                          : 'border-slate-700/70 bg-slate-900/40 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center p-1 shrink-0">
                          {c.id === 'aws' && <AwsWordmark width={24} height={16} />}
                          {c.id === 'azure' && <AzureMark size={20} />}
                          {c.id === 'gcp' && <GcpMark size={20} />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white leading-tight">{c.short}</div>
                          <div className="text-[10px] text-slate-400">{c.badge}</div>
                        </div>
                      </div>
                      <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[9px] ${
                        isSel ? 'bg-blue-500 border-blue-500 text-white font-bold' : 'border-slate-600'
                      }`}>
                        {isSel ? '✓' : ''}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Authentication Details Form */}
              <div className="bg-slate-900/60 border border-slate-700/80 rounded-2xl p-4 flex flex-col gap-3.5 shadow-md">
                {/* Account Metadata Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-800">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Account Display Name
                    </label>
                    <input
                      type="text"
                      value={accountName}
                      onChange={(e) => setAccountName(e.target.value)}
                      placeholder="e.g. acme-production"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      {chosenCloud === 'aws' ? 'AWS Account ID (12 digits)' : chosenCloud === 'azure' ? 'Azure Subscription ID' : 'GCP Project ID'}
                    </label>
                    <input
                      type="text"
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                      placeholder={chosenCloud === 'aws' ? '124890123456' : chosenCloud === 'azure' ? 'sub-4891-2394-8172' : 'proj-gcp-prod-9941'}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* AWS Auth Config */}
                {chosenCloud === 'aws' && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">AWS Authentication Method</span>
                      <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800">
                        <button
                          type="button"
                          onClick={() => setAuthMethod('role')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                            authMethod === 'role' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          IAM Role (Recommended)
                        </button>
                        <button
                          type="button"
                          onClick={() => setAuthMethod('keys')}
                          className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                            authMethod === 'keys' ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          Access Keys
                        </button>
                      </div>
                    </div>

                    {authMethod === 'role' ? (
                      <>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Cross-Account IAM Role ARN
                          </label>
                          <input
                            type="text"
                            value={roleArn}
                            onChange={(e) => setRoleArn(e.target.value)}
                            placeholder="arn:aws:iam::123456789012:role/CloudifyOpsWAFRReadOnlyRole"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/50 border border-slate-800 text-xs">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block uppercase">Required External ID</span>
                            <span className="font-mono text-slate-200 text-xs font-semibold">{externalId}</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleCopyExternalId}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-medium text-slate-200 transition-colors cursor-pointer"
                          >
                            {copiedId ? 'Copied!' : 'Copy ID'}
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-400">
                          Requires read-only permissions for architecture evaluation.
                        </p>
                      </>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            AWS Access Key ID
                          </label>
                          <input
                            type="text"
                            value={accessKey}
                            onChange={(e) => setAccessKey(e.target.value)}
                            placeholder="AKIAIOSFODNN7EXAMPLE"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            AWS Secret Access Key
                          </label>
                          <input
                            type="password"
                            value={secretKey}
                            onChange={(e) => setSecretKey(e.target.value)}
                            placeholder="••••••••••••••••••••••••"
                            className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Azure Auth Config */}
                {chosenCloud === 'azure' && (
                  <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Azure Tenant (Directory) ID
                        </label>
                        <input
                          type="text"
                          value={azureTenantId}
                          onChange={(e) => setAzureTenantId(e.target.value)}
                          placeholder="tenant-0000-0000-0000"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Application (Client) ID
                        </label>
                        <input
                          type="text"
                          value={azureClientId}
                          onChange={(e) => setAzureClientId(e.target.value)}
                          placeholder="client-0000-0000-0000"
                          className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Client Secret Value
                      </label>
                      <input
                        type="password"
                        value={azureClientSecret}
                        onChange={(e) => setAzureClientSecret(e.target.value)}
                        placeholder="••••••••••••••••••••••••"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-400"
                      />
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Requires read-only permissions for architecture evaluation.
                    </p>
                  </div>
                )}

                {/* GCP Auth Config */}
                {chosenCloud === 'gcp' && (
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Service Account Email
                      </label>
                      <input
                        type="text"
                        value={gcpSaEmail}
                        onChange={(e) => setGcpSaEmail(e.target.value)}
                        placeholder="wafr-scanner@your-project.iam.gserviceaccount.com"
                        className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                      <div>
                        <div className="text-xs font-semibold text-white">Service Account Key (JSON)</div>
                        <div className="text-[11px] text-slate-400 font-medium">Default scan credential loaded & active</div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 text-[11px] font-semibold">
                        Ready
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">
                      Requires read-only permissions for architecture evaluation.
                    </p>
                  </div>
                )}

                {/* Test Connection Row */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-3 border-t border-slate-800">
                  <div>
                    {testStatus === 'idle' && (
                      <span className="text-[11px] text-slate-400">
                        Verify read-only API authentication before saving account
                      </span>
                    )}
                    {testStatus === 'testing' && (
                      <div className="flex items-center gap-2 text-[11px] text-blue-400">
                        <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Testing credentials and read-only API access...</span>
                      </div>
                    )}
                    {testStatus === 'success' && (
                      <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span>Connection verified! Read-only scanning permissions active.</span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleTestConnection}
                    disabled={testStatus === 'testing'}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 transition-colors cursor-pointer shrink-0"
                  >
                    {testStatus === 'success' ? 'Re-test Connection' : 'Test Connection'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Bottom Bar: Back on Left (Step 2/3/4), Skip Tour & Continue on Right */}
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
              {currentStep === totalSteps && (
                <button
                  type="button"
                  onClick={() => {
                    setIsNewUser(true);
                    setConfiguredAccount(null);
                    setCloud(null);
                    startTour();
                    go('dashboard');
                  }}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-all cursor-pointer"
                >
                  Skip for now
                </button>
              )}
              <button
                type="button"
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md cursor-pointer"
              >
                <span>
                  {currentStep === totalSteps
                    ? 'Continue'
                    : currentStep === 4
                    ? 'Next: Configure Accounts'
                    : currentStep === 3
                    ? 'Next: Organisation Questions'
                    : currentStep === 2
                    ? 'Next: Select Framework'
                    : 'Next: About You'}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── QUESTION INFO MODAL ('i' Button Guidance Popup) ── */}
      {selectedInfoQuestion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0e1626] border border-blue-500/40 rounded-2xl p-6 text-white shadow-2xl relative max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between pb-3 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-serif italic font-bold text-sm">
                  i
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">
                      {selectedInfoQuestion.id}
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">
                      {selectedInfoQuestion.cat}
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-white mt-1 leading-snug">
                    {selectedInfoQuestion.q}
                  </h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedInfoQuestion(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3 text-xs">
              {selectedInfoQuestion.info?.frameworkRef && (
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800">
                  <span className="text-slate-400 font-medium block mb-0.5 text-[11px]">
                    WAFR Framework Reference
                  </span>
                  <span className="font-mono font-bold text-blue-400">
                    {selectedInfoQuestion.info.frameworkRef}
                  </span>
                </div>
              )}

              {selectedInfoQuestion.info?.whyItMatters && (
                <div>
                  <h4 className="font-bold text-white mb-1">Why It Matters</h4>
                  <p className="text-slate-300 leading-relaxed text-[11px]">
                    {selectedInfoQuestion.info.whyItMatters}
                  </p>
                </div>
              )}

              {selectedInfoQuestion.info?.howToVerify && selectedInfoQuestion.info.howToVerify.length > 0 && (
                <div>
                  <h4 className="font-bold text-white mb-1.5">How to Verify in Cloud Consoles</h4>
                  <div className="flex flex-col gap-1.5">
                    {selectedInfoQuestion.info.howToVerify.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-slate-900/60">
                        <span className="w-4 h-4 rounded-full bg-blue-600/30 text-blue-400 font-bold flex items-center justify-center shrink-0 text-[10px]">
                          {idx + 1}
                        </span>
                        <span className="text-slate-300 text-[11px] leading-relaxed">{step}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedInfoQuestion.info?.auditEvidence && (
                <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
                  <span className="font-bold text-emerald-400 block mb-1 text-[11px]">
                    Recommended Audit Evidence
                  </span>
                  <p className="text-emerald-300/90 font-mono text-[11px] leading-relaxed">
                    {selectedInfoQuestion.info.auditEvidence}
                  </p>
                </div>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedInfoQuestion(null)}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

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

            {/* Notification alert */}
            {!notified ? (
              <div className="mb-5 flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-700">
                <span className="text-xs text-slate-300">Get notified via Slack & Google Chat alerts when available</span>
                <button
                  type="button"
                  onClick={() => setNotified(true)}
                  className="px-3.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
                >
                  Notify Me
                </button>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs mb-5 text-center font-medium">
                ✓ Alert subscribed! You will be notified when early access opens.
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
