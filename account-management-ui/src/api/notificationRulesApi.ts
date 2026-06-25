/**
 * src/api/notificationRulesApi.ts
 *
 * Client for the scheduled notification rules API (/api/notification-rules).
 * These are proactive, schedule-driven rules evaluated server-side hourly,
 * in contrast to notification triggers which fire reactively on field changes.
 */

const BASE = '/api/notification-rules';

export interface NotificationRule {
  id: number;
  name: string;
  description: string;
  source_table: 'resources' | 'client_requests' | 'ra_process' | 'finance_projects';
  condition_type: 'date_overdue' | 'field_threshold' | 'field_equals';
  date_field: string;
  lead_time_days: number;
  filter_field: string;
  filter_operator: string;
  filter_value: string;
  threshold_field: string;
  threshold_operator: string;
  threshold_value: number | null;
  config_value_key: string;
  schedule_type: 'daily' | 'monthly' | 'weekly';
  schedule_day: number | null;
  notification_type: 'task' | 'info' | 'alert';
  notify_target_type: 'group' | 'field_value' | 'broadcast';
  notify_target_value: string;
  message_template: string;
  is_active: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export async function getNotificationRules(): Promise<NotificationRule[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error('Failed to load scheduled rules');
  return res.json();
}

export async function createNotificationRule(
  data: Omit<NotificationRule, 'id' | 'last_run_at' | 'created_at' | 'updated_at'>
): Promise<{ id: number }> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create scheduled rule');
  return res.json();
}

export async function updateNotificationRule(
  id: number,
  data: Partial<NotificationRule>
): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update scheduled rule');
}

export async function reorderNotificationRules(ids: number[]): Promise<void> {
  const res = await fetch(`${BASE}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('Failed to reorder rules');
}

export async function duplicateNotificationRule(id: number): Promise<{ id: number }> {
  const res = await fetch(`${BASE}/${id}/duplicate`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to duplicate rule');
  return res.json();
}

export async function deleteNotificationRule(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete scheduled rule');
}

export async function toggleNotificationRule(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}/toggle`, { method: 'PUT' });
  if (!res.ok) throw new Error('Failed to toggle scheduled rule');
}

export interface RunResult {
  fired: number;
  diagnostics: Array<{
    id: number;
    name: string;
    matchDebug?: string;
    recordsMatched?: number;
    fired: number;
    skipped?: string;
    error?: string;
    note?: string;
    targets_type?: string;
  }>;
}

export async function runRulesNow(): Promise<RunResult> {
  const res = await fetch(`${BASE}/run`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run rule engine');
  return res.json();
}

export async function runRuleById(id: number): Promise<RunResult> {
  const res = await fetch(`${BASE}/run/${id}`, { method: 'POST' });
  if (!res.ok) throw new Error('Failed to run rule');
  return res.json();
}

export interface NotificationHistoryRow {
  id: number;
  type: string;
  title: string;
  message: string;          // consolidated: may be multiple messages joined by ' | '
  notification_count: number; // how many individual notifications in this group
  source_user: string;
  recipient_count: number;
  recipients_list: string | null;
  read_count: number;
  created_at: string;
}

export async function getNotificationHistory(limit = 200): Promise<NotificationHistoryRow[]> {
  const res = await fetch(`${BASE}/history?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load notification history');
  return res.json();
}

export async function deleteNotificationHistory(
  period: 'today' | '7d' | '30d' | 'all',
  source: 'rule_engine' | 'change_trigger' | 'all',
  title?: string
): Promise<{ deleted: number }> {
  const res = await fetch(`${BASE}/history`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, source, title: title?.trim() || undefined }),
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || 'Failed to delete notifications');
  return { deleted: typeof data.deleted === 'number' ? data.deleted : 0 };
}

export async function getFieldValues(table: string, field: string): Promise<string[]> {
  const res = await fetch(`${BASE}/field-values?table=${encodeURIComponent(table)}&field=${encodeURIComponent(field)}`);
  if (!res.ok) return [];
  return res.json();
}
