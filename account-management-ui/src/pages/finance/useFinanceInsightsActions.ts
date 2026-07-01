import { message } from 'antd';
import { useState } from 'react';
import {
  exportBookingDrilldownWorkbook,
  exportMonthlyTrendWorkbook,
  exportQuarterlyTrendWorkbook,
  exportUnbookedDrilldownWorkbook,
} from './financeInsightsExportUtils';
import type {
  BookingInsightRow,
  BookingTotals,
  MonthlyBookingBreakdownRow,
  QuarterlyBookingBreakdownRow,
  UnbookedInsightRow,
} from './financeInsightsTypes';

interface UseFinanceInsightsActionsParams {
  monthlyBookingBreakdown: MonthlyBookingBreakdownRow[];
  quarterlyBookingBreakdown: QuarterlyBookingBreakdownRow[];
  bookingTotals: BookingTotals;
  bookingRowsForFY: BookingInsightRow[];
}

export function useFinanceInsightsActions({
  monthlyBookingBreakdown,
  quarterlyBookingBreakdown,
  bookingTotals,
  bookingRowsForFY,
}: UseFinanceInsightsActionsParams) {
  const [drilldownOpen, setDrilldownOpen] = useState(false);
  const [drilldownTitle, setDrilldownTitle] = useState('');
  const [drilldownRows, setDrilldownRows] = useState<BookingInsightRow[]>([]);
  const [unbookedDrilldownOpen, setUnbookedDrilldownOpen] = useState(false);
  const [unbookedDrilldownTitle, setUnbookedDrilldownTitle] = useState('');
  const [unbookedDrilldownRows, setUnbookedDrilldownRows] = useState<UnbookedInsightRow[]>([]);

  const openBookingDrilldown = (title: string, rows: BookingInsightRow[]) => {
    setDrilldownTitle(title);
    setDrilldownRows(rows);
    setDrilldownOpen(true);
  };

  const openUnbookedDrilldown = (title: string, rows: UnbookedInsightRow[]) => {
    setUnbookedDrilldownTitle(title);
    setUnbookedDrilldownRows(rows);
    setUnbookedDrilldownOpen(true);
  };

  const exportBookingDrilldownExcel = () => {
    if (!drilldownRows.length) {
      message.info('No booking details available to export');
      return;
    }
    try {
      exportBookingDrilldownWorkbook(drilldownRows);
    } catch (error) {
      console.error('[useFinanceInsightsActions] Booking drilldown export failed', error);
      message.error('Failed to export booking details');
    }
  };

  const exportUnbookedDrilldownExcel = () => {
    if (!unbookedDrilldownRows.length) {
      message.info('No unbooked details available to export');
      return;
    }
    try {
      exportUnbookedDrilldownWorkbook(unbookedDrilldownRows);
    } catch (error) {
      console.error('[useFinanceInsightsActions] Unbooked drilldown export failed', error);
      message.error('Failed to export unbooked details');
    }
  };

  const exportMonthlyTrendExcel = () => {
    if (!monthlyBookingBreakdown.length) {
      message.info('No monthly trend data available to export');
      return;
    }
    try {
      exportMonthlyTrendWorkbook(monthlyBookingBreakdown, bookingTotals, bookingRowsForFY);
    } catch (error) {
      console.error('[useFinanceInsightsActions] Monthly trend export failed', error);
      message.error('Failed to export monthly trend');
    }
  };

  const exportQuarterlyTrendExcel = () => {
    if (!quarterlyBookingBreakdown.length) {
      message.info('No quarterly trend data available to export');
      return;
    }
    try {
      exportQuarterlyTrendWorkbook(quarterlyBookingBreakdown, bookingTotals, bookingRowsForFY);
    } catch (error) {
      console.error('[useFinanceInsightsActions] Quarterly trend export failed', error);
      message.error('Failed to export quarterly trend');
    }
  };

  return {
    drilldownOpen,
    drilldownTitle,
    drilldownRows,
    unbookedDrilldownOpen,
    unbookedDrilldownTitle,
    unbookedDrilldownRows,
    openBookingDrilldown,
    openUnbookedDrilldown,
    closeBookingDrilldown: () => setDrilldownOpen(false),
    closeUnbookedDrilldown: () => setUnbookedDrilldownOpen(false),
    exportBookingDrilldownExcel,
    exportUnbookedDrilldownExcel,
    exportMonthlyTrendExcel,
    exportQuarterlyTrendExcel,
  };
}

