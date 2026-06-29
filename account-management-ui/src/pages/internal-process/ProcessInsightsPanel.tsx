import React, { useMemo, useRef, useState } from 'react';
import { Button, Card, Col, DatePicker, Empty, Progress, Row, Select, Space, Statistic, Table, Tag, Typography, message } from 'antd';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ClusterOutlined,
  ExportOutlined,
  RiseOutlined,
} from '@ant-design/icons';
import html2canvas from 'html2canvas';
import type { Dayjs } from 'dayjs';

const { Text } = Typography;
const HEADER_COLOR = '#1d39c4';

function gridHeader(label: string) {
  return <Text strong style={{ fontSize: 11, color: HEADER_COLOR }}>{label}</Text>;
}

type ProcessInsightsRow = {
  id?: number;
  processId?: string;
  sow: string;
  active: string;
  signedSow: string;
  piw: string;
  salesforceId: string;
  promsId: string;
  budget: string;
  eprev?: string;
  openAirCode: string;
  accountAnchor?: string;
  startDate: string;
  createdAt?: string;
  updatedAt?: string;
  stepCompletedAt?: Record<string, string> | string;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const PROGRESS_STAGES = [
  { key: 'signed_sow', label: 'Signed SOW' },
  { key: 'piw', label: 'PIW' },
  { key: 'salesforce_id', label: 'Salesforce ID' },
  { key: 'proms_id', label: 'PROMS ID' },
  { key: 'budget', label: 'Budget' },
  { key: 'open_air_code', label: 'Open Air Code' },
  { key: 'eprev', label: 'Eprev' },
];

function deriveStatus(row: ProcessInsightsRow): 'Not Started' | 'In Progress' | 'Completed' {
  if (row.openAirCode?.trim() || row.eprev?.trim() === 'Yes') return 'Completed';
  if (row.signedSow?.trim() === 'Yes' || row.piw?.trim() || row.salesforceId?.trim() || row.promsId?.trim() || row.budget?.trim()) return 'In Progress';
  return 'Not Started';
}

function parseFlexibleDate(raw: string | undefined): Date | null {
  const value = String(raw || '').trim();
  if (!value) return null;
  const ddMon = value.match(/^(\d{1,2})[- ]([A-Za-z]{3})[- ](\d{2,4})$/);
  if (ddMon) {
    const day = Number(ddMon[1]);
    const month = MONTH_NAMES.indexOf(ddMon[2].charAt(0).toUpperCase() + ddMon[2].slice(1).toLowerCase());
    const year = ddMon[3].length === 2 ? 2000 + Number(ddMon[3]) : Number(ddMon[3]);
    if (month >= 0) {
      const dt = new Date(Date.UTC(year, month, day, 0, 0, 0));
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }
  const ddmmyyyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const dt = new Date(Date.UTC(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]), 0, 0, 0));
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  return null;
}

function parseMonthYear(dateStr: string): string {
  const d = parseFlexibleDate(dateStr);
  if (!d) return '';
  return `${MONTH_NAMES[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

function monthSortKey(my: string): number {
  const m = my.match(/([A-Za-z]{3})-?(\d{4})/);
  if (!m) return 0;
  return Number(m[2]) * 100 + MONTH_NAMES.indexOf(m[1]);
}

function normalizeStepCompletedAt(raw: ProcessInsightsRow['stepCompletedAt']): Record<string, string> {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, string>;
  } catch (_) {}
  return {};
}

function getStepTimestamp(map: Record<string, string>, key: string): string {
  const keyAliases: Record<string, string[]> = {
    signed_sow: ['signed_sow', 'signedSow'],
    salesforce_id: ['salesforce_id', 'salesforceId', 'sf'],
    proms_id: ['proms_id', 'proms', 'promsId'],
    budget: ['budget'],
    open_air_code: ['open_air_code', 'openAirCode'],
    piw: ['piw'],
    eprev: ['eprev'],
    sow: ['sow'],
  };
  return (keyAliases[key] || [key]).map(k => map[k]).find(Boolean) || '';
}

function toUtcDisplay(iso: string): string {
  const dt = parseFlexibleDate(iso);
  if (!dt) return iso;
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

function daysBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.round((ms / 86400000) * 100) / 100;
}

function formatDateInput(date: Date): string {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const d = `${date.getUTCDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function mapStageToProcessStatus(stageKey: string): string {
  return stageKey === 'open_air_code' || stageKey === 'eprev' ? 'Completed' : 'In Progress';
}

interface ProcessInsightsPanelProps {
  rows: ProcessInsightsRow[];
  onNavigate?: (filters: Record<string, any>) => void;
}

function ExportIconButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <Button
      type="text"
      size="small"
      icon={<ExportOutlined style={{ color: '#1677ff', fontSize: 13 }} />}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={title}
      style={{ paddingInline: 4 }}
    />
  );
}

