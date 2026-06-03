import React, { useMemo } from 'react';
import { Card, Row, Col, Statistic, Space, Empty } from 'antd';
import { DollarOutlined, ArrowUpOutlined } from '@ant-design/icons';
import type { Row as ProjectRow } from './FinanceProjectTable';

interface FinanceInsightsChartProps {
  data: ProjectRow[];
  monthHeaders: string[];
}

export function FinanceInsightsChart({ data, monthHeaders }: FinanceInsightsChartProps) {
  const totals = useMemo(() => {
    const map: Record<string, number> = {};
    monthHeaders.forEach(m => {
      map[m] = data.reduce((sum, r) => sum + (parseFloat(String(r[m])) || 0), 0);
    });
    return map;
  }, [data, monthHeaders]);

  const grandTotal = Object.values(totals).reduce((a, b) => a + b, 0);
  const activeProjects = data.filter(r => (r.status || '').toLowerCase() !== 'closed').length;

  if (!data.length) {
    return <Empty description="No finance data – upload an Excel file in the Project Milestones tab" style={{ margin: '40px 0' }} />;
  }

  return (
    <Space direction="vertical" size={16} style={{ width: '100%', padding: '8px 0' }}>
      {/* Summary cards */}
      <Row gutter={16}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title="Grand Total Revenue" value={grandTotal} precision={2} prefix={<DollarOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title="Active Projects" value={activeProjects} prefix={<ArrowUpOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title="Total Projects" value={data.length} />
          </Card>
        </Col>
      </Row>

      {/* Monthly totals table */}
      {monthHeaders.length > 0 && (
        <Card size="small" title="Monthly Revenue Totals" style={{ borderRadius: 8 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f0f5ff' }}>
                  {monthHeaders.map(m => (
                    <th key={m} style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #d6e4ff', color: '#1d39c4', whiteSpace: 'nowrap' }}>{m}</th>
                  ))}
                  <th style={{ padding: '6px 10px', textAlign: 'right', borderBottom: '1px solid #d6e4ff', color: '#0050b3', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  {monthHeaders.map(m => (
                    <td key={m} style={{ padding: '6px 10px', textAlign: 'right', color: '#555' }}>
                      {totals[m]?.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) ?? '–'}
                    </td>
                  ))}
                  <td style={{ padding: '6px 10px', textAlign: 'right', fontWeight: 700, color: '#1890ff' }}>
                    {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Space>
  );
}
