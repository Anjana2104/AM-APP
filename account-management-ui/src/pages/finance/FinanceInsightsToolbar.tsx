import React from 'react';
import { Button, InputNumber, Segmented, Select, Space, Tooltip, Typography } from 'antd';
import { DollarOutlined, DownloadOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface OptionItem {
  label: string;
  value: string;
}

interface FinanceInsightsToolbarProps {
  currency: 'INR' | 'USD';
  exchangeRate: number;
  exporting: boolean;
  filterCompany: string | null;
  fiscalYear: string;
  revenueType: 'all' | 'booked' | 'anticipated';
  bookingTypeFilter: 'all' | 'fixed' | 'anticipated';
  bookedAtFilter: string | null;
  insightsTab: 'project' | 'booking';
  companyOptions: OptionItem[];
  availableFYs: string[];
  bookingMonthOptions: OptionItem[];
  onToggleCurrency: () => void;
  onExchangeRateChange: (next: number) => void;
  onFilterCompanyChange: (next: string | null) => void;
  onFiscalYearChange: (next: string) => void;
  onRevenueTypeChange: (next: 'all' | 'booked' | 'anticipated') => void;
  onBookingTypeFilterChange: (next: 'all' | 'fixed' | 'anticipated') => void;
  onBookedAtFilterChange: (next: string | null) => void;
  onExportPng: () => void;
}

export function FinanceInsightsToolbar({
  currency,
  exchangeRate,
  exporting,
  filterCompany,
  fiscalYear,
  revenueType,
  bookingTypeFilter,
  bookedAtFilter,
  insightsTab,
  companyOptions,
  availableFYs,
  bookingMonthOptions,
  onToggleCurrency,
  onExchangeRateChange,
  onFilterCompanyChange,
  onFiscalYearChange,
  onRevenueTypeChange,
  onBookingTypeFilterChange,
  onBookedAtFilterChange,
  onExportPng,
}: FinanceInsightsToolbarProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
      <Space size={6}>
        <Tooltip title={currency === 'INR' ? 'Switch to USD' : 'Switch to INR'} overlayInnerStyle={{ fontSize: '11px' }}>
          <Button
            size="small"
            icon={<DollarOutlined />}
            type={currency === 'USD' ? 'primary' : 'default'}
            onClick={onToggleCurrency}
            style={{ fontSize: '11px' }}
          >
            {currency}
          </Button>
        </Tooltip>
        {currency === 'USD' && (
          <Tooltip title="Exchange rate (INR → USD)" overlayInnerStyle={{ fontSize: '11px' }}>
            <InputNumber
              size="small"
              value={exchangeRate}
              onChange={(value) => onExchangeRateChange(value || 0.013)}
              step={0.001}
              precision={4}
              min={0.0001}
              style={{ width: 80, fontSize: '11px' }}
              prefix="×"
            />
          </Tooltip>
        )}
      </Space>
      <div style={{ flex: 1 }} />
      {companyOptions.length > 0 && (
        <Space size={4}>
          <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Company:</Text>
          <Select
            size="small"
            allowClear
            placeholder="All"
            value={filterCompany}
            onChange={(value) => onFilterCompanyChange(value ?? null)}
            options={companyOptions}
            style={{ minWidth: 130, fontSize: '11px' }}
          />
        </Space>
      )}
      {availableFYs.length > 0 && (
        <Space size={4}>
          <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>FY:</Text>
          <Select
            size="small"
            value={fiscalYear}
            onChange={(value) => onFiscalYearChange(value as string)}
            options={availableFYs.map((fy) => ({ label: fy, value: fy }))}
            style={{ minWidth: 90, fontSize: '11px' }}
          />
        </Space>
      )}
      {insightsTab === 'project' && (
        <Space size={4}>
          <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Type:</Text>
          <Segmented
            size="small"
            value={revenueType}
            onChange={(value) => onRevenueTypeChange(value as 'all' | 'booked' | 'anticipated')}
            options={[
              { label: 'All', value: 'all' },
              { label: <span style={{ color: '#52c41a', fontWeight: 500 }}>Booked</span>, value: 'booked' },
              { label: <span style={{ color: '#ff4d4f', fontWeight: 500 }}>Anticipated</span>, value: 'anticipated' },
            ]}
            style={{ fontSize: '11px' }}
          />
        </Space>
      )}
      {insightsTab === 'booking' && (
        <>
          <Space size={4}>
            <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Bookings:</Text>
            <Segmented
              size="small"
              value={bookingTypeFilter}
              onChange={(value) => onBookingTypeFilterChange(value as 'all' | 'fixed' | 'anticipated')}
              options={[
                { label: 'All', value: 'all' },
                { label: <span style={{ color: '#1677ff', fontWeight: 500 }}>Fixed</span>, value: 'fixed' },
                { label: <span style={{ color: '#ff4d4f', fontWeight: 500 }}>Anticipated</span>, value: 'anticipated' },
              ]}
              style={{ fontSize: '11px' }}
            />
          </Space>
          <Space size={4}>
            <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Booked At:</Text>
            <Select
              size="small"
              allowClear
              placeholder="All months"
              value={bookedAtFilter}
              onChange={(value) => onBookedAtFilterChange(value ?? null)}
              options={bookingMonthOptions}
              style={{ minWidth: 120, fontSize: '11px' }}
            />
          </Space>
        </>
      )}
      <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
        <Button
          size="small"
          type="text"
          icon={<DownloadOutlined style={{ fontSize: 15, color: '#8c8c8c' }} />}
          loading={exporting}
          onClick={onExportPng}
          style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }}
        />
      </Tooltip>
    </div>
  );
}

export default FinanceInsightsToolbar;
