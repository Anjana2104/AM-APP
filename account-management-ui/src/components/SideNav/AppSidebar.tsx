import {
  CreditCardOutlined,
  DollarOutlined,
  EyeOutlined,
  HomeOutlined,
  InfoCircleOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  NodeIndexOutlined,
  RocketOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Popconfirm, Popover, Tooltip } from 'antd';
import type { UserSession } from '../../api/authApi';
import { NotificationBell } from '../Notifications';
import type { ActiveModule, EAMPage, EAMSection } from '../../types/appShell';
import { SectionLabel } from './SectionLabel';
import { SideNavGroup } from './SideNavGroup';
import { SideNavItem } from './SideNavItem';
import { SubNavItem } from './SubNavItem';

interface AppSidebarProps {
  collapsed: boolean;
  activeModule: ActiveModule;
  activePage: EAMPage;
  currentUser: UserSession | null;
  collapsedGroupsSet: ReadonlySet<string>;
  hasPermission: (pageId: string, action: 'view' | 'edit' | 'delete') => boolean;
  isExpanded: (section: EAMSection) => boolean;
  navigateTo: (page: EAMPage, section: EAMSection) => void;
  goHome: () => void;
  onCollapse: () => void;
  onExpand: () => void;
  onToggleSection: (section: EAMSection) => void;
  onToggleGroupCollapse: (key: string) => void;
  logout: () => void;
}

