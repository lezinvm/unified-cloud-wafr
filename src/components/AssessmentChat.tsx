import { useState, useRef, useEffect } from 'react';
import { useApp } from '../context';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time?: string;
  action?: {
    label: string;
    target: 'remediation' | 'milestones' | 'report' | 'dashboard';
  };
}

const SCREEN_SUGGESTIONS: Record<string, string[]> = {
  dashboard: [
    'Summarize my multi-cloud posture',
    'Which cloud provider has the most High Risk Issues?',
    'What are my top remediation priorities today?',
    'How do I launch a new WAFR assessment scan?',
  ],
  'assessment-list': [
    'Compare scores across my production accounts',
    'Which assessment needs urgent attention?',
    'How do I add a new cloud target account?',
    'Summarize critical findings across all scans',
  ],
  report: [
    'Summarize critical findings in this review',
    'Which WAFR pillar scored lowest?',
    'What changed since last milestone scan?',
    'Show high-risk items in the Security pillar',
  ],
  'pillar-detail': [
    'Explain best practices for this pillar',
    'How do I resolve failed checks in this pillar?',
    'Generate Terraform remediation for high risk findings',
    'What is the estimated impact on pillar score?',
  ],
  remediation: [
    'How does autonomous AI remediation work?',
    'Explain Terraform fix for S3 SSE-KMS encryption',
    'What is the estimated cost savings of these fixes?',
    'How do I export PRs directly to GitHub repo?',
  ],
  'ai-fix': [
    'Explain this Terraform code diff',
    'Verify security compliance for this fix',
    'What resources will be modified by this PR?',
    'Generate alternative CLI script instead of Terraform',
  ],
  milestones: [
    'What are the key roadmap goals for Milestone 2?',
    'Compare Milestone 1 score vs current state',
    'How to achieve SOC 2 / HIPAA compliance milestone?',
    'What is the projected risk reduction across milestones?',
  ],
};

const DEFAULT_SUGGESTIONS = [
  'Summarize critical findings',
  'Which pillar scored lowest?',
  'Show top remediation priorities',
  'How do I fix open security groups?',
];