export default function ProcessInsightsPanel({ rows, onNavigate }: ProcessInsightsPanelProps) {
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [trendStage, setTrendStage] = useState<string>('open_air_code');
  const pipelineCoverageRef = useRef<HTMLDivElement>(null);
  const anchorDistributionRef = useRef<HTMLDivElement>(null);
  const monthlyTrendRef = useRef<HTMLDivElement>(null);
  const monthlyBreakdownRef = useRef<HTMLDivElement>(null);
  const progressAnalysisRef = useRef<HTMLDivElement>(null);
  const globalDateFilters = useMemo(() => {
    if (!dateRange) return {};
    return {
      startDateFrom: dateRange[0].format('YYYY-MM-DD'),
      startDateTo: dateRange[1].format('YYYY-MM-DD'),
    };
  }, [dateRange]);

  const scopedRows = useMemo(() => {
    if (!dateRange) return rows;
    const start = dateRange[0].startOf('day').valueOf();
    const end = dateRange[1].endOf('day').valueOf();
    return rows.filter(r => {
      const d = parseFlexibleDate(r.startDate);
      if (!d) return false;
      const t = d.getTime();
      return t >= start && t <= end;
    });
  }, [rows, dateRange]);

  const analytics = useMemo(() => {
    const total = scopedRows.length;
    const active = scopedRows.filter(r => r.active === 'Yes').length;
    const inactive = scopedRows.filter(r => r.active !== 'Yes').length;
    const notStarted = scopedRows.filter(r => deriveStatus(r) === 'Not Started').length;
    const inProgress = scopedRows.filter(r => deriveStatus(r) === 'In Progress').length;
    const completed = scopedRows.filter(r => deriveStatus(r) === 'Completed').length;
    const withSignedSow = scopedRows.filter(r => r.signedSow === 'Yes').length;
    const withPiw = scopedRows.filter(r => !!r.piw?.trim()).length;
    const withSalesforce = scopedRows.filter(r => !!r.salesforceId?.trim()).length;
    const withProms = scopedRows.filter(r => !!r.promsId?.trim()).length;
    const withBudget = scopedRows.filter(r => !!r.budget?.trim()).length;
    const withEprev = scopedRows.filter(r => r.eprev === 'Yes').length;
    const withOpenAir = scopedRows.filter(r => !!r.openAirCode?.trim()).length;
    const withAnchor = scopedRows.filter(r => !!r.accountAnchor?.trim()).length;

    const anchorMap: Record<string, number> = {};
    scopedRows.forEach(r => {
      const anchor = r.accountAnchor || 'Unassigned';
      anchorMap[anchor] = (anchorMap[anchor] || 0) + 1;
    });

    const monthMap = new Map<string, { notStarted: number; inProgress: number; completed: number; total: number }>();
    scopedRows.forEach(r => {
      const month = parseMonthYear(r.startDate) || 'Unknown';
      const status = deriveStatus(r);
      const existing = monthMap.get(month) || { notStarted: 0, inProgress: 0, completed: 0, total: 0 };
      existing.total++;
      if (status === 'Not Started') existing.notStarted++;
      else if (status === 'In Progress') existing.inProgress++;
      else existing.completed++;
      monthMap.set(month, existing);
    });

    const monthData = Array.from(monthMap.entries())
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      active,
      inactive,
      notStarted,
      inProgress,
      completed,
      withSignedSow,
      withPiw,
      withSalesforce,
      withProms,
      withBudget,
      withEprev,
      withOpenAir,
      withAnchor,
      anchorMap,
      monthData,
      completionRate,
    };
  }, [scopedRows]);

  const progressDetails = useMemo(() => {
    const details: Array<{
      processId: string;
      sow: string;
      dateRaised: string;
      month: string;
      stageKey: string;
      stageLabel: string;
      completedAt: string;
      daysFromRaised: number;
      daysFromPreviousStage: number;
    }> = [];

    scopedRows.forEach(row => {
      const raisedDate = parseFlexibleDate(row.startDate);
      if (!raisedDate) return;
      const map = normalizeStepCompletedAt(row.stepCompletedAt);
      let previous = raisedDate;
      PROGRESS_STAGES.forEach(stage => {
        const rawTs = getStepTimestamp(map, stage.key);
        const completedAt = parseFlexibleDate(rawTs);
        if (!completedAt) return;
        details.push({
          processId: row.processId || (row.id ? `P${row.id}` : ''),
          sow: row.sow || '',
          dateRaised: row.startDate || '',
          month: parseMonthYear(row.startDate) || 'Unknown',
          stageKey: stage.key,
          stageLabel: stage.label,
          completedAt: rawTs,
          daysFromRaised: daysBetween(raisedDate, completedAt),
          daysFromPreviousStage: daysBetween(previous, completedAt),
        });
        previous = completedAt;
      });
    });

    return details;
  }, [scopedRows]);

  const stageAverages = useMemo(() => {
    return PROGRESS_STAGES.map(stage => {
      const stageRows = progressDetails.filter(d => d.stageKey === stage.key);
      const samples = stageRows.length;
      const avgFromRaised = samples > 0
        ? Math.round((stageRows.reduce((acc, s) => acc + s.daysFromRaised, 0) / samples) * 100) / 100
        : 0;
      const avgFromPrevious = samples > 0
        ? Math.round((stageRows.reduce((acc, s) => acc + s.daysFromPreviousStage, 0) / samples) * 100) / 100
        : 0;
      return {
        stageKey: stage.key,
        stageLabel: stage.label,
        samples,
        avgFromRaised,
        avgFromPrevious,
      };
    });
  }, [progressDetails]);

  const trendRows = useMemo(() => {
    const monthBuckets: Record<string, { sum: number; count: number }> = {};
    progressDetails
      .filter(d => d.stageKey === trendStage)
      .forEach(item => {
        if (!monthBuckets[item.month]) monthBuckets[item.month] = { sum: 0, count: 0 };
        monthBuckets[item.month].sum += item.daysFromRaised;
        monthBuckets[item.month].count += 1;
      });
    return Object.entries(monthBuckets)
      .map(([month, agg]) => ({
        month,
        avgDays: Math.round((agg.sum / Math.max(agg.count, 1)) * 100) / 100,
        samples: agg.count,
      }))
      .sort((a, b) => monthSortKey(a.month) - monthSortKey(b.month));
  }, [progressDetails, trendStage]);

  const trendDetails = useMemo(() => {
    return progressDetails
      .filter(d => d.stageKey === trendStage)
      .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
      .slice(0, 12);
  }, [progressDetails, trendStage]);

  const anchorRows = useMemo(() => {
    return Object.entries(analytics.anchorMap)
      .sort(([, a], [, b]) => b - a)
      .map(([anchor, count]) => ({ anchor, count, pct: analytics.total > 0 ? Math.round((count / analytics.total) * 100) : 0 }));
  }, [analytics.anchorMap, analytics.total]);

  const exportSectionAsPng = async (sectionRef: React.RefObject<HTMLDivElement>, filePrefix: string) => {
    const target = sectionRef.current;
    if (!target) {
      message.error('Export section is not ready yet');
      return;
    }
    try {
      const canvas = await html2canvas(target, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${filePrefix}_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      message.success('PNG exported');
    } catch (e) {
      console.error('[ProcessInsightsPanel] Failed exporting section PNG', e);
      message.error('Failed to export PNG');
    }
  };

  const handleExportProgressDetails = () => exportSectionAsPng(progressAnalysisRef, 'Internal_Process_Progress_Analysis');
  const handleExportPipelineCoverage = () => exportSectionAsPng(pipelineCoverageRef, 'Internal_Process_Pipeline_Coverage');
  const handleExportAnchorDistribution = () => exportSectionAsPng(anchorDistributionRef, 'Internal_Process_Anchor_Distribution');
  const handleExportMonthlyTrend = () => exportSectionAsPng(monthlyTrendRef, 'Internal_Process_Monthly_Trend');
  const handleExportMonthlyBreakdown = () => exportSectionAsPng(monthlyBreakdownRef, 'Internal_Process_Monthly_Breakdown');

  const navigate = (filters: Record<string, any>) => {
    if (onNavigate) onNavigate(filters);
  };
  const navigateWithGlobal = (filters: Record<string, any> = {}) => {
    navigate({ ...globalDateFilters, ...filters });
  };

  if (rows.length === 0) {
    return (
      <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '12px' }}>No data yet — upload or add process records to see insights.</Text>} />
      </div>
    );
  }

  const kpi1 = [
    { label: 'Total Processes', value: analytics.total, color: '#1890ff', bg: '#e6f7ff', border: '#91d5ff', filters: {} },
    { label: 'Active', value: analytics.active, color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', filters: { active: 'Yes' } },
    { label: 'Inactive', value: analytics.inactive, color: '#fa8c16', bg: '#fff7e6', border: '#ffe7ba', filters: { active: 'No' } },
    { label: 'Completed', value: analytics.completed, color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', filters: { status: 'Completed' } },
  ];
  const kpi2 = [
    { label: 'In Progress', value: analytics.inProgress, color: '#1890ff', bg: '#f0f5ff', border: '#d6e4ff', filters: { status: 'In Progress' } },
    { label: 'Not Started', value: analytics.notStarted, color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9', filters: { status: 'Not Started' } },
    { label: 'With Account Anchor', value: analytics.withAnchor, color: '#722ed1', bg: '#f9f0ff', border: '#d3adf7', filters: { accountAnchorPresent: 'Yes' } },
    { label: 'Completion Rate', value: `${analytics.completionRate}%`, color: analytics.completionRate >= 50 ? '#52c41a' : '#faad14', bg: '#fafafa', border: '#f0f0f0', filters: {} },
  ];

  const pipelineItems = [
    { label: 'Signed SOW', count: analytics.withSignedSow, total: analytics.total, color: '#1890ff', filters: { status: 'In Progress' } },
    { label: 'PIW Created', count: analytics.withPiw, total: analytics.total, color: '#722ed1', filters: { status: 'In Progress' } },
    { label: 'Salesforce ID', count: analytics.withSalesforce, total: analytics.total, color: '#13c2c2', filters: { status: 'In Progress' } },
    { label: 'PROMS ID', count: analytics.withProms, total: analytics.total, color: '#52c41a', filters: { status: 'In Progress' } },
    { label: 'Budget Set', count: analytics.withBudget, total: analytics.total, color: '#fa8c16', filters: { status: 'In Progress' } },
    { label: 'Eprev Done', count: analytics.withEprev, total: analytics.total, color: '#a0d911', filters: { status: 'Completed' } },
    { label: 'Open Air Code', count: analytics.withOpenAir, total: analytics.total, color: '#eb2f96', filters: { status: 'Completed' } },
  ];

  return (
    <div style={{ padding: '4px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <DatePicker.RangePicker
          className="process-insights-date-range"
          size="small"
          value={dateRange}
          onChange={(v) => setDateRange(v as [Dayjs, Dayjs] | null)}
          placeholder={['Date Raised From', 'Date Raised To']}
          allowClear
          style={{ fontSize: 11 }}
        />
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {kpi1.map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <Card
              size="small"
              hoverable
              style={{ borderRadius: 10, cursor: 'pointer', background: k.bg, border: `1px solid ${k.border}`, transition: 'all 0.2s' }}
              onClick={() => navigateWithGlobal(k.filters)}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: k.color }}>{k.label}</Text>}
                value={k.value}
                valueStyle={{ color: k.color, fontSize: 24, lineHeight: 1.1 }}
                prefix={k.label === 'Completed' ? <CheckCircleOutlined style={{ color: k.color }} /> : (k.label === 'Inactive' ? <ClockCircleOutlined style={{ color: k.color }} /> : undefined)}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {kpi2.map(k => (
          <Col xs={12} sm={6} key={k.label}>
            <Card
              size="small"
              hoverable
              style={{ borderRadius: 10, cursor: 'pointer', background: k.bg, border: `1px solid ${k.border}`, transition: 'all 0.2s' }}
              onClick={() => navigateWithGlobal(k.filters)}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: k.color }}>{k.label}</Text>}
                value={k.value}
                valueStyle={{ color: k.color, fontSize: 24, lineHeight: 1.1 }}
                prefix={k.label === 'Completion Rate' ? <RiseOutlined style={{ color: k.color }} /> : undefined}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={12}>
          <div ref={pipelineCoverageRef}>
          <Card
            size="small"
            title={<span style={{ fontSize: 12, fontWeight: 700 }}><ClusterOutlined style={{ marginRight: 6 }} />Pipeline Coverage</span>}
            extra={<ExportIconButton onClick={handleExportPipelineCoverage} title="Export pipeline coverage" />}
            style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}
            bodyStyle={{ padding: '12px 14px' }}
          >
            {pipelineItems.map(item => {
              const pct = item.total > 0 ? Math.round((item.count / item.total) * 100) : 0;
              return (
                <div key={item.label} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11 }}>{item.label}</Text>
                    <Text style={{ fontSize: 11, fontWeight: 600, color: item.color }}>{item.count} / {item.total}</Text>
                  </div>
                  <Progress percent={pct} size="small" strokeColor={item.color} showInfo={false} />
                </div>
              );
            })}
          </Card>
          </div>
        </Col>

        <Col xs={24} md={12}>
          <div ref={anchorDistributionRef}>
          <Card
            size="small"
            title={<span style={{ fontSize: 12, fontWeight: 700 }}>👤 By Account Anchor</span>}
            extra={<ExportIconButton onClick={handleExportAnchorDistribution} title="Export account anchor distribution" />}
            style={{ borderRadius: 10, border: '1px solid #f0f0f0', height: '100%' }}
            bodyStyle={{ padding: '12px 14px', maxHeight: 250, overflowY: 'auto' }}
          >
            {anchorRows.map(({ anchor, count, pct }) => (
              <div
                key={anchor}
                style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, cursor: 'pointer' }}
                onClick={() => navigateWithGlobal(anchor === 'Unassigned' ? { accountAnchor: '__UNASSIGNED__' } : { accountAnchor: anchor })}
              >
                <Tag color={anchor === 'Unassigned' ? 'default' : 'purple'} style={{ fontSize: '10px', minWidth: 88, textAlign: 'center' }}>{anchor}</Tag>
                <div style={{ flex: 1 }}>
                  <Progress percent={pct} size="small" showInfo={false} strokeColor={anchor === 'Unassigned' ? '#d9d9d9' : '#722ed1'} />
                </div>
                <Text style={{ fontSize: 11, fontWeight: 600, width: 28, textAlign: 'right' }}>{count}</Text>
              </div>
            ))}
          </Card>
          </div>
        </Col>
      </Row>

      <div ref={monthlyTrendRef}>
      <Card
        size="small"
        title={<span style={{ fontSize: 12, fontWeight: 700 }}><CalendarOutlined style={{ marginRight: 6 }} />Monthly Trend — Opportunities by Status</span>}
        extra={<ExportIconButton onClick={handleExportMonthlyTrend} title="Export monthly trend" />}
        style={{ borderRadius: 10, border: '1px solid #f0f0f0', marginBottom: 16 }}
        bodyStyle={{ padding: '10px 14px' }}
      >
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={analytics.monthData} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
            <XAxis dataKey="month" tick={{ fontSize: 10 }} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
            <RechartTooltip contentStyle={{ fontSize: '11px', borderRadius: 6 }} />
            <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 6 }} />
            <Bar dataKey="notStarted" name="Not Started" stackId="a" fill="#8c8c8c" />
            <Bar dataKey="inProgress" name="In Progress" stackId="a" fill="#1890ff" />
            <Bar dataKey="completed" name="Completed" stackId="a" fill="#52c41a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      </div>

      <div ref={monthlyBreakdownRef}>
      <Card
        size="small"
        title={<span style={{ fontSize: 12, fontWeight: 700 }}>📊 Monthly Breakdown</span>}
        extra={<ExportIconButton onClick={handleExportMonthlyBreakdown} title="Export monthly breakdown" />}
        style={{ borderRadius: 10, border: '1px solid #f0f0f0' }}
        bodyStyle={{ padding: 0 }}
      >
        <Table
          size="small"
          dataSource={analytics.monthData}
          rowKey="month"
          bordered
          pagination={false}
          style={{ borderRadius: 8 }}
          columns={[
            { title: gridHeader('Month'), dataIndex: 'month', key: 'month', width: 100, render: (v: string) => <span style={{ fontSize: '11px', fontWeight: 600 }}>{v}</span> },
            { title: gridHeader('Total'), dataIndex: 'total', key: 'total', width: 60, render: (v: number) => <span style={{ fontSize: '11px', fontWeight: 700 }}>{v}</span> },
            { title: gridHeader('Not Started'), dataIndex: 'notStarted', key: 'ns', width: 90, render: (v: number) => v ? <Tag style={{ fontSize: '10px', background: '#8c8c8c18', color: '#8c8c8c', border: '1px solid #8c8c8c44' }}>{v}</Tag> : <span style={{ fontSize: '11px', color: '#d9d9d9' }}>—</span> },
            { title: gridHeader('In Progress'), dataIndex: 'inProgress', key: 'ip', width: 90, render: (v: number) => v ? <Tag style={{ fontSize: '10px', background: '#1890ff18', color: '#1890ff', border: '1px solid #1890ff44' }}>{v}</Tag> : <span style={{ fontSize: '11px', color: '#d9d9d9' }}>—</span> },
            { title: gridHeader('Completed'), dataIndex: 'completed', key: 'cp', width: 90, render: (v: number) => v ? <Tag style={{ fontSize: '10px', background: '#52c41a18', color: '#52c41a', border: '1px solid #52c41a44' }}>{v}</Tag> : <span style={{ fontSize: '11px', color: '#d9d9d9' }}>—</span> },
            {
              title: gridHeader('% Done'),
              key: 'pct',
              width: 80,
              render: (_: unknown, row: { total: number; completed: number }) => {
                const pct = row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0;
                return <Tag color={pct >= 100 ? 'success' : pct >= 50 ? 'processing' : 'default'} style={{ fontSize: '10px' }}>{pct}%</Tag>;
              },
            },
          ]}
        />
      </Card>
      </div>

      <div ref={progressAnalysisRef}>
      <Card
        size="small"
        title={<span style={{ fontSize: '12px', fontWeight: 700 }}>⏱ Process Progress Analysis</span>}
        style={{ borderRadius: 8, border: '1px solid #f0f0f0', marginTop: 16 }}
        extra={(
          <Space size={8} wrap style={{ fontSize: 11 }}>
            <Select
              size="small"
              value={trendStage}
              onChange={setTrendStage}
              style={{ width: 180, fontSize: 11 }}
              options={PROGRESS_STAGES.map(s => ({ label: s.label, value: s.key }))}
            />
            <ExportIconButton onClick={handleExportProgressDetails} title="Export process progress details" />
          </Space>
        )}
      >
        <Row gutter={[12, 12]}>
          <Col xs={24} md={12}>
            <Table
              size="small"
              rowKey="stageKey"
              bordered
              pagination={false}
              dataSource={stageAverages}
              columns={[
                { title: gridHeader('Stage'), dataIndex: 'stageLabel', key: 'stageLabel', render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text> },
                { title: gridHeader('Samples'), dataIndex: 'samples', key: 'samples', width: 80, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
                { title: gridHeader('Avg Days (from raised)'), dataIndex: 'avgFromRaised', key: 'avgFromRaised', width: 150, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
                { title: gridHeader('Avg Days (step-to-step)'), dataIndex: 'avgFromPrevious', key: 'avgFromPrevious', width: 150, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
              ]}
            />
          </Col>
          <Col xs={24} md={12}>
            <div style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 600 }}>{PROGRESS_STAGES.find(s => s.key === trendStage)?.label} trend by month</Text>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendRows} margin={{ top: 4, right: 12, left: 0, bottom: 4 }}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} width={24} />
                <RechartTooltip contentStyle={{ fontSize: '11px', borderRadius: 6 }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: 6 }} />
                <Bar
                  dataKey="avgDays"
                  name="Avg Days from Date Raised"
                  fill="#1890ff"
                />
              </BarChart>
            </ResponsiveContainer>
          </Col>
        </Row>
        {trendDetails.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <Table
              size="small"
              rowKey={(r) => `${r.processId}_${r.stageKey}_${r.completedAt}`}
              bordered
              pagination={{ pageSize: 6, size: 'small', showSizeChanger: false }}
              dataSource={trendDetails}
              onRow={(row) => ({
                onClick: () => {
                  const from = parseFlexibleDate(row.dateRaised);
                  navigateWithGlobal({
                    status: mapStageToProcessStatus(row.stageKey),
                    ...(from ? { startDateFrom: formatDateInput(from), startDateTo: formatDateInput(from) } : {}),
                  });
                },
                style: { cursor: 'pointer' },
              })}
              columns={[
                { title: gridHeader('Process'), dataIndex: 'processId', key: 'processId', width: 90, render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '—'}</Text> },
                { title: gridHeader('SOW'), dataIndex: 'sow', key: 'sow', ellipsis: true, render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '—'}</Text> },
                { title: gridHeader('Date Raised'), dataIndex: 'dateRaised', key: 'dateRaised', width: 110, render: (v: string) => <Text style={{ fontSize: 11 }}>{v || '—'}</Text> },
                { title: gridHeader('Completed on'), dataIndex: 'completedAt', key: 'completedAt', width: 130, render: (v: string) => <Text style={{ fontSize: 11 }}>{toUtcDisplay(v)}</Text> },
                { title: gridHeader('Days from Raised'), dataIndex: 'daysFromRaised', key: 'daysFromRaised', width: 120, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
                { title: gridHeader('Days from Previous'), dataIndex: 'daysFromPreviousStage', key: 'daysFromPreviousStage', width: 130, render: (v: number) => <Text style={{ fontSize: 11 }}>{v}</Text> },
              ]}
            />
          </div>
        )}
      </Card>
      </div>
    </div>
  );
}
