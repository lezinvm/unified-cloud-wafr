import { useState, useEffect } from 'react';
import { useApp, LIGHT, DARK, Tokens } from '../context';
import { AppLayout } from '../components/AppLayout';
import { api } from '../services/apiClient';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  organization: string;
  status: 'Active' | 'Inactive' | 'Pending';
  plan: 'Enterprise' | 'Pro' | 'Starter' | 'Custom';
  costUsage: number;
  tokenUsage: number;
  projects: string[];
  createdAt: string;
  lastActive: string;
}

const INITIAL_USERS: AdminUser[] = [];

export function Admin() {
  const { theme, adminTab, setAdminTab } = useApp();
  const isDark = theme === 'dark';
  const T: Tokens = isDark ? DARK : LIGHT;

  const [users, setUsers] = useState<AdminUser[]>([]);

  // Sync users with MongoDB on mount
  useEffect(() => {
    api.getUsers()
      .then(dbUsers => {
        if (Array.isArray(dbUsers)) {
          setUsers(dbUsers);
        }
      })
      .catch(err => console.warn('Could not load users from MongoDB:', err));
  }, []);

  // Filters for User Management tab
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive' | 'Pending'>('All');
  const [planFilter, setPlanFilter] = useState<'All' | 'Enterprise' | 'Pro' | 'Starter' | 'Custom'>('All');

  // Add User Modal State
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newOrganization, setNewOrganization] = useState('CloudifyOps');
  const [newPlan, setNewPlan] = useState<'Enterprise' | 'Pro' | 'Starter' | 'Custom'>('Enterprise');
  const [newBudget, setNewBudget] = useState('50.00');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Actions menu state
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  // Reset Password Modal / Notification State
  const [resetModalUser, setResetModalUser] = useState<AdminUser | null>(null);
  const [resetNotification, setResetNotification] = useState<string | null>(null);

  // Delete / Offboard Modal State
  const [offboardUser, setOffboardUser] = useState<AdminUser | null>(null);

  // Edit User Modal State
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Token & AI Quota Tab State
  const [selectedTokenUser, setSelectedTokenUser] = useState<string>('all');
  const [tokenTimeframe, setTokenTimeframe] = useState<'weekly' | 'monthly'>('weekly');

  // Handlers
  const handleCreateUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newEmail.trim() || !newName.trim()) return;

    const newUserObj: AdminUser = {
      id: `usr-${Date.now().toString().slice(-4)}`,
      name: newName.trim(),
      email: newEmail.trim(),
      organization: newOrganization.trim() || 'CloudifyOps',
      status: 'Active',
      plan: newPlan,
      costUsage: 0.0,
      tokenUsage: 0,
      projects: [],
      createdAt: 'Sep 21, 2026',
      lastActive: 'Just now',
    };

    setUsers([newUserObj, ...users]);
    api.saveUser(newUserObj).catch(err => console.warn('Could not persist user to MongoDB:', err));
    setNewEmail('');
    setNewName('');
    setNewOrganization('CloudifyOps');
    setNewPassword('');
    setAddUserModalOpen(false);
  };

  const handleSaveEditUser = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!editingUser) return;
    setUsers(users.map(u => u.id === editingUser.id ? editingUser : u));
    api.saveUser(editingUser).catch(err => console.warn('Could not update user in MongoDB:', err));
    setEditingUser(null);
  };

  const handleConfirmOffboard = () => {
    if (!offboardUser) return;
    setUsers(users.filter(u => u.id !== offboardUser.id));
    api.deleteUser(offboardUser.id).catch(err => console.warn('Could not delete user from MongoDB:', err));
    setOffboardUser(null);
    setActiveMenuUserId(null);
  };

  const handleToggleStatus = (userId: string) => {
    setUsers(users.map(u => {
      if (u.id === userId) {
        const nextStatus: AdminUser['status'] = u.status === 'Active' ? 'Inactive' : 'Active';
        return { ...u, status: nextStatus };
      }
      return u;
    }));
    setActiveMenuUserId(null);
  };

  const handleSendResetPassword = (user: AdminUser) => {
    setResetModalUser(null);
    setActiveMenuUserId(null);
    setResetNotification(`Password reset instructions and secure one-time link dispatched to ${user.email}`);
    setTimeout(() => setResetNotification(null), 5000);
  };

  // Filtered Users List
  const filteredUsers = users.filter(user => {
    if (statusFilter !== 'All' && user.status !== statusFilter) return false;
    if (planFilter !== 'All' && user.plan !== planFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      return user.name.toLowerCase().includes(q) || user.email.toLowerCase().includes(q) || user.organization.toLowerCase().includes(q);
    }
    return true;
  });

  const totalUsersCount = users.length;
  const activeUsersCount = users.filter(u => u.status === 'Active').length;
  const inactiveUsersCount = users.filter(u => u.status === 'Inactive').length;
  const uniqueOrganizationsCount = new Set(users.map(u => u.organization)).size;
  const enterpriseCount = users.filter(u => u.plan === 'Enterprise').length;
  const proCount = users.filter(u => u.plan === 'Pro').length;
  const starterCount = users.filter(u => u.plan === 'Starter').length;
  const customCount = users.filter(u => u.plan === 'Custom').length;
  const totalCostUsage = users.reduce((sum, u) => sum + u.costUsage, 0);
  const totalTokensConsumed = users.reduce((sum, u) => sum + u.tokenUsage, 0);
  const avgCostPerUser = totalUsersCount > 0 ? (totalCostUsage / totalUsersCount).toFixed(2) : '0.00';

  // Token Tab Selected User Profile
  const tokenTargetUser = selectedTokenUser === 'all' ? null : users.find(u => u.id === selectedTokenUser);
  const targetTotalTokens = tokenTargetUser ? tokenTargetUser.tokenUsage : totalTokensConsumed;
  const targetTotalCost = tokenTargetUser ? tokenTargetUser.costUsage : totalCostUsage;

  // Model-specific usage breakdown
  const modelBreakdown = [
    {
      model: 'GPT-4o Reasoning',
      provider: 'OpenAI',
      tokens: Math.round(targetTotalTokens * 0.56),
      cost: Number((targetTotalCost * 0.68).toFixed(2)),
      color: '#10B981',
      share: 56,
      purpose: 'WAFR evaluation, architectural reasoning & report generation',
    },
    {
      model: 'Claude 3.5 Sonnet',
      provider: 'Anthropic',
      tokens: Math.round(targetTotalTokens * 0.32),
      cost: Number((targetTotalCost * 0.24).toFixed(2)),
      color: '#3B82F6',
      share: 32,
      purpose: 'Infrastructure as Code (IaC) & Terraform remediation scripts',
    },
    {
      model: 'Gemini 1.5 Pro',
      provider: 'Google Cloud',
      tokens: Math.round(targetTotalTokens * 0.12),
      cost: Number((targetTotalCost * 0.08).toFixed(2)),
      color: '#8B5CF6',
      share: 12,
      purpose: 'Architecture diagrams, topology parsing & vision analysis',
    },
  ];

  // Weekly and Monthly time series data
  const weeklyData = [
    { label: 'Mon', tokens: Math.round(targetTotalTokens * 0.12), cost: Number((targetTotalCost * 0.12).toFixed(2)) },
    { label: 'Tue', tokens: Math.round(targetTotalTokens * 0.16), cost: Number((targetTotalCost * 0.16).toFixed(2)) },
    { label: 'Wed', tokens: Math.round(targetTotalTokens * 0.18), cost: Number((targetTotalCost * 0.18).toFixed(2)) },
    { label: 'Thu', tokens: Math.round(targetTotalTokens * 0.22), cost: Number((targetTotalCost * 0.22).toFixed(2)) },
    { label: 'Fri', tokens: Math.round(targetTotalTokens * 0.20), cost: Number((targetTotalCost * 0.20).toFixed(2)) },
    { label: 'Sat', tokens: Math.round(targetTotalTokens * 0.06), cost: Number((targetTotalCost * 0.06).toFixed(2)) },
    { label: 'Sun', tokens: Math.round(targetTotalTokens * 0.06), cost: Number((targetTotalCost * 0.06).toFixed(2)) },
  ];

  const monthlyData = [
    { label: 'Week 1 (Sep 1-7)', tokens: Math.round(targetTotalTokens * 0.22), cost: Number((targetTotalCost * 0.22).toFixed(2)) },
    { label: 'Week 2 (Sep 8-14)', tokens: Math.round(targetTotalTokens * 0.26), cost: Number((targetTotalCost * 0.26).toFixed(2)) },
    { label: 'Week 3 (Sep 15-21)', tokens: Math.round(targetTotalTokens * 0.34), cost: Number((targetTotalCost * 0.34).toFixed(2)) },
    { label: 'Week 4 (Projected)', tokens: Math.round(targetTotalTokens * 0.18), cost: Number((targetTotalCost * 0.18).toFixed(2)) },
  ];

  const currentChartData = tokenTimeframe === 'weekly' ? weeklyData : monthlyData;
  const maxChartTokens = Math.max(...currentChartData.map(d => d.tokens), 1);

  return (
    <AppLayout>
      <div
        className="flex flex-col h-full overflow-y-auto"
        style={{
          backgroundColor: T.bg,
          color: T.text,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        <div className="max-w-7xl w-full mx-auto p-5 sm:p-7 flex flex-col gap-6">

          {/* Reset password notification toast */}
          {resetNotification && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span>{resetNotification}</span>
              </div>
              <button
                type="button"
                onClick={() => setResetNotification(null)}
                className="text-emerald-600 dark:text-emerald-400 hover:opacity-80 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* ── TAB SELECTOR: Users vs Token Usage vs Settings vs Audit ── */}
          <div className="flex items-center gap-2 border-b pb-2 flex-wrap" style={{ borderColor: T.border }}>
            <button
              type="button"
              onClick={() => setAdminTab('users')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                adminTab === 'users'
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span>Clients & Users ({users.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setAdminTab('tokens')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                adminTab === 'tokens'
                  ? 'bg-blue-600 text-white shadow-md'
                  : isDark
                  ? 'text-slate-400 hover:text-white hover:bg-slate-800/40'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
              <span>Token & AI Quotas</span>
            </button>
          </div>

          {/* ── TAB 1: USERS & CLIENT MANAGEMENT ── */}
          {adminTab === 'users' && (
            <div className="flex flex-col gap-6">

              {/* Tab 1 Dedicated KPI Cards: Strictly User & Client Management Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Users / Clients */}
                <div
                  className="p-5 rounded-2xl border flex items-center justify-between"
                  style={{
                    backgroundColor: T.card,
                    borderColor: T.border,
                    boxShadow: T.shadow,
                  }}
                >
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Total Clients & Users
                    </div>
                    <div className="text-2xl font-bold font-mono" style={{ color: T.text }}>
                      {totalUsersCount}
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>
                      Registered accounts in tenant
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-blue-600/15 text-blue-500 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                  </div>
                </div>

                {/* Card 2: Active vs Inactive */}
                <div
                  className="p-5 rounded-2xl border flex items-center justify-between"
                  style={{
                    backgroundColor: T.card,
                    borderColor: T.border,
                    boxShadow: T.shadow,
                  }}
                >
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Active Accounts
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-500 flex items-baseline gap-2">
                      <span>{activeUsersCount}</span>
                      <span className="text-xs font-normal" style={{ color: T.muted }}>active ({inactiveUsersCount} inactive)</span>
                    </div>
                    <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                      {Math.round((activeUsersCount / (totalUsersCount || 1)) * 100)}% active platform engagement
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-emerald-600/15 text-emerald-500 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <polyline points="16 11 18 13 22 9" />
                    </svg>
                  </div>
                </div>

                {/* Card 3: Subscription Tier Breakdown */}
                <div
                  className="p-5 rounded-2xl border flex items-center justify-between"
                  style={{
                    backgroundColor: T.card,
                    borderColor: T.border,
                    boxShadow: T.shadow,
                  }}
                >
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Subscription Tiers
                    </div>
                    <div className="text-2xl font-bold font-mono" style={{ color: T.text }}>
                      {enterpriseCount + proCount} <span className="text-xs font-normal text-purple-500">Pro/Enterprise</span>
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>
                      {enterpriseCount} Enterprise · {proCount} Pro · {starterCount} Starter
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-purple-600/15 text-purple-400 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </div>
                </div>

                {/* Card 4: Client Organizations */}
                <div
                  className="p-5 rounded-2xl border flex items-center justify-between"
                  style={{
                    backgroundColor: T.card,
                    borderColor: T.border,
                    boxShadow: T.shadow,
                  }}
                >
                  <div>
                    <div className="text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Client Organizations
                    </div>
                    <div className="text-2xl font-bold font-mono" style={{ color: T.text }}>
                      {uniqueOrganizationsCount} Organizations
                    </div>
                    <div className="text-[11px] mt-0.5" style={{ color: T.muted }}>
                      Active multi-tenant client accounts
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/15 text-indigo-400 flex items-center justify-center">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 21v-4h6v4M9 7h6M9 11h6M9 15h6" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* User Directory Table Container */}
              <div
                className="rounded-2xl border flex flex-col overflow-hidden shadow-xl"
                style={{
                  backgroundColor: T.card,
                  borderColor: T.border,
                }}
              >
                {/* Filter Controls Bar */}
                <div
                  className="p-4 border-b flex items-center justify-between gap-3 flex-wrap"
                  style={{
                    backgroundColor: isDark ? '#141D2E' : '#F9FAFB',
                    borderColor: T.border,
                  }}
                >
                  <div className="flex items-center gap-2.5 flex-wrap flex-1 min-w-[280px]">
                    {/* Search Bar */}
                    <div className="relative flex items-center flex-1 min-w-[220px]">
                      <span className="absolute left-3 text-slate-400 pointer-events-none">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8" />
                          <line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                      </span>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search users by name, email..."
                        className="w-full pl-9 pr-3 py-1.5 rounded-xl text-xs border outline-none transition-colors"
                        style={{
                          backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                          borderColor: isDark ? '#334155' : '#D1D5DB',
                          color: T.text,
                        }}
                      />
                    </div>

                    {/* Status Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Status:</span>
                      <select
                        value={statusFilter}
                        onChange={e => setStatusFilter(e.target.value as any)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                          borderColor: isDark ? '#334155' : '#D1D5DB',
                          color: T.text,
                        }}
                      >
                        <option value="All">All Statuses ({users.length})</option>
                        <option value="Active">Active ({activeUsersCount})</option>
                        <option value="Inactive">Inactive ({inactiveUsersCount})</option>
                        <option value="Pending">Pending (0)</option>
                      </select>
                    </div>

                    {/* Plan Dropdown */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold" style={{ color: T.textSub }}>Plan:</span>
                      <select
                        value={planFilter}
                        onChange={e => setPlanFilter(e.target.value as any)}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold border outline-none cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                          borderColor: isDark ? '#334155' : '#D1D5DB',
                          color: T.text,
                        }}
                      >
                        <option value="All">All Plans</option>
                        <option value="Enterprise">Enterprise</option>
                        <option value="Pro">Pro</option>
                        <option value="Starter">Starter</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                  </div>

                  {/* + Onboard / Add User Button */}
                  <button
                    type="button"
                    onClick={() => setAddUserModalOpen(true)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>Onboard New User</span>
                  </button>
                </div>

                {/* Users Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className="border-b font-semibold"
                        style={{
                          backgroundColor: isDark ? '#141D2E' : '#F8FAFC',
                          borderColor: T.border,
                          color: T.textSub,
                        }}
                      >
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Plan</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Organization</th>
                        <th className="py-3 px-4">Workloads & Scopes</th>
                        <th className="py-3 px-4">Created At & Activity</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y"
                      style={{ borderColor: T.border }}
                    >
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center" style={{ color: T.muted }}>
                            No users found matching your filters.
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(user => {
                          const isActive = user.status === 'Active';
                          return (
                            <tr
                              key={user.id}
                              className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}
                              style={{ borderColor: T.border }}
                            >
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                                    {user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-semibold" style={{ color: T.text }}>
                                      {user.name}
                                    </div>
                                    <div className="text-[11px] font-mono" style={{ color: T.muted }}>{user.email}</div>
                                  </div>
                                </div>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    user.plan === 'Enterprise'
                                      ? isDark ? 'bg-purple-500/15 text-purple-300 border-purple-500/30' : 'bg-purple-100 text-purple-700 border-purple-200'
                                      : user.plan === 'Pro'
                                      ? isDark ? 'bg-blue-500/15 text-blue-300 border-blue-500/30' : 'bg-blue-100 text-blue-700 border-blue-200'
                                      : user.plan === 'Custom'
                                      ? isDark ? 'bg-amber-500/15 text-amber-300 border-amber-500/30' : 'bg-amber-100 text-amber-700 border-amber-200'
                                      : isDark ? 'bg-slate-500/15 text-slate-300 border-slate-500/30' : 'bg-slate-100 text-slate-700 border-slate-200'
                                  }`}
                                >
                                  {user.plan}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <span
                                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                                    isActive
                                      ? isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                      : isDark ? 'bg-slate-500/10 text-slate-400 border-slate-500/30' : 'bg-slate-100 text-slate-600 border-slate-200'
                                  }`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full ${isActive ? (isDark ? 'bg-emerald-400' : 'bg-emerald-600') : (isDark ? 'bg-slate-400' : 'bg-slate-500')}`} />
                                  {user.status}
                                </span>
                              </td>

                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-1.5 font-medium" style={{ color: T.textSub }}>
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500 shrink-0">
                                    <path d="M3 21h18M3 7v14M21 7v14M6 7V3h12v4M9 21v-4h6v4M9 7h6M9 11h6M9 15h6"/>
                                  </svg>
                                  <span>{user.organization}</span>
                                </div>
                              </td>

                              <td className="py-3.5 px-4" style={{ color: T.textSub }}>
                                {user.projects.length > 0 ? (
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-xs text-blue-500 font-medium">{user.projects[0]}</span>
                                    {user.projects.length > 1 && (
                                      <span
                                        className="text-[10px] px-1.5 py-0.5 rounded border"
                                        style={{
                                          backgroundColor: isDark ? '#1C2638' : '#F1F5F9',
                                          color: T.muted,
                                          borderColor: T.border,
                                        }}
                                      >
                                        +{user.projects.length - 1} more
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-[11px] italic" style={{ color: T.muted }}>No active reviews</span>
                                )}
                              </td>

                              <td className="py-3.5 px-4 font-mono text-[11px]" style={{ color: T.muted }}>
                                <div style={{ color: T.textSub }}>{user.createdAt}</div>
                                <div className="text-[10px]">Active: {user.lastActive}</div>
                              </td>

                              <td className="py-3.5 px-4 text-right relative">
                                <button
                                  type="button"
                                  onClick={() => setActiveMenuUserId(activeMenuUserId === user.id ? null : user.id)}
                                  className={`w-8 h-8 rounded-lg inline-flex items-center justify-center cursor-pointer transition-colors ${
                                    isDark
                                      ? 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                  }`}
                                  title="Actions menu"
                                  aria-label="User actions"
                                >
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                  </svg>
                                </button>

                                {/* 3-Dot Actions Dropdown */}
                                {activeMenuUserId === user.id && (
                                  <div
                                    className="absolute right-4 top-10 w-48 rounded-xl border p-1 shadow-2xl z-30 flex flex-col text-left text-xs animate-fadeIn"
                                    style={{
                                      backgroundColor: isDark ? '#162032' : '#FFFFFF',
                                      borderColor: T.border,
                                      boxShadow: T.shadow,
                                    }}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setResetModalUser(user);
                                        setActiveMenuUserId(null);
                                      }}
                                      className={`px-3 py-2 rounded-lg text-left cursor-pointer flex items-center gap-2 transition-colors ${
                                        isDark ? 'text-slate-200 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                      </svg>
                                      <span>Reset Password</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleStatus(user.id)}
                                      className={`px-3 py-2 rounded-lg text-left cursor-pointer flex items-center gap-2 transition-colors ${
                                        isDark ? 'text-slate-200 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18.36 6.64a9 9 0 1 1-12.73 0"/>
                                        <line x1="12" y1="2" x2="12" y2="12"/>
                                      </svg>
                                      <span>{user.status === 'Active' ? 'Deactivate User' : 'Activate User'}</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedTokenUser(user.id);
                                        setAdminTab('tokens');
                                        setActiveMenuUserId(null);
                                      }}
                                      className={`px-3 py-2 rounded-lg text-left cursor-pointer flex items-center gap-2 transition-colors ${
                                        isDark ? 'text-slate-200 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="1" x2="12" y2="23" />
                                        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                                      </svg>
                                      <span>View AI & Cost Usage</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingUser(user);
                                        setActiveMenuUserId(null);
                                      }}
                                      className={`px-3 py-2 rounded-lg text-left cursor-pointer flex items-center gap-2 transition-colors ${
                                        isDark ? 'text-slate-200 hover:bg-slate-700/60' : 'text-slate-700 hover:bg-slate-100'
                                      }`}
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 20h9"/>
                                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                      </svg>
                                      <span>Edit User & Plan</span>
                                    </button>

                                    <div className="h-px my-1" style={{ backgroundColor: T.border }} />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOffboardUser(user);
                                        setActiveMenuUserId(null);
                                      }}
                                      className="px-3 py-2 rounded-lg text-rose-500 hover:bg-rose-500/10 text-left cursor-pointer font-semibold flex items-center gap-2 transition-colors"
                                    >
                                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                      <span>Offboard / Delete</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── TAB 2: TOKEN & AI QUOTAS ── */}
          {adminTab === 'tokens' && (
            <div className="flex flex-col gap-6">

              {/* Header with User Filter Selector */}
              <div
                className="p-6 rounded-2xl border shadow-sm flex flex-col gap-5"
                style={{
                  backgroundColor: T.card,
                  borderColor: T.border,
                }}
              >
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div>
                    <h2 className="text-base font-bold flex items-center gap-2" style={{ color: T.text }}>
                      <span>AI Token Consumption & Cost Overview</span>
                      {tokenTargetUser && (
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-500 border border-blue-500/30">
                          Viewing: {tokenTargetUser.name}
                        </span>
                      )}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                      Monitor multi-model token throughput, per-user cost allocation, and automated remediation spend.
                    </p>
                  </div>

                  {/* Filter by User Dropdown */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold" style={{ color: T.textSub }}>Filter by User:</span>
                    <select
                      value={selectedTokenUser}
                      onChange={e => setSelectedTokenUser(e.target.value)}
                      className="px-3.5 py-2 rounded-xl text-xs font-semibold border outline-none cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                      aria-label="Filter token usage by user"
                    >
                      <option value="all">All Users & Clients ({users.length})</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.name} (${u.costUsage.toFixed(2)} spend)
                        </option>
                      ))}
                    </select>

                    {selectedTokenUser !== 'all' && (
                      <button
                        type="button"
                        onClick={() => setSelectedTokenUser('all')}
                        className="px-2.5 py-2 rounded-xl text-xs font-semibold border cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                          borderColor: T.border,
                          color: T.textSub,
                        }}
                        title="Reset to all users"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Tab 2 Dedicated KPI Cards: Strictly AI, Tokens & Spend */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
                  <div
                    className="p-4 rounded-xl border flex flex-col gap-1"
                    style={{
                      backgroundColor: isDark ? '#162032' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: T.textSub }}>Total Tokens Consumed</span>
                    <span className="text-xl font-bold font-mono" style={{ color: T.text }}>
                      {(targetTotalTokens / 1000000).toFixed(2)}M
                    </span>
                    <span className="text-[11px]" style={{ color: T.muted }}>{targetTotalTokens.toLocaleString()} tokens</span>
                  </div>

                  <div
                    className="p-4 rounded-xl border flex flex-col gap-1"
                    style={{
                      backgroundColor: isDark ? '#162032' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: T.textSub }}>Total AI Spend</span>
                    <span className="text-xl font-bold font-mono text-emerald-500">
                      ${targetTotalCost.toFixed(2)}
                    </span>
                    <span className="text-[11px]" style={{ color: T.muted }}>
                      {tokenTargetUser ? 'Selected user consumption' : `Avg $${avgCostPerUser} / user`}
                    </span>
                  </div>

                  <div
                    className="p-4 rounded-xl border flex flex-col gap-1"
                    style={{
                      backgroundColor: isDark ? '#162032' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: T.textSub }}>Active LLM Routing</span>
                    <span className="text-xl font-bold font-mono text-blue-500">3 Models</span>
                    <span className="text-[11px]" style={{ color: T.muted }}>GPT-4o (56%) · Claude (32%) · Gemini (12%)</span>
                  </div>

                  <div
                    className="p-4 rounded-xl border flex flex-col gap-1"
                    style={{
                      backgroundColor: isDark ? '#162032' : '#F8FAFC',
                      borderColor: T.border,
                    }}
                  >
                    <span className="text-xs font-semibold" style={{ color: T.textSub }}>Monthly Quota Budget</span>
                    <span className="text-xl font-bold font-mono text-emerald-500">
                      ${(500 - targetTotalCost).toFixed(2)} Left
                    </span>
                    <span className="text-[11px]" style={{ color: T.muted }}>Cap: $500.00 / month ({( (targetTotalCost / 500) * 100 ).toFixed(1)}% used)</span>
                  </div>
                </div>
              </div>

              {/* Model-Specific Usage & Weekly/Monthly Consumption Graph */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Model Specific Breakdown (5 Cols) */}
                <div
                  className="lg:col-span-5 p-6 rounded-2xl border shadow-sm flex flex-col gap-4"
                  style={{
                    backgroundColor: T.card,
                    borderColor: T.border,
                  }}
                >
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: T.text }}>AI Model-Specific Consumption</h3>
                    <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                      Token utilization and billing split by LLM provider.
                    </p>
                  </div>

                  <div className="flex flex-col gap-3.5">
                    {modelBreakdown.map((m, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl border flex flex-col gap-2"
                        style={{
                          backgroundColor: isDark ? '#141D2E' : '#F8FAFC',
                          borderColor: T.border,
                        }}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-xs flex items-center gap-1.5" style={{ color: T.text }}>
                              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }} />
                              <span>{m.model}</span>
                            </div>
                            <div className="text-[10px]" style={{ color: T.muted }}>{m.provider} · {m.purpose}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-mono font-bold" style={{ color: T.text }}>${m.cost.toFixed(2)}</div>
                            <div className="text-[10px] font-mono" style={{ color: T.muted }}>{(m.tokens / 1000).toFixed(0)}K tokens</div>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
                          <div className="h-full rounded-full transition-all" style={{ width: `${m.share}%`, backgroundColor: m.color }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Weekly & Monthly Usage Graph (7 Cols) */}
                <div
                  className="lg:col-span-7 p-6 rounded-2xl border shadow-sm flex flex-col justify-between gap-4"
                  style={{
                    backgroundColor: T.card,
                    borderColor: T.border,
                  }}
                >
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-bold" style={{ color: T.text }}>Consumption Over Time</h3>
                      <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                        Historical token throughput and automated fix volume.
                      </p>
                    </div>

                    {/* Timeframe Toggle: Weekly vs Monthly */}
                    <div
                      className="flex items-center p-1 rounded-xl border text-xs"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#F1F5F9',
                        borderColor: T.border,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setTokenTimeframe('weekly')}
                        className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          tokenTimeframe === 'weekly'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : ''
                        }`}
                        style={{
                          color: tokenTimeframe === 'weekly' ? '#FFFFFF' : T.textSub,
                        }}
                      >
                        Weekly Usage
                      </button>
                      <button
                        type="button"
                        onClick={() => setTokenTimeframe('monthly')}
                        className={`px-3 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                          tokenTimeframe === 'monthly'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : ''
                        }`}
                        style={{
                          color: tokenTimeframe === 'monthly' ? '#FFFFFF' : T.textSub,
                        }}
                      >
                        Monthly Usage
                      </button>
                    </div>
                  </div>

                  {/* SVG Bar Chart */}
                  <div className="pt-4 flex flex-col gap-2">
                    <div className="h-44 flex items-end justify-between gap-3 px-2 pt-2 border-b" style={{ borderColor: T.border }}>
                      {currentChartData.map((d, idx) => {
                        const heightPct = Math.max(10, Math.round((d.tokens / maxChartTokens) * 100));
                        return (
                          <div key={idx} className="flex-1 flex flex-col items-center gap-1 group relative h-full justify-end">
                            {/* Hover tooltip */}
                            <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 border border-slate-700 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap z-20 font-mono">
                              {(d.tokens / 1000).toFixed(0)}K tokens · ${d.cost.toFixed(2)}
                            </div>
                            <div
                              className="w-full max-w-[42px] rounded-t-lg transition-all duration-300 group-hover:brightness-110"
                              style={{
                                height: `${heightPct}%`,
                                background: 'linear-gradient(180deg, #3B82F6 0%, #1D4ED8 100%)',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* X-Axis Labels */}
                    <div className="flex items-center justify-between text-[11px] font-mono px-2" style={{ color: T.muted }}>
                      {currentChartData.map((d, idx) => (
                        <span key={idx} className="flex-1 text-center truncate">
                          {d.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Quota Cap Reminder */}
                  <div
                    className="p-3 rounded-xl border text-xs flex items-center justify-between"
                    style={{
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#EFF6FF',
                      borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#BFDBFE',
                      color: T.text,
                    }}
                  >
                    <span>Active Plan Limit: <strong>$500.00 / month</strong></span>
                    <span className="text-emerald-500 font-mono font-bold">${(500 - targetTotalCost).toFixed(2)} Remaining</span>
                  </div>
                </div>
              </div>

              {/* Per-User AI Consumption Table */}
              <div
                className="rounded-2xl border flex flex-col overflow-hidden shadow-sm"
                style={{
                  backgroundColor: T.card,
                  borderColor: T.border,
                }}
              >
                <div
                  className="p-4 border-b flex items-center justify-between"
                  style={{
                    backgroundColor: isDark ? '#141D2E' : '#F8FAFC',
                    borderColor: T.border,
                  }}
                >
                  <h3 className="text-sm font-bold" style={{ color: T.text }}>Client & User Token Consumption Leaderboard</h3>
                  <span className="text-xs" style={{ color: T.muted }}>Sorted by AI spend</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr
                        className="border-b font-semibold"
                        style={{
                          backgroundColor: isDark ? '#141D2E' : '#F8FAFC',
                          borderColor: T.border,
                          color: T.textSub,
                        }}
                      >
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Plan</th>
                        <th className="py-3 px-4">Total Tokens</th>
                        <th className="py-3 px-4">Monthly Cost ($)</th>
                        <th className="py-3 px-4">Quota Utilized</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Quick Filter</th>
                      </tr>
                    </thead>
                    <tbody
                      className="divide-y"
                      style={{ borderColor: T.border }}
                    >
                      {[...users].sort((a, b) => b.costUsage - a.costUsage).map(u => {
                        const quotaPct = Math.min(100, Math.round((u.costUsage / 50) * 100));
                        return (
                          <tr
                            key={u.id}
                            className={`transition-colors ${isDark ? 'hover:bg-slate-800/30' : 'hover:bg-slate-50'}`}
                            style={{ borderColor: T.border }}
                          >
                            <td className="py-3.5 px-4 font-semibold" style={{ color: T.text }}>
                              <div>{u.name}</div>
                              <div className="text-[11px] font-mono" style={{ color: T.muted }}>{u.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                                style={{
                                  backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                                  borderColor: T.border,
                                  color: T.textSub,
                                }}
                              >
                                {u.plan}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono" style={{ color: T.textSub }}>
                              {u.tokenUsage.toLocaleString()}
                            </td>
                            <td className="py-3.5 px-4 font-mono font-bold text-emerald-500">
                              ${u.costUsage.toFixed(2)}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex items-center gap-2">
                                <div className="w-24 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: isDark ? '#1E293B' : '#E2E8F0' }}>
                                  <div className="bg-blue-500 h-full rounded-full" style={{ width: `${quotaPct}%` }} />
                                </div>
                                <span className="text-[10px] font-mono" style={{ color: T.muted }}>{quotaPct}%</span>
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span
                                className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                                  isDark ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                }`}
                              >
                                Within Limit
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedTokenUser(u.id)}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600/15 text-blue-500 hover:bg-blue-600/25 transition-colors cursor-pointer border border-blue-500/30"
                              >
                                Filter Usage
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* ── ADD / ONBOARD USER MODAL ── */}
        {addUserModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-lg rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              {/* Header */}
              <div className="px-6 py-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: T.border }}>
                <div>
                  <h3 className="text-base font-bold" style={{ color: T.text }}>Onboard New User / Client</h3>
                  <p className="text-xs mt-0.5" style={{ color: T.textSub }}>
                    Configure account access, subscription tier, and monthly AI token quota.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddUserModalOpen(false)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer ml-2 shrink-0 transition-colors ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  ✕
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleCreateUser} className="p-6 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Full Name
                    </label>
                    <input
                      type="text"
                      required
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      placeholder="e.g. Sarah Connor"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none focus:border-blue-500 transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={newEmail}
                      onChange={e => setNewEmail(e.target.value)}
                      placeholder="sarah@company.com"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none focus:border-blue-500 transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Subscription Plan
                    </label>
                    <select
                      value={newPlan}
                      onChange={e => setNewPlan(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none cursor-pointer transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                    >
                      <option value="Enterprise">Enterprise ($500 quota)</option>
                      <option value="Pro">Pro ($100 quota)</option>
                      <option value="Starter">Starter ($20 quota)</option>
                      <option value="Custom">Custom</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Organization
                    </label>
                    <input
                      type="text"
                      required
                      value={newOrganization}
                      onChange={e => setNewOrganization(e.target.value)}
                      placeholder="e.g. Acme Corp, CloudifyOps"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none focus:border-blue-500 transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                      Monthly AI Spend Limit ($)
                    </label>
                    <input
                      type="number"
                      value={newBudget}
                      onChange={e => setNewBudget(e.target.value)}
                      placeholder="50.00"
                      className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none font-mono transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>
                    Temporary Password (Optional)
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Leave blank to auto-generate invite token"
                      className="w-full pl-3.5 pr-10 py-2 rounded-xl text-xs border outline-none focus:border-blue-500 transition-colors"
                      style={{
                        backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                        borderColor: isDark ? '#334155' : '#CBD5E1',
                        color: T.text,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className={`absolute right-3 cursor-pointer ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" id="sendInvite" defaultChecked className="rounded text-blue-600 cursor-pointer" />
                  <label htmlFor="sendInvite" className="text-xs cursor-pointer" style={{ color: T.textSub }}>
                    Send onboarding welcome email with login credentials and WAFR guide
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => setAddUserModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                      borderColor: T.border,
                      color: T.textSub,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-md"
                  >
                    Complete Onboarding
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── RESET PASSWORD CONFIRMATION MODAL ── */}
        {resetModalUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              <div className="p-6 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center border border-amber-500/30">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>

                <div>
                  <h3 className="text-base font-bold" style={{ color: T.text }}>Reset Password for {resetModalUser.name}?</h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: T.textSub }}>
                    This will invalidate all current active sessions for <strong style={{ color: T.text }}>{resetModalUser.email}</strong> and send an encrypted password reset link valid for 24 hours.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => setResetModalUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                      borderColor: T.border,
                      color: T.textSub,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSendResetPassword(resetModalUser)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-500 transition-colors cursor-pointer shadow-md"
                  >
                    Send Reset Link
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OFFBOARD & DELETE USER MODAL ── */}
        {offboardUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              <div className="p-6 flex flex-col gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center border border-rose-500/30">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <line x1="18" y1="8" x2="23" y2="13" />
                    <line x1="23" y1="8" x2="18" y2="13" />
                  </svg>
                </div>

                <div>
                  <h3 className="text-base font-bold" style={{ color: T.text }}>Offboard and Delete {offboardUser.name}?</h3>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: T.textSub }}>
                    You are about to permanently offboard <strong style={{ color: T.text }}>{offboardUser.email}</strong>.
                  </p>
                </div>

                <div
                  className="p-3.5 rounded-xl border text-xs flex flex-col gap-2"
                  style={{
                    backgroundColor: isDark ? '#0B0F17' : '#F8FAFC',
                    borderColor: T.border,
                    color: T.textSub,
                  }}
                >
                  <span className="font-semibold" style={{ color: T.text }}>Automated Offboarding Sequence:</span>
                  <div className="flex items-center gap-2" style={{ color: T.textSub }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Revoke active SSO & API tokens</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: T.textSub }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Archive personal WAFR reports and scans</span>
                  </div>
                  <div className="flex items-center gap-2" style={{ color: T.textSub }}>
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <span>Reclaim unspent AI quota (${offboardUser.costUsage.toFixed(2)} usage)</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => setOffboardUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                      borderColor: T.border,
                      color: T.textSub,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmOffboard}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors cursor-pointer shadow-md"
                  >
                    Confirm Offboarding
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── EDIT USER & PLAN MODAL ── */}
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
            <div
              className="w-full max-w-md rounded-2xl flex flex-col overflow-hidden shadow-2xl border"
              style={{
                backgroundColor: T.card,
                borderColor: T.border,
                color: T.text,
              }}
            >
              <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: T.border }}>
                <h3 className="text-base font-bold" style={{ color: T.text }}>Edit User: {editingUser.name}</h3>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className={`w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer transition-colors ${
                    isDark ? 'text-slate-400 hover:text-white hover:bg-slate-700/50' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveEditUser} className="p-6 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>Full Name</label>
                  <input
                    type="text"
                    required
                    value={editingUser.name}
                    onChange={e => setEditingUser({ ...editingUser, name: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none focus:border-blue-500 transition-colors"
                    style={{
                      backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                      color: T.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>Plan</label>
                  <select
                    value={editingUser.plan}
                    onChange={e => setEditingUser({ ...editingUser, plan: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none cursor-pointer transition-colors"
                    style={{
                      backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                      color: T.text,
                    }}
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="Pro">Pro</option>
                    <option value="Starter">Starter</option>
                    <option value="Custom">Custom</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>Organization</label>
                  <input
                    type="text"
                    required
                    value={editingUser.organization}
                    onChange={e => setEditingUser({ ...editingUser, organization: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none focus:border-blue-500 transition-colors"
                    style={{
                      backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                      color: T.text,
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold mb-1" style={{ color: T.textSub }}>Status</label>
                  <select
                    value={editingUser.status}
                    onChange={e => setEditingUser({ ...editingUser, status: e.target.value as any })}
                    className="w-full px-3.5 py-2 rounded-xl text-xs border outline-none cursor-pointer transition-colors"
                    style={{
                      backgroundColor: isDark ? '#1C2638' : '#FFFFFF',
                      borderColor: isDark ? '#334155' : '#CBD5E1',
                      color: T.text,
                    }}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-3 border-t" style={{ borderColor: T.border }}>
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-4 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
                      borderColor: T.border,
                      color: T.textSub,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition-colors cursor-pointer shadow-md"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
