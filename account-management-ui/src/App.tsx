import { Tooltip } from 'antd';
import { useState, useEffect } from 'react';
import { FinanceManagement } from './pages/FinanceManagement';
import { InvoiceManagement } from './pages/InvoiceManagement';
import { FinanceSummary } from './pages/FinanceSummary';
import { AccountSummary } from './pages/AccountSummary';
import ResourceInformation from './pages/ResourceInformation';
import { EngagementMapping } from './pages/EngagementMapping';
import RequestManagement from './pages/RequestManagement';
import { RateCard } from './pages/RateCard';
import { TeamHierarchy } from './pages/TeamHierarchy';
import { InternalProcess } from './pages/InternalProcess';
import { Configuration } from './pages/Configuration';
import { CodeGuide } from './pages/CodeGuide';
import {
  DollarOutlined, TeamOutlined, FileTextOutlined, BarChartOutlined,
  RocketOutlined, ThunderboltOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, DownOutlined, RightOutlined,
  EyeOutlined, BankOutlined, HomeOutlined, InfoCircleOutlined,
  CreditCardOutlined, ApartmentOutlined, NodeIndexOutlined, SettingOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ResourceRow } from './pages/ResourceInformation';

type EAMPage =
  | 'account_summary'
  | 'executive_summary'
  | 'executive_revenue'
  | 'executive_invoicing'
  | 'resources_info'
  | 'resources_utilization'
  | 'resources_upskilling'
  | 'clientmgmt_requests'
  | 'clientmgmt_connects'
  | 'information_ratecard'
  | 'information_teamhierarchy'
  | 'information_process'
  | 'information_codeguide'
  | 'configuration';

type EAMSection = 'account' | 'executive' | 'resources' | 'clientmgmt' | 'information' | 'configuration';


const PAGE_SECTION_MAP: Record<EAMPage, EAMSection> = {
  account_summary: 'account',
  executive_summary: 'executive',
  executive_revenue: 'executive',
  executive_invoicing: 'executive',
  resources_info: 'resources',
  resources_utilization: 'resources',
  resources_upskilling: 'resources',
  clientmgmt_requests: 'clientmgmt',
  clientmgmt_connects: 'clientmgmt',
  information_ratecard: 'information',
  information_teamhierarchy: 'information',
  information_process: 'information',
  information_codeguide: 'information',
  configuration: 'configuration',
};

const ALL_PAGES = Object.keys(PAGE_SECTION_MAP) as EAMPage[];

function parseHash(): { module: 'home' | 'eam'; page: EAMPage } {
  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash === '' || hash === 'home') return { module: 'home', page: 'account_summary' };
  if (hash.startsWith('eam/')) {
    const page = hash.slice(4) as EAMPage;
    if (ALL_PAGES.includes(page)) return { module: 'eam', page };
  }
  return { module: 'home', page: 'account_summary' };
}

function toHash(module: 'home' | 'eam', page?: EAMPage) {
  return module === 'home' ? '#/home' : `#/eam/${page}`;
}

/* ─── Sidebar sub-components ──────────────────────────────────── */
function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '10px 12px 4px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.8px', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', userSelect: 'none' }}>
      {label}
    </div>
  );
}

function SideNavItem({ icon, label, active, onClick, showArrow }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; showArrow?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px',
        background: active ? 'rgba(59,130,246,0.16)' : 'transparent',
        border: 'none', borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
        borderRadius: active ? '0 7px 7px 0' : '7px',
        color: active ? '#93c5fd' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 600 : 400,
        transition: 'all 0.15s', textAlign: 'left',
      }}
    >
      <span style={{ width: 26, height: 26, borderRadius: 6, background: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {showArrow && <RightOutlined style={{ fontSize: '8px', opacity: 0.45 }} />}
    </button>
  );
}

