/**
 * src/api/financeApi.ts
 *
 * Finance data API client.
 * Calls the Express backend at /api/finance/*.
 * If the server is unreachable it falls back to localStorage so the app
 * stays usable offline / without a running backend.
 */

const BASE = '/api/finance';

export interface FinanceProject {
  id?: number;
  sno?: number;
  project: string;
  company?: string;
  code: string;
  space: string;
  owner: string;
  /** 'Active' | 'Inactive' — driven from backend DB status field */
  status?: 'Active' | 'Inactive';
  /** @deprecated use status instead; kept for backward compat with existing DB rows */
  active?: number | boolean;
  /** keyed by month label e.g. "Oct'25" → number */
  revenue: Record<string, number>;
  monthHeaders?: string[];
}

let _serverAvailable: boolean | null = null;

async function isServerAvailable(): Promise<boolean> {
  if (_serverAvailable !== null) return _serverAvailable;
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(2000) });
    _serverAvailable = res.ok;
  } catch {
    _serverAvailable = false;
  }
  return _serverAvailable;
}

// Reset cache (useful when server comes online during a session)
export function resetServerCache() {
  _serverAvailable = null;
}

// ── GET projects ──────────────────────────────────────────────────────────────
export async function getProjects(): Promise<{ projects: FinanceProject[]; months: string[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (online) {
    const [pRes, mRes] = await Promise.all([
      fetch(`${BASE}/projects`),
      fetch(`${BASE}/month-headers`),
    ]);
    const { projects } = await pRes.json();
    const { months } = await mRes.json();
    return { projects, months, fromServer: true };
  }
  return { projects: [], months: [], fromServer: false };
}

// ── Bulk save (full replace) ──────────────────────────────────────────────────
export async function bulkSave(projects: FinanceProject[], monthHeaders: string[]): Promise<{ ok: boolean; error?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/projects/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects, monthHeaders }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Server error' };
  return { ok: data.ok === true };
}

// ── Create one project ────────────────────────────────────────────────────────
export async function createProject(payload: FinanceProject): Promise<{ ok: boolean; id?: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data;
}

// ── Update one project ────────────────────────────────────────────────────────
export async function updateProject(id: number, payload: Partial<FinanceProject> & { status?: 'Active' | 'Inactive'; monthHeaders?: string[] }): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data.ok === true;
}

// ── Delete one project ────────────────────────────────────────────────────────
export async function deleteProject(id: number): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/projects/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

// ── Clear all projects ────────────────────────────────────────────────────────
export async function clearAll(): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/projects`, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}
