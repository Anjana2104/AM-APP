import { useEffect, useState } from 'react';
import {
  BellOutlined,
  CheckOutlined,
  DownOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Badge, Button, Drawer, Space, Tag, Tooltip, Typography } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import type { Notification } from '../../api/notificationApi';
import { CreateNotificationModal } from './CreateNotificationModal';

const { Text: AntText } = Typography;

function getTypeColor(type: string) {
  switch (type) {
    case 'alert': return '#ff4d4f';
    case 'info': return '#1890ff';
    default: return '#fa8c16';
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

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationPanel({ open, onClose }: NotificationPanelProps) {
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

  useEffect(() => {
    if (historyOpen && historyNotifications.length === 0) {
      loadMoreHistory();
    }
    if (!historyOpen) { resetHistory(); }
  }, [historyOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderCard = (n: Notification, dimmed = false) => (
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
        title={(
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
        )}
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

            <div style={{ marginTop: 16 }}>
              <div
                onClick={() => setHistoryOpen(h => !h)}
                style={{
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#aaa',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  userSelect: 'none',
                  marginBottom: 8,
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