export function AppSidebar({
  collapsed,
  activeModule,
  activePage,
  currentUser,
  collapsedGroupsSet,
  hasPermission,
  isExpanded,
  navigateTo,
  goHome,
  onCollapse,
  onExpand,
  onToggleSection,
  onToggleGroupCollapse,
  logout,
}: AppSidebarProps) {
  return (
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
      <div style={{ padding: collapsed ? '12px 6px' : '12px 12px', display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 8, justifyContent: collapsed ? 'center' : 'space-between', flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <Tooltip title="Home" placement="right">
              <button onClick={goHome} style={{ background: activeModule === 'home' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: '#60a5fa', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <HomeOutlined style={{ fontSize: '17px' }} />
              </button>
            </Tooltip>
            <NotificationBell collapsed={true} />
          </div>
        ) : (
          <>
            <button onClick={goHome} style={{ background: activeModule === 'home' ? 'rgba(59,130,246,0.18)' : 'transparent', border: 'none', color: activeModule === 'home' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '6px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
              <HomeOutlined style={{ fontSize: '15px' }} />
            </button>
            <span style={{ flex: 1, fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: 1.5, textAlign: 'center', userSelect: 'none' }}>EAM</span>
            <NotificationBell collapsed={false} />
            <button onClick={onCollapse} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.28)', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <MenuFoldOutlined style={{ fontSize: '12px' }} />
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: collapsed ? '4px 6px' : '2px 8px', scrollbarWidth: 'none' }}>
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {hasPermission('account_summary', 'view') && (
              <Tooltip title="Account Summary" placement="right">
                <button onClick={() => navigateTo('account_summary', 'account')} style={{ background: activePage === 'account_summary' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage === 'account_summary' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                  <EyeOutlined />
                </button>
              </Tooltip>
            )}
            {(hasPermission('executive_summary', 'view') || hasPermission('executive_revenue', 'view') || hasPermission('executive_invoicing', 'view')) && (
              <Popover placement="rightTop" trigger="hover" overlayInnerStyle={{ padding: 4, minWidth: 160 }} content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8c8c8c', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Finance</div>
                  {hasPermission('executive_summary', 'view') && <button onClick={() => { navigateTo('executive_summary', 'executive'); }} style={{ background: activePage === 'executive_summary' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'executive_summary' ? '#1677ff' : '#262626', fontWeight: activePage === 'executive_summary' ? 600 : 400 }}>Summary</button>}
                  {hasPermission('executive_revenue', 'view') && <button onClick={() => { navigateTo('executive_revenue', 'executive'); }} style={{ background: activePage === 'executive_revenue' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'executive_revenue' ? '#1677ff' : '#262626', fontWeight: activePage === 'executive_revenue' ? 600 : 400 }}>SOW Details</button>}
                  {hasPermission('executive_invoicing', 'view') && <button onClick={() => { navigateTo('executive_invoicing', 'executive'); }} style={{ background: activePage === 'executive_invoicing' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'executive_invoicing' ? '#1677ff' : '#262626', fontWeight: activePage === 'executive_invoicing' ? 600 : 400 }}>Invoicing Details</button>}
                </div>
              }>
                <button style={{ background: activePage.startsWith('executive') ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage.startsWith('executive') ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                  <DollarOutlined />
                </button>
              </Popover>
            )}
            {(hasPermission('resources_info', 'view') || hasPermission('resources_insights', 'view') || hasPermission('resources_utilization', 'view')) && (
              <Popover placement="rightTop" trigger="hover" overlayInnerStyle={{ padding: 4, minWidth: 180 }} content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8c8c8c', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Resources</div>
                  {hasPermission('resources_info', 'view') && <button onClick={() => { navigateTo('resources_info', 'resources'); }} style={{ background: activePage === 'resources_info' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'resources_info' ? '#1677ff' : '#262626', fontWeight: activePage === 'resources_info' ? 600 : 400 }}>Resource Hub</button>}
                  {hasPermission('resources_insights', 'view') && <button onClick={() => { navigateTo('resources_insights', 'resources'); }} style={{ background: activePage === 'resources_insights' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'resources_insights' ? '#1677ff' : '#262626', fontWeight: activePage === 'resources_insights' ? 600 : 400 }}>Resource Intelligence</button>}
                  {hasPermission('resources_utilization', 'view') && <button onClick={() => { navigateTo('resources_utilization', 'resources'); }} style={{ background: activePage === 'resources_utilization' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'resources_utilization' ? '#1677ff' : '#262626', fontWeight: activePage === 'resources_utilization' ? 600 : 400 }}>Engagement Mapping</button>}
                </div>
              }>
                <button style={{ background: activePage.startsWith('resources') ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage.startsWith('resources') ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                  <ThunderboltOutlined />
                </button>
              </Popover>
            )}
            {(hasPermission('clientmgmt_requests', 'view') || hasPermission('information_teamhierarchy', 'view')) && (
              <Popover placement="rightTop" trigger="hover" overlayInnerStyle={{ padding: 4, minWidth: 160 }} content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8c8c8c', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Clients</div>
                  {hasPermission('information_teamhierarchy', 'view') && <button onClick={() => { navigateTo('information_teamhierarchy', 'clientmgmt'); }} style={{ background: activePage === 'information_teamhierarchy' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'information_teamhierarchy' ? '#1677ff' : '#262626', fontWeight: activePage === 'information_teamhierarchy' ? 600 : 400 }}>Stakeholders</button>}
                  {hasPermission('clientmgmt_requests', 'view') && <button onClick={() => { navigateTo('clientmgmt_requests', 'clientmgmt'); }} style={{ background: activePage === 'clientmgmt_requests' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'clientmgmt_requests' ? '#1677ff' : '#262626', fontWeight: activePage === 'clientmgmt_requests' ? 600 : 400 }}>Requests</button>}
                </div>
              }>
                <button style={{ background: (activePage.startsWith('clientmgmt') && activePage !== 'clientmgmt_connects') || activePage === 'information_teamhierarchy' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: (activePage.startsWith('clientmgmt') && activePage !== 'clientmgmt_connects') || activePage === 'information_teamhierarchy' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                  <UserOutlined />
                </button>
              </Popover>
            )}
            <Tooltip title="Internal Process" placement="right">
              <button onClick={() => navigateTo('clientmgmt_connects', 'clientmgmt')} style={{ background: activePage === 'clientmgmt_connects' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage === 'clientmgmt_connects' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                <NodeIndexOutlined />
              </button>
            </Tooltip>
            {(hasPermission('configuration', 'view') || hasPermission('user_settings', 'view') || hasPermission('user_access_control', 'view')) && (
              <Popover placement="rightTop" trigger="hover" overlayInnerStyle={{ padding: 4, minWidth: 180 }} content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8c8c8c', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Settings</div>
                  {hasPermission('user_access_control', 'view') && <button onClick={() => { navigateTo('user_access_control', 'configuration'); }} style={{ background: activePage === 'user_access_control' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'user_access_control' ? '#1677ff' : '#262626', fontWeight: activePage === 'user_access_control' ? 600 : 400 }}>User Access Control</button>}
                  {hasPermission('configuration', 'view') && <button onClick={() => { navigateTo('configuration', 'configuration'); }} style={{ background: activePage === 'configuration' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'configuration' ? '#1677ff' : '#262626', fontWeight: activePage === 'configuration' ? 600 : 400 }}>App Settings</button>}
                  {hasPermission('user_settings', 'view') && <button onClick={() => { navigateTo('user_settings', 'configuration'); }} style={{ background: activePage === 'user_settings' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'user_settings' ? '#1677ff' : '#262626', fontWeight: activePage === 'user_settings' ? 600 : 400 }}>User Settings</button>}
                </div>
              }>
                <button style={{ background: activePage.startsWith('configuration') || activePage === 'user_settings' || activePage === 'user_access_control' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage.startsWith('configuration') || activePage === 'user_settings' || activePage === 'user_access_control' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                  <SettingOutlined />
                </button>
              </Popover>
            )}
            {(hasPermission('information_ratecard', 'view') || hasPermission('information_process', 'view')) && (
              <Popover placement="rightTop" trigger="hover" overlayInnerStyle={{ padding: 4, minWidth: 160 }} content={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#8c8c8c', padding: '2px 8px 4px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Information</div>
                  {hasPermission('information_ratecard', 'view') && <button onClick={() => { navigateTo('information_ratecard', 'information'); }} style={{ background: activePage === 'information_ratecard' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'information_ratecard' ? '#1677ff' : '#262626', fontWeight: activePage === 'information_ratecard' ? 600 : 400 }}>Client Rate Card</button>}
                  {hasPermission('information_process', 'view') && <button onClick={() => { navigateTo('information_process', 'information'); }} style={{ background: activePage === 'information_process' ? '#e6f4ff' : 'transparent', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 6, textAlign: 'left', fontSize: 12, color: activePage === 'information_process' ? '#1677ff' : '#262626', fontWeight: activePage === 'information_process' ? 600 : 400 }}>Client Process</button>}
                </div>
              }>
                <button style={{ background: activePage.startsWith('information') ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage.startsWith('information') ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                  <InfoCircleOutlined />
                </button>
              </Popover>
            )}
            <div style={{ margin: '4px 6px', borderTop: '1px solid rgba(255,255,255,0.08)' }} />
            <Tooltip title="Expand" placement="right">
              <button onClick={onExpand} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                <MenuUnfoldOutlined style={{ fontSize: '13px' }} />
              </button>
            </Tooltip>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {hasPermission('account_summary', 'view') && (
              <SideNavItem
                icon={<EyeOutlined />}
                label="Account Summary"
                active={activePage === 'account_summary'}
                onClick={() => navigateTo('account_summary', 'account')}
                showArrow
              />
            )}

            <SectionLabel
              label="Account Operations"
              collapsible
              collapsed={collapsedGroupsSet.has('account_ops')}
              onToggle={() => onToggleGroupCollapse('account_ops')}
            />

            {!collapsedGroupsSet.has('account_ops') && (
              <>
                {(hasPermission('executive_summary', 'view') || hasPermission('executive_revenue', 'view') || hasPermission('executive_invoicing', 'view')) && (
                  <SideNavGroup
                    icon={<DollarOutlined />}
                    label="Finance"
                    active={activePage.startsWith('executive')}
                    expanded={isExpanded('executive')}
                    onToggle={() => onToggleSection('executive')}
                  >
                    {hasPermission('executive_summary', 'view') && <SubNavItem label="Summary" active={activePage === 'executive_summary'} onClick={() => navigateTo('executive_summary', 'executive')} />}
                    {hasPermission('executive_revenue', 'view') && <SubNavItem label="SOW Details" active={activePage === 'executive_revenue'} onClick={() => navigateTo('executive_revenue', 'executive')} />}
                    {hasPermission('executive_invoicing', 'view') && <SubNavItem label="Invoicing Details" active={activePage === 'executive_invoicing'} onClick={() => navigateTo('executive_invoicing', 'executive')} />}
                  </SideNavGroup>
                )}

                {(hasPermission('resources_info', 'view') || hasPermission('resources_utilization', 'view') || hasPermission('resources_insights', 'view')) && (
                  <SideNavGroup
                    icon={<ThunderboltOutlined />}
                    label="Resources"
                    active={activePage.startsWith('resources')}
                    expanded={isExpanded('resources')}
                    onToggle={() => onToggleSection('resources')}
                  >
                    {hasPermission('resources_info', 'view') && <SubNavItem label="Resource Hub" active={activePage === 'resources_info'} onClick={() => navigateTo('resources_info', 'resources')} />}
                    {hasPermission('resources_insights', 'view') && <SubNavItem label="Resource Intelligence" active={activePage === 'resources_insights'} onClick={() => navigateTo('resources_insights', 'resources')} />}
                    {hasPermission('resources_utilization', 'view') && <SubNavItem label="Engagement Mapping" active={activePage === 'resources_utilization'} onClick={() => navigateTo('resources_utilization', 'resources')} />}
                  </SideNavGroup>
                )}

                {(hasPermission('clientmgmt_requests', 'view') || hasPermission('information_teamhierarchy', 'view')) && (
                  <SideNavGroup
                    icon={<UserOutlined />}
                    label="Clients"
                    active={activePage === 'clientmgmt_requests' || activePage === 'information_teamhierarchy'}
                    expanded={isExpanded('clientmgmt')}
                    onToggle={() => onToggleSection('clientmgmt')}
                  >
                    {hasPermission('information_teamhierarchy', 'view') && <SubNavItem label="Stakeholders" active={activePage === 'information_teamhierarchy'} onClick={() => navigateTo('information_teamhierarchy', 'clientmgmt')} />}
                    {hasPermission('clientmgmt_requests', 'view') && <SubNavItem label="Requests" active={activePage === 'clientmgmt_requests'} onClick={() => navigateTo('clientmgmt_requests', 'clientmgmt')} />}
                  </SideNavGroup>
                )}

                {hasPermission('clientmgmt_connects', 'view') && (
                  <SideNavItem
                    icon={<NodeIndexOutlined />}
                    label="Internal Process"
                    active={activePage === 'clientmgmt_connects'}
                    onClick={() => navigateTo('clientmgmt_connects', 'clientmgmt')}
                    showArrow
                  />
                )}
              </>
            )}

            <SectionLabel
              label="Settings & Configuration"
              collapsible
              collapsed={collapsedGroupsSet.has('settings_config')}
              onToggle={() => onToggleGroupCollapse('settings_config')}
            />

            {!collapsedGroupsSet.has('settings_config') && (
              <>
                {hasPermission('user_access_control', 'view') && (
                  <SideNavItem
                    icon={<SafetyCertificateOutlined />}
                    label="User Access Control"
                    active={activePage === 'user_access_control'}
                    onClick={() => navigateTo('user_access_control', 'configuration')}
                    showArrow
                  />
                )}

                {hasPermission('configuration', 'view') && (
                  <SideNavGroup
                    icon={<SettingOutlined />}
                    label="App Settings"
                    active={activePage === 'configuration'}
                    expanded={isExpanded('configuration')}
                    onToggle={() => { navigateTo('configuration', 'configuration'); onToggleSection('configuration'); }}
                  />
                )}

                <SideNavItem
                  icon={<UserOutlined />}
                  label="User Settings"
                  active={activePage === 'user_settings'}
                  onClick={() => navigateTo('user_settings', 'configuration')}
                  showArrow
                />
              </>
            )}

            {(hasPermission('information_ratecard', 'view') || hasPermission('information_process', 'view')) && (
              <>
                <SectionLabel
                  label="Information"
                  collapsible
                  collapsed={collapsedGroupsSet.has('information')}
                  onToggle={() => onToggleGroupCollapse('information')}
                />

                {!collapsedGroupsSet.has('information') && (
                  <>
                    {hasPermission('information_ratecard', 'view') && (
                      <SideNavItem
                        icon={<CreditCardOutlined />}
                        label="Client Rate Card"
                        active={activePage === 'information_ratecard'}
                        onClick={() => navigateTo('information_ratecard', 'information')}
                        showArrow
                      />
                    )}
                    {hasPermission('information_process', 'view') && (
                      <SideNavItem
                        icon={<RocketOutlined />}
                        label="Client Process"
                        active={activePage === 'information_process'}
                        onClick={() => navigateTo('information_process', 'information')}
                        showArrow
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {!collapsed && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {(currentUser?.displayName || currentUser?.username || 'U').slice(0, 2).toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentUser?.displayName || currentUser?.username}</div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)' }}>{currentUser?.roleName || 'No Role'}</div>
          </div>
          <Popconfirm title="Sign out?" onConfirm={logout} okText="Sign Out" cancelText="Cancel" placement="topRight">
            <Tooltip title="Sign Out" placement="right">
              <button style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '6px', borderRadius: 6, display: 'flex', alignItems: 'center' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </button>
            </Tooltip>
          </Popconfirm>
        </div>
      )}
    </div>
  );
}
