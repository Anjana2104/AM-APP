import React, { useRef, useState } from 'react';
import { Empty, message } from 'antd';
import { exportChartAsPng } from '../../utils/exportChartAsPng';
import { FinanceProjectInsightsTab } from './FinanceProjectInsightsTab';
import { FinanceBookingInsightsTab } from './FinanceBookingInsightsTab';
import { FinanceInsightsToolbar } from './FinanceInsightsToolbar';
import { FinanceInsightsTabsHeader } from './FinanceInsightsTabsHeader';
import { useFinanceProjectInsights } from './useFinanceProjectInsights';
import { useFinanceBookingInsights } from './useFinanceBookingInsights';
import { useFinanceInsightsActions } from './useFinanceInsightsActions';
import type { FinanceInsightsDataRow } from './financeInsightsTypes';

const inr = (n: number) =>
  n ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}` : '—';

const usd = (n: number) =>
  n ? `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

export interface FinanceInsightsProps {
  data: FinanceInsightsDataRow[];
  monthHeaders: string[];
}

export function FinanceInsightsPanel({ data, monthHeaders }: FinanceInsightsProps) {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);
  const [exporting, setExporting] = useState(false);
  const [filterCompany, setFilterCompany] = useState<string | null>(null);
  const [revenueType, setRevenueType] = useState<'all' | 'booked' | 'anticipated'>('all');
  const [bookingTypeFilter, setBookingTypeFilter] = useState<'all' | 'fixed' | 'anticipated'>('all');
  const [bookedAtFilter, setBookedAtFilter] = useState<string | null>(null);
  const [insightsTab, setInsightsTab] = useState<'project' | 'booking'>('project');
  const [fiscalYear, setFiscalYear] = useState<string>('');
  const insightsRef = useRef<HTMLDivElement>(null);

  const {
    companyOptions,
    filteredData,
    availableFYs,
    fyMonths,
    qData,
    yoyData,
    monthlyData,
  } = useFinanceProjectInsights({
    data,
    monthHeaders,
    filterCompany,
    revenueType,
    fiscalYear,
    setFiscalYear,
  });

  const {
    bookingLoading,
    bookingMonthOptions,
    bookingRowsForFY,
    bookingTotals,
    monthlyBookingBreakdown,
    quarterlyBookingBreakdown,
    unbookedByFilter,
  } = useFinanceBookingInsights({
    data,
    filteredData,
    monthHeaders,
    fyMonths,
    filterCompany,
    bookingTypeFilter,
    bookedAtFilter,
  });

  const {
    drilldownOpen,
    drilldownTitle,
    drilldownRows,
    unbookedDrilldownOpen,
    unbookedDrilldownTitle,
    unbookedDrilldownRows,
    openBookingDrilldown,
    openUnbookedDrilldown,
    closeBookingDrilldown,
    closeUnbookedDrilldown,
    exportBookingDrilldownExcel,
    exportUnbookedDrilldownExcel,
    exportMonthlyTrendExcel,
    exportQuarterlyTrendExcel,
  } = useFinanceInsightsActions({
    monthlyBookingBreakdown,
    quarterlyBookingBreakdown,
    bookingTotals,
    bookingRowsForFY,
  });

  const fmt = (n: number) =>
    currency === 'USD' ? usd(n * exchangeRate) : inr(n);

  const handleExportPNG = async () => {
    if (!insightsRef.current) return;
    setExporting(true);
    try {
      await exportChartAsPng(insightsRef.current, `Insights_${fiscalYear}_${new Date().toISOString().slice(0, 10)}.png`, '#f5f7fa');
    } catch {
      message.error('Failed to export PNG');
    } finally {
      setExporting(false);
    }
  };

  if (!data || !data.length) return <Empty description="Upload data to view insights" style={{ marginTop: 48 }} />;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div ref={insightsRef} style={{ padding: '4px 0 8px' }}>
        <FinanceInsightsToolbar
          currency={currency}
          exchangeRate={exchangeRate}
          exporting={exporting}
          filterCompany={filterCompany}
          fiscalYear={fiscalYear}
          revenueType={revenueType}
          bookingTypeFilter={bookingTypeFilter}
          bookedAtFilter={bookedAtFilter}
          insightsTab={insightsTab}
          companyOptions={companyOptions}
          availableFYs={availableFYs}
          bookingMonthOptions={bookingMonthOptions}
          onToggleCurrency={() => setCurrency((c) => (c === 'INR' ? 'USD' : 'INR'))}
          onExchangeRateChange={setExchangeRate}
          onFilterCompanyChange={setFilterCompany}
          onFiscalYearChange={setFiscalYear}
          onRevenueTypeChange={setRevenueType}
          onBookingTypeFilterChange={setBookingTypeFilter}
          onBookedAtFilterChange={setBookedAtFilter}
          onExportPng={handleExportPNG}
        />

        <FinanceInsightsTabsHeader activeTab={insightsTab} onTabChange={setInsightsTab} />

        {insightsTab === 'project' && (
          <FinanceProjectInsightsTab
            currency={currency}
            fiscalYear={fiscalYear}
            filteredProjectCount={filteredData.length}
            revenueType={revenueType}
            qData={qData}
            monthlyData={monthlyData}
            yoyData={yoyData}
            fmt={fmt}
          />
        )}

        {insightsTab === 'booking' && (
          <FinanceBookingInsightsTab
            bookingLoading={bookingLoading}
            bookingRowsForFY={bookingRowsForFY}
            bookingTotals={bookingTotals}
            unbookedByFilter={unbookedByFilter}
            monthlyBookingBreakdown={monthlyBookingBreakdown}
            quarterlyBookingBreakdown={quarterlyBookingBreakdown}
            drilldownOpen={drilldownOpen}
            drilldownTitle={drilldownTitle}
            drilldownRows={drilldownRows}
            unbookedDrilldownOpen={unbookedDrilldownOpen}
            unbookedDrilldownTitle={unbookedDrilldownTitle}
            unbookedDrilldownRows={unbookedDrilldownRows}
            openBookingDrilldown={openBookingDrilldown}
            openUnbookedDrilldown={openUnbookedDrilldown}
            closeBookingDrilldown={closeBookingDrilldown}
            closeUnbookedDrilldown={closeUnbookedDrilldown}
            exportMonthlyTrendExcel={exportMonthlyTrendExcel}
            exportQuarterlyTrendExcel={exportQuarterlyTrendExcel}
            exportBookingDrilldownExcel={exportBookingDrilldownExcel}
            exportUnbookedDrilldownExcel={exportUnbookedDrilldownExcel}
            fmt={fmt}
          />
        )}
      </div>
    </div>
  );
}

export default FinanceInsightsPanel;
