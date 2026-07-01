import React, { useMemo, useState } from 'react';
import { Button, Card, Dropdown, Form, Input, Modal, Select, Space, Typography, Upload, message } from 'antd';
import { DownloadOutlined, EllipsisOutlined, FileWordOutlined, PlusOutlined, ShareAltOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as sowApi from '../../api/sowApi';
import * as templateApi from '../../api/templateApi';
import { lookupDailyRate, parseWorkexToYears } from './shared';
import type { ProcessRow, SowResourceEntry } from './types';
import type { ResourceRow } from '../../types/resource';
import { writeJsonSheetFile } from '../../utils/xlsxExport';

const { Text } = Typography;

interface SowGenerateTabProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  spUrl?: string;
}

export function SowGenerateTab({ resources = [], processRows = [], spUrl = '' }: SowGenerateTabProps) {
  const autoSowNumber = useMemo(() => {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `SOW - ${months[now.getMonth()]} ${now.getFullYear()} - ${rand}`;
  }, []);

  const todayFormatted = useMemo(() => {
    const now = new Date();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
  }, []);

  const [sowName, setSowName] = useState(autoSowNumber);
  const [sowNumber, setSowNumber] = useState('');
  const [serviceProvider, setServiceProvider] = useState('Rockwell Automation Pvt Ltd');
  const [workProduct, setWorkProduct] = useState('');
  const [personnelNote, setPersonnelNote] = useState('');
  const [generating, setGenerating] = useState(false);

  const emptyRow = (): SowResourceEntry => ({
    key: `sr${Date.now()}`,
    raidId: '',
    empId: '',
    empName: '',
    piwRole: '',
    skill: '',
    totalWorkex: '',
    location: 'Bengaluru',
    overheadCategory: '',
    skillType: 'Commodity',
    dailyRate: 0,
    manualDailyRate: '',
    resourceStartDate: '',
    resourceEndDate: '',
  });

  const [sowRows, setSowRows] = useState<SowResourceEntry[]>([emptyRow()]);

  const handleRaidChange = (raidId: string, index: number) => {
    const resource = resources.find(item => item.raId === raidId);
    setSowRows(prev => {
      const next = [...prev];
      const skillType = next[index].skillType || 'Commodity';
      if (resource) {
        next[index] = {
          ...next[index],
          raidId,
          empName: resource.empName,
          piwRole: resource.piwRole || '',
          totalWorkex: resource.totalWorkex || '',
          dailyRate: lookupDailyRate(resource.totalWorkex || '', skillType),
        };
      } else {
        next[index] = { ...next[index], raidId, empName: '', piwRole: '', totalWorkex: '', dailyRate: 0 };
      }
      return next;
    });
  };

  const handleSkillTypeChange = (skillType: string, index: number) => {
    setSowRows(prev => {
      const next = [...prev];
      const row = next[index];
      next[index] = { ...row, skillType, dailyRate: row.totalWorkex ? lookupDailyRate(row.totalWorkex, skillType) : 0 };
      return next;
    });
  };

  const updateField = (index: number, field: keyof SowResourceEntry, value: string | number) =>
    setSowRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });

  const handleGenerate = async () => {
    const valid = sowRows.filter(row => row.raidId && row.empName);
    if (valid.length === 0) { message.error('Please select at least one resource'); return; }
    const missingDates = valid.filter(row => !row.resourceStartDate || !row.resourceEndDate);
    if (missingDates.length > 0) { message.error(`Set start & end dates for: ${missingDates.map(row => row.empName).join(', ')}`); return; }

    setGenerating(true);
    try {
      const formData: sowApi.SOWFormData = {
        sowNumber: sowNumber || '',
        serviceProvider: serviceProvider || 'Rockwell Automation Pvt Ltd',
        workProduct,
        resources: valid.map(row => ({
          raId: row.raidId,
          empId: row.empId || '',
          name: row.empName,
          skill: row.skill || row.piwRole || '',
          location: row.location || 'Bengaluru',
          experience: (() => { const years = parseWorkexToYears(row.totalWorkex || ''); return years > 0 ? String(Math.round(years * 100) / 100) : ''; })(),
          overheadCategory: row.overheadCategory || '',
          dailyRate: row.manualDailyRate ? Number(row.manualDailyRate) : row.dailyRate,
          resourceStartDate: row.resourceStartDate || undefined,
          resourceEndDate: row.resourceEndDate || undefined,
        })),
      };
      const blob = await sowApi.generateSOW(formData);
      sowApi.downloadSOW(blob, sowName || autoSowNumber);
      message.success('SOW downloaded');
    } catch (error: any) {
      message.error(error.message || 'Failed to generate SOW');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    setSowName(autoSowNumber);
    setSowNumber('');
    setServiceProvider('Rockwell Automation Pvt Ltd');
    setWorkProduct('');
    setPersonnelNote('');
    setSowRows([emptyRow()]);
  };

  const fld = (text: string) => <span style={{ fontSize: '10px', color: '#8c8c8c' }}>{text}</span>;

  const downloadSowResourceTemplate = () => {
    writeJsonSheetFile(
      XLSX,
      [
        { RAID: 'RA001', 'Employee ID': 'E001', 'Skill Type': 'Commodity', Skill: 'Java Developer', Location: 'Bengaluru', 'Overhead Category': 'C - Only Laptop Provided', 'Bill Rate (INR) Daily': '', 'Start Date': '2026-07-01', 'End Date': '2026-09-30' },
        { RAID: 'RA002', 'Employee ID': 'E002', 'Skill Type': 'Specialized', Skill: 'Architect', Location: 'Bengaluru', 'Overhead Category': 'B - Laptop + Infra', 'Bill Rate (INR) Daily': '', 'Start Date': '2026-08-01', 'End Date': '2026-10-31' },
      ],
      'SOW Resources',
      'SOW_Resources_Template.xlsx',
      { columnWidths: [10, 12, 14, 18, 14, 30, 22, 14, 14] },
    );
  };

  const handleSowResourceUpload = (file: File) => {
    const normalizeExcelDate = (value: any): string => {
      if (!value) return '';
      const str = String(value).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
      const mdy2 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
      if (mdy2) return `${2000 + parseInt(mdy2[3], 10)}-${mdy2[1].padStart(2, '0')}-${mdy2[2].padStart(2, '0')}`;
      const mdy4 = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (mdy4) return `${mdy4[3]}-${mdy4[1].padStart(2, '0')}-${mdy4[2].padStart(2, '0')}`;
      const dmy = str.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      return str;
    };

    const reader = new FileReader();
    reader.onload = event => {
      try {
        const workbook = XLSX.read(event.target?.result, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { raw: false });
        const newRows: SowResourceEntry[] = [];
        const errors: string[] = [];
        rows.forEach((row, index) => {
          const raidId = String(row.RAID || row['RA ID'] || '').trim();
          if (!raidId) { errors.push(`Row ${index + 2}: Missing RAID`); return; }
          if (newRows.some(item => item.raidId === raidId)) { errors.push(`Row ${index + 2}: Duplicate RAID ${raidId}`); return; }
          const resource = resources.find(item => item.raId === raidId);
          if (!resource) { errors.push(`Row ${index + 2}: RAID "${raidId}" not found in Resource Hub`); return; }
          const skillType = String(row['Skill Type'] || 'Commodity').toLowerCase().includes('spec') ? 'Specialized' : 'Commodity';
          newRows.push({
            key: `sr_xl_${Date.now()}_${index}`,
            raidId,
            empId: String(row['Employee ID'] || '').trim(),
            empName: resource.empName,
            piwRole: resource.piwRole || '',
            totalWorkex: resource.totalWorkex || '',
            skill: String(row.Skill || resource.piwRole || '').trim(),
            location: String(row.Location || 'Bengaluru').trim(),
            overheadCategory: String(row['Overhead Category'] || '').trim(),
            skillType,
            dailyRate: lookupDailyRate(resource.totalWorkex || '', skillType),
            manualDailyRate: String(row['Bill Rate'] || row['Bill Rate (INR) Daily'] || '').trim(),
            resourceStartDate: normalizeExcelDate(row['Start Date'] || row.start_date),
            resourceEndDate: normalizeExcelDate(row['End Date'] || row.end_date),
          });
        });

        if (newRows.length === 0 && errors.length > 0) {
          Modal.error({ title: 'Upload Failed', content: <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((error, index) => <li key={index} style={{ fontSize: '12px', color: '#f5222d' }}>{error}</li>)}</ul> });
          return;
        }

        setSowRows(newRows);
        if (errors.length > 0) {
          Modal.warning({ title: `${newRows.length} resource(s) loaded — ${errors.length} skipped`, content: <ul style={{ margin: 0, paddingLeft: 18 }}>{errors.map((error, index) => <li key={index} style={{ fontSize: '12px' }}>{error}</li>)}</ul> });
        } else {
          message.success(`${newRows.length} resource(s) loaded from Excel`);
        }
      } catch (error: any) {
        message.error(error.message || 'Failed to parse file');
      }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const ellipsisItems = [
    {
      key: 'dl-tpl',
      label: <span style={{ fontSize: '11px' }}>Download SOW Template</span>,
      icon: <DownloadOutlined />,
      onClick: async () => {
        try {
          const result = await templateApi.getTemplates('sow_template');
          if (result.ok && result.data && result.data.length > 0) {
            const template = result.data[0];
            await templateApi.downloadTemplate(template.id, template.file_name || 'SOW_template.docx');
            message.success('SOW template downloaded');
          } else {
            message.info('No SOW template uploaded yet. Upload one in Configuration > Templates');
          }
        } catch (error: any) {
          message.error(error.message || 'Download failed');
        }
      },
    },
    ...(spUrl ? [{
      key: 'sp',
      label: <span style={{ fontSize: '11px' }}>Open SharePoint Folder ↗</span>,
      icon: <ShareAltOutlined />,
      onClick: () => window.open(spUrl, '_blank', 'noopener,noreferrer'),
    }] : []),
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>Generate SOW Document</Text>
        <Space size={4}>
          <Button type="primary" size="small" style={{ fontSize: '11px' }} icon={<FileWordOutlined />} loading={generating} onClick={handleGenerate}>
            Generate &amp; Download
          </Button>
          <Button size="small" style={{ fontSize: '11px' }} onClick={handleReset}>Reset</Button>
          <Dropdown menu={{ items: ellipsisItems }} trigger={['click']} placement="bottomRight">
            <Button size="small" icon={<EllipsisOutlined />} style={{ fontSize: '11px' }} />
          </Dropdown>
        </Space>
      </div>

      <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 12 }}>
        <Form layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>SOW Name</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={sowName} onChange={event => setSowName(event.target.value)} placeholder="Used as the download filename" style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Date</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={todayFormatted} readOnly style={{ fontSize: '11px', background: '#f5f5f5', color: '#595959' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Work Order (SOW)</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={sowNumber} onChange={event => setSowNumber(event.target.value)} placeholder="Leave blank if not assigned" style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Service Provider</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={serviceProvider} onChange={event => setServiceProvider(event.target.value)} style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Work Product / Service</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={workProduct} onChange={event => setWorkProduct(event.target.value)} placeholder="Describe the work product or service" style={{ fontSize: '11px' }} />
            </Form.Item>
            <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500 }}>Service Provider's Personnel to be assigned</span>} style={{ marginBottom: 10 }}>
              <Input size="small" value={personnelNote} onChange={event => setPersonnelNote(event.target.value)} placeholder="e.g. as per Schedule below" style={{ fontSize: '11px' }} />
            </Form.Item>
          </div>
        </Form>
      </Card>

      <div style={{ marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: '11px', fontWeight: 600, color: '#262626' }}>Resources</Text>
        <Space size={4}>
          {resources.length === 0 && <span style={{ fontSize: '10px', color: '#cf1322' }}>⚠️ No resources in Resource Hub</span>}
          <Button size="small" icon={<DownloadOutlined />} style={{ fontSize: '11px' }} onClick={downloadSowResourceTemplate}>
            Resource Template
          </Button>
          <Upload beforeUpload={handleSowResourceUpload} showUploadList={false} accept=".xlsx,.xls">
            <Button size="small" icon={<UploadOutlined />} style={{ fontSize: '11px' }}>Resource Details</Button>
          </Upload>
        </Space>
      </div>

      {sowRows.map((row, index) => {
        const selectedOther = new Set(sowRows.filter((_, rowIndex) => rowIndex !== index).map(item => item.raidId).filter(Boolean));
        const dateStyle: React.CSSProperties = { width: '100%', padding: '3px 7px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: '11px', color: '#595959', outline: 'none' };

        return (
          <Card key={row.key} bordered={false} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, marginBottom: 8, padding: 0 }} bodyStyle={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#fa8c16', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {index + 1}
                </div>
                <Select size="small" showSearch placeholder="Select RAID" value={row.raidId || undefined} onChange={value => handleRaidChange(value, index)} style={{ width: 180, fontSize: '11px' }} filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())} options={resources.map(resource => ({ value: resource.raId, label: `${resource.raId} · ${resource.empName}`, disabled: selectedOther.has(resource.raId) }))} />
              </div>
              {sowRows.length > 1 && (
                <Button size="small" type="text" danger onClick={() => setSowRows(prev => prev.filter(item => item.key !== row.key))} style={{ padding: '0 4px', fontSize: '11px' }}>✕</Button>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 130px 1fr', gap: 8, marginBottom: 6 }}>
              <div>
                {fld('Name')}
                <Input size="small" value={row.empName} readOnly placeholder="Auto from RAID" style={{ marginTop: 2, fontSize: '11px', background: '#fafafa', color: '#595959' }} />
              </div>
              <div>
                {fld('Employee ID')}
                <Input size="small" value={row.empId} onChange={event => updateField(index, 'empId', event.target.value)} placeholder="Emp ID" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
              <div>
                {fld('Skill Type')}
                <Select size="small" value={row.skillType || 'Commodity'} onChange={value => handleSkillTypeChange(value, index)} style={{ width: '100%', marginTop: 2, fontSize: '11px' }} options={[{ value: 'Commodity', label: 'Commodity' }, { value: 'Specialized', label: 'Specialized' }]} />
              </div>
              <div>
                {fld('Skill')}
                <Input size="small" value={row.skill} onChange={event => updateField(index, 'skill', event.target.value)} placeholder="e.g. Java Developer" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 1fr 140px', gap: 8, marginBottom: 6 }}>
              <div>
                {fld('Location')}
                <Input size="small" value={row.location} onChange={event => updateField(index, 'location', event.target.value)} placeholder="Bengaluru" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
              <div>
                {fld('Year of Experience')}
                <Input size="small" value={row.totalWorkex} readOnly placeholder="Auto from RAID" style={{ marginTop: 2, fontSize: '11px', background: '#fafafa', color: '#595959' }} />
              </div>
              <div>
                {fld('Overhead Category')}
                <Input size="small" value={row.overheadCategory} onChange={event => updateField(index, 'overheadCategory', event.target.value)} placeholder="e.g. C - Only Laptop Provided" style={{ marginTop: 2, fontSize: '11px' }} />
              </div>
              <div>
                {fld('Bill Rate (INR) Daily')}
                <Input size="small" value={row.manualDailyRate} onChange={event => updateField(index, 'manualDailyRate', event.target.value.replace(/[^\d]/g, ''))} placeholder={row.dailyRate ? `Auto: ₹${row.dailyRate.toLocaleString()}` : 'Enter rate'} prefix={<span style={{ fontSize: '10px', color: '#389e0d' }}>₹</span>} style={{ marginTop: 2, fontSize: '11px', color: '#389e0d', fontWeight: 500 }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 8 }}>
              <div>
                {fld('Start Date')}
                <input className="light-date-input" type="date" value={row.resourceStartDate || ''} onChange={event => updateField(index, 'resourceStartDate', event.target.value)} style={{ ...dateStyle, marginTop: 2 }} />
              </div>
              <div>
                {fld('End Date')}
                <input className="light-date-input" type="date" value={row.resourceEndDate || ''} onChange={event => updateField(index, 'resourceEndDate', event.target.value)} style={{ ...dateStyle, marginTop: 2 }} />
              </div>
            </div>
          </Card>
        );
      })}

      <Button type="dashed" size="small" block icon={<PlusOutlined />} onClick={() => setSowRows(prev => [...prev, emptyRow()])} style={{ marginTop: 2, marginBottom: 4, borderRadius: 6, fontSize: '11px' }}>
        Add Resource
      </Button>
    </div>
  );
}
