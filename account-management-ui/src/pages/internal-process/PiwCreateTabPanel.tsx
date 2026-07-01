import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Dropdown, Form, Input, Select, Space, Steps, Table, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { DownloadOutlined, EllipsisOutlined, FileExcelOutlined, PlusOutlined, ShareAltOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as templateApi from '../../api/templateApi';
import * as piwApi from '../../api/piwApi';
import { useConfig } from '../../context/ConfigContext';
import type { ResourceRow } from '../../types/resource';
import { writeJsonSheetFile, writeMultiSheetFile } from '../../utils/xlsxExport';

const { Text } = Typography;

const RATE_BANDS = [
  { maxYears: 3, c_inr: 14769, s_inr: 16000, c_usd: 192, s_usd: 208 },
  { maxYears: 5, c_inr: 18462, s_inr: 21538, c_usd: 240, s_usd: 280 },
  { maxYears: 8, c_inr: 22769, s_inr: 24615, c_usd: 296, s_usd: 320 },
  { maxYears: 10, c_inr: 27692, s_inr: 30769, c_usd: 360, s_usd: 400 },
  { maxYears: Infinity, c_inr: 30769, s_inr: 36923, c_usd: 400, s_usd: 480 },
];

function parseWorkexToYears(totalWorkex: string): number {
  const yr = totalWorkex?.match(/(\d[\d.]*)\s*[Yy]r|(\d[\d.]*)\s*[Yy]ear/);
  const mo = totalWorkex?.match(/(\d[\d.]*)\s*[Mm]o|(\d[\d.]*)\s*[Mm]onth/);
  const years = yr ? parseFloat(yr[1] ?? yr[2]) : 0;
  const months = mo ? parseFloat(mo[1] ?? mo[2]) : 0;
  return years + months / 12;
}

function normalizeAllocationPercentage(value: string | number | undefined): number {
  const numeric = typeof value === 'number' ? value : Number(String(value || '').replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric) || numeric <= 0) return 100;
  return Math.min(100, Math.max(1, numeric));
}

function getHoursPerDay(allocationPercentage: string | number | undefined): number {
  const normalized = normalizeAllocationPercentage(allocationPercentage);
  return (8 * normalized) / 100;
}

function lookupDailyRate(totalWorkex: string, skillType: string = 'Commodity', currency: string = 'INR'): number {
  const years = parseWorkexToYears(totalWorkex);
  const band = RATE_BANDS.find(b => years < b.maxYears) ?? RATE_BANDS[RATE_BANDS.length - 1];
  const spec = skillType === 'Specialized';
  return currency === 'USD' ? (spec ? band.s_usd : band.c_usd) : (spec ? band.s_inr : band.c_inr);
}

type ProcessRow = {
  key: string;
  sow: string;
  salesforceId: string;
};

interface PiwResourceEntry {
  key: string;
  raidId: string;
  empName: string;
  piwRole: string;
  totalWorkex: string;
  skillType: string;
  allocationPercentage: string;
  dailyRate: number;
  manualDailyRate?: string;
  resourceStartDate: string;
  resourceEndDate: string;
}

interface PiwCreateTabPanelProps {
  resources: ResourceRow[];
  processRows: ProcessRow[];
  onUpdateProcessRow?: (key: string, updates: Partial<ProcessRow>) => void;
}

interface GeneratedReviewResource {
  key: string;
  raId: string;
  name: string;
  resourceType: string;
  skillType: string;
  experienceLabel: string;
  experienceStatus: 'valid' | 'missing' | 'invalid';
  allocationPercentage: number;
  hoursPerDay: string;
  allocationDefaulted: boolean;
  actualDailyRate: number;
  consideredDailyRate: number;
  actualHourlyRate: string;
  consideredHourlyRate: string;
  resourceStartDate?: string;
  resourceEndDate?: string;
  rateOverridden: boolean;
}

