import { Layout, Typography } from 'antd';
import { useState } from 'react';
import { AccountFinance } from './pages/AccountFinance';
import ResourceManagement from './pages/ResourceMgmt';
import { DollarOutlined, TeamOutlined } from '@ant-design/icons';

const { Header, Content } = Layout;
const { Title } = Typography;

export default function App() {
  const [activeModule, setActiveModule] = useState<'home' | 'finance' | 'resources'>('home');

  if (activeModule === 'finance') {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#001529', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            Account Management System
          </Title>
          <button 
            onClick={() => setActiveModule('home')}
            style={{ background: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', fontWeight: 600 }}
          >
            ← Back to Dashboard
          </button>
        </Header>
        <Content style={{ padding: 0 }}>
          <AccountFinance />
        </Content>
      </Layout>
    );
  }

  if (activeModule === 'resources') {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#001529', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Title level={4} style={{ color: '#fff', margin: 0 }}>
            Account Management System
          </Title>
          <button 
            onClick={() => setActiveModule('home')}
            style={{ background: '#fff', border: 'none', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', fontWeight: 600 }}
          >
            ← Back to Dashboard
          </button>
        </Header>
        <Content style={{ padding: 0 }}>
          <ResourceManagement />
        </Content>
      </Layout>
    );
  }

  // Home Dashboard
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>
          Account Management System
        </Title>
      </Header>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: 8 }}>
              Welcome to Account Management Dashboard
            </h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Manage projects, finances, and resources from one unified platform
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>
            {/* ACCOUNT FINANCE CARD */}
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
                    Account Finance Management
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
                Open Account Finance →
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

            {/* PLACEHOLDER FOR CLIENT MANAGEMENT */}
            <div 
              style={{
                padding: 32,
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                border: '3px solid #FFA940',
                minHeight: 280,
                opacity: 0.5,
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
                  👥
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>
                    Client Management
                  </h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>
                    Coming Soon
                  </p>
                </div>
              </div>

              <div style={{ background: '#FFFBE6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <p style={{ margin: 0, fontSize: '13px', color: '#666' }}>
                  Client profiles, projects, requests, and communication management coming in the next release.
                </p>
              </div>

              <button 
                disabled
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: '#FFA940',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'not-allowed',
                  fontWeight: 600,
                  fontSize: '14px',
                  opacity: 0.5,
                }}
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
}
