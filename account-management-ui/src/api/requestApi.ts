/**
 * Client Requests API client
 */

const BASE = '/api/requests';

export interface RequestPayload {
  id?: number;
  sno?: number;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
  isActive?: boolean;
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

export async function getRequests(): Promise<{ requests: RequestPayload[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (online) {
    const res = await fetch(BASE);
    const data = await res.json();
    // Map snake_case DB columns → camelCase to match RequestPayload interface
    const requests: RequestPayload[] = (data.requests || []).map((r: Record<string, unknown>) => ({
      id:               r.id as number,
      sno:              r.sno as number,
      beelineId:        String(r.beeline_id   ?? r.beelineId   ?? ''),
      description:      String(r.description  ?? ''),
      raisedBy:         String(r.raised_by    ?? r.raisedBy    ?? ''),
      processingStatus: String(r.processing_status ?? r.processingStatus ?? ''),
      overallStatus:    String(r.overall_status    ?? r.overallStatus    ?? ''),
      accountAnchor:    String(r.account_anchor    ?? r.accountAnchor    ?? ''),
      dateRaised:       String(r.date_raised       ?? r.dateRaised       ?? ''),
      requestType:      String(r.request_type      ?? r.requestType      ?? ''),
      updatedOn:        String(r.updated_on         ?? r.updatedOn        ?? ''),
      isActive:         r.is_active === undefined ? true : r.is_active !== 0,
    }));
    return { requests, fromServer: true };
  }
  return { requests: [], fromServer: false };
}

export async function bulkSave(requests: RequestPayload[]): Promise<{ ok: boolean; inserted: number; updated: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, inserted: 0, updated: 0 };
  const res = await fetch(`${BASE}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests }),
  });
  return res.json();
}

export async function createRequest(payload: RequestPayload): Promise<{ ok: boolean; id?: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateRequest(id: number, payload: Partial<RequestPayload>): Promise<boolean> {
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

export async function deleteRequest(id: number, changedBy?: string): Promise<boolean> {
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
    body: JSON.stringify({ isActive, changedBy: changedBy || 'system' }),
  });
  const data = await res.json();
  if (!res.ok) return { ok: false, error: data.error || 'Failed to update status' };
  return { ok: true };
}

export async function getActiveRequests(): Promise<{ beelineId: string }[]> {
  const online = await isServerAvailable();
  if (!online) return [];
  const res = await fetch(`${BASE}/active`);
  const data = await res.json();
  return (data.requests || []).map((r: Record<string, unknown>) => ({
    beelineId: String(r.beeline_id ?? ''),
  }));
}

// ── Request Comments ──────────────────────────────────────────────────────────

export interface RequestComment {
  id: number;
  request_id: number;
  author: string;
  tag: string;
  body: string;
  created_at: string;
}

// Comment functions bypass the cached isServerAvailable() check — always attempt directly
export async function getRequestComments(requestId: number): Promise<RequestComment[]> {
  try {
    const res = await fetch(`${BASE}/${requestId}/comments`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.comments || [];
  } catch { return []; }
}

export async function addRequestComment(
  requestId: number,
  payload: { author: string; tag: string; body: string }
): Promise<{ ok: boolean; error?: string }> {
  const url = `${BASE}/${requestId}/comments`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    let data: Record<string, unknown>;
    try { data = await res.json(); } catch { data = {}; }
    if (data.ok === true) return { ok: true };
    return { ok: false, error: String(data.error || `HTTP ${res.status}`) };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }
}

export async function deleteRequestComment(requestId: number, commentId: number): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${requestId}/comments/${commentId}`, { method: 'DELETE' });
    if (!res.ok) return false;
    const data = await res.json();
    return data.ok === true;
  } catch { return false; }
}

