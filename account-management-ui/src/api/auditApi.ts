/**
 * src/api/auditApi.ts
 *
 * Fetches audit log entries from the backend.
 */

const BASE = '/api/audit';

export interface AuditEntry {
  id: number;
  module: string;
  record_id: number;
  record_name: string;
  field: string;
  old_value: string;
  new_value: string;
  changed_by: string;
  changed_at: string;
}

export async function getAuditLog(module: string, recordId: number): Promise<AuditEntry[]> {
  try {
    const res = await fetch(`${BASE}/${module}/${recordId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries || [];
  } catch {
    return [];
  }
}

export async function getProcessResourceHistory(processId: number): Promise<AuditEntry[]> {
  try {
    const res = await fetch(`${BASE}/process-resources/${processId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.entries || [];
  } catch {
    return [];
  }
}

export async function addAuditLog(entry: {
  module: string;
  record_id: number;
  record_name?: string;
  field: string;
  old_value?: string;
  new_value?: string;
  changed_by?: string;
}): Promise<void> {
  try {
    await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(entry),
    });
  } catch {
    /* silently ignore */
  }
}
