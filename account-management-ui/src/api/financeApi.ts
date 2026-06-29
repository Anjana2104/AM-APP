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
  /** keyed by month label e.g. "Oct'25" → 'booked' | 'anticipated'; default 'booked' */
  milestoneTypes?: Record<string, 'booked' | 'anticipated'>;
  /** Free-text project comment */
  comments?: string;
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
export async function bulkSave(projects: FinanceProject[], monthHeaders: string[], changedBy?: string): Promise<{ ok: boolean; error?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/projects/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projects, monthHeaders, changedBy }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Server error' };
  return { ok: data.ok === true };
}

// ── Create one project ────────────────────────────────────────────────────────
export async function createProject(payload: FinanceProject, changedBy?: string): Promise<{ ok: boolean; id?: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, changedBy }),
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
export async function deleteProject(id: number, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const url = changedBy ? `${BASE}/projects/${id}?changedBy=${encodeURIComponent(changedBy)}` : `${BASE}/projects/${id}`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

// ── Clear all projects ────────────────────────────────────────────────────────
export async function clearAll(changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/projects`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changedBy }),
  });
  const data = await res.json();
  return data.ok === true;
}

// ── Update milestone types for a project (per-month, no amount change) ───────
export async function updateMilestoneTypes(
  projectId: number,
  types: Record<string, 'booked' | 'anticipated'>,
): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/projects/${projectId}/milestone-types`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ types }),
  });
  const data = await res.json();
  return data.ok === true;
}

// ── Bookings ──────────────────────────────────────────────────────────────────
export interface ProjectBooking {
  id: number;
  project_id: number;
  milestone_month: string;
  booking_month: string;
  amount: number;
  notes: string;
  created_by: string;
  created_at: string;
  booking_type: 'fixed' | 'anticipated';
}

export async function getBookings(projectId: number): Promise<ProjectBooking[]> {
  const online = await isServerAvailable();
  if (!online) return [];
  const res = await fetch(`${BASE}/projects/${projectId}/bookings`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.bookings || [];
}

export async function addBooking(
  projectId: number,
  booking: { milestone_month: string; booking_month: string; amount: number; notes?: string; created_by?: string; booking_type?: 'fixed' | 'anticipated' },
): Promise<{ ok: boolean; id?: number; error?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, error: 'Server unavailable' };
  const res = await fetch(`${BASE}/projects/${projectId}/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Failed' };
  return { ok: true, id: data.id };
}

export async function addBookingsBatch(
  projectId: number,
  bookings: Array<{ milestone_month: string; booking_month: string; amount: number; notes?: string; created_by?: string; booking_type?: 'fixed' | 'anticipated' }>,
): Promise<{ ok: boolean; count?: number; error?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, error: 'Server unavailable' };
  const res = await fetch(`${BASE}/projects/${projectId}/bookings/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bookings }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Failed' };
  return { ok: true, count: data.count };
}

export async function deleteBooking(projectId: number, bookingId: number, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const url = changedBy
    ? `${BASE}/projects/${projectId}/bookings/${bookingId}?changedBy=${encodeURIComponent(changedBy)}`
    : `${BASE}/projects/${projectId}/bookings/${bookingId}`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

export async function updateBooking(
  projectId: number,
  bookingId: number,
  booking: { milestone_month: string; booking_month: string; amount: number; notes?: string; created_by?: string; booking_type?: 'fixed' | 'anticipated' },
): Promise<{ ok: boolean; error?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, error: 'Server unavailable' };
  const res = await fetch(`${BASE}/projects/${projectId}/bookings/${bookingId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(booking),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Failed' };
  return { ok: true };
}

export async function deleteAllProjectBookings(projectId: number, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const url = changedBy
    ? `${BASE}/projects/${projectId}/bookings?changedBy=${encodeURIComponent(changedBy)}`
    : `${BASE}/projects/${projectId}/bookings`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

export async function deleteAllBookings(changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const url = changedBy
    ? `${BASE}/bookings/all?changedBy=${encodeURIComponent(changedBy)}`
    : `${BASE}/bookings/all`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}
