import { useState } from 'react';
import { useApp } from '../context';

export interface DiagramNode {
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

export const DIAGRAM_NODES: DiagramNode[] = [
  { id: 'igw', label: 'Internet Gateway', type: 'IGW', x: 380, y: 30, isFailed: false, group: 'edge', detail: 'igw-0abc1234 — Active gateway route' },
  { id: 'alb', label: 'Application LB', type: 'ALB', x: 240, y: 120, isFailed: true, group: 'public', detail: 'alb-prod-api — Target group missing active health checks and SSL policy TLS 1.3', findingId: 'REL-019' },
  { id: 'waf', label: 'AWS WAF', type: 'WAF', x: 520, y: 120, isFailed: false, group: 'public', detail: 'waf-v2-prod — Web ACL active with rate limiting and managed rules' },
  { id: 'ec2a', label: 'EC2 web-01', type: 'EC2', x: 140, y: 250, isFailed: false, group: 'compute', detail: 't3.medium · us-east-1a · SSM managed instance profile' },
  { id: 'ec2b', label: 'EC2 web-02', type: 'EC2', x: 280, y: 250, isFailed: false, group: 'compute', detail: 't3.medium · us-east-1b · SSM managed instance profile' },
  { id: 'lambda', label: 'Lambda exec', type: 'λ', x: 440, y: 250, isFailed: true, group: 'compute', detail: 'acme-lambda-exec — IAM role has wildcard resource permission (Action: "*", Resource: "*")', findingId: 'SEC-047' },
  { id: 'eks', label: 'EKS Cluster', type: 'EKS', x: 600, y: 250, isFailed: false, group: 'compute', detail: 'k8s 1.29 — Managed node groups healthy with private API access' },
  { id: 'rds', label: 'RDS Primary', type: 'RDS', x: 180, y: 380, isFailed: false, group: 'data', detail: 'db.r6g.large — Multi-AZ primary instance in private subnet' },
  { id: 'rds2', label: 'RDS Replica', type: 'RDS', x: 320, y: 380, isFailed: false, group: 'data', detail: 'db.r6g.large · us-east-1b standby replica' },
  { id: 'elasticache', label: 'ElastiCache', type: 'Cache', x: 480, y: 380, isFailed: false, group: 'data', detail: 'Redis 7.0 · r6g.medium cluster with encryption in-transit' },
  { id: 's3', label: 'S3 acme-prod-data', type: 'S3', x: 640, y: 380, isFailed: false, group: 'storage', detail: 'versioned · KMS Customer Managed Key encrypted' },
  { id: 's3log', label: 'S3 acme-prod-logs', type: 'S3', x: 760, y: 250, isFailed: true, group: 'storage', detail: 'S3 bucket missing server access logging and object lock protection', findingId: 'SEC-024' },
  { id: 'iam', label: 'IAM / Roles', type: 'IAM', x: 680, y: 120, isFailed: true, group: 'identity', detail: 'Security group allows unrestricted 0.0.0.0/0 ingress on SSH port 22', findingId: 'SEC-061' },
];

export const DIAGRAM_EDGES: [string, string][] = [
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

const VPC_BOUNDS = {
  public:  { x: 80, y: 90,  w: 580, h: 100, label: 'Public Subnet (us-east-1a / 1b)' },
  compute: { x: 80, y: 215, w: 580, h: 100, label: 'Private Subnet — Compute (App Tier)' },
  data:    { x: 80, y: 345, w: 760, h: 100, label: 'Private Subnet — Data & Storage' },
};

const TYPE_LABEL: Record<string, string> = {
  IGW: 'IGW', ALB: 'ALB', WAF: 'WAF', EC2: 'EC2', λ: 'λ', EKS: 'EKS',
  RDS: 'RDS', Cache: 'Cache', S3: 'S3', IAM: 'IAM',
};

interface ArchitectureDiagramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoToRemediation?: (findingId?: string) => void;
}

export function ArchitectureDiagramModal({
  isOpen,
  onClose,
  onGoToRemediation,
}: ArchitectureDiagramModalProps) {
  const { theme, go, goToAIFix, currentAssessment } = useApp();
  const isDark = theme === 'dark';

  const [selectedId, setSelectedId] = useState<string | null>('lambda');
  const [filterFailedOnly, setFilterFailedOnly] = useState<boolean>(false);

  if (!isOpen) return null;

  const failedCount = DIAGRAM_NODES.filter(n => n.isFailed).length;
  const totalCount = DIAGRAM_NODES.length;

  const displayedNodes = filterFailedOnly
    ? DIAGRAM_NODES.filter(n => n.isFailed)
    : DIAGRAM_NODES;

  const selectedNode = DIAGRAM_NODES.find(n => n.id === selectedId);

  const handleFixResource = (findingId?: string) => {
    onClose();
    if (findingId) {
      goToAIFix(findingId);
    } else if (onGoToRemediation) {
      onGoToRemediation();
    } else {
      go('remediation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div
        className="w-full max-w-6xl rounded-2xl flex flex-col overflow-hidden shadow-2xl border max-h-[92vh]"
        style={{
          backgroundColor: isDark ? '#0D1525' : '#FFFFFF',
          borderColor: isDark ? '#1E293B' : '#E2E8F0',
          color: isDark ? '#F1F5F9' : '#0F172A',
        }}
      >
        {/* Modal Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between shrink-0"
          style={{
            backgroundColor: isDark ? '#111B2E' : '#F8FAFC',
            borderColor: isDark ? '#1E293B' : '#E2E8F0',
          }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 border"
              style={{
                backgroundColor: isDark ? 'rgba(225, 29, 72, 0.15)' : '#FFF1F2',
                borderColor: isDark ? 'rgba(225, 29, 72, 0.4)' : '#FDA4AF',
                color: '#E11D48',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="6" height="6" rx="1" />
                <rect x="16" y="2" width="6" height="6" rx="1" />
                <rect x="9" y="16" width="6" height="6" rx="1" />
                <path d="M5 8v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                <path d="M12 12v4" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold leading-tight">
                  Architecture Failure Topology — {currentAssessment?.accountName || 'acme-production'}
                </h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                  {failedCount} Failed Resources in Red
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Physical and logical infrastructure graph. Non-compliant components and risky connection paths are highlighted in <span className="font-bold text-rose-600 dark:text-rose-400">RED</span>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {/* Filter Toggle */}
            <div className="flex items-center p-0.5 rounded-xl border bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-xs">
              <button
                type="button"
                onClick={() => setFilterFailedOnly(false)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  !filterFailedOnly
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All Resources ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setFilterFailedOnly(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer ${
                  filterFailedOnly
                    ? 'bg-rose-600 text-white shadow-xs font-semibold'
                    : 'text-rose-600 dark:text-rose-400 hover:text-rose-700'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                Failed Only ({failedCount})
              </button>
            </div>

            {/* Fullscreen Page Shortcut */}
            <button
              type="button"
              onClick={() => {
                onClose();
                go('diagram');
              }}
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs border font-medium transition-colors cursor-pointer border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Open full page diagram screen"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9"/>
                <polyline points="9 21 3 21 3 15"/>
                <line x1="21" y1="3" x2="14" y2="10"/>
                <line x1="3" y1="21" x2="10" y2="14"/>
              </svg>
              <span>Full Screen</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close popup"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Main Body: SVG Diagram + Resource Detail Panel */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-[460px]">
          {/* Canvas Area */}
          <div
            className="flex-1 overflow-auto relative p-4"
            style={{ backgroundColor: isDark ? '#080E1A' : '#F8FAFC' }}
          >
            <svg width="880" height="500" viewBox="0 0 880 500" className="min-w-full">
              {/* Background Grid Pattern */}
              <defs>
                <pattern id="modal-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? '#3B82F6' : '#94A3B8'} strokeWidth="0.5" opacity={isDark ? '0.07' : '0.12'}/>
                </pattern>
              </defs>
              <rect width="880" height="500" fill="url(#modal-grid)" />

              {/* VPC boundary */}
              <rect
                x="60"
                y="10"
                width="800"
                height="470"
                rx="14"
                fill="none"
                stroke={isDark ? '#243046' : '#CBD5E1'}
                strokeWidth="2"
                strokeDasharray="6 3"
              />
              <text
                x="76"
                y="28"
                fill={isDark ? '#60A5FA' : '#2563EB'}
                fontSize="11"
                fontFamily="Inter"
                fontWeight="600"
              >
                VPC: vpc-0prod1234 (172.16.0.0/16) · us-east-1
              </text>

              {/* Subnet bands */}
              {Object.entries(VPC_BOUNDS).map(([key, b]) => (
                <g key={key}>
                  <rect
                    x={b.x}
                    y={b.y}
                    width={b.w}
                    height={b.h}
                    rx="10"
                    fill={isDark ? 'rgba(15, 23, 42, 0.7)' : 'rgba(241, 245, 249, 0.85)'}
                    stroke={isDark ? '#1E293B' : '#E2E8F0'}
                    strokeWidth="1.5"
                  />
                  <text
                    x={b.x + 12}
                    y={b.y + 18}
                    fill={isDark ? '#94A3B8' : '#64748B'}
                    fontSize="10"
                    fontFamily="Inter"
                    fontWeight="600"
                  >
                    {b.label}
                  </text>
                </g>
              ))}

              {/* Connection Edges */}
              {DIAGRAM_EDGES.map(([a, b]) => {
                const na = DIAGRAM_NODES.find(n => n.id === a);
                const nb = DIAGRAM_NODES.find(n => n.id === b);
                if (!na || !nb) return null;

                if (filterFailedOnly && (!na.isFailed && !nb.isFailed)) return null;

                const x1 = na.x + 36, y1 = na.y + 26;
                const x2 = nb.x + 36, y2 = nb.y + 26;
                const isSelected = selectedId === a || selectedId === b;
                const isFailedConnection = na.isFailed || nb.isFailed;

                return (
                  <line
                    key={`${a}-${b}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={
                      isFailedConnection
                        ? '#E11D48'
                        : isSelected
                        ? '#3B82F6'
                        : isDark ? '#334155' : '#CBD5E1'
                    }
                    strokeWidth={isSelected ? 2.5 : isFailedConnection ? 2 : 1.25}
                    opacity={selectedId && !isSelected ? 0.25 : isFailedConnection ? 0.9 : 0.6}
                    strokeDasharray={isFailedConnection ? '5 3' : undefined}
                  />
                );
              })}

              {/* Resource Nodes */}
              {displayedNodes.map(node => {
                const isSelected = selectedId === node.id;
                const isFailed = node.isFailed;

                // Color schemes: FAILED = Prominent RED
                const nodeBg = isFailed
                  ? (isDark ? 'rgba(225, 29, 72, 0.22)' : '#FFF1F2')
                  : (isDark ? '#111B2E' : '#FFFFFF');

                const nodeBorder = isFailed
                  ? '#E11D48'
                  : isSelected
                  ? (isDark ? '#3B82F6' : '#2563EB')
                  : (isDark ? '#243046' : '#CBD5E1');

                const nodeTextColor = isFailed
                  ? (isDark ? '#FDA4AF' : '#BE123C')
                  : (isDark ? '#F1F5F9' : '#0F172A');

                return (
                  <g
                    key={node.id}
                    className="cursor-pointer transition-transform hover:scale-105"
                    onClick={() => setSelectedId(isSelected ? null : node.id)}
                  >
                    {/* Shadow / selection halo */}
                    {isSelected && (
                      <rect
                        x={node.x - 4}
                        y={node.y - 4}
                        width={80}
                        height={60}
                        rx="12"
                        fill="none"
                        stroke={isFailed ? '#E11D48' : '#3B82F6'}
                        strokeWidth={2.5}
                        opacity={0.8}
                      />
                    )}

                    {/* Node Container Box */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={72}
                      height={52}
                      rx="8"
                      fill={nodeBg}
                      stroke={nodeBorder}
                      strokeWidth={isFailed ? 2.5 : isSelected ? 2 : 1.5}
                      filter={isFailed ? 'drop-shadow(0 0 6px rgba(225, 29, 72, 0.4))' : undefined}
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
                      fill={isFailed ? (isDark ? '#FECDD3' : '#E11D48') : (isDark ? '#94A3B8' : '#64748B')}
                      fontWeight="600"
                    >
                      {node.label.length > 10 ? node.label.slice(0, 10) + '…' : node.label}
                    </text>

                    {/* Status Dot / Failure Exclamation Badge */}
                    {isFailed ? (
                      <g>
                        <circle cx={node.x + 64} cy={node.y + 8} r={6} fill="#E11D48" />
                        <text
                          x={node.x + 64}
                          y={node.y + 11.5}
                          textAnchor="middle"
                          fontSize="8.5"
                          fontFamily="Inter"
                          fontWeight="bold"
                          fill="#FFFFFF"
                        >
                          !
                        </text>
                      </g>
                    ) : (
                      <circle cx={node.x + 64} cy={node.y + 8} r={3.5} fill="#10B981" />
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Right Side Resource Inspection Drawer */}
          <div
            className="w-full md:w-84 flex flex-col shrink-0 border-t md:border-t-0 md:border-l"
            style={{
              borderColor: isDark ? '#1E293B' : '#E2E8F0',
              backgroundColor: isDark ? '#0F172A' : '#F8FAFC',
            }}
          >
            {selectedNode ? (
              <div className="flex flex-col h-full p-5 justify-between gap-4 overflow-y-auto">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Resource Inspector
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      className="text-xs text-slate-400 hover:text-white cursor-pointer"
                    >
                      Deselect
                    </button>
                  </div>

                  <div className="mt-3.5 flex items-center gap-2">
                    <span
                      className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border"
                      style={{
                        backgroundColor: selectedNode.isFailed
                          ? (isDark ? 'rgba(225,29,72,0.2)' : '#FFE4E6')
                          : (isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0'),
                        borderColor: selectedNode.isFailed ? '#FDA4AF' : (isDark ? '#334155' : '#CBD5E1'),
                        color: selectedNode.isFailed ? '#E11D48' : (isDark ? '#F1F5F9' : '#0F172A'),
                      }}
                    >
                      {TYPE_LABEL[selectedNode.type] || selectedNode.type}
                    </span>

                    {selectedNode.isFailed ? (
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        FAILED (RED)
                      </span>
                    ) : (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                        Healthy
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base mt-2 text-slate-900 dark:text-white">
                    {selectedNode.label}
                  </h3>

                  {/* Failure / Health Description Notice */}
                  {selectedNode.isFailed ? (
                    <div className="mt-3 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 flex flex-col gap-1.5">
                      <div className="font-bold flex items-center gap-1.5 text-rose-800 dark:text-rose-200">
                        <span>High Risk Issue Identified</span>
                        {selectedNode.findingId && (
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-rose-600 text-white font-bold">
                            {selectedNode.findingId}
                          </span>
                        )}
                      </div>
                      <div className="leading-relaxed">
                        {selectedNode.detail}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-800 dark:text-emerald-300">
                      <div className="font-semibold mb-0.5">Compliant Resource</div>
                      <div className="text-slate-600 dark:text-slate-300">{selectedNode.detail}</div>
                    </div>
                  )}

                  {/* Resource Metadata Details */}
                  <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 text-xs">
                    {[
                      ['Resource ID', `${selectedNode.id.toUpperCase()}-prod-01`],
                      ['Subnet Placement', selectedNode.group],
                      ['Region', currentAssessment?.region || 'us-east-1'],
                      ['Account', `${currentAssessment?.accountName || 'acme-production'} (${currentAssessment?.accountId || '124890123456'})`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between items-center text-xs">
                        <span className="text-slate-500 dark:text-slate-400">{k}</span>
                        <span className="font-medium font-mono text-[11px] text-slate-800 dark:text-slate-200">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fix Button if failed */}
                {selectedNode.isFailed && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => handleFixResource(selectedNode.findingId)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-opacity hover:opacity-90 cursor-pointer shadow-md text-white"
                      style={{ background: 'linear-gradient(135deg, #E11D48, #BE123C)' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                      </svg>
                      <span>Fix {selectedNode.findingId || 'Resource'} with AI</span>
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center justify-center text-center h-full text-slate-500 text-xs">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mb-2 opacity-50">
                  <rect x="2" y="2" width="6" height="6" rx="1" />
                  <rect x="16" y="2" width="6" height="6" rx="1" />
                  <rect x="9" y="16" width="6" height="6" rx="1" />
                  <path d="M5 8v3a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
                  <path d="M12 12v4" />
                </svg>
                <p className="font-semibold text-slate-700 dark:text-slate-300">Select any resource node</p>
                <p className="text-[11px] mt-1 text-slate-400">Click any red or green component in the topology to inspect compliance findings.</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Legend Bar */}
        <div
          className="px-6 py-3 border-t flex items-center justify-between flex-wrap gap-3 shrink-0"
          style={{
            backgroundColor: isDark ? '#111B2E' : '#F8FAFC',
            borderColor: isDark ? '#1E293B' : '#E2E8F0',
          }}
        >
          {/* Legend Items */}
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center text-[8px] font-bold text-rose-500">
                !
              </span>
              <span className="font-bold text-rose-600 dark:text-rose-400">Failed Resource (Red)</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-600" />
              <span className="text-slate-600 dark:text-slate-400 font-medium">Compliant Resource</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="w-6 h-0 border-t-2 border-dashed border-rose-500" />
              <span className="text-rose-600 dark:text-rose-400 text-[11px]">Compromised Path</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => handleFixResource('SEC-047')}
              className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
              <span>Remediate All Failed Resources</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
