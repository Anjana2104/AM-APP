/**
 * Resource Hub API client
 */

const BASE = '/api/resources';

export interface ResourcePayload {
  id?: number;
  sno?: number;
  isActive?: boolean;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string;
  roleOrDomain: string;
  previousWorkex: string;
  doj: string;
  totalWorkex: string;
  engagement: string;
  skills: string;
  allocationStatus?: string;
  allocationPercentage?: number | null;
  beelineId?: string;
  processId?: number | null;
  engagementStartDate?: string;
  engagementEndDate?: string;
  sowName?: string;
}

let _serverAvailable: boolean | null = null;

async function isServerAvailable(): Promise<boolean> {
  if (_serverAvailable === true) return true; // only cache success
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (res.ok) { _serverAvailable = true; return true; }
    return false;
  } catch {
    return false;
  }
}

export function resetServerCache() {
  _serverAvailable = null;
}

// GET all resources
export async function getResources(): Promise<{ resources: ResourcePayload[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (online) {
    const res = await fetch(BASE);
    const { resources } = await res.json();
    return { resources, fromServer: true };
  }
  return { resources: [], fromServer: false };
}

// Upsert bulk (keyed by raId)
export async function bulkSave(resources: ResourcePayload[], changedBy?: string): Promise<{ ok: boolean; inserted: number; updated: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, inserted: 0, updated: 0 };
  const res = await fetch(`${BASE}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources, changedBy: changedBy || 'system' }),
  });
  return res.json();
}

// Update one resource
export async function updateResource(id: number, payload: Partial<ResourcePayload> & { changedBy?: string }): Promise<boolean> {
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

// Delete one resource
export async function deleteResource(id: number): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

// Delete ALL resources
export async function clearAll(): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(BASE, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

// ── Resource Comments ─────────────────────────────────────────────────────

export interface ResourceComment {
  id: number;
  resource_id: number;
  author: string;
  tag: string;
  body: string;
  reported_by?: string;
  source_module?: string;
  created_at: string;
  updated_at?: string;
}

export async function getResourceComments(resourceId: number): Promise<ResourceComment[]> {
  const online = await isServerAvailable();
  if (!online) return [];
  const res = await fetch(`${BASE}/${resourceId}/comments`);
  const data = await res.json();
  return data.comments || [];
}

export async function addResourceComment(
  resourceId: number,
  payload: { author: string; tag: string; body: string }
): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${resourceId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function batchUpdateResources(
  records: Array<Partial<ResourcePayload> & { id: number; changedBy?: string }>,
  globalChangedBy?: string
): Promise<{ ok: boolean; updated: number; notFound: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, updated: 0, notFound: 0 };
  const res = await fetch(`${BASE}/batch`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ records, changedBy: globalChangedBy }),
  });
  const data = await res.json();
  return { ok: data.ok === true, updated: data.updated || 0, notFound: data.notFound || 0 };
}

export async function updateResourceComment(
  resourceId: number,
  commentId: number,
  payload: { body: string; tag?: string }
): Promise<{ ok: boolean; updated_at?: string }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/${resourceId}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  return { ok: data.ok === true, updated_at: data.updated_at };
}

export async function deleteResourceComment(resourceId: number, commentId: number): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${resourceId}/comments/${commentId}`, { method: 'DELETE' });
  const data = await res.json();
  return data.ok === true;
}

export async function setProcessLink(resourceId: number, processId: number | null, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${resourceId}/process-link`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ processId, changedBy: changedBy || 'system' }),
  });
  const data = await res.json();
  return data.ok === true;
}

// ── Beeline Link ─────────────────────────────────────────────────────────────

export async function setBeelineLink(resourceId: number, beelineId: string, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) return false;
  const res = await fetch(`${BASE}/${resourceId}/beeline-link`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ beelineId, changedBy: changedBy || 'system' }),
  });
  const data = await res.json();
  return data.ok === true;
}

export async function getBeelineLinks(): Promise<{ id: number; raId: string; empName: string; beelineId: string }[]> {
  const online = await isServerAvailable();
  if (!online) return [];
  const res = await fetch(`${BASE}/beeline-links`);
  const data = await res.json();
  return (data.links || []).map((r: any) => ({
    id: r.id, raId: r.ra_id, empName: r.emp_name, beelineId: r.beeline_id,
  }));
}

export interface CrossSearchComment extends ResourceComment {
  emp_name: string;
  ra_id: string;
  allocation_status?: string;
  engagement?: string;
}

export async function searchCommentsAcrossResources(q: string): Promise<CrossSearchComment[]> {
  if (!q || q.trim().length < 2) return [];
  const online = await isServerAvailable();
  if (!online) return [];
  try {
    const res = await fetch(`${BASE}/comments-search?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    return data.results || [];
  } catch { return []; }
}
