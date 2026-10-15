import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../context';

interface TourStep {
  id: string;
  targetId: string;
  title: string;
  badge: string;
  description: string;
  position: 'bottom' | 'top' | 'right' | 'left' | 'bottom-left' | 'bottom-right';
  icon: (color: string) => React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'stats-overview',
    targetId: 'tour-dashboard-stats',
    title: 'Dashboard Overview',
    badge: 'Step 1 of 6',
    description: 'Monitor your architecture score, high-risk findings, and cloud posture here.',
    position: 'bottom',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect width="18" height="18" x="3" y="3" rx="2" />
        <path d="M3 9h18" />
        <path d="M9 21V9" />
      </svg>
    ),
  },
  {
    id: 'new-assessment-btn',
    targetId: 'tour-new-assessment-btn',
    title: 'Create New Assessment',
    badge: 'Step 2 of 6',
    description: 'Click here to start a new Well-Architected Framework review for AWS, Azure, or GCP.',
    position: 'bottom-left',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    ),
  },
  {
    id: 'nav-assessments',
    targetId: 'tour-nav-assessments',
    title: 'View Assessments',
    badge: 'Step 3 of 6',
    description: 'View all your completed assessments, pillar breakdowns, and milestone snapshots here.',
    position: 'right',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    id: 'nav-remediation',
    targetId: 'tour-nav-remediation',
    title: 'AI Remediation Hub',
    badge: 'Step 4 of 6',
    description: 'Generate automated Terraform and CloudFormation code fixes for failed checks.',
    position: 'right',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
      </svg>
    ),
  },
  {
    id: 'nav-settings',
    targetId: 'tour-nav-settings',
    title: 'Cloud & Repo Settings',
    badge: 'Step 5 of 6',
    description: 'Manage your saved cloud credentials (AWS, Azure, GCP) and Git repositories.',
    position: 'right',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
  {
    id: 'theme-controls',
    targetId: 'tour-theme-controls',
    title: 'Theme & Preferences',
    badge: 'Step 6 of 6',
    description: 'Toggle between Dark and Light mode, or restart this product tour anytime.',
    position: 'top',
    icon: (c) => (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5" />
        <line x1="12" y1="1" x2="12" y2="3" />
        <line x1="12" y1="21" x2="12" y2="23" />
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
        <line x1="1" y1="12" x2="3" y2="12" />
        <line x1="21" y1="12" x2="23" y2="12" />
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
      </svg>
    ),
  },
];

