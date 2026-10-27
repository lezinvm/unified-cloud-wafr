import { useState } from 'react';

export interface McpTool {
  id: string;
  name: string;
  enabled: boolean;
  classification: 'Read only' | 'Mutative' | 'Destructive';
}

export interface McpServerConfig {
  id: string;
  name: string;
  endpointUrl: string;
  description?: string;
  enableDynamicRegistration: boolean;
  privateConnection: boolean;
  authFlow: 'api_key' | 'oauth_cc' | 'oauth_3lo' | 'multi_header' | 'sigv4';
  authConfig: {
    apiKeyName?: string;
    apiKeyHeader?: string;
    apiKeyValue?: string;
    clientId?: string;
    clientSecret?: string;
    tokenUrl?: string;
    roleArn?: string;
    region?: string;
    headers?: { key: string; value: string }[];
  };
  tools: McpTool[];
  status: 'connected' | 'disconnected' | 'error';
  createdAt?: string;
}

export const INITIAL_MCP_TOOLS: McpTool[] = [
  { id: '1', name: 'search_jira_issues', enabled: true, classification: 'Read only' },
  { id: '2', name: 'create_jira_ticket', enabled: true, classification: 'Mutative' },
  { id: '3', name: 'update_jira_ticket', enabled: true, classification: 'Read only' },
  { id: '4', name: 'close_jira_ticket', enabled: true, classification: 'Read only' },
  { id: '5', name: 'post_slack_message', enabled: true, classification: 'Read only' },
  { id: '6', name: 'get_deployment_status', enabled: true, classification: 'Read only' },
  { id: '7', name: 'send_approval_request', enabled: true, classification: 'Read only' },
  { id: '8', name: 'restart_deployment', enabled: true, classification: 'Read only' },
  { id: '9', name: 'scale_deployment', enabled: true, classification: 'Read only' },
  { id: '10', name: 'rollback_deployment', enabled: true, classification: 'Read only' },
  { id: '11', name: 'clear_evicted_pods', enabled: true, classification: 'Read only' },
  { id: '12', name: 'cordon_node', enabled: true, classification: 'Read only' },
  { id: '13', name: 'uncordon_node', enabled: true, classification: 'Read only' },
];

interface RegisterMcpWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (server: McpServerConfig) => void;
  initialServer?: McpServerConfig | null;
  initialStep?: number;
  isDark?: boolean;
}

