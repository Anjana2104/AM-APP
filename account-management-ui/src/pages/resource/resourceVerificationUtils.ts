const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toFiniteNumber(value: unknown): number | null {
  const sanitized = String(value ?? '').replace(/[^\d.-]/g, '').trim();
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function truncateToTwoDecimals(value: number): number {
  return Math.trunc(value * 100) / 100;
}

export function formatTwoDecimalNoRound(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—';
  const truncated = truncateToTwoDecimals(value);
  return truncated.toFixed(2).replace(/\.?0+$/, '');
}

export function calculateExperienceYearsFromDoj(doj: string, today = new Date()): number | null {
  const dojTrimmed = String(doj || '').trim();
  if (!dojTrimmed) return null;
  const parsed = new Date(`${dojTrimmed}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return null;
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const start = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
  const diffDays = Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return 0;
  return truncateToTwoDecimals(diffDays / 365.25);
}

export function resolveExperienceBucket(experienceYears: number | null): string {
  if (experienceYears == null || !Number.isFinite(experienceYears)) return '—';
  const normalized = truncateToTwoDecimals(experienceYears);
  if (normalized < 3) return '0-3 Yrs';
  if (normalized < 5) return '3-5 Yrs';
  if (normalized < 8) return '5-8 Yrs';
  if (normalized < 10) return '8-10 Yrs';
  return '10+ Yrs';
}

export function parseWorkexNumber(value: unknown): number | null {
  const parsed = toFiniteNumber(value);
  if (parsed == null) return null;
  return truncateToTwoDecimals(parsed);
}
