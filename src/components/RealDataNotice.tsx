import { useApp } from '../context';
import { AppLayout } from './AppLayout';

interface Props {
  feature: string;
  reason: string;
  /** Render as a modal overlay (needs onClose) instead of a full screen. */
  onClose?: () => void;
}

/** Shown in real-data-only mode in place of features that only simulate data. */
export function RealDataNotice({ feature, reason, onClose }: Props) {
  const { theme, go } = useApp();
  const isDark = theme === 'dark';
  const card = isDark ? '#111B2E' : '#FFFFFF';
  const border = isDark ? '#1E293B' : '#E2E8F0';
  const text = isDark ? '#F1F5F9' : '#0F172A';
  const sub = isDark ? '#94A3B8' : '#64748B';

  const body = (
    <div
      role="status"
      className="max-w-lg w-full rounded-2xl p-8 flex flex-col gap-3"
      style={{ background: card, border: `1px solid ${border}`, color: text }}
    >
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: sub }}>
        Real data only
      </p>
      <h2 className="text-lg font-semibold">{feature} is turned off here</h2>
      <p className="text-sm leading-relaxed" style={{ color: sub }}>{reason}</p>
      <div className="flex gap-2 pt-2">
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Close
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go('dashboard')}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
          >
            Back to Home
          </button>
        )}
      </div>
    </div>
  );

  if (onClose) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(2,6,23,.6)' }}
        role="dialog"
        aria-modal="true"
        aria-label={`${feature} unavailable`}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
      >
        {body}
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="flex items-center justify-center p-10 min-h-[60vh]">{body}</div>
    </AppLayout>
  );
}

export const SCANNER_REASON =
  'Results on this environment come only from the real scanner (MCP fetch, then the check engine, then the loader). This screen generates or displays simulated results, so it is hidden to keep every number on screen real.';
