import React from 'react';
import { Button, Modal, Popconfirm, Select, Space } from 'antd';
import { CalendarOutlined, DeleteOutlined, EllipsisOutlined, PlusOutlined } from '@ant-design/icons';

export interface GenerateFYModalProps {
  open: boolean;
  canEdit: boolean;
  canDelete: boolean;
  generateFY: string | null;
  candidateFYs: string[];
  hasRows: boolean;
  onGenerateFYChange: (value: string | null) => void;
  onGenerate: () => void;
  onAddProject: () => void;
  onDeleteAll: () => void;
  onCancel: () => void;
}

export function GenerateFYModal({
  open,
  canEdit,
  canDelete,
  generateFY,
  candidateFYs,
  hasRows,
  onGenerateFYChange,
  onGenerate,
  onAddProject,
  onDeleteAll,
  onCancel,
}: GenerateFYModalProps) {
  return (
    <Modal
      title={<Space><EllipsisOutlined /><span style={{ fontSize: '13px' }}>More Actions</span></Space>}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={420}
    >
      <Space direction="vertical" style={{ width: '100%' }} size={12}>
        {canEdit && (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4 }}>
              <PlusOutlined style={{ color: '#52c41a', marginRight: 6 }} />Add New Project
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Add an empty project row. Invoice amount columns will be pre-filled with 0 for all existing months.
            </div>
            <Button size="small" type="primary" icon={<PlusOutlined />} style={{ fontSize: '11px' }} onClick={onAddProject}>
              Add Project
            </Button>
          </div>
        )}

        {canEdit && (
          <div style={{ border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4 }}>
              <CalendarOutlined style={{ color: '#1890ff', marginRight: 6 }} />Generate Empty Month Columns
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Add all 12 empty month columns for a fiscal year (Oct–Sep). Only missing months are added.
            </div>
            <Space size={8}>
              <Select
                placeholder="Select FY…"
                size="small"
                style={{ width: 160, fontSize: '11px' }}
                value={generateFY ?? undefined}
                onChange={(value) => onGenerateFYChange(value ?? null)}
                options={candidateFYs.map((fy) => ({ value: fy, label: fy }))}
                allowClear
              />
              <Button
                size="small"
                icon={<CalendarOutlined />}
                disabled={!generateFY}
                style={{
                  fontSize: '11px',
                  backgroundColor: generateFY ? '#d9d9d9' : '#f0f0f0',
                  color: generateFY ? '#262626' : '#8c8c8c',
                  borderColor: '#d9d9d9',
                  cursor: generateFY ? 'pointer' : 'not-allowed',
                }}
                onClick={onGenerate}
              >
                Generate
              </Button>
            </Space>
          </div>
        )}

        {canDelete && (
          <div style={{ border: '1px solid #fff1f0', borderRadius: 8, padding: '12px 16px', background: '#fff1f0' }}>
            <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: 4, color: '#cf1322' }}>
              <DeleteOutlined style={{ marginRight: 6 }} />Delete All Data
            </div>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 8 }}>
              Permanently removes all projects and invoice amounts from the database. This cannot be undone.
            </div>
            <Popconfirm
              title="Delete all invoice data?"
              description="This will permanently remove ALL projects and invoice amounts from the database."
              onConfirm={onDeleteAll}
              okText="Yes, delete all"
              cancelText="Cancel"
              okButtonProps={{ danger: true, size: 'small' }}
              cancelButtonProps={{ size: 'small' }}
            >
              <Button size="small" danger icon={<DeleteOutlined />} disabled={!hasRows} style={{ fontSize: '11px' }}>
                Delete All Data
              </Button>
            </Popconfirm>
          </div>
        )}
      </Space>
    </Modal>
  );
}
