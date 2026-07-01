import { useEffect, useMemo } from 'react';
import type {
  FinanceInsightsDataRow,
  ProjectInsightsSummary,
  ProjectMonthlyDatum,
  YearOverYearInsights,
} from './financeInsightsTypes';
import { getMonthFY } from './financeInsightsUtils';

interface UseFinanceProjectInsightsParams {
  data: FinanceInsightsDataRow[];
  monthHeaders: string[];
  filterCompany: string | null;
  revenueType: 'all' | 'booked' | 'anticipated';
  fiscalYear: string;
  setFiscalYear: (value: string) => void;
}

export function useFinanceProjectInsights({
  data,
  monthHeaders,
  filterCompany,
  revenueType,
  fiscalYear,
  setFiscalYear,
}: UseFinanceProjectInsightsParams) {
  const companyOptions = useMemo(() => {
    const seen = new Set<string>();
    data.forEach((row) => {
      if (row.company?.trim()) seen.add(row.company.trim());
    });
    return Array.from(seen).sort().map((company) => ({ value: company, label: company }));
  }, [data]);

  const filteredData = useMemo(
    () => (filterCompany ? data.filter((row) => row.company?.trim() === filterCompany) : data),
    [data, filterCompany]
  );

  const availableFYs = useMemo(() => {
    const fySet = new Set<number>();
    monthHeaders.forEach((month) => {
      const info = getMonthFY(month);
      if (info) fySet.add(info.fy);
    });
    const sorted = Array.from(fySet).sort();
    return sorted.length ? sorted.map((fy) => `FY${fy}`) : [];
  }, [monthHeaders]);

  useEffect(() => {
    if (availableFYs.length > 0 && !availableFYs.includes(fiscalYear)) {
      setFiscalYear(availableFYs[0]);
    }
  }, [availableFYs, fiscalYear, setFiscalYear]);

  const fyMonths = useMemo(() => {
    const fyNum = fiscalYear ? parseInt(fiscalYear.replace('FY', '')) : 0;
    if (!fyNum) return [];
    return monthHeaders.filter((month) => getMonthFY(month)?.fy === fyNum);
  }, [monthHeaders, fiscalYear]);

  const effectiveRev = (row: FinanceInsightsDataRow, idx: number): number => {
    if (revenueType === 'all') return row.revenue[idx] || 0;
    const month = monthHeaders[idx];
    const type = (row.milestoneTypes?.[month] || 'booked') as 'booked' | 'anticipated';
    return type === revenueType ? (row.revenue[idx] || 0) : 0;
  };

  const qData = useMemo<ProjectInsightsSummary>(() => {
    const fyNum = fiscalYear ? parseInt(fiscalYear.replace('FY', '')) : 0;
    if (!fyNum) return { quarters: [], grand: 0 };
    const startIdx = monthHeaders.findIndex((month) => {
      const info = getMonthFY(month);
      return info?.fy === fyNum && info.pos === 0;
    });
    if (startIdx === -1) return { quarters: [], grand: 0 };

    const calcQuarter = (indices: number[]) =>
      filteredData.reduce((sum, row) => sum + indices.reduce((qSum, i) => qSum + effectiveRev(row, i), 0), 0);

    const quarterTotals = [
      calcQuarter([startIdx, startIdx + 1, startIdx + 2]),
      calcQuarter([startIdx + 3, startIdx + 4, startIdx + 5]),
      calcQuarter([startIdx + 6, startIdx + 7, startIdx + 8]),
      calcQuarter([startIdx + 9, startIdx + 10, startIdx + 11]),
    ];
    const grand = quarterTotals.reduce((a, b) => a + b, 0);
    const monthLabelAt = (i: number) => monthHeaders[startIdx + i] || '';

    return {
      quarters: quarterTotals.map((value, i) => ({
        total: value,
        pct: grand ? Math.round((value / grand) * 100) : 0,
        label: `Q${i + 1}`,
        months: `${monthLabelAt(i * 3)}–${monthLabelAt(i * 3 + 2)}`,
      })),
      grand,
    };
  }, [filteredData, monthHeaders, fiscalYear, revenueType]);

  const yoyData = useMemo<YearOverYearInsights | null>(() => {
    if (availableFYs.length < 2) return null;

    const startOf = (fyStr: string) => {
      const fyNum = parseInt(fyStr.replace('FY', ''));
      return monthHeaders.findIndex((month) => {
        const info = getMonthFY(month);
        return info?.fy === fyNum && info.pos === 0;
      });
    };

    const calcYear = (fyStr: string) => {
      const startIdx = startOf(fyStr);
      if (startIdx === -1) return 0;
      return filteredData.reduce((sum, row) => {
        let yearTotal = 0;
        for (let i = startIdx; i < startIdx + 12 && i < row.revenue.length; i++) {
          yearTotal += effectiveRev(row, i);
        }
        return sum + yearTotal;
      }, 0);
    };

    const fy1 = calcYear(availableFYs[0]);
    const fy2 = calcYear(availableFYs[1]);
    return {
      fy1,
      fy2,
      pct: fy1 ? Math.round(((fy2 - fy1) / fy1) * 100) : 0,
      labels: [availableFYs[0], availableFYs[1]],
    };
  }, [filteredData, availableFYs, monthHeaders, revenueType]);

  const monthlyData = useMemo<ProjectMonthlyDatum[]>(() => {
    const fyNum = fiscalYear ? parseInt(fiscalYear.replace('FY', '')) : 0;
    if (!fyNum) return [];
    const startIdx = monthHeaders.findIndex((month) => {
      const info = getMonthFY(month);
      return info?.fy === fyNum && info.pos === 0;
    });
    if (startIdx === -1) return [];

    const months: { label: string; total: number }[] = [];
    for (let i = startIdx; i < startIdx + 12 && i < monthHeaders.length; i++) {
      const total = filteredData.reduce((sum, row) => sum + effectiveRev(row, i), 0);
      months.push({ label: monthHeaders[i], total });
    }
    const max = Math.max(...months.map((m) => m.total), 1);
    return months.map((m) => ({ ...m, pct: Math.round((m.total / max) * 100) }));
  }, [filteredData, monthHeaders, fiscalYear, revenueType]);

  return {
    companyOptions,
    filteredData,
    availableFYs,
    fyMonths,
    qData,
    yoyData,
    monthlyData,
  };
}