function SideNavGroup({ icon, label, active, expanded, onToggle, children }: { icon: React.ReactNode; label: string; active: boolean; expanded: boolean; onToggle: () => void; children?: React.ReactNode }) {
  return (
    <>
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '7px 10px',
          background: active ? 'rgba(59,130,246,0.16)' : 'transparent',
          border: 'none', borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
          borderRadius: active ? '0 7px 7px 0' : '7px',
          color: active ? '#93c5fd' : 'rgba(255,255,255,0.7)',
          cursor: 'pointer', fontSize: '12.5px', fontWeight: active ? 600 : 400,
          transition: 'all 0.15s', textAlign: 'left',
        }}
      >
        <span style={{ width: 26, height: 26, borderRadius: 6, background: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>{icon}</span>
        <span style={{ flex: 1 }}>{label}</span>
        {children && (expanded ? <DownOutlined style={{ fontSize: '8px', opacity: 0.5 }} /> : <RightOutlined style={{ fontSize: '8px', opacity: 0.5 }} />)}
      </button>
      {expanded && children && (
        <div style={{ marginLeft: 14, marginBottom: 1 }}>
          {children}
        </div>
      )}
    </>
  );
}

function SubNavItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7, width: '100%',
        padding: '6px 8px 6px 12px',
        background: active ? 'rgba(59,130,246,0.14)' : 'transparent',
        border: 'none', borderRadius: 5,
        color: active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
        cursor: 'pointer', fontSize: '11.5px', fontWeight: active ? 600 : 400,
        transition: 'all 0.15s', textAlign: 'left',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#3b82f6' : 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
      {label}
    </button>
  );
}

