import React, { useMemo, useRef, useState } from 'react';
import { Card, Row, Col, Statistic, Empty, Tag, Button, Tooltip, message } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined } from '@ant-design/icons';
import html2canvas from 'html2canvas';
import dayjs from 'dayjs';

interface ClientRequest {
  sno: string;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
}

interface RequestInsightsChartProps {
  requests: ClientRequest[];
}

export function RequestInsightsChart({ requests }: RequestInsightsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#fff', scale: 2, useCORS: true });
      const a = document.createElement('a');
      a.href = canvas.toDataURL('image/png');
      a.download = `Request_Insights_${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
    } catch {
      message.error('Export failed');
    } finally {
      setExporting(false);
    }
  };

  const stats = useMemo(() => {
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    requests.forEach(r => {
      const s = r.overallStatus || 'Unknown';
      byStatus[s] = (byStatus[s] || 0) + 1;
      const t = r.requestType || 'unspecified';
      byType[t] = (byType[t] || 0) + 1;
      if (r.dateRaised) {
        const m = dayjs(r.dateRaised).format('MMM YYYY');
        if (m !== 'Invalid Date') byMonth[m] = (byMonth[m] || 0) + 1;
      }
    });
    return { byStatus, byType, byMonth };
  }, [requests]);

  if (!requests.length) {
    return <Empty description="No requests yet" style={{ margin: '40px 0' }} />;
  }

  const TYPE_COLORS: Record<string, string> = { resource_demand: 'blue', onboarding: 'green', offboarding: 'red' };
  const TYPE_LABELS: Record<string, string> = { resource_demand: 'Resource Demand', onboarding: 'Onboarding', offboarding: 'Offboarding' };

  return (
    <div style={{ position: 'relative' }}>
      {/* Export icon */}
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 10 }}>
        <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button size="small" type="text" icon={<DownloadOutlined style={{ fontSize: 15, color: '#8c8c8c' }} />}
            loading={exporting} onClick={handleExport} />
        </Tooltip>
      </div>
      <div ref={chartRef} style={{ padding: '8px 0' }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic title="Total Requests" value={requests.length} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Completed"
              value={requests.filter(r => (r.overallStatus || '').toLowerCase().includes('complet')).length}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="In Progress"
              value={requests.filter(r => (r.overallStatus || '').toLowerCase().includes('progress')).length}
              prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}>
          <Card size="small" title="By Request Type" style={{ borderRadius: 8 }}>
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Tag color={TYPE_COLORS[type] || 'default'}>{TYPE_LABELS[type] || type}</Tag>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card size="small" title="By Overall Status" style={{ borderRadius: 8 }}>
            {Object.entries(stats.byStatus).map(([status, count]) => (
              <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 13 }}>{status}</span>
                <span style={{ fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      {Object.keys(stats.byMonth).length > 0 && (
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card size="small" title="Requests by Month (date raised)" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {Object.entries(stats.byMonth).sort().map(([month, count]) => (
                  <div key={month} style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 6, padding: '4px 12px', textAlign: 'center', minWidth: 72 }}>
                    <div style={{ fontSize: 11, color: '#1d39c4' }}>{month}</div>
                    <div style={{ fontWeight: 700, color: '#1890ff' }}>{count}</div>
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      )}
      </div>
    </div>
  );
}
