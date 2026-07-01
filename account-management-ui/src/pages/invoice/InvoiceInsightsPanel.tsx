import React, { useMemo, useRef, useState } from 'react';
import { Button, Card, Col, Empty, InputNumber, Progress, Row, Select, Space, Tooltip, Typography, message } from 'antd';
import { DollarOutlined, DownloadOutlined } from '@ant-design/icons';
import { exportChartAsPng } from '../../utils/exportChartAsPng';
import { getCurrentDateStamp } from '../../utils/styledExcelExport';
import type { InvRow } from './invoiceTypes';
import { MONTH_ORDER, fyMonthLabel, getMonthFY, inr, usd } from './invoiceUtils';

const { Text } = Typography;

export interface InvoiceInsightsPanelProps {
  data: InvRow[];
  monthHeaders: string[];
}

export function InvoiceInsightsPanel({ data, monthHeaders }: InvoiceInsightsPanelProps) {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);
  const [exporting, setExporting] = useState(false);
  const insightsRef = useRef<HTMLDivElement>(null);

  const availableFYs = useMemo(() => {
    const fySet = new Set<number>();
    monthHeaders.forEach(m => {
      const info = getMonthFY(m);
      if (info) fySet.add(info.fy);
    });
    const sorted = Array.from(fySet).sort();
    return sorted.length ? sorted.map(fy => `FY${fy}`) : ['FY2026'];
  }, [monthHeaders]);

  const [fiscalYear, setFiscalYear] = useState<string>(availableFYs[0]);

  const fmt = (n: number) =>
    currency === 'USD' ? usd(n * exchangeRate) : inr(n);

  const qData = useMemo(() => {
    const fyNum = parseInt(fiscalYear.replace('FY', ''));
    const quarters = [0, 1, 2, 3].map(q => {
      const positions = [q * 3, q * 3 + 1, q * 3 + 2];
      const mLabels = positions.map(pos => fyMonthLabel(fyNum, pos));
      const total = data.reduce((t, r) =>
        t + mLabels.reduce((s, lbl) => {
          const idx = monthHeaders.indexOf(lbl);
          return s + (idx !== -1 ? (r.revenue[idx] || 0) : 0);
        }, 0), 0);
      return { total, label: `Q${q + 1}`, months: `${mLabels[0]}–${mLabels[2]}` };
    });
    const grand = quarters.reduce((a, b) => a + b.total, 0);
    return {
      quarters: quarters.map(q => ({ ...q, pct: grand ? Math.round((q.total / grand) * 100) : 0 })),
      grand,
    };
  }, [data, monthHeaders, fiscalYear]);

  const monthlyData = useMemo(() => {
    const fyNum = parseInt(fiscalYear.replace('FY', ''));
    const months: { label: string; total: number; pct: number }[] = [];
    for (let pos = 0; pos < 12; pos++) {
      const lbl = fyMonthLabel(fyNum, pos);
      const idx = monthHeaders.indexOf(lbl);
      const total = idx !== -1 ? data.reduce((t, r) => t + (r.revenue[idx] || 0), 0) : 0;
      months.push({ label: lbl, total, pct: 0 });
    }
    const max = Math.max(...months.map(m => m.total), 1);
    return months.map(m => ({ ...m, pct: Math.round((m.total / max) * 100) }));
  }, [data, monthHeaders, fiscalYear]);

  const yoyData = useMemo(() => {
    if (availableFYs.length < 2) return null;
    const calc = (fyLabel: string) => {
      const fyNum = parseInt(fyLabel.replace('FY', ''));
      return data.reduce((t, r) =>
        t + MONTH_ORDER.reduce((s, _, pos) => {
          const idx = monthHeaders.indexOf(fyMonthLabel(fyNum, pos));
          return s + (idx !== -1 ? (r.revenue[idx] || 0) : 0);
        }, 0), 0);
    };
    const fy1 = calc(availableFYs[0]), fy2 = calc(availableFYs[1]);
    return { fy1, fy2, pct: fy1 ? Math.round(((fy2 - fy1) / fy1) * 100) : 0, labels: [availableFYs[0], availableFYs[1]] };
  }, [data, availableFYs, monthHeaders]);

  const qColors = ['#1890FF', '#52C41A', '#FFA940', '#FF7875'];
  const qPctColor = (p: number) => p >= 30 ? '#52C41A' : p >= 20 ? '#FFA940' : '#FF7875';

  const handleExportPNG = async () => {
    if (!insightsRef.current) return;
    setExporting(true);
    try {
      await exportChartAsPng(insightsRef.current, `Invoice_Insights_${fiscalYear}_${getCurrentDateStamp()}.png`, '#f5f7fa');
    } catch {
      message.error('Failed to export PNG');
    } finally {
      setExporting(false);
    }
  };

  if (!data || !data.length) return <Empty description="Upload data to view insights" style={{ marginTop: 48 }} />;

  return (
    <div style={{ width: '100%', position: 'relative' }}>
      <div ref={insightsRef} style={{ padding: '4px 0 8px' }}>
        {/* Filter bar: USD left, spacer, FY + download right */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
          {/* Currency – leftmost */}
          <Space size={6}>
            <Tooltip title={currency === 'INR' ? 'Switch to USD' : 'Switch to INR'} overlayInnerStyle={{ fontSize: '11px' }}>
              <Button size="small" icon={<DollarOutlined />}
                type={currency === 'USD' ? 'primary' : 'default'}
                onClick={() => setCurrency(c => c === 'INR' ? 'USD' : 'INR')}
                style={{ fontSize: '11px' }}>
                {currency}
              </Button>
            </Tooltip>
            {currency === 'USD' && (
              <Tooltip title="Exchange rate (INR → USD)" overlayInnerStyle={{ fontSize: '11px' }}>
                <InputNumber size="small" value={exchangeRate}
                  onChange={v => setExchangeRate(v || 0.013)}
                  step={0.001} precision={4} min={0.0001}
                  style={{ width: 80, fontSize: '11px' }} prefix="×" />
              </Tooltip>
            )}
          </Space>

          {/* Spacer pushes filters + download to right */}
          <div style={{ flex: 1 }} />

          {/* FY filter – right side */}
          {availableFYs.length > 0 && (
            <Space size={4}>
              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>FY:</Text>
              <Select size="small" value={fiscalYear}
                onChange={v => setFiscalYear(v as string)}
                options={availableFYs.map(fy => ({ label: fy, value: fy }))}
                style={{ minWidth: 90, fontSize: '11px' }} />
            </Space>
          )}

          {/* Download icon – aligned with filter row */}
          <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button size="small" type="text"
              icon={<DownloadOutlined style={{ fontSize: 15, color: '#8c8c8c' }} />}
              loading={exporting} onClick={handleExportPNG}
              style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 0 }} />
          </Tooltip>
        </div>

        {/* Summary bar */}
        <div style={{ background: 'linear-gradient(135deg, #001529 0%, #002A4D 100%)', borderRadius: 8, padding: '16px 20px', color: '#fff', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Annual Invoice Amount ({currency})</div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#FFA940', marginTop: 4 }}>{fmt(qData.grand)}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)' }}>Total Projects</div>
              <div style={{ fontSize: '22px', fontWeight: 700, marginTop: 4 }}>{data.length}</div>
            </div>
          </div>
        </div>

        {/* Quarterly KPI cards */}
        <Row gutter={[12, 12]} style={{ marginBottom: 20 }}>
          {qData.quarters.map((q, i) => (
            <Col key={q.label} xs={24} sm={12} md={6}>
              <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8 }} hoverable>
                <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: 2 }}>{q.label}</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>{q.months}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: qPctColor(q.pct), marginBottom: 4 }}>{fmt(q.total)}</div>
                <div style={{ fontSize: '11px', fontWeight: 600, marginBottom: 6 }}>{q.pct}% of annual</div>
                <Progress percent={q.pct} strokeColor={qColors[i]} format={() => ''} size="small" />
              </Card>
            </Col>
          ))}
        </Row>

        {/* Monthly breakdown bar chart */}
        <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8, marginBottom: 16 }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 16px' }}>Monthly Breakdown – {fiscalYear}</h3>
          <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 140, width: '100%' }}>
            {monthlyData.map((m, i) => {
              const qIdx = Math.floor(i / 3);
              const barColor = qColors[qIdx];
              return (
                <div key={m.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <Tooltip title={fmt(m.total)} overlayInnerStyle={{ fontSize: '11px' }}>
                    <div style={{ width: '60%', height: 100, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${Math.max(m.pct, 3)}%`,
                        background: barColor,
                        borderRadius: '3px 3px 0 0',
                        transition: 'height 0.3s ease',
                        cursor: 'default',
                      }} />
                    </div>
                  </Tooltip>
                  <div style={{ fontSize: '9px', color: '#8c8c8c', whiteSpace: 'nowrap', transform: 'rotate(-40deg)', transformOrigin: 'top center', marginTop: 6, lineHeight: 1 }}>
                    {m.label}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginTop: 30, flexWrap: 'wrap' }}>
            {['Q1 (Oct–Dec)', 'Q2 (Jan–Mar)', 'Q3 (Apr–Jun)', 'Q4 (Jul–Sep)'].map((q, i) => (
              <span key={q} style={{ fontSize: '11px', color: '#595959', display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: qColors[i] }} />
                {q}
              </span>
            ))}
          </div>
        </Card>

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
                    <div style={{ fontSize: '11px', color: '#bfbfbf' }}>Total Invoice Amount</div>
                  </div>
                </Col>
              ))}
              <Col xs={24}>
                <div style={{ padding: '10px 12px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: '22px', fontWeight: 700, color: yoyData.pct >= 0 ? '#52C41A' : '#FF7875' }}>
                    {yoyData.pct >= 0 ? '+' : ''}{yoyData.pct}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                    {yoyData.pct >= 0 ? 'Growth' : 'Decline'} from {yoyData.labels[0]} to {yoyData.labels[1]}
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        )}
      </div>
    </div>
  );
}
