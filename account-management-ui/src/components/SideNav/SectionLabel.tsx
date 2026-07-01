import { DownOutlined, RightOutlined } from '@ant-design/icons';

interface SectionLabelProps {
  label: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}

export function SectionLabel({ label, collapsible, collapsed, onToggle }: SectionLabelProps) {
  return (
    <div
      onClick={collapsible ? onToggle : undefined}
      style={{
        padding: '10px 12px 4px',
        fontSize: '9.5px',
        fontWeight: 700,
        letterSpacing: '0.8px',
        color: 'rgba(255,255,255,0.28)',
        textTransform: 'uppercase',
        userSelect: 'none',
        cursor: collapsible ? 'pointer' : 'default',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
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
