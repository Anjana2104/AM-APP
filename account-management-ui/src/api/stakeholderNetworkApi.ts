const BASE = '/api/team-hierarchy';

export type StakeholderNetworkType = 'client' | 'ra';

export interface StakeholderNetworkRecord {
  id: string;
  teamType: StakeholderNetworkType;
  name: string;
  title: string;
  department: string;
  reportingTo: string | null;
  responsibility: string;
  email: string;
  phone?: string;
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface StakeholderCommentRecord {
  id: number;
  stakeholderId: string;
  stakeholderTeamType: StakeholderNetworkType;
  stakeholderName: string;
  stakeholderTitle: string;
  author: string;
  tag: 'Interactions' | 'Escalations' | 'Current Requirement' | 'Future Requirement';
  body: string;
  requirementRequestId?: number | null;
  requirementRequestBeeline?: string;
  linkedResourceIds: number[];
  linkedResourceLabels: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface StakeholderCommentAuditEntry {
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

let serverAvailableCache: boolean | null = null;

async function isServerAvailable(): Promise<boolean> {
  if (serverAvailableCache === true) return true;
  try {
    const response = await fetch('/api/health', { signal: AbortSignal.timeout(3000) });
    if (response.ok) {
      serverAvailableCache = true;
      return true;
    }
    console.warn('[StakeholderNetworkApi] Health endpoint returned non-OK status', response.status);
    return false;
  } catch (error) {
    console.warn('[StakeholderNetworkApi] Health check failed', error);
    return false;
  }
}

export function resetStakeholderNetworkServerCache() {
  serverAvailableCache = null;
}

export async function getStakeholderNetworkRecords(
  teamType: StakeholderNetworkType
): Promise<{ stakeholders: StakeholderNetworkRecord[]; fromServer: boolean }> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while loading records', { teamType });
    return { stakeholders: [], fromServer: false };
  }

  const response = await fetch(`${BASE}?teamType=${encodeURIComponent(teamType)}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${teamType} hierarchy`);
  }
  const data = await response.json();
  return { stakeholders: data.stakeholders || [], fromServer: true };
}

export async function bulkSaveStakeholderNetworkRecords(
  teamType: StakeholderNetworkType,
  stakeholders: StakeholderNetworkRecord[],
  changedBy?: string
): Promise<{ ok: boolean; inserted: number }> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while saving records', {
      teamType,
      rowCount: stakeholders.length,
      changedBy: changedBy || 'system',
    });
    return { ok: false, inserted: 0 };
  }

  const response = await fetch(`${BASE}/${encodeURIComponent(teamType)}/bulk`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stakeholders, changedBy: changedBy || 'system' }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({ error: 'Save failed' }));
    throw new Error(data.error || 'Failed to save stakeholder network');
  }

  return response.json();
}

export async function getStakeholderComments(stakeholderId: string): Promise<StakeholderCommentRecord[]> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while loading stakeholder comments', { stakeholderId });
    return [];
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(stakeholderId)}/comments`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch stakeholder comments');
  }
  const data = await response.json();
  return (data.comments || []) as StakeholderCommentRecord[];
}

export async function getTeamTypeComments(teamType: StakeholderNetworkType): Promise<StakeholderCommentRecord[]> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while loading team comments', { teamType });
    return [];
  }
  const response = await fetch(`${BASE}/comments?teamType=${encodeURIComponent(teamType)}`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch team comments');
  }
  const data = await response.json();
  return (data.comments || []) as StakeholderCommentRecord[];
}

export async function addStakeholderComment(
  stakeholderId: string,
  payload: {
    author: string;
    tag: StakeholderCommentRecord['tag'];
    body: string;
    linkedResourceIds?: number[];
    changedBy?: string;
  }
): Promise<{ ok: boolean; id?: number }> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while adding stakeholder comment', { stakeholderId, tag: payload.tag });
    return { ok: false };
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(stakeholderId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to create stakeholder comment');
  }
  const data = await response.json();
  return { ok: data.ok === true, id: data.id };
}

export async function updateStakeholderComment(
  stakeholderId: string,
  commentId: number,
  payload: {
    body: string;
    linkedResourceIds?: number[];
    changedBy?: string;
  }
): Promise<{ ok: boolean; updatedAt?: string }> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while updating stakeholder comment', { stakeholderId, commentId });
    return { ok: false };
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(stakeholderId)}/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update stakeholder comment');
  }
  const data = await response.json();
  return { ok: data.ok === true, updatedAt: data.updatedAt };
}

export async function deleteStakeholderComment(stakeholderId: string, commentId: number, changedBy?: string): Promise<boolean> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while deleting stakeholder comment', { stakeholderId, commentId });
    return false;
  }
  const suffix = changedBy ? `?changedBy=${encodeURIComponent(changedBy)}` : '';
  const response = await fetch(`${BASE}/${encodeURIComponent(stakeholderId)}/comments/${commentId}${suffix}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to delete stakeholder comment');
  }
  const data = await response.json();
  return data.ok === true;
}

export async function getStakeholderCommentAudit(stakeholderId: string): Promise<StakeholderCommentAuditEntry[]> {
  const online = await isServerAvailable();
  if (!online) {
    console.warn('[StakeholderNetworkApi] Server unavailable while loading stakeholder comment audit', { stakeholderId });
    return [];
  }
  const response = await fetch(`${BASE}/${encodeURIComponent(stakeholderId)}/comment-audit`);
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to fetch stakeholder comment audit');
  }
  const data = await response.json();
  return (data.entries || []) as StakeholderCommentAuditEntry[];
}
