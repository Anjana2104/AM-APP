import * as XLSX from 'xlsx';
import { writeMultiSheetFile } from '../../utils/xlsxExport';
import { getCurrentDateStamp } from '../../utils/styledExcelExport';
import type {
  BookingInsightRow,
  BookingTotals,
  MonthlyBookingBreakdownRow,
  QuarterlyBookingBreakdownRow,
  UnbookedInsightRow,
} from './financeInsightsTypes';

export function toBookingExportRows(rows: BookingInsightRow[]) {
  return rows.map((row) => ({
    ProjectCode: row.projectCode,
    ProjectName: row.projectName,
    Company: row.company,
    MilestoneMonth: row.milestoneMonth,
    BookedAtMonth: row.bookingMonth,
    BookingType: row.bookingType === 'anticipated' ? 'Anticipated' : 'Fixed',
    Amount: row.amount,
    Notes: row.notes || '',
  }));
}

export function toUnbookedExportRows(rows: UnbookedInsightRow[]) {
  return rows.map((row) => ({
    ProjectCode: row.projectCode,
    ProjectName: row.projectName,
    Company: row.company,
    Owner: row.owner,
    MilestoneMonth: row.milestoneMonth,
    MilestoneType: row.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed',
    MilestoneAmount: row.milestoneAmount,
    BookedAmount: row.bookedAmount,
    UnbookedAmount: row.unbookedAmount,
  }));
}

export function exportBookingDrilldownWorkbook(rows: BookingInsightRow[]) {
  writeMultiSheetFile(XLSX, [
    { sheetName: 'BookingDetails', type: 'json', rows: toBookingExportRows(rows) },
  ], `Booking_Insights_Details_${getCurrentDateStamp()}.xlsx`);
}

export function exportUnbookedDrilldownWorkbook(rows: UnbookedInsightRow[]) {
  writeMultiSheetFile(XLSX, [
    { sheetName: 'UnbookedDetails', type: 'json', rows: toUnbookedExportRows(rows) },
  ], `Unbooked_Insights_Details_${getCurrentDateStamp()}.xlsx`);
}

export function exportMonthlyTrendWorkbook(
  monthlyBookingBreakdown: MonthlyBookingBreakdownRow[],
  bookingTotals: BookingTotals,
  bookingRowsForFY: BookingInsightRow[],
) {
  const summaryRows = monthlyBookingBreakdown.map((month) => ({
    Month: month.month,
    Amount: month.amount,
    PercentOfTotal: bookingTotals.total ? Math.round((month.amount / bookingTotals.total) * 100) : 0,
  }));

  writeMultiSheetFile(XLSX, [
    { sheetName: 'MonthlyTrend', type: 'json', rows: summaryRows },
    { sheetName: 'OverallDetails', type: 'json', rows: toBookingExportRows(bookingRowsForFY) },
  ], `BookedAt_Month_Trend_${getCurrentDateStamp()}.xlsx`);
}

export function exportQuarterlyTrendWorkbook(
  quarterlyBookingBreakdown: QuarterlyBookingBreakdownRow[],
  bookingTotals: BookingTotals,
  bookingRowsForFY: BookingInsightRow[],
) {
  const summaryRows = quarterlyBookingBreakdown.map((quarter) => ({
    Quarter: quarter.quarter,
    Months: quarter.monthsLabel,
    Amount: quarter.amount,
    PercentOfTotal: bookingTotals.total ? Math.round((quarter.amount / bookingTotals.total) * 100) : 0,
  }));

  writeMultiSheetFile(XLSX, [
    { sheetName: 'QuarterlyTrend', type: 'json', rows: summaryRows },
    { sheetName: 'OverallDetails', type: 'json', rows: toBookingExportRows(bookingRowsForFY) },
  ], `Quarterly_Booking_Trend_${getCurrentDateStamp()}.xlsx`);
}

