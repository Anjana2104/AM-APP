/**
 * RequestInsightsChart.tsx
 * 
 * Child component used in RequestManagement.tsx
 * Chart visualization component for request analytics with PNG and PDF export
 */
import React, { useMemo, useRef, useState } from 'react';
import { Card, Row, Col, Statistic, Empty, Tag, Button, Tooltip, message, Modal, Table, Badge, Space, Typography, Input } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, DownloadOutlined, LinkOutlined, UserOutlined, SearchOutlined, ExportOutlined } from '@ant-design/icons';
import { exportChartAsPng, captureElementCanvas } from '../utils/exportChartAsPng';
import { getCurrentDateStamp } from '../utils/styledExcelExport';
import { jsPDF } from 'jspdf';
import dayjs from 'dayjs';

const { Text } = Typography;

// ── Card export icon (consistent with FinanceSummary) ──
function CardExportIcon({ onExport, title = 'Export' }: { onExport: () => void; title?: string }) {
  const [hov, setHov] = React.useState(false);
  return (
    <Tooltip title={<span style={{ fontSize: '11px' }}>{title}</span>} placement="left">
      <ExportOutlined
        onClick={onExport}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ fontSize: 13, color: hov ? '#1890FF' : '#bfbfbf', cursor: 'pointer', transition: 'color 0.15s' }}
      />
    </Tooltip>
  );
}

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
  isActive?: boolean;
  id?: number;
}

interface ResourceItem {
  id?: number;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string;
  roleOrDomain: string;
  engagement: string;
  allocationStatus?: string;
  skills: string;
  beelineId?: string;
}

interface RequestInsightsChartProps {
  requests: ClientRequest[];
  allResources?: ResourceItem[];
  onExportBeelineMapping?: () => void;
}

interface BeelineResourcePanelProps {
  requests: ClientRequest[];
  allResources: ResourceItem[];
  onExportBeelineMapping?: () => void;
  onToggleActive?: (id: number, isActive: boolean) => void;
}

// ── Shared resource table columns ─────────────────────────────────────────
const resourceColumns = [
  { title: 'RA ID', dataIndex: 'raId', key: 'raId', width: 90, render: (v: string) => <Text style={{ fontSize: 12 }}>{v}</Text> },
  { title: 'Name', dataIndex: 'empName', key: 'empName', render: (v: string) => <Text strong style={{ fontSize: 12 }}>{v}</Text> },
  { title: 'Role', key: 'role', render: (_: any, r: ResourceItem) => <Text style={{ fontSize: 11 }}>{r.piwRole || r.roleOrDomain || '—'}</Text> },
  { title: 'Engagement', dataIndex: 'engagement', key: 'engagement', render: (v: string) => v ? <Tag color="purple" style={{ fontSize: 10 }}>{v}</Tag> : <Text type="secondary" style={{ fontSize: 11 }}>—</Text> },
  {
    title: 'Status', dataIndex: 'allocationStatus', key: 'allocationStatus',
    render: (v: string) => v ? (
      <Tag color={v.toLowerCase().includes('bench') ? 'orange' : v.toLowerCase().includes('resign') ? 'red' : v.toLowerCase() === 'joined' ? 'green' : 'blue'} style={{ fontSize: 10 }}>{v}</Tag>
    ) : <Text type="secondary" style={{ fontSize: 11 }}>—</Text>
  },
  { title: 'Skills', dataIndex: 'skills', key: 'skills', render: (v: string) => <Text style={{ fontSize: 11, color: '#595959' }}>{v ? v.split(',').slice(0, 3).join(', ') + (v.split(',').length > 3 ? '…' : '') : '—'}</Text> },
];