export default function App() {
  const initial = parseHash();
  const [activeModule, setActiveModule] = useState<'home' | 'eam'>(initial.module);
  const [activePage, setActivePage] = useState<EAMPage>(initial.page);
  const [expandedSections, setExpandedSections] = useState<Set<EAMSection>>(new Set<EAMSection>());
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

  if (activeModule === 'eam') {
    const collapsed = sidebarCollapsed;
    const isExp = (s: EAMSection) => expandedSections.has(s);

    const renderContent = () => {
      switch (activePage) {
        case 'account_summary':      return <AccountSummary onNavigate={page => navigateTo(page as EAMPage, PAGE_SECTION_MAP[page as EAMPage])} />;
        case 'executive_summary':    return <FinanceSummary onNavigate={page => navigateTo(page, 'executive')} />;
        case 'executive_revenue':     return <FinanceManagement />;
        case 'executive_invoicing':   return <InvoiceManagement />;
        case 'resources_info':        return <ResourceInformation onResourcesChange={setResources} />;
        case 'resources_utilization': return <EngagementMapping resources={resources} onUpdateResources={setResources} />;
        case 'resources_upskilling':  return <div style={{ padding: 40, textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: '16px' }}>Upskilling — Coming Soon</div>;
        case 'clientmgmt_requests':   return <RequestManagement activeTab="requests" />;
        case 'clientmgmt_connects':   return <InternalProcess />;
        case 'information_ratecard':      return <RateCard />;
        case 'information_teamhierarchy': return <TeamHierarchy />;
        case 'information_codeguide':        return <CodeGuide />;
        case 'information_process':       return <div style={{ padding: 40, textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: '16px' }}>Client Process — Coming Soon</div>;
        case 'configuration':             return <Configuration />;
        default: return null;
      }
    };

    return (
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        {/* ─── Left Sidebar ───────────────────────────────────── */}
        <div style={{
          background: '#0d1b2e',
          color: '#fff',
          width: collapsed ? '60px' : '248px',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          transition: 'width 0.22s cubic-bezier(.4,0,.2,1)',
          overflow: 'hidden',
        }}>

          {/* ── Top header row: Home icon + Account + collapse ── */}
          <div style={{ padding: collapsed ? '12px 6px' : '12px 12px', display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            {collapsed ? (
              <Tooltip title="Home" placement="right">
                <button onClick={goHome} style={{ background: activeModule === 'home' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <HomeOutlined style={{ fontSize: '17px' }} />
                </button>
              </Tooltip>
            ) : (
              <>
                {/* Home icon — clickable */}
                <button onClick={goHome} style={{ background: activeModule === 'home' ? 'rgba(59,130,246,0.18)' : 'transparent', border: 'none', color: activeModule === 'home' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '6px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  <HomeOutlined style={{ fontSize: '15px' }} />
                </button>

                {/* ZS Associates account */}
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 7, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.07)', minWidth: 0 }}>
                  <div style={{ width: 22, height: 22, borderRadius: 5, background: 'rgba(59,130,246,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <BankOutlined style={{ fontSize: '11px', color: '#60a5fa' }} />
                  </div>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>ZS Associates</span>
                  <DownOutlined style={{ fontSize: '8px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
                </div>

                {/* Collapse toggle */}
                <button onClick={() => setSidebarCollapsed(true)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.28)', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                  <MenuFoldOutlined style={{ fontSize: '12px' }} />
                </button>
              </>
            )}
          </div>

          {/* ── Nav items ────────────────────── */}
          <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '4px 6px' : '2px 8px', scrollbarWidth: 'none' }}>

            {collapsed ? (
              /* Collapsed: icons only */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {[
                  { icon: <EyeOutlined />, label: 'Account Summary', action: () => navigateTo('account_summary', 'account'), active: activePage === 'account_summary' },
                  { icon: <DollarOutlined />, label: 'Finance Management', action: () => navigateTo('executive_summary', 'executive'), active: activePage.startsWith('executive') },
                  { icon: <ThunderboltOutlined />, label: 'Resources', action: () => navigateTo('resources_info', 'resources'), active: activePage.startsWith('resources') },
                  { icon: <UserOutlined />, label: 'Request Management', action: () => navigateTo('clientmgmt_requests', 'clientmgmt'), active: activePage.startsWith('clientmgmt') },
                  { icon: <NodeIndexOutlined />, label: 'Internal Process', action: () => navigateTo('clientmgmt_connects', 'clientmgmt'), active: activePage === 'clientmgmt_connects' },
                  { icon: <SettingOutlined />, label: 'Configuration', action: () => navigateTo('configuration', 'configuration'), active: activePage === 'configuration' },
                  { icon: <InfoCircleOutlined />, label: 'Knowledge Base', action: () => navigateTo('information_ratecard', 'information'), active: activePage.startsWith('information') },
                ].map(item => (
                  <Tooltip key={item.label} title={item.label} placement="right">
                    <button onClick={item.action} style={{ background: item.active ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: item.active ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                      {item.icon}
                    </button>
                  </Tooltip>
                ))}
                <div style={{ margin: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
                <Tooltip title="Expand" placement="right">
                  <button onClick={() => setSidebarCollapsed(false)} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <MenuUnfoldOutlined style={{ fontSize: '13px' }} />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

                {/* ── ACCOUNT SUMMARY ── */}
                <SideNavItem
                  icon={<EyeOutlined />} label="Account Summary"
                  active={activePage === 'account_summary'}
                  onClick={() => navigateTo('account_summary', 'account')}
                  showArrow
                />

                {/* ── ACCOUNT OPERATIONS section ── */}
                <SectionLabel label="Account Operations" />

                {/* Finance */}
                <SideNavGroup
                  icon={<DollarOutlined />} label="Finance"
                  active={activePage.startsWith('executive')}
                  expanded={isExp('executive')}
                  onToggle={() => toggleSection('executive')}
                >
                  <SubNavItem label="Summary" active={activePage === 'executive_summary'} onClick={() => { setActivePage('executive_summary'); setActiveModule('eam'); }} />
                  <SubNavItem label="Revenue Details" active={activePage === 'executive_revenue'} onClick={() => { setActivePage('executive_revenue'); setActiveModule('eam'); }} />
                  <SubNavItem label="Invoicing Details" active={activePage === 'executive_invoicing'} onClick={() => { setActivePage('executive_invoicing'); setActiveModule('eam'); }} />
                </SideNavGroup>

                {/* Resources */}
                <SideNavGroup
                  icon={<ThunderboltOutlined />} label="Resources"
                  active={activePage.startsWith('resources')}
                  expanded={isExp('resources')}
                  onToggle={() => toggleSection('resources')}
                >
                  <SubNavItem label="Information" active={activePage === 'resources_info'} onClick={() => { setActivePage('resources_info'); setActiveModule('eam'); }} />
                  <SubNavItem label="Engagement Mapping" active={activePage === 'resources_utilization'} onClick={() => { setActivePage('resources_utilization'); setActiveModule('eam'); }} />
                  <SubNavItem label="Upskilling" active={activePage === 'resources_upskilling'} onClick={() => { setActivePage('resources_upskilling'); setActiveModule('eam'); }} />
                </SideNavGroup>

                {/* Client Requests */}
                <SideNavGroup
                  icon={<UserOutlined />} label="Client Requests"
                  active={activePage === 'clientmgmt_requests'}
                  expanded={isExp('clientmgmt')}
                  onToggle={() => toggleSection('clientmgmt')}
                >
                  <SubNavItem label="Overview" active={activePage === 'clientmgmt_requests'} onClick={() => { setActivePage('clientmgmt_requests'); setActiveModule('eam'); }} />
                </SideNavGroup>

                {/* Internal Process */}
                <SideNavItem
                  icon={<NodeIndexOutlined />} label="Internal Process"
                  active={activePage === 'clientmgmt_connects'}
                  onClick={() => navigateTo('clientmgmt_connects', 'clientmgmt')}
                  showArrow
                />

                {/* ── SETTINGS & CONFIGURATION section ── */}
                <SectionLabel label="Settings & Configuration" />

                {/* Configuration */}
                <SideNavGroup
                  icon={<SettingOutlined />} label="Configuration"
                  active={activePage === 'configuration'}
                  expanded={isExp('configuration')}
                  onToggle={() => { navigateTo('configuration', 'configuration'); toggleSection('configuration'); }}
                />

                {/* Knowledge Base */}
                <SideNavGroup
                  icon={<InfoCircleOutlined />} label="Knowledge Base"
                  active={activePage.startsWith('information')}
                  expanded={isExp('information')}
                  onToggle={() => toggleSection('information')}
                >
                  <SubNavItem label="Client Rate Card" active={activePage === 'information_ratecard'} onClick={() => { setActivePage('information_ratecard'); setActiveModule('eam'); }} />
                  <SubNavItem label="Team Hierarchy" active={activePage === 'information_teamhierarchy'} onClick={() => { setActivePage('information_teamhierarchy'); setActiveModule('eam'); }} />
                  <SubNavItem label="Client Process" active={activePage === 'information_process'} onClick={() => { setActivePage('information_process'); setActiveModule('eam'); }} />
                  <SubNavItem label="Code Guide" active={activePage === 'information_codeguide'} onClick={() => { setActivePage('information_codeguide'); setActiveModule('eam'); }} />
                </SideNavGroup>

              </div>
            )}
          </div>

          {/* ── User footer ──────────────────── */}
          {!collapsed && (
            <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>AM</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Account Manager</div>
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)' }}>Admin</div>
              </div>
              <DownOutlined style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', flexShrink: 0 }} />
            </div>
          )}

        </div>

        {/* ─── Main Content ────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
          <div style={{ flex: 1, overflowY: 'auto', minWidth: 0 }}>
            {renderContent()}
          </div>
        </div>
      </div>
    );
  }

  // ── Home Dashboard ────────────────────────────────────────────
  const homeCards = [
    {
      icon: <DollarOutlined style={{ fontSize: 26, color: '#1890ff' }} />,
      iconBg: '#e6f4ff',
      title: 'Financial Intelligence',
      desc: 'Track revenue, billing, and performance with clarity.',
      page: 'executive_revenue' as EAMPage,
      section: 'executive' as EAMSection,
    },
    {
      icon: <TeamOutlined style={{ fontSize: 26, color: '#13c2c2' }} />,
      iconBg: '#e6fffb',
      title: 'Resource Planning',
      desc: 'Plan, allocate, and optimize resources effectively.',
      page: 'resources_info' as EAMPage,
      section: 'resources' as EAMSection,
    },
    {
      icon: <UserOutlined style={{ fontSize: 26, color: '#fa8c16' }} />,
      iconBg: '#fff7e6',
      title: 'Client Operations',
      desc: 'Manage and resolve client requests seamlessly.',
      page: 'clientmgmt_requests' as EAMPage,
      section: 'clientmgmt' as EAMSection,
    },
    {
      icon: <NodeIndexOutlined style={{ fontSize: 26, color: '#722ed1' }} />,
      iconBg: '#f9f0ff',
      title: 'Process Governance',
      desc: 'Standardize SOWs, approvals, and ensure compliance.',
      page: 'clientmgmt_connects' as EAMPage,
      section: 'clientmgmt' as EAMSection,
    },
  ];

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #eef2fb 0%, #f5f8ff 60%, #eaf4ff 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
    }}>
      <div style={{ maxWidth: 820, width: '100%', textAlign: 'center' }}>

        {/* Welcome label */}
        <div style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '2px', color: '#1890ff', textTransform: 'uppercase', marginBottom: 12 }}>
          Welcome to
        </div>

        {/* Main title */}
        <h1 style={{ fontSize: 'clamp(28px, 5vw, 48px)', fontWeight: 800, color: '#0a1628', margin: '0 0 12px', lineHeight: 1.15 }}>
          Enterprise Account Management
        </h1>

        {/* Blue accent line */}
        <div style={{ width: 48, height: 4, background: '#1890ff', borderRadius: 2, margin: '0 auto 20px' }} />

        {/* Subtitle */}
        <p style={{ fontSize: '16px', color: '#5a6a8a', margin: '0 auto 40px', maxWidth: 480, lineHeight: 1.6 }}>
          Manage finances, client requests, and resources<br />from one unified platform.
        </p>

        {/* Feature cards */}
        <div style={{
          background: '#fff',
          borderRadius: 16,
          boxShadow: '0 4px 24px rgba(24,70,150,0.08)',
          border: '1px solid #e8eef8',
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          marginBottom: 44,
          overflow: 'hidden',
        }}>
          {homeCards.map((card, idx) => (
            <div
              key={card.title}
              onClick={() => navigateTo(card.page, card.section)}
              style={{
                padding: '28px 20px',
                borderRight: idx < homeCards.length - 1 ? '1px solid #f0f4fb' : undefined,
                cursor: 'pointer',
                transition: 'background 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f5f8ff'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#fff'; }}
            >
              {/* Icon circle */}
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: card.iconBg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 14,
              }}>
                {card.icon}
              </div>
              <div style={{ fontWeight: 700, fontSize: '15px', color: '#0a1628', marginBottom: 6 }}>
                {card.title}
              </div>
              <div style={{ fontSize: '13px', color: '#7a8ba8', lineHeight: 1.5 }}>
                {card.desc}
              </div>
            </div>
          ))}
        </div>

        {/* Shield icon */}
        <div style={{ marginBottom: 12 }}>
          <SafetyCertificateOutlined style={{ fontSize: 28, color: '#1890ff' }} />
        </div>

        {/* Bottom tagline */}
        <p style={{ fontSize: '15px', color: '#5a6a8a', margin: '0 auto 32px', maxWidth: 420, lineHeight: 1.65 }}>
          Everything you need to manage your account—<br />
          simplified, integrated, and built for impact.
        </p>

        {/* Explore button */}
        <button
          onClick={() => { navigateTo('account_summary', 'account'); setSidebarCollapsed(true); }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 12,
            background: '#0a1e4a',
            color: '#fff', border: 'none', borderRadius: 50,
            padding: '16px 48px', fontSize: '16px', fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.3px',
            boxShadow: '0 6px 24px rgba(10,30,74,0.25)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#1890ff'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0a1e4a'; e.currentTarget.style.transform = 'none'; }}
        >
          <RocketOutlined style={{ fontSize: 18 }} />
          Explore the Platform
          <span style={{ fontSize: 18 }}>→</span>
        </button>

      </div>
    </div>
  );
}
