import React from 'react';
import { Button, Input, Select, Slider, Space, Typography } from 'antd';

const { Text } = Typography;

type Option = { label: string; value: string };

interface Props {
  panelRef?: React.Ref<HTMLDivElement>;
  width?: number;
  padding?: number;
  dataFilterPanel?: boolean;
  clearLabel?: string;
  onClearAll: () => void;

  resourceNameLabel: string;
  resourceNameValue: string;
  onResourceNameChange: (value: string) => void;
  onResourceNameKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;

  raidLabel?: string;
  raidValue: string;
  onRaidChange: (value: string) => void;
  raidOptions: Option[];

  showPiwRole?: boolean;
  piwRoleValue?: string[];
  onPiwRoleChange?: (value: string[]) => void;
  piwRoleOptions?: Option[];

  roleOrDomainLabel?: string;
  roleOrDomainValue: string[];
  onRoleOrDomainChange: (value: string[]) => void;
  roleOrDomainOptions: Option[];

  skillsValue: string[];
  onSkillsChange: (value: string[]) => void;
  skillOptions: Option[];

  engagementLabel: string;
  engagementValue: string;
  onEngagementChange: (value: string) => void;
  engagementOptions: Option[];

  showAllocationStatus?: boolean;
  allocationStatusValue?: string;
  onAllocationStatusChange?: (value: string) => void;
  allocationStatusOptions?: Option[];

  showAllocationPct?: boolean;
  allocationPctValue?: string;
  onAllocationPctChange?: (value: string) => void;

  showResourceStatus?: boolean;
  resourceStatusValue?: string;
  onResourceStatusChange?: (value: string) => void;
  resourceStatusOptions?: Option[];

  beelineValue: string;
  onBeelineChange: (value: string) => void;
  beelineOptions: Option[];
  beelineNotFoundLabel?: string;

  showWorkexRange?: boolean;
  workexRange?: [number, number];
  onWorkexRangeChange?: (value: [number, number]) => void;
  workexMax?: number;
}

export default function SharedResourceFilterPanel({
  panelRef,
  width = 240,
  padding = 16,
  dataFilterPanel = true,
  clearLabel = 'Clear all',
  onClearAll,
  resourceNameLabel,
  resourceNameValue,
  onResourceNameChange,
  onResourceNameKeyDown,
  raidLabel = 'RA ID',
  raidValue,
  onRaidChange,
  raidOptions,
  showPiwRole = false,
  piwRoleValue = [],
  onPiwRoleChange,
  piwRoleOptions = [],
  roleOrDomainLabel = 'Role / Domain',
  roleOrDomainValue,
  onRoleOrDomainChange,
  roleOrDomainOptions,
  skillsValue,
  onSkillsChange,
  skillOptions,
  engagementLabel,
  engagementValue,
  onEngagementChange,
  engagementOptions,
  showAllocationStatus = false,
  allocationStatusValue = '',
  onAllocationStatusChange,
  allocationStatusOptions = [],
  showAllocationPct = false,
  allocationPctValue = '',
  onAllocationPctChange,
  showResourceStatus = false,
  resourceStatusValue = '',
  onResourceStatusChange,
  resourceStatusOptions = [],
  beelineValue,
  onBeelineChange,
  beelineOptions,
  beelineNotFoundLabel = 'No Beeline IDs linked',
  showWorkexRange = false,
  workexRange = [0, 50],
  onWorkexRangeChange,
  workexMax = 50,
}: Props) {
  const selectStyle = { width: '100%', fontSize: '11px' as const };

  return (
    <div
      ref={panelRef}
      data-filter-panel={dataFilterPanel ? 'true' : undefined}
      style={{
        width,
        flexShrink: 0,
        background: '#fafafa',
        borderRadius: '8px',
        padding,
        border: '1px solid #f0f0f0',
        alignSelf: 'flex-start',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <Text strong style={{ fontSize: '12px' }}>Filters</Text>
        <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={onClearAll}>{clearLabel}</Button>
      </div>
      <Space direction="vertical" style={{ width: '100%' }} size={8}>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>{resourceNameLabel}</div>
          <Input
            size="small"
            placeholder="Search..."
            value={resourceNameValue}
            onChange={e => onResourceNameChange(e.target.value)}
            allowClear
            onKeyDown={onResourceNameKeyDown}
            style={{ fontSize: '11px' }}
          />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>{raidLabel}</div>
          <Select size="small" showSearch allowClear placeholder="All" value={raidValue || undefined} onChange={(v) => onRaidChange(v || '')} style={selectStyle} options={raidOptions} optionFilterProp="label" notFoundContent={<span style={{ fontSize: '11px' }}>No results</span>} />
        </div>
        {showPiwRole && (
          <div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>PIW Role</div>
            <Select size="small" mode="multiple" allowClear showSearch placeholder="All" value={piwRoleValue} onChange={(v) => onPiwRoleChange?.(v)} style={selectStyle} options={piwRoleOptions} optionFilterProp="label" maxTagCount={2} />
          </div>
        )}
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>{roleOrDomainLabel}</div>
          <Select size="small" mode="multiple" allowClear showSearch placeholder="All" value={roleOrDomainValue} onChange={(v) => onRoleOrDomainChange(v)} style={selectStyle} options={roleOrDomainOptions} optionFilterProp="label" maxTagCount={2} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
          <Select size="small" mode="multiple" allowClear showSearch placeholder="All" value={skillsValue} onChange={(v) => onSkillsChange(v)} style={selectStyle} options={skillOptions} optionFilterProp="label" maxTagCount={2} />
        </div>
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>{engagementLabel}</div>
          <Select size="small" placeholder="All" allowClear value={engagementValue || undefined} onChange={(v) => onEngagementChange(v || '')} style={selectStyle} options={engagementOptions} />
        </div>
        {showAllocationStatus && (
          <div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Allocation Status</div>
            <Select size="small" placeholder="All" allowClear value={allocationStatusValue || undefined} onChange={(v) => onAllocationStatusChange?.(v || '')} style={selectStyle} options={allocationStatusOptions} />
          </div>
        )}
        {showAllocationPct && (
          <div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Allocation %</div>
            <Select
              size="small"
              placeholder="All"
              allowClear
              value={allocationPctValue || undefined}
              onChange={(v) => onAllocationPctChange?.(v || '')}
              style={selectStyle}
              options={[
                { label: '100% — Fully Allocated', value: '100' },
                { label: '≥ 75%', value: '75' },
                { label: '50–74%', value: '50-74' },
                { label: '< 50% — Partial', value: '<50' },
                { label: '< 100% — Any Partial', value: '<100' },
              ]}
            />
          </div>
        )}
        {showResourceStatus && (
          <div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Status</div>
            <Select size="small" placeholder="All" allowClear value={resourceStatusValue || undefined} onChange={(v) => onResourceStatusChange?.(v || '')} style={selectStyle} options={resourceStatusOptions} />
          </div>
        )}
        <div>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline ID</div>
          <Select size="small" showSearch allowClear placeholder="All" value={beelineValue || undefined} onChange={(v) => onBeelineChange(v || '')} style={selectStyle} options={beelineOptions} optionFilterProp="label" notFoundContent={<span style={{ fontSize: '11px' }}>{beelineNotFoundLabel}</span>} />
        </div>
        {showWorkexRange && (
          <div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Experience: {workexRange[0]}-{workexRange[1]} yrs</div>
            <Slider range min={0} max={workexMax} value={workexRange} onChange={(value) => onWorkexRangeChange?.(value as [number, number])} />
          </div>
        )}
      </Space>
    </div>
  );
}
