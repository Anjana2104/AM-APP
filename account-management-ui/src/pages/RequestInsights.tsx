import React, { useMemo } from 'react';
import { Card, Row, Col, Statistic, Space, Empty, Progress, Tag, Tabs } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, PauseCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import type { ClientRequest } from './ClientM';

interface RequestInsightsProps {
  requests: ClientRequest[];
}

interface MonthlyData {
  month: string;
  total: number;
  notStarted: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  onHold: number;
  blocked: number;
}

export function RequestInsights({ requests }: RequestInsightsProps) {
  // Parse date string in DD/MM/YYYY format
  const parseDateString = (dateStr: string): Dayjs | null => {
    if (!dateStr) return null;
    try {
      // Handle DD/MM/YYYY format
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) {
        const [day, month, year] = dateStr.split('/');
        return dayjs(`${year}-${month}-${day}`);
      }
      // Try dayjs parsing
      const parsed = dayjs(dateStr);
      return parsed.isValid() ? parsed : null;
    } catch {
      return null;
    }
  };

  // Overall insights (for all requests)
  const insights = useMemo(() => {
    if (!requests || requests.length === 0) {
      return {
        total: 0,
        notStarted: 0,
        inProgress: 0,
        completed: 0,
        cancelled: 0,
        onHold: 0,
        blocked: 0,
      };
    }

    const statusCounts = {
      total: requests.length,
      notStarted: requests.filter(r => r.overallStatus === 'not_started').length,
      inProgress: requests.filter(r => r.overallStatus === 'in_progress').length,
      completed: requests.filter(r => r.overallStatus === 'completed').length,
      cancelled: requests.filter(r => r.overallStatus === 'cancelled').length,
      onHold: requests.filter(r => r.overallStatus === 'on_hold').length,
      blocked: requests.filter(r => r.overallStatus === 'blocked').length,
    };

    return statusCounts;
  }, [requests]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    if (!requests || requests.length === 0) {
      return [];
    }

    const monthMap = new Map<string, MonthlyData>();

    requests.forEach((req) => {
      const reqDate = parseDateString(req.dateRaised);
      if (!reqDate) return;

      const monthKey = reqDate.format('YYYY-MM');
      const monthLabel = reqDate.format('MMM YYYY');

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {
          month: monthLabel,
          total: 0,
          notStarted: 0,
          inProgress: 0,
          completed: 0,
          cancelled: 0,
          onHold: 0,
          blocked: 0,
        });
      }

      const data = monthMap.get(monthKey)!;
      data.total += 1;

      switch (req.overallStatus) {
        case 'not_started':
          data.notStarted += 1;
          break;
        case 'in_progress':
          data.inProgress += 1;
          break;
        case 'completed':
          data.completed += 1;
          break;
        case 'cancelled':
          data.cancelled += 1;
          break;
        case 'on_hold':
          data.onHold += 1;
          break;
        case 'blocked':
          data.blocked += 1;
          break;
      }
    });

    // Sort by month and return
    return Array.from(monthMap.entries())
      .sort(([keyA], [keyB]) => keyB.localeCompare(keyA))
      .map(([, data]) => data);
  }, [requests]);

  if (!requests || requests.length === 0) {
    return <Empty description="No requests data. Add requests to view insights" style={{ marginTop: 48 }} />;
  }

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return '#52C41A';
      case 'in_progress':
        return '#1890FF';
      case 'on_hold':
        return '#FFA940';
      case 'blocked':
        return '#ff4d4f';
      case 'cancelled':
        return '#8c8c8c';
      case 'not_started':
      default:
        return '#d9d9d9';
    }
  };

  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'in_progress':
        return 'In Progress';
      case 'on_hold':
        return 'On Hold';
      case 'not_started':
        return 'Not Started';
      default:
        return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* Tabs for Overall vs Monthly View */}
        <Tabs
          defaultActiveKey="overall"
          items={[
            {
              key: 'overall',
              label: 'Overall Status',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* Summary Statistics */}
                  <Card style={{ borderRadius: '8px' }}>
                    <Row gutter={[16, 16]}>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="Total Requests"
                          value={insights.total}
                          prefix={<FileTextOutlined style={{ color: '#1890FF' }} />}
                          valueStyle={{ color: '#1890FF', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="Not Started"
                          value={insights.notStarted}
                          prefix={<ClockCircleOutlined style={{ color: '#d9d9d9' }} />}
                          valueStyle={{ color: '#d9d9d9', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="In Progress"
                          value={insights.inProgress}
                          prefix={<PauseCircleOutlined style={{ color: '#1890FF' }} />}
                          valueStyle={{ color: '#1890FF', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="Completed"
                          value={insights.completed}
                          prefix={<CheckCircleOutlined style={{ color: '#52C41A' }} />}
                          valueStyle={{ color: '#52C41A', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="On Hold"
                          value={insights.onHold}
                          prefix={<PauseCircleOutlined style={{ color: '#FFA940' }} />}
                          valueStyle={{ color: '#FFA940', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="Blocked"
                          value={insights.blocked}
                          prefix={<ClockCircleOutlined style={{ color: '#ff4d4f' }} />}
                          valueStyle={{ color: '#ff4d4f', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                      <Col xs={24} sm={12} md={6}>
                        <Statistic
                          title="Cancelled"
                          value={insights.cancelled}
                          prefix={<PauseCircleOutlined style={{ color: '#8c8c8c' }} />}
                          valueStyle={{ color: '#8c8c8c', fontSize: '24px', fontWeight: 700 }}
                        />
                      </Col>
                    </Row>
                  </Card>

                  {/* Status Distribution */}
                  <Card title="Request Status Distribution" style={{ borderRadius: '8px' }}>
                    <Row gutter={[16, 16]}>
                      {[
                        { label: 'Not Started', count: insights.notStarted, status: 'not_started' },
                        { label: 'In Progress', count: insights.inProgress, status: 'in_progress' },
                        { label: 'Completed', count: insights.completed, status: 'completed' },
                        { label: 'On Hold', count: insights.onHold, status: 'on_hold' },
                        { label: 'Blocked', count: insights.blocked, status: 'blocked' },
                        { label: 'Cancelled', count: insights.cancelled, status: 'cancelled' },
                      ].map((item) => {
                        const percentage = insights.total > 0 ? Math.round((item.count / insights.total) * 100) : 0;
                        return (
                          <Col xs={24} sm={12} md={6} key={item.status}>
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#001529' }}>
                                  {item.label}
                                </span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: getStatusColor(item.status) }}>
                                  {item.count} ({percentage}%)
                                </span>
                              </div>
                              <Progress
                                percent={percentage}
                                strokeColor={getStatusColor(item.status)}
                                format={() => ''}
                                size="small"
                              />
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  </Card>
                </Space>
              ),
            },
            {
              key: 'monthly',
              label: 'Monthly Breakdown',
              children: (
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>
                    Grouped by <strong>Date Raised</strong>
                  </div>
                  {monthlyData.length === 0 ? (
                    <Empty description="No monthly data available. Ensure requests have a Date Raised value." />
                  ) : (
                    monthlyData.map((month, idx) => (
                      <Card
                        key={idx}
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                            <span>{month.month}</span>
                            <Tag color="blue">Total: {month.total}</Tag>
                          </div>
                        }
                        style={{ borderRadius: '8px' }}
                      >
                        <Row gutter={[16, 16]}>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="Total"
                              value={month.total}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#1890FF' }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="Not Started"
                              value={month.notStarted}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#d9d9d9' }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="In Progress"
                              value={month.inProgress}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#1890FF' }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="Completed"
                              value={month.completed}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#52C41A' }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="On Hold"
                              value={month.onHold}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#FFA940' }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="Blocked"
                              value={month.blocked}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#ff4d4f' }}
                            />
                          </Col>
                          <Col xs={24} sm={12} md={4}>
                            <Statistic
                              title="Cancelled"
                              value={month.cancelled}
                              valueStyle={{ fontSize: '18px', fontWeight: 700, color: '#8c8c8c' }}
                            />
                          </Col>
                        </Row>

                        {/* Monthly progress bars */}
                        <div style={{ marginTop: 20, paddingTop: 20, borderTop: '1px solid #f0f0f0' }}>
                          <Row gutter={[16, 16]}>
                            {[
                              { label: 'Not Started', count: month.notStarted, status: 'not_started' },
                              { label: 'In Progress', count: month.inProgress, status: 'in_progress' },
                              { label: 'Completed', count: month.completed, status: 'completed' },
                              { label: 'On Hold', count: month.onHold, status: 'on_hold' },
                              { label: 'Blocked', count: month.blocked, status: 'blocked' },
                              { label: 'Cancelled', count: month.cancelled, status: 'cancelled' },
                            ].map((item) => {
                              const percentage = month.total > 0 ? Math.round((item.count / month.total) * 100) : 0;
                              return (
                                <Col xs={24} sm={12} md={4} key={item.status}>
                                  <div style={{ marginBottom: 8 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: '#001529' }}>
                                        {item.label}
                                      </span>
                                      <span style={{ fontSize: '11px', fontWeight: 600, color: getStatusColor(item.status) }}>
                                        {item.count} ({percentage}%)
                                      </span>
                                    </div>
                                    <Progress
                                      percent={percentage}
                                      strokeColor={getStatusColor(item.status)}
                                      format={() => ''}
                                      size="small"
                                    />
                                  </div>
                                </Col>
                              );
                            })}
                          </Row>
                        </div>
                      </Card>
                    ))
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Space>
    </div>
  );
}
