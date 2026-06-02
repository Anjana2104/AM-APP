import { Layout, Typography, Tooltip } from 'antd';
import { useState, useEffect } from 'react';
import { AccountFinance } from './pages/AccountFinance';
import ResourceManagement from './pages/ResourceMgmt';
import { ResourceUtilization } from './pages/ResourceUtilization';
import ClientM from './pages/ClientM';
import {
  DollarOutlined, TeamOutlined, FileTextOutlined, BarChartOutlined,
  RocketOutlined, ThunderboltOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, DownOutlined, RightOutlined,
  EyeOutlined, BankOutlined, HomeOutlined,
} from '@ant-design/icons';
import type { ResourceRow } from './pages/ResourceMgmt';

type EAMPage =
  | 'executive_revenue'
  | 'executive_invoicing'
  | 'resources_info'
  | 'resources_utilization'
  | 'resources_upskilling'
  | 'clientmgmt_requests'
  | 'clientmgmt_connects';

type EAMSection = 'executive' | 'resources' | 'clientmgmt';

const { Header, Content } = Layout;
const { Title } = Typography;

const PAGE_SECTION_MAP: Record<EAMPage, EAMSection> = {
  executive_revenue: 'executive',
  executive_invoicing: 'executive',
  resources_info: 'resources',
  resources_utilization: 'resources',
  resources_upskilling: 'resources',
  clientmgmt_requests: 'clientmgmt',
  clientmgmt_connects: 'clientmgmt',
};

const ALL_PAGES = Object.keys(PAGE_SECTION_MAP) as EAMPage[];

function parseHash(): { module: 'home' | 'eam'; page: EAMPage } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === '' || hash === 'home') return { module: 'home', page: 'executive_revenue' };
  if (hash.startsWith('eam/')) {
    const page = hash.slice(4) as EAMPage;
    if (ALL_PAGES.includes(page)) return { module: 'eam', page };
  }
  return { module: 'home', page: 'executive_revenue' };
}

function toHash(module: 'home' | 'eam', page?: EAMPage) {
  return module === 'home' ? '#/home' : `#/eam/${page}`;
}

