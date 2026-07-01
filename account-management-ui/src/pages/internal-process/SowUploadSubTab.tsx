import React, { useState } from 'react';
import { Button, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { DownloadOutlined, FileProtectOutlined, InboxOutlined } from '@ant-design/icons';
import * as processApi from '../../api/processApi';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { downloadFile, todayDateStr } from './shared';
import type { ProcessRow } from './types';

const { Text } = Typography;

interface SowUploadSubTabProps {
  processRows: ProcessRow[];
  onRowCreated: (row: ProcessRow) => void;
}

export function SowUploadSubTab({ processRows, onRowCreated }: SowUploadSubTabProps) {
  const { getAppValue } = useConfig();
  const { currentUser } = useAuth();
  const spUrl = getAppValue('SOW_STORAGE_URL') || '';
  const [uploading, setUploading] = useState(false);
  const [uploadedList, setUploadedList] = useState<{ key: string; file: File; sowName: string; date: string }[]>([]);

  const handleFile = async (file: File) => {
    const sowName = file.name.replace(/\.[^/.]+$/, '').trim();
    const exists = processRows.some(row => row.sow.trim().toLowerCase() === sowName.toLowerCase());
    if (exists) {
      message.error(
        <span>
          A process with SOW name <strong>"{sowName}"</strong> already exists.<br />
          Please rename the file to a unique name before uploading.
        </span>,
        6,
      );
      return false;
    }

    setUploading(true);
    try {
      const response = await processApi.createProcess({
        sow: sowName,
        sno: 0,
        startDate: todayDateStr(),
        signedSow: '',
        piw: '',
        active: 'Yes',
        salesforceId: '',
        promsId: '',
        budget: '',
        openAirCode: '',
        eprev: '',
        comments: '',
        accountAnchor: '',
        changedBy: currentUser?.username,
      });

      if (response.ok) {
        const newRow: ProcessRow = {
          key: `pr_sow_${Date.now()}`,
          id: response.id,
          sno: processRows.length + 1,
          processId: response.id ? `P${response.id}` : '',
          startDate: todayDateStr(),
          sow: sowName,
          signedSow: '',
          piw: '',
          active: 'Yes',
          salesforceId: '',
          promsId: '',
          budget: '',
          openAirCode: '',
          eprev: '',
          comments: '',
          sowFile: file,
          accountAnchor: '',
        };
        onRowCreated(newRow);
        setUploadedList(prev => [...prev, { key: `upl_${Date.now()}`, file, sowName, date: todayDateStr() }]);

        if (spUrl) {
          message.success(
            <span>
              Process <strong>"{sowName}"</strong> created.&nbsp;
              Click <em>Open SharePoint ↗</em> to save the file there.
            </span>,
            6,
          );
        } else {
          message.success(`Process "${sowName}" created successfully.`);
        }
      } else {
        message.error('Failed to create process record. Please try again.');
      }
    } catch (error: any) {
      message.error(error.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
    return false;
  };

  return (
    <div>
      {spUrl ? (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 After uploading here, save the document to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>
            Open SharePoint Folder ↗
          </a>
        </div>
      ) : (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure <strong>SOW_STORAGE_URL</strong> in App Configuration to link to your SharePoint SOW folder.
        </div>
      )}

      <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#389e0d' }}>
        📌 The <strong>file name</strong> (without extension) will become the <strong>SOW Name</strong> in Process Overview. Make sure it is unique before uploading.
      </div>

      <Upload.Dragger multiple={false} beforeUpload={handleFile} showUploadList={false} disabled={uploading} style={{ borderRadius: 8, marginBottom: 20 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: '#1890ff' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px' }}>
          {uploading ? 'Creating process record…' : 'Click or drag SOW document to upload'}
        </p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports all file types. File name = SOW Name. Must be unique. Automatically creates a Process Overview entry.
        </p>
      </Upload.Dragger>

      {uploadedList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '32px 0', textAlign: 'center' }}>
          <FileProtectOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 8, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No SOW documents uploaded in this session.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded this session ({uploadedList.length})
          </Text>
          {uploadedList.map(({ key, file, sowName, date }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', borderLeft: '3px solid #52c41a', padding: '10px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <FileProtectOutlined style={{ color: '#52c41a', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                  SOW: {sowName} &nbsp;·&nbsp; {date} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Tag color="green" style={{ fontSize: '10px', flexShrink: 0 }}>Process Created</Tag>
              {spUrl && (
                <Tooltip title="Open SharePoint folder to save the file there" overlayInnerStyle={{ fontSize: '11px', maxWidth: 220 }}>
                  <Button
                    size="small"
                    style={{ borderRadius: 6, fontSize: '10px', borderColor: '#1890ff', color: '#1890ff' }}
                    onClick={() => {
                      downloadFile(file);
                      window.open(spUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Save to SP ↗
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Download file" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFile(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
