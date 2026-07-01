import React from 'react';
import { Button, DatePicker, Input, Select, Space, Typography } from 'antd';
import dayjs from 'dayjs';
import { ACTIVE_OPTIONS } from './shared';

const { Text } = Typography;

interface ProcessFilterPanelProps {
  show: boolean;
  filterPanelRef: React.RefObject<HTMLDivElement | null>;
  filters: Record<string, string>;
  setFilters: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  clearFilters: () => void;
  anchorOptions: Array<{ label: string; value: string }>;
}

export function ProcessFilterPanel({ show, filterPanelRef, filters, setFilters, clearFilters, anchorOptions }: ProcessFilterPanelProps) {
  if (!show) return null;

  return (
    <div ref={filterPanelRef} style={{ width: 240, flexShrink: 0, background: '#fafafa', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong style={{ fontSize: '12px' }}>Filters</Text>
        <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={clearFilters}>Clear all</Button>
      </div>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>SOW</div>
          <Input size="small" placeholder="Search..." value={filters.sow || ''} onChange={event => setFilters(state => ({ ...state, sow: event.target.value }))} style={{ fontSize: '11px' }} allowClear />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>PIW</div>
          <Input size="small" placeholder="Search..." value={filters.piw || ''} onChange={event => setFilters(state => ({ ...state, piw: event.target.value }))} style={{ fontSize: '11px' }} allowClear />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Status</div>
          <Select size="small" placeholder="All" allowClear value={filters.status || undefined} onChange={value => setFilters(state => ({ ...state, status: value || '' }))} style={{ width: '100%', fontSize: '11px' }} options={['Not Started', 'In Progress', 'Completed'].map(item => ({ label: item, value: item }))} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Start Date From</div>
          <DatePicker size="small" value={filters.startDateFrom ? dayjs(filters.startDateFrom) : null} onChange={value => setFilters(state => ({ ...state, startDateFrom: value ? value.format('YYYY-MM-DD') : '' }))} allowClear style={{ width: '100%', fontSize: '11px' }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Start Date To</div>
          <DatePicker size="small" value={filters.startDateTo ? dayjs(filters.startDateTo) : null} onChange={value => setFilters(state => ({ ...state, startDateTo: value ? value.format('YYYY-MM-DD') : '' }))} allowClear style={{ width: '100%', fontSize: '11px' }} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Active</div>
          <Select size="small" placeholder="All" allowClear value={filters.active || undefined} onChange={value => setFilters(state => ({ ...state, active: value || '' }))} style={{ width: '100%', fontSize: '11px' }} options={ACTIVE_OPTIONS.map(item => ({ label: item, value: item }))} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Owner</div>
          <Select size="small" placeholder="All" allowClear value={filters.accountAnchor || undefined} onChange={value => setFilters(state => ({ ...state, accountAnchor: value || '' }))} style={{ width: '100%', fontSize: '11px' }} options={anchorOptions} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Resource Name</div>
          <Input size="small" placeholder="Search linked resource..." value={filters.resourceName || ''} onChange={event => setFilters(state => ({ ...state, resourceName: event.target.value }))} style={{ fontSize: '11px' }} allowClear />
        </div>
      </Space>
    </div>
  );
}
