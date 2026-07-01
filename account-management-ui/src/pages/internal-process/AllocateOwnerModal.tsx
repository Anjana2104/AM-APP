import React from 'react';
import { Checkbox, Modal, Select, Tag } from 'antd';
import type { ProcessRow } from './types';
import { deriveStatus } from './shared';

interface AllocateOwnerModalProps {
  open: boolean;
  allocateSingleRow: ProcessRow | null;
  allocateAnchor: string;
  setAllocateAnchor: (value: string) => void;
  allocateSelected: string[];
  setAllocateSelected: React.Dispatch<React.SetStateAction<string[]>>;
  unassignedRows: ProcessRow[];
  anchorOptions: Array<{ label: string; value: string }>;
  onOk: () => void;
  onCancel: () => void;
}

export function AllocateOwnerModal({ open, allocateSingleRow, allocateAnchor, setAllocateAnchor, allocateSelected, setAllocateSelected, unassignedRows, anchorOptions, onOk, onCancel }: AllocateOwnerModalProps) {
  return (
    <Modal
      title={<span style={{ fontSize: '13px' }}>{allocateSingleRow ? `Assign Owner — ${allocateSingleRow.sow || 'Record'}` : 'Allocate to Owner'}</span>}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText="Assign"
      width={allocateSingleRow ? 420 : 560}
      okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
    >
      <div style={{ marginTop: 12 }}>
        {allocateSingleRow ? (
          <div>
            <div style={{ background: '#f0f5ff', borderRadius: 6, padding: '8px 12px', marginBottom: 14, fontSize: '12px', color: '#262626' }}>
              <span style={{ color: '#8c8c8c', fontSize: '11px' }}>Process: </span>
              <strong>{allocateSingleRow.sow || '—'}</strong>
              {allocateSingleRow.accountAnchor && (
                <span style={{ marginLeft: 8, fontSize: '11px', color: '#8c8c8c' }}>
                  (currently: <Tag color="purple" style={{ fontSize: '10px' }}>{allocateSingleRow.accountAnchor}</Tag>)
                </span>
              )}
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 6 }}>Owner</div>
            <Select showSearch allowClear placeholder="Select or type owner name" value={allocateAnchor || undefined} onChange={value => setAllocateAnchor(value || '')} style={{ width: '100%' }} options={anchorOptions} notFoundContent={<div style={{ padding: '8px 12px', fontSize: '11px', color: '#8c8c8c' }}>No owners configured — add them in Configuration</div>} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 6 }}>Owner</div>
              <Select showSearch allowClear placeholder="Select or type owner name" value={allocateAnchor || undefined} onChange={value => setAllocateAnchor(value || '')} style={{ width: '100%' }} options={anchorOptions} notFoundContent={<div style={{ padding: '8px 12px', fontSize: '11px', color: '#8c8c8c' }}>No owners configured — add them in Configuration</div>} />
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Select process entries to assign — showing {unassignedRows.length} unassigned record(s)
            </div>
            {unassignedRows.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#8c8c8c', fontSize: '12px' }}>
                All records are already assigned to an anchor.
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid #f0f0f0', borderRadius: 6 }}>
                {unassignedRows.map(row => (
                  <div key={row.key} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #fafafa', cursor: 'pointer', background: allocateSelected.includes(row.key) ? '#f0f5ff' : '#fff' }} onClick={() => setAllocateSelected(state => state.includes(row.key) ? state.filter(key => key !== row.key) : [...state, row.key])}>
                    <Checkbox checked={allocateSelected.includes(row.key)} onChange={() => {}} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>{row.sow || '—'}</div>
                      <div style={{ fontSize: '10px', color: '#8c8c8c', marginTop: 1 }}>
                        {row.startDate && `Started: ${row.startDate} · `}
                        Status: {deriveStatus(row)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
