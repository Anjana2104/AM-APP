import { Tooltip, Popconfirm, Spin } from 'antd';
import { useEffect, useRef, useMemo, lazy, Suspense } from 'react';
// Eager imports — small files or needed on first render
import { FinanceSummary } from './pages/FinanceSummary';
import { AccountSummary } from './pages/AccountSummary';
import { RateCard } from './pages/RateCard';
import { StakeholderNetwork } from './pages/stakeholders/StakeholderNetwork';
import { UserSettings } from './pages/UserSettings';
import { LoginPage } from './pages/LoginPage';
import { EngagementMapping } from './pages/EngagementMapping';
// Lazy imports — large pages, code-split for faster initial load
const SowManagement  = lazy(() => import('./pages/SowManagement'));
const InvoiceManagement  = lazy(() => import('./pages/InvoiceManagement').then(m => ({ default: m.InvoiceManagement })));
const ResourceInformation = lazy(() => import('./pages/ResourceHub'));
const RequestManagement  = lazy(() => import('./pages/ClientRequests'));
const InternalProcess    = lazy(() => import('./pages/InternalProcess').then(m => ({ default: m.InternalProcess })));
const AppSettings         = lazy(() => import('./pages/AppSettings').then(m => ({ default: m.AppSettings })));
const UserAccessControl  = lazy(() => import('./pages/UserAccessControl').then(m => ({ default: m.UserAccessControl })));
const ResourceInsights   = lazy(() => import('./pages/ResourceIntelligence'));
import { useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import { UserPreferencesProvider } from './context/UserPreferencesContext';
import {
  DollarOutlined, TeamOutlined,
  RocketOutlined, UserOutlined,
  NodeIndexOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { ResourceRow } from './pages/ResourceHub';
import * as resourceApi from './api/resourceApi';
import { mapResourceApiRowToResourceRow } from './pages/resource/resourceRowMappers';
import { useAppDispatch, useAppSelector } from './store/hooks';
import { setResources as setResourcesAction } from './store/resourcesSlice';
import {
  addExpandedSection,
  clearExpandedSections,
  clearRequestsNavigation,
  clearResourceInfoFilters,
  initializeFromHash,
  setActiveModule as setActiveModuleAction,
  setActivePage as setActivePageAction,
  setInitialProcessSow as setInitialProcessSowAction,
  setRequestsBeelineFilter as setRequestsBeelineFilterAction,
  setResourceInfoFilterType as setResourceInfoFilterTypeAction,
  setResourceInfoFilterValue as setResourceInfoFilterValueAction,
  setResourceInfoRaIdFilter as setResourceInfoRaIdFilterAction,
  setResourceInfoRoleFilter as setResourceInfoRoleFilterAction,
  setSidebarCollapsed as setSidebarCollapsedAction,
  toggleCollapsedGroup,
  toggleExpandedSection,
} from './store/appShellSlice';
import { AppSidebar } from './components/SideNav';
import type { EAMPage, EAMSection } from './types/appShell';


const PAGE_SECTION_MAP: Record<EAMPage, EAMSection> = {
  account_summary: 'account',
  executive_summary: 'executive',
  executive_revenue: 'executive',
  executive_invoicing: 'executive',
  resources_info: 'resources',
  resources_utilization: 'resources',
  resources_insights: 'resources',
  clientmgmt_requests: 'clientmgmt',
  clientmgmt_connects: 'clientmgmt',
  information_ratecard: 'information',
  information_teamhierarchy: 'information',
  information_process: 'information',
  configuration: 'configuration',
  user_settings: 'configuration',
  user_access_control: 'configuration',
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

export default function App() {
  const { isAuthenticated, currentUser, logout, hasPermission } = useAuth();
  const dispatch = useAppDispatch();
  const {
    activeModule,
    activePage: activePageValue,
    expandedSections,
    collapsedGroups,
    sidebarCollapsed,
    resourceInfoRoleFilter,
    resourceInfoRaIdFilter,
    resourceInfoFilterType,
    resourceInfoFilterValue,
    requestsBeelineFilter,
    requestsInitialFilters,
    initialProcessSow,
  } = useAppSelector((state) => state.appShell);
  const activePage = activePageValue as EAMPage;
  const expandedSectionsSet = useMemo(() => new Set(expandedSections as EAMSection[]), [expandedSections]);
  const collapsedGroupsSet = useMemo(() => new Set(collapsedGroups), [collapsedGroups]);

  const toggleGroupCollapse = (key: string) => {
    dispatch(toggleCollapsedGroup(key));
  };

  // Load resources on mount so EngagementMapping and ResourceInsights work without visiting Resource Hub first
  useEffect(() => {
    resourceApi.getResources().then(({ resources: rows }) => {
      const mapped: ResourceRow[] = rows.map((r: any, i: number) => mapResourceApiRowToResourceRow(r, i));
      dispatch(setResourcesAction(mapped));
    }).catch(() => { /* graceful fallback */ });
  }, [dispatch]);

  // Track previous auth state to detect genuine login (false → true) vs page refresh
  const prevAuthRef = useRef<boolean | undefined>(undefined);

  // Only redirect to Home on a real login (prev=false → now=true), not on page refresh
  useEffect(() => {
    if (prevAuthRef.current === false && isAuthenticated) {
      // Genuine login — go to home
      window.history.replaceState({ module: 'home' }, '', '#/home');
      dispatch(setActiveModuleAction('home'));
    }
    prevAuthRef.current = isAuthenticated;
  }, [dispatch, isAuthenticated]);

  useEffect(() => {
    const hash = parseHash();
    dispatch(initializeFromHash(hash));
  }, [dispatch]);

  useEffect(() => {
    if (!window.history.state) {
      const hash = activeModule === 'eam' ? toHash('eam', activePage) : '#/home';
      window.history.replaceState({ module: activeModule, page: activePage }, '', hash);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Browser history support ────────────────────────────────────────────────
  // Push state on navigate; restore on popstate (browser Back/Forward)
  const navigateTo = (page: EAMPage, section: EAMSection) => {
    const prev = { module: activeModule, page: activePage };
    const hash = toHash('eam', page);
    window.history.pushState({ module: 'eam', page, prev }, '', hash);
    dispatch(setActivePageAction(page));
    dispatch(addExpandedSection(section));
    dispatch(setActiveModuleAction('eam'));
  };

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const state = e.state as { module?: string; page?: EAMPage } | null;
      if (state?.module === 'eam' && state.page) {
        dispatch(setActivePageAction(state.page));
        dispatch(setActiveModuleAction('eam'));
        dispatch(addExpandedSection(PAGE_SECTION_MAP[state.page]));
      } else if (state?.module === 'home') {
        dispatch(setActiveModuleAction('home'));
      } else {
        // No state — parse hash as fallback
        const h = parseHash();
        dispatch(initializeFromHash(h));
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dispatch]);

  const goHome = () => {
    window.history.pushState({ module: 'home' }, '', '#/home');
    dispatch(setActiveModuleAction('home'));
  };

  const toggleSection = (section: EAMSection) => {
    dispatch(toggleExpandedSection(section));
  };

  if (!isAuthenticated) return <LoginPage />;

  if (activeModule === 'eam') {
    const collapsed = sidebarCollapsed;
    const isExp = (s: EAMSection) => expandedSectionsSet.has(s);

    const renderContent = () => {
      // Guard: user must have view permission for the active page
      if (!hasPermission(activePage, 'view')) {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, padding: 60 }}>
            <SafetyCertificateOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#595959' }}>Access Denied</div>
            <div style={{ fontSize: '13px', color: '#8c8c8c', textAlign: 'center' }}>
              You do not have permission to view this page.<br />Contact your administrator to request access.
            </div>
          </div>
        );
      }
      switch (activePage) {
        case 'account_summary':      return <AccountSummary onNavigate={page => navigateTo(page as EAMPage, PAGE_SECTION_MAP[page as EAMPage])} />;
        case 'executive_summary':    return <FinanceSummary onNavigate={page => navigateTo(page, 'executive')} />;
        case 'executive_revenue':     return <SowManagement />;
        case 'executive_invoicing':   return <InvoiceManagement />;
        case 'resources_info':        return <ResourceInformation onResourcesChange={(updatedResources) => dispatch(setResourcesAction(updatedResources))} initialRoleFilter={resourceInfoRoleFilter} initialRaIdFilter={resourceInfoRaIdFilter} initialFilterType={resourceInfoFilterType} initialFilterValue={resourceInfoFilterValue} onFilterApplied={() => { dispatch(clearResourceInfoFilters()); }} onNavigateToRequest={(beelineId) => { dispatch(setRequestsBeelineFilterAction(beelineId)); navigateTo('clientmgmt_requests', 'clientmgmt'); }} onNavigateToInsights={() => navigateTo('resources_insights', PAGE_SECTION_MAP['resources_insights'])} onNavigateToProcess={(sow) => { dispatch(setInitialProcessSowAction(sow)); navigateTo('clientmgmt_connects', 'clientmgmt'); }} />;
        case 'resources_utilization': return <EngagementMapping onNavigate={(page, roleFilter) => { dispatch(setResourceInfoRoleFilterAction(roleFilter)); navigateTo(page as EAMPage, PAGE_SECTION_MAP[page as EAMPage]); }} onNavigateToRequest={(beelineId) => { dispatch(setRequestsBeelineFilterAction(beelineId)); navigateTo('clientmgmt_requests', 'clientmgmt'); }} onNavigateToInsights={() => navigateTo('resources_insights', PAGE_SECTION_MAP['resources_insights'])} />;
        case 'resources_insights':    return <ResourceInsights onNavigate={(page, raId) => { if (raId) dispatch(setResourceInfoRaIdFilterAction(raId)); navigateTo(page as EAMPage, PAGE_SECTION_MAP[page as EAMPage]); }} onNavigateWithFilter={(type, value) => { dispatch(setResourceInfoFilterTypeAction(type)); dispatch(setResourceInfoFilterValueAction(value)); navigateTo('resources_info', PAGE_SECTION_MAP['resources_info']); }} onNavigateToRequest={(beelineId) => { dispatch(setRequestsBeelineFilterAction(beelineId)); navigateTo('clientmgmt_requests', 'clientmgmt'); }} onNavigateToProcess={(sow) => { dispatch(setInitialProcessSowAction(sow)); navigateTo('clientmgmt_connects', 'clientmgmt'); }} />;
        case 'clientmgmt_requests':   return <RequestManagement initialBeelineFilter={requestsBeelineFilter} initialFilters={requestsInitialFilters as Record<string, any> | undefined} onFilterApplied={() => { dispatch(clearRequestsNavigation()); }} />;
        case 'clientmgmt_connects':   return <InternalProcess initialSow={initialProcessSow} />;
        case 'information_ratecard':      return <RateCard />;
        case 'information_teamhierarchy': return <StakeholderNetwork />;
        case 'information_process':       return <div style={{ padding: 40, textAlign: 'center', marginTop: 80, color: '#aaa', fontSize: '16px' }}>Client Process — Coming Soon</div>;
        case 'configuration':             return <AppSettings />;
        case 'user_settings':             return <UserSettings />;
        case 'user_access_control':       return <UserAccessControl />;
        default: return null;
      }
    };

    return (
      <NotificationProvider>
      <UserPreferencesProvider userId={currentUser?.id ?? null}>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>

        <AppSidebar
          collapsed={collapsed}
          activeModule={activeModule}
          activePage={activePage}
          currentUser={currentUser}
          collapsedGroupsSet={collapsedGroupsSet}
          hasPermission={hasPermission}
          isExpanded={isExp}
          navigateTo={navigateTo}
          goHome={goHome}
          onCollapse={() => dispatch(setSidebarCollapsedAction(true))}
          onExpand={() => { dispatch(setSidebarCollapsedAction(false)); dispatch(clearExpandedSections()); }}
          onToggleSection={toggleSection}
          onToggleGroupCollapse={toggleGroupCollapse}
          logout={logout}
        />

        {/* ─── Main Content ────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
          <div style={activePage === 'resources_utilization'
            ? { flex: 1, overflow: 'hidden', minWidth: 0, display: 'flex', flexDirection: 'column' }
            : { flex: 1, overflowY: 'auto', minWidth: 0 }
          }>
            {/* ── Page Content ── */}
            <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin size="large" /></div>}>
              {renderContent()}
            </Suspense>
          </div>
        </div>
      </div>
      </UserPreferencesProvider>
      </NotificationProvider>
    );
  }

  // ── Home Dashboard ────────────────────────────────────────────
  const homeCards = [
    {
      icon: <DollarOutlined style={{ fontSize: 26, color: '#1890ff' }} />,
      iconBg: '#e6f4ff',
      title: 'Financial Intelligence',
      desc: 'Track revenue, billing, and performance with clarity.',
      page: 'executive_summary' as EAMPage,
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
      desc: 'Manage stakeholders first, then track and resolve client requests.',
      page: 'information_teamhierarchy' as EAMPage,
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
      flexDirection: 'column',
      padding: 0,
    }}>
      {/* ── Top bar with user info + sign out ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '12px 28px', gap: 12,
        borderBottom: '1px solid rgba(24,70,150,0.07)',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '11px', fontWeight: 700, color: '#fff', flexShrink: 0,
          }}>
            {(currentUser?.displayName || currentUser?.username || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#0a1628', lineHeight: 1.2 }}>
              {currentUser?.displayName || currentUser?.username}
            </div>
            <div style={{ fontSize: '11px', color: '#8c9ab0' }}>
              {currentUser?.roleName || 'No Role'}
            </div>
          </div>
        </div>
        <Popconfirm title="Sign out of EAM?" onConfirm={logout} okText="Sign Out" cancelText="Cancel" placement="bottomRight">
          <Tooltip title="Sign Out">
            <button style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'transparent', border: '1px solid #e0e7f0',
              borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
              color: '#5a6a8a', fontSize: '12px', fontWeight: 500,
              transition: 'all 0.15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = '#fff0f0'; e.currentTarget.style.borderColor = '#ff4d4f'; e.currentTarget.style.color = '#ff4d4f'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e0e7f0'; e.currentTarget.style.color = '#5a6a8a'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Sign Out
            </button>
          </Tooltip>
        </Popconfirm>
      </div>

      {/* ── Centred content ── */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
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
          onClick={() => { navigateTo('account_summary', 'account'); dispatch(setSidebarCollapsedAction(true)); }}
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
    </div>
  );
}
