/**
 * src/api/requestApi.ts
 * Client Requests API client — mirrors resourceApi pattern.
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

export async function deleteRequest(id: number): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

export async function clearAll(): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(BASE, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}
