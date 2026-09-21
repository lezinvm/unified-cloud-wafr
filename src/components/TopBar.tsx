import { useApp, Screen } from '../context';
import { CloudifyOpsSymbol } from './CloudLogo';

const NAV_ITEMS: { label: string; screen: Screen }[] = [
  { label: 'Assessments', screen: 'assessment-list' },
  { label: 'Reports',     screen: 'report'           },
  { label: 'Diagrams',    screen: 'diagram'           },
  { label: 'Settings',    screen: 'settings'          },
];

const CLOUD_BADGE: Record<string, { grad: string; text: string; label: string }> = {
  aws:   { grad: 'linear-gradient(135deg,#FF9900,#ffb347)', text: '#0a0600', label: 'AWS'   },
  azure: { grad: 'linear-gradient(135deg,#0078D4,#2fa8f5)', text: '#ffffff', label: 'Azure' },
  gcp:   { grad: 'linear-gradient(135deg,#4285F4,#6fa8f5)', text: '#ffffff', label: 'GCP'   },
};

export function TopBar() {
  const { cloud, cloudShort, accent, go, screen } = useApp();
  const badge = cloud ? CLOUD_BADGE[cloud] : null;

  return (
    <header
      className="h-14 flex items-center px-5 gap-3 shrink-0 z-20"
      style={{
        background: 'linear-gradient(180deg,#0f1115,#151a24)',
        borderBottom: '1px solid #252a38',
        boxShadow: '0 1px 0 rgba(0,180,216,.06)',
      }}
    >
      {/* Logo */}
      <button
        onClick={() => go('select-cloud')}
        className="flex items-center gap-2.5 mr-2 group cursor-pointer"
      >
        <CloudifyOpsSymbol height={24} />
        <span className="text-white font-semibold text-sm tracking-tight">CloudifyOps</span>
      </button>

      {/* Cloud badge */}
      {badge && cloud && (
        <button
          onClick={() => go('select-cloud')}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold hover:opacity-90 transition-opacity"
          style={{ background: badge.grad, color: badge.text }}
        >
          {badge.label} <span className="opacity-60 text-[10px]">▾</span>
        </button>
      )}

      {/* Nav */}
      <nav className="flex items-center gap-0.5 ml-1">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.screen}
            onClick={() => go(item.screen)}
            className="px-3 py-1.5 text-xs rounded-lg transition-all"
            style={
              screen === item.screen
                ? { color: '#00b4d8', background: 'rgba(0,180,216,.1)', fontWeight: 500 }
                : { color: 'rgba(240,244,255,.45)', fontWeight: 400 }
            }
            onMouseEnter={e => { if (screen !== item.screen) (e.target as HTMLElement).style.color = '#f0f4ff'; }}
            onMouseLeave={e => { if (screen !== item.screen) (e.target as HTMLElement).style.color = 'rgba(240,244,255,.45)'; }}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button className="flex items-center gap-1.5 text-[#7a8aaa] hover:text-white text-xs px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
          Acme Corp <span className="text-[10px] opacity-50">▾</span>
        </button>
        <div className="flex items-center gap-2 pl-3 border-l border-white/8">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: 'linear-gradient(135deg,#00b4d8,#00e676)', color: '#0b1329' }}
          >LV</div>
          <div>
            <div className="text-white/85 text-[11px] font-semibold leading-tight">Lezin VM</div>
            <div className="text-[#7a8aaa] text-[10px] leading-tight">Admin</div>
          </div>
        </div>
      </div>
    </header>
  );
}
