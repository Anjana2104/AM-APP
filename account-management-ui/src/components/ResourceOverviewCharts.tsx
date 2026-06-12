/**
 * ResourceOverviewCharts — reusable charts panel for "All Resources" overview.
 * Shared between ResourceInformation (Insights tab) and ResourceInsights (All Resources sub-tab).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Row, Col, Button, Tooltip, Space, Typography } from 'antd';
import {
  PieChartOutlined, BarChartOutlined, DownloadOutlined,
} from '@ant-design/icons';
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartTooltip,
} from 'recharts';
import html2canvas from 'html2canvas';
import type { ResourceRow } from '../types/resource';

const { Text } = Typography;

const CHART_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#096dd9',
];

const EXP_BUCKETS = [
  { label: '0–3 Yrs', min: 0, max: 3 },
  { label: '3–5 Yrs', min: 3, max: 5 },
  { label: '5–8 Yrs', min: 5, max: 8 },
  { label: '8–10 Yrs', min: 8, max: 10 },
  { label: '10+ Yrs', min: 10, max: Infinity },
];

interface Props {
  resources: ResourceRow[];
  /** Called when user clicks a chart segment/bar to filter. Only relevant in ResourceInformation. */
  onFilterClick?: (type: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket', name: string) => void;
}

function parseExpYears(workex: string): number {
  const n = parseFloat((workex || '0').replace(/[^0-9.]/g, ''));
  return isFinite(n) ? n : 0;
}

