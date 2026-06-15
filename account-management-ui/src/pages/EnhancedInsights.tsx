/**
 * EnhancedInsights.tsx
 * 
 * Child component used in RequestManagement.tsx
 * Displays analytics dashboard for client requests with export capabilities
 * (Excel and PDF export buttons)
 */
import React, { useMemo, useRef, useState } from 'react';
import {
  Card, Row, Col, Statistic, Empty, Tag, Button, Tooltip, message, Space, Typography,
  Table, Badge, Divider, Spin, Select, Progress, Popover
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, StopOutlined, DeleteOutlined,
  DownloadOutlined, LinkOutlined, UserOutlined, FileExcelOutlined, ExportOutlined,
  ArrowRightOutlined, CalendarOutlined, TeamOutlined
} from '@ant-design/icons';
import * as XLSXStyle from 'xlsx-js-style';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
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
  id?: number;
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

interface EnhancedInsightsProps {
  requests: ClientRequest[];
  allResources?: ResourceItem[];
  onNavigateToRequests: (filters: Record<string, any>) => void;
  overallStatusDisplayMap: Record<string, string>;
  processingStatusDisplayMap: Record<string, string>;
  processingStatusOptions: Array<{ label: string; value: string }>;
  overallStatusOptions: Array<{ label: string; value: string }>;
  requestTypeOptions: Array<{ label: string; value: string; color?: string }>;
  requestTypeLabel: Record<string, string>;
  requestTypeColor: Record<string, string>;
}

