const BASE = '/api/notification-triggers';

export interface TriggerSourceField {
  label: string;
  value: string;
}

export interface TriggerSource {
  label: string;
  value: string;
  module: string;
  fields: TriggerSourceField[];
}

export interface NotificationTrigger {
  id: number;
  name: string;
  source_table: string;
  trigger_field: string;
  trigger_label: string;
  message_template: string;
  notify_target_type: 'field_value' | 'group' | 'broadcast';
  notify_target_value: string;
  notification_type: string;
  is_active: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export async function getTriggerSources(): Promise<TriggerSource[]> {
  const res = await fetch(`${BASE}/sources`);
  const data = await res.json();
  return data.sources || [];
}

export async function getNotificationTriggers(): Promise<NotificationTrigger[]> {
  const res = await fetch(BASE);
  const data = await res.json();
  return data.triggers || [];
}

export async function createNotificationTrigger(
  trigger: Omit<NotificationTrigger, 'id' | 'created_at' | 'updated_at'>
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trigger),
  });
  return res.json();
}

export async function updateNotificationTrigger(
  id: number,
  trigger: Partial<Omit<NotificationTrigger, 'id' | 'created_at' | 'updated_at'>>
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trigger),
  });
  return res.json();
}

export async function toggleNotificationTrigger(
  id: number
): Promise<{ ok: boolean; is_active?: boolean; error?: string }> {
  const res = await fetch(`${BASE}/${id}/toggle`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  return res.json();
}

export async function deleteNotificationTrigger(
  id: number
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  return res.json();
}

export async function reorderNotificationTriggers(
  ids: number[]
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch(`${BASE}/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return res.json();
}