// ── BeelineResourcePanel — standalone component for the Beeline IDs tab ──
export function BeelineResourcePanel({ requests, allResources, onExportBeelineMapping, onToggleActive }: BeelineResourcePanelProps) {
  const [drilldownBeeline, setDrilldownBeeline] = useState<string | null>(null);
  const [beelineSearch, setBeelineSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const beelineResourceMap = useMemo(() => {
    const map: Record<string, ResourceItem[]> = {};
    allResources.forEach(r => {
      const bid = r.beelineId;
      if (bid) {
        if (!map[bid]) map[bid] = [];
        map[bid].push(r);
      }
    });
    return map;
  }, [allResources]);

  const beelineInsights = useMemo(() => {
    const requestMap: Record<string, ClientRequest> = {};
    requests.forEach(r => { if (r.beelineId) requestMap[r.beelineId] = r; });
    // Include all requests (even those with 0 linked resources)
    const allBeelineIds = new Set([...Object.keys(beelineResourceMap), ...requests.map(r => r.beelineId).filter(Boolean)]);
    return Array.from(allBeelineIds)
      .map(bid => ({
        beelineId: bid,
        resourceCount: (beelineResourceMap[bid] || []).length,
        request: requestMap[bid],
        resources: beelineResourceMap[bid] || [],
      }))
      .sort((a, b) => b.resourceCount - a.resourceCount);
  }, [beelineResourceMap, requests]);

  const filteredBeelineInsights = useMemo(() => {
    let items = showInactive ? beelineInsights : beelineInsights.filter(item => item.request?.isActive !== false);
    if (!beelineSearch) return items;
    const q = beelineSearch.toLowerCase();
    return items.filter(item =>
      item.beelineId.toLowerCase().includes(q) ||
      item.resources.some(r => r.empName.toLowerCase().includes(q) || r.raId.toLowerCase().includes(q))
    );
  }, [beelineInsights, beelineSearch, showInactive]);

  const drilldownResources = useMemo(() => drilldownBeeline ? (beelineResourceMap[drilldownBeeline] || []) : [], [drilldownBeeline, beelineResourceMap]);
  const drilldownRequest = useMemo(() => drilldownBeeline ? requests.find(r => r.beelineId === drilldownBeeline) || null : null, [drilldownBeeline, requests]);

  const totalLinked = allResources.filter(r => r.beelineId).length;
  const uniqueBeelines = beelineInsights.filter(item => item.request?.isActive !== false).length;
  const inactiveCount = beelineInsights.filter(item => item.request?.isActive === false).length;

  return (
    <div>
      {/* ── KPI row ── */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#52c41a' }}>Resources Linked</Text>}
              value={totalLinked}
              prefix={<UserOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8, background: '#f0f5ff', border: '1px solid #d6e4ff' }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#1890ff' }}>Active Beeline IDs</Text>}
              value={uniqueBeelines}
              prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff', fontSize: 22 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title={<Text style={{ fontSize: 11, color: '#8c8c8c' }}>Total Requests</Text>}
              value={requests.length}
              valueStyle={{ fontSize: 22 }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Beeline list card ── */}
      <Card
        size="small"
        style={{ borderRadius: 10, border: '1px solid #d6e4ff' }}
        title={
          <Space size={8}>
            <LinkOutlined style={{ color: '#1890ff' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Resources per Beeline ID</span>
            <Badge count={uniqueBeelines} style={{ backgroundColor: '#1890ff' }} showZero />
          </Space>
        }
        extra={
          <Space size={8}>
            {inactiveCount > 0 && (
              <Button
                size="small"
                type={showInactive ? 'primary' : 'default'}
                onClick={() => setShowInactive(v => !v)}
                style={{ fontSize: 11, borderRadius: 6 }}
              >
                {showInactive ? 'Hide Inactive' : `Show Inactive (${inactiveCount})`}
              </Button>
            )}
            {beelineInsights.length > 0 && (
              <Input
                size="small"
                allowClear
                prefix={<SearchOutlined style={{ color: '#bfbfbf', fontSize: 11 }} />}
                placeholder="Search Beeline ID or resource…"
                value={beelineSearch}
                onChange={e => setBeelineSearch(e.target.value)}
                style={{ width: 220, fontSize: 11, background: '#fff' }}
              />
            )}
            {onExportBeelineMapping && (
              <Tooltip title="Download as Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button size="small" icon={<DownloadOutlined />} onClick={onExportBeelineMapping} style={{ fontSize: 11 }}>
                  Export
                </Button>
              </Tooltip>
            )}
          </Space>
        }
      >
        {beelineInsights.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={<Text type="secondary" style={{ fontSize: 12 }}>No resources linked to any Beeline ID yet. Link resources from a request card or Resource Hub.</Text>}
            style={{ margin: '24px 0' }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {filteredBeelineInsights.length === 0 ? (
              <Text type="secondary" style={{ fontSize: 12, padding: '8px 0' }}>No matches found</Text>
            ) : filteredBeelineInsights.map(item => {
              const isActive = item.request?.isActive !== false;
              return (
              <div
                key={item.beelineId}
                onClick={() => setDrilldownBeeline(item.beelineId)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  border: `1px solid ${isActive ? '#e8eaf0' : '#ffe7ba'}`, borderRadius: 8, cursor: 'pointer',
                  background: isActive ? '#fafafa' : '#fff7e6', transition: 'background 0.15s',
                  opacity: isActive ? 1 : 0.75,
                }}
                onMouseEnter={e => (e.currentTarget.style.background = isActive ? '#f0f5ff' : '#fff1e6')}
                onMouseLeave={e => (e.currentTarget.style.background = isActive ? '#fafafa' : '#fff7e6')}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
                  <Tag
                    color={isActive ? 'green' : 'orange'}
                    style={{ fontSize: 9, margin: 0, padding: '0 5px', cursor: 'pointer', alignSelf: 'flex-start' }}
                    onClick={e => {
                      e.stopPropagation();
                      if (item.request?.id !== undefined && onToggleActive) {
                        onToggleActive(item.request.id!, !isActive);
                      }
                    }}
                  >
                    {isActive ? 'Active' : 'Inactive'}
                  </Tag>
                  <Tag icon={<LinkOutlined />} color={isActive ? 'blue' : 'default'} style={{ fontWeight: 600, fontSize: 12, padding: '2px 8px', margin: 0 }}>{item.beelineId}</Tag>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {item.request?.description && (
                    <Text style={{ fontSize: 11, color: '#595959', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                      {item.request.description.slice(0, 70) + (item.request.description.length > 70 ? '…' : '')}
                    </Text>
                  )}
                  <Space size={4} wrap>
                    {item.resources.slice(0, 4).map(r => (
                      <Tag key={r.raId} icon={<UserOutlined />} style={{ fontSize: 10, margin: 0 }}>{r.empName}</Tag>
                    ))}
                    {item.resources.length > 4 && (
                      <Tag style={{ fontSize: 10, margin: 0, background: '#f0f5ff', border: '1px solid #d6e4ff', color: '#1890ff' }}>+{item.resources.length - 4} more</Tag>
                    )}
                  </Space>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0, minWidth: 64 }}>
                  <Badge count={item.resourceCount} style={{ backgroundColor: '#52c41a' }} showZero />
                  {item.request?.overallStatus && (
                    <Tag
                      color={(item.request.overallStatus || '').toLowerCase().includes('complet') ? 'green' : (item.request.overallStatus || '').toLowerCase().includes('progress') ? 'blue' : 'default'}
                      style={{ fontSize: 9, margin: 0, padding: '0 5px' }}
                    >
                      {item.request.overallStatus}
                    </Tag>
                  )}
                </div>
              </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Drilldown Modal ── */}
      <Modal
        open={!!drilldownBeeline}
        onCancel={() => setDrilldownBeeline(null)}
        footer={<Button onClick={() => setDrilldownBeeline(null)}>Close</Button>}
        width={860}
        title={
          <Space size={8}>
            <LinkOutlined style={{ color: '#1890ff' }} />
            <span>Resources under Beeline</span>
            <Tag color="blue" style={{ fontWeight: 600, fontSize: 12 }}>{drilldownBeeline}</Tag>
            <Badge count={drilldownResources.length} style={{ backgroundColor: '#52c41a' }} />
          </Space>
        }
        destroyOnClose
      >
        {drilldownRequest && (
          <div style={{ marginBottom: 14, padding: '10px 14px', background: '#f0f5ff', borderRadius: 8, border: '1px solid #d6e4ff' }}>
            <Row gutter={[16, 8]}>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Raised By</Text>
                <Text style={{ fontSize: 12, fontWeight: 500 }}>{drilldownRequest.raisedBy || '—'}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Owner</Text>
                <Text style={{ fontSize: 12, fontWeight: 500 }}>{drilldownRequest.accountAnchor || '—'}</Text>
              </Col>
              <Col span={8}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Overall Status</Text>
                <Text style={{ fontSize: 12, fontWeight: 500 }}>{drilldownRequest.overallStatus || '—'}</Text>
              </Col>
              {drilldownRequest.description && (
                <Col span={24}>
                  <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>Description</Text>
                  <Text style={{ fontSize: 12 }}>{drilldownRequest.description}</Text>
                </Col>
              )}
            </Row>
          </div>
        )}
        <Table
          dataSource={drilldownResources}
          columns={resourceColumns}
          rowKey="raId"
          size="small"
          pagination={drilldownResources.length > 10 ? { pageSize: 10, size: 'small' } : false}
        />
      </Modal>
    </div>
  );
}

// ── RequestInsightsChart — stats/charts only (Beeline section moved to its own tab) ──
export function RequestInsightsChart({ requests, allResources = [] }: RequestInsightsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleExportPNG = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      await exportChartAsPng(chartRef.current, `Request_Insights_${getCurrentDateStamp()}.png`);
    } catch {
      message.error('PNG export failed');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const canvas = await captureElementCanvas(chartRef.current);
      if (!canvas) throw new Error('Canvas capture failed');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth - 10;
      const imgHeight = (canvas.height / canvas.width) * imgWidth;
      pdf.addImage(imgData, 'PNG', 5, 5, imgWidth, imgHeight);
      pdf.save(`Request_Insights_${getCurrentDateStamp()}.pdf`);
    } catch {
      message.error('PDF export failed');
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
  const totalLinked = allResources.filter(r => r.beelineId).length;

  return (
    <div>
      {/* ── Export buttons (PNG & PDF) ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Tooltip title="Export format" overlayInnerStyle={{ fontSize: '11px' }}>
          <span style={{ fontSize: '11px', color: '#8c8c8c' }}>Export:</span>
        </Tooltip>
        <Space size={8}>
          <CardExportIcon
            onExport={handleExportPNG}
            title="Export as PNG"
          />
          <CardExportIcon
            onExport={handleExportPDF}
            title="Export as PDF"
          />
        </Space>
      </div>

      <div ref={chartRef}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title="Total Requests" value={requests.length} />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="Completed"
                value={requests.filter(r => (r.overallStatus || '').toLowerCase().includes('complet')).length}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic
                title="In Progress"
                value={requests.filter(r => (r.overallStatus || '').toLowerCase().includes('progress')).length}
                prefix={<ClockCircleOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={6}>
            <Card size="small" style={{ borderRadius: 8, background: totalLinked > 0 ? '#f0f5ff' : undefined }}>
              <Statistic
                title="Resources Linked"
                value={totalLinked}
                prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="By Request Type" style={{ borderRadius: 8 }}>
              {Object.entries(stats.byType).map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Tag color={TYPE_COLORS[type] || 'default'}>{TYPE_LABELS[type] || type}</Tag>
                  <Text strong style={{ fontSize: 13 }}>{count}</Text>
                </div>
              ))}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card size="small" title="By Overall Status" style={{ borderRadius: 8 }}>
              {Object.entries(stats.byStatus).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <Text style={{ fontSize: 13 }}>{status}</Text>
                  <Text strong style={{ fontSize: 13 }}>{count}</Text>
                </div>
              ))}
            </Card>
          </Col>
        </Row>

        {Object.keys(stats.byMonth).length > 0 && (
          <Row gutter={[12, 12]} style={{ marginTop: 12 }}>
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
