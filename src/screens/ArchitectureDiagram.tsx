import { useState } from 'react';
import { useApp } from '../context';
import { AppLayout } from '../components/AppLayout';

const LIGHT = {
  bg: '#F8FAFC',
  card: '#FFFFFF',
  cardAlt: '#F1F5F9',
  border: '#E2E8F0',
  text: '#0F172A',
  textSub: '#64748B',
  primary: '#2563EB',
  primaryBg: '#EFF6FF',
  error: '#E11D48',
  errorBg: '#FFF1F2',
  errorBorder: '#FDA4AF',
  nodeHealthyBg: '#FFFFFF',
  nodeHealthyBorder: '#CBD5E1',
  nodeHealthyText: '#1E293B',
  shadow: '0 1px 3px rgba(0,0,0,.06),0 1px 2px rgba(0,0,0,.04)',
  shadowMd: '0 4px 6px -1px rgba(0,0,0,.07),0 2px 4px -2px rgba(0,0,0,.05)',
};

const DARK = {
  bg: '#0B1220',
  card: '#111B2E',
  cardAlt: '#172238',
  border: '#1E293B',
  text: '#F1F5F9',
  textSub: '#94A3B8',
  primary: '#3B82F6',
  primaryBg: 'rgba(59,130,246,.15)',
  error: '#FB7185',
  errorBg: 'rgba(225, 29, 72, 0.16)',
  errorBorder: '#E11D48',
  nodeHealthyBg: '#131E33',
  nodeHealthyBorder: '#293952',
  nodeHealthyText: '#E2E8F0',
  shadow: '0 1px 3px rgba(0,0,0,.3),0 1px 2px rgba(0,0,0,.2)',
  shadowMd: '0 4px 6px rgba(0,0,0,.35),0 2px 4px rgba(0,0,0,.25)',
};

interface DiagramNode {
  id: string;
  label: string;
  type: string;
  x: number;
  y: number;
  isFailed: boolean;
  group: string;
  detail: string;
  findingId?: string;
}

const NODES: DiagramNode[] = [
  { id: 'igw', label: 'Internet Gateway', type: 'IGW', x: 380, y: 30, isFailed: false, group: 'edge', detail: 'igw-0abc1234 — Active gateway route' },
  { id: 'alb', label: 'Application LB', type: 'ALB', x: 240, y: 120, isFailed: true, group: 'public', detail: 'alb-prod-api — Target group missing health checks', findingId: 'REL-019' },
  { id: 'waf', label: 'AWS WAF', type: 'WAF', x: 520, y: 120, isFailed: false, group: 'public', detail: 'waf-v2-prod — Web ACL active and logging' },
  { id: 'ec2a', label: 'EC2 web-01', type: 'EC2', x: 140, y: 250, isFailed: false, group: 'compute', detail: 't3.medium · us-east-1a · SSM managed' },
  { id: 'ec2b', label: 'EC2 web-02', type: 'EC2', x: 280, y: 250, isFailed: false, group: 'compute', detail: 't3.medium · us-east-1b · SSM managed' },
  { id: 'lambda', label: 'Lambda exec', type: 'λ', x: 440, y: 250, isFailed: true, group: 'compute', detail: 'acme-lambda-exec — IAM role has wildcard resource permission', findingId: 'SEC-047' },
  { id: 'eks', label: 'EKS Cluster', type: 'EKS', x: 600, y: 250, isFailed: false, group: 'compute', detail: 'k8s 1.29 — Node groups healthy' },
  { id: 'rds', label: 'RDS Primary', type: 'RDS', x: 180, y: 380, isFailed: false, group: 'data', detail: 'db.r6g.large — Multi-AZ primary instance' },
  { id: 'rds2', label: 'RDS Replica', type: 'RDS', x: 320, y: 380, isFailed: false, group: 'data', detail: 'db.r6g.large · us-east-1b standby' },
  { id: 'elasticache', label: 'ElastiCache', type: 'Cache', x: 480, y: 380, isFailed: false, group: 'data', detail: 'Redis 7.0 · r6g.medium cluster' },
  { id: 's3', label: 'S3 acme-prod-data', type: 'S3', x: 640, y: 380, isFailed: false, group: 'storage', detail: 'versioned · KMS encrypted' },
  { id: 's3log', label: 'S3 acme-prod-logs', type: 'S3', x: 760, y: 250, isFailed: true, group: 'storage', detail: 'S3 bucket missing server access logging', findingId: 'SEC-024' },
  { id: 'iam', label: 'IAM / Roles', type: 'IAM', x: 680, y: 120, isFailed: true, group: 'identity', detail: 'Security group allows 0.0.0.0/0 ingress on port 22', findingId: 'SEC-061' },
];

