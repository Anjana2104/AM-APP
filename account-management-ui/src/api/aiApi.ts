const BASE = '/api/ai';

export async function summarizeInteractions(
  entries: Array<{ title: string; body: string; tag: string; author: string; created_at: string }>,
  fromDate?: string,
  toDate?: string,
): Promise<{ ok: boolean; summary?: string; error?: string }> {
  try {
    const res = await fetch(`${BASE}/summarize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries, fromDate, toDate }),
    });
    const data = await res.json();
    return data;
  } catch {
    return { ok: false, error: 'Network error – could not reach server' };
  }
}
