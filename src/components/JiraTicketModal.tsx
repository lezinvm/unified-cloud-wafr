import { useState } from 'react';
import { useApp, LIGHT, DARK } from '../context';
import { LinkedJiraTicket } from '../data/integrationData';
import { JiraLogo } from './IntegrationLogos';

interface JiraTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  checkId: string;
  checkTitle: string;
  severity?: string;
  checkDescription?: string;
  existingTicket?: LinkedJiraTicket;
}

export function JiraTicketModal({
  isOpen,
  onClose,
  checkId,
  checkTitle,
  severity = 'high',
  checkDescription,
  existingTicket,
}: JiraTicketModalProps) {
  const {
    theme,
    integrations,
    createJiraTicketForCheck,
    updateJiraTicketStatus,
  } = useApp();

  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;

  const [summary, setSummary] = useState(
    existingTicket?.summary || checkTitle
  );
  const [description, setDescription] = useState(
    existingTicket?.description ||
      checkDescription ||
      `Finding: ${checkTitle}\nSeverity: ${severity.toUpperCase()}\n\nRemediation required to meet Well-Architected Framework compliance standards.`
  );
  const [projectKey, setProjectKey] = useState(
    existingTicket?.projectKey || integrations.jira.projectKey || 'WAFR'
  );
  const [priority, setPriority] = useState<LinkedJiraTicket['priority']>(
    existingTicket?.priority ||
      (severity.toLowerCase() === 'critical'
        ? 'Highest'
        : severity.toLowerCase() === 'high'
        ? 'High'
        : 'Medium')
  );
  const [status, setStatus] = useState<LinkedJiraTicket['status']>(
    existingTicket?.status || 'To Do'
  );
  const [assignee, setAssignee] = useState(
    existingTicket?.assignee || integrations.jira.defaultAssignee || 'Lezin VM (Lead Architect)'
  );

  if (!isOpen) return null;

  const handleSave = () => {
    if (existingTicket) {
      updateJiraTicketStatus(checkId, status);
    } else {
      createJiraTicketForCheck(checkId, summary, priority === 'Highest' ? 'critical' : priority === 'High' ? 'high' : 'medium', description);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl flex flex-col border"
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
            <div className="w-10 h-10 rounded-xl bg-[#0052CC]/10 p-2 flex items-center justify-center border border-[#0052CC]/20 shrink-0">
              <JiraLogo className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold" style={{ color: T.text }}>
                  {existingTicket ? `Jira Issue: ${existingTicket.key}` : 'Create Linked Jira Ticket'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20 font-bold">
                  {projectKey}
                </span>
              </div>
              <p className="text-xs" style={{ color: T.textSub }}>
                Atlassian Host: <span className="font-mono text-blue-500">{integrations.jira.host || 'cloudifyops.atlassian.net'}</span>
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

        {/* Body */}
        <div className="p-6 space-y-4 text-sm">
          {/* Finding Reference banner */}
          <div className="p-3 rounded-xl border flex items-center justify-between gap-3 text-xs" style={{ borderColor: T.border, backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : '#F8FAFC' }}>
            <div className="flex items-center gap-2 truncate">
              <span className="font-bold text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400">
                {checkId}
              </span>
              <span className="font-medium truncate" style={{ color: T.text }}>
                {checkTitle}
              </span>
            </div>
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                severity.toLowerCase() === 'critical'
                  ? 'bg-rose-500/15 text-rose-500'
                  : severity.toLowerCase() === 'high'
                  ? 'bg-amber-500/15 text-amber-500'
                  : 'bg-blue-500/15 text-blue-500'
              }`}
            >
              {severity}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Issue Summary
            </label>
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: T.border,
                color: T.text,
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                Priority
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  borderColor: T.border,
                  color: T.text,
                }}
              >
                <option value="Highest">Highest (Critical P1)</option>
                <option value="High">High (P2)</option>
                <option value="Medium">Medium (P3)</option>
                <option value="Low">Low (P4)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                Workflow Status
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none cursor-pointer"
                style={{
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  borderColor: T.border,
                  color: T.text,
                }}
              >
                <option value="To Do">To Do</option>
                <option value="In Progress">In Progress</option>
                <option value="In Review">In Review</option>
                <option value="Done">Done (Resolved)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Assignee
            </label>
            <input
              type="text"
              value={assignee}
              onChange={e => setAssignee(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border text-xs focus:outline-none"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: T.border,
                color: T.text,
              }}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
              Issue Description & Remediation Steps
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-none leading-relaxed"
              style={{
                backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: T.border,
                color: T.text,
              }}
            />
          </div>

          {/* Sync resolution notice */}
          <div className="p-3 rounded-xl flex items-center gap-2.5 text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span>
              <strong>Bi-Directional Sync Active:</strong> Resolving this finding in WAFR AI-Remediation will automatically transition this Jira ticket to <strong>Done</strong>.
            </span>
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
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
            style={{ backgroundColor: '#0052CC' }}
          >
            {existingTicket ? 'Update Jira Ticket' : 'Create & Sync Jira Ticket'}
          </button>
        </div>
      </div>
    </div>
  );
}
