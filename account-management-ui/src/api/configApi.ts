/**
 * src/api/configApi.ts
 *
 * Configuration API client — calls /api/config/*.
 * Falls back gracefully when server is offline.
 */

const BASE = '/api/config';

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

// ── Config Types ──────────────────────────────────────────────────────

export async function getConfigTypes(): Promise<{ configTypes: any[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (online) {
    try {
      const res = await fetch(`${BASE}/`);
      const data = await res.json();
      return { configTypes: data.configTypes || [], fromServer: true };
    } catch {
      // fall through
    }
  }
  return { configTypes: [], fromServer: false };
}

export async function createType(data: {
  typeId: string;
  name: string;
  description?: string;
  builtIn?: boolean;
  linkedTo?: string[];
}): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/types`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function updateType(
  typeId: string,
  data: { name?: string; description?: string; linkedTo?: string[] }
): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/types/${encodeURIComponent(typeId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteType(typeId: string): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/types/${encodeURIComponent(typeId)}`, { method: 'DELETE' });
  return res.json();
}

export async function deleteAllTypes(): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/types`, { method: 'DELETE' });
  return res.json();
}

// ── Config Items ──────────────────────────────────────────────────────

export async function addItem(
  typeId: string,
  item: { itemValue: string; label: string; color?: string }
): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/types/${encodeURIComponent(typeId)}/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  return res.json();
}

export async function updateItem(
  typeId: string,
  itemValue: string,
  data: { label?: string; color?: string }
): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(
    `${BASE}/types/${encodeURIComponent(typeId)}/items/${encodeURIComponent(itemValue)}`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  );
  return res.json();
}

export async function deleteItem(typeId: string, itemValue: string): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(
    `${BASE}/types/${encodeURIComponent(typeId)}/items/${encodeURIComponent(itemValue)}`,
    { method: 'DELETE' }
  );
  return res.json();
}

export async function reorderItems(typeId: string, items: any[]): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/types/${encodeURIComponent(typeId)}/items`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items }),
  });
  return res.json();
}

export async function bulkImport(
  entries: Array<{ name: string; values: string[] }>
): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false, created: 0, added: 0 };
  const res = await fetch(`${BASE}/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entries }),
  });
  return res.json();
}

// ── App Values ────────────────────────────────────────────────────────

export async function getValues(): Promise<{ values: any[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (online) {
    try {
      const res = await fetch(`${BASE}/values`);
      const data = await res.json();
      return { values: data.values || [], fromServer: true };
    } catch {
      // fall through
    }
  }
  return { values: [], fromServer: false };
}

export async function upsertValue(key: string, value: string, description?: string): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/values`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value, description: description ?? '' }),
  });
  return res.json();
}

export async function deleteValue(key: string): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/values/${encodeURIComponent(key)}`, { method: 'DELETE' });
  return res.json();
}

export async function deleteAllValues(): Promise<any> {
  const online = await isServerAvailable();
  if (!online) return { ok: false };
  const res = await fetch(`${BASE}/values`, { method: 'DELETE' });
  return res.json();
}
