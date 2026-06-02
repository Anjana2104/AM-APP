import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Upload, Table, Typography, Space, Button, message, Input, Tooltip, Drawer, Checkbox, Select } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import { UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Text } = Typography;

type ExcelRow = Record<string, any>;

type Row = {
  key: string;
  sno: number;
  project: string;
  code: string;
  space: string;
  owner: string;
  revenue: number[];
};

const inr = (n: number) =>
  n ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—';

function parseINR(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/₹|,/g, '').trim();
  const num = Number(cleaned);
  return isFinite(num) ? num : 0;
}

function downloadTemplate() {
  const headers = [
    'S.No.',
    'Project',
    'Code',
    'Space',
    'Owners',
    // FY26: Oct'25 - Sep'26
    'Oct\'25', 'Nov\'25', 'Dec\'25',
    'Jan\'26', 'Feb\'26', 'Mar\'26', 'Apr\'26', 'May\'26', 'Jun\'26',
    'Jul\'26', 'Aug\'26', 'Sep\'26',
    // FY27: Oct'26 - Sep'27
    'Oct\'26', 'Nov\'26', 'Dec\'26',
    'Jan\'27', 'Feb\'27', 'Mar\'27', 'Apr\'27', 'May\'27', 'Jun\'27',
    'Jul\'27', 'Aug\'27', 'Sep\'27',
  ];

  // Create 5 empty rows as sample
  const rows = Array.from({ length: 5 }).map((_, i) => {
    const row: any = {};
    headers.forEach(h => (row[h] = ''));
    row['S.No.'] = i + 1;
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, {
    header: headers,
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'FY26-FY27 Revenue');

  XLSX.writeFile(workbook, 'FY26_FY27_Revenue_Template.xlsx');
}



export type { Row };

interface ProjectListProps {
  onDataChange?: (data: Row[]) => void;
  onMonthsChange?: (months: string[]) => void;
}

export function ProjectList({ onDataChange, onMonthsChange }: ProjectListProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(['sno', 'project', 'code', 'space', 'owner', 'total']));
  const [filters, setFilters] = useState<{ project: string; space: string; owner: string; fy: string | null }>({
    project: '',
    space: '',
    owner: '',
    fy: null,
  });

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isFilterApplied = !!(filters.project || filters.space || filters.owner || filters.fy);

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        const isInsidePopup = !!target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown');
        if (!isInsidePopup) {
          setShowFilterPanel(false);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const closeFilterOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilterPanel(false);
  };

  const availableFYs = useMemo(() => {
    const fys = [];
    const monthCount = monthHeaders.length || 0;
    for (let i = 0; i < monthCount; i += 12) {
      const fyYear = 2026 + Math.floor(i / 12);
      fys.push({ label: `FY${fyYear}`, value: i });
    }
    return fys;
  }, [monthHeaders]);

  const handleFieldChange = (key: string, field: 'project' | 'code' | 'space' | 'owner', value: string) => {
    setRows(prevRows => {
      const updated = prevRows.map(row =>
        row.key === key ? { ...row, [field]: value } : row
      );
      onDataChange?.(updated);
      return updated;
    });
  };

  const deriveCodeFromProject = (projectName: string): string => {
    const code = projectName.split(' - ')[0].trim();
    return code || projectName;
  };

  const handleUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      
      const wb = XLSX.read(buffer, { type: 'array' });
      
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        message.error('No sheet found in Excel file');
        return false;
      }
      
      const json = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: '' });

      if (!json.length) {
        message.error('Excel sheet is empty');
        return false;
      }

      const headers = Object.keys(json[0]);
      const fixedCols = ['S.No.', 'Project', 'Code', 'Space', 'Owners'];

      const monthCols = headers.filter(h => !fixedCols.includes(h));

      if (monthCols.length === 0) {
        message.warning('No month columns found. Expected columns like Oct\'25, Nov\'25, etc.');
      }

      const mapped: Row[] = json.map((r, i) => {
        const projectName = r.Project || '';
        const code = deriveCodeFromProject(projectName);
        return {
          key: projectName || String(i),
          sno: Number(r['S.No.'] || i + 1),
          project: projectName,
          code: code,
          space: r.Space || '',
          owner: r.Owners || '',
          revenue: monthCols.map(m => parseINR(r[m])),
        };
      });

      setRows(mapped);
      setMonthHeaders(monthCols);
      onDataChange?.(mapped);
      onMonthsChange?.(monthCols);
      message.success(`Loaded ${mapped.length} projects`);
    } catch (e: any) {
      message.error(e.message || 'Failed to read Excel');
    }
    return false;
  };

  const filteredMonthHeaders = useMemo(() => {
    if (!filters.fy) return monthHeaders;
    const fyIndex = parseInt(filters.fy);
    return monthHeaders.slice(fyIndex, fyIndex + 12);
  }, [monthHeaders, filters.fy]);

  const columns: ColumnsType<Row> = useMemo(() => {
    const headerStyle = { fontWeight: 600, fontSize: '11px' };
    const totalHeaderStyle = { fontWeight: 600, fontSize: '11px', backgroundColor: '#FFA940', color: '#fff' };
    const cellStyle = { whiteSpace: 'pre-wrap' as const, wordWrap: 'break-word' as const, fontSize: '11px' };

    const handleRevenueChange = (key: string, monthIdx: number, value: string) => {
      const numValue = parseINR(value);
      setRows(prevRows => {
        const updated = prevRows.map(row =>
          row.key === key
            ? {
                ...row,
                revenue: row.revenue.map((v, idx) => (idx === monthIdx ? numValue : v)),
              }
            : row
        );
        onDataChange?.(updated);
        return updated;
      });
    };

    const baseColumns: ColumnType<Row>[] = [
      {
        title: 'S.No.',
        dataIndex: 'sno',
        key: 'sno',
        width: 60,
        onHeaderCell: () => ({ style: headerStyle }),
        onCell: () => ({ style: cellStyle }),
      },
      {
        title: 'Project',
        dataIndex: 'project',
        key: 'project',
        width: 180,
        render: (value: string) => (
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </div>
        ),
        onHeaderCell: () => ({ style: headerStyle }),
        onCell: () => ({ style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' } }),
      },
      {
        title: 'Code',
        dataIndex: 'code',
        key: 'code',
        width: 110,
        render: (value: string, record: Row) => (
          <Input
            value={deriveCodeFromProject(record.project) || value}
            disabled
            style={{ border: 'none', background: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}
            title="Code is auto-derived from Project Name"
          />
        ),
        onHeaderCell: () => ({ style: headerStyle }),
        onCell: () => ({ style: cellStyle }),
      },
      {
        title: 'Space',
        dataIndex: 'space',
        key: 'space',
        width: 120,
        render: (value: string, record: Row) => (
          <Input
            value={value}
            onChange={e => handleFieldChange(record.key, 'space', e.target.value)}
            style={{ border: 'none', background: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}
          />
        ),
        onHeaderCell: () => ({ style: headerStyle }),
        onCell: () => ({ style: cellStyle }),
      },
      {
        title: 'Owner',
        dataIndex: 'owner',
        key: 'owner',
        width: 120,
        render: (value: string, record: Row) => (
          <Input
            value={value}
            onChange={e => handleFieldChange(record.key, 'owner', e.target.value)}
            style={{ border: 'none', background: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '11px' }}
          />
        ),
        onHeaderCell: () => ({ style: headerStyle }),
        onCell: () => ({ style: cellStyle }),
      },
    ];

    const monthColumns: ColumnType<Row>[] = filteredMonthHeaders.map((m, displayIdx) => {
      const actualIdx = filters.fy ? parseInt(filters.fy) + displayIdx : displayIdx;
      return {
        title: m,
        dataIndex: ['revenue', actualIdx],
        align: 'right' as const,
        width: 140,
        render: (value: number, record: Row) => (
          <Input
            type="number"
            value={value || 0}
            onChange={e => handleRevenueChange(record.key, actualIdx, e.target.value)}
            style={{ textAlign: 'right', border: 'none', background: 'transparent', whiteSpace: 'nowrap', fontSize: '11px' }}
            onBlur={e => {
              if (!e.target.value) {
                handleRevenueChange(record.key, actualIdx, '0');
              }
            }}
          />
        ),
        onHeaderCell: () => ({ style: headerStyle }),
        onCell: () => ({ style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      };
    });

    const totalColumn: ColumnType<Row> = {
      title: 'Total (INR)',
      key: 'total',
      align: 'right' as const,
      width: 140,
      render: (_, record) => {
        try {
          if (!record || !record.revenue || record.revenue.length === 0) {
            return <div style={{ textAlign: 'right' }}>—</div>;
          }
          const indices = filters.fy ? [parseInt(filters.fy), parseInt(filters.fy) + 11] : [0, record.revenue.length - 1];
          const clampedIndices = [Math.max(0, indices[0]), Math.min(record.revenue.length - 1, indices[1])];
          const total = record.revenue.slice(clampedIndices[0], clampedIndices[1] + 1).reduce((a, b) => a + b, 0);
          return (
            <div style={{ padding: '4px 8px', backgroundColor: '#FFA940', color: '#fff', borderRadius: '4px', fontWeight: 600, textAlign: 'right', whiteSpace: 'pre-wrap', wordWrap: 'break-word', fontSize: '11px' }}>
              ₹ {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
            </div>
          );
        } catch (e) {
          console.error('Total calculation error:', e);
          return <div style={{ textAlign: 'right' }}>—</div>;
        }
      },
      onHeaderCell: () => ({ style: totalHeaderStyle }),
      onCell: () => ({ style: cellStyle }),
    };

    // Filter columns based on visibility
    const allColumns = [...baseColumns, ...monthColumns, totalColumn];
    return allColumns.filter(col => {
      // Always show columns without keys (shouldn't happen) or specifically action columns
      if (!col.key) return true;
      // Always show special columns like total
      if (col.key === 'total') return true;
      // Filter other columns by visibility
      return visibleColumns.has(col.key as string);
    });
  }, [filteredMonthHeaders, rows, filters, visibleColumns]);

  const displayRows = useMemo(() => {
    return rows.filter(row => {
      if (filters.project && !row.project.toLowerCase().includes(filters.project.toLowerCase())) return false;
      if (filters.space && !row.space.toLowerCase().includes(filters.space.toLowerCase())) return false;
      if (filters.owner && !row.owner.toLowerCase().includes(filters.owner.toLowerCase())) return false;
      return true;
    });
  }, [rows, filters]);

  return (
    <div style={{ background: '#f5f5f5', padding: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '12px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Showing: <strong>{displayRows.length}</strong>{displayRows.length !== rows.length ? ` / ${rows.length}` : ''}
          </Text>
          <Space wrap size={8}>
            {isFilterApplied && (
              <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={() => setFilters({ project: '', space: '', owner: '', fy: null })}>✕ Clear Filters</Button>
            )}
            <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: '6px' }} />
            </Tooltip>
            <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: '6px' }} />
            </Tooltip>
            <Tooltip title="Upload Project Details from Excel" overlayInnerStyle={{ fontSize: '11px' }}>
              <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
                <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
              </Upload>
            </Tooltip>
            <Tooltip title="Download Template" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<DownloadOutlined />} onClick={downloadTemplate} size="small" style={{ borderRadius: '6px' }} />
            </Tooltip>
          </Space>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          {showFilterPanel && (
            <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Text strong style={{ fontSize: '12px' }}>Filters</Text>
                <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({ project: '', space: '', owner: '', fy: null })}>Clear all</Button>
              </div>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                <div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Fiscal Year</div>
                  <Select size="small" placeholder="All Years" allowClear value={filters.fy || undefined} onChange={(value) => setFilters({ ...filters, fy: value || null })} style={{ width: '100%', fontSize: '11px' }} options={availableFYs.map(fy => ({ label: fy.label, value: fy.value.toString() }))} onKeyDown={closeFilterOnEnter} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Project</div>
                  <Select size="small" placeholder="Select Project..." allowClear value={filters.project || undefined} onChange={(value) => setFilters({ ...filters, project: value || '' })} style={{ width: '100%', fontSize: '11px' }} options={Array.from(new Set(rows.map(r => r.project).filter(Boolean))).map(p => ({ label: p, value: p }))} onKeyDown={closeFilterOnEnter} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Space</div>
                  <Select size="small" placeholder="Select Space..." allowClear value={filters.space || undefined} onChange={(value) => setFilters({ ...filters, space: value || '' })} style={{ width: '100%', fontSize: '11px' }} options={Array.from(new Set(rows.map(r => r.space).filter(Boolean))).map(s => ({ label: s, value: s }))} onKeyDown={closeFilterOnEnter} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Owner</div>
                  <Select size="small" placeholder="Select Owner..." allowClear value={filters.owner || undefined} onChange={(value) => setFilters({ ...filters, owner: value || '' })} style={{ width: '100%', fontSize: '11px' }} options={Array.from(new Set(rows.map(r => r.owner).filter(Boolean))).map(o => ({ label: o, value: o }))} onKeyDown={closeFilterOnEnter} />
                </div>
              </Space>
            </div>
          )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
            {rows.length === 0 ? (
              <div style={{ background: '#fafafa', borderRadius: '8px', padding: 60, textAlign: 'center', border: '1px dashed #d9d9d9' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>No data yet. Upload an Excel file to get started.</Text>
              </div>
            ) : (
              <div className="compact-table">
                <Table
                  size="small"
                  dataSource={displayRows}
                  columns={columns?.length > 0 ? columns : []}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  scroll={{ x: 'max-content', y: 420 }}
                  locale={{ emptyText: 'No projects match your filters.' }}
                  style={{ background: '#fff', borderRadius: '8px' }}
                />
              </div>
            )}
          </div>
        </div>

      <Drawer title="Column Visibility" placement="right" onClose={() => setColumnDrawer(false)} open={columnDrawer} width={300}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {[
            { key: 'sno', label: 'S.No.' },
            { key: 'project', label: 'Project' },
            { key: 'code', label: 'Code' },
            { key: 'space', label: 'Space' },
            { key: 'owner', label: 'Owner' },
            { key: 'total', label: 'Total (INR)' },
          ].map(({ key, label }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox checked={visibleColumns.has(key)} onChange={(e) => { const s = new Set(visibleColumns); e.target.checked ? s.add(key) : s.delete(key); setVisibleColumns(s); }} />
              <label style={{ marginBottom: 0, cursor: 'pointer' }}>{label}</label>
            </div>
          ))}
        </Space>
      </Drawer>
    </div>
  );
}
