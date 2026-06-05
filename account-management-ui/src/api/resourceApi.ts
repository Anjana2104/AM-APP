/**
 * src/api/resourceApi.ts
 *
 * Resource data API client — mirrors financeApi pattern.
 * Falls back gracefully if server is offline.
 */

const BASE = '/api/resources';

export interface ResourcePayload {
  id?: number;
  sno?: number;
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
export async function bulkSave(resources: ResourcePayload[]): Promise<{ ok: boolean; inserted: number; updated: number }> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, inserted: 0, updated: 0 };
  const res = await fetch(`${BASE}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ resources }),
  });
  return res.json();
}

// Update one resource
export async function updateResource(id: number, payload: Partial<ResourcePayload>): Promise<boolean> {
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
