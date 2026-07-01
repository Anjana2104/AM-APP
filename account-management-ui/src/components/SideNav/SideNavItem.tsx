import type { ReactNode } from 'react';
import { RightOutlined } from '@ant-design/icons';

interface SideNavItemProps {
  icon: ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
  showArrow?: boolean;
}

export function SideNavItem({ icon, label, active, onClick, showArrow }: SideNavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 9,
        width: '100%',
        padding: '7px 10px',
        background: active ? 'rgba(59,130,246,0.16)' : 'transparent',
        border: 'none',
        borderLeft: active ? '3px solid #3b82f6' : '3px solid transparent',
        borderRadius: active ? '0 7px 7px 0' : '7px',
        color: active ? '#93c5fd' : 'rgba(255,255,255,0.7)',
        cursor: 'pointer',
        fontSize: '12.5px',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{ width: 26, height: 26, borderRadius: 6, background: active ? 'rgba(59,130,246,0.25)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {showArrow && <RightOutlined style={{ fontSize: '8px', opacity: 0.45 }} />}
    </button>
  );
}
