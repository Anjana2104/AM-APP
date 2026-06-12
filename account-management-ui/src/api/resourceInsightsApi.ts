const BASE = '/api/resource-insights';

export interface InsightEntry {
  id: number;
  resource_id: number;
  section: 'interaction' | 'escalation' | 'career_preference' | 'plan';
  title: string;
  body: string;
  tag: string;
  status: string;
  priority: string;
  target_date: string | null;
  author: string;
  created_at: string;
  updated_at: string;
}

export interface InsightStats {
  section: string;
  count: number;
  last_at: string;
}

export async function getInsights(resourceId: number, section?: string): Promise<InsightEntry[]> {
  try {
    const url = `${BASE}?resourceId=${resourceId}${section ? `&section=${section}` : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    return data.entries || [];
  } catch { return []; }
}

export async function getInsightStats(resourceId: number): Promise<InsightStats[]> {
  try {
    const res = await fetch(`${BASE}/stats?resourceId=${resourceId}`);
    const data = await res.json();
    return data.stats || [];
  } catch { return []; }
}

export async function addInsight(payload: {
  resourceId: number; section: string; title: string; body: string;
  tag: string; status?: string; priority?: string; targetDate?: string; author: string;
}): Promise<{ ok: boolean; id?: number }> {
  try {
    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.json();
  } catch { return { ok: false }; }
}

export async function updateInsight(id: number, payload: Partial<{
  title: string; body: string; tag: string; status: string; priority: string; targetDate: string; author: string;
}>): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data.ok === true;
  } catch { return false; }
}

export async function deleteInsight(id: number): Promise<boolean> {
  try {
    const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' });
    const data = await res.json();
    return data.ok === true;
  } catch { return false; }
}

export interface CrossSearchInsight extends InsightEntry {
  emp_name: string;
  ra_id: string;
  allocation_status?: string;
  engagement?: string;
}

export async function searchInsightsAcrossResources(q: string): Promise<CrossSearchInsight[]> {
  if (!q || q.trim().length < 2) return [];
  try {
    const res = await fetch(`${BASE}/search?q=${encodeURIComponent(q.trim())}`);
    const data = await res.json();
    return data.results || [];
  } catch { return []; }
}
