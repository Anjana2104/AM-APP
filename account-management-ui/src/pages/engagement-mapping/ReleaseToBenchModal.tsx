import { MessageOutlined } from '@ant-design/icons';
import { Button, Input, Modal, Select } from 'antd';
import type { Dispatch, SetStateAction } from 'react';
import type { ResourceRow } from '../ResourceHub';

export interface ReleaseToBenchModalProps {
  open: boolean;
  saving: boolean;
  releaseTargets: ResourceRow[];
  releaseTag: string;
  setReleaseTag: Dispatch<SetStateAction<string>>;
  releaseComment: string;
  setReleaseComment: Dispatch<SetStateAction<string>>;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ReleaseToBenchModal({ open, saving, releaseTargets, releaseTag, setReleaseTag, releaseComment, setReleaseComment, onCancel, onConfirm }: ReleaseToBenchModalProps) {
  return (
    <Modal
      open={open}
      title={<span style={{ color: '#ff4d4f' }}>🔁 Release Resource{releaseTargets.length > 1 ? `s (${releaseTargets.length})` : ''} to Bench</span>}
      onCancel={onCancel}
      footer={null}
      width={480}
      maskClosable={!saving}
    >
      <div style={{ paddingTop: 8 }}>
        <div style={{ background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: 6, padding: '10px 14px', marginBottom: 16 }}>
          {releaseTargets.length === 1 ? (
            <>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>{releaseTargets[0].empName}</div>
              <div style={{ color: '#888', fontSize: '12px' }}>
                {releaseTargets[0].raId} · Current status: <strong>{releaseTargets[0].allocationStatus || 'Active'}</strong>
                {releaseTargets[0].engagement ? ` · ${releaseTargets[0].engagement}` : ''}
              </div>
            </>
          ) : (
            <div style={{ fontWeight: 600, fontSize: '14px' }}>
              {releaseTargets.length} resources will be released to bench
            </div>
          )}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>
            <MessageOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            Reason / Tag <span style={{ color: '#ff4d4f' }}>*</span>
          </div>
          <Select
            value={releaseTag}
            onChange={(value) => setReleaseTag(value)}
            style={{ width: '100%' }}
            options={[
              { value: 'Rejected by Client', label: 'Rejected by Client' },
              { value: 'Project Ended', label: 'Project Ended' },
              { value: 'Candidate Declined', label: 'Candidate Declined' },
              { value: 'Budget Constraints', label: 'Budget Constraints' },
              { value: 'Role No Longer Open', label: 'Role No Longer Open' },
              { value: 'Skill Mismatch', label: 'Skill Mismatch' },
              { value: 'On Hold', label: 'On Hold' },
              { value: 'Other', label: 'Other' },
            ]}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>
            Additional Notes (optional)
          </div>
          <Input.TextArea
            rows={3}
            placeholder="Add any notes about this release decision…"
            value={releaseComment}
            onChange={(e) => setReleaseComment(e.target.value)}
            maxLength={500}
            showCount
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Button disabled={saving} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="primary" danger loading={saving} onClick={onConfirm} style={{ color: '#fff', fontWeight: 600 }}>
            Confirm Release to Bench
          </Button>
        </div>
      </div>
    </Modal>
  );
}
