/**
 * src/api/invoiceApi.ts
 *
 * Invoice data API client.
 * Calls the Express backend at /api/invoice/*.
 */

const BASE = '/api/invoice';

export interface InvoiceProject {
  id?: number;
  sno?: number;
  project: string;
  company?: string;
  code: string;
  /** 'Active' | 'Inactive' — driven from backend DB status field */
  status?: 'Active' | 'Inactive';
  /** @deprecated use status instead; kept for backward compat with existing DB rows */
  active?: number | boolean;
  /** keyed by month label e.g. "Oct'25" → number */
  revenue: Record<string, number>;
  monthHeaders?: string[];
}

// ── GET projects ──────────────────────────────────────────────────────────────
export async function getInvoiceProjects(): Promise<{ projects: InvoiceProject[]; months: string[]; fromServer: boolean }> {
  try {
    const [pRes, mRes] = await Promise.all([
      fetch(`${BASE}/projects`),
      fetch(`${BASE}/month-headers`),
    ]);
    if (!pRes.ok || !mRes.ok) return { projects: [], months: [], fromServer: false };
    const { projects } = await pRes.json();
    const { months } = await mRes.json();
    return { projects, months, fromServer: true };
  } catch {
    return { projects: [], months: [], fromServer: false };
  }
}

// ── Bulk save (full replace) ──────────────────────────────────────────────────
export async function bulkSaveInvoices(projects: InvoiceProject[], monthHeaders: string[]): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/projects/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projects, monthHeaders }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Server error' };
    return { ok: data.ok === true };
  } catch {
    return { ok: false };
  }
}

// ── Create one project ────────────────────────────────────────────────────────
export async function createInvoiceProject(payload: InvoiceProject): Promise<{ ok: boolean; id?: number }> {
  try {
    const res = await fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch {
    return { ok: false };
  }
}

// ── Update one project ────────────────────────────────────────────────────────
export async function updateInvoiceProject(id: number, payload: Partial<InvoiceProject> & { status?: 'Active' | 'Inactive'; monthHeaders?: string[] }): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/projects/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// ── Delete one project ────────────────────────────────────────────────────────
export async function deleteInvoiceProject(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/projects/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}

// ── Clear all projects ────────────────────────────────────────────────────────
export async function clearAllInvoices(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/projects`, { method: 'DELETE' });
    const data = await res.json();
    return data.ok === true;
  } catch {
    return false;
  }
}
