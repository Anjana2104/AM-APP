interface SubNavItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function SubNavItem({ label, active, onClick }: SubNavItemProps) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        width: '100%',
        padding: '6px 8px 6px 12px',
        background: active ? 'rgba(59,130,246,0.14)' : 'transparent',
        border: 'none',
        borderRadius: 5,
        color: active ? '#93c5fd' : 'rgba(255,255,255,0.5)',
        cursor: 'pointer',
        fontSize: '11.5px',
        fontWeight: active ? 600 : 400,
        transition: 'all 0.15s',
        textAlign: 'left',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: active ? '#3b82f6' : 'rgba(255,255,255,0.22)', flexShrink: 0 }} />
      {label}
    </button>
  );
}
