import { useState } from 'react';
import { useApp, LIGHT, DARK } from '../context';
import { SlackLogo } from './IntegrationLogos';

interface SlackAlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultMessage?: string;
  initialTitle?: string;
  initialMessage?: string;
  initialSeverity?: 'critical' | 'high' | 'info' | string;
  severity?: 'critical' | 'high' | 'info';
  checkId?: string;
}

export function SlackAlertModal({
  isOpen,
  onClose,
  defaultTitle = 'WAFR Architecture Alert',
  defaultMessage = '',
  initialTitle,
  initialMessage,
  initialSeverity,
  severity = 'high',
  checkId,
}: SlackAlertModalProps) {
  const {
    theme,
    integrations,
    sendSlackNotification,
    currentAssessment,
  } = useApp();

  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [channel, setChannel] = useState(
    integrations.slack.channel || '#cloud-security-alerts'
  );
  const effectiveTitle = initialTitle || defaultTitle;
  const effectiveMsg = initialMessage || defaultMessage || `WAFR review detected high-risk architecture deviations for ${currentAssessment?.name || 'Production Cloud Account'}. Team action required.`;
  const effectiveSev = (initialSeverity as 'critical' | 'high' | 'info') || severity;

  const [title, setTitle] = useState(effectiveTitle);
  const [message, setMessage] = useState(effectiveMsg);
  const [selectedSeverity, setSelectedSeverity] = useState<'critical' | 'high' | 'info'>(effectiveSev);

  if (!isOpen) return null;

  const handleSend = () => {
    sendSlackNotification({
      title,
      message,
      channel,
      severity: selectedSeverity,
      checkId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border"
        style={{
          backgroundColor: T.card,
          borderColor: T.border,
          color: T.text,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 flex items-center justify-between border-b shrink-0"
          style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#4A154B]/10 p-2 flex items-center justify-center border border-[#4A154B]/20 shrink-0">
              <SlackLogo className="w-full h-full" />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: T.text }}>
                Send Alert to Slack
              </h2>
              <p className="text-xs" style={{ color: T.textSub }}>
                Broadcast real-time finding or score summary to your Slack workspace.
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

        {/* Form Body */}
        <div className="p-6 space-y-4 text-sm">
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Destination Channel
            </label>
            <input
              type="text"
              value={channel}
              onChange={e => setChannel(e.target.value)}
              placeholder="#cloud-security-alerts"
              className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none font-mono"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: T.border,
                color: T.text,
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Alert Severity
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'critical', label: 'Critical', color: '#E11D48' },
                { id: 'high', label: 'High', color: '#D97706' },
                { id: 'info', label: 'Info / Summary', color: '#2563EB' },
              ].map(s => {
                const active = selectedSeverity === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedSeverity(s.id as any)}
                    className="py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center"
                    style={{
                      borderColor: active ? s.color : T.border,
                      backgroundColor: active ? (isDark ? `${s.color}20` : `${s.color}15`) : (isDark ? 'rgba(255,255,255,0.02)' : '#FFFFFF'),
                      color: active ? s.color : T.textSub,
                    }}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Alert Title
            </label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none font-semibold"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: T.border,
                color: T.text,
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Message & Context
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-none leading-relaxed"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: T.border,
                color: T.text,
              }}
            />
          </div>

          {/* Preview Box */}
          <div className="p-3.5 rounded-xl border flex flex-col gap-1.5" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
            <div className="flex items-center gap-2 text-[11px] text-slate-400">
              <span className="font-bold text-[#ECB22E]">Slack Message Preview</span> · <span>Incoming Webhook</span>
            </div>
            <div className="text-xs font-bold flex items-center gap-1.5" style={{ color: T.text }}>
              <span
                className={`w-2 h-2 rounded-full ${
                  selectedSeverity === 'critical'
                    ? 'bg-rose-500'
                    : selectedSeverity === 'high'
                    ? 'bg-amber-500'
                    : 'bg-blue-500'
                }`}
              />
              <span>{title}</span>
            </div>
            <div className="text-[11px]" style={{ color: T.textSub }}>
              {message}
            </div>
          </div>
        </div>

        {/* Footer */}
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

          <button
            type="button"
            onClick={handleSend}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
            style={{ backgroundColor: '#4A154B' }}
          >
            Dispatch to Slack
          </button>
        </div>
      </div>
    </div>
  );
}
