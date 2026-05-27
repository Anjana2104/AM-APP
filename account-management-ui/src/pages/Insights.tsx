import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Progress, Statistic, Space, Empty, Segmented, InputNumber, Tooltip } from 'antd';
import { ArrowUpOutlined, DollarOutlined } from '@ant-design/icons';
import type { Row as ProjectRow } from './ProjectList';

interface InsightsProps {
  data: ProjectRow[];
  monthHeaders: string[];
}

const inr = (n: number) =>
  n ? `₹ ${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—';

const usd = (n: number) =>
  n ? `$ ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';

export function Insights({ data, monthHeaders }: InsightsProps) {
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const [exchangeRate, setExchangeRate] = useState<number>(0.013);

  const availableFiscalYears = useMemo(() => {
    // Calculate available fiscal years based on month headers
    // Each FY has 12 months, starting from Oct
    // FY26 = Oct'25 - Sep'26, FY27 = Oct'26 - Sep'27, etc
    const years = [];
    const monthCount = monthHeaders.length || 0;
    
    for (let i = 0; i < monthCount; i += 12) {
      const fyYear = 2026 + Math.floor(i / 12);
      years.push(`FY${fyYear}`);
    }
    
    return years.length > 0 ? years : ['FY26'];
  }, [monthHeaders]);

  const [fiscalYear, setFiscalYear] = useState<string>(availableFiscalYears[0]);

  const formatCurrency = (value: number): string => {
    if (currency === 'USD') {
      return usd(value * exchangeRate);
    }
    return inr(value);
  };

  const getCurrencyLabel = (): string => {
    return currency === 'USD' ? `USD (Rate: 1 INR = $${exchangeRate})` : 'INR (₹)';
  };

  const quarterlyData = useMemo(() => {
    // Get the fiscal year index (0 = FY25, 1 = FY26, etc)
    const fyIndex = availableFiscalYears.indexOf(fiscalYear);
    const startMonth = fyIndex * 12;
    const endMonth = startMonth + 11;

    // Check if we have enough months
    if (startMonth >= data[0]?.revenue.length) {
      return {
        q1: { total: 0, percentage: 0, label: 'Q1' },
        q2: { total: 0, percentage: 0, label: 'Q2' },
        q3: { total: 0, percentage: 0, label: 'Q3' },
        q4: { total: 0, percentage: 0, label: 'Q4' },
        grand: 0,
      };
    }

    const Q1 = [startMonth, startMonth + 1, startMonth + 2];
    const Q2 = [startMonth + 3, startMonth + 4, startMonth + 5];
    const Q3 = [startMonth + 6, startMonth + 7, startMonth + 8];
    const Q4 = [startMonth + 9, startMonth + 10, startMonth + 11];

    const calculateQuarterTotal = (quarterMonths: number[]) => {
      return data.reduce((total, row) => {
        const quarterRevenue = quarterMonths.reduce((sum, monthIdx) => {
          return sum + (row.revenue[monthIdx] || 0);
        }, 0);
        return total + quarterRevenue;
      }, 0);
    };

    const q1Total = calculateQuarterTotal(Q1);
    const q2Total = calculateQuarterTotal(Q2);
    const q3Total = calculateQuarterTotal(Q3);
    const q4Total = calculateQuarterTotal(Q4);

    const grandTotal = q1Total + q2Total + q3Total + q4Total;

    const months = monthHeaders.slice(startMonth, endMonth + 1);
    const getMonthRange = (q: number[]): string => {
      if (q.length < 3 || q[0] >= monthHeaders.length) return '';
      return `${monthHeaders[q[0]]}–${monthHeaders[q[2]]}`;
    };

    return {
      q1: { total: q1Total, percentage: grandTotal ? Math.round((q1Total / grandTotal) * 100) : 0, label: `Q1 (${getMonthRange(Q1)})` },
      q2: { total: q2Total, percentage: grandTotal ? Math.round((q2Total / grandTotal) * 100) : 0, label: `Q2 (${getMonthRange(Q2)})` },
      q3: { total: q3Total, percentage: grandTotal ? Math.round((q3Total / grandTotal) * 100) : 0, label: `Q3 (${getMonthRange(Q3)})` },
      q4: { total: q4Total, percentage: grandTotal ? Math.round((q4Total / grandTotal) * 100) : 0, label: `Q4 (${getMonthRange(Q4)})` },
      grand: grandTotal,
    };
  }, [data, monthHeaders, fiscalYear, availableFiscalYears]);

  const yearWiseComparison = useMemo(() => {
    if (availableFiscalYears.length < 2) {
      return { fy1: { total: 0, label: '' }, fy2: { total: 0, label: '' }, comparison: 0 };
    }

    const calculateFYTotal = (fyIndex: number) => {
      const startIdx = fyIndex * 12;
      const endIdx = startIdx + 11;
      return data.reduce((total, row) => {
        let fyTotal = 0;
        for (let i = startIdx; i <= endIdx && i < row.revenue.length; i++) {
          fyTotal += row.revenue[i] || 0;
        }
        return total + fyTotal;
      }, 0);
    };

    const fy1Total = calculateFYTotal(0);
    const fy2Total = calculateFYTotal(1);

    return {
      fy1: { total: fy1Total, label: availableFiscalYears[0] },
      fy2: { total: fy2Total, label: availableFiscalYears[1] || availableFiscalYears[0] },
      comparison: fy1Total > 0 ? Math.round(((fy2Total - fy1Total) / fy1Total) * 100) : 0,
    };
  }, [data, availableFiscalYears]);

  if (!data || data.length === 0) {
    return <Empty description="Upload data to view insights" style={{ marginTop: 48 }} />;
  }

  const quarterlyColor = (value: number) => {
    if (value >= 30) return '#52C41A';
    if (value >= 20) return '#FFA940';
    return '#FF7875';
  };

  const QuarterCard = ({ quarter, months, data }: { quarter: string; months: string; data: { total: number; percentage: number } }) => (
    <Card
      style={{
        border: 'none',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        borderRadius: '8px',
        overflow: 'hidden',
        transition: 'transform 0.3s ease',
      }}
      hoverable
      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '16px', fontWeight: 600, color: '#001529', marginBottom: 4 }}>
          {quarter}
        </div>
        <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
          {months}
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: '28px', fontWeight: 700, color: quarterlyColor(data.percentage), marginBottom: 8 }}>
          {formatCurrency(data.total)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#001529' }}>
            {data.percentage}% of Annual Revenue
          </div>
        </div>
      </div>

      <Progress
        percent={data.percentage}
        strokeColor={quarterlyColor(data.percentage)}
        format={() => ''}
        size="small"
      />
    </Card>
  );

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#001529', marginBottom: 8 }}>
            Revenue Insights – {fiscalYear}
          </h2>
          <p style={{ fontSize: '14px', color: '#8c8c8c', margin: 0 }}>
            {fiscalYear === 'FY25' ? 'Oct\'25 - Sep\'26' : 'Oct\'26 - Sep\'27'} | Quarterly performance breakdown
          </p>
        </div>
        <Card style={{ border: 'none', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)', borderRadius: '8px' }}>
          <Space direction="vertical" size="small">
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529' }}>Fiscal Year</div>
            <Segmented
              value={fiscalYear}
              onChange={(value) => setFiscalYear(value as string)}
              options={availableFiscalYears}
              style={{ width: '100%' }}
            />
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529', marginTop: 8 }}>Currency</div>
            <Segmented
              value={currency}
              onChange={(value) => setCurrency(value as 'INR' | 'USD')}
              options={['INR', 'USD']}
              style={{ width: '100%' }}
            />
            {currency === 'USD' && (
              <Tooltip title="Exchange rate for INR to USD conversion">
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529', marginTop: 8 }}>
                  Exchange Rate
                </div>
                <InputNumber
                  value={exchangeRate}
                  onChange={(value) => setExchangeRate(value || 0.013)}
                  step={0.001}
                  precision={4}
                  style={{ width: '100%', marginTop: 4 }}
                  prefix="1 INR = $"
                />
              </Tooltip>
            )}
          </Space>
        </Card>
      </div>

      <Card
        style={{
          background: 'linear-gradient(135deg, #001529 0%, #002A4D 100%)',
          border: 'none',
          borderRadius: '8px',
          color: '#fff',
        }}
      >
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>Annual Revenue ({currency})</span>}
              value={quarterlyData.grand}
              formatter={(value) => {
                const num = value as number;
                return currency === 'USD'
                  ? `$ ${(num * exchangeRate).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
                  : `₹ ${num.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
              }}
              valueStyle={{ color: '#FFA940', fontSize: '32px', fontWeight: 700 }}
            />
          </Col>
          <Col xs={24} sm={12}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>Total Projects</span>}
              value={data.length}
              suffix="Projects"
              valueStyle={{ color: '#fff', fontSize: '32px', fontWeight: 700 }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} md={6}>
          <QuarterCard
            quarter="Q1"
            months="Oct'25 – Dec'25"
            data={quarterlyData.q1}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <QuarterCard
            quarter="Q2"
            months="Jan'26 – Mar'26"
            data={quarterlyData.q2}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <QuarterCard
            quarter="Q3"
            months="Apr'26 – Jun'26"
            data={quarterlyData.q3}
          />
        </Col>
        <Col xs={24} sm={12} md={6}>
          <QuarterCard
            quarter="Q4"
            months="Jul'26 – Sep'26"
            data={quarterlyData.q4}
          />
        </Col>
      </Row>

      <Card
        style={{
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          borderRadius: '8px',
        }}
      >
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: 16, color: '#001529' }}>
          Quarterly Comparison
        </h3>
        <Row gutter={[24, 24]}>
          {[
            { label: 'Q1', subLabel: 'Oct\'25–Dec\'25', value: quarterlyData.q1, color: '#1890FF' },
            { label: 'Q2', subLabel: 'Jan\'26–Mar\'26', value: quarterlyData.q2, color: '#52C41A' },
            { label: 'Q3', subLabel: 'Apr\'26–Jun\'26', value: quarterlyData.q3, color: '#FFA940' },
            { label: 'Q4', subLabel: 'Jul\'26–Sep\'26', value: quarterlyData.q4, color: '#FF7875' },
          ].map(({ label, subLabel, value, color }) => (
            <Col key={label} xs={24} sm={12} md={6}>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: '120px',
                    height: '120px',
                    borderRadius: '50%',
                    background: color,
                    margin: '0 auto 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: '18px',
                    fontWeight: 700,
                  }}
                >
                  {value.percentage}%
                </div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#001529', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
                  {subLabel}
                </div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                  {formatCurrency(value.total)}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        style={{
          border: 'none',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
          borderRadius: '8px',
          background: 'linear-gradient(135deg, rgba(24,144,255,0.05) 0%, rgba(52,211,153,0.05) 100%)',
        }}
      >
        <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: 20, color: '#001529' }}>
          Year-over-Year Comparison
        </h3>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12}>
            <div style={{ padding: 16, background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529', background: '#F0F2F5', padding: '6px 8px', borderRadius: '4px', marginBottom: 12 }}>
                {yearWiseComparison.fy1.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#1890FF', marginBottom: 8 }}>
                {formatCurrency(yearWiseComparison.fy1.total)}
              </div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                Total Revenue
              </div>
            </div>
          </Col>
          <Col xs={24} sm={12}>
            <div style={{ padding: 16, background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#001529', background: '#F0F2F5', padding: '6px 8px', borderRadius: '4px', marginBottom: 12 }}>
                {yearWiseComparison.fy2.label}
              </div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#52C41A', marginBottom: 8 }}>
                {formatCurrency(yearWiseComparison.fy2.total)}
              </div>
              <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                Total Revenue
              </div>
            </div>
          </Col>
          <Col xs={24}>
            <div style={{ padding: 16, background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)' }}>
              <div style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 8 }}>Year-over-Year Growth</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ fontSize: '32px', fontWeight: 700, color: yearWiseComparison.comparison >= 0 ? '#52C41A' : '#FF7875' }}>
                  {yearWiseComparison.comparison >= 0 ? '+' : ''}{yearWiseComparison.comparison}%
                </div>
                <div style={{ fontSize: '14px', color: '#8c8c8c' }}>
                  {yearWiseComparison.comparison >= 0 
                    ? 'Growth from FY25 to FY26' 
                    : 'Decline from FY25 to FY26'}
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </Space>
  );
}
