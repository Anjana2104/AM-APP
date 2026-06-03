import React, { useMemo, useState, useRef, useEffect } from 'react';
import {
  Tabs, Typography, Space, Upload, Table, Button, message, Input, Tooltip,
  Drawer, Checkbox, Select, Card, Row, Col, Progress, Empty,
  Segmented, InputNumber, Spin, Popconfirm,
} from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import {
  UploadOutlined, DownloadOutlined, ColumnHeightOutlined, FilterOutlined,
  FileExcelOutlined, BarChartOutlined, CloudServerOutlined, SaveOutlined, DeleteOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as financeApi from '../api/financeApi';

const { Title, Text } = Typography;

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

const usd = (n: number) =>
  n ? `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

function parseINR(v: any): number {
  if (!v) return 0;
  if (typeof v === 'number') return v;
  const cleaned = String(v).replace(/₹|,/g, '').trim();
  const num = Number(cleaned);
  return isFinite(num) ? num : 0;
}

function downloadTemplate() {
  const headers = [
    'S.No.', 'Project', 'Code', 'Space', 'Owners',
    "Oct'25", "Nov'25", "Dec'25",
    "Jan'26", "Feb'26", "Mar'26", "Apr'26", "May'26", "Jun'26",
    "Jul'26", "Aug'26", "Sep'26",
    "Oct'26", "Nov'26", "Dec'26",
    "Jan'27", "Feb'27", "Mar'27", "Apr'27", "May'27", "Jun'27",
    "Jul'27", "Aug'27", "Sep'27",
  ];
  const rows = Array.from({ length: 5 }).map((_, i) => {
    const row: any = {};
    headers.forEach(h => (row[h] = ''));
    row['S.No.'] = i + 1;
    return row;
  });
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: headers });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'FY26-FY27 Revenue');
  XLSX.writeFile(workbook, 'FY26_FY27_Revenue_Template.xlsx');
}

interface ProjectListProps {
  onDataChange?: (data: Row[]) => void;
  onMonthsChange?: (months: string[]) => void;
}

function ProjectList({ onDataChange, onMonthsChange }: ProjectListProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fromServer, setFromServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(
    new Set(['sno', 'project', 'code', 'space', 'owner', 'total'])
  );
  const [filters, setFilters] = useState<{
    project: string; space: string; owner: string; fy: string | null;
  }>({ project: '', space: '', owner: '', fy: null });

  // Load from API on mount
  useEffect(() => {
    setLoading(true);
    financeApi.getProjects().then(({ projects, months, fromServer: online }) => {
      if (online && projects.length) {
        const mapped: Row[] = projects.map((p, i) => ({
          key: p.project || String(i),
          sno: p.sno,
          project: p.project,
          code: p.code || deriveCode(p.project),
          space: p.space || '',
          owner: p.owner || '',
          revenue: months.map(m => p.revenue[m] || 0),
        }));
        setRows(mapped);
        setMonthHeaders(months);
        onDataChange?.(mapped);
        onMonthsChange?.(months);
        setFromServer(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isFilterApplied = !!(filters.project || filters.space || filters.owner || filters.fy);

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        const isInsidePopup = !!target.closest('.ant-select-dropdown');
        if (!isInsidePopup) setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const availableFYs = useMemo(() => {
    const fys = [];
    for (let i = 0; i < monthHeaders.length; i += 12) {
      fys.push({ label: `FY${2026 + Math.floor(i / 12)}`, value: i });
    }
    return fys;
  }, [monthHeaders]);

  const handleFieldChange = (key: string, field: 'project' | 'code' | 'space' | 'owner', value: string) => {
    setDirty(true);
    setRows(prev => {
      const updated = prev.map(r => r.key === key ? { ...r, [field]: value } : r);
      onDataChange?.(updated);
      return updated;
    });
  };

  const deriveCode = (name: string) => name.split(' - ')[0].trim() || name;

  const handleUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { message.error('No sheet found'); return false; }
      const json = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: '' });
      if (!json.length) { message.error('Sheet is empty'); return false; }
      const headers = Object.keys(json[0]);
      const fixedCols = ['S.No.', 'Project', 'Code', 'Space', 'Owners'];
      const monthCols = headers.filter(h => !fixedCols.includes(h));

      const uploaded: Row[] = json
        .filter(r => String(r.Project || '').trim())
        .map((r, i) => ({
          key: String(r.Project || i),
          sno: Number(r['S.No.'] || i + 1),
          project: String(r.Project || ''),
          code: deriveCode(String(r.Project || '')),
          space: String(r.Space || ''),
          owner: String(r.Owners || ''),
          revenue: monthCols.map(m => parseINR(r[m])),
        }));

      // Merge: uploaded rows upsert into existing rows by project name (case-insensitive)
      // New month columns are unioned with existing ones
      const allMonths = [...new Set([...monthHeaders, ...monthCols])];

      setRows(prev => {
        const existingMap = new Map(prev.map(r => [r.project.toLowerCase(), r]));

        uploaded.forEach(u => {
          const key = u.project.toLowerCase();
          if (existingMap.has(key)) {
            // Overwrite matching project — merge revenue across all months
            const ex = existingMap.get(key)!;
            const mergedRevenue = allMonths.map((m, i) => {
              const uploadedIdx = monthCols.indexOf(m);
              const existingIdx = monthHeaders.indexOf(m);
              if (uploadedIdx !== -1) return u.revenue[uploadedIdx] ?? 0;
              if (existingIdx !== -1) return ex.revenue[existingIdx] ?? 0;
              return 0;
            });
            existingMap.set(key, { ...ex, space: u.space, owner: u.owner, revenue: mergedRevenue });
          } else {
            // Append new project — pad revenue to allMonths
            const mergedRevenue = allMonths.map((m, i) => {
              const uploadedIdx = monthCols.indexOf(m);
              return uploadedIdx !== -1 ? (u.revenue[uploadedIdx] ?? 0) : 0;
            });
            existingMap.set(key, { ...u, revenue: mergedRevenue });
          }
        });

        // Re-pad existing projects that lack new month columns
        const merged = Array.from(existingMap.values()).map(r => ({
          ...r,
          revenue: allMonths.map((m, i) => {
            const oldIdx = monthHeaders.indexOf(m);
            return r.revenue[i] !== undefined ? r.revenue[i] : (oldIdx !== -1 ? (r.revenue[oldIdx] ?? 0) : 0);
          }),
        }));

        onDataChange?.(merged);
        return merged;
      });

      // Update month headers to union of old + new
      setMonthHeaders(allMonths);
      onMonthsChange?.(allMonths);
      setDirty(true);

      const newCount = uploaded.filter(u => !rows.some(r => r.project.toLowerCase() === u.project.toLowerCase())).length;
      const updCount = uploaded.length - newCount;
      message.success(`Upload complete: ${newCount} new project(s) added, ${updCount} updated`);

      // Save to server
      setRows(current => {
        const apiProjects = current.map(r => ({
          sno: r.sno, project: r.project, code: r.code,
          space: r.space, owner: r.owner,
          revenue: Object.fromEntries(allMonths.map((m, i) => [m, r.revenue[i] || 0])),
        }));
        financeApi.bulkSave(apiProjects, allMonths).then(ok => {
          if (ok) { setFromServer(true); setDirty(false); message.success('Saved to database'); }
        });
        return current;
      });

    } catch (e: any) {
      message.error(e.message || 'Failed to read Excel');
    }
    return false;
  };

  const filteredMonthHeaders = useMemo(() => {
    if (!filters.fy) return monthHeaders;
    const start = parseInt(filters.fy);
    return monthHeaders.slice(start, start + 12);
  }, [monthHeaders, filters.fy]);

  const columns: ColumnsType<Row> = useMemo(() => {
    const hs = { fontWeight: 600, fontSize: '11px' };
    const cs = { fontSize: '11px' };

    const handleRevChange = (key: string, idx: number, value: string) => {
      setDirty(true);
      setRows(prev => {
        const updated = prev.map(r =>
          r.key === key ? { ...r, revenue: r.revenue.map((v, i) => i === idx ? parseINR(value) : v) } : r
        );
        onDataChange?.(updated);
        return updated;
      });
    };

    const base: ColumnType<Row>[] = [
      { title: 'S.No.', dataIndex: 'sno', key: 'sno', width: 60, onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }) },
      {
        title: 'Project', dataIndex: 'project', key: 'project', width: 180,
        render: (v: string) => <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>,
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Code', dataIndex: 'code', key: 'code', width: 110,
        render: (_: string, r: Row) => <Input value={deriveCode(r.project)} disabled style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />,
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Space', dataIndex: 'space', key: 'space', width: 120,
        render: (v: string, r: Row) => <Input value={v} onChange={e => handleFieldChange(r.key, 'space', e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />,
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
      {
        title: 'Owner', dataIndex: 'owner', key: 'owner', width: 120,
        render: (v: string, r: Row) => <Input value={v} onChange={e => handleFieldChange(r.key, 'owner', e.target.value)} style={{ border: 'none', background: 'transparent', fontSize: '11px' }} />,
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      },
    ];

    const monthCols: ColumnType<Row>[] = filteredMonthHeaders.map((m, di) => {
      const ai = filters.fy ? parseInt(filters.fy) + di : di;
      return {
        title: m, key: m, align: 'right' as const, width: 140,
        render: (_: any, r: Row) => (
          <Input type="number" value={r.revenue[ai] || 0}
            onChange={e => handleRevChange(r.key, ai, e.target.value)}
            style={{ textAlign: 'right', border: 'none', background: 'transparent', fontSize: '11px' }} />
        ),
        onHeaderCell: () => ({ style: hs }), onCell: () => ({ style: cs }),
      };
    });

    const totalCol: ColumnType<Row> = {
      title: 'Total (INR)', key: 'total', align: 'right' as const, width: 140,
      render: (_, r) => {
        const start = filters.fy ? parseInt(filters.fy) : 0;
        const end = filters.fy ? start + 12 : r.revenue.length;
        const total = r.revenue.slice(start, end).reduce((a, b) => a + b, 0);
        return (
          <div style={{ padding: '4px 8px', backgroundColor: '#FFA940', color: '#fff', borderRadius: '4px', fontWeight: 600, textAlign: 'right', fontSize: '11px' }}>
            ₹ {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        );
      },
      onHeaderCell: () => ({ style: { fontWeight: 600, fontSize: '11px', backgroundColor: '#FFA940', color: '#fff' } }),
      onCell: () => ({ style: cs }),
    };

    return [...base, ...monthCols, totalCol].filter(col => {
      if (!col.key) return true;
      if (col.key === 'total') return true;
      if (monthCols.find(c => c.key === col.key)) return true;
      return visibleColumns.has(col.key as string);
    });
  }, [filteredMonthHeaders, rows, filters, visibleColumns]);

  const displayRows = useMemo(() => rows.filter(r => {
    if (filters.project && !r.project.toLowerCase().includes(filters.project.toLowerCase())) return false;
    if (filters.space && !r.space.toLowerCase().includes(filters.space.toLowerCase())) return false;
    if (filters.owner && !r.owner.toLowerCase().includes(filters.owner.toLowerCase())) return false;
    return true;
  }), [rows, filters]);

  const handleSave = async () => {
    if (!dirty || !rows.length) return;
    setSaving(true);
    try {
      const apiProjects = rows.map(r => ({
        sno: r.sno,
        project: r.project,
        code: r.code,
        space: r.space,
        owner: r.owner,
        revenue: Object.fromEntries(monthHeaders.map((m, i) => [m, r.revenue[i] || 0])),
      }));
      const ok = await financeApi.bulkSave(apiProjects, monthHeaders);
      if (ok) {
        setDirty(false);
        setFromServer(true);
        message.success('All changes saved to database');
      } else {
        message.warning('Server unavailable — changes not saved to database');
      }
    } catch (e: any) {
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAll = async () => {
    await financeApi.clearAll();
    setRows([]);
    setMonthHeaders([]);
    setDirty(false);
    setFromServer(false);
    onDataChange?.([]);
    onMonthsChange?.([]);
    message.success('All data cleared');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Showing: <strong>{displayRows.length}</strong>{displayRows.length !== rows.length ? ` / ${rows.length}` : ''}
          </Text>
          {fromServer && !dirty && (
            <Tooltip title="Data loaded from database">
              <CloudServerOutlined style={{ color: '#52c41a', fontSize: 14 }} />
            </Tooltip>
          )}
          {dirty && (
            <Text type="warning" style={{ fontSize: '11px' }}>● Unsaved changes</Text>
          )}
        </Space>
        <Space size={8}>
          {dirty && (
            <Tooltip title="Save all changes to database">
              <Button
                icon={<SaveOutlined />}
                size="small"
                type="primary"
                loading={saving}
                onClick={handleSave}
                style={{ fontSize: '11px' }}
              >
                Save Changes
              </Button>
            </Tooltip>
          )}
          {rows.length > 0 && (
            <Popconfirm
              title="Delete all finance data?"
              description="This will permanently remove all projects and revenue from the database."
              onConfirm={handleClearAll}
              okText="Yes, delete all"
              cancelText="Cancel"
              okButtonProps={{ danger: true, size: 'small' }}
            >
              <Tooltip title="Delete all data">
                <Button icon={<DeleteOutlined />} size="small" danger />
              </Tooltip>
            </Popconfirm>
          )}
          {isFilterApplied && (
            <Button size="small" type="link" style={{ fontSize: '11px', color: '#ff4d4f' }} onClick={() => setFilters({ project: '', space: '', owner: '', fy: null })}>✕ Clear</Button>
          )}
          <Tooltip title="Filter">
            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} />
          </Tooltip>
          <Tooltip title="Column Settings">
            <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} />
          </Tooltip>
          <Tooltip title="Upload Excel">
            <Upload accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />} size="small" />
            </Upload>
          </Tooltip>
          <Tooltip title="Download Template">
            <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate} />
          </Tooltip>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        {showFilterPanel && (
          <div ref={filterPanelRef} style={{ width: 220, flexShrink: 0, background: '#fafafa', borderRadius: 8, padding: 16, border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text strong style={{ fontSize: '12px' }}>Filters</Text>
              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setFilters({ project: '', space: '', owner: '', fy: null })}>Clear all</Button>
            </div>
            <Space direction="vertical" style={{ width: '100%' }} size={8}>
              {[
                { label: 'Fiscal Year', key: 'fy', opts: availableFYs.map(f => ({ label: f.label, value: f.value.toString() })) },
                { label: 'Project', key: 'project', opts: [...new Set(rows.map(r => r.project).filter(Boolean))].map(v => ({ label: v, value: v })) },
                { label: 'Space', key: 'space', opts: [...new Set(rows.map(r => r.space).filter(Boolean))].map(v => ({ label: v, value: v })) },
                { label: 'Owner', key: 'owner', opts: [...new Set(rows.map(r => r.owner).filter(Boolean))].map(v => ({ label: v, value: v })) },
              ].map(({ label, key, opts }) => (
                <div key={key}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>{label}</div>
                  <Select size="small" placeholder={`Select ${label}...`} allowClear
                    value={(filters as any)[key] || undefined}
                    onChange={v => setFilters({ ...filters, [key]: v || (key === 'fy' ? null : '') })}
                    style={{ width: '100%', fontSize: '11px' }}
                    options={opts} />
                </div>
              ))}
            </Space>
          </div>
        )}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {rows.length === 0 ? (
            <div style={{ background: '#fafafa', borderRadius: 8, padding: 60, textAlign: 'center', border: '1px dashed #d9d9d9' }}>
              {loading
                ? <Spin tip="Loading from database..." />
                : <Text type="secondary">No data. Upload an Excel file to get started.</Text>
              }
            </div>
          ) : (
            <Table size="small" dataSource={displayRows} columns={columns}
              pagination={{ pageSize: 15, showSizeChanger: false }}
              scroll={{ x: 'max-content', y: 420 }}
              style={{ background: '#fff', borderRadius: 8 }} />
          )}
        </div>
      </div>

      <Drawer title="Column Visibility" placement="right" onClose={() => setColumnDrawer(false)} open={columnDrawer} width={280}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {['sno', 'project', 'code', 'space', 'owner'].map(key => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Checkbox checked={visibleColumns.has(key)} onChange={e => {
                const s = new Set(visibleColumns);
                e.target.checked ? s.add(key) : s.delete(key);
                setVisibleColumns(s);
              }} />
              <span style={{ textTransform: 'capitalize' }}>{key}</span>
            </div>
          ))}
        </Space>
      </Drawer>
    </div>
  );
}

interface InsightsProps {
  data: Row[];
  monthHeaders: string[];
}

function Insights({ data, monthHeaders }: InsightsProps) {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);

  const availableFYs = useMemo(() => {
    const years: string[] = [];
    for (let i = 0; i < monthHeaders.length; i += 12) {
      years.push(`FY${2026 + Math.floor(i / 12)}`);
    }
    return years.length ? years : ['FY26'];
  }, [monthHeaders]);

  const [fiscalYear, setFiscalYear] = useState<string>(availableFYs[0]);

  const fmt = (n: number) =>
    currency === 'USD' ? usd(n * exchangeRate) : inr(n);

  const qData = useMemo(() => {
    const fyIdx = availableFYs.indexOf(fiscalYear);
    const s = fyIdx * 12;
    const calcQ = (indices: number[]) =>
      data.reduce((t, r) => t + indices.reduce((q, i) => q + (r.revenue[i] || 0), 0), 0);
    const q = [calcQ([s,s+1,s+2]), calcQ([s+3,s+4,s+5]), calcQ([s+6,s+7,s+8]), calcQ([s+9,s+10,s+11])];
    const grand = q.reduce((a, b) => a + b, 0);
    const mLabel = (i: number) => monthHeaders[s + i] || '';
    return {
      quarters: q.map((v, i) => ({
        total: v,
        pct: grand ? Math.round((v / grand) * 100) : 0,
        label: `Q${i + 1}`,
        months: `${mLabel(i * 3)}–${mLabel(i * 3 + 2)}`,
      })),
      grand,
    };
  }, [data, monthHeaders, fiscalYear, availableFYs]);

  const yoyData = useMemo(() => {
    if (availableFYs.length < 2) return null;
    const calc = (fyIdx: number) => data.reduce((t, r) => {
      let s = 0;
      for (let i = fyIdx * 12; i < fyIdx * 12 + 12 && i < r.revenue.length; i++) s += r.revenue[i] || 0;
      return t + s;
    }, 0);
    const fy1 = calc(0), fy2 = calc(1);
    return { fy1, fy2, pct: fy1 ? Math.round(((fy2 - fy1) / fy1) * 100) : 0, labels: [availableFYs[0], availableFYs[1]] };
  }, [data, availableFYs]);

  if (!data || !data.length) return <Empty description="Upload data to view insights" style={{ marginTop: 48 }} />;

  const qColors = ['#1890FF', '#52C41A', '#FFA940', '#FF7875'];
  const qPctColor = (p: number) => p >= 30 ? '#52C41A' : p >= 20 ? '#FFA940' : '#FF7875';

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#001529', marginBottom: 4 }}>Insights – {fiscalYear}</h2>
          <p style={{ fontSize: '12px', color: '#8c8c8c', margin: 0 }}>Quarterly performance breakdown</p>
        </div>
        <Space wrap>
          <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 4 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>Fiscal Year</div>
            <Segmented value={fiscalYear} onChange={v => setFiscalYear(v as string)} options={availableFYs} />
          </div>
          <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 4 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>Currency</div>
            <Segmented value={currency} onChange={v => setCurrency(v as 'INR' | 'USD')} options={['INR', 'USD']} />
          </div>
          {currency === 'USD' && (
            <div style={{ background: '#f5f5f5', padding: '8px 12px', borderRadius: 4 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>Exchange Rate</div>
              <InputNumber value={exchangeRate} onChange={v => setExchangeRate(v || 0.013)} step={0.001} precision={4} prefix="1 INR = $" />
            </div>
          )}
        </Space>
      </div>

      <div style={{ background: 'linear-gradient(135deg, #001529 0%, #002A4D 100%)', borderRadius: 8, padding: '16px 20px', color: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Annual Revenue ({currency})</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#FFA940', marginTop: 4 }}>{fmt(qData.grand)}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Total Projects</div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: 4 }}>{data.length}</div>
          </div>
        </div>
      </div>

      <Row gutter={[12, 12]}>
        {qData.quarters.map((q, i) => (
          <Col key={q.label} xs={24} sm={12} md={6}>
            <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }} hoverable>
              <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 2 }}>{q.label}</div>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>{q.months}</div>
              <div style={{ fontSize: '20px', fontWeight: 700, color: qPctColor(q.pct), marginBottom: 4 }}>{fmt(q.total)}</div>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 8 }}>{q.pct}% Annual</div>
              <Progress percent={q.pct} strokeColor={qPctColor(q.pct)} format={() => ''} size="small" />
            </Card>
          </Col>
        ))}
      </Row>

      <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 16 }}>Quarterly Comparison</h3>
        <Row gutter={[24, 24]}>
          {qData.quarters.map((q, i) => (
            <Col key={q.label} xs={24} sm={12} md={6}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 90, height: 90, borderRadius: '50%', background: qColors[i], margin: '0 auto 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '16px', fontWeight: 700 }}>
                  {q.pct}%
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: 4 }}>{q.label}</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>{q.months}</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>{fmt(q.total)}</div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {yoyData && (
        <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 16 }}>Year-over-Year Comparison</h3>
          <Row gutter={[16, 16]}>
            {[
              { label: yoyData.labels[0], value: yoyData.fy1, color: '#1890FF' },
              { label: yoyData.labels[1], value: yoyData.fy2, color: '#52C41A' },
            ].map(({ label, value, color }) => (
              <Col key={label} xs={24} sm={12}>
                <div style={{ padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, background: '#f5f5f5', padding: '6px 8px', borderRadius: 4, marginBottom: 8 }}>{label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color, marginBottom: 4 }}>{fmt(value)}</div>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Total Revenue</div>
                </div>
              </Col>
            ))}
            <Col xs={24}>
              <div style={{ padding: 12, background: '#fff', borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>Year-over-Year Growth</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: yoyData.pct >= 0 ? '#52C41A' : '#FF7875' }}>
                    {yoyData.pct >= 0 ? '+' : ''}{yoyData.pct}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {yoyData.pct >= 0 ? 'Growth' : 'Decline'} from {yoyData.labels[0]} to {yoyData.labels[1]}
                  </div>
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </Space>
  );
}

interface FinanceManagementProps {
  onNavigate?: (module: string) => void;
}

export function FinanceManagement({ onNavigate: _onNavigate }: FinanceManagementProps) {
  const [projectData, setProjectData] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

  const items = [
    {
      key: 'milestones',
      label: <span style={{ fontSize: '11px' }}><FileExcelOutlined /> Project Milestones</span>,
      children: (
        <div style={{ padding: '0 0 16px' }}>
          <ProjectList onDataChange={setProjectData} onMonthsChange={setMonthHeaders} />
        </div>
      ),
    },
    {
      key: 'insights',
      label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Insights</span>,
      children: <Insights data={projectData} monthHeaders={monthHeaders} />,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div>
            <Title level={4} style={{ marginBottom: 2 }}>Revenue Details</Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>Planned revenue across projects and fiscal years</Text>
          </div>
          <div style={{ background: '#fff', borderRadius: 8 }}>
            <Tabs items={items} size="small" defaultActiveKey="milestones" style={{ padding: '0 16px' }} />
          </div>
        </Space>
      </div>
    </div>
  );
}
