import React from 'react';
import { Modal, Tag } from 'antd';
import type { BulkUploadResult } from './resourceTypes';

export interface BulkUploadModalProps {
  open: boolean;
  result: BulkUploadResult | null;
  onClose: () => void;
}

export const openBulkUploadFilePicker = (onFile: (file: File) => void) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.xlsx,.xls';
  input.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      onFile(file);
    }
  };
  input.click();
};

export const BulkUploadModal: React.FC<BulkUploadModalProps> = ({ open, result, onClose }) => {
  if (!result) {
    return null;
  }

  const { totalRows, uploadedCount, newCount, updCount, skippedRows, serverOk } = result;

  return (
    <Modal
      title={`Upload Result: ${uploadedCount} of ${totalRows} rows processed`}
      open={open}
      onOk={onClose}
      onCancel={onClose}
      okText="OK"
      width={560}
      destroyOnClose
    >
      <div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 14, padding: '10px 14px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
          <span style={{ fontSize: '13px' }}>
            <span style={{ color: '#52c41a', fontWeight: 600 }}>✓ {newCount} new &nbsp;·&nbsp; {updCount} updated</span>
            <span style={{ color: '#bbb', margin: '0 8px' }}>|</span>
            <span style={{ color: '#f5222d', fontWeight: 600 }}>✗ {skippedRows.length} skipped</span>
            <span style={{ color: '#bbb', margin: '0 8px' }}>|</span>
            <span style={{ color: '#8c8c8c' }}>Total: {totalRows} rows</span>
          </span>
        </div>
        <p style={{ fontWeight: 600, color: '#f5222d', marginBottom: 6 }}>
          Skipped rows ({skippedRows.length}):
        </p>
        <p style={{ fontSize: '12px', color: '#8c8c8c', marginBottom: 8 }}>
          Fix these rows in the file and re-upload to include them.
        </p>
        <div style={{ background: '#fff1f0', border: '1px solid #ffa39e', borderRadius: 6, padding: '8px 12px', maxHeight: 200, overflowY: 'auto' }}>
          {skippedRows.map(({ rowNum, reason, detail }) => (
            <div key={rowNum} style={{ fontSize: '12px', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Tag color="red" style={{ minWidth: 60, textAlign: 'center' }}>Row {rowNum}</Tag>
              <span style={{ color: '#f5222d', fontWeight: 500 }}>{reason}</span>
              {detail && <span style={{ color: '#8c8c8c' }}>— {detail}</span>}
            </div>
          ))}
        </div>
        {serverOk && (
          <p style={{ marginTop: 10, fontSize: '12px', color: '#52c41a' }}>
            ✓ Successfully saved to database.
          </p>
        )}
      </div>
    </Modal>
  );
};
