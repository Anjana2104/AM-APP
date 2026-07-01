import { message } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import * as financeApi from '../../api/financeApi';
import type {
  BookingInsightRow,
  BookingTotals,
  FinanceInsightsDataRow,
  MonthlyBookingBreakdownRow,
  QuarterlyBookingBreakdownRow,
  UnbookedByFilter,
  UnbookedInsightRow,
} from './financeInsightsTypes';
import { deriveProjectCode, monthSortKey } from './financeInsightsUtils';

interface UseFinanceBookingInsightsParams {
  data: FinanceInsightsDataRow[];
  filteredData: FinanceInsightsDataRow[];
  monthHeaders: string[];
  fyMonths: string[];
  filterCompany: string | null;
  bookingTypeFilter: 'all' | 'fixed' | 'anticipated';
  bookedAtFilter: string | null;
}

export function useFinanceBookingInsights({
  data,
  filteredData,
  monthHeaders,
  fyMonths,
  filterCompany,
  bookingTypeFilter,
  bookedAtFilter,
}: UseFinanceBookingInsightsParams) {
  const [bookingRows, setBookingRows] = useState<BookingInsightRow[]>([]);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const loadBookings = async () => {
      const projectsWithId = data.filter((row) => !!row.id);
      if (!projectsWithId.length) {
        setBookingRows([]);
        return;
      }
      setBookingLoading(true);
      try {
        const bookingPayload = await Promise.all(
          projectsWithId.map(async (projectRow) => {
            const rows = await financeApi.getBookings(projectRow.id!);
            return { projectRow, rows };
          })
        );
        if (cancelled) return;
        const flattened: BookingInsightRow[] = bookingPayload.flatMap(({ projectRow, rows }) =>
          rows.map((booking) => ({
            bookingId: booking.id,
            projectId: booking.project_id,
            projectCode: projectRow.code || deriveProjectCode(projectRow.project),
            projectName: projectRow.project,
            company: projectRow.company || '',
            owner: projectRow.owner || '',
            milestoneMonth: booking.milestone_month,
            bookingMonth: booking.booking_month,
            amount: booking.amount || 0,
            bookingType: booking.booking_type || 'fixed',
            notes: booking.notes || '',
          }))
        );
        setBookingRows(flattened);
      } catch (error) {
        console.error('[useFinanceBookingInsights] Failed to load booking insights', error);
        if (!cancelled) message.error('Failed to load booking insights');
      } finally {
        if (!cancelled) setBookingLoading(false);
      }
    };
    loadBookings();
    return () => { cancelled = true; };
  }, [data]);

  const bookingMonthOptions = useMemo(() => {
    const monthSet = new Set<string>();
    bookingRows.forEach((row) => monthSet.add(row.bookingMonth));
    return Array.from(monthSet)
      .sort((a, b) => monthSortKey(a) - monthSortKey(b))
      .map((month) => ({ label: month, value: month }));
  }, [bookingRows]);

  const filteredBookingRows = useMemo(() => {
    return bookingRows.filter((row) => {
      if (filterCompany && (row.company || '').trim() !== filterCompany) return false;
      if (bookingTypeFilter !== 'all' && row.bookingType !== bookingTypeFilter) return false;
      if (bookedAtFilter && row.bookingMonth !== bookedAtFilter) return false;
      return true;
    });
  }, [bookingRows, filterCompany, bookingTypeFilter, bookedAtFilter]);

  const bookingRowsForFY = useMemo(() => {
    if (!fyMonths.length) return [];
    const fyMonthSet = new Set(fyMonths);
    return filteredBookingRows.filter((row) => fyMonthSet.has(row.bookingMonth));
  }, [filteredBookingRows, fyMonths]);

  const bookingTotals = useMemo<BookingTotals>(() => {
    const total = bookingRowsForFY.reduce((sum, row) => sum + row.amount, 0);
    const fixed = bookingRowsForFY
      .filter((row) => row.bookingType === 'fixed')
      .reduce((sum, row) => sum + row.amount, 0);
    const anticipated = bookingRowsForFY
      .filter((row) => row.bookingType === 'anticipated')
      .reduce((sum, row) => sum + row.amount, 0);
    const projects = new Set(bookingRowsForFY.map((row) => row.projectCode)).size;
    return { total, fixed, anticipated, projects };
  }, [bookingRowsForFY]);

  const monthlyBookingBreakdown = useMemo<MonthlyBookingBreakdownRow[]>(() => {
    if (!fyMonths.length) return [];
    return fyMonths.map((month) => {
      const rows = bookingRowsForFY.filter((row) => row.bookingMonth === month);
      return {
        month,
        amount: rows.reduce((sum, row) => sum + row.amount, 0),
        rows,
      };
    });
  }, [bookingRowsForFY, fyMonths]);

  const quarterlyBookingBreakdown = useMemo<QuarterlyBookingBreakdownRow[]>(() => {
    if (!fyMonths.length) return [];
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    return quarters.map((quarter, idx) => {
      const quarterMonths = fyMonths.slice(idx * 3, idx * 3 + 3);
      const monthSet = new Set(quarterMonths);
      const rows = bookingRowsForFY.filter((row) => monthSet.has(row.bookingMonth));
      return {
        quarter,
        monthsLabel: quarterMonths.join(' - '),
        amount: rows.reduce((sum, row) => sum + row.amount, 0),
        rows,
      };
    });
  }, [bookingRowsForFY, fyMonths]);

  const unbookedInsights = useMemo(() => {
    if (!fyMonths.length) {
      return {
        fixedRows: [] as UnbookedInsightRow[],
        anticipatedRows: [] as UnbookedInsightRow[],
        fixedTotal: 0,
        anticipatedTotal: 0,
      };
    }

    const scopedBookingRows = bookingRows.filter((row) => {
      if (filterCompany && (row.company || '').trim() !== filterCompany) return false;
      if (bookedAtFilter && row.bookingMonth !== bookedAtFilter) return false;
      return fyMonths.includes(row.bookingMonth);
    });

    const bookedByMilestone = new Map<string, number>();
    scopedBookingRows.forEach((row) => {
      const key = `${row.projectCode}|${row.milestoneMonth}|${row.bookingType}`;
      bookedByMilestone.set(key, (bookedByMilestone.get(key) || 0) + row.amount);
    });

    const allUnbookedRows: UnbookedInsightRow[] = [];
    filteredData.forEach((project) => {
      fyMonths.forEach((month) => {
        const monthIdx = monthHeaders.indexOf(month);
        if (monthIdx === -1) return;

        const milestoneAmount = project.revenue[monthIdx] || 0;
        if (!milestoneAmount) return;

        const milestoneType: 'fixed' | 'anticipated' =
          (project.milestoneTypes?.[month] || 'booked') === 'anticipated' ? 'anticipated' : 'fixed';
        const projectCode = project.code || deriveProjectCode(project.project);
        const bookedAmount = bookedByMilestone.get(`${projectCode}|${month}|${milestoneType}`) || 0;
        const unbookedAmount = Math.max(milestoneAmount - bookedAmount, 0);
        if (!unbookedAmount) return;

        allUnbookedRows.push({
          key: `${projectCode}_${month}_${milestoneType}`,
          projectCode,
          projectName: project.project,
          company: project.company || '',
          owner: project.owner || '',
          milestoneMonth: month,
          milestoneType,
          milestoneAmount,
          bookedAmount,
          unbookedAmount,
        });
      });
    });

    const fixedRows = allUnbookedRows.filter((row) => row.milestoneType === 'fixed');
    const anticipatedRows = allUnbookedRows.filter((row) => row.milestoneType === 'anticipated');
    return {
      fixedRows,
      anticipatedRows,
      fixedTotal: fixedRows.reduce((sum, row) => sum + row.unbookedAmount, 0),
      anticipatedTotal: anticipatedRows.reduce((sum, row) => sum + row.unbookedAmount, 0),
    };
  }, [bookingRows, filterCompany, bookedAtFilter, fyMonths, filteredData, monthHeaders]);

  const unbookedByFilter = useMemo<UnbookedByFilter>(() => {
    if (bookingTypeFilter === 'fixed') {
      return {
        label: 'Fixed',
        rows: unbookedInsights.fixedRows,
        total: unbookedInsights.fixedTotal,
        color: '#faad14',
      };
    }
    if (bookingTypeFilter === 'anticipated') {
      return {
        label: 'Anticipated',
        rows: unbookedInsights.anticipatedRows,
        total: unbookedInsights.anticipatedTotal,
        color: '#ff7a45',
      };
    }
    return {
      label: 'All',
      rows: [...unbookedInsights.fixedRows, ...unbookedInsights.anticipatedRows],
      total: unbookedInsights.fixedTotal + unbookedInsights.anticipatedTotal,
      color: '#fa8c16',
    };
  }, [bookingTypeFilter, unbookedInsights]);

  return {
    bookingLoading,
    bookingMonthOptions,
    bookingRowsForFY,
    bookingTotals,
    monthlyBookingBreakdown,
    quarterlyBookingBreakdown,
    unbookedByFilter,
  };
}

