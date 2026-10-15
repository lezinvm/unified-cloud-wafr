import { useState, useEffect } from 'react';
import { useApp, Cloud, LIGHT, DARK } from '../context';
import { CloudChip } from './CloudLogo';
import { SlackLogo, GChatLogo, JiraLogo } from './IntegrationLogos';
import { ScheduledAssessment, ScheduleFrequency } from '../data/scheduleData';

const CLOUD_REGIONS: Record<Cloud, { id: string; name: string }[]> = {
  aws: [
    { id: 'us-east-1', name: 'US East (N. Virginia)' },
    { id: 'us-west-2', name: 'US West (Oregon)' },
    { id: 'eu-west-1', name: 'EU (Ireland)' },
    { id: 'ap-southeast-1', name: 'Asia Pacific (Singapore)' },
  ],
  azure: [
    { id: 'eastus', name: 'East US' },
    { id: 'westeurope', name: 'West Europe' },
    { id: 'southeastasia', name: 'Southeast Asia' },
  ],
  gcp: [
    { id: 'us-central1', name: 'Iowa (us-central1)' },
    { id: 'europe-west1', name: 'Belgium (europe-west1)' },
    { id: 'asia-east1', name: 'Taiwan (asia-east1)' },
  ],
};

const PRESET_ACCOUNTS: Record<Cloud, { id: string; name: string; num: string }[]> = {
  aws: [
    { id: 'acc-aws-01', name: 'acme-production', num: '124890123456' },
    { id: 'acc-aws-02', name: 'acme-staging', num: '987654321098' },
    { id: 'acc-aws-03', name: 'acme-dev', num: '456789012345' },
  ],
  azure: [
    { id: 'acc-az-01', name: 'AcmeCorp-ProductionSub', num: 'sub-1248-9012' },
    { id: 'acc-az-02', name: 'AcmeCorp-DataSub', num: 'sub-4891-2394' },
    { id: 'acc-az-03', name: 'AcmeCorp-CoreSub', num: 'sub-7712-9901' },
  ],
  gcp: [
    { id: 'acc-gcp-01', name: 'acme-gcp-prod', num: 'proj-gcp-9941' },
    { id: 'acc-gcp-02', name: 'acme-gcp-staging', num: 'proj-gcp-5521' },
    { id: 'acc-gcp-03', name: 'acme-gcp-dev', num: 'proj-gcp-1102' },
  ],
};

interface ScheduleAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAssessmentRerun?: boolean;
  assessmentId?: string;
  initialCloud?: Cloud;
  initialAccountId?: string;
  initialAccountName?: string;
  initialRegion?: string;
  initialName?: string;
  editingSchedule?: ScheduledAssessment | null;
  onSuccess?: (schedule: ScheduledAssessment, runNow?: boolean) => void;
}

