import React from 'react';
import { Card, Col, Progress, Row, Tooltip } from 'antd';
import type { ProjectInsightsSummary, YearOverYearInsights } from './financeInsightsTypes';
import { RevenueHeatmap, type RevenueHeatmapDatum } from './RevenueHeatmap';

type ProjectMonthlyDatum = RevenueHeatmapDatum;

interface FinanceProjectInsightsTabProps {
  currency: 'INR' | 'USD';
  fiscalYear: string;
  filteredProjectCount: number;
  revenueType: 'all' | 'booked' | 'anticipated';
  qData: ProjectInsightsSummary;
  monthlyData: ProjectMonthlyDatum[];
  yoyData: YearOverYearInsights | null;
  fmt: (n: number) => string;
}

const quarterColors = ['#1890FF', '#52C41A', '#FFA940', '#FF7875'];
const qPctColor = (p: number) => (p >= 30 ? '#52C41A' : p >= 20 ? '#FFA940' : '#FF7875');

export function FinanceProjectInsightsTab({
  currency,
  fiscalYear,
  filteredProjectCount,
  revenueType,
  qData,
  monthlyData,
  yoyData,
  fmt,
}: FinanceProjectInsightsTabProps) {
  return (
    <>
      <div style={{ background: 'linear-gradient(135deg, #001529 0%, #002A4D 100%)', borderRadius: 8, padding: '16px 20px', color: '#fff', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Annual Revenue ({currency})</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#FFA940', marginTop: 4 }}>{fmt(qData.grand)}</div>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Total Projects</div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: 4 }}>{filteredProjectCount}</div>
          </div>
        </div>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
        {qData.quarters.map((q, i) => (
          <Col key={q.label} xs={24} sm={12} md={6}>
            <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }} hoverable>
              <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 2 }}>{q.label}</div>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>{q.months}</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: qPctColor(q.pct), marginBottom: 4 }}>{fmt(q.total)}</div>
              <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: 6 }}>{q.pct}% of annual</div>
              <Progress percent={q.pct} strokeColor={quarterColors[i]} format={() => ''} size="small" />
            </Card>
          </Col>
        ))}
      </Row>

      <RevenueHeatmap
        fiscalYear={fiscalYear}
        revenueType={revenueType}
        monthlyData={monthlyData}
        fmt={fmt}
        quarterColors={quarterColors}
      />

      {yoyData && (
        <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: 16 }}>Year-over-Year Comparison</h3>
          <Row gutter={[16, 16]}>
            {[
              { label: yoyData.labels[0], value: yoyData.fy1, color: '#1890FF' },
              { label: yoyData.labels[1], value: yoyData.fy2, color: '#52C41A' },
            ].map(({ label, value, color }) => (
              <Col key={label} xs={24} sm={12}>
                <div style={{ padding: 12, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#8c8c8c', marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color, marginBottom: 2 }}>{fmt(value)}</div>
                  <div style={{ fontSize: '11px', color: '#bfbfbf' }}>Total Revenue</div>
                </div>
              </Col>
            ))}
            <Col xs={24}>
              <div style={{ padding: '10px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '22px', fontWeight: 700, color: yoyData.pct >= 0 ? '#52C41A' : '#FF7875' }}>
                  {yoyData.pct >= 0 ? '+' : ''}
                  {yoyData.pct}%
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  {yoyData.pct >= 0 ? 'Growth' : 'Decline'} from {yoyData.labels[0]} to {yoyData.labels[1]}
                </div>
              </div>
            </Col>
          </Row>
        </Card>
      )}
    </>
  );
}

export default FinanceProjectInsightsTab;
