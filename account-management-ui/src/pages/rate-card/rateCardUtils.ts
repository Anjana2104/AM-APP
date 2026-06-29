export type Currency = 'INR' | 'USD';

export const HOURS_PER_DAY = 8;
export const WORKING_DAYS_PER_MONTH = 22;
export const USD_CONVERSION_FACTOR = 0.013;

export type RateBand = {
  key: string;
  experienceRange: string;
  commodityDailyInr: number;
  specializedDailyInr: number;
};

export type CalculatedRateRow = {
  key: string;
  experienceRange: string;
  commodityHourly: number;
  commodityDaily: number;
  commodityMonthly: number;
  specializedHourly: number;
  specializedDaily: number;
  specializedMonthly: number;
};

function toNum(value: unknown): number | null {
  const sanitized = String(value ?? '').replace(/,/g, '').trim();
  if (!sanitized) return null;
  const parsed = Number(sanitized);
  return Number.isFinite(parsed) ? parsed : null;
}

function getRangeSortValue(range: string): number {
  const cleaned = range.replace(/\s+/g, '');
  const between = cleaned.match(/^(\d+)-(\d+)/);
  if (between) return Number(between[1]);
  const plus = cleaned.match(/^(\d+)\+/);
  if (plus) return Number(plus[1]);
  return Number.MAX_SAFE_INTEGER;
}

export function parseRateBandsFromTemplateRows(rows: Record<string, any>[]): RateBand[] {
  const bands = rows
    .map((row, index) => {
      const exp = String(row['Experience Range'] ?? row['Experience'] ?? row['Exp'] ?? '').trim();
      const commodityDailyInr = toNum(row['For Commodity Skills'] ?? row['Commodity Daily'] ?? row['Commodity']);
      const specializedDailyInr = toNum(row['For Specialized Skills'] ?? row['Specialized Daily'] ?? row['Specialized']);
      if (!exp || commodityDailyInr == null || specializedDailyInr == null) return null;
      if (!/(\d+\s*-\s*\d+|\d+\s*\+)/.test(exp)) return null;
      return { key: `band_${index}`, experienceRange: exp, commodityDailyInr, specializedDailyInr };
    })
    .filter((band): band is RateBand => Boolean(band));

  return bands.sort((a, b) => getRangeSortValue(a.experienceRange) - getRangeSortValue(b.experienceRange));
}

function convertInrToCurrency(valueInr: number, currency: Currency): number {
  return currency === 'USD' ? valueInr * USD_CONVERSION_FACTOR : valueInr;
}

export function buildCalculatedRows(bands: RateBand[], currency: Currency): CalculatedRateRow[] {
  return bands.map(band => {
    const commodityDaily = convertInrToCurrency(band.commodityDailyInr, currency);
    const specializedDaily = convertInrToCurrency(band.specializedDailyInr, currency);

    return {
      key: band.key,
      experienceRange: band.experienceRange,
      commodityHourly: commodityDaily / HOURS_PER_DAY,
      commodityDaily,
      commodityMonthly: commodityDaily * WORKING_DAYS_PER_MONTH,
      specializedHourly: specializedDaily / HOURS_PER_DAY,
      specializedDaily,
      specializedMonthly: specializedDaily * WORKING_DAYS_PER_MONTH,
    };
  });
}
