import React, { Component, ReactNode } from 'react';
import { AppProvider, useApp } from './context';
import { Login } from './screens/Login';
import { Dashboard } from './screens/Dashboard';
import { SelectCloud } from './screens/SelectCloud';
import { AssessmentList } from './screens/AssessmentList';
import { Wizard } from './screens/Wizard';
import { LiveScan } from './screens/LiveScan';
import { AssessmentReport } from './screens/AssessmentReport';
import { PillarDetail } from './screens/PillarDetail';
import { Milestones } from './screens/Milestones';
import { AIRemediation } from './screens/AIRemediation';
import { AIFix } from './screens/AIFix';
import { ArchitectureDiagram } from './screens/ArchitectureDiagram';
import { Settings } from './screens/Settings';
import { Admin } from './screens/Admin';
import { Onboarding } from './screens/Onboarding';
import { SelectLens } from './screens/SelectLens';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('AppErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2">Something went wrong</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6">
            {this.state.error?.message || 'An unexpected error occurred while rendering the page.'}
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-5 py-2.5 rounded-full text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function ScreenRouter() {
  const { screen } = useApp();
  switch (screen) {
    case 'login':           return <Login />;
    case 'dashboard':       return <Dashboard />;
    case 'select-cloud':    return <SelectCloud />;
    case 'assessment-list': return <AssessmentList />;
    case 'wizard':          return <Wizard />;
    case 'live-scan':       return <LiveScan />;
    case 'report':          return <AssessmentReport />;
    case 'pillar-detail':   return <PillarDetail />;
    case 'milestones':      return <Milestones />;
    case 'remediation':     return <AIRemediation />;
    case 'ai-fix':          return <AIFix />;
    case 'diagram':         return <ArchitectureDiagram />;
    case 'settings':        return <Settings />;
    case 'admin':           return <Admin />;
    case 'onboarding':      return <Onboarding />;
    case 'select-lens':     return <SelectLens />;
    default:                return <Login />;
  }
}

function AppShell() {
  const { theme } = useApp();
  return (
    <div
      className={`relative h-screen overflow-hidden font-sans ${theme === 'dark' ? 'dark' : ''}`}
      style={{ fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
    >
      <AppErrorBoundary>
        <ScreenRouter />
      </AppErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}
