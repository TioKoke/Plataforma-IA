const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface StatsKpis {
  unique_users: number;
  unique_users_total: number;
  total_conversations: number;
  total_conversations_all: number;
  total_agents: number;
  total_backlogs: number;
  hours_saved: number;
  hours_saved_total: number;
  avg_msgs_per_conv: number;
}

export interface DivisionBreakdown {
  nombre: string;
  value: number;
}

export interface MonthlyActivity {
  month: string;
  mes: string;
  conversations: number;
  unique_users: number;
  new_users: number;
  returning_users: number;
}

export interface UsageAggregate {
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  calls: number;
  tool_calls: number;
}

export interface DailyUsage {
  date: string;
  dia: string;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  calls: number;
}

export interface ModelBreakdown extends UsageAggregate {
  model: string;
}

export interface ModelUsage {
  period: UsageAggregate;
  total: UsageAggregate;
  daily_series: DailyUsage[];
  by_model: ModelBreakdown[];
}

export interface StatsResponse {
  kpis: StatsKpis;
  monthly_activity: MonthlyActivity[];
  model_usage: ModelUsage;
  division_breakdown: DivisionBreakdown[];
  engagement_score: number | null;
  roi_estimated_usd: number | null;
}

export async function fetchStats(days = 30, idToken?: string | null): Promise<StatsResponse> {
  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${API_URL}/stats/?days=${days}`, { headers });
  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);
  return res.json();
}

export interface LiveMetrics {
  logged_in_users: number;
  active_connections: number;
  total_agents: number;
  timestamp: string;
}

export async function fetchLiveMetrics(idToken?: string | null): Promise<LiveMetrics> {
  const headers: HeadersInit = {};
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  const res = await fetch(`${API_URL}/stats/live`, { headers });
  if (!res.ok) throw new Error(`Live metrics error ${res.status}`);
  return res.json();
}

export async function postPresence(email: string, idToken?: string | null): Promise<void> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (idToken) headers['Authorization'] = `Bearer ${idToken}`;
  await fetch(`${API_URL}/stats/presence`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  });
}
