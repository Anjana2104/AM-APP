import React from 'react';
import { Button, Select, Space, Typography } from 'antd';
import type { TeamType, StakeholderFilters } from './stakeholderNetworkUtils';

const { Text } = Typography;

type Option = { label: string; value: string };

interface StakeholderFilterPanelProps {
  filters: StakeholderFilters;
  setFilters: React.Dispatch<React.SetStateAction<StakeholderFilters>>;
  nameOptions: Option[];
  titleOptions: Option[];
  departmentOptions: Option[];
  managerOptions: Option[];
  responsibilityOptions: Option[];
  activeFilterCount: number;
  onClear: () => void;
}

export function StakeholderFilterPanel({
  filters,
  setFilters,
  nameOptions,
  titleOptions,
  departmentOptions,
  managerOptions,
  responsibilityOptions,
  activeFilterCount,
  onClear,
}: StakeholderFilterPanelProps) {
  return (
    <div style={{ width: 320, fontSize: '11px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: 8 }}>Filter Stakeholders</div>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <div>
          <Text style={{ fontSize: '11px' }}>Name</Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            value={filters.name || undefined}
            onChange={value => setFilters(prev => ({ ...prev, name: String(value || '') }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={nameOptions}
            placeholder="Select name"
          />
        </div>
        <div>
          <Text style={{ fontSize: '11px' }}>Title / Role</Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            value={filters.title || undefined}
            onChange={value => setFilters(prev => ({ ...prev, title: String(value || '') }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={titleOptions}
            placeholder="Select title / role"
          />
        </div>
        <div>
          <Text style={{ fontSize: '11px' }}>Department</Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            value={filters.department || undefined}
            onChange={value => setFilters(prev => ({ ...prev, department: String(value || '') }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={departmentOptions}
            placeholder="Select department"
          />
        </div>
        <div>
          <Text style={{ fontSize: '11px' }}>Reporting Manager</Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            value={filters.reportingTo || undefined}
            onChange={value => setFilters(prev => ({ ...prev, reportingTo: String(value || '') }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={managerOptions}
            placeholder="Select reporting manager"
          />
        </div>
        <div>
          <Text style={{ fontSize: '11px' }}>Responsibility</Text>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            size="small"
            value={filters.responsibility || undefined}
            onChange={value => setFilters(prev => ({ ...prev, responsibility: String(value || '') }))}
            style={{ width: '100%', fontSize: '11px' }}
            options={responsibilityOptions}
            placeholder="Select responsibility"
          />
        </div>
      </Space>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {activeFilterCount ? `${activeFilterCount} filter(s) active` : 'No active filters'}
        </Text>
        <Button size="small" type="link" onClick={onClear} style={{ paddingInline: 0, fontSize: '11px' }}>
          Clear All
        </Button>
      </div>
    </div>
  );
}

export function TeamTypeQuickTags({
  filters,
  teamTypeTags,
  onToggle,
}: {
  filters: StakeholderFilters;
  teamTypeTags: Array<{ teamType: TeamType; label: string; count: number }>;
  onToggle: (teamType: TeamType) => void;
}) {
  return (
    <>
      {teamTypeTags.map(tag => {
        const isActive = filters.teamTypes.length === 1 && filters.teamTypes[0] === tag.teamType;
        return (
          <span
            key={tag.teamType}
            onClick={() => onToggle(tag.teamType)}
            style={{
              margin: 0,
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: 600,
              borderRadius: 10,
              padding: '2px 10px',
              color: isActive ? '#fff' : '#1677ff',
              background: isActive ? '#1677ff' : '#e6f4ff',
              border: `1px solid ${isActive ? '#1677ff' : '#d9e7ff'}`,
            }}
          >
            {tag.label} ({tag.count})
          </span>
        );
      })}
    </>
  );
}
