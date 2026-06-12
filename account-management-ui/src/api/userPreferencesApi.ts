/**
 * src/api/userPreferencesApi.ts
 * Client for user preferences (column visibility, notification snooze)
 */

const BASE = '/api/user-preferences';

export interface SnoozeRule {
  id: string;           // uuid or timestamp-based unique id
  label: string;        // human-readable label
  triggerId: number | null; // null = all triggers
  triggerName: string;  // display name
  until: string;        // ISO date string — snooze expires at this time
}

export interface UserPreferences {
  columnVisibility: Record<string, Record<string, boolean>>;
  notificationSnooze: SnoozeRule[];
}

export async function getUserPreferences(userId: number): Promise<UserPreferences> {
  const res = await fetch(`${BASE}/${userId}`);
  const data = await res.json();
  return data.preferences as UserPreferences || { columnVisibility: {}, notificationSnooze: [] };
}

export async function saveUserPreferences(userId: number, preferences: UserPreferences): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ preferences }),
  });
  return res.json();
}