const EDGES: [string, string][] = [
  ['igw', 'alb'], ['igw', 'waf'],
  ['waf', 'alb'],
  ['alb', 'ec2a'], ['alb', 'ec2b'], ['alb', 'lambda'],
  ['ec2a', 'rds'], ['ec2b', 'rds'],
  ['rds', 'rds2'],
  ['ec2a', 'elasticache'], ['ec2b', 'elasticache'],
  ['lambda', 's3'], ['ec2a', 's3'],
  ['lambda', 's3log'],
  ['iam', 'lambda'], ['iam', 'eks'],
  ['eks', 's3'],
];

const TYPE_LABEL: Record<string, string> = {
  IGW: 'IGW', ALB: 'ALB', WAF: 'WAF', EC2: 'EC2', λ: 'λ', EKS: 'EKS',
  RDS: 'RDS', Cache: 'Cache', S3: 'S3', IAM: 'IAM',
};

const VPC_BOUNDS = {
  public:  { x: 80, y: 90,  w: 580, h: 100, label: 'Public Subnet (us-east-1a/1b)' },
  compute: { x: 80, y: 215, w: 580, h: 100, label: 'Private Subnet — Compute' },
  data:    { x: 80, y: 345, w: 760, h: 100, label: 'Private Subnet — Data & Storage' },
};

