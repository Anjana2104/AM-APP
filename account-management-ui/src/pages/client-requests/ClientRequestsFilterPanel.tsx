import React from 'react';
import { Button, DatePicker, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

type Option = { label: string; value: string };

interface ClientRequestsFilterPanelProps {
  filters: Record<string, any>;
  setFilters: (next: Record<string, any>) => void;
  overallStatusOptions: Option[];
  processingStatusOptions: Option[];
  requestTypeOptions: Option[];
  ownerOptions: Option[];
  beelineOptions: Option[];
}

const ACTIVE_OPTIONS: Option[] = [
  { label: 'Active', value: 'active' },
  { label: 'Inactive', value: 'inactive' },
];

const ClientRequestsFilterPanel = React.forwardRef<HTMLDivElement, ClientRequestsFilterPanelProps>(function ClientRequestsFilterPanel(
  { filters, setFilters, overallStatusOptions, processingStatusOptions, requestTypeOptions, ownerOptions, beelineOptions },
  ref,
) {
  return (
    <div className="client-requests-filter-panel" ref={ref} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Text strong style={{ fontSize: '12px' }}>Filters</Text>
        <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({})}>
          Clear all
        </Button>
      </div>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline ID</div>
          <Select
            size="small"
            placeholder="Select Beeline ID"
            allowClear
            showSearch
            optionFilterProp="label"
            value={filters.beelineId || undefined}
            onChange={val => setFilters({ ...filters, beelineId: val })}
            options={beelineOptions}
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Owner</div>
          <Select
            size="small"
            placeholder={ownerOptions.length ? 'All' : 'Configure Owner values in App Settings'}
            allowClear
            showSearch
            optionFilterProp="label"
            value={filters.accountAnchor || undefined}
            onChange={val => setFilters({ ...filters, accountAnchor: val })}
            options={ownerOptions}
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Date Raised From</div>
          <DatePicker
            size="small"
            value={filters.dateRaisedFrom ? dayjs(String(filters.dateRaisedFrom)) : null}
            onChange={(val) => setFilters({ ...filters, dateRaisedFrom: val ? val.format('YYYY-MM-DD') : undefined })}
            allowClear
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Date Raised To</div>
          <DatePicker
            size="small"
            value={filters.dateRaisedTo ? dayjs(String(filters.dateRaisedTo)) : null}
            onChange={(val) => setFilters({ ...filters, dateRaisedTo: val ? val.format('YYYY-MM-DD') : undefined })}
            allowClear
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Overall Status</div>
          <Select
            size="small"
            placeholder="All"
            allowClear
            value={filters.overallStatus || undefined}
            onChange={val => setFilters({ ...filters, overallStatus: val })}
            options={overallStatusOptions}
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Processing Status</div>
          <Select
            size="small"
            placeholder="All"
            allowClear
            value={filters.processingStatus || undefined}
            onChange={val => setFilters({ ...filters, processingStatus: val })}
            options={processingStatusOptions}
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Request Type</div>
          <Select
            size="small"
            placeholder="All"
            allowClear
            value={filters.requestType || undefined}
            onChange={val => setFilters({ ...filters, requestType: val })}
            options={requestTypeOptions}
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline Status</div>
          <Select
            size="small"
            placeholder="All"
            allowClear
            value={filters.isActive || undefined}
            onChange={val => setFilters({ ...filters, isActive: val })}
            options={ACTIVE_OPTIONS}
            style={{ width: '100%', fontSize: '11px' }}
          />
        </div>
      </Space>
    </div>
  );
});

export default ClientRequestsFilterPanel;
