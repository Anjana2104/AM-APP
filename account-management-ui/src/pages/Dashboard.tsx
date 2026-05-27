import React, { useState } from 'react';
import { Card, Row, Col, Space, Button, Statistic, Tag } from 'antd';
import {
  DollarOutlined,
  UsersOutlined,
  ProjectOutlined,
  FileTextOutlined,
  TeamOutlined,
  LineChartOutlined,
  RiseOutlined,
  UserOutlined,
  CreditCardOutlined,
  PhoneOutlined,
  AlertOutlined,
} from '@ant-design/icons';

interface ModuleCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  stats?: { label: string; value: string | number; color?: string }[];
  actionLabel: string;
  onAction: () => void;
  color: string;
}

const ModuleCard: React.FC<ModuleCardProps> = ({
  icon,
  title,
  description,
  stats,
  actionLabel,
  onAction,
  color,
}) => (
  <Card
    hoverable
    style={{
      height: '100%',
      borderTop: `4px solid ${color}`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      borderRadius: '8px',
    }}
  >
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            fontSize: '32px',
            color: color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600, color: '#001529' }}>
            {title}
          </div>
          <div style={{ fontSize: '12px', color: '#8c8c8c', marginTop: 2 }}>
            {description}
          </div>
        </div>
      </div>

      {stats && stats.length > 0 && (
        <div
          style={{
            padding: '12px',
            background: '#fafafa',
            borderRadius: '6px',
            display: 'grid',
            gridTemplateColumns: stats.length > 1 ? '1fr 1fr' : '1fr',
            gap: 12,
          }}
        >
          {stats.map((stat, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: stat.color || color }}>
                {stat.value}
              </div>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        type="primary"
        block
        style={{ background: color, borderColor: color, marginTop: 8 }}
        onClick={onAction}
      >
        {actionLabel}
      </Button>
    </Space>
  </Card>
);

interface DashboardProps {
  onNavigate: (module: string) => void;
  projectData?: any[];
  monthHeaders?: string[];
}

export function Dashboard({ onNavigate, projectData = [], monthHeaders = [] }: DashboardProps) {
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({});

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const calculateRevenue = () => {
    if (!projectData || projectData.length === 0) return 0;
    return projectData.reduce((total, row) => {
      return total + (row.revenue ? row.revenue.reduce((a: number, b: number) => a + b, 0) : 0);
    }, 0);
  };

  const totalRevenue = calculateRevenue();
  const totalProjects = projectData?.length || 0;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
      <div style={{ background: '#001529', padding: '24px' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ color: '#fff', marginBottom: 24 }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, margin: '0 0 8px 0' }}>
              Account Management System
            </h1>
            <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)', margin: 0 }}>
              Integrated platform for managing accounts, clients, resources, and project milestones
            </p>
          </div>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Total Revenue</span>}
                  value={totalRevenue}
                  formatter={(value) => `₹ ${(value as number).toLocaleString('en-IN')}`}
                  valueStyle={{ color: '#FFA940', fontSize: '24px' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Active Projects</span>}
                  value={totalProjects}
                  suffix="Projects"
                  valueStyle={{ color: '#52C41A', fontSize: '24px' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Avg per Project</span>}
                  value={totalProjects > 0 ? Math.round(totalRevenue / totalProjects) : 0}
                  formatter={(value) => `₹ ${(value as number).toLocaleString('en-IN')}`}
                  valueStyle={{ color: '#1890FF', fontSize: '24px' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card style={{ background: 'rgba(255,255,255,0.1)', border: 'none' }}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.65)' }}>Fiscal Years</span>}
                  value={monthHeaders.length > 0 ? Math.ceil(monthHeaders.length / 12) : 0}
                  suffix="Years"
                  valueStyle={{ color: '#FF7875', fontSize: '24px' }}
                />
              </Card>
            </Col>
          </Row>
        </div>
      </div>

      <div style={{ background: '#f5f5f5' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '24px', width: '100%' }}>
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            {/* ACCOUNT MANAGEMENT SECTION */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  cursor: 'pointer',
                  padding: '12px 16px',
                  background: '#E6F7FF',
                  borderRadius: '8px',
                  borderLeft: '4px solid #1890FF',
                }}
                onClick={() => toggleSection('account')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <DollarOutlined style={{ fontSize: '24px', color: '#1890FF' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#001529' }}>
                      Account Management
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>
                      Revenue tracking, invoicing, and financial details
                    </p>
                  </div>
                </div>
                <Tag color="blue">
                  {expandedSections['account'] ? 'Collapse' : 'Expand'}
                </Tag>
              </div>

              {expandedSections['account'] && (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<LineChartOutlined />}
                      title="Revenue Details"
                      description="Monthly and quarterly revenue tracking"
                      stats={[
                        { label: 'Total Revenue', value: `₹ ${Math.round(totalRevenue / 1000)}K` },
                      ]}
                      actionLabel="View Revenue"
                      onAction={() => onNavigate('revenue')}
                      color="#1890FF"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<CreditCardOutlined />}
                      title="Invoicing"
                      description="Monthly invoice generation and tracking"
                      stats={[{ label: 'Pending', value: '0' }]}
                      actionLabel="Manage Invoices"
                      onAction={() => onNavigate('invoicing')}
                      color="#FFA940"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<RiseOutlined />}
                      title="Financial Analytics"
                      description="Trends, forecasts, and insights"
                      stats={[
                        { label: 'Growth', value: '+15%', color: '#52C41A' },
                      ]}
                      actionLabel="View Analytics"
                      onAction={() => onNavigate('analytics')}
                      color="#52C41A"
                    />
                  </Col>
                </Row>
              )}
            </div>

            {/* CLIENT MANAGEMENT SECTION */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  cursor: 'pointer',
                  padding: '12px 16px',
                  background: '#F6FFED',
                  borderRadius: '8px',
                  borderLeft: '4px solid #52C41A',
                }}
                onClick={() => toggleSection('client')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <UsersOutlined style={{ fontSize: '24px', color: '#52C41A' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#001529' }}>
                      Client Management
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>
                      Client profiles, projects, requests, and escalations
                    </p>
                  </div>
                </div>
                <Tag color="green">
                  {expandedSections['client'] ? 'Collapse' : 'Expand'}
                </Tag>
              </div>

              {expandedSections['client'] && (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<UserOutlined />}
                      title="Client Details"
                      description="Client information and profiles"
                      stats={[{ label: 'Total Clients', value: '0' }]}
                      actionLabel="Manage Clients"
                      onAction={() => onNavigate('clients')}
                      color="#52C41A"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<ProjectOutlined />}
                      title="Client Projects"
                      description="Project assignments and tracking"
                      stats={[{ label: 'Active Projects', value: totalProjects }]}
                      actionLabel="View Projects"
                      onAction={() => onNavigate('projects')}
                      color="#1890FF"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<FileTextOutlined />}
                      title="Client Requests"
                      description="Manage and track client requests"
                      stats={[{ label: 'Pending', value: '0' }]}
                      actionLabel="View Requests"
                      onAction={() => onNavigate('requests')}
                      color="#FFA940"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<PhoneOutlined />}
                      title="Client Contacts"
                      description="Contact details and communications"
                      stats={[{ label: 'Contacts', value: '0' }]}
                      actionLabel="Manage Contacts"
                      onAction={() => onNavigate('contacts')}
                      color="#13C2C2"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<AlertOutlined />}
                      title="Client Escalations"
                      description="Track and manage escalations"
                      stats={[{ label: 'Active', value: '0' }]}
                      actionLabel="View Escalations"
                      onAction={() => onNavigate('escalations')}
                      color="#FF7875"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<CreditCardOutlined />}
                      title="Rate Cards"
                      description="Client billing rates and pricing"
                      stats={[{ label: 'Active', value: '0' }]}
                      actionLabel="Manage Rates"
                      onAction={() => onNavigate('rates')}
                      color="#722ED1"
                    />
                  </Col>
                </Row>
              )}
            </div>

            {/* RESOURCE MANAGEMENT SECTION */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  cursor: 'pointer',
                  padding: '12px 16px',
                  background: '#FFF7E6',
                  borderRadius: '8px',
                  borderLeft: '4px solid #FFA940',
                }}
                onClick={() => toggleSection('resource')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <TeamOutlined style={{ fontSize: '24px', color: '#FFA940' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#001529' }}>
                      Resource Management
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>
                      Team members, bench allocation, and project assignments
                    </p>
                  </div>
                </div>
                <Tag color="orange">
                  {expandedSections['resource'] ? 'Collapse' : 'Expand'}
                </Tag>
              </div>

              {expandedSections['resource'] && (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<TeamOutlined />}
                      title="Resource Details"
                      description="Team members and skills"
                      stats={[{ label: 'Total Resources', value: '0' }]}
                      actionLabel="Manage Resources"
                      onAction={() => onNavigate('resources')}
                      color="#FFA940"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<UserOutlined />}
                      title="Bench Allocation"
                      description="Available and bench resources"
                      stats={[{ label: 'On Bench', value: '0' }]}
                      actionLabel="View Bench"
                      onAction={() => onNavigate('bench')}
                      color="#FF7875"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<ProjectOutlined />}
                      title="Resource Mapping"
                      description="Resource to project assignments"
                      stats={[{ label: 'Assigned', value: '0' }]}
                      actionLabel="View Mapping"
                      onAction={() => onNavigate('mapping')}
                      color="#1890FF"
                    />
                  </Col>
                </Row>
              )}
            </div>

            {/* PROJECT MANAGEMENT SECTION */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 16,
                  cursor: 'pointer',
                  padding: '12px 16px',
                  background: '#F9F0FF',
                  borderRadius: '8px',
                  borderLeft: '4px solid #722ED1',
                }}
                onClick={() => toggleSection('project')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <ProjectOutlined style={{ fontSize: '24px', color: '#722ED1' }} />
                  <div>
                    <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#001529' }}>
                      Project Management
                    </h2>
                    <p style={{ margin: 0, fontSize: '12px', color: '#8c8c8c' }}>
                      Project milestones, revenue tracking, and delivery
                    </p>
                  </div>
                </div>
                <Tag color="purple">
                  {expandedSections['project'] ? 'Collapse' : 'Expand'}
                </Tag>
              </div>

              {expandedSections['project'] && (
                <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<ProjectOutlined />}
                      title="Project Milestones"
                      description="Project details and revenue"
                      stats={[{ label: 'Total Projects', value: totalProjects }]}
                      actionLabel="View Milestones"
                      onAction={() => onNavigate('milestones')}
                      color="#722ED1"
                    />
                  </Col>
                  <Col xs={24} sm={12} md={8}>
                    <ModuleCard
                      icon={<LineChartOutlined />}
                      title="Revenue Insights"
                      description="Quarterly and annual analytics"
                      stats={[{ label: 'Fiscal Years', value: Math.ceil(monthHeaders.length / 12) }]}
                      actionLabel="View Insights"
                      onAction={() => onNavigate('insights')}
                      color="#1890FF"
                    />
                  </Col>
                </Row>
              )}
            </div>
          </Space>
        </div>
      </div>
    </div>
  );
}