export function SpotlightTour() {
  const { isTourOpen, closeTour, theme } = useApp();
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  const isDark = theme === 'dark';
  const currentStep = TOUR_STEPS[currentStepIndex];

  // Update target rect based on active step target element
  const updateRect = useCallback(() => {
    if (!isTourOpen || !currentStep) return;
    const el = document.getElementById(currentStep.targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
      // Ensure element is visible
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } else {
      // Fallback center of screen
      setTargetRect(null);
    }
  }, [isTourOpen, currentStep]);

  useEffect(() => {
    if (isTourOpen) {
      setIsAnimating(true);
      const timer = setTimeout(() => {
        updateRect();
        setIsAnimating(false);
      }, 50);
      window.addEventListener('resize', updateRect);
      window.addEventListener('scroll', updateRect, true);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('resize', updateRect);
        window.removeEventListener('scroll', updateRect, true);
      };
    }
  }, [isTourOpen, currentStepIndex, updateRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isTourOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeTour();
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        handleNext();
      } else if (e.key === 'ArrowLeft') {
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isTourOpen, currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleFinish = () => {
    setCurrentStepIndex(0);
    closeTour();
  };

  // Card Positioning Calculation
  const cardStyle = useMemo(() => {
    const cardWidth = 320;
    const cardMargin = 14;
    const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const windowHeight = typeof window !== 'undefined' ? window.innerHeight : 800;

    if (!targetRect) {
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        position: 'fixed' as const,
      };
    }

    const { top, left, right, bottom, width, height } = targetRect;
    let computedTop = 0;
    let computedLeft = 0;

    switch (currentStep.position) {
      case 'bottom':
        computedTop = bottom + cardMargin;
        computedLeft = left + width / 2 - cardWidth / 2;
        break;
      case 'bottom-left':
        computedTop = bottom + cardMargin;
        computedLeft = right - cardWidth;
        break;
      case 'bottom-right':
        computedTop = bottom + cardMargin;
        computedLeft = left;
        break;
      case 'right':
        computedTop = Math.max(20, top + height / 2 - 100);
        computedLeft = right + cardMargin;
        break;
      case 'left':
        computedTop = Math.max(20, top + height / 2 - 100);
        computedLeft = left - cardWidth - cardMargin;
        break;
      case 'top':
        computedTop = Math.max(20, top - 180 - cardMargin);
        computedLeft = right + cardMargin;
        break;
      default:
        computedTop = bottom + cardMargin;
        computedLeft = left;
    }

    // Boundary clamping
    if (computedLeft + cardWidth > windowWidth - 20) {
      computedLeft = windowWidth - cardWidth - 20;
    }
    if (computedLeft < 20) {
      computedLeft = 20;
    }
    if (computedTop < 20) {
      computedTop = 20;
    }
    if (computedTop + 200 > windowHeight) {
      computedTop = Math.max(20, windowHeight - 220);
    }

    return {
      top: `${computedTop}px`,
      left: `${computedLeft}px`,
      position: 'fixed' as const,
    };
  }, [targetRect, currentStep]);

  if (!isTourOpen || !currentStep) return null;

  const pad = 8;
  const spotX = targetRect ? targetRect.left - pad : 0;
  const spotY = targetRect ? targetRect.top - pad : 0;
  const spotW = targetRect ? targetRect.width + pad * 2 : 0;
  const spotH = targetRect ? targetRect.height + pad * 2 : 0;
  const spotR = 14;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans select-none animate-in fade-in duration-200">
      {/* ── Spotlight SVG Mask Overlay ── */}
      <svg className="absolute inset-0 w-full h-full pointer-events-auto">
        <defs>
          <mask id="spotlight-mask">
            {/* White covers all (opaque) */}
            <rect width="100%" height="100%" fill="white" />
            {/* Black cuts out target (transparent hole) */}
            {targetRect && (
              <rect
                x={spotX}
                y={spotY}
                width={spotW}
                height={spotH}
                rx={spotR}
                ry={spotR}
                fill="black"
              />
            )}
          </mask>
        </defs>
        {/* Dark backdrop filled with cut-out mask */}
        <rect
          width="100%"
          height="100%"
          fill={isDark ? 'rgba(3, 7, 18, 0.75)' : 'rgba(15, 23, 42, 0.68)'}
          mask="url(#spotlight-mask)"
        />
      </svg>

      {/* ── Glowing Animated Spotlight Border & Pulse Ring around Target Element ── */}
      {targetRect && (
        <div
          className="fixed pointer-events-none transition-all duration-300 ease-out"
          style={{
            top: `${spotY}px`,
            left: `${spotX}px`,
            width: `${spotW}px`,
            height: `${spotH}px`,
            borderRadius: `${spotR}px`,
            border: '2px solid #3B82F6',
            boxShadow: '0 0 20px 2px rgba(59, 130, 246, 0.6), inset 0 0 15px rgba(59, 130, 246, 0.25)',
          }}
        >
          {/* Pulsing Beacon Dot */}
          <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-white shadow-sm" />
          </span>
        </div>
      )}

      {/* ── Floating Tooltip Card ── */}
      <div
        style={{
          ...cardStyle,
          backgroundColor: isDark ? 'rgba(17, 24, 39, 0.96)' : 'rgba(255, 255, 255, 0.98)',
          borderColor: isDark ? 'rgba(59, 130, 246, 0.35)' : '#BFDBFE',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(59, 130, 246, 0.15)',
        }}
        className="w-[320px] max-w-[90vw] z-50 rounded-2xl shadow-2xl transition-all duration-300 ease-out border backdrop-blur-xl overflow-hidden"
      >
        <div
          className="p-4 flex flex-col gap-2.5"
          style={{
            backgroundColor: isDark ? '#111827' : '#FFFFFF',
            color: isDark ? '#F9FAFB' : '#0F172A',
          }}
        >
          {/* Header row: Badge + Skip button */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500">
                {currentStep.badge}
              </span>
            </div>

            <button
              type="button"
              onClick={handleFinish}
              className="text-[11px] font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Skip ✕
            </button>
          </div>

          {/* Title & Icon */}
          <div className="flex items-start gap-2.5 mt-0.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-500 flex items-center justify-center shrink-0">
              {currentStep.icon('#3B82F6')}
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">
                {currentStep.title}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-snug">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Stepper Dots & Navigation Actions */}
          <div className="flex items-center justify-between pt-2 mt-0.5 border-t border-slate-200 dark:border-slate-800">
            {/* Step Dots */}
            <div className="flex items-center gap-1">
              {TOUR_STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStepIndex(idx)}
                  className={`h-1.5 rounded-full transition-all cursor-pointer ${
                    idx === currentStepIndex
                      ? 'w-5 bg-blue-500'
                      : idx < currentStepIndex
                      ? 'w-1.5 bg-emerald-500'
                      : 'w-1.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                  }`}
                  title={`Go to step ${idx + 1}`}
                />
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5">
              {currentStepIndex > 0 && (
                <button
                  type="button"
                  onClick={handlePrev}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Back
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                className="px-3.5 py-1 rounded-lg text-xs font-bold text-white transition-all shadow-sm cursor-pointer hover:opacity-95 active:scale-95 flex items-center gap-1"
                style={{
                  background: 'linear-gradient(135deg, #2563EB, #10B981)',
                }}
              >
                <span>
                  {currentStepIndex === TOUR_STEPS.length - 1 ? 'Done' : 'Next →'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