export function ScheduleAssessmentModal({
  isOpen,
  onClose,
  isAssessmentRerun,
  assessmentId,
  initialCloud,
  initialAccountId,
  initialAccountName,
  initialRegion,
  initialName,
  editingSchedule,
  onSuccess,
}: ScheduleAssessmentModalProps) {
  const {
    theme,
    currentUser,
    currentAssessment,
    assessments,
    getConfiguredAccount,
    addScheduledAssessment,
    updateScheduledAssessment,
    runOrUpdateAssessment,
    go,
  } = useApp();

  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  // Rerun mode is ONLY when explicitly requesting a rerun for a specific assessment (e.g. from Review Finding page or an assessment item action)
  const isRerunMode = Boolean(
    isAssessmentRerun || (initialAccountId && initialName && !editingSchedule)
  );

  const [selectedTargetAssessmentId, setSelectedTargetAssessmentId] = useState<string>('custom');

  const [selectedCloud, setSelectedCloud] = useState<Cloud>(
    editingSchedule?.cloud || initialCloud || (isRerunMode ? currentAssessment?.cloud : 'aws') || 'aws'
  );
  const [assessmentName, setAssessmentName] = useState<string>(
    editingSchedule?.name || initialName || (isRerunMode ? currentAssessment?.name : 'Production Architecture Review') || 'Production Architecture Review'
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    editingSchedule?.accountId || initialAccountId || (isRerunMode ? currentAssessment?.accountId : '124890123456') || '124890123456'
  );
  const [selectedAccountName, setSelectedAccountName] = useState<string>(
    editingSchedule?.accountName || initialAccountName || (isRerunMode ? currentAssessment?.accountName : 'acme-production') || 'acme-production'
  );
  const [selectedRegion, setSelectedRegion] = useState<string>(
    editingSchedule?.region || initialRegion || (isRerunMode ? currentAssessment?.region : 'us-east-1') || 'us-east-1'
  );
  const [frequency, setFrequency] = useState<ScheduleFrequency>(
    editingSchedule?.frequency || 'weekly'
  );
  const [time, setTime] = useState<string>(editingSchedule?.time || '02:00 UTC');
  const [dayOfWeek, setDayOfWeek] = useState<string>(editingSchedule?.dayOfWeek || 'Monday');
  const [dayOfMonth, setDayOfMonth] = useState<number>(editingSchedule?.dayOfMonth || 1);
  const [cronExpression, setCronExpression] = useState<string>(
    editingSchedule?.cronExpression || '0 2 * * 1'
  );
  const [timezone, setTimezone] = useState<string>(editingSchedule?.timezone || 'UTC');
  const [notifySlack, setNotifySlack] = useState<boolean>(
    editingSchedule ? editingSchedule.notifySlack : true
  );
  const [slackWebhook, setSlackWebhook] = useState<string>(
    editingSchedule?.slackWebhook || 'https://hooks.slack.com/services/T00/B00/XXXXX'
  );
  const [notifyGChat, setNotifyGChat] = useState<boolean>(
    editingSchedule ? editingSchedule.notifyGChat : false
  );
  const [gchatWebhook, setGChatWebhook] = useState<string>(
    editingSchedule?.gchatWebhook || 'https://chat.googleapis.com/v1/spaces/AAAA1234/messages'
  );
  const [notifyJira, setNotifyJira] = useState<boolean>(
    editingSchedule ? editingSchedule.notifyJira : true
  );
  const [autoCreateMilestone, setAutoCreateMilestone] = useState<boolean>(
    editingSchedule ? editingSchedule.autoCreateMilestone : true
  );

  // Sync state if initial props change
  useEffect(() => {
    if (editingSchedule) {
      setSelectedCloud(editingSchedule.cloud);
      setAssessmentName(editingSchedule.name);
      setSelectedAccountId(editingSchedule.accountId);
      setSelectedAccountName(editingSchedule.accountName);
      setSelectedRegion(editingSchedule.region);
      setFrequency(editingSchedule.frequency);
      setTime(editingSchedule.time);
      setDayOfWeek(editingSchedule.dayOfWeek || 'Monday');
      setDayOfMonth(editingSchedule.dayOfMonth || 1);
      setCronExpression(editingSchedule.cronExpression || '0 2 * * 1');
      setTimezone(editingSchedule.timezone || 'UTC');
      setNotifySlack(editingSchedule.notifySlack);
      setSlackWebhook(editingSchedule.slackWebhook || '');
      setNotifyGChat(editingSchedule.notifyGChat);
      setGChatWebhook(editingSchedule.gchatWebhook || '');
      setNotifyJira(editingSchedule.notifyJira);
      setAutoCreateMilestone(editingSchedule.autoCreateMilestone);
      setSelectedTargetAssessmentId('custom');
    } else if (isRerunMode) {
      const c = initialCloud || currentAssessment?.cloud || 'aws';
      setSelectedCloud(c);
      setSelectedAccountId(initialAccountId || currentAssessment?.accountId || '124890123456');
      setSelectedAccountName(initialAccountName || currentAssessment?.accountName || 'Production Account');
      setSelectedRegion(initialRegion || currentAssessment?.region || CLOUD_REGIONS[c][0].id);
      setAssessmentName(initialName || currentAssessment?.name || 'Production Architecture Review');
      setSelectedTargetAssessmentId(assessmentId || currentAssessment?.id || 'custom');
    } else {
      setSelectedTargetAssessmentId('custom');
      const c = initialCloud || 'aws';
      setSelectedCloud(c);
      const conf = getConfiguredAccount(c);
      if (initialAccountId) {
        setSelectedAccountId(initialAccountId);
        setSelectedAccountName(initialAccountName || 'Production Account');
      } else if (conf) {
        setSelectedAccountId(conf.id);
        setSelectedAccountName(conf.name);
      } else {
        const first = PRESET_ACCOUNTS[c][0];
        setSelectedAccountId(first.num);
        setSelectedAccountName(first.name);
      }
      setSelectedRegion(initialRegion || CLOUD_REGIONS[c][0].id);
      setAssessmentName(
        initialName || `${c.toUpperCase()} Production — Recurring Architecture Review`
      );
    }
  }, [editingSchedule, isOpen, initialCloud, initialAccountId, initialRegion, initialName, currentAssessment, isRerunMode, assessmentId]);

  // Handle target assessment selection in global mode
  const handleTargetAssessmentSelect = (targetId: string) => {
    setSelectedTargetAssessmentId(targetId);
    if (targetId === 'custom') {
      const c = selectedCloud || 'aws';
      const conf = getConfiguredAccount(c);
      if (conf) {
        setSelectedAccountId(conf.id);
        setSelectedAccountName(conf.name);
      } else {
        const first = PRESET_ACCOUNTS[c][0];
        setSelectedAccountId(first.num);
        setSelectedAccountName(first.name);
      }
      setAssessmentName(`${c.toUpperCase()} Production — Recurring WAFR Assessment`);
    } else {
      const target = assessments.find(a => a.id === targetId);
      if (target) {
        setSelectedCloud(target.cloud);
        setSelectedAccountId(target.accountId);
        setSelectedAccountName(target.accountName);
        setSelectedRegion(target.region);
        setAssessmentName(target.name);
      }
    }
  };

  // Handle cloud change
  const handleCloudChange = (c: Cloud) => {
    setSelectedCloud(c);
    const conf = getConfiguredAccount(c);
    if (conf) {
      setSelectedAccountId(conf.id);
      setSelectedAccountName(conf.name);
    } else {
      const first = PRESET_ACCOUNTS[c][0];
      setSelectedAccountId(first.num);
      setSelectedAccountName(first.name);
    }
    const reg = CLOUD_REGIONS[c][0].id;
    setSelectedRegion(reg);
    if (!editingSchedule) {
      setAssessmentName(`${c.toUpperCase()} Production — Recurring WAFR Assessment`);
    }
  };

  if (!isOpen) return null;

  // Build list of selectable accounts
  const confAcc = getConfiguredAccount(selectedCloud);
  const rawAccounts = PRESET_ACCOUNTS[selectedCloud] || [];
  const accountsList = confAcc
    ? [{ id: 'acc-configured', name: `${confAcc.name} (Active Account)`, num: confAcc.id }, ...rawAccounts]
    : rawAccounts;

  const calculateNextRun = () => {
    if (frequency === 'daily') return `Tomorrow at ${time}`;
    if (frequency === 'weekly') return `Next ${dayOfWeek} at ${time}`;
    if (frequency === 'biweekly') return `In 2 weeks on ${dayOfWeek} at ${time}`;
    if (frequency === 'monthly') return `Day ${dayOfMonth} of next month at ${time}`;
    return `Scheduled via cron: ${cronExpression}`;
  };

  const handleSave = (runNow = false) => {
    const scheduleData = {
      name: assessmentName.trim() || `${selectedCloud.toUpperCase()} Scheduled Assessment`,
      cloud: selectedCloud,
      accountId: selectedAccountId,
      accountName: selectedAccountName,
      region: selectedRegion,
      frequency,
      time,
      dayOfWeek: frequency === 'weekly' || frequency === 'biweekly' ? dayOfWeek : undefined,
      dayOfMonth: frequency === 'monthly' ? dayOfMonth : undefined,
      cronExpression: frequency === 'custom' ? cronExpression : undefined,
      timezone,
      nextRun: calculateNextRun(),
      notifySlack,
      slackWebhook: notifySlack ? slackWebhook : undefined,
      notifyGChat,
      gchatWebhook: notifyGChat ? gchatWebhook : undefined,
      notifyJira,
      autoCreateMilestone,
    };

    let resultSchedule: ScheduledAssessment;

    if (editingSchedule) {
      updateScheduledAssessment(editingSchedule.id, scheduleData);
      resultSchedule = { ...editingSchedule, ...scheduleData };
    } else {
      resultSchedule = addScheduledAssessment(scheduleData);
    }

    if (runNow) {
      runOrUpdateAssessment({
        cloud: selectedCloud,
        accountId: selectedAccountId,
        accountName: selectedAccountName,
        region: selectedRegion,
        name: assessmentName,
      });
      onClose();
      if (onSuccess) onSuccess(resultSchedule, true);
      go('live-scan');
    } else {
      onClose();
      if (onSuccess) onSuccess(resultSchedule, false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border"
        style={{
          backgroundColor: T.card,
          borderColor: T.border,
          color: T.text,
        }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400"
              style={{ backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <polyline points="12 14 12 17 15 17"/>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: T.text }}>
                {editingSchedule
                  ? 'Edit Scheduled Assessment'
                  : isRerunMode
                  ? 'Schedule Automated Rerun'
                  : 'Schedule Recurring Assessment'}
              </h2>
              <p className="text-xs" style={{ color: T.textSub }}>
                {isRerunMode
                  ? `Automate periodic re-scans for this assessment to track remediation progress and score trends.`
                  : 'Automate continuous Well-Architected Framework reviews and compliance tracking.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer"
            style={{ color: T.textSub }}
            onMouseEnter={e => { e.currentTarget.style.backgroundColor = T.border; }}
            onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            ✕
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 space-y-5 text-sm">
          {/* Assessment Context Card (for Rerun Mode) vs Cloud/Account Selector (for Global Mode) */}
          {isRerunMode ? (
            <div
              className="p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{
                borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
                backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : '#EFF6FF',
              }}
            >
              <div className="flex items-center gap-3">
                <CloudChip id={selectedCloud} size="md" isDark={isDark} />
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm" style={{ color: T.text }}>{assessmentName}</span>
                    <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      ID: {assessmentId || currentAssessment?.id || 'A-001'}
                    </span>
                    {currentAssessment?.rerunCount && currentAssessment.rerunCount > 1 && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                        Rerun #{currentAssessment.rerunCount}
                      </span>
                    )}
                  </div>
                  <div className="text-xs mt-1" style={{ color: T.textSub }}>
                    Target Account: <strong className="font-medium" style={{ color: T.text }}>{selectedAccountName}</strong> ({selectedAccountId}) · Region: <span className="font-mono">{selectedRegion}</span>
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Rerun Target Locked
                </span>
              </div>
            </div>
          ) : (
            <>
              {/* Select Existing Assessment to Schedule (Rerun Target) */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textSub }}>
                  1. Target Assessment to Schedule
                </label>
                <select
                  value={selectedTargetAssessmentId}
                  onChange={e => handleTargetAssessmentSelect(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-sm font-medium focus:outline-none cursor-pointer shadow-xs transition-colors"
                  style={{
                    backgroundColor: isDark ? 'rgba(37,99,235,0.08)' : '#EFF6FF',
                    borderColor: isDark ? 'rgba(59,130,246,0.35)' : '#93C5FD',
                    color: T.text,
                  }}
                >
                  <option value="custom">-- Select Target Assessment --</option>
                  {assessments.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.cloud.toUpperCase()} · {a.accountName} · ID: {a.id})
                    </option>
                  ))}
                  <option value="custom">+ Custom / New Account Schedule</option>
                </select>
                <p className="text-[11px] mt-1.5" style={{ color: T.muted }}>
                  {selectedTargetAssessmentId !== 'custom'
                    ? 'Selected existing assessment target for automated periodic re-scans.'
                    : 'Select an existing assessment from the list above, or configure custom cloud account parameters.'}
                </p>
              </div>

              {/* Cloud Provider Select */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: T.textSub }}>
                  2. Cloud Provider
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['aws', 'azure', 'gcp'] as Cloud[]).map(c => {
                    const isSelected = selectedCloud === c;
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => handleCloudChange(c)}
                        className="flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer text-left"
                        style={{
                          backgroundColor: isSelected ? (isDark ? 'rgba(37,99,235,0.15)' : '#EFF6FF') : (isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF'),
                          borderColor: isSelected ? '#2563EB' : T.border,
                          boxShadow: isSelected ? '0 0 0 1px #2563EB' : 'none',
                        }}
                      >
                        <CloudChip id={c} size="sm" isDark={isDark} />
                        <span className="font-semibold text-xs" style={{ color: isSelected ? '#2563EB' : T.text }}>
                          {c.toUpperCase()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Assessment Name & Account Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: T.textSub }}>
                    Schedule Name
                  </label>
                  <input
                    type="text"
                    value={assessmentName}
                    onChange={e => setAssessmentName(e.target.value)}
                    placeholder="e.g. Weekly Production AWS Scan"
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none transition-colors"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderColor: T.border,
                      color: T.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: T.textSub }}>
                    Target Account / Subscription
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={e => {
                      const accId = e.target.value;
                      setSelectedAccountId(accId);
                      const found = accountsList.find(a => a.num === accId || a.id === accId);
                      if (found) setSelectedAccountName(found.name.replace(' (Active Account)', ''));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderColor: T.border,
                      color: T.text,
                    }}
                  >
                    {accountsList.map(acc => (
                      <option key={acc.num} value={acc.num}>
                        {acc.name} ({acc.num})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1.5" style={{ color: T.textSub }}>
                    Target Region
                  </label>
                  <select
                    value={selectedRegion}
                    onChange={e => setSelectedRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none cursor-pointer"
                    style={{
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderColor: T.border,
                      color: T.text,
                    }}
                  >
                    {CLOUD_REGIONS[selectedCloud].map(r => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Recurrence Frequency & Timing */}
          <div className="p-4 rounded-xl border" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: T.textSub }}>
              2. Recurrence Frequency & Time
            </label>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
              {[
                { id: 'daily', label: 'Daily' },
                { id: 'weekly', label: 'Weekly' },
                { id: 'biweekly', label: 'Bi-Weekly' },
                { id: 'monthly', label: 'Monthly' },
              ].map(f => {
                const active = frequency === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id as ScheduleFrequency)}
                    className="py-2 px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer text-center"
                    style={{
                      backgroundColor: active ? '#2563EB' : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                      borderColor: active ? '#2563EB' : T.border,
                      color: active ? '#FFFFFF' : T.text,
                    }}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Day Selection for Weekly / Monthly */}
              {(frequency === 'weekly' || frequency === 'biweekly') && (
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: T.textSub }}>
                    Day of Week
                  </label>
                  <select
                    value={dayOfWeek}
                    onChange={e => setDayOfWeek(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none cursor-pointer"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  >
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
              )}

              {frequency === 'monthly' && (
                <div>
                  <label className="block text-[11px] font-medium mb-1" style={{ color: T.textSub }}>
                    Day of Month
                  </label>
                  <select
                    value={dayOfMonth}
                    onChange={e => setDayOfMonth(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none cursor-pointer"
                    style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                  >
                    {[1, 5, 10, 15, 20, 25, 28].map(d => (
                      <option key={d} value={d}>Day {d} of month</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: T.textSub }}>
                  Execution Time
                </label>
                <select
                  value={time}
                  onChange={e => setTime(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none cursor-pointer"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                >
                  <option value="00:00 UTC">12:00 AM (00:00 UTC)</option>
                  <option value="02:00 UTC">02:00 AM UTC (Off-peak)</option>
                  <option value="04:00 UTC">04:00 AM UTC</option>
                  <option value="08:00 UTC">08:00 AM UTC</option>
                  <option value="12:00 UTC">12:00 PM UTC</option>
                  <option value="18:00 UTC">06:00 PM UTC</option>
                </select>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-[11px] font-medium mb-1" style={{ color: T.textSub }}>
                  Timezone
                </label>
                <select
                  value={timezone}
                  onChange={e => setTimezone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-xs focus:outline-none cursor-pointer"
                  style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF', borderColor: T.border, color: T.text }}
                >
                  <option value="UTC">UTC (Coordinated Universal Time)</option>
                  <option value="EST">EST (US Eastern)</option>
                  <option value="PST">PST (US Pacific)</option>
                  <option value="IST">IST (India Standard Time)</option>
                  <option value="BST">BST (British Summer Time)</option>
                </select>
              </div>
            </div>

            {/* Next Run Summary Pill */}
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg text-xs bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-medium">
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Next execution will trigger: <strong>{calculateNextRun()}</strong></span>
            </div>
          </div>

          {/* Notifications & Automations */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-2.5" style={{ color: T.textSub }}>
              3. Notifications & Automation
            </label>

            <div className="space-y-3">
              {/* Slack Notifications */}
              <div className="p-3.5 rounded-xl border" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="notifySlackCheck"
                      checked={notifySlack}
                      onChange={e => setNotifySlack(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <SlackLogo className="w-full h-full" />
                    </div>
                    <label htmlFor="notifySlackCheck" className="text-xs font-semibold cursor-pointer" style={{ color: T.text }}>
                      Post Alert to Slack Channel (Webhook)
                    </label>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Slack Alerts
                  </span>
                </div>

                {notifySlack && (
                  <div className="mt-2.5 pl-6.5">
                    <input
                      type="text"
                      value={slackWebhook}
                      onChange={e => setSlackWebhook(e.target.value)}
                      placeholder="https://hooks.slack.com/services/..."
                      className="w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none font-mono"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: T.border, color: T.text }}
                    />
                  </div>
                )}
              </div>

              {/* Google Chat (GChat) Notifications */}
              <div className="p-3.5 rounded-xl border" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="notifyGChatCheck"
                      checked={notifyGChat}
                      onChange={e => setNotifyGChat(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <GChatLogo className="w-full h-full" />
                    </div>
                    <label htmlFor="notifyGChatCheck" className="text-xs font-semibold cursor-pointer" style={{ color: T.text }}>
                      Post Alert to Google Chat Space (Webhook)
                    </label>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold">
                    GChat Alerts
                  </span>
                </div>

                {notifyGChat && (
                  <div className="mt-2.5 pl-6.5">
                    <input
                      type="text"
                      value={gchatWebhook}
                      onChange={e => setGChatWebhook(e.target.value)}
                      placeholder="https://chat.googleapis.com/v1/spaces/..."
                      className="w-full px-3 py-1.5 rounded-lg border text-xs focus:outline-none font-mono"
                      style={{ backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC', borderColor: T.border, color: T.text }}
                    />
                  </div>
                )}
              </div>

              {/* Jira Software Automation */}
              <div className="p-3.5 rounded-xl border" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      id="notifyJiraCheck"
                      checked={notifyJira}
                      onChange={e => setNotifyJira(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                    />
                    <div className="w-4 h-4 flex items-center justify-center shrink-0">
                      <JiraLogo className="w-full h-full" />
                    </div>
                    <label htmlFor="notifyJiraCheck" className="text-xs font-semibold cursor-pointer" style={{ color: T.text }}>
                      Auto-create Jira Tickets for High & Critical Risk Findings
                    </label>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold">
                    Jira Ticketing
                  </span>
                </div>
              </div>

              {/* Auto Create Milestone */}
              <div className="flex items-center gap-2.5 p-3 rounded-xl border" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF' }}>
                <input
                  type="checkbox"
                  id="autoMilestoneCheck"
                  checked={autoCreateMilestone}
                  onChange={e => setAutoCreateMilestone(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 cursor-pointer"
                />
                <label htmlFor="autoMilestoneCheck" className="text-xs font-medium cursor-pointer" style={{ color: T.text }}>
                  Automatically record milestone snapshot for audit trails & historical trend graphs
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div
          className="px-6 py-4 flex items-center justify-between border-t shrink-0"
          style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
            style={{ borderColor: T.border, color: T.textSub }}
          >
            Cancel
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => handleSave(false)}
              className="px-5 py-2.5 rounded-xl text-xs font-semibold border transition-all cursor-pointer shadow-xs hover:border-blue-500"
              style={{
                borderColor: T.border,
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                color: T.text,
              }}
            >
              {editingSchedule ? 'Save Changes' : 'Save Schedule'}
            </button>

            <button
              type="button"
              onClick={() => handleSave(true)}
              className="px-6 py-2.5 rounded-xl text-xs font-bold text-white shadow-md transition-all cursor-pointer hover:opacity-95 active:scale-98"
              style={{ background: 'linear-gradient(135deg, #2563EB, #22C55E)' }}
            >
              Save & Run First Scan Now →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
