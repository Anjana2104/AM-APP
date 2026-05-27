import React, { useMemo, useState } from 'react';
import { Upload, Table, Typography, Space, Button, message, Input, Segmented, Tooltip } from 'antd';
import type { ColumnsType, ColumnType } from 'antd/es/table';
import { UploadOutlined, ExpandAltOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

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
  const [selectedFY, setSelectedFY] = useState<string | null>(null);

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
      const json = XLSX.utils.sheet_to_json<ExcelRow>(ws, { defval: '' });

      if (!json.length) {
        message.error('Excel sheet is empty');
        return false;
      }

      const headers = Object.keys(json[0]);
      const fixedCols = ['S.No.', 'Project', 'Code', 'Space', 'Owners'];

      const monthCols = headers.filter(h => !fixedCols.includes(h));
      setMonthHeaders(monthCols);

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
    if (!selectedFY) return monthHeaders;
    const fyIndex = parseInt(selectedFY);
    return monthHeaders.slice(fyIndex, fyIndex + 12);
  }, [monthHeaders, selectedFY]);

  const columns: ColumnsType<Row> = useMemo(() => {
    const fixedHeaderStyle = { backgroundColor: '#E6F7FF', fontWeight: 600 };
    const monthHeaderStyle = { backgroundColor: '#F6F8FB', fontWeight: 600 };
    const totalHeaderStyle = { backgroundColor: '#FFA940', fontWeight: 600, color: '#fff' };
    const cellStyle = { whiteSpace: 'pre-wrap' as const, wordWrap: 'break-word' as const };

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
        width: 60,
        onHeaderCell: () => ({ style: fixedHeaderStyle }),
        onCell: () => ({ style: cellStyle }),
      },
      {
        title: 'Project',
        dataIndex: 'project',
        width: 180,
        filters: Array.from(new Set(rows.map(r => r.project).filter(Boolean))).map(p => ({
          text: p,
          value: p,
        })),
        onFilter: (value, record) => record.project === value,
        render: (value: string) => (
          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {value}
          </div>
        ),
        onHeaderCell: () => ({ style: fixedHeaderStyle }),
        onCell: () => ({ style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      },
      {
        title: 'Code',
        dataIndex: 'code',
        width: 110,
        render: (value: string, record: Row) => (
          <Input
            value={deriveCodeFromProject(record.project) || value}
            disabled
            style={{ border: 'none', background: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            title="Code is auto-derived from Project Name"
          />
        ),
        onHeaderCell: () => ({ style: fixedHeaderStyle }),
        onCell: () => ({ style: cellStyle }),
      },
      {
        title: 'Space',
        dataIndex: 'space',
        width: 120,
        filters: Array.from(new Set(rows.map(r => r.space).filter(Boolean))).map(s => ({
          text: s,
          value: s,
        })),
        onFilter: (value, record) => record.space === value,
        render: (value: string, record: Row) => (
          <Input
            value={value}
            onChange={e => handleFieldChange(record.key, 'space', e.target.value)}
            style={{ border: 'none', background: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          />
        ),
        onHeaderCell: () => ({ style: fixedHeaderStyle }),
        onCell: () => ({ style: cellStyle }),
      },
      {
        title: 'Owner',
        dataIndex: 'owner',
        width: 120,
        filters: Array.from(new Set(rows.map(r => r.owner).filter(Boolean))).map(o => ({
          text: o,
          value: o,
        })),
        onFilter: (value, record) => record.owner === value,
        render: (value: string, record: Row) => (
          <Input
            value={value}
            onChange={e => handleFieldChange(record.key, 'owner', e.target.value)}
            style={{ border: 'none', background: 'transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          />
        ),
        onHeaderCell: () => ({ style: fixedHeaderStyle }),
        onCell: () => ({ style: cellStyle }),
      },
    ];

    const monthColumns: ColumnType<Row>[] = filteredMonthHeaders.map((m, displayIdx) => {
      const actualIdx = selectedFY ? parseInt(selectedFY) + displayIdx : displayIdx;
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
            style={{ textAlign: 'right', border: 'none', background: 'transparent', whiteSpace: 'nowrap' }}
            onBlur={e => {
              if (!e.target.value) {
                handleRevenueChange(record.key, actualIdx, '0');
              }
            }}
          />
        ),
        onHeaderCell: () => ({ style: monthHeaderStyle }),
        onCell: () => ({ style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }),
      };
    });

    const totalColumn: ColumnType<Row> = {
      title: 'Total (INR)',
      align: 'right' as const,
      width: 140,
      render: (_, record) => {
        const indices = selectedFY ? [parseInt(selectedFY), parseInt(selectedFY) + 11] : [0, record.revenue.length - 1];
        const total = record.revenue.slice(indices[0], indices[1] + 1).reduce((a, b) => a + b, 0);
        return (
          <div style={{ padding: '4px 8px', backgroundColor: '#FFA940', color: '#fff', borderRadius: '4px', fontWeight: 600, textAlign: 'right', whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
            ₹ {total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
          </div>
        );
      },
      onHeaderCell: () => ({ style: totalHeaderStyle }),
      onCell: () => ({ style: cellStyle }),
    };

    return [...baseColumns, ...monthColumns, totalColumn];
  }, [filteredMonthHeaders, rows, selectedFY]);

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Space wrap style={{ gap: '16px', alignItems: 'center' }}>
        <Upload
          accept=".xlsx,.xls"
          beforeUpload={handleUpload}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>
            Upload Project Details
          </Button>
        </Upload>

        <Button onClick={downloadTemplate}>
          Download Template
        </Button>

        {availableFYs.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#001529' }}>Filter by Fiscal Year:</span>
            <Segmented
              value={selectedFY || 'all'}
              onChange={(value) => setSelectedFY(value === 'all' ? null : value as string)}
              options={[{ label: 'All Years', value: 'all' }, ...availableFYs]}
              style={{ fontSize: '12px' }}
            />
          </div>
        )}
      </Space>

      <Table
        bordered
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 'max-content' }}
      />
    </Space>
  );
}