export function ArchitectureDiagram() {
  const { go, theme } = useApp();
  const isDark = theme === 'dark';
  const T = isDark ? DARK : LIGHT;
  const [selected, setSelected] = useState<string | null>(null);

  const failedCount = NODES.filter(n => n.isFailed).length;
  const selectedNode = NODES.find(n => n.id === selected);

  return (
    <AppLayout>
      <div className="flex flex-col overflow-hidden" style={{ height: '100%', backgroundColor: T.bg }}>
        {/* Page header */}
        <div className="px-6 py-3.5 shrink-0 flex items-center justify-between border-b" style={{ backgroundColor: T.card, borderColor: T.border }}>
          <div className="flex items-center gap-4">
            <div>
              <nav className="text-xs flex items-center gap-1.5 mb-0.5" style={{ color: T.textSub }}>
                <button onClick={() => go('dashboard')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.textSub }}>Home</button>
                <span>/</span>
                <button onClick={() => go('report')} className="hover:underline transition-colors cursor-pointer" style={{ color: T.textSub }}>Review Findings</button>
                <span>/</span><span style={{ color: T.text, fontWeight: 500 }}>Architecture Diagram</span>
              </nav>
              <h1 className="font-semibold text-base sm:text-lg" style={{ color: T.text }}>
                Infrastructure Graph — acme-production / us-east-1
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Failed Resources Indicator Badge */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              <span>{failedCount} Failed Resources</span>
            </div>

            <button
              className="hidden sm:flex px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors cursor-pointer"
              style={{ borderColor: T.border, color: T.textSub, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
            >
              Open in draw.io
            </button>
            <button
              className="px-3 py-1.5 text-xs rounded-xl border font-medium transition-colors cursor-pointer"
              style={{ borderColor: T.border, color: T.textSub, backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF' }}
              onMouseEnter={e => { e.currentTarget.style.color = T.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = T.textSub; }}
            >
              ↓ Export SVG
            </button>
          </div>
        </div>

        {/* Main: SVG Diagram Canvas + Detail Panel */}
        <div className="flex-1 overflow-hidden flex">
          {/* SVG canvas */}
          <div className="flex-1 overflow-auto relative p-4" style={{ backgroundColor: T.bg }}>
            <svg width="880" height="520" viewBox="0 0 880 520" className="min-w-full">
              {/* Grid overlay pattern */}
              <defs>
                <pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse">
                  <path d="M 48 0 L 0 0 0 48" fill="none" stroke={T.primary} strokeWidth="0.5" opacity="0.05"/>
                </pattern>
              </defs>
              <rect width="880" height="520" fill="url(#grid)" />

              {/* VPC boundary */}
              <rect x="60" y="10" width="800" height="470" rx="14" fill="none" stroke={T.border} strokeWidth="2" strokeDasharray="6 3" />
              <text x="76" y="28" fill={T.primary} fontSize="11" fontFamily="Inter" fontWeight="600">VPC: vpc-0prod1234 (172.16.0.0/16)</text>

              {/* Subnet bands */}
              {Object.entries(VPC_BOUNDS).map(([key, b]) => (
                <g key={key}>
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx="10"
                    fill={isDark ? 'rgba(17,27,46,.7)' : 'rgba(241,245,249,.8)'}
                    stroke={T.border}
                    strokeWidth="1.5"
                  />
                  <text x={b.x + 12} y={b.y + 18} fill={T.textSub} fontSize="10" fontFamily="Inter" fontWeight="500">
                    {b.label}
                  </text>
                </g>
              ))}

              {/* Edges */}
              {EDGES.map(([a, b]) => {
                const na = NODES.find(n => n.id === a);
                const nb = NODES.find(n => n.id === b);
                if (!na || !nb) return null;
                const x1 = na.x + 36, y1 = na.y + 26;
                const x2 = nb.x + 36, y2 = nb.y + 26;
                const isSelected = selected === a || selected === b;
                const isFailedConnection = na.isFailed || nb.isFailed;

                return (
                  <line
                    key={`${a}-${b}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isSelected ? T.primary : isFailedConnection ? (isDark ? '#E11D48' : '#F43F5E') : T.border}
                    strokeWidth={isSelected ? 2.5 : isFailedConnection ? 1.75 : 1.25}
                    opacity={selected && !isSelected ? 0.25 : isFailedConnection ? 0.85 : 0.6}
                    strokeDasharray={isFailedConnection ? '4 2' : undefined}
                  />
                );
              })}

              {/* Nodes */}
              {NODES.map(node => {
                const isSelected = selected === node.id;
                const isFailed = node.isFailed;

                // Color schemes
                const nodeBg = isFailed
                  ? (isDark ? 'rgba(225, 29, 72, 0.18)' : '#FFF1F2')
                  : (isDark ? '#131E33' : '#FFFFFF');

                const nodeBorder = isFailed
                  ? '#E11D48'
                  : isSelected
                    ? T.primary
                    : (isDark ? '#293952' : '#CBD5E1');

                const nodeTextColor = isFailed
                  ? (isDark ? '#FB7185' : '#BE123C')
                  : (isDark ? '#F1F5F9' : '#0F172A');

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-transform hover:scale-105"
                    onClick={() => setSelected(isSelected ? null : node.id)}
                  >
                    {/* Shadow / selection halo */}
                    {isSelected && (
                      <rect
                        x={node.x - 3}
                        y={node.y - 3}
                        width={78}
                        height={58}
                        rx="11"
                        fill="none"
                        stroke={isFailed ? '#E11D48' : T.primary}
                        strokeWidth={2}
                        opacity={0.5}
                      />
                    )}

                    {/* Node Container Card */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={72}
                      height={52}
                      rx="8"
                      fill={nodeBg}
                      stroke={nodeBorder}
                      strokeWidth={isFailed || isSelected ? 2 : 1.5}
                    />

                    {/* Node Type Label */}
                    <text
                      x={node.x + 36}
                      y={node.y + 22}
                      textAnchor="middle"
                      fontSize="11"
                      fontFamily="Inter"
                      fontWeight="700"
                      fill={nodeTextColor}
                    >
                      {TYPE_LABEL[node.type] || node.type}
                    </text>

                    {/* Node Name */}
                    <text
                      x={node.x + 36}
                      y={node.y + 38}
                      textAnchor="middle"
                      fontSize="8.5"
                      fontFamily="Inter"
                      fill={isFailed ? (isDark ? '#FDA4AF' : '#E11D48') : T.textSub}
                      fontWeight="500"
                    >
                      {node.label.length > 10 ? node.label.slice(0, 10) + '…' : node.label}
                    </text>

                    {/* Status Dot / Failure Badge (Only for failed nodes) */}
                    {isFailed ? (
                      <g>
                        <circle cx={node.x + 64} cy={node.y + 8} r={5.5} fill="#E11D48" />
                        <text
                          x={node.x + 64}
                          y={node.y + 11.5}
                          textAnchor="middle"
                          fontSize="8"
                          fontFamily="Inter"
                          fontWeight="bold"
                          fill="#FFFFFF"
                        >
                          !
                        </text>
                      </g>
                    ) : (
                      <circle cx={node.x + 64} cy={node.y + 8} r={3.5} fill={isDark ? '#334155' : '#94A3B8'} opacity={0.6} />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Detail side panel (when a node is selected) */}
          {selectedNode && (
            <div
              className="w-80 flex flex-col shrink-0 border-l shadow-lg"
              style={{ borderColor: T.border, backgroundColor: T.card }}
            >
              <div className="px-5 py-3.5 flex items-center justify-between border-b" style={{ borderColor: T.border }}>
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: T.textSub }}>
                  Resource Inspection
                </span>
                <button
                  onClick={() => setSelected(null)}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer hover:bg-gray-500/20"
                  style={{ color: T.textSub }}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border"
                      style={{
                        backgroundColor: selectedNode.isFailed ? (isDark ? 'rgba(225,29,72,0.2)' : '#FFE4E6') : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                        borderColor: selectedNode.isFailed ? '#FDA4AF' : T.border,
                        color: selectedNode.isFailed ? '#E11D48' : T.text,
                      }}
                    >
                      {TYPE_LABEL[selectedNode.type] || selectedNode.type}
                    </span>

                    {selectedNode.isFailed ? (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                        Failed Check
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Healthy
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-base leading-tight" style={{ color: T.text }}>
                    {selectedNode.label}
                  </h3>
                </div>

                {/* Status Notice */}
                {selectedNode.isFailed ? (
                  <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex flex-col gap-1">
                    <div className="font-semibold flex items-center gap-1.5 text-rose-800 dark:text-rose-200">
                      <span>Remediation Required</span>
                      {selectedNode.findingId && (
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-rose-600 text-white">
                          {selectedNode.findingId}
                        </span>
                      )}
                    </div>
                    <div className="leading-relaxed">
                      {selectedNode.detail}
                    </div>
                  </div>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-slate-500/10 border border-slate-500/20 text-xs text-slate-600 dark:text-slate-300">
                    <div className="font-semibold mb-0.5 text-slate-700 dark:text-slate-200">Operational & Compliant</div>
                    <div>{selectedNode.detail}</div>
                  </div>
                )}

                {/* Resource Metadata */}
                <div className="flex flex-col gap-2 pt-2 border-t" style={{ borderColor: T.border }}>
                  {[
                    ['Resource ID', `${selectedNode.id.toUpperCase()}-prod-01`],
                    ['Subnet Area', selectedNode.group],
                    ['Region', 'us-east-1'],
                    ['Account', 'acme-production (124890123456)'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between items-center text-xs">
                      <span style={{ color: T.textSub }}>{k}</span>
                      <span className="font-medium font-mono text-[11px]" style={{ color: T.text }}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Action button if failed */}
                {selectedNode.isFailed && (
                  <div className="mt-auto pt-4">
                    <button
                      onClick={() => go('remediation')}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-xs font-semibold transition-opacity hover:opacity-90 cursor-pointer shadow-sm text-white"
                      style={{ background: 'linear-gradient(135deg, #1B6FC9, #14A085, #10B981)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span>Fix in AI Remediation</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