export default function App() {
  const initial = parseHash();
  const [activeModule, setActiveModule] = useState<'home' | 'eam'>(initial.module);
  const [activePage, setActivePage] = useState<EAMPage>(initial.page);
  const [expandedSections, setExpandedSections] = useState<Set<EAMSection>>(
    new Set(initial.module === 'eam' ? [PAGE_SECTION_MAP[initial.page]] : ['executive'])
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resources, setResources] = useState<ResourceRow[]>([]);

  // Sync URL → state when user navigates with browser back/forward or opens bookmarked hash
  useEffect(() => {
    const onHashChange = () => {
      const { module, page } = parseHash();
      setActiveModule(module);
      setActivePage(page);
      if (module === 'eam') setExpandedSections(prev => new Set([...prev, PAGE_SECTION_MAP[page]]));
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Sync state → URL
  useEffect(() => {
    const target = toHash(activeModule, activePage);
    if (window.location.hash !== target) window.location.hash = target.slice(1);
  }, [activeModule, activePage]);

  const navigateTo = (page: EAMPage, section: EAMSection) => {
    setActivePage(page);
    setExpandedSections(prev => new Set([...prev, section]));
    setActiveModule('eam');
  };

  const goHome = () => setActiveModule('home');

  const toggleSection = (section: EAMSection) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  const subBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? '#1890FF' : 'transparent',
    color: active ? '#fff' : 'rgba(255,255,255,0.7)',
    border: 'none',
    padding: '7px 10px 7px 30px',
    borderRadius: '5px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    transition: 'background 0.2s',
  });

  const groupBtnStyle = (active: boolean): React.CSSProperties => ({
    background: active ? 'rgba(24,144,255,0.18)' : 'transparent',
    color: '#fff',
    border: 'none',
    padding: '9px 10px',
    borderRadius: '6px',
    textAlign: 'left',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 600,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    transition: 'background 0.2s',
  });

  if (activeModule === 'eam') {
    const collapsed = sidebarCollapsed;
    const isExp = (s: EAMSection) => expandedSections.has(s);

    const renderContent = () => {
      switch (activePage) {
        case 'executive_revenue':     return <AccountFinance />;
        case 'executive_invoicing':   return <div style={{ padding: 40, textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: '16px' }}>Invoicing Details — Coming Soon</div>;
        case 'resources_info':        return <ResourceManagement onResourcesChange={setResources} />;
        case 'resources_utilization': return <ResourceUtilization resources={resources} onUpdateResources={setResources} />;
        case 'resources_upskilling':  return <div style={{ padding: 40, textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: '16px' }}>Upskilling — Coming Soon</div>;
        case 'clientmgmt_requests':   return <ClientM activeTab="requests" />;
        case 'clientmgmt_connects':   return <ClientM activeTab="connects" />;
        default: return null;
      }
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* ─── Left Sidebar ───────────────────────────────────── */}
        <div style={{ background: '#001529', color: '#fff', width: collapsed ? '54px' : '230px', height: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0, transition: 'width 0.2s', overflow: 'hidden' }}>

          {/* Logo / Title */}
          <div style={{ padding: collapsed ? '14px 10px' : '14px 14px', borderBottom: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'space-between', gap: 8, flexShrink: 0 }}>
            {!collapsed && (
              <div style={{ overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <EyeOutlined style={{ fontSize: '17px', color: '#40A9FF', flexShrink: 0 }} />
                  <span style={{ fontWeight: 700, fontSize: '15px', whiteSpace: 'nowrap', color: '#fff' }}>EAM</span>
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', marginTop: 2, whiteSpace: 'nowrap', marginLeft: 25 }}>Enterprise Account Management</div>
              </div>
            )}
            <button onClick={() => setSidebarCollapsed(!collapsed)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {collapsed ? <MenuUnfoldOutlined style={{ fontSize: '14px' }} /> : <MenuFoldOutlined style={{ fontSize: '14px' }} />}
            </button>
          </div>

          {/* Nav items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '8px 6px' : '8px 8px' }}>
            {collapsed ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { s: null, icon: <HomeOutlined />, label: 'Home', page: null },
                  { s: 'executive' as EAMSection, icon: <DollarOutlined />, label: 'Executive View', page: 'executive_revenue' as EAMPage },
                  { s: 'resources' as EAMSection, icon: <ThunderboltOutlined />, label: 'Resource Details', page: 'resources_info' as EAMPage },
                  { s: 'clientmgmt' as EAMSection, icon: <UserOutlined />, label: 'Client Management', page: 'clientmgmt_requests' as EAMPage },
                ].map(({ s, icon, label, page }) => (
                  <Tooltip key={label} title={label} placement="right">
                    <a
                      href={page ? toHash('eam', page) : toHash('home')}
                      onClick={e => { e.preventDefault(); if (!s) goHome(); else navigateTo(page!, s); }}
                      style={{ background: s && activePage.startsWith(s === 'clientmgmt' ? 'clientmgmt' : s) ? 'rgba(24,144,255,0.28)' : 'transparent', color: '#fff', textDecoration: 'none', padding: '10px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '16px' }}
                    >
                      {icon}
                    </a>
                  </Tooltip>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {/* Home */}
                <a href={toHash('home')} onClick={e => { e.preventDefault(); goHome(); }} style={{ ...groupBtnStyle(false), textDecoration: 'none' }}>
                  <HomeOutlined style={{ fontSize: '13px', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Home</span>
                </a>

                {/* Executive View */}
                <button onClick={() => toggleSection('executive')} style={groupBtnStyle(activePage.startsWith('executive'))}>
                  <DollarOutlined style={{ fontSize: '13px', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Executive View</span>
                  {isExp('executive') ? <DownOutlined style={{ fontSize: '9px' }} /> : <RightOutlined style={{ fontSize: '9px' }} />}
                </button>
                {isExp('executive') && (
                  <div style={{ marginBottom: 2 }}>
                    <a href={toHash('eam', 'executive_revenue')} onClick={e => { e.preventDefault(); setActivePage('executive_revenue'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'executive_revenue'), textDecoration: 'none' }}>
                      <DollarOutlined style={{ fontSize: '11px' }} /> Revenue Details
                    </a>
                    <a href={toHash('eam', 'executive_invoicing')} onClick={e => { e.preventDefault(); setActivePage('executive_invoicing'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'executive_invoicing'), textDecoration: 'none' }}>
                      <BankOutlined style={{ fontSize: '11px' }} /> Invoicing Details
                    </a>
                  </div>
                )}

                {/* Resource Details */}
                <button onClick={() => toggleSection('resources')} style={groupBtnStyle(activePage.startsWith('resources'))}>
                  <ThunderboltOutlined style={{ fontSize: '13px', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Resource Details</span>
                  {isExp('resources') ? <DownOutlined style={{ fontSize: '9px' }} /> : <RightOutlined style={{ fontSize: '9px' }} />}
                </button>
                {isExp('resources') && (
                  <div style={{ marginBottom: 2 }}>
                    <a href={toHash('eam', 'resources_info')} onClick={e => { e.preventDefault(); setActivePage('resources_info'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'resources_info'), textDecoration: 'none' }}>
                      <FileTextOutlined style={{ fontSize: '11px' }} /> Information
                    </a>
                    <a href={toHash('eam', 'resources_utilization')} onClick={e => { e.preventDefault(); setActivePage('resources_utilization'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'resources_utilization'), textDecoration: 'none' }}>
                      <BarChartOutlined style={{ fontSize: '11px' }} /> Utilization
                    </a>
                    <a href={toHash('eam', 'resources_upskilling')} onClick={e => { e.preventDefault(); setActivePage('resources_upskilling'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'resources_upskilling'), textDecoration: 'none' }}>
                      <RocketOutlined style={{ fontSize: '11px' }} /> Upskilling
                    </a>
                  </div>
                )}

                {/* Client Management */}
                <button onClick={() => toggleSection('clientmgmt')} style={groupBtnStyle(activePage.startsWith('clientmgmt'))}>
                  <UserOutlined style={{ fontSize: '13px', flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>Client Management</span>
                  {isExp('clientmgmt') ? <DownOutlined style={{ fontSize: '9px' }} /> : <RightOutlined style={{ fontSize: '9px' }} />}
                </button>
                {isExp('clientmgmt') && (
                  <div style={{ marginBottom: 2 }}>
                    <a href={toHash('eam', 'clientmgmt_requests')} onClick={e => { e.preventDefault(); setActivePage('clientmgmt_requests'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'clientmgmt_requests'), textDecoration: 'none' }}>
                      <FileTextOutlined style={{ fontSize: '11px' }} /> Requests
                    </a>
                    <a href={toHash('eam', 'clientmgmt_connects')} onClick={e => { e.preventDefault(); setActivePage('clientmgmt_connects'); setActiveModule('eam'); }} style={{ ...subBtnStyle(activePage === 'clientmgmt_connects'), textDecoration: 'none' }}>
                      <TeamOutlined style={{ fontSize: '11px' }} /> Connects
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>

        {/* ─── Main Content ────────────────────────────────────── */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  // ── Home Dashboard ────────────────────────────────────────────
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header style={{ background: '#001529', display: 'flex', alignItems: 'center' }}>
        <Title level={4} style={{ color: '#fff', margin: 0 }}>Enterprise Account Management</Title>
      </Header>
      <Content style={{ padding: 24, background: '#f5f5f5' }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ marginBottom: 40 }}>
            <h1 style={{ fontSize: '32px', fontWeight: 700, marginBottom: 8 }}>Welcome to Enterprise Account Management</h1>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>Manage projects, finances, and resources from one unified platform</p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: 24 }}>

            {/* FINANCE */}
            <div onClick={() => navigateTo('executive_revenue', 'executive')}
              style={{ padding: 32, background: '#fff', borderRadius: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '3px solid #1890FF', transition: 'all 0.3s', minHeight: 280 }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 24px rgba(24,144,255,0.15)'; e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: '40px', color: '#1890FF' }}><DollarOutlined /></div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>Finance Management</h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>Project Milestones & Revenue Insights</p>
                </div>
              </div>
              <div style={{ background: '#F0F5FF', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: '1.8' }}>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Project Milestones</strong> - Upload and track project revenue</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Revenue Insights</strong> - Quarterly analytics & YoY comparison</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Currency Support</strong> - INR/USD conversion</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Fiscal Year View</strong> - Multi-year data support</li>
                </ul>
              </div>
              <button style={{ width: '100%', padding: '12px 16px', background: '#1890FF', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#0050B3'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#1890FF'; }}>
                View Finance Details →
              </button>
            </div>

            {/* RESOURCES */}
            <div onClick={() => navigateTo('resources_info', 'resources')}
              style={{ padding: 32, background: '#fff', borderRadius: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '3px solid #52C41A', transition: 'all 0.3s', minHeight: 280 }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 24px rgba(82,196,26,0.15)'; e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: '40px', color: '#52C41A' }}><TeamOutlined /></div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>Resource Management</h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>Team, Skills & Allocation</p>
                </div>
              </div>
              <div style={{ background: '#F6FFED', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: '1.8' }}>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Resource Details</strong> - ID, Name, Skills, Experience</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Project Allocation</strong> - Current assignment tracking</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Bulk Upload</strong> - Import from Excel template</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Expandable Details</strong> - View full resource profile</li>
                </ul>
              </div>
              <button style={{ width: '100%', padding: '12px 16px', background: '#52C41A', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#389E0D'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#52C41A'; }}>
                Manage Resources →
              </button>
            </div>

            {/* CLIENT MANAGEMENT */}
            <div onClick={() => navigateTo('clientmgmt_requests', 'clientmgmt')}
              style={{ padding: 32, background: '#fff', borderRadius: 12, cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '3px solid #FFA940', transition: 'all 0.3s', minHeight: 280 }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 24px rgba(255,169,64,0.15)'; e.currentTarget.style.transform = 'translateY(-8px)'; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                <div style={{ fontSize: '40px', color: '#FFA940' }}><UserOutlined /></div>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: '22px', fontWeight: 700, margin: 0, color: '#001529' }}>Client Management</h2>
                  <p style={{ fontSize: '13px', color: '#666', margin: '4px 0 0 0' }}>Requests & Connections</p>
                </div>
              </div>
              <div style={{ background: '#FFFBE6', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <ul style={{ margin: 0, paddingLeft: 16, lineHeight: '1.8' }}>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Request Management</strong> - Track and manage client requests</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Bulk Upload</strong> - Import requests from Excel template</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Status Tracking</strong> - Monitor request processing status</li>
                  <li style={{ fontSize: '13px', color: '#333' }}><strong>Connections Hub</strong> - Manage client relationships</li>
                </ul>
              </div>
              <button style={{ width: '100%', padding: '12px 16px', background: '#FFA940', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#FF7A45'; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#FFA940'; }}>
                Manage Clients →
              </button>
            </div>

          </div>
        </div>
      </Content>
    </Layout>
  );
}
