/**
 * src/api/authApi.ts
 * Auth, Users, and Roles API client
 */

const BASE_AUTH = '/api/auth';
const BASE_USERS = '/api/users';
const BASE_ROLES = '/api/roles';

export interface LoginResult {
  ok: boolean;
  user?: UserSession;
  error?: string;
}

export interface UserSession {
  id: number;
  username: string;
  displayName: string;
  roleId: number | null;
  roleName: string;
  permissions: Record<string, PagePermission>;
}

export interface PagePermission {
  view: boolean;
  edit: boolean;
  delete: boolean;
}

export interface UserRecord {
  id: number;
  username: string;
  displayName: string;
  passwordPlain: string;
  roleId: number | null;
  roleName: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RoleRecord {
  id: number;
  name: string;
  description: string;
  permissions: Record<string, PagePermission>;
  createdAt: string;
  updatedAt: string;
}

// ── Auth ─────────────────────────────────────────────────────────────

export async function login(username: string, password: string): Promise<LoginResult> {
  try {
    const url = `${BASE_AUTH}/login`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    // If server returned HTML (e.g. ingress 404 page), res.json() will throw
    const text = await res.text();
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(text);
    } catch {
      return { ok: false, error: `Server returned non-JSON (status ${res.status}). URL: ${url}. Body: ${text.slice(0, 200)}` };
    }
    if (!res.ok) return { ok: false, error: (data.error as string) || 'Login failed' };
    return { ok: true, user: data.user as UserSession };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Network error — ${msg}` };
  }
}

export async function logout(): Promise<void> {
  try { await fetch(`${BASE_AUTH}/logout`, { method: 'POST' }); } catch { /* ignore */ }
}

// ── Users ─────────────────────────────────────────────────────────────

export async function getUsers(): Promise<UserRecord[]> {
  try {
    const res = await fetch(BASE_USERS);
    const data = await res.json();
    return data.users || [];
  } catch { return []; }
}

export async function createUser(data: { username: string; password: string; displayName?: string; roleId?: number | null; active?: boolean }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(BASE_USERS, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function updateUser(id: number, data: Partial<{ username: string; password: string; displayName: string; roleId: number | null; active: boolean }>): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_USERS}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function deleteUser(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_USERS}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

// ── Roles ─────────────────────────────────────────────────────────────

export async function getRoles(): Promise<RoleRecord[]> {
  try {
    const res = await fetch(BASE_ROLES);
    const data = await res.json();
    return data.roles || [];
  } catch { return []; }
}

export async function createRole(data: { name: string; description?: string; permissions?: Record<string, PagePermission> }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(BASE_ROLES, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function updateRole(id: number, data: { name?: string; description?: string; permissions?: Record<string, PagePermission> }): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_ROLES}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}

export async function deleteRole(id: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE_ROLES}/${id}`, { method: 'DELETE' });
    const json = await res.json();
    return res.ok ? { ok: true } : { ok: false, error: json.error };
  } catch { return { ok: false, error: 'Network error' }; }
}
