import React from 'react';

type Option = { label: string; value: string };

interface BulkStatusPopoverContentProps {
  options: Option[];
  minWidth?: string;
  onSelect: (value: string) => void;
}

export default function BulkStatusPopoverContent({ options, minWidth = '180px', onSelect }: BulkStatusPopoverContentProps) {
  return (
    <div style={{ minWidth }}>
      {options.map(status => (
        <div
          key={status.value}
          onClick={() => onSelect(status.value)}
          style={{
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: '11px',
            borderRadius: '4px',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#f5f5f5'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          {status.label}
        </div>
      ))}
    </div>
  );
}
