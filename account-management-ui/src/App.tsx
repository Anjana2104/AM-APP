import { Layout, Typography, Tooltip } from 'antd';
import { useState } from 'react';
import { AccountFinance } from './pages/AccountFinance';
import ResourceManagement from './pages/ResourceMgmt';
import { ResourceUtilization } from './pages/ResourceUtilization';
import ClientM from './pages/ClientM';
import { DollarOutlined, TeamOutlined, FileTextOutlined, BarChartOutlined, RocketOutlined, ThunderboltOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined } from '@ant-design/icons';
import type { ResourceRow } from './pages/ResourceMgmt';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function App() {
  const [activeModule, setActiveModule] = useState<'home' | 'finance' | 'resources' | 'clientm'>('home');
  const [activeResourceTab, setActiveResourceTab] = useState<'details' | 'utilization' | 'upskilling'>('details');
  const [activeClientMTab, setActiveClientMTab] = useState<'requests' | 'connects'>('requests');
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (activeModule === 'finance') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <div style={{ background: '#001529', color: '#fff', width: '220px', padding: '20px 16px', height: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <DollarOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
              <Title level={4} style={{ color: '#fff', margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>
                Revenue Hub
              </Title>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginLeft: '38px', fontWeight: 500 }}>
              Track.Plan.Grow
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
            <button
              style={{
                background: '#1890FF',
                color: '#fff',
                border: 'none',
                padding: '10px 12px',
                borderRadius: '6px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <FileTextOutlined style={{ fontSize: '16px' }} /> Planned Revenue
            </button>
          </div>
          
          <button 
            onClick={() => setActiveModule('home')}
            style={{ 
              width: '100%', 
              background: '#fff', 
              border: 'none', 
              padding: '10px 12px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              fontWeight: 600, 
              fontSize: '13px',
              color: '#001529',
              marginTop: '16px',
              flexShrink: 0,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            <AccountFinance />
          </div>
        </div>
      </div>
    );
  }

  if (activeModule === 'clientm') {
    const collapsed = sidebarCollapsed;
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <div style={{ background: '#001529', color: '#fff', width: collapsed ? '56px' : '220px', padding: collapsed ? '20px 10px' : '20px 16px', height: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s, padding 0.2s', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            {!collapsed && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <UserOutlined style={{ fontSize: '20px', color: '#FFA940' }} />
                  <Title level={4} style={{ color: '#fff', margin: 0, fontSize: '15px', fontWeight: 700 }}>ClientM</Title>
                </div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginLeft: '30px' }}>Client Management Hub</div>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!collapsed)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {collapsed ? <MenuUnfoldOutlined style={{ fontSize: '16px' }} /> : <MenuFoldOutlined style={{ fontSize: '16px' }} />}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
            <Tooltip title={collapsed ? 'Requests' : ''} placement="right">
              <button
                onClick={() => setActiveClientMTab('requests')}
                style={{
                  background: activeClientMTab === 'requests' ? '#1890FF' : 'rgba(255,255,255,0.08)',
                  color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '6px',
                  textAlign: collapsed ? 'center' : 'left', cursor: 'pointer', fontWeight: 600,
                  fontSize: '13px', display: 'flex', alignItems: 'center',
                  gap: collapsed ? 0 : '10px', transition: 'background 0.3s', justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <FileTextOutlined style={{ fontSize: '16px', flexShrink: 0 }} />
                {!collapsed && ' Requests'}
              </button>
            </Tooltip>
            <Tooltip title={collapsed ? 'Connects' : ''} placement="right">
              <button
                onClick={() => setActiveClientMTab('connects')}
                style={{
                  background: activeClientMTab === 'connects' ? '#1890FF' : 'rgba(255,255,255,0.08)',
                  color: '#fff', border: 'none', padding: '10px 12px', borderRadius: '6px',
                  textAlign: collapsed ? 'center' : 'left', cursor: 'pointer', fontSize: '13px',
                  display: 'flex', alignItems: 'center', gap: collapsed ? 0 : '10px',
                  transition: 'background 0.3s', justifyContent: collapsed ? 'center' : 'flex-start',
                }}
              >
                <TeamOutlined style={{ fontSize: '16px', flexShrink: 0 }} />
                {!collapsed && ' Connects'}
              </button>
            </Tooltip>
          </div>

          <Tooltip title={collapsed ? 'Back to Dashboard' : ''} placement="right">
            <button
              onClick={() => setActiveModule('home')}
              style={{
                width: '100%', background: '#fff', border: 'none', padding: '10px 12px',
                cursor: 'pointer', borderRadius: '6px', fontWeight: 600, fontSize: '13px',
                color: '#001529', marginTop: '16px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start', gap: collapsed ? 0 : '8px',
              }}
            >
              {collapsed ? '←' : '← Back to Dashboard'}
            </button>
          </Tooltip>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5' }}>
            <ClientM activeTab={activeClientMTab} />
          </div>
        </div>
      </div>
    );
  }

  if (activeModule === 'resources') {
    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        <div style={{ background: '#001529', color: '#fff', width: '220px', padding: '20px 16px', height: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ marginBottom: 24, paddingBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <ThunderboltOutlined style={{ fontSize: '24px', color: '#faad14' }} />
              <Title level={4} style={{ color: '#fff', margin: 0, fontSize: '16px', fontWeight: 700, letterSpacing: '0.5px' }}>
                ResourcePulse
              </Title>
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', marginLeft: '38px', fontWeight: 500 }}>
              Engagement Tracker
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
            <button
              onClick={() => setActiveResourceTab('details')}
              style={{
                background: activeResourceTab === 'details' ? '#1890FF' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: 'none',
                padding: '10px 12px',
                borderRadius: '6px',
                textAlign: 'left',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.3s',
              }}
            >
              <FileTextOutlined style={{ fontSize: '16px' }} /> Details
            </button>
            <button
              onClick={() => setActiveResourceTab('utilization')}
              style={{
                background: activeResourceTab === 'utilization' ? '#1890FF' : 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: 'none',
                padding: '10px 12px',
                borderRadius: '6px',
                textAlign: 'left',
                cursor: 'pointer',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                transition: 'background 0.3s',
              }}
            >
              <BarChartOutlined style={{ fontSize: '16px' }} /> Utilization
            </button>
            <button
              disabled
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#fff',
                border: 'none',
                padding: '10px 12px',
                borderRadius: '6px',
                textAlign: 'left',
                cursor: 'not-allowed',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                opacity: 0.5,
              }}
            >
              <RocketOutlined style={{ fontSize: '16px' }} /> Upskilling
            </button>
          </div>
          
          <button 
            onClick={() => setActiveModule('home')}
            style={{ 
              width: '100%', 
              background: '#fff', 
              border: 'none', 
              padding: '10px 12px', 
              cursor: 'pointer', 
              borderRadius: '6px', 
              fontWeight: 600, 
              fontSize: '13px',
              color: '#001529',
              marginTop: '16px',
              flexShrink: 0,
            }}
          >
            ← Back to Dashboard
          </button>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          <div style={{ flex: 1, overflowY: 'auto', background: '#fff' }}>
            {activeResourceTab === 'details' && <ResourceManagement onResourcesChange={setResources} />}
            {activeResourceTab === 'utilization' && <ResourceUtilization resources={resources} onUpdateResources={setResources} />}
          </div>
        </div>
      </div>
    );
  }

  // Home Dashboard
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          Enterprise Account Management
        </Title>
      </Header>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: 8 }}>
              Welcome to Enterprise Account Management
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Manage projects, finances, and resources from one unified platform
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
            {/* FINANCE MANAGEMENT CARD */}
            <div 
              onClick={() => setActiveModule('finance')}
              style={{
                padding: 32,
                background: '#fff',
                borderRadius: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '3px solid #1890FF',
                transition: 'all 0.3s',
                minHeight: 280,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(24,144,255,0.15)';
                e.currentTarget.style.transform = 'translateY(-8px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: '40px',
                    color: '#1890FF',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <DollarOutlined />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>
                    Finance Management
                  </h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>
                    Project Milestones & Revenue Insights
                  </p>
                </div>
              </div>

              <div style={{ background: '#F0F5FF', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: '1.8' }}>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Project Milestones</strong> - Upload and track project revenue
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Revenue Insights</strong> - Quarterly analytics & YoY comparison
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Currency Support</strong> - INR/USD conversion
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Fiscal Year View</strong> - Multi-year data support
                  </li>
                </ul>
              </div>

              <button 
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#1890FF',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = '#0050B3';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = '#1890FF';
                }}
              >
                View Finance Details →
              </button>
            </div>

            {/* RESOURCE MANAGEMENT CARD */}
            <div 
              onClick={() => setActiveModule('resources')}
              style={{
                padding: 32,
                background: '#fff',
                borderRadius: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '3px solid #52C41A',
                transition: 'all 0.3s',
                minHeight: 280,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(82,196,26,0.15)';
                e.currentTarget.style.transform = 'translateY(-8px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: '40px',
                    color: '#52C41A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TeamOutlined />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>
                    Resource Management
                  </h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>
                    Team, Skills & Allocation
                  </p>
                </div>
              </div>

              <div style={{ background: '#F6FFED', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: '1.8' }}>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Resource Details</strong> - ID, Name, Skills, Experience
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Project Allocation</strong> - Current assignment tracking
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Bulk Upload</strong> - Import from Excel template
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Expandable Details</strong> - View full resource profile
                  </li>
                </ul>
              </div>

              <button 
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#52C41A',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = '#389E0D';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = '#52C41A';
                }}
              >
                Manage Resources →
              </button>
            </div>

            {/* CLIENT MANAGEMENT CARD */}
            <div 
              onClick={() => setActiveModule('clientm')}
              style={{
                padding: 32,
                background: '#fff',
                borderRadius: 12,
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '3px solid #FFA940',
                transition: 'all 0.3s',
                minHeight: 280,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 12px 24px rgba(255,169,64,0.15)';
                e.currentTarget.style.transform = 'translateY(-8px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: '40px',
                    color: '#FFA940',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <UserOutlined />
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>
                    Client Management
                  </h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>
                    Requests & Connections
                  </p>
                </div>
              </div>

              <div style={{ background: '#FFFBE6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: '1.8' }}>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Request Management</strong> - Track and manage client requests
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Bulk Upload</strong> - Import requests from Excel template
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Status Tracking</strong> - Monitor request processing status
                  </li>
                  <li style={{ fontSize: '13px', color: '#333' }}>
                    <strong>Connections Hub</strong> - Manage client relationships
                  </li>
                </ul>
              </div>

              <button 
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#FFA940',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '14px',
                  transition: 'all 0.3s'
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.background = '#FF7A45';
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.background = '#FFA940';
                }}
              >
                Manage Clients →
              </button>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
}
