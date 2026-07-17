/**
 * ResourceOverviewCharts — reusable charts panel for "All Resources" overview.
 * Shared between ResourceInformation (Insights tab) and ResourceInsights (All Resources sub-tab).
 */
import React, { useMemo, useRef, useState } from 'react';
import { Row, Col, Button, Tooltip, Space, Typography } from 'antd';
import {
  PieChartOutlined, BarChartOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { exportChartAsPng } from '../utils/exportChartAsPng';
import { getCurrentDateStamp } from '../utils/styledExcelExport';
import type { ResourceRow } from '../types/resource';

const { Text } = Typography;

const CHART_COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#096dd9',
];
const CHART_TEXT_COLOR = '#262626';
const CHART_MUTED_TEXT_COLOR = '#666666';

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
  onFilterClick?: (type: 'piwRole' | 'roleOrDomain' | 'engagement' | 'allocationStatus' | 'skills' | 'expBucket', name: string) => void;
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
    resources.forEach(r => { const role = r.piwRole || 'Unassigned'; map[role] = (map[role] || 0) + 1; });
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
    const countByKey: Record<string, number> = {};
    const displayByKey: Record<string, string> = {};
    resources.forEach((r) => {
      const domains = (r.roleOrDomain || '').split(',').map((d) => d.trim()).filter(Boolean);
      if (!domains.length) {
        countByKey.unassigned = (countByKey.unassigned || 0) + 1;
        if (!displayByKey.unassigned) displayByKey.unassigned = 'Unassigned';
        return;
      }
      domains.forEach((domain) => {
        const key = domain.toLowerCase();
        countByKey[key] = (countByKey[key] || 0) + 1;
        if (!displayByKey[key]) displayByKey[key] = domain;
      });
    });
    return Object.entries(countByKey)
      .sort((a, b) => b[1] - a[1])
      .map(([key, value]) => ({ name: displayByKey[key] || key, value }));
  }, [resources]);

  const allocationStatusData = useMemo(() => {
    const map: Record<string, number> = {};
    resources.forEach(r => { const s = r.allocationStatus || 'Unknown'; map[s] = (map[s] || 0) + 1; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [resources]);

  const avgExp = useMemo(() => {
    if (!resources.length) return 0;
    return Math.round(resources.reduce((acc, r) => acc + parseExpYears(r.totalWorkex || ''), 0) / resources.length * 10) / 10;
  }, [resources]);

  const benchCount = useMemo(() => resources.filter(r => r.engagement === 'Bench').length, [resources]);

  const handleClick = (type: 'piwRole' | 'roleOrDomain' | 'engagement' | 'allocationStatus' | 'skills' | 'expBucket', name: string) => {
    onFilterClick?.(type, name);
  };

  const buildConicGradient = (data: { name: string; value: number }[]) => {
    const total = data.reduce((sum, item) => sum + item.value, 0);
    if (total <= 0) return '#f0f0f0';

    let current = 0;
    const stops = data.map((item, index) => {
      const start = current;
      current += (item.value / total) * 100;
      return `${CHART_COLORS[index % CHART_COLORS.length]} ${start}% ${current}%`;
    });
    return `conic-gradient(${stops.join(', ')})`;
  };

  const renderMiniPie = (data: { name: string; value: number }[], title: string, clickType: 'piwRole' | 'roleOrDomain' | 'engagement' | 'allocationStatus' | 'skills' | 'expBucket') => (
    <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0', color: CHART_TEXT_COLOR }}>
      <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 2 }}>{title}</Text>
      <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>
        {onFilterClick ? 'Click a segment to filter' : ''}
      </Text>
      {data.length === 0 ? <Text type="secondary" style={{ fontSize: '11px' }}>No data</Text> : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', minHeight: 180 }}>
          <div
            style={{
              width: 140,
              height: 140,
              minWidth: 140,
              borderRadius: '50%',
              background: buildConicGradient(data),
              position: 'relative',
              boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: 28,
                borderRadius: '50%',
                background: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                textAlign: 'center',
                padding: 8,
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 700, color: CHART_TEXT_COLOR }}>{data.reduce((sum, item) => sum + item.value, 0)}</div>
              <div style={{ fontSize: 10, color: CHART_MUTED_TEXT_COLOR }}>items</div>
            </div>
          </div>
          <Space direction="vertical" size={6} style={{ flex: 1, minWidth: 180 }}>
            {data.map((item, index) => (
              <div
                key={item.name}
                onClick={() => onFilterClick && handleClick(clickType, item.name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                  cursor: onFilterClick ? 'pointer' : 'default',
                  padding: '4px 6px',
                  borderRadius: 6,
                  background: '#ffffff',
                  border: '1px solid #f0f0f0',
                }}
                title={`${item.name}: ${item.value} (${resources.length ? Math.round(item.value / resources.length * 100) : 0}%)`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[index % CHART_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: CHART_TEXT_COLOR, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                </div>
                <span style={{ fontSize: 11, color: CHART_MUTED_TEXT_COLOR, flexShrink: 0 }}>{item.value}</span>
              </div>
            ))}
          </Space>
        </div>
      )}
    </div>
  );

  const renderHBar = (data: { name: string; value: number }[], title: string, clickType: 'piwRole' | 'roleOrDomain' | 'engagement' | 'allocationStatus' | 'skills' | 'expBucket', max?: number) => {
    const maxVal = max || Math.max(...data.map(d => d.value), 1);
    return (
      <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0', color: CHART_TEXT_COLOR }}>
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

  const renderSkillBars = (data: { name: string; value: number }[]) => {
    const maxVal = Math.max(...data.map(d => d.value), 1);
    return data.length === 0 ? <Text type="secondary" style={{ fontSize: '11px' }}>No data</Text> : (
      <Space direction="vertical" style={{ width: '100%' }} size={6}>
        {data.map((item, i) => (
          <div key={item.name} style={{ cursor: onFilterClick ? 'pointer' : 'default', borderRadius: 4, padding: '2px 4px', transition: 'background 0.15s' }}
            onClick={() => onFilterClick && handleClick('skills', item.name)}
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
    <div style={{ color: CHART_TEXT_COLOR }}>
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
                await exportChartAsPng(chartRef.current, `resource-overview-${getCurrentDateStamp()}.png`);
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
                <div style={{ fontSize: '10px', color: CHART_MUTED_TEXT_COLOR, marginTop: 2 }}>{kpi.title}</div>
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
              <Col xs={24} md={12}>{renderMiniPie(domainData.slice(0, 8), 'Resources by Roles/Domains', 'roleOrDomain')}</Col>
              <Col xs={24} md={12}>{renderMiniPie(allocationStatusData, 'Breakdown by Allocation Status', 'allocationStatus')}</Col>
            </Row>
            <div style={{ background: '#fafafa', borderRadius: 8, padding: '12px', border: '1px solid #f0f0f0', color: CHART_TEXT_COLOR }}>
              <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 2 }}>Top Skills (count across resources)</Text>
              <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginBottom: 8 }}>{onFilterClick ? 'Click a bar to filter' : ''}</Text>
              {renderSkillBars(skillData)}
            </div>
          </>
        ) : (
          <Row gutter={[12, 12]}>
            <Col xs={24} md={12}>{renderHBar(roleData, 'By PIW Role', 'piwRole')}</Col>
            <Col xs={24} md={12}>{renderHBar(expData, 'By Experience Range', 'expBucket')}</Col>
            <Col xs={24} md={12}>{renderHBar(domainData, 'By Roles/Domains', 'roleOrDomain')}</Col>
            <Col xs={24} md={12}>{renderHBar(allocationStatusData, 'By Allocation Status', 'allocationStatus')}</Col>
            <Col xs={24}>{renderHBar(skillData, 'Top Skills', 'skills')}</Col>
          </Row>
        )}
      </div>
    </div>
  );
}
