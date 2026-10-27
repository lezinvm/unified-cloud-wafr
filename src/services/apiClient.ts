/**
 * API client to connect the React UI to the FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });
    if (!res.ok) {
      let message = `API Error [${res.status}]: ${res.statusText}`;
      try {
        const errorData = await res.json();
        if (errorData && errorData.detail) {
          message = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
        }
      } catch {}
      throw new Error(message);
    }
    return await res.json();
  } catch (err) {
    console.error(`Failed to fetch ${url}:`, err);
    throw err;
  }
}

export const api = {
  // Health
  checkHealth: () => apiRequest<{ status: string; database: string }>('/health'),

  // Organizations & Accounts
  getOrganizations: () => apiRequest<any[]>('/organizations'),
  getUsers: (orgId?: string, email?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.append('org_id', orgId);
    if (email) params.append('email', email);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/users?${query}` : '/users');
  },
  registerUser: (payload: { email: string; name?: string; password: string; organization?: string }) =>
    apiRequest<any>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getCloudAccounts: (orgId?: string, userId?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.append('org_id', orgId);
    if (userId) params.append('user_id', userId);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/cloud-accounts?${query}` : '/cloud-accounts');
  },
  saveCloudAccount: (payload: any) =>
    apiRequest<any>('/cloud-accounts', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteCloudAccount: (id: string) =>
    apiRequest<any>(`/cloud-accounts/${id}`, {
      method: 'DELETE',
    }),

  // Assessments
  getAssessments: (orgId?: string, userId?: string, cloudAccountId?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.append('org_id', orgId);
    if (userId) params.append('user_id', userId);
    if (cloudAccountId) params.append('cloud_account_id', cloudAccountId);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/assessments?${query}` : '/assessments');
  },
  getAssessmentDetail: (id: string) => apiRequest<any>(`/assessments/${id}`),
  saveAssessment: (payload: any) =>
    apiRequest<any>('/assessments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteAssessment: (id: string) =>
    apiRequest<any>(`/assessments/${id}`, {
      method: 'DELETE',
    }),

  // Findings
  getFindings: (filters?: { assessment_id?: string; cloud?: string; severity?: string; service?: string }) => {
    const params = new URLSearchParams();
    if (filters?.assessment_id) params.append('assessment_id', filters.assessment_id);
    if (filters?.cloud) params.append('cloud', filters.cloud);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.service) params.append('service', filters.service);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/findings?${query}` : '/findings');
  },
  saveFinding: (payload: any) =>
    apiRequest<any>('/findings', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Remediations & AI Fix
  getRemediations: (filters?: { cloud?: string; pillar_id?: string; check_id?: string; assessment_id?: string }) => {
    const params = new URLSearchParams();
    if (filters?.cloud) params.append('cloud', filters.cloud);
    if (filters?.pillar_id) params.append('pillar_id', filters.pillar_id);
    if (filters?.check_id) params.append('check_id', filters.check_id);
    if (filters?.assessment_id) params.append('assessment_id', filters.assessment_id);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/remediations?${query}` : '/remediations');
  },
  saveRemediation: (payload: any) =>
    apiRequest<any>('/remediations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getRemediationStatuses: (assessmentId?: string, userId?: string) => {
    const params = new URLSearchParams();
    if (assessmentId) params.append('assessment_id', assessmentId);
    if (userId) params.append('user_id', userId);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/remediations/status?${query}` : '/remediations/status');
  },
  saveRemediationStatus: (payload: { key?: string; assessment_id?: string; check_id?: string; status: string; note?: string; user_id?: string }) =>
    apiRequest<any>('/remediations/status', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Resource Inventory
  getResources: (filters?: { assessment_id?: string; cloud?: string; service?: string }) => {
    const params = new URLSearchParams();
    if (filters?.assessment_id) params.append('assessment_id', filters.assessment_id);
    if (filters?.cloud) params.append('cloud', filters.cloud);
    if (filters?.service) params.append('service', filters.service);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/resources?${query}` : '/resources');
  },

  // Metadata / Frameworks & Checks
  getPillars: (cloud?: string) =>
    apiRequest<any[]>(cloud && cloud !== 'all' ? `/pillars?cloud=${cloud}` : '/pillars'),
  getChecks: (filters?: { pillar_id?: string; best_practice_id?: string; severity?: string; status?: string; cloud?: string }) => {
    const params = new URLSearchParams();
    if (filters?.pillar_id) params.append('pillar_id', filters.pillar_id);
    if (filters?.best_practice_id) params.append('best_practice_id', filters.best_practice_id);
    if (filters?.severity) params.append('severity', filters.severity);
    if (filters?.status) params.append('status', filters.status);
    if (filters?.cloud && filters.cloud !== 'all') params.append('cloud', filters.cloud);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/checks?${query}` : '/checks');
  },
  getBestPractices: (pillarId?: string) =>
    apiRequest<any[]>(pillarId ? `/best-practices?pillar_id=${pillarId}` : '/best-practices'),
  getRules: (pillarId?: string) =>
    apiRequest<any[]>(pillarId ? `/rules?pillar_id=${pillarId}` : '/rules'),
  getComplianceFrameworks: () => apiRequest<any[]>('/compliance-frameworks'),
  getComplianceScores: (assessmentId?: string) =>
    apiRequest<any[]>(assessmentId ? `/compliance-scores?assessment_id=${assessmentId}` : '/compliance-scores'),
  getMilestones: (assessmentId?: string) =>
    apiRequest<any[]>(assessmentId ? `/milestones?assessment_id=${assessmentId}` : '/milestones'),
  getQuestionnaires: (assessmentId?: string) =>
    apiRequest<{ questions: any[]; responses: any[] }>(
      assessmentId ? `/questionnaires?assessment_id=${assessmentId}` : '/questionnaires'
    ),
  saveQuestionnaireResponse: (payload: any) =>
    apiRequest<any>('/questionnaire-responses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Schedules
  getScheduledAssessments: (orgId?: string, userId?: string, cloud?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.append('org_id', orgId);
    if (userId) params.append('user_id', userId);
    if (cloud) params.append('cloud', cloud);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/scheduled-assessments?${query}` : '/scheduled-assessments');
  },
  saveSchedule: (payload: any) =>
    apiRequest<any>('/scheduled-assessments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteSchedule: (id: string) =>
    apiRequest<any>(`/scheduled-assessments/${id}`, {
      method: 'DELETE',
    }),

  // Milestones
  saveMilestone: (payload: any) =>
    apiRequest<any>('/milestones', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteMilestone: (id: string) =>
    apiRequest<any>(`/milestones/${id}`, {
      method: 'DELETE',
    }),

  // Integrations & Alerts
  getIntegrations: (orgId?: string) =>
    apiRequest<any[]>(orgId ? `/integrations?org_id=${encodeURIComponent(orgId)}` : '/integrations'),
  saveIntegration: (payload: any) =>
    apiRequest<any>('/integrations', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getAlertLogs: () => apiRequest<any[]>('/alert-logs'),
  saveAlertLog: (payload: any) =>
    apiRequest<any>('/alert-logs', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Users
  saveUser: (payload: any) =>
    apiRequest<any>('/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  deleteUser: (id: string) =>
    apiRequest<any>(`/users/${id}`, {
      method: 'DELETE',
    }),

  // Rerun assessment and checks
  rerunAssessment: (assessmentId: string) =>
    apiRequest<any>(`/assessments/${assessmentId}/rerun`, { method: 'POST' }),
  rerunCheck: (payload: any) =>
    apiRequest<any>('/checks/rerun', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Infrastructure Repositories
  getRepositories: (orgId?: string, userId?: string) => {
    const params = new URLSearchParams();
    if (orgId) params.append('org_id', orgId);
    if (userId) params.append('user_id', userId);
    const query = params.toString();
    return apiRequest<any[]>(query ? `/repositories?${query}` : '/repositories');
  },
  saveRepository: (payload: any) =>
    apiRequest<any>('/repositories', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Jira Tickets
  getJiraTickets: (findingId?: string) => {
    const query = findingId ? `?finding_id=${findingId}` : '';
    return apiRequest<any[]>(`/jira-tickets${query}`);
  },
  saveJiraTicket: (payload: any) =>
    apiRequest<any>('/jira-tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Questionnaire questions
  getQuestionnaireQuestions: () => apiRequest<any[]>('/questionnaire-questions'),
  saveQuestionnaireQuestion: (payload: any) =>
    apiRequest<any>('/questionnaire-questions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};

