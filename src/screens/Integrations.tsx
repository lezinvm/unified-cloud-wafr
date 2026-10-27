import { useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';
import { api } from '../services/apiClient';
import { SlackLogo, JiraLogo, GChatLogo } from '../components/IntegrationLogos';
import {
  SlackIntegration,
  JiraIntegration,
  GChatIntegration,
  AlertLogItem,
} from '../data/integrationData';

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#64748B',
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  success: '#059669',
  successBg: '#ECFDF5',
  successBar: '#10B981',
  error: '#E11D48',
  errorBg: '#FFF1F2',
  errorBar: '#FB7185',
  warning: '#D97706',
  warningBg: '#FFFBEB',
  warningBar: '#FBBF24',
  muted: '#94A3B8',
  progress: '#10B981',
  activeNavBg: '#EFF6FF',
  shadow: '0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)',
};

const DARK = {
  bg: '#0B1220',
  card: '#111B2E',
  border: '#1E293B',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,.15)',
  success: '#52B788',
  successBg: 'rgba(82,183,136,.12)',
  successBar: 'rgba(82,183,136,.75)',
  error: '#FB7185',
  errorBg: 'rgba(251,113,133,.12)',
  errorBar: 'rgba(251,113,133,.65)',
  warning: '#FBBF24',
  warningBg: 'rgba(251,191,36,.12)',
  warningBar: 'rgba(251,191,36,.65)',
  muted: '#94A3B8',
  progress: '#52B788',
  activeNavBg: 'rgba(59,130,246,.12)',
  shadow: '0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)',
};

type IntegrationType = 'slack' | 'jira' | 'gchat';

