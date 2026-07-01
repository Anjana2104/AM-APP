import React, { useState, useRef } from 'react';
import { Upload, Table, Typography, Space, Button, message, Input, Tooltip, Checkbox, Select } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined, DownloadOutlined, FilterOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { writeAoaSheetFile } from '../utils/xlsxExport';

const { Text } = Typography;

export type Row = {
  id: string;
  projectName: string;
  client: string;
  fiscalYear: string;
  status: string;
  [month: string]: string | number;
};

interface ProjectListProps {
  onDataChange: (rows: Row[]) => void;
  onMonthsChange: (months: string[]) => void;
}

const FIXED_COLS = ['projectName', 'client', 'fiscalYear', 'status'];
const STORAGE_KEY = 'eam_finance_projects';

export function FinanceProjectTable({ onDataChange, onMonthsChange }: ProjectListProps) {
  const [rows, setRows] = useState<Row[]>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
  });
  const [monthHeaders, setMonthHeaders] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [visibleCols, setVisibleCols] = useState<string[]>([...FIXED_COLS]);
  const fileRef = useRef<HTMLInputElement>(null);

  const persist = (data: Row[], months: string[]) => {
    setRows(data);
    setMonthHeaders(months);
    onDataChange(data);
    onMonthsChange(months);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const downloadTemplate = () => {
    const headers = ['Project Name', 'Client', 'Fiscal Year', 'Status', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
    writeAoaSheetFile(XLSX, [headers], 'Finance', 'Finance_Template.xlsx');
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (raw.length < 2) { message.warning('No data found'); return; }
        const headers: string[] = (raw[0] as string[]).map(h => String(h || '').trim());
        const months = headers.filter(h => !['Project Name','Client','Fiscal Year','Status'].includes(h));
        const parsed: Row[] = raw.slice(1).filter(r => r.some(Boolean)).map((r, i) => {
          const row: Row = { id: `r${Date.now()}${i}`, projectName: r[headers.indexOf('Project Name')] || '', client: r[headers.indexOf('Client')] || '', fiscalYear: r[headers.indexOf('Fiscal Year')] || '', status: r[headers.indexOf('Status')] || '' };
          months.forEach(m => { row[m] = r[headers.indexOf(m)] ?? ''; });
          return row;
        });
        persist([...rows, ...parsed], months);
        message.success(`Imported ${parsed.length} rows`);
      } catch { message.error('Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const filtered = rows.filter(r =>
    !search || [r.projectName, r.client, r.fiscalYear, r.status].some(v => String(v).toLowerCase().includes(search.toLowerCase()))
  );

  const allCols = [...FIXED_COLS, ...monthHeaders];
  const colDefs: ColumnsType<Row> = allCols.filter(c => visibleCols.includes(c)).map(c => ({
    key: c, dataIndex: c,
    title: c === 'projectName' ? 'Project Name' : c === 'fiscalYear' ? 'FY' : c.charAt(0).toUpperCase() + c.slice(1),
    width: FIXED_COLS.includes(c) ? undefined : 80,
    render: (v: any) => <Text style={{ fontSize: 12 }}>{v ?? ''}</Text>,
  }));

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button icon={<UploadOutlined />} size="small" onClick={() => fileRef.current?.click()}>Upload</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate}>Template</Button>
        <Input placeholder="Search…" size="small" style={{ width: 180 }} value={search} onChange={e => setSearch(e.target.value)} prefix={<FilterOutlined style={{ color: '#bbb' }} />} />
        <Select
          mode="multiple" size="small" style={{ minWidth: 180 }} placeholder="Columns" maxTagCount={2}
          value={visibleCols} onChange={setVisibleCols}
          options={allCols.map(c => ({ value: c, label: c === 'projectName' ? 'Project Name' : c === 'fiscalYear' ? 'FY' : c.charAt(0).toUpperCase() + c.slice(1) }))}
        />
      </div>
      <Table
        rowKey="id" columns={colDefs} dataSource={filtered}
        size="small" scroll={{ x: true }}
        pagination={{ pageSize: 15, showSizeChanger: false, size: 'small' }}
        locale={{ emptyText: <Text type="secondary">Upload an Excel file to load finance data</Text> }}
      />
    </div>
  );
}