export function EnhancedInsights({
  requests,
  allResources = [],
  onNavigateToRequests,
  overallStatusDisplayMap,
  processingStatusDisplayMap,
  processingStatusOptions,
  overallStatusOptions,
  requestTypeOptions,
  requestTypeLabel,
  requestTypeColor,
}: EnhancedInsightsProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  // ── Analytics computation ────────────────────────────────────────────
  const analytics = useMemo(() => {
    const byOverallStatus: Record<string, number> = {};
    const byProcessingStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byMonth: Record<string, number> = {};
    const beelineResourceCount: Record<string, number> = {};
    const allocationStatusCount: Record<string, number> = {};

    requests.forEach(r => {
      // Overall status
      const oStatus = r.overallStatus || 'unknown';
      byOverallStatus[oStatus] = (byOverallStatus[oStatus] || 0) + 1;

      // Processing status
      const pStatus = r.processingStatus || 'unknown';
      byProcessingStatus[pStatus] = (byProcessingStatus[pStatus] || 0) + 1;

      // Request type
      const rType = r.requestType || 'unspecified';
      byType[rType] = (byType[rType] || 0) + 1;

      // By month
      if (r.dateRaised) {
        const month = dayjs(r.dateRaised).format('MMM YYYY');
        if (month !== 'Invalid Date') byMonth[month] = (byMonth[month] || 0) + 1;
      }
    });

    allResources.forEach(r => {
      if (r.beelineId) {
        beelineResourceCount[r.beelineId] = (beelineResourceCount[r.beelineId] || 0) + 1;
      }
      if (r.allocationStatus) {
        allocationStatusCount[r.allocationStatus] = (allocationStatusCount[r.allocationStatus] || 0) + 1;
      }
    });

    const totalLinked = allResources.filter(r => r.beelineId).length;
    const uniqueBeelineIds = Object.keys(beelineResourceCount).length;
    const topBeelineIds = Object.entries(beelineResourceCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

    return {
      byOverallStatus,
      byProcessingStatus,
      byType,
      byMonth,
      beelineResourceCount,
      allocationStatusCount,
      totalLinked,
      uniqueBeelineIds,
      topBeelineIds,
    };
  }, [requests, allResources]);

  // ── Key metrics ──────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const completed = requests.filter(r => (r.overallStatus || '').toLowerCase().includes('completed')).length;
    const inProgress = requests.filter(r => (r.overallStatus || '').toLowerCase().includes('progress')).length;
    const notStarted = requests.filter(r => (r.overallStatus || '').toLowerCase().includes('not_started')).length;
    const blocked = requests.filter(r => (r.overallStatus || '').toLowerCase().includes('blocked')).length;

    return { completed, inProgress, notStarted, blocked };
  }, [requests]);

  // ── Export functionality ─────────────────────────────────────────────
  const handleExportInsights = async () => {
    setExporting(true);
    try {
      const data: any[] = [];

      // Summary metrics
      data.push(['INSIGHTS SUMMARY']);
      data.push(['']);
      data.push(['Metric', 'Count']);
      data.push(['Total Requests', requests.length]);
      data.push(['Unique Beeline IDs', analytics.uniqueBeelineIds]);
      data.push(['Resources Linked', analytics.totalLinked]);
      data.push(['Completed', metrics.completed]);
      data.push(['In Progress', metrics.inProgress]);
      data.push(['Not Started', metrics.notStarted]);
      data.push(['Blocked', metrics.blocked]);
      data.push(['']);

      // Overall Status breakdown
      data.push(['OVERALL STATUS BREAKDOWN']);
      data.push(['Status', 'Count', 'UI Display']);
      Object.entries(analytics.byOverallStatus).sort(([, a], [, b]) => b - a).forEach(([status, count]) => {
        data.push([status, count, overallStatusDisplayMap[status] || status]);
      });
      data.push(['']);

      // Processing Status breakdown
      data.push(['PROCESSING STATUS BREAKDOWN']);
      data.push(['Status', 'Count', 'UI Display']);
      Object.entries(analytics.byProcessingStatus).sort(([, a], [, b]) => b - a).forEach(([status, count]) => {
        data.push([status, count, processingStatusDisplayMap[status] || status]);
      });
      data.push(['']);

      // Request Type breakdown
      data.push(['REQUEST TYPE BREAKDOWN']);
      data.push(['Type', 'Count']);
      Object.entries(analytics.byType).sort(([, a], [, b]) => b - a).forEach(([type, count]) => {
        data.push([requestTypeLabel[type] || type, count]);
      });
      data.push(['']);

      // Top Beeline IDs
      if (analytics.topBeelineIds.length > 0) {
        data.push(['TOP BEELINE IDS BY RESOURCES']);
        data.push(['Beeline ID', 'Resource Count']);
        analytics.topBeelineIds.forEach(([bid, count]) => {
          data.push([bid, count]);
        });
      }

      const ws = XLSXStyle.utils.aoa_to_sheet(data);
      ws['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 25 }];
      const wb = XLSXStyle.utils.book_new();
      XLSXStyle.utils.book_append_sheet(wb, ws, 'Insights');
      XLSXStyle.writeFile(wb, `Request_Insights_${new Date().toISOString().slice(0, 10)}.xlsx`);
      message.success('Insights exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      message.error('Failed to export insights');
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#fff', scale: 2, useCORS: true });
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
      pdf.save(`Request_Insights_${new Date().toISOString().slice(0, 10)}.pdf`);
      message.success('PDF exported successfully');
    } catch (error) {
      console.error('PDF export error:', error);
      message.error('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  if (!requests.length) {
    return <Empty description="No requests yet" style={{ margin: '40px 0' }} />;
  }

  return (
    <div style={{ padding: '12px 0' }}>
      {/* ── Export buttons (Excel & PDF) ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Tooltip title="Export as Excel" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button
            size="small"
            icon={<FileExcelOutlined />}
            loading={exporting}
            onClick={handleExportInsights}
            style={{ fontSize: '11px' }}
          >
            Excel
          </Button>
        </Tooltip>
        <CardExportIcon
          onExport={handleExportPDF}
          title="Export as PDF"
        />
      </div>

      <div ref={chartRef}>
        {/* ── KPI Row 1: Main metrics ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{ borderRadius: 8, cursor: 'pointer', transition: 'all 0.3s' }}
              hoverable
              onClick={() => onNavigateToRequests({})}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#1890ff' }}>Total Requests</Text>}
                value={requests.length}
                valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: '#f6ffed',
                border: '1px solid #b7eb8f'
              }}
              hoverable
              onClick={() => onNavigateToRequests({ overallStatus: 'completed' })}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#52c41a' }}>Completed</Text>}
                value={metrics.completed}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: '#fffbe6',
                border: '1px solid #ffe58f'
              }}
              hoverable
              onClick={() => onNavigateToRequests({ overallStatus: 'in_progress' })}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#faad14' }}>In Progress</Text>}
                value={metrics.inProgress}
                prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
                valueStyle={{ color: '#faad14', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{ borderRadius: 8, cursor: 'pointer', transition: 'all 0.3s' }}
              hoverable
              onClick={() => onNavigateToRequests({})}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#1890ff' }}>Resources Linked</Text>}
                value={analytics.totalLinked}
                prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
        </Row>

        {/* ── KPI Row 2: Additional metrics ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: '#fff1f0',
                border: '1px solid #ffccc7'
              }}
              hoverable
              onClick={() => onNavigateToRequests({ overallStatus: 'blocked' })}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#f5222d' }}>Blocked</Text>}
                value={metrics.blocked}
                prefix={<StopOutlined style={{ color: '#f5222d' }} />}
                valueStyle={{ color: '#f5222d', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: '#f0f5ff',
                border: '1px solid #d6e4ff'
              }}
              hoverable
              onClick={() => onNavigateToRequests({})}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#1890ff' }}>Not Started</Text>}
                value={metrics.notStarted}
                valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'all 0.3s',
                background: '#f0f5ff',
                border: '1px solid #d6e4ff'
              }}
              hoverable
              onClick={() => onNavigateToRequests({})}
            >
              <Statistic
                title={<Text style={{ fontSize: 11, color: '#1890ff' }}>Unique Beeline IDs</Text>}
                value={analytics.uniqueBeelineIds}
                prefix={<LinkOutlined style={{ color: '#1890ff' }} />}
                valueStyle={{ color: '#1890ff', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card
              size="small"
              style={{ borderRadius: 8, cursor: 'pointer', transition: 'all 0.3s' }}
              hoverable
              onClick={() => onNavigateToRequests({})}
            >
              <Statistic
                title={<Text style={{ fontSize: 11 }}>Requests Active</Text>}
                value={requests.filter(r => r.isActive !== false).length}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                valueStyle={{ color: '#52c41a', fontSize: 24, fontWeight: 600 }}
              />
            </Card>
          </Col>
        </Row>

        {/* ── Status Breakdown Row ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="Overall Status Breakdown" style={{ borderRadius: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {Object.entries(analytics.byOverallStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const percentage = (count / requests.length) * 100;
                    const displayStatus = overallStatusDisplayMap[status] || status;
                    return (
                      <div
                        key={status}
                        style={{
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: '#fafafa',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                        onClick={() => onNavigateToRequests({ overallStatus: status })}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: 500 }}>{displayStatus}</Text>
                          <Badge count={count} style={{ backgroundColor: '#1890ff' }} />
                        </div>
                        <Progress percent={Math.round(percentage)} size="small" strokeColor="#1890ff" />
                      </div>
                    );
                  })}
              </Space>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card size="small" title="Processing Status Breakdown" style={{ borderRadius: 8 }}>
              <Space direction="vertical" style={{ width: '100%' }} size={8}>
                {Object.entries(analytics.byProcessingStatus)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => {
                    const percentage = (count / requests.length) * 100;
                    const displayStatus = processingStatusDisplayMap[status] || status;
                    return (
                      <div
                        key={status}
                        style={{
                          cursor: 'pointer',
                          padding: '8px 12px',
                          borderRadius: 6,
                          background: '#fafafa',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                        onClick={() => onNavigateToRequests({ processingStatus: status })}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <Text style={{ fontSize: 12, fontWeight: 500 }}>{displayStatus}</Text>
                          <Badge count={count} style={{ backgroundColor: '#1890ff' }} />
                        </div>
                        <Progress percent={Math.round(percentage)} size="small" strokeColor="#faad14" />
                      </div>
                    );
                  })}
              </Space>
            </Card>
          </Col>
        </Row>

        {/* ── Request Type & Resource Allocation ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Card size="small" title="Request Type Distribution" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(analytics.byType)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      onClick={() => onNavigateToRequests({ requestType: type })}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: '#fafafa',
                        cursor: 'pointer',
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                    >
                      <Tag color={requestTypeColor[type] || 'default'} style={{ fontSize: 11 }}>
                        {requestTypeLabel[type] || type}
                      </Tag>
                      <Text strong style={{ fontSize: 13 }}>{count}</Text>
                    </div>
                  ))}
              </div>
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card size="small" title="Resource Allocation Status" style={{ borderRadius: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(analytics.allocationStatusCount)
                  .sort(([, a], [, b]) => b - a)
                  .map(([status, count]) => (
                    <div
                      key={status}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        borderRadius: 6,
                        background: '#fafafa',
                      }}
                    >
                      <Tag
                        color={
                          status.toLowerCase().includes('bench')
                            ? 'orange'
                            : status.toLowerCase().includes('resign')
                            ? 'red'
                            : status.toLowerCase() === 'joined'
                            ? 'green'
                            : 'blue'
                        }
                        style={{ fontSize: 11 }}
                      >
                        {status}
                      </Tag>
                      <Text strong style={{ fontSize: 13 }}>{count}</Text>
                    </div>
                  ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* ── Top Beeline IDs ── */}
        {analytics.topBeelineIds.length > 0 && (
          <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
            <Col xs={24}>
              <Card size="small" title="Top Beeline IDs by Resource Count" style={{ borderRadius: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {analytics.topBeelineIds.map(([beelineId, count], index) => {
                    const request = requests.find(r => r.beelineId === beelineId);
                    const percentage = (count / analytics.totalLinked) * 100;
                    return (
                      <div
                        key={beelineId}
                        onClick={() => onNavigateToRequests({ beelineId })}
                        style={{
                          padding: '12px',
                          borderRadius: 6,
                          background: '#fafafa',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f0')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fafafa')}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <div>
                            <Tag
                              icon={<LinkOutlined />}
                              color="blue"
                              style={{ fontSize: 12, fontWeight: 600, marginRight: 8 }}
                            >
                              {beelineId}
                            </Tag>
                            {request && (
                              <Text style={{ fontSize: 11, color: '#595959' }}>
                                {request.description?.substring(0, 50) || '—'}
                              </Text>
                            )}
                          </div>
                          <Badge count={count} style={{ backgroundColor: '#52c41a' }} showZero />
                        </div>
                        <Progress percent={Math.round(percentage)} size="small" strokeColor="#52c41a" />
                      </div>
                    );
                  })}
                </div>
              </Card>
            </Col>
          </Row>
        )}

        {/* ── Requests by Month ── */}
        {Object.keys(analytics.byMonth).length > 0 && (
          <Row gutter={[12, 12]}>
            <Col xs={24}>
              <Card size="small" title="Requests by Month (Date Raised)" style={{ borderRadius: 8 }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(analytics.byMonth)
                    .sort()
                    .map(([month, count]) => (
                      <div
                        key={month}
                        style={{
                          background: '#f0f5ff',
                          border: '1px solid #d6e4ff',
                          borderRadius: 6,
                          padding: '8px 12px',
                          textAlign: 'center',
                          minWidth: 80,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#e6f7ff';
                          e.currentTarget.style.borderColor = '#91d5ff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = '#f0f5ff';
                          e.currentTarget.style.borderColor = '#d6e4ff';
                        }}
                        onClick={() => {
                          // Filter by month (optional implementation)
                        }}
                      >
                        <div style={{ fontSize: 11, color: '#1d39c4', fontWeight: 500 }}>{month}</div>
                        <div style={{ fontWeight: 700, color: '#1890ff', fontSize: 14 }}>{count}</div>
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