export function RegisterMcpWizard({
  isOpen,
  onClose,
  onSave,
  initialServer,
  initialStep = 1,
  isDark = true,
}: RegisterMcpWizardProps) {
  const [currentStep, setCurrentStep] = useState<number>(initialStep);

  // Step 1: MCP Server Details
  const [name, setName] = useState(initialServer?.name || '');
  const [endpointUrl, setEndpointUrl] = useState(initialServer?.endpointUrl || '');
  const [description, setDescription] = useState(initialServer?.description || '');
  const [enableDynamicRegistration, setEnableDynamicRegistration] = useState(
    initialServer?.enableDynamicRegistration || false
  );
  const [privateConnection, setPrivateConnection] = useState(
    initialServer?.privateConnection || false
  );
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [timeoutSecs, setTimeoutSecs] = useState('30');
  const [nameError, setNameError] = useState('');
  const [endpointError, setEndpointError] = useState('');

  // Step 2: Authorization Flow
  const [authFlow, setAuthFlow] = useState<
    'oauth_cc' | 'oauth_3lo' | 'api_key' | 'multi_header' | 'sigv4'
  >(initialServer?.authFlow || 'api_key');

  // Step 3: Authorization Configuration
  const [apiKeyName, setApiKeyName] = useState(initialServer?.authConfig?.apiKeyName || '');
  const [apiKeyHeader, setApiKeyHeader] = useState(initialServer?.authConfig?.apiKeyHeader || 'X-API-Key');
  const [apiKeyValue, setApiKeyValue] = useState(initialServer?.authConfig?.apiKeyValue || '');
  const [clientId, setClientId] = useState(initialServer?.authConfig?.clientId || '');
  const [clientSecret, setClientSecret] = useState(initialServer?.authConfig?.clientSecret || '');
  const [tokenUrl, setTokenUrl] = useState(initialServer?.authConfig?.tokenUrl || '');
  const [roleArn, setRoleArn] = useState(initialServer?.authConfig?.roleArn || '');
  const [region, setRegion] = useState(initialServer?.authConfig?.region || 'us-east-1');
  const [customHeaderKey, setCustomHeaderKey] = useState('DD-API-KEY');
  const [customHeaderVal, setCustomHeaderVal] = useState('');

  // Step 5: Tools selection
  const [tools, setTools] = useState<McpTool[]>(
    initialServer?.tools && initialServer.tools.length > 0
      ? initialServer.tools
      : INITIAL_MCP_TOOLS
  );
  const [toolSearch, setToolSearch] = useState('');

  if (!isOpen) return null;

  // Validation
  const validateStep1 = () => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Invalid input');
      valid = false;
    } else {
      setNameError('');
    }

    if (!endpointUrl.trim()) {
      setEndpointError('Endpoint URL is required');
      valid = false;
    } else {
      setEndpointError('');
    }
    return valid;
  };

  const handleNextFromStep1 = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleFinishStep4 = () => {
    // Proceed to Step 5: Select MCP Server Tools
    setCurrentStep(5);
  };

  const handleFinalSave = () => {
    const server: McpServerConfig = {
      id: initialServer?.id || `mcp-${Date.now()}`,
      name: name.trim() || 'cloudifyopsAish-devops-mcp',
      endpointUrl: endpointUrl.trim(),
      description: description.trim() || undefined,
      enableDynamicRegistration,
      privateConnection,
      authFlow,
      authConfig: {
        apiKeyName: apiKeyName.trim() || undefined,
        apiKeyHeader: apiKeyHeader.trim() || undefined,
        apiKeyValue: apiKeyValue.trim() || undefined,
        clientId: clientId.trim() || undefined,
        clientSecret: clientSecret.trim() || undefined,
        tokenUrl: tokenUrl.trim() || undefined,
        roleArn: roleArn.trim() || undefined,
        region: region.trim() || undefined,
      },
      tools,
      status: 'connected',
      createdAt: initialServer?.createdAt || new Date().toISOString(),
    };
    onSave(server);
    onClose();
  };

  const toggleAllTools = () => {
    const allEnabled = tools.every((t) => t.enabled);
    setTools((prev) => prev.map((t) => ({ ...t, enabled: !allEnabled })));
  };

  const toggleTool = (id: string) => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, enabled: !t.enabled } : t))
    );
  };

  const updateClassification = (id: string, classification: 'Read only' | 'Mutative' | 'Destructive') => {
    setTools((prev) =>
      prev.map((t) => (t.id === id ? { ...t, classification } : t))
    );
  };

  const filteredTools = tools.filter((t) =>
    t.name.toLowerCase().includes(toolSearch.trim().toLowerCase())
  );
  const enabledToolsCount = tools.filter((t) => t.enabled).length;

  // Theming
  const bg = isDark ? '#0B1220' : '#F8FAFC';
  const cardBg = isDark ? '#111B2E' : '#FFFFFF';
  const borderCol = isDark ? '#1E293B' : '#E2E8F0';
  const textCol = isDark ? '#F1F5F9' : '#0F172A';
  const textSub = isDark ? '#94A3B8' : '#64748B';
  const inputBg = isDark ? 'rgba(0,0,0,0.3)' : '#FFFFFF';
  const orangeBtn = '#EC7211'; // AWS Console Orange

  const stepsList = [
    { num: 1, label: 'MCP server details' },
    { num: 2, label: 'Authorization Flow' },
    { num: 3, label: 'Authorization Configuration' },
    { num: 4, label: 'Review and submit' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto">
      <div
        className="w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh] border transition-all"
        style={{ backgroundColor: bg, borderColor: borderCol }}
      >
        {/* Top Header & Breadcrumb */}
        <div
          className="px-6 py-3.5 border-b flex items-center justify-between"
          style={{ backgroundColor: cardBg, borderColor: borderCol }}
        >
          <div className="flex items-center gap-2 text-xs font-medium" style={{ color: textSub }}>
            <span className="flex items-center gap-1.5 font-semibold text-blue-500">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
              AWS DevOps Agent
            </span>
            <span>›</span>
            <span>Capability Providers</span>
            <span>›</span>
            <span style={{ color: textCol }} className="font-semibold">
              {currentStep === 5 ? 'Select MCP Server Tools' : 'Register MCP Server'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8">
          {currentStep <= 4 ? (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
              {/* Left Column: Vertical Stepper */}
              <div className="md:col-span-3 flex md:flex-col gap-6 md:border-r pr-4" style={{ borderColor: borderCol }}>
                <div className="flex flex-col gap-8 sticky top-0">
                  {stepsList.map((s, idx) => {
                    const isCompleted = currentStep > s.num;
                    const isActive = currentStep === s.num;
                    return (
                      <div
                        key={s.num}
                        onClick={() => {
                          if (s.num < currentStep) setCurrentStep(s.num);
                        }}
                        className={`flex items-start gap-3.5 relative ${
                          s.num < currentStep ? 'cursor-pointer' : ''
                        }`}
                      >
                        {/* Connecting Line */}
                        {idx < stepsList.length - 1 && (
                          <div
                            className="absolute left-[11px] top-[24px] bottom-[-28px] w-[2px] transition-colors"
                            style={{
                              backgroundColor: isCompleted ? '#3B82F6' : borderCol,
                            }}
                          />
                        )}

                        {/* Step Marker */}
                        <div
                          className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all z-10 ${
                            isCompleted
                              ? 'bg-slate-900 text-white border-2 border-slate-700'
                              : isActive
                              ? 'bg-blue-600 text-white ring-4 ring-blue-500/20'
                              : 'bg-transparent border-2 text-slate-500'
                          }`}
                          style={{
                            borderColor: isActive ? '#3B82F6' : isCompleted ? '#64748B' : borderCol,
                          }}
                        >
                          {isCompleted ? '✓' : s.num}
                        </div>

                        {/* Step Label */}
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-slate-400">Step {s.num}</span>
                          <span
                            className={`text-xs font-semibold leading-tight ${
                              isActive ? 'text-blue-500 font-bold' : isCompleted ? textCol : 'text-slate-500'
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Step Content */}
              <div className="md:col-span-9 flex flex-col gap-6">
                {/* ── STEP 1: MCP Server Details ── */}
                {currentStep === 1 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: textCol }}>
                        MCP server details
                      </h2>
                      <p className="text-xs mt-1" style={{ color: textSub }}>
                        Only MCP servers that implement the Streamable HTTP transport protocol are supported.
                      </p>
                    </div>

                    <div
                      className="p-6 rounded-2xl border flex flex-col gap-5 shadow-xs"
                      style={{ backgroundColor: cardBg, borderColor: borderCol }}
                    >
                      {/* Server Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold" style={{ color: textCol }}>
                          Name
                        </label>
                        <p className="text-[11px]" style={{ color: textSub }}>
                          The name of the MCP server
                        </p>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => {
                            setName(e.target.value);
                            if (e.target.value.trim()) setNameError('');
                          }}
                          placeholder="cloudifyopsAish-devops-mcp"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs transition-all focus:outline-hidden ${
                            nameError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'focus:border-blue-500'
                          }`}
                          style={{
                            backgroundColor: inputBg,
                            borderColor: nameError ? '#F43F5E' : borderCol,
                            color: textCol,
                          }}
                        />
                        {nameError && (
                          <div className="flex items-center gap-1.5 text-xs text-rose-500 mt-0.5">
                            <span className="w-3.5 h-3.5 rounded-full border border-rose-500 flex items-center justify-center text-[10px] font-bold">
                              !
                            </span>
                            <span>{nameError}</span>
                          </div>
                        )}
                      </div>

                      {/* Endpoint URL */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold" style={{ color: textCol }}>
                          Endpoint URL
                        </label>
                        <p className="text-[11px]" style={{ color: textSub }}>
                          The MCP server endpoint URL will be displayed in AWS CloudTrail logs in your account.
                        </p>
                        <input
                          type="url"
                          value={endpointUrl}
                          onChange={(e) => {
                            setEndpointUrl(e.target.value);
                            if (e.target.value.trim()) setEndpointError('');
                          }}
                          placeholder="https://ec2-44-200-223-241.compute-1.amazonaws.com"
                          className={`w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono transition-all focus:outline-hidden ${
                            endpointError ? 'border-rose-500 ring-1 ring-rose-500/50' : 'focus:border-blue-500'
                          }`}
                          style={{
                            backgroundColor: inputBg,
                            borderColor: endpointError ? '#F43F5E' : borderCol,
                            color: textCol,
                          }}
                        />
                        {endpointError && (
                          <p className="text-xs text-rose-500 mt-0.5">{endpointError}</p>
                        )}
                      </div>

                      {/* Description */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-semibold" style={{ color: textCol }}>
                          Description - <span className="font-normal text-slate-400">optional</span>
                        </label>
                        <textarea
                          rows={3}
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          placeholder="Production DevOps Agent MCP server delivering Jira, Slack and Kubernetes orchestration tools."
                          className="w-full px-3.5 py-2.5 rounded-xl border text-xs transition-all focus:outline-hidden focus:border-blue-500"
                          style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                        />
                      </div>

                      {/* Checkboxes */}
                      <div className="flex flex-col gap-3 pt-2 border-t" style={{ borderColor: borderCol }}>
                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={enableDynamicRegistration}
                            onChange={(e) => setEnableDynamicRegistration(e.target.checked)}
                            className="mt-0.5 rounded-sm border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-semibold block" style={{ color: textCol }}>
                              Enable Dynamic Client Registration
                            </span>
                            <span className="text-[11px]" style={{ color: textSub }}>
                              Allow DevOps Agent to automatically register with your MCP's authorization server.
                            </span>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={privateConnection}
                            onChange={(e) => setPrivateConnection(e.target.checked)}
                            className="mt-0.5 rounded-sm border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                          <div>
                            <span className="text-xs font-semibold block" style={{ color: textCol }}>
                              Connect to endpoint using a private connection
                            </span>
                            <span className="text-[11px]" style={{ color: textSub }}>
                              If not checked, the connection will be made over the public internet.
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Collapsible Advanced Configuration */}
                      <div className="pt-2 border-t" style={{ borderColor: borderCol }}>
                        <button
                          type="button"
                          onClick={() => setAdvancedOpen(!advancedOpen)}
                          className="flex items-center gap-2 text-xs font-bold hover:underline cursor-pointer"
                          style={{ color: textCol }}
                        >
                          <span className="text-[10px]">{advancedOpen ? '▼' : '▶'}</span>
                          <span>Advanced configuration</span>
                        </button>

                        {advancedOpen && (
                          <div className="mt-3 pl-4 flex flex-col gap-3 animate-in fade-in duration-150">
                            <div className="flex flex-col gap-1 max-w-xs">
                              <label className="text-[11px] font-semibold" style={{ color: textSub }}>
                                Request Timeout (seconds)
                              </label>
                              <input
                                type="number"
                                value={timeoutSecs}
                                onChange={(e) => setTimeoutSecs(e.target.value)}
                                className="px-3 py-1.5 rounded-lg border text-xs"
                                style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                              />
                            </div>
                            <p className="text-[11px]" style={{ color: textSub }}>
                              Transport: Streamable HTTP (SSE) protocol enabled by default.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: borderCol }}>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textSub }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleNextFromStep1}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:opacity-95"
                        style={{ backgroundColor: orangeBtn }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: Authorization Flow ── */}
                {currentStep === 2 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: textCol }}>
                        Authorization Flow
                      </h2>
                      <p className="text-xs mt-1" style={{ color: textSub }}>
                        DevOps Agent supports the following authorization flows.
                      </p>
                    </div>

                    <div
                      className="p-6 rounded-2xl border flex flex-col gap-3.5 shadow-xs"
                      style={{ backgroundColor: cardBg, borderColor: borderCol }}
                    >
                      {[
                        {
                          id: 'oauth_cc' as const,
                          title: 'OAuth Client Credentials',
                          desc: 'Uses a client ID and secret to enable server to server authentication.',
                        },
                        {
                          id: 'oauth_3lo' as const,
                          title: 'OAuth 3LO',
                          desc: 'Directs users to their identity provider’s sign in to grant access via token.',
                        },
                        {
                          id: 'api_key' as const,
                          title: 'API Key',
                          desc: 'Authenticates the calling application itself to provide simple one-way access without redirects or consent flows.',
                        },
                        {
                          id: 'multi_header' as const,
                          title: 'Multi auth headers',
                          desc: 'Sends secrets in headers you name. Use for servers that need more than 1 API key (for example Datadog DD-API-KEY and DD-APPLICATION-KEY).',
                        },
                        {
                          id: 'sigv4' as const,
                          title: 'AWS SigV4',
                          desc: 'Uses AWS IAM role-based authentication with SigV4 signing.',
                        },
                      ].map((flow) => {
                        const isSelected = authFlow === flow.id;
                        return (
                          <label
                            key={flow.id}
                            onClick={() => setAuthFlow(flow.id)}
                            className={`p-4 rounded-xl border flex items-start gap-3.5 cursor-pointer transition-all ${
                              isSelected
                                ? 'border-blue-500 bg-blue-500/10 ring-1 ring-blue-500/40'
                                : 'hover:border-slate-600 bg-slate-900/20'
                            }`}
                            style={{ borderColor: isSelected ? '#3B82F6' : borderCol }}
                          >
                            <input
                              type="radio"
                              name="authFlowGroup"
                              checked={isSelected}
                              onChange={() => setAuthFlow(flow.id)}
                              className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <div className="text-xs font-bold" style={{ color: textCol }}>
                                {flow.title}
                              </div>
                              <div className="text-[11px] mt-0.5 leading-relaxed" style={{ color: textSub }}>
                                {flow.desc}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: borderCol }}>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textSub }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(1)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textCol }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:opacity-95"
                        style={{ backgroundColor: orangeBtn }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: Authorization Configuration ── */}
                {currentStep === 3 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: textCol }}>
                        Authorization Configuration
                      </h2>
                      <p className="text-xs mt-1" style={{ color: textSub }}>
                        Enter the authorization configuration details for your MCP server.
                      </p>
                    </div>

                    <div
                      className="p-6 rounded-2xl border flex flex-col gap-5 shadow-xs"
                      style={{ backgroundColor: cardBg, borderColor: borderCol }}
                    >
                      {authFlow === 'api_key' && (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              API Key Name
                            </label>
                            <p className="text-[11px]" style={{ color: textSub }}>
                              User friendly API key name specified by end user
                            </p>
                            <input
                              type="text"
                              value={apiKeyName}
                              onChange={(e) => setApiKeyName(e.target.value)}
                              placeholder="cloudifyops-api-key"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs focus:outline-hidden focus:border-blue-500"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              API Key Header
                            </label>
                            <p className="text-[11px]" style={{ color: textSub }}>
                              API Key Header name expected by the service
                            </p>
                            <input
                              type="text"
                              value={apiKeyHeader}
                              onChange={(e) => setApiKeyHeader(e.target.value)}
                              placeholder="X-API-Key"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-hidden focus:border-blue-500"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              API Key Value
                            </label>
                            <p className="text-[11px]" style={{ color: textSub }}>
                              API key value for authenticating with the service
                            </p>
                            <input
                              type="password"
                              value={apiKeyValue}
                              onChange={(e) => setApiKeyValue(e.target.value)}
                              placeholder="••••••••••••••••••••••••"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono focus:outline-hidden focus:border-blue-500"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                        </>
                      )}

                      {authFlow === 'oauth_cc' && (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              Client ID
                            </label>
                            <input
                              type="text"
                              value={clientId}
                              onChange={(e) => setClientId(e.target.value)}
                              placeholder="mcp-client-id-9941"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              Client Secret
                            </label>
                            <input
                              type="password"
                              value={clientSecret}
                              onChange={(e) => setClientSecret(e.target.value)}
                              placeholder="••••••••••••••••"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              Token URL
                            </label>
                            <input
                              type="url"
                              value={tokenUrl}
                              onChange={(e) => setTokenUrl(e.target.value)}
                              placeholder="https://auth.cloudifyops.com/oauth2/token"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                        </>
                      )}

                      {authFlow === 'sigv4' && (
                        <>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              IAM Role ARN
                            </label>
                            <input
                              type="text"
                              value={roleArn}
                              onChange={(e) => setRoleArn(e.target.value)}
                              placeholder="arn:aws:iam::124890123456:role/DevOpsAgentMcpRole"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              AWS Region
                            </label>
                            <input
                              type="text"
                              value={region}
                              onChange={(e) => setRegion(e.target.value)}
                              placeholder="us-east-1"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                        </>
                      )}

                      {authFlow === 'multi_header' && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              Header Name
                            </label>
                            <input
                              type="text"
                              value={customHeaderKey}
                              onChange={(e) => setCustomHeaderKey(e.target.value)}
                              placeholder="DD-API-KEY"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold" style={{ color: textCol }}>
                              Header Value
                            </label>
                            <input
                              type="password"
                              value={customHeaderVal}
                              onChange={(e) => setCustomHeaderVal(e.target.value)}
                              placeholder="••••••••••••••••"
                              className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                              style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                            />
                          </div>
                        </div>
                      )}

                      {authFlow === 'oauth_3lo' && (
                        <div className="flex flex-col gap-3 text-xs" style={{ color: textSub }}>
                          <p>
                            OAuth 3LO user consent will be initialized on first agent tool dispatch.
                          </p>
                          <input
                            type="text"
                            value={clientId}
                            onChange={(e) => setClientId(e.target.value)}
                            placeholder="OAuth Client ID"
                            className="w-full px-3.5 py-2.5 rounded-xl border text-xs font-mono"
                            style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                          />
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: borderCol }}>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textSub }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(2)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textCol }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(4)}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:opacity-95"
                        style={{ backgroundColor: orangeBtn }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: Review and Submit ── */}
                {currentStep === 4 && (
                  <div className="flex flex-col gap-6">
                    <div>
                      <h2 className="text-xl font-bold" style={{ color: textCol }}>
                        Review and submit
                      </h2>
                      <p className="text-xs mt-1" style={{ color: textSub }}>
                        Review your MCP server details and authorization configuration and submit.
                      </p>
                    </div>

                    {/* Card 1: MCP Server Details */}
                    <div
                      className="p-6 rounded-2xl border flex flex-col gap-4 shadow-xs"
                      style={{ backgroundColor: cardBg, borderColor: borderCol }}
                    >
                      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: borderCol }}>
                        <h3 className="text-sm font-bold" style={{ color: textCol }}>
                          MCP Server Details
                        </h3>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(1)}
                          className="px-3 py-1 rounded-lg border text-xs font-semibold text-blue-500 hover:bg-blue-500/10 cursor-pointer transition-colors"
                          style={{ borderColor: '#3B82F6' }}
                        >
                          Edit
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="font-semibold block text-slate-400 text-[11px] mb-1">Name</span>
                          <span className="font-medium text-white break-all">{name || 'cloudifyopsAish-devops-mcp'}</span>
                        </div>
                        <div>
                          <span className="font-semibold block text-slate-400 text-[11px] mb-1">Endpoint</span>
                          <span className="font-mono text-white break-all">
                            {endpointUrl || 'https://ec2-44-200-223-241.compute-1.amazonaws.com'}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold block text-slate-400 text-[11px] mb-1">Description</span>
                          <span className="italic text-slate-300">{description || 'Not Provided'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Authorization Configuration */}
                    <div
                      className="p-6 rounded-2xl border flex flex-col gap-4 shadow-xs"
                      style={{ backgroundColor: cardBg, borderColor: borderCol }}
                    >
                      <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: borderCol }}>
                        <h3 className="text-sm font-bold" style={{ color: textCol }}>
                          Authorization Configuration
                        </h3>
                        <button
                          type="button"
                          onClick={() => setCurrentStep(3)}
                          className="px-3 py-1 rounded-lg border text-xs font-semibold text-blue-500 hover:bg-blue-500/10 cursor-pointer transition-colors"
                          style={{ borderColor: '#3B82F6' }}
                        >
                          Edit
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="font-semibold block text-slate-400 text-[11px] mb-1">Flow Type</span>
                          <span className="font-medium text-white uppercase text-[11px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 w-fit">
                            {authFlow.replace('_', ' ')}
                          </span>
                        </div>
                        <div>
                          <span className="font-semibold block text-slate-400 text-[11px] mb-1">API Key Name</span>
                          <span className="font-medium text-white">{apiKeyName || 'cloudifyops-api-key'}</span>
                        </div>
                        <div>
                          <span className="font-semibold block text-slate-400 text-[11px] mb-1">API Key Value</span>
                          <span className="italic text-slate-400 font-mono">
                            {apiKeyValue ? '••••••••••••••••' : 'Not Provided'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t" style={{ borderColor: borderCol }}>
                      <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textSub }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentStep(3)}
                        className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                        style={{ borderColor: borderCol, color: textCol }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={handleFinishStep4}
                        className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:opacity-95"
                        style={{ backgroundColor: orangeBtn }}
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── STEP 5: Select MCP Server Tools (Image 5) ── */
            <div className="flex flex-col gap-6">
              <div>
                <h2 className="text-xl font-bold" style={{ color: textCol }}>
                  Select MCP server tools
                </h2>
              </div>

              {/* Information Guidance Alert */}
              <div
                className="p-4 rounded-xl border flex items-start gap-3 text-xs leading-relaxed"
                style={{
                  backgroundColor: isDark ? 'rgba(59,130,246,0.1)' : '#EFF6FF',
                  borderColor: isDark ? 'rgba(59,130,246,0.3)' : '#BFDBFE',
                  color: isDark ? '#93C5FD' : '#1E40AF',
                }}
              >
                <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0 font-serif italic text-xs font-bold">
                  i
                </div>
                <div>
                  Tool classification determines how the agent handles each tool during execution. The agent
                  executes <span className="font-bold underline">Read only</span> tools automatically without
                  approval. <span className="font-bold underline">Mutative</span> tools require your explicit
                  approval before the agent executes them. The agent does not execute{' '}
                  <span className="font-bold underline">Destructive</span> tools regardless of configuration.
                </div>
              </div>

              {/* Table Card */}
              <div
                className="p-6 rounded-2xl border flex flex-col gap-4 shadow-xs"
                style={{ backgroundColor: cardBg, borderColor: borderCol }}
              >
                <div className="flex items-center justify-between flex-wrap gap-4 pb-2">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: textCol }}>
                      MCP server tools ({enabledToolsCount} / {tools.length})
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: textSub }}>
                      Select which tools from your MCP server you would like DevOps Agent to use.
                    </p>
                  </div>

                  {/* Search Bar */}
                  <div className="relative w-64">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                    </span>
                    <input
                      type="text"
                      value={toolSearch}
                      onChange={(e) => setToolSearch(e.target.value)}
                      placeholder="Find tools"
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border text-xs focus:outline-hidden focus:border-blue-500"
                      style={{ backgroundColor: inputBg, borderColor: borderCol, color: textCol }}
                    />
                  </div>
                </div>

                {/* Tools Table */}
                <div className="border rounded-xl overflow-hidden" style={{ borderColor: borderCol }}>
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className="border-b font-semibold"
                        style={{
                          backgroundColor: isDark ? 'rgba(0,0,0,0.2)' : '#F1F5F9',
                          borderColor: borderCol,
                          color: textSub,
                        }}
                      >
                        <th className="py-2.5 px-4 w-10">
                          <input
                            type="checkbox"
                            checked={tools.length > 0 && tools.every((t) => t.enabled)}
                            onChange={toggleAllTools}
                            className="rounded-sm border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </th>
                        <th className="py-2.5 px-4">Tool</th>
                        <th className="py-2.5 px-4 text-right w-44">Classification</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: borderCol }}>
                      {filteredTools.map((tool) => (
                        <tr
                          key={tool.id}
                          className="hover:bg-slate-800/20 transition-colors"
                          style={{ borderColor: borderCol }}
                        >
                          <td className="py-2.5 px-4">
                            <input
                              type="checkbox"
                              checked={tool.enabled}
                              onChange={() => toggleTool(tool.id)}
                              className="rounded-sm border-slate-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-4 font-mono text-xs" style={{ color: textCol }}>
                            {tool.name}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <select
                              value={tool.classification}
                              onChange={(e) =>
                                updateClassification(tool.id, e.target.value as any)
                              }
                              className="px-2.5 py-1 rounded-lg border text-xs font-semibold cursor-pointer focus:outline-hidden"
                              style={{
                                backgroundColor: inputBg,
                                borderColor:
                                  tool.classification === 'Mutative'
                                    ? '#D97706'
                                    : tool.classification === 'Destructive'
                                    ? '#DC2626'
                                    : borderCol,
                                color:
                                  tool.classification === 'Mutative'
                                    ? '#F59E0B'
                                    : tool.classification === 'Destructive'
                                    ? '#EF4444'
                                    : textCol,
                              }}
                            >
                              <option value="Read only">Read only</option>
                              <option value="Mutative">Mutative</option>
                              <option value="Destructive">Destructive</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Step 5 Footer */}
              <div className="flex items-center justify-between pt-4 border-t" style={{ borderColor: borderCol }}>
                <button
                  type="button"
                  onClick={() => setCurrentStep(4)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                  style={{ borderColor: borderCol, color: textCol }}
                >
                  Previous
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{ borderColor: borderCol, color: textSub }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleFinalSave}
                    className="px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md cursor-pointer hover:opacity-95"
                    style={{ backgroundColor: orangeBtn }}
                  >
                    Save & Enable Tools
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
