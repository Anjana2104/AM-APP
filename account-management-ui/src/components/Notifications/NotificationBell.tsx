import { useState } from 'react';
import { BellOutlined } from '@ant-design/icons';
import { Badge, Tooltip } from 'antd';
import { useNotifications } from '../../context/NotificationContext';
import { NotificationPanel } from './NotificationPanel';

interface NotificationBellProps {
  collapsed: boolean;
}

export function NotificationBell({ collapsed }: NotificationBellProps) {
  const { unreadCount } = useNotifications();
  const [open, setOpen] = useState(false);

  const bellButton = (
    <button
      onClick={() => setOpen(true)}
      style={{
        background: 'transparent',
        border: 'none',
        color: 'rgba(255,255,255,0.55)',
        cursor: 'pointer',
        padding: '6px',
        borderRadius: 6,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <Badge count={unreadCount} size="small" offset={[2, -2]}>
        <BellOutlined style={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }} />
      </Badge>
    </button>
  );

  return (
    <>
      {collapsed ? <Tooltip title="Notifications" placement="right">{bellButton}</Tooltip> : bellButton}
      <NotificationPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
}