function getDynamicResponse(query: string, screen: string, currentAssessment: any): { content: string; action?: { label: string; target: any } } {
  const q = query.toLowerCase();

  if (q.includes('multi-cloud') || q.includes('posture') || q.includes('overall')) {
    return {
      content: `Your overall multi-cloud Well-Architected score is currently **84%** across 24 cloud accounts (AWS: 86%, Azure: 81%, GCP: 79%). You have 4 High Risk Issues (HRIs) in Security and Reliability requiring attention.`,
      action: { label: 'View Assessment Report', target: 'report' },
    };
  }

  if (q.includes('critical') || q.includes('high risk') || q.includes('hri') || q.includes('security')) {
    return {
      content: `You have **3 High Risk Issues (HRIs)** identified in ${currentAssessment?.name || 'Production Full Review'}:\n\n1. **SEC-047 (Security)**: IAM Wildcard permissions on Lambda execution role (*acme-lambda-exec*)\n2. **SEC-061 (Security)**: Security Group allows inbound SSH (0.0.0.0/0 on Port 22)\n3. **REL-019 (Reliability)**: Production ALB missing active health check target group\n\nResolving these 3 items will elevate your overall score from **${currentAssessment?.score || 84}% → 91%**.`,
      action: { label: 'Go to AI Remediation', target: 'remediation' },
    };
  }

  if (q.includes('lowest') || q.includes('pillar scored')) {
    return {
      content: `The lowest scoring pillar in **${currentAssessment?.name || 'Production Full Review'}** is **Security (79%)**, followed by **Performance (80%)** and **Operations (82%)**.\n\nKey drivers for Security:\n• Unrestricted egress policies in default VPC\n• Missing KMS customer-managed key rotation\n• Unenforced MFA on privileged service accounts.`,
      action: { label: 'Inspect Pillar Details', target: 'report' },
    };
  }

  if (q.includes('remediation') || q.includes('fix') || q.includes('terraform') || q.includes('pr')) {
    return {
      content: `LENS AI Remediation has analyzed your architecture and generated automated Terraform code fixes for **4 issues**:\n\n\`\`\`hcl\n# Example Fix for SEC-061: Restrict SSH to bastion CIDR\nresource "aws_security_group_rule" "ssh_restricted" {\n  type              = "ingress"\n  from_port         = 22\n  to_port           = 22\n  protocol          = "tcp"\n  cidr_blocks       = ["10.0.0.0/16"] # Restricted to VPC\n  security_group_id = aws_security_group.app_sg.id\n}\n\`\`\`\n\nYou can review diffs, test dry-runs, and push directly to GitHub in one click.`,
      action: { label: 'Open Remediation Hub', target: 'remediation' },
    };
  }

  if (q.includes('milestone') || q.includes('roadmap') || q.includes('compliance')) {
    return {
      content: `**Milestone Tracking Status**:\n\n• **Milestone 1 (Initial Review)**: Score 84% · Recorded Sep 01, 2024 (Baseline)\n• **Milestone 2 (Security Hardening)**: Target 92% · 5 HRIs scheduled for AI auto-fix\n• **Milestone 3 (Audit Readiness)**: Target 96% · SOC 2 / ISO 27001 compliance verification\n\nProgressing to Milestone 2 will eliminate all critical security vulnerabilities.`,
      action: { label: 'View Milestones Roadmap', target: 'milestones' },
    };
  }

  if (q.includes('cost') || q.includes('savings') || q.includes('spend')) {
    return {
      content: `**Cost Optimization Analysis**:\n\n• Identified 3 unattached EBS gp2 volumes totaling 1.2 TB ($144/mo savings)\n• Identified 2 oversized EC2 m5.4xlarge instances with <8% CPU utilization ($380/mo savings)\n• Total potential monthly savings: **$524.00 / month** ($6,288 / year).`,
      action: { label: 'Review Cost Findings', target: 'remediation' },
    };
  }

  return {
    content: `I have analyzed your **${currentAssessment?.cloud?.toUpperCase() || 'AWS'}** environment for **${currentAssessment?.name || 'Production Full Review'}**. I can help you evaluate WAFR pillars, generate Terraform code fixes, optimize cloud costs, or track milestone compliance.`,
    action: { label: 'Explore Remediation', target: 'remediation' },
  };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function AssessmentChat({ isOpen, onClose }: Props) {
  const { screen, theme, currentAssessment, go } = useApp();
  const isDark = theme === 'dark';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const border = isDark ? '#1E293B' : '#E2E8F0';
  const bg = isDark ? '#0e1626' : '#FFFFFF';
  const surface = isDark ? '#162032' : '#F8FAFC';
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const sub = isDark ? '#94A3B8' : '#64748B';
  const aBubble = isDark ? '#182438' : '#F1F5F9';

  const currentSuggestions = SCREEN_SUGGESTIONS[screen] || DEFAULT_SUGGESTIONS;

  const send = (content: string) => {
    if (!content.trim() || thinking) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-u`,
      role: 'user',
      content: content.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setThinking(true);

    setTimeout(() => {
      const response = getDynamicResponse(content, screen, currentAssessment);
      const botMsg: ChatMessage = {
        id: `msg-${Date.now()}-a`,
        role: 'assistant',
        content: response.content,
        action: response.action,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, botMsg]);
      setThinking(false);
    }, 850);
  };

  useEffect(() => {
    if (isOpen) {
      threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, thinking, isOpen]);

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          backgroundColor: 'rgba(0,0,0,.4)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
      />

      {/* Slide-out Chat Panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 flex flex-col transition-transform duration-300 shadow-2xl"
        style={{
          width: '420px',
          maxWidth: '100vw',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          backgroundColor: bg,
          borderLeft: `1px solid ${border}`,
        }}
      >
        {/* Header */}
        <div
          className="shrink-0 px-5 py-3.5 flex items-center justify-between border-b"
          style={{ borderColor: border, backgroundColor: isDark ? '#111A2E' : '#F8FAFC' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white shadow-md"
              style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)' }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">LENS AI Copilot</span>
                <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Online
                </span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <span>{currentAssessment?.name || 'Multi-Cloud Assessment'}</span>
                <span>·</span>
                <span className="font-semibold text-emerald-400">{currentAssessment?.score || 84}% Score</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
            title="Close Chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Thread Messages */}
        <div ref={threadRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3.5">
          {messages.length === 0 && !thinking && (
            <div className="flex flex-col gap-3 my-auto">
              <div className="text-center py-4 px-2">
                <div
                  className="w-12 h-12 rounded-2xl mx-auto mb-3 flex items-center justify-center text-white shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)' }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <circle cx="12" cy="12" r="6" stroke="#10b981" />
                    <circle cx="12" cy="12" r="2" fill="#38bdf8" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-white">How can I assist your cloud review?</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto leading-relaxed">
                  Ask questions about WAFR 5 Pillars, High-Risk Issues, Terraform code fixes, or milestones.
                </p>
              </div>

              {/* Quick suggestions based on screen context */}
              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 px-1">
                  Suggested for this page
                </span>
                {currentSuggestions.map((s, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => send(s)}
                    className="text-left px-3.5 py-2.5 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer"
                    style={{
                      backgroundColor: surface,
                      border: `1px solid ${border}`,
                      color: isDark ? '#CBD5E1' : '#334155',
                    }}
                  >
                    <span>{s}</span>
                    <span className="text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all text-sm font-bold">
                      →
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div
                className={`max-w-[90%] p-3.5 text-xs leading-relaxed rounded-2xl shadow-sm ${
                  m.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'text-slate-100 border border-slate-700/60 rounded-bl-sm'
                }`}
                style={m.role === 'assistant' ? { backgroundColor: aBubble } : {}}
              >
                <div className="whitespace-pre-wrap font-sans">{m.content}</div>

                {m.action && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/50 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        go(m.action!.target);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <span>{m.action.label}</span>
                      <span>→</span>
                    </button>
                  </div>
                )}
              </div>
              {m.time && (
                <span className="text-[10px] text-slate-500 px-1.5 mt-1 font-mono">
                  {m.time}
                </span>
              )}
            </div>
          ))}

          {thinking && (
            <div className="flex items-center gap-2 p-3 rounded-2xl max-w-[120px]" style={{ backgroundColor: aBubble }}>
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <div className="w-2 h-2 rounded-full bg-teal-400 animate-pulse delay-150" />
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse delay-300" />
              <span className="text-[11px] text-slate-400 ml-1 font-medium">Thinking...</span>
            </div>
          )}
        </div>

        {/* Input Footer */}
        <div className="shrink-0 p-3.5 border-t" style={{ borderColor: border, backgroundColor: isDark ? '#111A2E' : '#F8FAFC' }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask LENS AI about ${currentAssessment?.name || 'your cloud'}…`}
              className="flex-1 px-4 py-2.5 rounded-xl text-xs outline-none text-white placeholder-slate-500 bg-[#162032] border border-slate-700 focus:border-cyan-400 transition-colors"
            />
            <button
              type="submit"
              disabled={!input.trim() || thinking}
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer text-white shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)' }}
              title="Send message"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

export function ChatLauncher({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 px-4 py-3 rounded-full text-white shadow-2xl transition-all hover:scale-105 active:scale-95 cursor-pointer group"
      style={{
        background: 'linear-gradient(135deg, #0284c7 0%, #0d9488 50%, #10b981 100%)',
        boxShadow: '0 8px 30px rgba(13, 148, 136, 0.45), 0 0 0 1px rgba(255, 255, 255, 0.15)',
      }}
      title="Ask LENS AI Copilot"
    >
      <div className="relative">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className="text-white">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" stroke="#ffffff" />
          <circle cx="12" cy="12" r="2" fill="#ffffff" />
        </svg>
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0e1626] animate-pulse" />
      </div>
      <span className="text-xs font-bold tracking-wide">Ask LENS AI</span>
    </button>
  );
}
