import { Tooltip, Popconfirm, Popover, Spin } from 'antd';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
// Eager imports — small files or needed on first render
import { FinanceSummary } from './pages/FinanceSummary';
import { AccountSummary } from './pages/AccountSummary';
import { RateCard } from './pages/RateCard';
import { StakeholderNetwork } from './pages/stakeholders/StakeholderNetwork';
import { UserSettings } from './pages/UserSettings';
import { LoginPage } from './pages/LoginPage';
import { EngagementMapping } from './pages/EngagementMapping';
// Lazy imports — large pages, code-split for faster initial load
const FinanceManagement  = lazy(() => import('./pages/FinanceManagement').then(m => ({ default: m.FinanceManagement })));
const InvoiceManagement  = lazy(() => import('./pages/InvoiceManagement').then(m => ({ default: m.InvoiceManagement })));
const ResourceInformation = lazy(() => import('./pages/ResourceHub'));
const RequestManagement  = lazy(() => import('./pages/ClientRequests'));
const InternalProcess    = lazy(() => import('./pages/InternalProcess').then(m => ({ default: m.InternalProcess })));
const AppSettings         = lazy(() => import('./pages/AppSettings').then(m => ({ default: m.AppSettings })));
const UserAccessControl  = lazy(() => import('./pages/UserAccessControl').then(m => ({ default: m.UserAccessControl })));
const ResourceInsights   = lazy(() => import('./pages/ResourceIntelligence'));
import { useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { UserPreferencesProvider } from './context/UserPreferencesContext';
import {
  DollarOutlined, TeamOutlined, BarChartOutlined,
  RocketOutlined, ThunderboltOutlined, UserOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, DownOutlined, RightOutlined,
  EyeOutlined, HomeOutlined, InfoCircleOutlined,
  CreditCardOutlined, NodeIndexOutlined, SettingOutlined,
  SafetyCertificateOutlined, BellOutlined, CheckOutlined,
  CloseOutlined, AlertOutlined, InfoCircleFilled,
} from '@ant-design/icons';
import { Badge, Drawer, Button, List, Space, Typography, Tag, Modal, Form, Input, Select, message } from 'antd';
import * as notifApi from './api/notificationApi';
import type { UserGroup } from './api/notificationApi';
import type { UserRecord } from './api/authApi';
import * as authApi from './api/authApi';
import type { ResourceRow } from './pages/ResourceHub';
import * as resourceApi from './api/resourceApi';

type EAMPage =
  | 'account_summary'
  | 'executive_summary'
  | 'executive_revenue'
  | 'executive_invoicing'
  | 'resources_info'
  | 'resources_utilization'
  | 'resources_insights'
  | 'clientmgmt_requests'
  | 'clientmgmt_connects'
  | 'information_ratecard'
  | 'information_teamhierarchy'
  | 'information_process'
  | 'user_settings'
  | 'configuration'
  | 'user_access_control';

type EAMSection = 'account' | 'executive' | 'resources' | 'clientmgmt' | 'information' | 'configuration';


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

/* ─── Sidebar sub-components ──────────────────────────────────── */
function SectionLabel({ label, collapsible, collapsed, onToggle }: { label: string; collapsible?: boolean; collapsed?: boolean; onToggle?: () => void }) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        padding: '10px 12px 4px', fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.8px',
        color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', userSelect: 'none',
        cursor: collapsible ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        transition: 'color 0.15s',
      }}
    >
      <span>{label}</span>
      {collapsible && (
        <span style={{ marginTop: 2 }}>
          {collapsed
            ? <RightOutlined style={{ fontSize: '7px', opacity: 0.55 }} />
            : <DownOutlined style={{ fontSize: '7px', opacity: 0.55 }} />}
        </span>
      )}
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

/* ─── Notification Panel ────────────────────────────────────────── */
const { Text: AntText } = Typography;

