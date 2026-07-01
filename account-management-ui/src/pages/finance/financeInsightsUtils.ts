const MONTH_ORDER_FM = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

export function deriveProjectCode(name: string): string {
  return name.split(' - ')[0].trim() || name;
}

export function getMonthFY(label: string): { fy: number; pos: number } | null {
  const m = label.trim().match(/^([A-Za-z]{3})[''`](\d{2})$/);
  if (!m) return null;
  const pos = MONTH_ORDER_FM.indexOf(m[1]);
  if (pos === -1) return null;
  const yr = 2000 + parseInt(m[2]);
  return { fy: pos < 3 ? yr + 1 : yr, pos };
}

export function monthSortKey(label: string): number {
  const info = getMonthFY(label);
  if (!info) return Number.MAX_SAFE_INTEGER;
  return info.fy * 100 + info.pos;
}

