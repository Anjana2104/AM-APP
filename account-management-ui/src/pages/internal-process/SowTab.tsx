import React, { useState } from 'react';
import { Button, Popconfirm, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { DeleteOutlined, DownloadOutlined, FileProtectOutlined, InboxOutlined } from '@ant-design/icons';
import * as templateApi from '../../api/templateApi';
import { downloadFile, todayDateStr } from './shared';

const { Text } = Typography;

interface SowTabProps {
  onUpload: (file: File, processKey: string) => void;
  onDelete: (processKey: string) => void;
  spUrl?: string;
}

export function SowTab({ onUpload, onDelete, spUrl = '' }: SowTabProps) {
  const [sowList, setSowList] = useState<{ key: string; processKey: string; file: File; uploadDate: string }[]>([]);

  const handleSowFile = (file: File) => {
    const processKey = `pr_sow_${Date.now()}`;
    setSowList(prev => [...prev, { key: `sow_${Date.now()}`, processKey, file, uploadDate: todayDateStr() }]);
    onUpload(file, processKey);
    if (spUrl) {
      message.success(
        <span>
          <strong>{file.name}</strong> added to Process.&nbsp;
          Click <em>Save to SP ↗</em> on the row to download it and open the SharePoint folder.
        </span>,
        6,
      );
    } else {
      message.success(`${file.name} uploaded and added to Process`);
    }
    return false;
  };

  const handleDelete = (key: string, processKey: string) => {
    setSowList(prev => prev.filter(item => item.key !== key));
    onDelete(processKey);
    message.success('SOW removed');
  };

  return (
    <div>
      {spUrl && (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 SOW documents should also be saved to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>Open SharePoint Folder ↗</a>
        </div>
      )}
      {!spUrl && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure the <strong>SOW_STORAGE_URL</strong> in App Configuration to link to your SharePoint folder for centralized SOW document storage.
        </div>
      )}

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, color: '#262626' }}>SOW Template</Text>
        <Tooltip title="Download template" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button
            icon={<DownloadOutlined />}
            size="small"
            type="text"
            onClick={async () => {
              try {
                const result = await templateApi.getTemplates('sow_template');
                if (result.ok && result.data && result.data.length > 0) {
                  const template = result.data[0];
                  const fileName = template.file_name || template.fileName;
                  await templateApi.downloadTemplate(template.id, fileName);
                  message.success('SOW template downloaded');
                } else {
                  message.info('No SOW template uploaded yet. Upload one in Configuration > Templates');
                }
              } catch (error: any) {
                message.error(error.message || 'Download failed');
              }
            }}
            style={{ borderRadius: 4, color: '#1890ff' }}
          />
        </Tooltip>
      </div>

      <Upload.Dragger multiple={false} beforeUpload={handleSowFile} showUploadList={false} style={{ borderRadius: 8, marginBottom: 20 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: '#1890ff' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px' }}>Click or drag SOW document to upload</p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports PDF, Word, Excel, and all file types. Each upload auto-creates a Process entry with today's date as Start Date.
        </p>
      </Upload.Dragger>

      {sowList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '40px 0', textAlign: 'center' }}>
          <FileProtectOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No SOW documents uploaded yet.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded SOW Documents ({sowList.length})
          </Text>
          {sowList.map(({ key, processKey, file, uploadDate }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', borderLeft: '3px solid #1890ff', padding: '10px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <FileProtectOutlined style={{ color: '#1890ff', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                  Uploaded: {uploadDate} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Tag color="green" style={{ fontSize: '10px', flexShrink: 0 }}>Added to Process</Tag>
              {spUrl && (
                <Tooltip title="Downloads the file locally and opens the SharePoint folder — drag the file into the SP folder to save it there" overlayInnerStyle={{ fontSize: '11px', maxWidth: 260 }}>
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
              <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFile(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
              <Popconfirm title="Delete this SOW?" description="This will also remove its entry from the Process tab." onConfirm={() => handleDelete(key, processKey)} okText="Delete" cancelText="Cancel" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                <Tooltip title="Delete SOW" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
                </Tooltip>
              </Popconfirm>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
