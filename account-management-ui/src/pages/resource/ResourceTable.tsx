import React, { useMemo } from 'react';
import { Button, Space, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CheckCircleOutlined, EditOutlined, StopOutlined } from '@ant-design/icons';
import type { ResourceRow } from '../../types/resource';
import { AllocPctTag } from '../../utils/allocUtils';
import { ensureAllocationEntries } from '../../utils/resourceAllocationUtils';
import { TABLE_ALLOCATION_STATUS_COLOR_MAP } from './resourceConstants';

export interface ResourceTableProps {
  filteredResources: ResourceRow[];
  visibleColumns: Set<string>;
  canEdit: boolean;
  canDelete: boolean;
  filterPanel?: React.ReactNode;
  onEdit: (resource: ResourceRow) => void;
  onToggleActive: (resource: ResourceRow, nextActive: boolean) => void;
  onSelectResource: (resource: ResourceRow) => void;
}

export const ResourceTable: React.FC<ResourceTableProps> = ({
  filteredResources,
  visibleColumns,
  canEdit,
  canDelete,
  filterPanel,
  onEdit,
  onToggleActive,
  onSelectResource,
}) => {
  const columns: ColumnsType<ResourceRow> = useMemo(
    () => [
      {
        title: 'S.NO',
        key: 'sno',
        width: 60,
        fixed: 'left' as const,
        render: (_: unknown, __: ResourceRow, index: number) => (
          <Tag color="blue" style={{ fontSize: '12px', fontWeight: 600 }}>{index + 1}</Tag>
        ),
      },
      {
        title: 'RA ID',
        dataIndex: 'raId',
        key: 'raId',
        width: 100,
        fixed: 'left' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.raId || '').localeCompare(b.raId || ''),
        render: (value) => <div style={{ fontWeight: 600, color: '#001529' }}>{String(value || '')}</div>,
      },
      {
        title: 'Emp Name',
        dataIndex: 'empName',
        key: 'empName',
        width: 150,
        fixed: 'left' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.empName || '').localeCompare(b.empName || ''),
        render: (value) => <div style={{ fontWeight: 600, color: '#001529' }}>{String(value || '')}</div>,
      },
      {
        title: 'Email Id',
        dataIndex: 'emailId',
        key: 'emailId',
        width: 200,
        ellipsis: true,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.emailId || '').localeCompare(b.emailId || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'PIW Role',
        dataIndex: 'piwRole',
        key: 'piwRole',
        width: 120,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.piwRole || '').localeCompare(b.piwRole || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Roles/Domains',
        dataIndex: 'roleOrDomain',
        key: 'roleOrDomain',
        width: 200,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.roleOrDomain || '').localeCompare(b.roleOrDomain || ''),
        render: (value) => {
          const domains = value
            ? String(value).split(/[,;|]/).map((d: string) => d.trim()).filter(Boolean)
            : [];
          return domains.length > 0
            ? <Space size={4} wrap>{domains.map((d, i) => <Tag key={i} color="cyan" style={{ fontSize: '11px' }}>{d}</Tag>)}</Space>
            : <span style={{ color: '#bfbfbf' }}>—</span>;
        },
      },
      {
        title: 'Previous Workex (Yr)',
        dataIndex: 'previousWorkex',
        key: 'previousWorkex',
        width: 145,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => {
          const pa = parseFloat(String(a.previousWorkex || '0').replace(/[^\d.-]/g, '')) || 0;
          const pb = parseFloat(String(b.previousWorkex || '0').replace(/[^\d.-]/g, '')) || 0;
          return pa - pb;
        },
        render: (value) => {
          const num = parseFloat(String(value || '').replace(/[^\d.-]/g, ''));
          if (!value || isNaN(num)) return <span style={{ color: '#bfbfbf' }}>—</span>;
          return <span>{Math.trunc(num * 100) / 100} yrs</span>;
        },
      },
      {
        title: 'DOJ',
        dataIndex: 'doj',
        key: 'doj',
        width: 120,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.doj || '').localeCompare(b.doj || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Total Workex (Yr)',
        dataIndex: 'totalWorkex',
        key: 'totalWorkex',
        width: 130,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => {
          const pa = parseFloat(String(a.totalWorkex || '0').replace(/[^\d.-]/g, '')) || 0;
          const pb = parseFloat(String(b.totalWorkex || '0').replace(/[^\d.-]/g, '')) || 0;
          return pa - pb;
        },
        render: (value) => {
          const num = parseFloat(String(value || '').replace(/[^\d.-]/g, ''));
          if (!value || isNaN(num)) return <span style={{ color: '#bfbfbf' }}>—</span>;
          return <span>{Math.trunc(num * 100) / 100} yrs</span>;
        },
      },
      {
        title: 'Project Allocations',
        key: 'projectAllocations',
        width: 280,
        render: (_value, record) => {
          const entries = ensureAllocationEntries(record);
          if (!entries.length) return <span style={{ color: '#bfbfbf' }}>—</span>;
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {entries.map((entry, index) => (
                <div key={`${record.key}-${index}`} style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <Tag color="purple" style={{ fontSize: '10px', margin: 0 }}>
                    {entry.engagementName || 'Unassigned'}
                  </Tag>
                  <AllocPctTag pct={entry.allocationPercentage} style={{ fontSize: '10px', margin: 0 }} />
                  <Tag style={{ fontSize: '10px', margin: 0 }}>
                    {entry.engagementStartDate || '—'} to {entry.engagementEndDate || '—'}
                  </Tag>
                </div>
              ))}
            </div>
          );
        },
      },
      {
        title: 'Allocation Status',
        dataIndex: 'allocationStatus',
        key: 'allocationStatus',
        width: 130,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.allocationStatus || '').localeCompare(b.allocationStatus || ''),
        render: (value) => {
          const status = String(value || '');
          if (!status) return <span style={{ color: '#bbb', fontSize: '11px' }}>—</span>;
          return <Tag color={TABLE_ALLOCATION_STATUS_COLOR_MAP[status] || 'default'} style={{ fontSize: '10px', margin: 0 }}>{status}</Tag>;
        },
      },
      {
        title: 'Alloc %',
        dataIndex: 'allocationPercentage',
        key: 'allocationPercentage',
        width: 80,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.allocationPercentage ?? 0) - (b.allocationPercentage ?? 0),
        render: (value: number | null) => <AllocPctTag pct={value} />,
      },
      {
        title: 'Resource Status',
        key: 'resourceStatus',
        dataIndex: 'isActive',
        width: 120,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => Number(a.isActive !== false) - Number(b.isActive !== false),
        render: (value) => {
          const active = value !== false;
          return <Tag color={active ? 'green' : 'red'} style={{ fontSize: '10px', margin: 0 }}>{active ? 'Active' : 'Inactive'}</Tag>;
        },
      },
      {
        title: 'Skills',
        dataIndex: 'skills',
        key: 'skills',
        width: 120,
        render: (value) => {
          const skills = String(value || '').split(',').filter((item) => item.trim());
          return (
            <Tooltip title={String(value || '')} placement="topLeft">
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {skills.slice(0, 2).map((skill, index) => <Tag key={index} color="blue" style={{ fontSize: '10px', margin: 0 }}>{skill.trim()}</Tag>)}
                {skills.length > 2 && <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{skills.length - 2}</Tag>}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: 'Action',
        key: 'action',
        width: 100,
        fixed: 'right' as const,
        render: (_, record) => {
          if (!record) return null;
          return (
            <Space size="small">
              {canEdit && (
                <Button type="text" size="small" icon={<EditOutlined />} onClick={() => onEdit(record)} style={{ color: '#1890FF' }} title="Edit" />
              )}
              {canDelete && (
                <Button
                  type="text"
                  size="small"
                  icon={record.isActive === false ? <CheckCircleOutlined /> : <StopOutlined />}
                  onClick={() => onToggleActive(record, record.isActive === false)}
                  style={{ color: record.isActive === false ? '#389e0d' : '#ff4d4f' }}
                  title={record.isActive === false ? 'Reactivate' : 'Mark Inactive'}
                />
              )}
            </Space>
          );
        },
      },
    ],
    [canDelete, canEdit, onEdit, onToggleActive],
  );

  const displayColumns = useMemo(
    () => columns.filter((column) => !column.key || visibleColumns.has(column.key as string)),
    [columns, visibleColumns],
  );

  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      {filterPanel}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div className="compact-table">
          <Table<ResourceRow>
            dataSource={filteredResources}
            columns={displayColumns}
            pagination={{ pageSize: 15, showSizeChanger: false }}
            scroll={{ x: 'max-content', y: 420 }}
            size="small"
            style={{ background: '#fff', borderRadius: '8px' }}
            locale={{ emptyText: 'No resources match your filters' }}
            onRow={(record) => ({
              onClick: (event) => {
                const target = event.target as HTMLElement;
                if (target.closest('button, .ant-tag, .ant-checkbox-wrapper')) return;
                onSelectResource(record);
              },
              style: { cursor: 'pointer' },
            })}
          />
        </div>
      </div>
    </div>
  );
};