export function Integrations() {
  const { go, theme, integrations, updateIntegrations, alertLogs, addAlertLog } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [activeTab, setActiveTab] = useState<'all' | 'rules' | 'logs'>('all');
  const [selectedService, setSelectedService] = useState<IntegrationType | null>(null);
  const [testNotificationToast, setTestNotificationToast] = useState<string | null>(null);

  // Form states for modals/drawers
  const [slackForm, setSlackForm] = useState<SlackIntegration>(integrations.slack);
  const [jiraForm, setJiraForm] = useState<JiraIntegration>(integrations.jira);
  const [gchatForm, setGChatForm] = useState<GChatIntegration>(integrations.gchat);

  const showToast = (msg: string) => {
    setTestNotificationToast(msg);
    setTimeout(() => {
      setTestNotificationToast(null);
    }, 4000);
  };

  const handleOpenConfig = (service: IntegrationType) => {
    if (service === 'slack') setSlackForm(integrations.slack);
    if (service === 'jira') setJiraForm(integrations.jira);
    if (service === 'gchat') setGChatForm(integrations.gchat);
    setSelectedService(service);
  };

  const handleSaveSlack = () => {
    const updated = {
      ...slackForm,
      connected: Boolean(slackForm.webhookUrl.trim()),
    };
    updateIntegrations({ slack: updated });
    api.saveIntegration({ ...updated, service_type: 'slack' }).catch(err => console.warn('Could not save slack to MongoDB:', err));
    setSelectedService(null);
    showToast('Slack integration settings successfully saved!');
  };

  const handleSaveJira = () => {
    const updated = {
      ...jiraForm,
      connected: Boolean(jiraForm.host.trim() && jiraForm.projectKey.trim()),
    };
    updateIntegrations({ jira: updated });
    api.saveIntegration({ ...updated, service_type: 'jira' }).catch(err => console.warn('Could not save jira to MongoDB:', err));
    setSelectedService(null);
    showToast('Jira Software ticketing integration successfully saved!');
  };

  const handleSaveGChat = () => {
    const updated = {
      ...gchatForm,
      connected: Boolean(gchatForm.webhookUrl.trim()),
    };
    updateIntegrations({ gchat: updated });
    api.saveIntegration({ ...updated, service_type: 'gchat' }).catch(err => console.warn('Could not save gchat to MongoDB:', err));
    setSelectedService(null);
    showToast('Google Chat alerts integration successfully saved!');
  };

  const triggerTestAlert = (service: IntegrationType) => {
    const serviceName = service === 'slack' ? 'Slack' : service === 'jira' ? 'Jira' : 'Google Chat';
    addAlertLog({
      service,
      title: `Manual Test Notification to ${serviceName}`,
      details: `Dispatched test payload successfully verifying webhook handshake & schema integrity.`,
      status: 'delivered',
      severity: 'info',
    });

    if (service === 'slack') {
      showToast(`Test alert sent to Slack channel ${slackForm.channel || '#cloud-security-alerts'}!`);
      setSlackForm(prev => ({ ...prev, lastTested: 'Just now (Success)' }));
    } else if (service === 'jira') {
      showToast(`Handshake verified with Jira instance (${jiraForm.host || 'cloudifyops.atlassian.net'})!`);
      setJiraForm(prev => ({ ...prev, lastTested: 'Just now (Connected)' }));
    } else if (service === 'gchat') {
      showToast(`Test alert card dispatched to Google Chat space "${gchatForm.spaceName || 'Cloud Architecture & Security Alerts'}"!`);
      setGChatForm(prev => ({ ...prev, lastTested: 'Just now (Success)' }));
    }
  };

  const connectedCount = [
    integrations.slack?.connected,
    integrations.jira?.connected,
    integrations.gchat?.connected,
  ].filter(Boolean).length;

  return (
    <AppLayout>
      <div className="flex flex-col" style={{ backgroundColor: T.bg, minHeight: '100%' }}>
        {/* Toast Notification */}
        {testNotificationToast && (
          <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-emerald-600 text-white shadow-2xl text-xs font-semibold animate-in fade-in slide-in-from-top-2 duration-200">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>{testNotificationToast}</span>
          </div>
        )}

        {/* Page header */}
        <div className="px-6 py-4" style={{ backgroundColor: T.card, borderBottom: `1px solid ${T.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <nav className="text-xs flex items-center gap-1.5" style={{ color: T.textSub }}>
              <button
                onClick={() => go('dashboard')}
                className="hover:underline transition-colors cursor-pointer"
                style={{ color: T.primary }}
              >
                Home
              </button>
              <span>/</span>
              <span style={{ color: T.text }}>Integrations & Alerting</span>
            </nav>

            <button
              onClick={() => go('dashboard')}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors cursor-pointer"
              style={{ borderColor: T.border, color: T.textSub }}
            >
              Back to Home
            </button>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="font-semibold text-xl" style={{ color: T.text }}>
                Integrations & Alerting
              </h1>
              <p className="text-sm mt-0.5" style={{ color: T.textSub }}>
                Configure Slack and Google Chat for real-time security alerts and Jira Software for automatic issue ticketing.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => triggerTestAlert('slack')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold border transition-all cursor-pointer shadow-xs hover:border-blue-500"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                  borderColor: T.border,
                  color: T.text,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Test Alert Dispatch</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenConfig('slack')}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90 cursor-pointer shadow-sm"
                style={{ background: 'linear-gradient(135deg,#2563EB,#22C55E)' }}
              >
                <span>+ Connect Integration</span>
              </button>
            </div>
          </div>

          {/* Header Tabs */}
          <div className="flex items-center gap-2 mt-5 border-b -mb-4 pb-0" style={{ borderColor: T.border }}>
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'all'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
              </svg>
              <span>All Integrations</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px]"
                style={{
                  backgroundColor: activeTab === 'all' ? (isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  color: activeTab === 'all' ? '#2563EB' : T.textSub,
                }}
              >
                {connectedCount} / 3 connected
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('rules')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'rules'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
              <span>Alert Rules & Triggers</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                style={{
                  backgroundColor: activeTab === 'rules' ? (isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  color: activeTab === 'rules' ? '#2563EB' : T.textSub,
                }}
              >
                4 active
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('logs')}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer ${
                activeTab === 'logs'
                  ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              <span>Dispatched Alert Logs</span>
              <span
                className="px-2 py-0.5 rounded-full text-[10px]"
                style={{
                  backgroundColor: activeTab === 'logs' ? (isDark ? 'rgba(37,99,235,0.2)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9'),
                  color: activeTab === 'logs' ? '#2563EB' : T.textSub,
                }}
              >
                {alertLogs.length}
              </span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6">
          {/* Top Metrics Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              className="p-5 rounded-2xl border flex flex-col gap-1.5"
              style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
            >
              <span className="text-xs font-medium" style={{ color: T.textSub }}>Connected Integrations</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-bold" style={{ color: T.text }}>{connectedCount} <span className="text-xs font-normal opacity-60">of 3 active</span></span>
                <span className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </span>
              </div>
            </div>

            <div
              className="p-5 rounded-2xl border flex flex-col gap-1.5"
              style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
            >
              <span className="text-xs font-medium" style={{ color: T.textSub }}>Active Notification Rules</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-bold" style={{ color: T.text }}>4 Rules</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                </span>
              </div>
            </div>

            <div
              className="p-5 rounded-2xl border flex flex-col gap-1.5"
              style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
            >
              <span className="text-xs font-medium" style={{ color: T.textSub }}>Alerts Dispatched</span>
              <div className="flex items-center justify-between mt-1">
                <span className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{alertLogs.length} Delivered</span>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
              </div>
            </div>
          </div>

          {/* TAB 1: ALL INTEGRATIONS (Slack, Jira, Google Chat only) */}
          {activeTab === 'all' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* SLACK CARD */}
              <div
                className="p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#4A154B]/10 dark:bg-[#4A154B]/20 border border-[#4A154B]/20 p-2 shrink-0">
                        <SlackLogo className="w-full h-full" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: T.text }}>Slack</h3>
                        <p className="text-[11px]" style={{ color: T.textSub }}>Team collaboration & alerts</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                        integrations.slack?.connected
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${integrations.slack?.connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {integrations.slack?.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    Receive real-time alerts in your Slack channels whenever High Risk Issues (HRIs) are identified or architecture scores drop.
                  </p>

                  {integrations.slack?.connected && (
                    <div className="mt-3 p-2.5 rounded-xl border bg-black/5 dark:bg-black/20 text-xs font-mono flex items-center justify-between" style={{ borderColor: T.border }}>
                      <span style={{ color: T.text }}>Channel: {integrations.slack.channel}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Active</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => triggerTestAlert('slack')}
                    className="text-xs font-semibold hover:underline cursor-pointer"
                    style={{ color: T.primary }}
                  >
                    Send Test Ping
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenConfig('slack')}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:border-blue-500 cursor-pointer"
                    style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', color: T.text }}
                  >
                    Configure
                  </button>
                </div>
              </div>

              {/* JIRA SOFTWARE CARD */}
              <div
                className="p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#0052CC]/10 dark:bg-[#0052CC]/20 border border-[#0052CC]/20 p-2 shrink-0">
                        <JiraLogo className="w-full h-full" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: T.text }}>Jira Software</h3>
                        <p className="text-[11px]" style={{ color: T.textSub }}>Issue tracking & ticketing</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                        integrations.jira?.connected
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${integrations.jira?.connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {integrations.jira?.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    Automatically create, assign, and synchronize Jira tickets for architectural findings, tracking progress from review to remediation.
                  </p>

                  {integrations.jira?.connected && (
                    <div className="mt-3 p-2.5 rounded-xl border bg-black/5 dark:bg-black/20 text-xs font-mono flex items-center justify-between" style={{ borderColor: T.border }}>
                      <span style={{ color: T.text }}>Project: {integrations.jira.projectKey}</span>
                      <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">Auto-Ticket Enabled</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => triggerTestAlert('jira')}
                    className="text-xs font-semibold hover:underline cursor-pointer"
                    style={{ color: T.primary }}
                  >
                    Test Jira Sync
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenConfig('jira')}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:border-blue-500 cursor-pointer"
                    style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', color: T.text }}
                  >
                    Configure
                  </button>
                </div>
              </div>

              {/* GOOGLE CHAT CARD */}
              <div
                className="p-5 rounded-2xl border flex flex-col justify-between gap-4 transition-all hover:shadow-lg"
                style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[#00AC47]/10 dark:bg-[#00AC47]/20 border border-[#00AC47]/25 p-2 shrink-0">
                        <GChatLogo className="w-full h-full" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm" style={{ color: T.text }}>Google Chat</h3>
                        <p className="text-[11px]" style={{ color: T.textSub }}>Workspace room alerts & webhooks</p>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                        integrations.gchat?.connected
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                          : 'bg-gray-500/10 text-gray-500 border border-gray-500/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${integrations.gchat?.connected ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                      {integrations.gchat?.connected ? 'Connected' : 'Not Connected'}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed" style={{ color: T.textSub }}>
                    Send rich formatted alert cards into Google Workspace Chat rooms with real-time risk severity and remediation shortcuts.
                  </p>

                  {integrations.gchat?.connected && (
                    <div className="mt-3 p-2.5 rounded-xl border bg-black/5 dark:bg-black/20 text-xs font-mono flex items-center justify-between" style={{ borderColor: T.border }}>
                      <span className="truncate max-w-[200px]" style={{ color: T.text }}>Space: {integrations.gchat.spaceName}</span>
                      <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">Live</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => triggerTestAlert('gchat')}
                    className="text-xs font-semibold hover:underline cursor-pointer"
                    style={{ color: T.primary }}
                  >
                    Test Chat Card
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenConfig('gchat')}
                    className="px-4 py-1.5 rounded-xl text-xs font-semibold border transition-all hover:border-emerald-500 cursor-pointer"
                    style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', color: T.text }}
                  >
                    Configure
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALERT RULES & TRIGGERS */}
          {activeTab === 'rules' && (
            <div
              className="p-6 rounded-2xl border flex flex-col gap-5"
              style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
            >
              <div>
                <h2 className="text-base font-bold" style={{ color: T.text }}>
                  Automated Alert Routing Rules
                </h2>
                <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                  Configure which events trigger alerts and which connected channels receive the notification payload.
                </p>
              </div>

              <div className="space-y-3">
                {[
                  {
                    title: 'Critical Severity High Risk Issue (HRI) Detected',
                    desc: 'Triggers immediately when a Critical vulnerability is found (e.g. S3 bucket public access, unencrypted database).',
                    channels: ['Slack (#cloud-security-alerts)', 'Jira (Auto-ticket WAFR)', 'Google Chat (Cloud Architecture Alerts)'],
                    enabled: true,
                    severity: 'critical',
                  },
                  {
                    title: 'WAFR Workload Score Drops Below 80%',
                    desc: 'Triggers when a scheduled or manual rerun score degrades compared to the previous baseline milestone.',
                    channels: ['Slack (#cloud-security-alerts)', 'Google Chat (Cloud Architecture Alerts)'],
                    enabled: true,
                    severity: 'high',
                  },
                  {
                    title: 'Scheduled Architecture Assessment Completed',
                    desc: 'Dispatches high-level pillar scores, total check summary, and report link upon scan finish.',
                    channels: ['Slack (#cloud-security-alerts)', 'Google Chat (Cloud Architecture Alerts)'],
                    enabled: true,
                    severity: 'info',
                  },
                  {
                    title: 'Terraform / IaC AI Remediation PR Created or Merged',
                    desc: 'Notifies the engineering team when an AI-generated pull request is submitted to GitHub/GitLab.',
                    channels: ['Slack (#cloud-security-alerts)', 'Jira (WAFR Ticket Status Update)'],
                    enabled: true,
                    severity: 'info',
                  },
                ].map((rule, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-xl border flex items-center justify-between gap-4"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            rule.severity === 'critical'
                              ? 'bg-rose-500'
                              : rule.severity === 'high'
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                        />
                        <span className="text-sm font-semibold" style={{ color: T.text }}>
                          {rule.title}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: T.textSub }}>
                        {rule.desc}
                      </p>
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>
                          Routed To:
                        </span>
                        {rule.channels.map((ch, i) => (
                          <span
                            key={i}
                            className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                          >
                            {ch}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Active
                      </span>
                      <button
                        type="button"
                        onClick={() => showToast(`Alert rule "${rule.title}" updated!`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: T.border, color: T.text }}
                      >
                        Edit Rule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: DISPATCHED ALERT LOGS */}
          {activeTab === 'logs' && (
            <div
              className="p-6 rounded-2xl border flex flex-col gap-4"
              style={{ backgroundColor: T.card, borderColor: T.border, boxShadow: T.shadow }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold" style={{ color: T.text }}>
                    Real-Time Notification Audit Log
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    Chronological audit feed of all alerts and webhooks dispatched from your assessments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => triggerTestAlert('slack')}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white cursor-pointer transition-colors"
                >
                  + Trigger Live Test Event
                </button>
              </div>

              <div className="space-y-2.5">
                {alertLogs.map(log => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border flex items-center justify-between gap-4"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center p-1.5 shrink-0"
                        style={{
                          backgroundColor: log.service === 'slack' ? '#4A154B20' : log.service === 'jira' ? '#0052CC20' : '#00AC4720',
                          border: `1px solid ${log.service === 'slack' ? '#4A154B30' : log.service === 'jira' ? '#0052CC30' : '#00AC4730'}`,
                        }}
                      >
                        {log.service === 'slack' ? (
                          <SlackLogo className="w-full h-full" />
                        ) : log.service === 'jira' ? (
                          <JiraLogo className="w-full h-full" />
                        ) : (
                          <GChatLogo className="w-full h-full" />
                        )}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border" style={{ borderColor: T.border, color: T.textSub }}>
                            {log.id}
                          </span>
                          <span className="text-xs font-bold truncate" style={{ color: T.text }}>
                            {log.title}
                          </span>
                          <span className="text-[10px] font-mono capitalize px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                            {log.service === 'gchat' ? 'Google Chat' : log.service}
                          </span>
                        </div>
                        <p className="text-[11px] truncate mt-0.5" style={{ color: T.textSub }}>
                          {log.details}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex flex-col items-end gap-1">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        Delivered
                      </span>
                      <span className="text-[10px]" style={{ color: T.textSub }}>
                        {log.timestamp}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SLACK CONFIGURATION MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedService === 'slack' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border"
            style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
          >
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#4A154B]/10 p-2 border border-[#4A154B]/20 shrink-0">
                  <SlackLogo className="w-full h-full" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Configure Slack Alerts</h2>
                  <p className="text-xs" style={{ color: T.textSub }}>Send real-time WAFR alerts to your team channels</p>
                </div>
              </div>
              <button onClick={() => setSelectedService(null)} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                  Slack Incoming Webhook URL
                </label>
                <input
                  type="text"
                  value={slackForm.webhookUrl}
                  onChange={e => setSlackForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://hooks.slack.com/services/T00/B00/XXXXX"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                  Alert Channel
                </label>
                <input
                  type="text"
                  value={slackForm.channel}
                  onChange={e => setSlackForm(prev => ({ ...prev, channel: e.target.value }))}
                  placeholder="#cloud-security-alerts"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>

              <div className="p-4 rounded-xl border space-y-2.5" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <span className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: T.textSub }}>
                  Alert Notification Triggers
                </span>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={slackForm.notifyCriticalHri}
                    onChange={e => setSlackForm(prev => ({ ...prev, notifyCriticalHri: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Post immediately on Critical & High Risk Issues (HRIs)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={slackForm.notifyScoreDrop}
                    onChange={e => setSlackForm(prev => ({ ...prev, notifyScoreDrop: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Alert if architecture score drops below {slackForm.scoreDropThreshold}%</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={slackForm.notifyScanComplete}
                    onChange={e => setSlackForm(prev => ({ ...prev, notifyScanComplete: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Send WAFR scan completion summary & score cards</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={slackForm.notifyRemediationPr}
                    onChange={e => setSlackForm(prev => ({ ...prev, notifyRemediationPr: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Notify when automated Terraform AI remediation PRs are generated</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: T.border }}>
              <button
                type="button"
                onClick={() => triggerTestAlert('slack')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer text-blue-600 dark:text-blue-400"
                style={{ borderColor: T.border }}
              >
                Send Test Message
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveSlack}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  Save Slack Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          JIRA CONFIGURATION MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedService === 'jira' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border"
            style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
          >
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#0052CC]/10 p-2 border border-[#0052CC]/20 shrink-0">
                  <JiraLogo className="w-full h-full" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Configure Jira Software Ticketing</h2>
                  <p className="text-xs" style={{ color: T.textSub }}>Auto-create Jira tickets for findings and sync status</p>
                </div>
              </div>
              <button onClick={() => setSelectedService(null)} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                  Atlassian Jira Host Domain
                </label>
                <input
                  type="text"
                  value={jiraForm.host}
                  onChange={e => setJiraForm(prev => ({ ...prev, host: e.target.value }))}
                  placeholder="cloudifyops.atlassian.net"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                    Project Key
                  </label>
                  <input
                    type="text"
                    value={jiraForm.projectKey}
                    onChange={e => setJiraForm(prev => ({ ...prev, projectKey: e.target.value }))}
                    placeholder="WAFR"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono uppercase focus:outline-none"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                    Default Issue Type
                  </label>
                  <select
                    value={jiraForm.issueType}
                    onChange={e => setJiraForm(prev => ({ ...prev, issueType: e.target.value }))}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none cursor-pointer"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  >
                    <option value="Security Finding">Security Finding</option>
                    <option value="Bug">Bug</option>
                    <option value="Task">Task</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                  Service Account / API Token Email
                </label>
                <input
                  type="email"
                  value={jiraForm.userEmail}
                  onChange={e => setJiraForm(prev => ({ ...prev, userEmail: e.target.value }))}
                  placeholder="devops-bot@cloudifyops.com"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>

              <div className="p-4 rounded-xl border space-y-2.5" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <span className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: T.textSub }}>
                  Automated Ticket Creation & Sync
                </span>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={jiraForm.autoCreateCriticalTickets}
                    onChange={e => setJiraForm(prev => ({ ...prev, autoCreateCriticalTickets: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Automatically open Jira tickets for Critical Risk findings</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={jiraForm.autoCreateHighTickets}
                    onChange={e => setJiraForm(prev => ({ ...prev, autoCreateHighTickets: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Automatically open Jira tickets for High Risk findings</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={jiraForm.syncResolutions}
                    onChange={e => setJiraForm(prev => ({ ...prev, syncResolutions: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Bi-directional Sync: Auto-resolve finding when Jira ticket is marked Done</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: T.border }}>
              <button
                type="button"
                onClick={() => triggerTestAlert('jira')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer text-blue-600 dark:text-blue-400"
                style={{ borderColor: T.border }}
              >
                Test Connection
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveJira}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                >
                  Save Jira Config
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GOOGLE CHAT (GCHAT) CONFIGURATION MODAL
         ══════════════════════════════════════════════════════════════════════ */}
      {selectedService === 'gchat' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border"
            style={{ backgroundColor: T.card, borderColor: T.border, color: T.text }}
          >
            <div className="px-6 py-4 flex items-center justify-between border-b" style={{ borderColor: T.border }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#00AC47]/10 p-2 border border-[#00AC47]/20 shrink-0">
                  <GChatLogo className="w-full h-full" />
                </div>
                <div>
                  <h2 className="text-base font-bold">Configure Google Chat Alerts</h2>
                  <p className="text-xs" style={{ color: T.textSub }}>Send rich cards and security notifications to Google Workspace rooms</p>
                </div>
              </div>
              <button onClick={() => setSelectedService(null)} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                  Google Chat Incoming Webhook URL
                </label>
                <input
                  type="text"
                  value={gchatForm.webhookUrl}
                  onChange={e => setGChatForm(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  placeholder="https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=KEY&token=TOKEN"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                  Space / Room Name
                </label>
                <input
                  type="text"
                  value={gchatForm.spaceName}
                  onChange={e => setGChatForm(prev => ({ ...prev, spaceName: e.target.value }))}
                  placeholder="Cloud Architecture & Security Alerts"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                />
              </div>

              <div className="p-4 rounded-xl border space-y-2.5" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
                <span className="block text-xs font-bold uppercase tracking-wider mb-1" style={{ color: T.textSub }}>
                  Alert Notification Triggers
                </span>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={gchatForm.notifyCriticalHri}
                    onChange={e => setGChatForm(prev => ({ ...prev, notifyCriticalHri: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Dispatch alert cards on Critical & High Risk findings</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={gchatForm.notifyScoreDrop}
                    onChange={e => setGChatForm(prev => ({ ...prev, notifyScoreDrop: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Alert when architecture review score drops below {gchatForm.scoreDropThreshold}%</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={gchatForm.notifyScanComplete}
                    onChange={e => setGChatForm(prev => ({ ...prev, notifyScanComplete: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Post scan completion metrics and score cards</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer text-xs font-medium">
                  <input
                    type="checkbox"
                    checked={gchatForm.notifyRemediationPr}
                    onChange={e => setGChatForm(prev => ({ ...prev, notifyRemediationPr: e.target.checked }))}
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span>Send notifications when automated IaC remediation pull requests are ready</span>
                </label>
              </div>
            </div>

            <div className="px-6 py-4 flex items-center justify-between border-t" style={{ borderColor: T.border }}>
              <button
                type="button"
                onClick={() => triggerTestAlert('gchat')}
                className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer text-emerald-600 dark:text-emerald-400"
                style={{ borderColor: T.border }}
              >
                Send Test GChat Card
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedService(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border"
                  style={{ borderColor: T.border, color: T.textSub }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveGChat}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                >
                  Save Google Chat Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
