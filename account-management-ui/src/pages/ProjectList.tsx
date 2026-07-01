import React, { useMemo, useState } from 'react';
import { Upload, Table, Typography, Space, Button, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { writeJsonSheetFile } from '../utils/xlsxExport';

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
    'Oct', 'Nov', 'Dec',
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep',
    'Oct', 'Nov', 'Dec',
  ];

  const rows = Array.from({ length: 5 }).map((_, i) => {
    const row: any = {};
    headers.forEach(h => (row[h] = ''));
    row['S.No.'] = i + 1;
    return row;
  });

  writeJsonSheetFile(XLSX, rows, 'ZS Revenue 2026', 'ZS_Revenue_Template_2026.xlsx', { header: headers });
}



export function ProjectList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);

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

      const mapped: Row[] = json.map((r, i) => ({
        key: r.Code || String(i),
        sno: Number(r['S.No.'] || i + 1),
        project: r.Project,
        code: r.Code,
        space: r.Space,
        owner: r.Owners,
        revenue: monthCols.map(m => parseINR(r[m])),
      }));

      setRows(mapped);
      message.success(`Loaded ${mapped.length} projects`);
    } catch (e: any) {
      message.error(e.message || 'Failed to read Excel');
    }
    return false;
  };

  const columns: ColumnsType<Row> = useMemo(() => {
    const base: ColumnsType<Row> = [
      { title: 'S.No.', dataIndex: 'sno', width: 80 },
      { title: 'Project', dataIndex: 'project', ellipsis: true },
      { title: 'Code', dataIndex: 'code', width: 120 },
      { title: 'Space', dataIndex: 'space', width: 150 },
      { title: 'Owner', dataIndex: 'owner', width: 120 },
    ];

    const months: ColumnsType<Row> = monthHeaders.map((m, idx) => ({
      title: m,
      dataIndex: ['revenue', idx],
      align: 'right',
      width: 140,
      render: inr,
    }));

    const total: ColumnsType<Row> = [
      {
        title: 'Total (INR)',
        align: 'right',
        width: 160,
        render: (_, r) => inr(r.revenue.reduce((a, b) => a + b, 0)),
      },
    ];

    return [...base, ...months, ...total];
  }, [monthHeaders]);

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
      <Title level={4}>ZS Account Revenue – 2026</Title>

     
     <Space>
  <Upload
    accept=".xlsx,.xls"
    beforeUpload={handleUpload}
    showUploadList={false}
  >
    <Button icon={<UploadOutlined />}>
      Upload Excel
    </Button>
  </Upload>

  <Button onClick={downloadTemplate}>
    Download Template
  </Button>
</Space>


      <Table
        bordered
        size="small"
        dataSource={rows}
        columns={columns}
        pagination={{ pageSize: 10 }}
        scroll={{ x: 1600 }}
      />
    </Space>
  );
}