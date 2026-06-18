/**
 * src/api/processApi.ts
 * Internal Process (RA Process) API client
 */

const BASE = '/api/process';

export interface ProcessPayload {
  id?: number;
  sno?: number;
  sow: string;
  startDate: string;
  signedSow: string;
  piw: string;
  active: string;
  salesforceId: string;
  promsId: string;
  budget: string;
  openAirCode: string;
  comments: string;
  accountAnchor?: string;
  changedBy?: string;
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

export function resetServerCache() {
  _serverAvailable = null;
}

export async function getProcessRows(): Promise<{ rows: any[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (online) {
    const res = await fetch(BASE);
    const data = await res.json();
    return { rows: data.rows || [], fromServer: true };
  }
  return { rows: [], fromServer: false };
}

export async function bulkSave(rows: ProcessPayload[]): Promise<{ ok: boolean; inserted: number; updated: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, inserted: 0, updated: 0 };
  const res = await fetch(`${BASE}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows }),
  });
  return res.json();
}

export async function createProcess(payload: ProcessPayload): Promise<{ ok: boolean; id?: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateProcess(id: number, payload: Partial<ProcessPayload>): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function deleteProcess(id: number, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const url = changedBy ? `${BASE}/${id}?changedBy=${encodeURIComponent(changedBy)}` : `${BASE}/${id}`;
  const res = await fetch(url, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

export async function clearAll(changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(BASE, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ changedBy }),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function setActiveStatus(id: number, isActive: boolean, changedBy?: string): Promise<{ ok: boolean; error?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, error: 'Server unavailable' };
  const res = await fetch(`${BASE}/${id}/active`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ isActive, changedBy }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Failed' };
  return { ok: true };
}

export interface ProcessComment {
  id: number;
  process_id: number;
  author: string;
  body: string;
  created_at: string;
}

export async function getComments(id: number): Promise<ProcessComment[]> {
  try {
    const res = await fetch(`${BASE}/${id}/comments`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.comments || [];
  } catch { return []; }
}

export async function addComment(id: number, payload: { author: string; body: string }): Promise<{ ok: boolean; comment?: ProcessComment; error?: string }> {
  try {
    const res = await fetch(`${BASE}/${id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error };
    return { ok: true, comment: data.comment };
  } catch (e: any) { return { ok: false, error: e.message }; }
}

export async function deleteComment(processId: number, commentId: number): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${processId}/comments/${commentId}`, { method: 'DELETE' });
    return res.ok;
  } catch { return false; }
}

