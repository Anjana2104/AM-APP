/**
 * src/api/notificationApi.ts
 * User Groups and Notifications API client
 */

const BASE_GROUPS = '/api/user-groups';
const BASE_NOTIFS = '/api/notifications';

// ── Types ─────────────────────────────────────────────────────────────

export interface UserGroup {
  id: number;
  name: string;
  description: string;
  user_type_config_id: string;
  members: { id: number; username: string; displayName: string }[];
  created_at: string;
  updated_at?: string;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  target_user_id: number | null;
  target_group_id: number | null;
  source_user: string;
  is_read: boolean;
  is_read_by_user: boolean;
  read_at: string | null;
  created_at: string;
}

// ── User Groups ───────────────────────────────────────────────────────

export async function getUserGroups(): Promise<UserGroup[]> {
  try {
    const res = await fetch(BASE_GROUPS);
    const data = await res.json();
    return data.groups || [];
  } catch { return []; }
}

export async function createUserGroup(data: {
  name: string;
  description?: string;
  user_type_config_id?: string;
}): Promise<{ ok: boolean; error?: string; id?: number }> {
  try {
    const res = await fetch(BASE_GROUPS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true, id: json.id } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function updateUserGroup(
  id: number,
  data: Partial<{ name: string; description: string; user_type_config_id: string }>
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_GROUPS}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function deleteUserGroup(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_GROUPS}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function addGroupMember(
  groupId: number,
  userId: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_GROUPS}/${groupId}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function removeGroupMember(
  groupId: number,
  userId: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_GROUPS}/${groupId}/members/${userId}`, { method: 'DELETE' });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

// ── Notifications ─────────────────────────────────────────────────────

export interface NotificationPage {
  notifications: Notification[];
  total: number;
  has_more: boolean;
}

/** Fetch paginated notifications. unreadOnly=true for the bell badge / main panel. */
export async function getNotifications(
  userId: number,
  options: { limit?: number; offset?: number; unreadOnly?: boolean } = {}
): Promise<NotificationPage> {
  try {
    const { limit = 20, offset = 0, unreadOnly = false } = options;
    const url = `${BASE_NOTIFS}?userId=${userId}&limit=${limit}&offset=${offset}&unreadOnly=${unreadOnly}`;
    const res = await fetch(url);
    const data = await res.json();
    return { notifications: data.notifications || [], total: data.total || 0, has_more: !!data.has_more };
  } catch { return { notifications: [], total: 0, has_more: false }; }
}

/** Lightweight unread count — used for bell badge polling. */
export async function getUnreadCount(userId: number): Promise<number> {
  try {
    const res = await fetch(`${BASE_NOTIFS}/count?userId=${userId}`);
    const data = await res.json();
    return data.unread_count || 0;
  } catch { return 0; }
}

export async function createNotification(data: {
  type?: string;
  title: string;
  message: string;
  target_user_id?: number | null;
  target_group_id?: number | null;
  source_user?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(BASE_NOTIFS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function markNotificationRead(
  id: number,
  userId: number
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_NOTIFS}/${id}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function markAllRead(userId: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_NOTIFS}/read-all`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function deleteNotification(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_NOTIFS}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}