function getTypeColor(type: string) {
  switch (type) {
    case 'alert': return '#ff4d4f';
    case 'info': return '#1890ff';
    default: return '#fa8c16'; // task
  }
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function CreateNotificationModal({
  open,
  onClose,
  onCreated,
  currentUserName,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  currentUserName: string;
}) {
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [groups, setGroups] = useState<UserGroup[]>([]);
  const [targetType, setTargetType] = useState<'user' | 'group' | 'broadcast'>('broadcast');

  useEffect(() => {
    if (open) {
      authApi.getUsers().then(setUsers);
      notifApi.getUserGroups().then(setGroups);
    }
  }, [open]);

  const handleSubmit = async (values: any) => {
    setSaving(true);
    const payload: any = {
      type: values.type || 'task',
      title: values.title,
      message: values.message || '',
      source_user: currentUserName,
      target_user_id: null,
      target_group_id: null,
    };
    if (targetType === 'user' && values.target_user_id) payload.target_user_id = values.target_user_id;
    if (targetType === 'group' && values.target_group_id) payload.target_group_id = values.target_group_id;
    const result = await notifApi.createNotification(payload);
    setSaving(false);
    if (result.ok) {
      message.success('Notification created');
      form.resetFields();
      onCreated();
      onClose();
    } else {
      message.error(result.error || 'Failed to create');
    }
  };

  return (
    <Modal
      title="Create Notification"
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 12 }}>
        <Form.Item name="type" label="Type" initialValue="task">
          <Select>
            <Select.Option value="task">Task</Select.Option>
            <Select.Option value="info">Info</Select.Option>
            <Select.Option value="alert">Alert</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="title" label="Title" rules={[{ required: true, message: 'Required' }]}>
          <Input placeholder="Notification title" />
        </Form.Item>
        <Form.Item name="message" label="Message">
          <Input.TextArea rows={3} placeholder="Optional message body" />
        </Form.Item>
        <Form.Item label="Target">
          <Select value={targetType} onChange={v => setTargetType(v as any)}>
            <Select.Option value="broadcast">All Users (Broadcast)</Select.Option>
            <Select.Option value="user">Specific User</Select.Option>
            <Select.Option value="group">User Group</Select.Option>
          </Select>
        </Form.Item>
        {targetType === 'user' && (
          <Form.Item name="target_user_id" label="User" rules={[{ required: true, message: 'Select a user' }]}>
            <Select showSearch placeholder="Select user" optionFilterProp="children">
              {users.map(u => (
                <Select.Option key={u.id} value={u.id}>{u.displayName || u.username}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}
        {targetType === 'group' && (
          <Form.Item name="target_group_id" label="Group" rules={[{ required: true, message: 'Select a group' }]}>
            <Select showSearch placeholder="Select group" optionFilterProp="children">
              {groups.map(g => (
                <Select.Option key={g.id} value={g.id}>{g.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" htmlType="submit" loading={saving}>Send</Button>
        </div>
      </Form>
    </Modal>
  );
}

function NotificationPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const {
    unreadNotifications,
    unreadHasMore,
    unreadLoading,
    historyNotifications,
    historyHasMore,
    historyLoading,
    loading,
    refreshUnread,
    loadMoreUnread,
    loadMoreHistory,
    resetHistory,
    markRead,
    markAllRead,
    createNotification,
    unreadCount,
  } = useNotifications();
  const { currentUser, hasPermission } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const canCreate = hasPermission('user_access_control', 'edit');

  useEffect(() => {
    if (open) { refreshUnread(); }
    if (!open) { resetHistory(); setHistoryOpen(false); }
  }, [open, refreshUnread, resetHistory]);

  // Load first page of history when section opens
  useEffect(() => {
    if (historyOpen && historyNotifications.length === 0) {
      loadMoreHistory();
    }
    if (!historyOpen) { resetHistory(); }
  }, [historyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderCard = (n: import('./api/notificationApi').Notification, dimmed = false) => (
    <div
      key={n.id}
      style={{
        borderLeft: `3px solid ${getTypeColor(n.type)}`,
        background: dimmed ? '#fafafa' : '#fff',
        borderRadius: '0 8px 8px 0',
        padding: '10px 12px',
        marginBottom: 8,
        opacity: dimmed ? 0.65 : 1,
        boxShadow: dimmed ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <Tag color={getTypeColor(n.type)} style={{ fontSize: '10px', margin: 0, padding: '0 5px', lineHeight: '16px' }}>{n.type}</Tag>
            <AntText strong style={{ fontSize: '13px' }}>{n.title}</AntText>
          </div>
          {n.message && <div style={{ fontSize: '12px', color: '#595959', marginBottom: 4 }}>{n.message}</div>}
          <div style={{ fontSize: '11px', color: '#aaa' }}>
            {n.source_user && <span>from: {n.source_user} · </span>}
            {relativeTime(n.created_at)}
          </div>
        </div>
        {!dimmed && (
          <Tooltip title="Mark as read">
            <Button
              type="text"
              size="small"
              icon={<CheckOutlined style={{ fontSize: '11px' }} />}
              onClick={() => markRead(n.id)}
              style={{ marginLeft: 8, flexShrink: 0, color: '#52c41a' }}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );

  const drawerWidth = expanded ? '70vw' : 400;

  return (
    <>
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <BellOutlined />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Notifications</span>
              {unreadCount > 0 && <Badge count={unreadCount} style={{ backgroundColor: '#ff4d4f' }} />}
            </Space>
            <Space>
              <Tooltip title={expanded ? 'Collapse' : 'Expand'}>
                <Button
                  size="small"
                  type="text"
                  icon={expanded
                    ? <MenuFoldOutlined style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }} />
                    : <MenuUnfoldOutlined style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }} />}
                  onClick={() => setExpanded(e => !e)}
                  style={{ border: 'none', background: 'transparent' }}
                />
              </Tooltip>
              {unreadCount > 0 && (
                <Button
                  size="small"
                  onClick={markAllRead}
                  style={{ fontSize: '12px', color: '#fff', borderColor: 'rgba(255,255,255,0.5)', background: 'transparent' }}
                >
                  Mark all read
                </Button>
              )}
              {canCreate && (
                <Button
                  size="small"
                  type="primary"
                  onClick={() => setCreateOpen(true)}
                  style={{ fontSize: '12px', background: '#fff', color: '#1677ff', borderColor: '#fff', fontWeight: 600 }}
                >
                  + Create
                </Button>
              )}
            </Space>
          </div>
        }
        placement="right"
        width={drawerWidth}
        open={open}
        onClose={onClose}
        bodyStyle={{ padding: '12px 16px', background: '#f5f5f5' }}
        headerStyle={{ background: '#1677ff', borderBottom: '1px solid #1677ff' }}
        styles={{ header: { color: '#fff' } }}
      >
        {loading ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>Loading…</div>
        ) : (
          <>
            {/* Unread — max 20, then show count hint */}
            {unreadNotifications.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#bbb', padding: '32px 0', fontSize: '13px' }}>
                <CheckOutlined style={{ fontSize: 28, display: 'block', marginBottom: 8 }} />
                All caught up!
              </div>
            ) : (
              <>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8 }}>
                  Unread ({unreadCount})
                </div>
                {unreadNotifications.map(n => renderCard(n, false))}
                {unreadHasMore && (
                  <Button
                    type="link"
                    size="small"
                    loading={unreadLoading}
                    style={{ fontSize: '12px', paddingLeft: 0 }}
                    onClick={loadMoreUnread}
                  >
                    Load more…
                  </Button>
                )}
                {!unreadHasMore && unreadCount > unreadNotifications.length && (
                  <div style={{ fontSize: '11px', color: '#aaa', textAlign: 'center', marginTop: 4 }}>
                    Showing {unreadNotifications.length} of {unreadCount} unread
                  </div>
                )}
              </>
            )}

            {/* Read history — collapsible, paginated */}
            <div style={{ marginTop: 16 }}>
              <div
                onClick={() => setHistoryOpen(h => !h)}
                style={{
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontSize: '11px', fontWeight: 700, color: '#aaa',
                  textTransform: 'uppercase', letterSpacing: '0.5px', userSelect: 'none', marginBottom: 8,
                }}
              >
                {historyOpen ? <DownOutlined style={{ fontSize: 9 }} /> : <RightOutlined style={{ fontSize: 9 }} />}
                History
              </div>
              {historyOpen && (
                <div>
                  {historyLoading && historyNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#ccc', padding: 16 }}>Loading…</div>
                  ) : historyNotifications.length === 0 ? (
                    <div style={{ textAlign: 'center', color: '#ccc', fontSize: '12px', padding: 12 }}>No history yet</div>
                  ) : (
                    <>
                      {historyNotifications.map(n => renderCard(n, true))}
                      {historyHasMore && (
                        <Button
                          type="link"
                          size="small"
                          loading={historyLoading}
                          style={{ fontSize: '12px', paddingLeft: 0 }}
                          onClick={loadMoreHistory}
                        >
                          Load more…
                        </Button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </Drawer>

      <CreateNotificationModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={refreshUnread}
        currentUserName={currentUser?.displayName || currentUser?.username || ''}
      />
    </>
  );
}

function NotificationBell({ collapsed }: { collapsed: boolean }) {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  const bellBtn = (
    <button
      onClick={() => setOpen(true)}
      style={{
        background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)',
        cursor: 'pointer', padding: '6px', borderRadius: 6,
        display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
      }}
    >
      <Badge count={unreadCount} size="small" offset={[2, -2]}>
        <BellOutlined style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }} />
      </Badge>
    </button>
  );

  return (
    <>
      {collapsed ? (
        <Tooltip title="Notifications" placement="right">{bellBtn}</Tooltip>
      ) : bellBtn}
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default function App() {
  const { isAuthenticated, currentUser, logout, hasPermission } = useAuth();

  // Parse the URL hash once on mount to restore the page the user was on
  const initialHash = parseHash();
  const [activeModule, setActiveModule] = useState<'home' | 'eam'>(initialHash.module);
  const [activePage, setActivePage] = useState<EAMPage>(initialHash.page);
  const [expandedSections, setExpandedSections] = useState<Set<EAMSection>>(
    initialHash.module === 'eam'
      ? new Set<EAMSection>([PAGE_SECTION_MAP[initialHash.page]])
      : new Set<EAMSection>()
  );
  // Track which top-level section groups (Account Ops / Settings / Information) are collapsed
  // All three start collapsed — user activity overrides thereafter
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    new Set(['account_ops', 'settings_config', 'information'])
  );

  const toggleGroupCollapse = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [resourceInfoRoleFilter, setResourceInfoRoleFilter] = useState<string | undefined>(undefined);
  const [resourceInfoRaIdFilter, setResourceInfoRaIdFilter] = useState<string | undefined>(undefined);
  const [resourceInfoFilterType, setResourceInfoFilterType] = useState<string | undefined>(undefined);
  const [resourceInfoFilterValue, setResourceInfoFilterValue] = useState<string | undefined>(undefined);
  const [requestsBeelineFilter, setRequestsBeelineFilter] = useState<string | undefined>(undefined);
  const [requestsInitialFilters, setRequestsInitialFilters] = useState<Record<string, any> | undefined>(undefined);
  const [initialProcessSow, setInitialProcessSow] = useState<string | undefined>(undefined);

  // Load resources on mount so EngagementMapping and ResourceInsights work without visiting Resource Hub first
  useEffect(() => {
    resourceApi.getResources().then(({ resources: rows }) => {
      const mapped: ResourceRow[] = rows.map((r: any, i: number) => ({
        key: String(r.id || i),
        id: r.id,
        sno: String(r.sno || i + 1),
        raId: String(r.ra_id || r.raId || ''),
        empName: String(r.emp_name || r.empName || ''),
        emailId: String(r.email_id || r.emailId || ''),
        piwRole: String(r.piw_role || r.piwRole || ''),
        roleOrDomain: String(r.role_or_domain || r.roleOrDomain || ''),
        previousWorkex: String(r.previous_workex || r.previousWorkex || ''),
        doj: String(r.doj || ''),
        totalWorkex: String(r.total_workex || r.totalWorkex || ''),
        skills: String(r.skills || ''),
        engagement: String(r.engagement || ''),
        allocationStatus: String(r.allocation_status || r.allocationStatus || ''),
        beelineId: String(r.beeline_id || r.beelineId || ''),
      }));
      setResources(mapped);
    }).catch(() => { /* graceful fallback */ });
  }, []);

  // Track previous auth state to detect genuine login (false → true) vs page refresh
  const prevAuthRef = useRef<boolean | undefined>(undefined);

  // Only redirect to Home on a real login (prev=false → now=true), not on page refresh
  useEffect(() => {
    if (prevAuthRef.current === false && isAuthenticated) {
      // Genuine login — go to home
      window.history.replaceState({ module: 'home' }, '', '#/home');
      setActiveModule('home');
    }
    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

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
    setActivePage(page);
    setExpandedSections(s => new Set([...s, section]));
    setActiveModule('eam');
  };

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const state = e.state as { module?: string; page?: EAMPage } | null;
      if (state?.module === 'eam' && state.page) {
        setActivePage(state.page);
        setActiveModule('eam');
        setExpandedSections(s => new Set([...s, PAGE_SECTION_MAP[state.page!]]));
      } else if (state?.module === 'home') {
        setActiveModule('home');
      } else {
        // No state — parse hash as fallback
        const h = parseHash();
        setActivePage(h.page);
        setActiveModule(h.module);
      }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const goHome = () => {
    window.history.pushState({ module: 'home' }, '', '#/home');
    setActiveModule('home');
  };

  const toggleSection = (section: EAMSection) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section); else next.add(section);
      return next;
    });
  };

  if (!isAuthenticated) return <LoginPage />;

  if (activeModule === 'eam') {
    const collapsed = sidebarCollapsed;
    const isExp = (s: EAMSection) => expandedSections.has(s);

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
        case 'executive_revenue':     return <FinanceManagement />;
        case 'executive_invoicing':   return <InvoiceManagement />;
        case 'resources_info':        return <ResourceInformation onResourcesChange={setResources} initialRoleFilter={resourceInfoRoleFilter} initialRaIdFilter={resourceInfoRaIdFilter} initialFilterType={resourceInfoFilterType} initialFilterValue={resourceInfoFilterValue} onFilterApplied={() => { setResourceInfoRoleFilter(undefined); setResourceInfoRaIdFilter(undefined); setResourceInfoFilterType(undefined); setResourceInfoFilterValue(undefined); }} onNavigateToRequest={(beelineId) => { setRequestsBeelineFilter(beelineId); navigateTo('clientmgmt_requests', 'clientmgmt'); }} onNavigateToInsights={() => navigateTo('resources_insights', PAGE_SECTION_MAP['resources_insights'])} onNavigateToProcess={(sow) => { setInitialProcessSow(sow); navigateTo('clientmgmt_connects', 'clientmgmt'); }} />;
        case 'resources_utilization': return <EngagementMapping resources={resources} onUpdateResources={setResources} onNavigate={(page, roleFilter) => { setResourceInfoRoleFilter(roleFilter); navigateTo(page as EAMPage, PAGE_SECTION_MAP[page as EAMPage]); }} onNavigateToRequest={(beelineId) => { setRequestsBeelineFilter(beelineId); navigateTo('clientmgmt_requests', 'clientmgmt'); }} onNavigateToInsights={() => navigateTo('resources_insights', PAGE_SECTION_MAP['resources_insights'])} />;
        case 'resources_insights':    return <ResourceInsights resources={resources} onNavigate={(page, raId) => { if (raId) setResourceInfoRaIdFilter(raId); navigateTo(page as EAMPage, PAGE_SECTION_MAP[page as EAMPage]); }} onNavigateWithFilter={(type, value) => { setResourceInfoFilterType(type); setResourceInfoFilterValue(value); navigateTo('resources_info', PAGE_SECTION_MAP['resources_info']); }} onNavigateToRequest={(beelineId) => { setRequestsBeelineFilter(beelineId); navigateTo('clientmgmt_requests', 'clientmgmt'); }} onNavigateToProcess={(sow) => { setInitialProcessSow(sow); navigateTo('clientmgmt_connects', 'clientmgmt'); }} />;
        case 'clientmgmt_requests':   return <RequestManagement initialBeelineFilter={requestsBeelineFilter} initialFilters={requestsInitialFilters} onFilterApplied={() => { setRequestsBeelineFilter(undefined); setRequestsInitialFilters(undefined); }} />;
        case 'clientmgmt_connects':   return <InternalProcess resources={resources} initialSow={initialProcessSow} />;
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
                {/* Home icon — clickable */}
                <button onClick={goHome} style={{ background: activeModule === 'home' ? 'rgba(59,130,246,0.18)' : 'transparent', border: 'none', color: activeModule === 'home' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '6px 8px', borderRadius: 7, display: 'flex', alignItems: 'center', gap: 7, flexShrink: 0 }}>
                  <HomeOutlined style={{ fontSize: '15px' }} />
                </button>

                {/* EAM brand label */}
                <span style={{ flex: 1, fontSize: '16px', fontWeight: 700, color: '#fff', letterSpacing: 1.5, textAlign: 'center', userSelect: 'none' }}>EAM</span>

                {/* Bell icon */}
                <NotificationBell collapsed={false} />

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
              /* Collapsed: icons with Popover sub-menus */
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {/* Account Summary — direct nav, no children */}
                {hasPermission('account_summary', 'view') && (
                  <Tooltip title="Account Summary" placement="right">
                    <button onClick={() => navigateTo('account_summary', 'account')} style={{ background: activePage === 'account_summary' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage === 'account_summary' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                      <EyeOutlined />
                    </button>
                  </Tooltip>
                )}
                {/* Finance — popover with sub-items */}
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
                {/* Resources — popover */}
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
                {/* Clients — popover */}
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
                {/* Internal Process */}
                <Tooltip title="Internal Process" placement="right">
                  <button onClick={() => navigateTo('clientmgmt_connects', 'clientmgmt')} style={{ background: activePage === 'clientmgmt_connects' ? 'rgba(59,130,246,0.22)' : 'transparent', border: 'none', color: activePage === 'clientmgmt_connects' ? '#60a5fa' : 'rgba(255,255,255,0.55)', cursor: 'pointer', padding: '9px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', fontSize: '15px', transition: 'all 0.15s' }}>
                    <NodeIndexOutlined />
                  </button>
                </Tooltip>
                {/* Configuration — popover */}
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
                {/* Information — popover */}
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
                  <button onClick={() => { setSidebarCollapsed(false); setExpandedSections(new Set()); }} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
                    <MenuUnfoldOutlined style={{ fontSize: '13px' }} />
                  </button>
                </Tooltip>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>

                {/* ── ACCOUNT SUMMARY ── */}
                {hasPermission('account_summary', 'view') && (
                <SideNavItem
                  icon={<EyeOutlined />} label="Account Summary"
                  active={activePage === 'account_summary'}
                  onClick={() => navigateTo('account_summary', 'account')}
                  showArrow
                />
                )}

                {/* ── ACCOUNT OPERATIONS section ── */}
                <SectionLabel
                  label="Account Operations"
                  collapsible
                  collapsed={collapsedGroups.has('account_ops')}
                  onToggle={() => toggleGroupCollapse('account_ops')}
                />

                {!collapsedGroups.has('account_ops') && (<>

                {/* Finance */}
                {(hasPermission('executive_summary', 'view') || hasPermission('executive_revenue', 'view') || hasPermission('executive_invoicing', 'view')) && (
                <SideNavGroup
                  icon={<DollarOutlined />} label="Finance"
                  active={activePage.startsWith('executive')}
                  expanded={isExp('executive')}
                  onToggle={() => toggleSection('executive')}
                >
                  {hasPermission('executive_summary', 'view') && <SubNavItem label="Summary" active={activePage === 'executive_summary'} onClick={() => navigateTo('executive_summary', 'executive')} />}
                  {hasPermission('executive_revenue', 'view') && <SubNavItem label="SOW Details" active={activePage === 'executive_revenue'} onClick={() => navigateTo('executive_revenue', 'executive')} />}
                  {hasPermission('executive_invoicing', 'view') && <SubNavItem label="Invoicing Details" active={activePage === 'executive_invoicing'} onClick={() => navigateTo('executive_invoicing', 'executive')} />}
                </SideNavGroup>
                )}

                {/* Resources */}
                {(hasPermission('resources_info', 'view') || hasPermission('resources_utilization', 'view') || hasPermission('resources_insights', 'view')) && (
                <SideNavGroup
                  icon={<ThunderboltOutlined />} label="Resources"
                  active={activePage.startsWith('resources')}
                  expanded={isExp('resources')}
                  onToggle={() => toggleSection('resources')}
                >
                  {hasPermission('resources_info', 'view') && <SubNavItem label="Resource Hub" active={activePage === 'resources_info'} onClick={() => navigateTo('resources_info', 'resources')} />}
                  {hasPermission('resources_insights', 'view') && <SubNavItem label="Resource Intelligence" active={activePage === 'resources_insights'} onClick={() => navigateTo('resources_insights', 'resources')} />}
                  {hasPermission('resources_utilization', 'view') && <SubNavItem label="Engagement Mapping" active={activePage === 'resources_utilization'} onClick={() => navigateTo('resources_utilization', 'resources')} />}
                </SideNavGroup>
                )}

                {/* Clients */}
                {(hasPermission('clientmgmt_requests', 'view') || hasPermission('information_teamhierarchy', 'view')) && (
                <SideNavGroup
                  icon={<UserOutlined />} label="Clients"
                  active={activePage === 'clientmgmt_requests' || activePage === 'information_teamhierarchy'}
                  expanded={isExp('clientmgmt')}
                  onToggle={() => toggleSection('clientmgmt')}
                >
                  {hasPermission('information_teamhierarchy', 'view') && <SubNavItem label="Stakeholders" active={activePage === 'information_teamhierarchy'} onClick={() => navigateTo('information_teamhierarchy', 'clientmgmt')} />}
                  {hasPermission('clientmgmt_requests', 'view') && <SubNavItem label="Requests" active={activePage === 'clientmgmt_requests'} onClick={() => navigateTo('clientmgmt_requests', 'clientmgmt')} />}
                </SideNavGroup>
                )}

                {/* Internal Process */}
                {hasPermission('clientmgmt_connects', 'view') && (
                <SideNavItem
                  icon={<NodeIndexOutlined />} label="Internal Process"
                  active={activePage === 'clientmgmt_connects'}
                  onClick={() => navigateTo('clientmgmt_connects', 'clientmgmt')}
                  showArrow
                />
                )}

                {/* Knowledge Base items are moved into the Information section below */}

                </>)}

                {/* ── SETTINGS & CONFIGURATION section ── */}
                <SectionLabel
                  label="Settings & Configuration"
                  collapsible
                  collapsed={collapsedGroups.has('settings_config')}
                  onToggle={() => toggleGroupCollapse('settings_config')}
                />

                {!collapsedGroups.has('settings_config') && (<>

                {/* User Access Control — admin-only */}
                {hasPermission('user_access_control', 'view') && (
                <SideNavItem
                  icon={<SafetyCertificateOutlined />} label="User Access Control"
                  active={activePage === 'user_access_control'}
                  onClick={() => navigateTo('user_access_control', 'configuration')}
                  showArrow
                />
                )}

                {/* Configuration */}
                {hasPermission('configuration', 'view') && (
                <SideNavGroup
                  icon={<SettingOutlined />} label="App Settings"
                  active={activePage === 'configuration'}
                  expanded={isExp('configuration')}
                  onToggle={() => { navigateTo('configuration', 'configuration'); toggleSection('configuration'); }}
                />
                )}

                {/* User Settings — personal preferences */}
                <SideNavItem
                  icon={<UserOutlined />} label="User Settings"
                  active={activePage === 'user_settings'}
                  onClick={() => navigateTo('user_settings', 'configuration')}
                  showArrow
                />

                </>)}

                {/* ── INFORMATION section ── */}
                {(hasPermission('information_ratecard', 'view') || hasPermission('information_process', 'view')) && (<>
                <SectionLabel
                  label="Information"
                  collapsible
                  collapsed={collapsedGroups.has('information')}
                  onToggle={() => toggleGroupCollapse('information')}
                />

                {!collapsedGroups.has('information') && (<>
                  {hasPermission('information_ratecard', 'view') && (
                  <SideNavItem icon={<CreditCardOutlined />} label="Client Rate Card"
                    active={activePage === 'information_ratecard'}
                    onClick={() => navigateTo('information_ratecard', 'information')} showArrow />
                  )}
                  {hasPermission('information_process', 'view') && (
                  <SideNavItem icon={<RocketOutlined />} label="Client Process"
                    active={activePage === 'information_process'}
                    onClick={() => navigateTo('information_process', 'information')} showArrow />
                  )}
                </>)}
                </>)}

              </div>
            )}
          </div>

          {/* ── User footer ──────────────────── */}
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
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                  </button>
                </Tooltip>
              </Popconfirm>
            </div>
          )}

        </div>

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
    </div>
  );
}
