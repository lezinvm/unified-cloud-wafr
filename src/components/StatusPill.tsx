type Status = 'pass' | 'fail' | 'failed' | 'warning' | 'running' | 'draft' | 'complete' | 'completed';

const CONFIGS: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  pass:      { bg: '#ECFDF5', text: '#059669', dot: '#10B981', label: 'Pass'      },
  fail:      { bg: '#FFF1F2', text: '#E11D48', dot: '#FB7185', label: 'Failed'    },
  failed:    { bg: '#FFF1F2', text: '#E11D48', dot: '#FB7185', label: 'Failed'    },
  warning:   { bg: '#FFFBEB', text: '#D97706', dot: '#FBBF24', label: 'Warning'   },
  running:   { bg: '#EFF6FF', text: '#2563EB', dot: '#60A5FA', label: 'Running'   },
  draft:     { bg: '#F8FAFC', text: '#64748B', dot: '#94A3B8', label: 'Draft'     },
  complete:  { bg: '#ECFDF5', text: '#059669', dot: '#10B981', label: 'Completed' },
  completed: { bg: '#ECFDF5', text: '#059669', dot: '#10B981', label: 'Completed' },
};

const DARK_CONFIGS: Record<Status, { bg: string; text: string; dot: string; label: string }> = {
  pass:      { bg: 'rgba(82,183,136,.12)',  text: '#74C69D', dot: '#74C69D', label: 'Pass'      },
  fail:      { bg: 'rgba(251,113,133,.12)', text: '#FECDD3', dot: '#FB7185', label: 'Failed'    },
  failed:    { bg: 'rgba(251,113,133,.12)', text: '#FECDD3', dot: '#FB7185', label: 'Failed'    },
  warning:   { bg: 'rgba(251,191,36,.12)', text: '#FDE68A', dot: '#FBBF24', label: 'Warning'   },
  running:   { bg: 'rgba(59,130,246,.12)',  text: '#93C5FD', dot: '#60A5FA', label: 'Running'   },
  draft:     { bg: 'rgba(148,163,184,.12)', text: '#94A3B8', dot: '#94A3B8', label: 'Draft'     },
  complete:  { bg: 'rgba(82,183,136,.12)',  text: '#74C69D', dot: '#74C69D', label: 'Completed' },
  completed: { bg: 'rgba(82,183,136,.12)',  text: '#74C69D', dot: '#74C69D', label: 'Completed' },
};

export function StatusPill({ status, label, dark }: { status: Status; label?: string; dark?: boolean }) {
  const c = dark ? DARK_CONFIGS[status] : CONFIGS[status];
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium"
      style={{ backgroundColor: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.dot }} />
      {label ?? c.label}
    </span>
  );
}
