import React from 'react';
import { Button, Card, Col, Drawer, Progress, Row, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import { FileExcelOutlined } from '@ant-design/icons';
import type {
  BookingInsightRow,
  BookingTotals,
  MonthlyBookingBreakdownRow,
  QuarterlyBookingBreakdownRow,
  UnbookedByFilter,
  UnbookedInsightRow,
} from './financeInsightsTypes';

const { Text } = Typography;

interface FinanceBookingInsightsTabProps {
  bookingLoading: boolean;
  bookingRowsForFY: BookingInsightRow[];
  bookingTotals: BookingTotals;
  unbookedByFilter: UnbookedByFilter;
  monthlyBookingBreakdown: MonthlyBookingBreakdownRow[];
  quarterlyBookingBreakdown: QuarterlyBookingBreakdownRow[];
  drilldownOpen: boolean;
  drilldownTitle: string;
  drilldownRows: BookingInsightRow[];
  unbookedDrilldownOpen: boolean;
  unbookedDrilldownTitle: string;
  unbookedDrilldownRows: UnbookedInsightRow[];
  openBookingDrilldown: (title: string, rows: BookingInsightRow[]) => void;
  openUnbookedDrilldown: (title: string, rows: UnbookedInsightRow[]) => void;
  closeBookingDrilldown: () => void;
  closeUnbookedDrilldown: () => void;
  exportMonthlyTrendExcel: () => void;
  exportQuarterlyTrendExcel: () => void;
  exportBookingDrilldownExcel: () => void;
  exportUnbookedDrilldownExcel: () => void;
  fmt: (n: number) => string;
}

export function FinanceBookingInsightsTab({
  bookingLoading,
  bookingRowsForFY,
  bookingTotals,
  unbookedByFilter,
  monthlyBookingBreakdown,
  quarterlyBookingBreakdown,
  drilldownOpen,
  drilldownTitle,
  drilldownRows,
  unbookedDrilldownOpen,
  unbookedDrilldownTitle,
  unbookedDrilldownRows,
  openBookingDrilldown,
  openUnbookedDrilldown,
  closeBookingDrilldown,
  closeUnbookedDrilldown,
  exportMonthlyTrendExcel,
  exportQuarterlyTrendExcel,
  exportBookingDrilldownExcel,
  exportUnbookedDrilldownExcel,
  fmt,
}: FinanceBookingInsightsTabProps) {
  return (
    <>
      <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8, marginTop: 8 }}>
        {bookingLoading ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}><Spin size="small" /></div>
        ) : (
          <>
            <Row gutter={8} wrap={false} style={{ marginBottom: 8 }}>
              <Col flex="1 1 0" style={{ minWidth: 0 }}>
                <Card size="small" hoverable onClick={() => openBookingDrilldown('All Bookings (current filters)', bookingRowsForFY)} style={{ borderRadius: 8 }}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Total Booking Amount</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1677ff', marginTop: 2 }}>{fmt(bookingTotals.total)}</div>
                </Card>
              </Col>
              <Col flex="1 1 0" style={{ minWidth: 0 }}>
                <Card size="small" hoverable onClick={() => openBookingDrilldown('Fixed Bookings', bookingRowsForFY.filter(r => r.bookingType === 'fixed'))} style={{ borderRadius: 8 }}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Fixed</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#1677ff', marginTop: 2 }}>{fmt(bookingTotals.fixed)}</div>
                </Card>
              </Col>
              <Col flex="1 1 0" style={{ minWidth: 0 }}>
                <Card size="small" hoverable onClick={() => openBookingDrilldown('Anticipated Bookings', bookingRowsForFY.filter(r => r.bookingType === 'anticipated'))} style={{ borderRadius: 8 }}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Anticipated</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#ff4d4f', marginTop: 2 }}>{fmt(bookingTotals.anticipated)}</div>
                </Card>
              </Col>
              <Col flex="1 1 0" style={{ minWidth: 0 }}>
                <Card size="small" hoverable onClick={() => openBookingDrilldown('Projects with bookings', bookingRowsForFY)} style={{ borderRadius: 8 }}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Projects Covered</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#52c41a', marginTop: 2 }}>{bookingTotals.projects}</div>
                </Card>
              </Col>
              <Col flex="1 1 0" style={{ minWidth: 0 }}>
                <Card size="small" hoverable onClick={() => openUnbookedDrilldown(`Unbooked Milestones — ${unbookedByFilter.label}`, unbookedByFilter.rows)} style={{ borderRadius: 8 }}>
                  <div style={{ fontSize: '11px', color: '#8c8c8c' }}>Unbooked ({unbookedByFilter.label})</div>
                  <div style={{ fontSize: '16px', fontWeight: 700, color: unbookedByFilter.color, marginTop: 2 }}>{fmt(unbookedByFilter.total)}</div>
                </Card>
              </Col>
            </Row>

            <Row gutter={[12, 12]}>
              <Col xs={24}>
                <Card
                  size="small"
                  title={<span style={{ fontSize: '12px' }}>Booked-at Month Trend</span>}
                  style={{ borderRadius: 8 }}
                  extra={(
                    <Tooltip title="Export to Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                      <Button type="text" size="small" icon={<FileExcelOutlined style={{ color: '#1677ff' }} />} onClick={exportMonthlyTrendExcel} />
                    </Tooltip>
                  )}
                >
                  <Space direction="vertical" size={8} style={{ width: '100%' }}>
                    {monthlyBookingBreakdown.map((m) => (
                      <div
                        key={m.month}
                        style={{ display: 'grid', gridTemplateColumns: '72px 1fr 92px', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onClick={() => openBookingDrilldown(`Booked in ${m.month}`, m.rows)}
                      >
                        <Text style={{ fontSize: '11px', color: '#595959' }}>{m.month}</Text>
                        <Progress percent={bookingTotals.total ? Math.round((m.amount / bookingTotals.total) * 100) : 0} size="small" showInfo={false} strokeColor="#1677ff" />
                        <Text style={{ fontSize: '11px', textAlign: 'right' }}>{fmt(m.amount)}</Text>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
              <Col xs={24}>
                <Card
                  size="small"
                  title={<span style={{ fontSize: '12px' }}>Quarterly Booking Trend</span>}
                  style={{ borderRadius: 8 }}
                  extra={(
                    <Tooltip title="Export to Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                      <Button type="text" size="small" icon={<FileExcelOutlined style={{ color: '#1677ff' }} />} onClick={exportQuarterlyTrendExcel} />
                    </Tooltip>
                  )}
                >
                  <Space direction="vertical" size={10} style={{ width: '100%' }}>
                    {quarterlyBookingBreakdown.map((q, idx) => (
                      <div
                        key={q.quarter}
                        style={{ display: 'grid', gridTemplateColumns: '42px 1fr 120px 95px', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onClick={() => openBookingDrilldown(`Bookings in ${q.quarter} (${q.monthsLabel})`, q.rows)}
                      >
                        <Tag color={['blue', 'green', 'gold', 'volcano'][idx]} style={{ marginRight: 0, textAlign: 'center' }}>{q.quarter}</Tag>
                        <Text style={{ fontSize: '11px', color: '#595959' }}>{q.monthsLabel}</Text>
                        <Progress
                          percent={bookingTotals.total ? Math.round((q.amount / bookingTotals.total) * 100) : 0}
                          size="small"
                          showInfo={false}
                          strokeColor={['#1677ff', '#52c41a', '#faad14', '#ff7a45'][idx]}
                        />
                        <Text style={{ fontSize: '11px', textAlign: 'right' }}>{fmt(q.amount)}</Text>
                      </div>
                    ))}
                  </Space>
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Card>

      <Drawer
        title={<span style={{ fontSize: '12px' }}>{drilldownTitle || 'Booking Drilldown'}</span>}
        width={920}
        open={drilldownOpen}
        onClose={closeBookingDrilldown}
        extra={(
          <Tooltip title="Export to Excel" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button type="text" size="small" icon={<FileExcelOutlined style={{ color: '#1677ff' }} />} onClick={exportBookingDrilldownExcel} />
          </Tooltip>
        )}
      >
        <Table<BookingInsightRow>
          size="small"
          rowKey={(r) => `${r.bookingId}_${r.projectCode}`}
          dataSource={drilldownRows}
          pagination={{ pageSize: 12, size: 'small' }}
          columns={[
            { title: 'Project', key: 'project', width: 180, render: (_: unknown, r: BookingInsightRow) => <span style={{ fontSize: '11px' }}>{r.projectCode} - {r.projectName}</span> },
            { title: 'Company', dataIndex: 'company', key: 'company', width: 110 },
            { title: 'Milestone Month', dataIndex: 'milestoneMonth', key: 'milestoneMonth', width: 110 },
            { title: 'Booked At', dataIndex: 'bookingMonth', key: 'bookingMonth', width: 90 },
            { title: 'Type', dataIndex: 'bookingType', key: 'bookingType', width: 90, render: (v: 'fixed' | 'anticipated') => <Tag color={v === 'anticipated' ? 'volcano' : 'blue'}>{v === 'anticipated' ? 'Anticipated' : 'Fixed'}</Tag> },
            { title: 'Amount', dataIndex: 'amount', key: 'amount', width: 110, render: (v: number) => <Text style={{ fontSize: '11px', fontWeight: 600 }}>{fmt(v)}</Text> },
            { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true },
          ]}
        />
      </Drawer>

      <Drawer
        title={<span style={{ fontSize: '12px' }}>{unbookedDrilldownTitle || 'Unbooked Milestones'}</span>}
        width={980}
        open={unbookedDrilldownOpen}
        onClose={closeUnbookedDrilldown}
        extra={(
          <Tooltip title="Export to Excel" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button type="text" size="small" icon={<FileExcelOutlined style={{ color: '#1677ff' }} />} onClick={exportUnbookedDrilldownExcel} />
          </Tooltip>
        )}
      >
        <Table<UnbookedInsightRow>
          size="small"
          rowKey="key"
          dataSource={unbookedDrilldownRows}
          pagination={{ pageSize: 12, size: 'small' }}
          columns={[
            { title: 'Project', key: 'project', width: 220, render: (_: unknown, r: UnbookedInsightRow) => <span style={{ fontSize: '11px' }}>{r.projectCode} - {r.projectName}</span> },
            { title: 'Company', dataIndex: 'company', key: 'company', width: 110 },
            { title: 'Owner', dataIndex: 'owner', key: 'owner', width: 110 },
            { title: 'Milestone Month', dataIndex: 'milestoneMonth', key: 'milestoneMonth', width: 110 },
            {
              title: 'Type',
              dataIndex: 'milestoneType',
              key: 'milestoneType',
              width: 100,
              render: (v: 'fixed' | 'anticipated') => <Tag color={v === 'anticipated' ? 'volcano' : 'blue'}>{v === 'anticipated' ? 'Anticipated' : 'Fixed'}</Tag>,
            },
            { title: 'Milestone Amount', dataIndex: 'milestoneAmount', key: 'milestoneAmount', width: 130, render: (v: number) => <Text style={{ fontSize: '11px' }}>{fmt(v)}</Text> },
            { title: 'Booked', dataIndex: 'bookedAmount', key: 'bookedAmount', width: 110, render: (v: number) => <Text style={{ fontSize: '11px' }}>{fmt(v)}</Text> },
            { title: 'Unbooked', dataIndex: 'unbookedAmount', key: 'unbookedAmount', width: 120, render: (v: number) => <Text style={{ fontSize: '11px', fontWeight: 700, color: '#fa8c16' }}>{fmt(v)}</Text> },
          ]}
        />
      </Drawer>
    </>
  );
}

export default FinanceBookingInsightsTab;
