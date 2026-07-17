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
  eprev?: string;
  comments: string;
  accountAnchor?: string;
  changedBy?: string;
  /** ID of the linked finance_projects record (SOW Details); null = unlinked */
  financeProjectId?: number | null;
  /** Joined field returned by GET /api/process */
  financeProjectName?: string;
  financeProjectCode?: string;
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
    try {
      const res = await fetch(BASE);
      if (!res.ok) {
        return { rows: [], fromServer: true };
      }
      const data = await res.json();
      return { rows: data.rows || [], fromServer: true };
    } catch {
      return { rows: [], fromServer: true };
    }
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
  if (!res.ok) throw new Error(data.error || 'Update failed');
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

export interface ResourceInsightRow {
  projectId: number;
  projectName: string;
  projectCode: string;
  projectStatus: string;
  sowId: number;
  sow: string;
  processId: string;
  processActive: string;
  resourceId: number;
  raId: string;
  empName: string;
  piwRole: string;
  engagementStartDate: string;
  engagementEndDate: string;
}

function normalizeProcessActive(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  return (normalized === 'yes' || normalized === 'active' || normalized === 'true' || normalized === '1') ? 'Yes' : 'No';
}

function normalizeProjectStatus(value: unknown): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'active' || normalized === 'yes' || normalized === 'true' || normalized === '1') return 'Active';
  if (normalized === 'inactive' || normalized === 'no' || normalized === 'false' || normalized === '0') return 'Inactive';
  return 'Active';
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

/** Link or unlink an internal process to a SOW details record (finance_projects).
 *  Pass financeProjectId=null to unlink. */
export async function linkToSow(
  processId: number,
  financeProjectId: number | null,
  changedBy?: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${BASE}/${processId}/sow-link`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ financeProjectId, changedBy }),
    });
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'Failed to update link' };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

/** Get all internal processes linked to a specific SOW details record. */
export async function getLinkedProcesses(financeProjectId: number): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/by-sow/${financeProjectId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.rows || [];
  } catch { return []; }
}

/** Flat row dataset for Finance → SOW Resource Insights tab. */
export async function getResourceInsights(): Promise<ResourceInsightRow[]> {
  try {
    const res = await fetch(`${BASE}/resource-insights`);
    if (!res.ok) {
      const error = new Error(`Resource insights request failed with status ${res.status}`);
      console.error('[processApi.getResourceInsights] Request failed', error);
      throw error;
    }
    const data = await res.json();
    const pickText = (row: any, keys: string[]): string => {
      for (const key of keys) {
        const val = row?.[key];
        if (val == null) continue;
        const text = String(val).trim();
        if (text) return text;
      }
      return '';
    };
    const pickNumber = (row: any, keys: string[]): number => {
      for (const key of keys) {
        const val = Number(row?.[key]);
        if (!Number.isNaN(val) && val > 0) return val;
      }
      return 0;
    };
    return (data.rows || []).map((row: any) => ({
      projectId: pickNumber(row, ['project_id', 'projectId']),
      projectName: pickText(row, ['project_name', 'projectName', 'project', 'finance_project_name']),
      projectCode: pickText(row, ['project_code', 'projectCode', 'code', 'finance_project_code']),
      projectStatus: normalizeProjectStatus(row.project_status ?? row.projectStatus ?? row.status),
      sowId: pickNumber(row, ['sow_id', 'sowId', 'finance_project_id']),
      sow: pickText(row, ['sow', 'sow_name', 'sowName']),
      processId: pickText(row, ['process_id', 'processId', 'id']),
      processActive: normalizeProcessActive(row.process_active ?? row.processActive ?? row.active),
      resourceId: pickNumber(row, ['resource_id', 'resourceId', 'id']),
      raId: pickText(row, ['ra_id', 'raId']),
      empName: pickText(row, ['emp_name', 'empName', 'resource_name', 'resourceName', 'name']),
      piwRole: pickText(row, ['piw_role', 'piwRole', 'role']),
      engagementStartDate: pickText(row, ['engagement_start_date', 'engagementStartDate', 'start_date', 'startDate']),
      engagementEndDate: pickText(row, ['engagement_end_date', 'engagementEndDate', 'end_date', 'endDate']),
    }));
  } catch (error) {
    console.error('[processApi.getResourceInsights] Failed to fetch resource insights', error);
    throw error;
  }
}