export default function ResourceOverviewCharts({ resources, onFilterClick }: Props) {
  const [insightView, setInsightView] = useState<'charts' | 'bars'>('charts');
  const [exporting, setExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const roleData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const role = r.piwRole || 'Unknown'; map[role] = (map[role] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const expData = useMemo(() => EXP_BUCKETS.map(bucket => ({
    name: bucket.label,
    value: resources.filter(r => {
      const yrs = parseExpYears(r.totalWorkex || '');
      return yrs >= bucket.min && yrs < bucket.max;
    }).length,
  })), [resources]);

  const skillData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => {
      (r.skills || '').split(',').forEach(s => {
        const sk = s.trim(); if (sk) map[sk] = (map[sk] || 0) + 1;
      });
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const domainData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const d = r.roleOrDomain || 'Unknown'; map[d] = (map[d] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const engagementData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const e = r.engagement || 'Unassigned'; map[e] = (map[e] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const avgExp = useMemo(() => {
    if (!resources.length) return 0;
    return Math.round(resources.reduce((acc, r) => acc + parseExpYears(r.totalWorkex || ''), 0) / resources.length * 10) / 10;
  }, [resources]);

  const benchCount = useMemo(() => resources.filter(r => r.engagement === 'Bench').length, [resources]);

  const handleClick = (type: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket', name: string) => {
    onFilterClick?.(type, name);
  };

  const renderMiniPie = (data: { name: string; value: number }[], title: string, clickType: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket') => (
    <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0' }}>
      <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 2 }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>
        {onFilterClick ? 'Click a segment to filter' : ''}
      </Text>
      {data.length === 0 ? <Text type="secondary" style={{ fontSize: '11px' }}>No data</Text> : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" paddingAngle={2}
              cursor={onFilterClick ? 'pointer' : 'default'}
              onClick={onFilterClick ? (entry) => handleClick(clickType, entry.name) : undefined}
            >
              {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Legend iconSize={8} wrapperStyle={{ fontSize: '10px' }} />
            <RechartTooltip formatter={(v: number, name: string) => [`${v} (${resources.length ? Math.round(v / resources.length * 100) : 0}%)`, name]} contentStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );

  const renderHBar = (data: { name: string; value: number }[], title: string, clickType: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket', max?: number) => {
    const maxVal = max || Math.max(...data.map(d => d.value), 1);
    return (
      <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0' }}>
        <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 2 }}>{title}</Text>
        <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>
          {onFilterClick ? 'Click a row to filter' : ''}
        </Text>
        {data.length === 0 ? <Text type="secondary" style={{ fontSize: '11px' }}>No data</Text> : (
          <Space direction="vertical" style={{ width: '100%' }} size={6}>
            {data.map((item, i) => (
              <div key={item.name} style={{ cursor: onFilterClick ? 'pointer' : 'default', borderRadius: 4, padding: '2px 4px', transition: 'background 0.15s' }}
                onClick={() => onFilterClick && handleClick(clickType, item.name)}
                onMouseEnter={e => { if (onFilterClick) e.currentTarget.style.background = '#e6f4ff'; }}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                  <Text style={{ fontSize: '11px', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</Text>
                  <Text style={{ fontSize: '11px', color: '#666' }}>{item.value} ({resources.length ? Math.round(item.value / resources.length * 100) : 0}%)</Text>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(item.value / maxVal) * 100}%`, background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 4, transition: 'width 0.5s' }} />
                </div>
              </div>
            ))}
          </Space>
        )}
      </div>
    );
  };

  if (resources.length === 0) {
    return (
      <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 60, textAlign: 'center' }}>
        <Text type="secondary">No resource data. Upload or add resources first.</Text>
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Space size={6}>
          <Tooltip title="Chart View" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<PieChartOutlined />} size="small" type={insightView === 'charts' ? 'primary' : 'default'} onClick={() => setInsightView('charts')} style={{ borderRadius: 6 }} />
          </Tooltip>
          <Tooltip title="Bar View" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button icon={<BarChartOutlined />} size="small" type={insightView === 'bars' ? 'primary' : 'default'} onClick={() => setInsightView('bars')} style={{ borderRadius: 6 }} />
          </Tooltip>
        </Space>
        <Tooltip title="Export as PNG" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button
            size="small" icon={<DownloadOutlined />} loading={exporting}
            onClick={async () => {
              if (!chartRef.current) return;
              setExporting(true);
              try {
                const canvas = await html2canvas(chartRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
                const link = document.createElement('a');
                link.download = `resource-overview-${new Date().toISOString().slice(0, 10)}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
              } finally { setExporting(false); }
            }}
            style={{ fontSize: '11px' }}
          />
        </Tooltip>
      </div>

      <div ref={chartRef}>
        {/* KPIs */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          {[
            { title: 'Total Resources', value: resources.length, color: '#1890ff', bg: '#e6f7ff' },
            { title: 'Avg Experience', value: `${avgExp} yrs`, color: '#52c41a', bg: '#f6ffed' },
            { title: 'On Bench', value: benchCount, color: '#faad14', bg: '#fffbe6', clickType: 'engagement' as const, clickVal: 'Bench' },
            { title: 'Unique Roles', value: roleData.length, color: '#722ed1', bg: '#f9f0ff' },
            { title: 'Unique Skills', value: skillData.length > 0 ? `${skillData.length}+` : 0, color: '#13c2c2', bg: '#e6fffb' },
            { title: 'Domains', value: domainData.length, color: '#eb2f96', bg: '#fff0f6' },
          ].map(kpi => (
            <Col key={kpi.title} xs={12} sm={8} md={4}>
              <div
                style={{ background: kpi.bg, border: `1px solid ${kpi.color}22`, borderRadius: 8, padding: '10px 12px', textAlign: 'center', cursor: ('clickType' in kpi && onFilterClick) ? 'pointer' : 'default' }}
                onClick={() => { if ('clickType' in kpi && kpi.clickType && kpi.clickVal && onFilterClick) handleClick(kpi.clickType, kpi.clickVal); }}
              >
                <div style={{ fontSize: '20px', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                <div style={{ fontSize: '10px', color: '#666', marginTop: 2 }}>{kpi.title}</div>
              </div>
            </Col>
          ))}
        </Row>

        {insightView === 'charts' ? (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} md={12}>{renderMiniPie(roleData.slice(0, 8), 'Resources by PIW Role', 'piwRole')}</Col>
              <Col xs={24} md={12}>{renderMiniPie(expData, 'Resources by Experience Range', 'expBucket')}</Col>
            </Row>
            <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
              <Col xs={24} md={12}>{renderMiniPie(domainData.slice(0, 8), 'Resources by Role/Domain', 'roleOrDomain')}</Col>
              <Col xs={24} md={12}>{renderMiniPie(engagementData, 'Resources by Engagement', 'engagement')}</Col>
            </Row>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 2 }}>Top Skills (count across resources)</Text>
              <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>{onFilterClick ? 'Click a bar to filter' : ''}</Text>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={skillData} layout="vertical" margin={{ left: 10, right: 20, top: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <RechartTooltip contentStyle={{ fontSize: '11px' }} formatter={(v) => [v, 'Count']} />
                  <Bar dataKey="value" fill="#1890ff" radius={[0, 4, 4, 0]} cursor={onFilterClick ? 'pointer' : 'default'}
                    onClick={onFilterClick ? (data: { name: string }) => handleClick('skills', data.name) : undefined}
                  >
                    {skillData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>{renderHBar(roleData, 'By PIW Role', 'piwRole')}</Col>
            <Col xs={24} md={12}>{renderHBar(expData, 'By Experience Range', 'expBucket')}</Col>
            <Col xs={24} md={12}>{renderHBar(domainData, 'By Role/Domain', 'roleOrDomain')}</Col>
            <Col xs={24} md={12}>{renderHBar(engagementData, 'By Engagement', 'engagement')}</Col>
            <Col xs={24}>{renderHBar(skillData, 'Top Skills', 'skills')}</Col>
          </Row>
        )}
      </div>
    </div>
  );
}
