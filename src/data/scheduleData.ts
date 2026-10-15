import { Cloud } from '../context';

export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';

export interface ScheduledAssessment {
  id: string;
  name: string;
  cloud: Cloud;
  accountId: string;
  accountName: string;
  region: string;
  frequency: ScheduleFrequency;
  time: string; // e.g. "02:00 UTC"
  dayOfWeek?: string; // e.g. "Monday"
  dayOfMonth?: number; // e.g. 1
  cronExpression?: string;
  timezone: string;
  status: 'active' | 'paused';
  nextRun: string;
  lastRun?: string;
  notifySlack: boolean;
  slackWebhook?: string;
  notifyGChat: boolean;
  gchatWebhook?: string;
  notifyJira: boolean;
  autoCreateMilestone: boolean;
  createdAt: string;
}

export const INITIAL_SCHEDULED_ASSESSMENTS: ScheduledAssessment[] = [];