export default function PiwCreateTabPanel({ resources = [], processRows = [], onUpdateProcessRow }: PiwCreateTabPanelProps) {
  const { getConfigByLink, getAppValue } = useConfig();
  const spUrl = getAppValue('PIW_STORAGE_URL') || '';
  const engagementConfig = getConfigByLink('piw_engagement_field');
  const engagementNames = engagementConfig?.items.map(i => i.label) ?? [];

  const [step1Form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);
  const [projectDetails, setProjectDetails] = useState<Record<string, any> | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedData, setGeneratedData] = useState<{ formData: piwApi.PIWFormData; blob: Blob; reviewResources: GeneratedReviewResource[] } | null>(null);
  const [addCrmVisible, setAddCrmVisible] = useState(false);
  const [resourceRows, setResourceRows] = useState<PiwResourceEntry[]>([
    { key: 'r0', raidId: '', empName: '', piwRole: '', totalWorkex: '', skillType: 'Commodity', allocationPercentage: '100', dailyRate: 0, resourceStartDate: '', resourceEndDate: '' },
  ]);
  const [raidErrors, setRaidErrors] = useState<{ notFound: string[]; duplicates: string[]; missing: number[] } | null>(null);

  const sowOptions = useMemo(() => [...new Set(processRows.map(r => r.sow).filter(Boolean))], [processRows]);

  const handleSowChange = (sowName: string) => {
    const match = processRows.find(r => r.sow === sowName);
    if (match?.salesforceId) {
      step1Form.setFieldValue('crmOpportunityId', match.salesforceId);
      setAddCrmVisible(false);
    } else {
      step1Form.setFieldValue('crmOpportunityId', '');
      setAddCrmVisible(true);
    }
  };

  const handleRaidChange = (raidId: string, index: number) => {
    const isDuplicate = resourceRows.some((r, i) => i !== index && r.raidId === raidId);
    if (isDuplicate) {
      const res = resources.find(r => r.raId === raidId);
      message.error({
        content: <span><strong>{res?.empName || raidId}</strong> is already added. Each resource can only appear once per PIW.</span>,
        duration: 4,
      });
      return;
    }
    const res = resources.find(r => r.raId === raidId);
    setResourceRows(prev => {
      const next = [...prev];
      if (res) {
        const skillType = next[index].skillType || 'Commodity';
        const rate = lookupDailyRate(res.totalWorkex, skillType);
        next[index] = { ...next[index], raidId, empName: res.empName, piwRole: res.piwRole, totalWorkex: res.totalWorkex, dailyRate: rate };
      } else {
        next[index] = { ...next[index], raidId, empName: '', piwRole: '', totalWorkex: '', dailyRate: 0 };
      }
      return next;
    });
  };

  const handleSkillTypeChange = (skillType: string, index: number) => {
    setResourceRows(prev => {
      const next = [...prev];
      const row = next[index];
      const rate = row.totalWorkex ? lookupDailyRate(row.totalWorkex, skillType) : 0;
      next[index] = { ...row, skillType, dailyRate: rate };
      return next;
    });
  };

  const updateResourceRow = (index: number, field: keyof PiwResourceEntry, value: string | number) => {
    setResourceRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addResourceRow = () =>
    setResourceRows(prev => [...prev, { key: `r${Date.now()}`, raidId: '', empName: '', piwRole: '', totalWorkex: '', skillType: 'Commodity', allocationPercentage: '100', dailyRate: 0, manualDailyRate: '', resourceStartDate: '', resourceEndDate: '' }]);
  const removeResourceRow = (key: string) => setResourceRows(prev => prev.filter(r => r.key !== key));

  const normalizeExcelDate = (val: any): string => {
    if (!val) return '';
    const s = String(val).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
    if (mdy2) return `${2000 + parseInt(mdy2[3])}-${mdy2[1].padStart(2, '0')}-${mdy2[2].padStart(2, '0')}`;
    const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy4) return `${mdy4[3]}-${mdy4[1].padStart(2, '0')}-${mdy4[2].padStart(2, '0')}`;
    const dmy = s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
    return s;
  };

  const handleResourceExcelUpload = (file: File) => {
    setRaidErrors(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { raw: false });
        const newRows: PiwResourceEntry[] = [];
        const notFound: string[] = [];
        const duplicates: string[] = [];
        const missing: number[] = [];
        rows.forEach((row, i) => {
          const raidId = String(row['RAID'] || row['RA ID'] || row['Ra Id'] || '').trim();
          if (!raidId) { missing.push(i + 2); return; }
          if (newRows.some(r => r.raidId === raidId)) { duplicates.push(raidId); return; }
          const res = resources.find(r => r.raId === raidId);
          if (!res) { notFound.push(raidId); return; }
          const skillType = String(row['Skill Type'] || row['skill_type'] || 'Commodity').trim();
          const normalizedSkill = skillType.toLowerCase().includes('spec') ? 'Specialized' : 'Commodity';
          const rateOverride = String(row['Daily Rate (INR)'] || row['Daily Rate'] || '').replace(/[^\d]/g, '');
          const allocationRaw = String(row['Allocation %'] || row['Allocation Percentage'] || row['allocation_percentage'] || row['Allocation'] || '').trim();
          const allocationPercentage = normalizeAllocationPercentage(allocationRaw);
          const rate = lookupDailyRate(res.totalWorkex, normalizedSkill);
          newRows.push({
            key: `r_xl_${Date.now()}_${i}`,
            raidId,
            empName: res.empName,
            piwRole: res.piwRole,
            totalWorkex: res.totalWorkex,
            skillType: normalizedSkill,
            allocationPercentage: allocationRaw ? String(allocationPercentage) : '',
            dailyRate: rate,
            manualDailyRate: rateOverride,
            resourceStartDate: normalizeExcelDate(row['Start Date'] || row['start_date']),
            resourceEndDate: normalizeExcelDate(row['End Date'] || row['end_date']),
          });
        });
        const hasIssues = notFound.length > 0 || duplicates.length > 0 || missing.length > 0;
        if (hasIssues) setRaidErrors({ notFound, duplicates, missing });
        if (newRows.length === 0) {
          if (!hasIssues) message.error('No valid resource rows found in file');
          return;
        }
        setResourceRows(newRows);
        if (!hasIssues) message.success(`${newRows.length} resource(s) loaded from Excel`);
        else message.warning(`${newRows.length} resource(s) loaded — see errors below`);
      } catch (e: any) { message.error(e.message || 'Failed to parse file'); }
    };
    reader.readAsBinaryString(file);
    return false;
  };

  const downloadResourceTemplate = () => {
    writeJsonSheetFile(
      XLSX,
      [
        { RAID: 'RA001', 'Skill Type': 'Commodity', 'Allocation %': '100', 'Daily Rate (INR)': '', 'Start Date': '2026-07-01', 'End Date': '2026-09-30' },
        { RAID: 'RA002', 'Skill Type': 'Specialized', 'Allocation %': '50', 'Daily Rate (INR)': '', 'Start Date': '2026-08-01', 'End Date': '2026-10-31' },
      ],
      'PIW Resources',
      'PIW_Resources_Template.xlsx',
      { columnWidths: [12, 16, 14, 18, 14, 14] },
    );
  };

  const handleStep1Next = async () => {
    try {
      const values = await step1Form.validateFields();
      setProjectDetails(values);
      setCurrentStep(1);
    } catch {}
  };

  const handleGenerate = async () => {
    const valid = resourceRows.filter(r => r.raidId && r.empName);
    if (valid.length === 0) return message.error('Please select at least one resource');
    const missingDates = valid.filter(r => !r.resourceStartDate || !r.resourceEndDate);
    if (missingDates.length > 0) return message.error(`Please set start and end dates for: ${missingDates.map(r => r.empName).join(', ')}`);
    const invalidDates = valid.filter(r => new Date(r.resourceEndDate) <= new Date(r.resourceStartDate));
    if (invalidDates.length > 0) return message.error(`End date must be after start date for: ${invalidDates.map(r => r.empName).join(', ')}`);
    if (!projectDetails) return;

    const allStarts = valid.map(r => r.resourceStartDate).sort();
    const allEnds = valid.map(r => r.resourceEndDate).sort();
    const reviewResources: GeneratedReviewResource[] = valid.map((r, index) => {
      const actualDailyRate = r.dailyRate || 0;
      const consideredDailyRate = r.manualDailyRate ? Number(r.manualDailyRate) : actualDailyRate;
      const allocationRaw = String(r.allocationPercentage || '').trim();
      const allocationDefaulted = !allocationRaw;
      const allocationPercentage = normalizeAllocationPercentage(allocationRaw);
      const hoursPerDay = getHoursPerDay(allocationPercentage);
      const rawExperience = (r.totalWorkex || '').trim();
      const parsedYears = parseWorkexToYears(rawExperience);
      const experienceStatus: GeneratedReviewResource['experienceStatus'] =
        !rawExperience ? 'missing' : parsedYears > 0 ? 'valid' : 'invalid';
      return {
        key: `${r.raidId || 'resource'}_${index}`,
        raId: r.raidId,
        name: r.empName,
        resourceType: r.piwRole,
        skillType: r.skillType,
        experienceLabel:
          experienceStatus === 'valid'
            ? `${parsedYears} year${parsedYears === 1 ? '' : 's'}`
            : experienceStatus === 'missing'
              ? 'Experience missing in Resource Hub'
              : `Experience format invalid in Resource Hub${rawExperience ? ` (${rawExperience})` : ''}`,
        experienceStatus,
        allocationPercentage,
        hoursPerDay: hoursPerDay ? String(hoursPerDay) : '',
        allocationDefaulted,
        actualDailyRate,
        consideredDailyRate,
        actualHourlyRate: actualDailyRate ? (actualDailyRate / 8).toFixed(2) : '',
        consideredHourlyRate: consideredDailyRate ? (consideredDailyRate / 8).toFixed(2) : '',
        resourceStartDate: r.resourceStartDate || undefined,
        resourceEndDate: r.resourceEndDate || undefined,
        rateOverridden: Boolean(r.manualDailyRate) && consideredDailyRate !== actualDailyRate,
      };
    });
    setGenerating(true);
    try {
      const formData: piwApi.PIWFormData = {
        clientCompanyName: projectDetails.clientCompanyName || '',
        projectName: projectDetails.projectName,
        sowNumber: projectDetails.sowNumber,
        crmOpportunityId: projectDetails.crmOpportunityId,
        contractType: projectDetails.contractType,
        currency: projectDetails.currency || 'INR',
        plannedStartDate: allStarts[0],
        plannedEndDate: allEnds[allEnds.length - 1],
        resources: valid.map(r => ({
          raId: r.raidId,
          name: r.empName,
          resourceType: r.piwRole,
          skillType: r.skillType,
          allocationPercentage: normalizeAllocationPercentage(r.allocationPercentage),
          dailyRate: r.manualDailyRate ? Number(r.manualDailyRate) : r.dailyRate,
          resourceStartDate: r.resourceStartDate || undefined,
          resourceEndDate: r.resourceEndDate || undefined,
        })),
      };
      const blob = await piwApi.generatePIW(formData);
      setGeneratedData({ formData, blob, reviewResources });
      setCurrentStep(2);
      message.success('PIW generated — review below and download when ready');
    } catch (e: any) {
      message.error(e.message || 'Failed to generate PIW');
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedData) return;
    const sow = generatedData.formData.sowNumber || '';
    const piwName = 'PIW - ' + sow.replace(/^SOW\s*[-–—]?\s*/i, '').trim();
    piwApi.downloadPIW(generatedData.blob, piwName);
    message.success('PIW downloaded');
  };

  const getCurrencyPrefix = (currency?: string) => {
    switch ((currency || 'INR').toUpperCase()) {
      case 'USD': return '$';
      case 'EUR': return 'EUR ';
      case 'GBP': return 'GBP ';
      case 'INR':
      default:
        return '₹';
    }
  };

  const formatRate = (value?: number, currency?: string) => {
    if (!value) return '—';
    return `${getCurrencyPrefix(currency)}${value.toLocaleString()}`;
  };

  const getCalculatedHourlyRate = (dailyRate?: number) => {
    if (!dailyRate) return '';
    return (dailyRate / 8).toFixed(2);
  };

  const handleDownloadDetailsExcel = () => {
    if (!generatedData) return;
    const { formData } = generatedData;
    const summaryRows = [
      { Field: 'Project / Engagement', Value: formData.projectName || '' },
      { Field: 'SOW Name', Value: formData.sowNumber || '' },
      { Field: 'CRM Opportunity', Value: formData.crmOpportunityId || '' },
      { Field: 'Contract Type', Value: formData.contractType || '' },
      { Field: 'Currency', Value: formData.currency || 'INR' },
      { Field: 'Overall Start Date', Value: formData.plannedStartDate || '' },
      { Field: 'Overall End Date', Value: formData.plannedEndDate || '' },
    ];
    const resourceRows = generatedData.reviewResources.map((resource, index) => ({
      'S.No': index + 1,
      'RAID': resource.raId || '',
      'Resource Name': resource.name || '',
      'PIW Role': resource.resourceType || '',
      'Skill Type': resource.skillType || '',
      'Allocation %': resource.allocationPercentage || '',
      'Hours / Day': resource.hoursPerDay || '',
      'Allocation Note': resource.allocationDefaulted ? 'Defaulted to 100% because allocation was not provided' : 'Provided explicitly',
      'Actual Daily Rate': resource.actualDailyRate || '',
      'Considered Daily Rate': resource.consideredDailyRate || '',
      'Actual Hourly Rate': resource.actualHourlyRate || '',
      'Considered Hourly Rate': resource.consideredHourlyRate || '',
      'Hourly Rate Source': resource.consideredDailyRate ? 'Calculated = Considered Daily Rate / 8' : '',
      'Rate Warning': resource.rateOverridden ? `Actual: ${resource.actualDailyRate} | Considered: ${resource.consideredDailyRate}` : '',
      'Start Date': resource.resourceStartDate || '',
      'End Date': resource.resourceEndDate || '',
    }));
    const sow = formData.sowNumber || 'PIW';
    const fileName = `${String(sow).replace(/[\\/:*?"<>|]+/g, ' ').trim() || 'PIW'} - Details.xlsx`;
    writeMultiSheetFile(XLSX, [
      { type: 'json', sheetName: 'PIW Summary', rows: summaryRows, options: { columnWidths: [24, 32] } },
      { type: 'json', sheetName: 'PIW Resources', rows: resourceRows, options: { columnWidths: [8, 12, 24, 18, 12, 12, 16, 18, 18, 20, 32, 28, 14, 14] } },
    ], fileName);
    message.success('PIW details exported to Excel');
  };

  const handleReset = () => {
    step1Form.resetFields();
    step1Form.setFieldsValue({ projectName: 'TBD', sowNumber: 'TBD', crmOpportunityId: 'TBD' });
    setCurrentStep(0);
    setProjectDetails(null);
    setGeneratedData(null);
    setAddCrmVisible(false);
    setResourceRows([{ key: 'r0', raidId: '', empName: '', piwRole: '', totalWorkex: '', skillType: 'Commodity', allocationPercentage: '100', dailyRate: 0, manualDailyRate: '', resourceStartDate: '', resourceEndDate: '' }]);
    setRaidErrors(null);
  };

  const fl = (txt: string) => <span style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>{txt}</span>;
  const sectionTitle = (txt: string) => <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626', display: 'block', marginBottom: 12 }}>{txt}</Text>;
  const overriddenReviewResources = generatedData?.reviewResources.filter(resource => resource.rateOverridden) ?? [];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>Fill the form to generate PIW</Text>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'download-resource-template', icon: <DownloadOutlined style={{ fontSize: '11px' }} />, label: <span style={{ fontSize: '11px' }}>Download Resource Upload Template</span>, onClick: downloadResourceTemplate },
              {
                key: 'download-template',
                icon: <FileExcelOutlined style={{ fontSize: '11px' }} />,
                label: <span style={{ fontSize: '11px' }}>Download PIW Template</span>,
                onClick: async () => {
                  try {
                    const result = await templateApi.getTemplates('piw_template');
                    if (result.ok && result.data && result.data.length > 0) {
                      const tpl = result.data[0];
                      await templateApi.downloadTemplate(tpl.id, tpl.file_name || 'PIW_template.xlsm');
                      message.success('PIW template downloaded');
                    } else {
                      message.info('No PIW template uploaded yet. Upload one in Configuration > Templates');
                    }
                  } catch (e: any) { message.error(e.message || 'Download failed'); }
                },
              },
              ...(spUrl ? [{
                key: 'open-sp',
                icon: <ShareAltOutlined style={{ fontSize: '11px' }} />,
                label: <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: 'inherit' }}>Open SharePoint Folder ↗</a>,
              }] : []),
            ],
          }}
        >
          <Button size="small" type="text" icon={<EllipsisOutlined />} style={{ fontSize: '11px', borderRadius: 4 }} />
        </Dropdown>
      </div>

      <Steps current={currentStep} size="small" style={{ marginBottom: 16 }}>
        <Steps.Step title={<span style={{ fontSize: '11px' }}>Project Details</span>} />
        <Steps.Step title={<span style={{ fontSize: '11px' }}>Resources</span>} />
        <Steps.Step title={<span style={{ fontSize: '11px' }}>Review & Download</span>} />
      </Steps>

      {currentStep === 0 && (
        <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          <Form form={step1Form} layout="vertical" size="small" initialValues={{ contractType: 'T&M', currency: 'INR', projectName: 'TBD', sowNumber: 'TBD', crmOpportunityId: 'TBD' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
              <Form.Item label={<span style={{ fontSize: '11px', fontWeight: 500, color: '#595959' }}>Project / Engagement Name {!engagementConfig && <span style={{ color: '#1890ff', fontSize: '10px', marginLeft: 6 }}>(Link a config type in <strong>Configuration</strong> → select type → Link to <em>"PIW — Project / Engagement Name"</em>)</span>}</span>} name="projectName" rules={[{ required: true, message: 'Required' }]}>
                {engagementNames.length > 0 ? <Select placeholder="Select project" showSearch>{engagementNames.map(n => <Select.Option key={n} value={n}>{n}</Select.Option>)}</Select> : <Input placeholder="Enter project / engagement name" />}
              </Form.Item>
              <Form.Item label={fl('SOW Name')} name="sowNumber" rules={[{ required: true, message: 'Required' }]}>
                <Select placeholder="Select SOW or type TBD" showSearch onChange={handleSowChange} allowClear dropdownRender={menu => <>{menu}<div style={{ padding: '4px 8px', borderTop: '1px solid #f0f0f0' }}><Input size="small" placeholder="Type manually (e.g. TBD)" style={{ fontSize: '11px' }} onKeyDown={e => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) { step1Form.setFieldValue('sowNumber', v); handleSowChange(v); } } }} /></div></>}>
                  {sowOptions.map(s => <Select.Option key={s} value={s}>{s}</Select.Option>)}
                </Select>
              </Form.Item>
              <Form.Item label={fl('CRM Opportunity #')} name="crmOpportunityId" rules={[{ required: false }]}><Input placeholder="Auto-populated from SOW · or enter manually" /></Form.Item>
              {addCrmVisible && (
                <div style={{ gridColumn: '1 / -1', background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', marginBottom: 8, fontSize: '11px', color: '#873800' }}>
                  ⚠️ No CRM Opportunity linked to this SOW.{' '}
                  <span style={{ color: '#1890ff', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => {
                    const v = step1Form.getFieldValue('crmOpportunityId');
                    const sow = step1Form.getFieldValue('sowNumber');
                    if (v && sow && onUpdateProcessRow) {
                      const row = processRows.find(r => r.sow === sow);
                      if (row) { onUpdateProcessRow(row.key, { salesforceId: v }); message.success('CRM ID saved to Process Overview'); setAddCrmVisible(false); }
                    } else if (!v) {
                      message.warning('Enter a CRM ID above first');
                    }
                  }}>Save to Process Overview</span>
                </div>
              )}
              <Form.Item label={fl('Contract Type')} name="contractType" rules={[{ required: true, message: 'Required' }]}><Select><Select.Option value="T&M">T&M (Time &amp; Material)</Select.Option><Select.Option value="Fixed Fee">Fixed Fee</Select.Option></Select></Form.Item>
              <Form.Item label={fl('Currency')} name="currency"><Select><Select.Option value="INR">INR — Indian Rupee</Select.Option><Select.Option value="USD">USD — US Dollar</Select.Option><Select.Option value="EUR">EUR — Euro</Select.Option><Select.Option value="GBP">GBP — British Pound</Select.Option></Select></Form.Item>
            </div>
            <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 8 }}>📅 Overall project start &amp; end dates will be derived from the earliest and latest resource engagement dates set in the next step.</div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
              <Button type="primary" size="small" style={{ fontSize: '11px' }} onClick={handleStep1Next}>Next → Resources</Button>
            </div>
          </Form>
        </Card>
      )}

      {currentStep === 1 && (
        <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>Delivery Workstream — Select Resources</Text>
            <Space><Upload beforeUpload={handleResourceExcelUpload} showUploadList={false} accept=".xlsx,.xls"><Button size="small" icon={<UploadOutlined />} style={{ fontSize: '11px' }}>Upload Excel</Button></Upload></Space>
          </div>
          <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 6, padding: '6px 12px', marginBottom: 12, fontSize: '11px', color: '#003eb3' }}>
            <strong>{projectDetails?.projectName}</strong>&nbsp;·&nbsp;{projectDetails?.sowNumber}&nbsp;·&nbsp;{projectDetails?.contractType}&nbsp;·&nbsp;INR
          </div>
          <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 8 }}>
            Allocation % drives daily billable hours in PIW calculations: <strong>100% = 8 hrs/day</strong>, <strong>50% = 4 hrs/day</strong>, <strong>25% = 2 hrs/day</strong>. If left blank, it will be <strong>considered as 100%</strong>.
          </div>
          {resources.length === 0 && <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: '11px', color: '#cf1322' }}>⚠️ No resources found. Please add resources in <strong>Resource Hub</strong> first.</div>}
          {raidErrors && (
            <Alert
              type={raidErrors.notFound.length > 0 ? 'error' : 'warning'}
              showIcon
              closable
              onClose={() => setRaidErrors(null)}
              message={raidErrors.notFound.length > 0 ? `${raidErrors.notFound.length} RAID ID(s) not found in Resource Hub — rows skipped` : `${raidErrors.duplicates.length + raidErrors.missing.length} row(s) skipped`}
              description={<div style={{ fontSize: '11px' }}>{raidErrors.notFound.length > 0 && <div style={{ marginBottom: 4 }}><strong>Not found in Resource Hub:</strong> {raidErrors.notFound.map(r => <Tag key={r} color="red" style={{ fontSize: '10px', marginBottom: 2 }}>{r}</Tag>)}<br /><span style={{ color: '#8c8c8c' }}>Ensure the RA ID in Resource Hub matches exactly (check the RA ID column in Resource Hub).</span></div>}{raidErrors.duplicates.length > 0 && <div style={{ marginBottom: 4 }}><strong>Duplicate RAIDs skipped:</strong> {raidErrors.duplicates.map(r => <Tag key={r} color="orange" style={{ fontSize: '10px', marginBottom: 2 }}>{r}</Tag>)}</div>}{raidErrors.missing.length > 0 && <div><strong>Rows with missing RAID (skipped):</strong> Row {raidErrors.missing.join(', Row ')}</div>}</div>}
              style={{ marginBottom: 12, fontSize: '12px' }}
            />
          )}
          {resourceRows.map((row, index) => {
            const selectedInOtherRows = new Set(resourceRows.filter((_, i) => i !== index).map(r => r.raidId).filter(Boolean));
            const dateStyle: React.CSSProperties = { width: '100%', padding: '3px 7px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: '11px', color: '#595959', outline: 'none' };
            return (
              <div key={row.key} style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 10px', marginBottom: 6 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '28px 180px 1fr 150px 24px', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1890ff', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{index + 1}</div>
                  <Select size="small" showSearch placeholder="Select RAID" value={row.raidId || undefined} onChange={v => handleRaidChange(v, index)} style={{ width: '100%', fontSize: '11px' }} filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())} options={resources.map(r => ({ value: r.raId, label: `${r.raId} · ${r.empName}`, disabled: selectedInOtherRows.has(r.raId) }))} />
                  <Input size="small" value={row.empName} readOnly placeholder="Name" style={{ background: '#fafafa', color: '#595959', fontSize: '11px' }} />
                  <Input size="small" value={row.piwRole} readOnly placeholder="PIW Role" style={{ background: '#fafafa', color: '#595959', fontSize: '11px' }} />
                  <Button size="small" type="text" danger onClick={() => removeResourceRow(row.key)} style={{ padding: '0 4px', fontSize: '11px' }}>✕</Button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 90px 95px 75px 1fr 1fr', gap: 6, alignItems: 'center' }}>
                  <Select size="small" value={row.skillType || 'Commodity'} onChange={v => handleSkillTypeChange(v, index)} style={{ fontSize: '11px' }} options={[{ value: 'Commodity', label: 'Commodity' }, { value: 'Specialized', label: 'Specialized' }]} />
                  <Input
                    size="small"
                    value={row.allocationPercentage || '100'}
                    onChange={e => updateResourceRow(index, 'allocationPercentage', e.target.value.replace(/[^\d.]/g, ''))}
                    suffix="%"
                    placeholder="100"
                    style={{ textAlign: 'right', color: '#595959', fontSize: '11px' }}
                  />
                  <Input size="small" value={row.manualDailyRate} onChange={e => updateResourceRow(index, 'manualDailyRate', e.target.value.replace(/[^\d]/g, ''))} placeholder={row.dailyRate ? `Auto: ${row.dailyRate.toLocaleString()}` : 'Daily rate'} prefix={<span style={{ fontSize: '10px', color: '#595959' }}>₹</span>} style={{ textAlign: 'right', color: '#595959', fontSize: '11px' }} />
                  <Input size="small" value={(() => { const d = row.manualDailyRate ? Number(row.manualDailyRate) : row.dailyRate; return d ? (d / 8).toFixed(2) : ''; })()} readOnly style={{ background: '#f6ffed', textAlign: 'right', color: '#389e0d', fontWeight: 500, fontSize: '11px' }} />
                  <input className="light-date-input" type="date" value={row.resourceStartDate || ''} placeholder="Start Date" onChange={e => updateResourceRow(index, 'resourceStartDate', e.target.value)} style={dateStyle} />
                  <input className="light-date-input" type="date" value={row.resourceEndDate || ''} placeholder="End Date" onChange={e => updateResourceRow(index, 'resourceEndDate', e.target.value)} style={dateStyle} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 90px 95px 75px 1fr 1fr', gap: 6, marginTop: 2 }}>{['Skill Type', 'Allocation %', 'Daily Rate', 'Hourly Rate', 'Engagement Start', 'Engagement End'].map(h => <span key={h} style={{ fontSize: '10px', color: '#bfbfbf' }}>{h}</span>)}</div>
              </div>
            );
          })}
          <Button type="dashed" size="small" block onClick={addResourceRow} icon={<PlusOutlined />} style={{ marginTop: 4, marginBottom: 16, borderRadius: 4, fontSize: '11px' }}>Add Resource</Button>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button size="small" style={{ fontSize: '11px' }} onClick={() => setCurrentStep(0)}>← Back</Button>
            <Space>
              <Button size="small" style={{ fontSize: '11px' }} onClick={handleReset}>Reset</Button>
              <Button type="primary" size="small" style={{ fontSize: '11px' }} loading={generating} onClick={handleGenerate}>Generate PIW</Button>
            </Space>
          </div>
        </Card>
      )}

      {currentStep === 2 && generatedData && (
        <Card bordered={false} style={{ background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            {sectionTitle('Generated PIW — Review & Download')}
            <Space>
              <Button size="small" style={{ fontSize: '11px' }} onClick={() => setCurrentStep(1)}>← Back to Resources</Button>
              <Button size="small" style={{ fontSize: '11px' }} icon={<FileExcelOutlined />} onClick={handleDownloadDetailsExcel}>Download Details (.xlsx)</Button>
              <Button type="primary" size="small" style={{ fontSize: '11px' }} icon={<DownloadOutlined />} onClick={handleDownload}>Download PIW (.xlsm)</Button>
              <Button size="small" style={{ fontSize: '11px' }} onClick={handleReset}>New PIW</Button>
            </Space>
          </div>
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px', marginBottom: 14 }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1890ff', display: 'block', marginBottom: 8 }}>📄 Front Page</Text>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 24px' }}>
              {[
                ['Project / Engagement', generatedData.formData.projectName],
                ['SOW Name', generatedData.formData.sowNumber],
                ['CRM Opportunity', generatedData.formData.crmOpportunityId || '—'],
                ['Contract Type', generatedData.formData.contractType],
                ['Currency', generatedData.formData.currency || 'INR'],
                ['Overall Start Date', generatedData.formData.plannedStartDate],
                ['Overall End Date', generatedData.formData.plannedEndDate],
              ].map(([label, val]) => (
                <div key={label} style={{ display: 'flex', gap: 8, alignItems: 'baseline', fontSize: '11px' }}>
                  <span style={{ color: '#8c8c8c', minWidth: 140 }}>{label}:</span>
                  <span style={{ color: '#262626', fontWeight: 500 }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
          {overriddenReviewResources.length > 0 && (
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 14 }}
              message={`${overriddenReviewResources.length} resource(s) have a rate override`}
              description={
                <div style={{ fontSize: '11px' }}>
                  {overriddenReviewResources.map(resource => (
                    <div key={resource.key} style={{ marginBottom: 4 }}>
                      <Text strong style={{ fontSize: '11px' }}>{resource.name}</Text>
                      <span style={{ color: '#595959' }}> · Skill Type: </span>
                      <Tag color={resource.skillType === 'Specialized' ? 'purple' : 'blue'} style={{ fontSize: '10px', marginInlineEnd: 6 }}>
                        {resource.skillType || '—'}
                      </Tag>
                      <span style={{ color: '#595959' }}>Allocation: </span>
                      <Tag color="cyan" style={{ fontSize: '10px', marginInlineEnd: 6 }}>
                        {resource.allocationPercentage}% ({resource.hoursPerDay} hrs/day)
                      </Tag>
                      <span style={{ color: '#595959' }}>Experience: </span>
                      <Tag
                        color={resource.experienceStatus === 'valid' ? 'geekblue' : 'error'}
                        style={{ fontSize: '10px', marginInlineEnd: 6 }}
                      >
                        {resource.experienceLabel}
                      </Tag>
                      <span style={{ color: '#595959' }}> — Actual Daily Rate: </span>
                      <Tag color="gold" style={{ fontSize: '10px', marginInlineEnd: 6 }}>{formatRate(resource.actualDailyRate, generatedData.formData.currency)}</Tag>
                      <span style={{ color: '#595959' }}>Considered Daily Rate: </span>
                      <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>{formatRate(resource.consideredDailyRate, generatedData.formData.currency)}</Tag>
                    </div>
                  ))}
                </div>
              }
            />
          )}
          <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1890ff', display: 'block', marginBottom: 8 }}>📊 Delivery Workstream ({generatedData.formData.resources.length} resource{generatedData.formData.resources.length !== 1 ? 's' : ''})</Text>
            <Table
              size="small"
              pagination={false}
              rowKey="key"
              dataSource={generatedData.reviewResources}
              columns={[
                {
                  title: <span style={{ fontSize: '10px' }}>RAID</span>,
                  dataIndex: 'raId',
                  key: 'raId',
                  width: 90,
                  render: (value: string) => <span style={{ fontSize: '10px', color: '#8c8c8c', fontFamily: 'monospace' }}>{value || '—'}</span>,
                },
                {
                  title: <span style={{ fontSize: '10px' }}>Resource Name</span>,
                  dataIndex: 'name',
                  key: 'name',
                  render: (value: string, record: GeneratedReviewResource) => (
                    <Space direction="vertical" size={2}>
                      <Text style={{ fontSize: '11px', color: '#262626', fontWeight: 500 }}>{value}</Text>
                      {record.skillType ? <Tag color={record.skillType === 'Specialized' ? 'purple' : 'blue'} style={{ fontSize: '10px', width: 'fit-content', margin: 0 }}>{record.skillType}</Tag> : null}
                    </Space>
                  ),
                },
                {
                  title: <span style={{ fontSize: '10px' }}>PIW Role</span>,
                  dataIndex: 'resourceType',
                  key: 'resourceType',
                  width: 120,
                  render: (value: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{value || '—'}</span>,
                },
                {
                  title: <span style={{ fontSize: '10px' }}>Allocation</span>,
                  key: 'allocationPercentage',
                  width: 120,
                  render: (_: unknown, record: GeneratedReviewResource) => (
                    <Space direction="vertical" size={2}>
                      <Tag color="cyan" style={{ fontSize: '10px', margin: 0 }}>
                        {record.allocationPercentage}% · {record.hoursPerDay} hrs/day
                      </Tag>
                      {record.allocationDefaulted && (
                        <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>
                          Defaulted to 100%
                        </Tag>
                      )}
                    </Space>
                  ),
                },
                {
                  title: <span style={{ fontSize: '10px' }}>Daily Rate</span>,
                  key: 'dailyRate',
                  width: 180,
                  render: (_: unknown, record: GeneratedReviewResource) => (
                    <Space direction="vertical" size={2}>
                      <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>Used: {formatRate(record.consideredDailyRate, generatedData.formData.currency)}</Tag>
                      <Tag color={record.rateOverridden ? 'gold' : 'default'} style={{ fontSize: '10px', margin: 0 }}>
                        Actual: {formatRate(record.actualDailyRate, generatedData.formData.currency)}
                      </Tag>
                    </Space>
                  ),
                },
                {
                  title: <span style={{ fontSize: '10px' }}>Hourly Rate</span>,
                  key: 'hourlyRate',
                  width: 180,
                  render: (_: unknown, record: GeneratedReviewResource) => (
                    <Space direction="vertical" size={2}>
                      <Tooltip title={record.consideredDailyRate ? `Used hourly rate = ${formatRate(record.consideredDailyRate, generatedData.formData.currency)} / 8 = ${getCurrencyPrefix(generatedData.formData.currency)}${record.consideredHourlyRate}` : 'No daily rate available'}>
                        <Tag color="green" style={{ fontSize: '10px', margin: 0, cursor: record.consideredDailyRate ? 'help' : 'default' }}>
                          Used: {record.consideredHourlyRate ? `${getCurrencyPrefix(generatedData.formData.currency)}${record.consideredHourlyRate}` : '—'}
                        </Tag>
                      </Tooltip>
                      <Tooltip title={record.actualDailyRate ? `Actual hourly rate = ${formatRate(record.actualDailyRate, generatedData.formData.currency)} / 8 = ${getCurrencyPrefix(generatedData.formData.currency)}${record.actualHourlyRate}` : 'No actual daily rate available'}>
                        <Tag color={record.rateOverridden ? 'gold' : 'default'} style={{ fontSize: '10px', margin: 0, cursor: record.actualDailyRate ? 'help' : 'default' }}>
                          Actual: {record.actualHourlyRate ? `${getCurrencyPrefix(generatedData.formData.currency)}${record.actualHourlyRate}` : '—'}
                        </Tag>
                      </Tooltip>
                    </Space>
                  ),
                },
                {
                  title: <span style={{ fontSize: '10px' }}>Rate Check</span>,
                  key: 'rateCheck',
                  width: 110,
                  render: (_: unknown, record: GeneratedReviewResource) => record.rateOverridden
                    ? <Tag color="warning" style={{ fontSize: '10px', margin: 0 }}>Override Used</Tag>
                    : <Tag color="success" style={{ fontSize: '10px', margin: 0 }}>As Calculated</Tag>,
                },
                {
                  title: <span style={{ fontSize: '10px' }}>Start Date</span>,
                  dataIndex: 'resourceStartDate',
                  key: 'resourceStartDate',
                  width: 110,
                  render: (value?: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{value || '—'}</span>,
                },
                {
                  title: <span style={{ fontSize: '10px' }}>End Date</span>,
                  dataIndex: 'resourceEndDate',
                  key: 'resourceEndDate',
                  width: 110,
                  render: (value?: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{value || '—'}</span>,
                },
              ]}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
