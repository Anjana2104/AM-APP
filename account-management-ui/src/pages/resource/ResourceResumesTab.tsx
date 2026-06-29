import React, { useState } from 'react';
import { Button, message, Tooltip, Typography, Upload } from 'antd';
import { DeleteOutlined, DownloadOutlined, FileTextOutlined, InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import { writeAoaSheetFile } from '../../utils/xlsxExport';

const { Text } = Typography;

function todayStr() {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function downloadFileFromBlob(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResourceResumesTab() {
  const { getAppValue } = useConfig();
  const { hasPermission } = useAuth();
  const spUrl = getAppValue('RESUME_STORAGE_URL') || '';
  const canDeleteResume = hasPermission('resources_info', 'delete');
  const [resumeList, setResumeList] = useState<{ key: string; file: File; uploadDate: string }[]>([]);

  const downloadTemplate = () => {
    writeAoaSheetFile(
      XLSX,
      [['Name', 'Employee ID', 'Role', 'Skills', 'Total Experience', 'Email']],
      'Resume Template',
      'Resume_Template.xlsx',
    );
  };

  const handleFile = (file: File) => {
    setResumeList(prev => [...prev, { key: `res_${Date.now()}`, file, uploadDate: todayStr() }]);
    if (spUrl) {
      message.success(<span><strong>{file.name}</strong> added. Use <em>Save to SP ↗</em> to store in SharePoint.</span>, 5);
    } else {
      message.success(`${file.name} uploaded`);
    }
    return false;
  };

  const handleDelete = (key: string) => {
    if (!canDeleteResume) {
      message.error('You do not have permission to remove resumes.');
      return;
    }
    setResumeList(prev => prev.filter(r => r.key !== key));
    message.success('Resume removed');
  };

  return (
    <div style={{ padding: '16px 0' }}>
      {spUrl ? (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 Resumes should also be saved to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>Open SharePoint Folder ↗</a>
        </div>
      ) : (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure the <strong>RESUME_STORAGE_URL</strong> in App Configuration to link to your SharePoint folder for centralized resume storage.
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate} style={{ fontSize: '11px', borderRadius: 6 }}>
          Download Template
        </Button>
      </div>

      <Upload.Dragger multiple beforeUpload={handleFile} showUploadList={false} style={{ borderRadius: 8, marginBottom: 20 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: '#722ED1' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px' }}>Click or drag resume files to upload</p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports PDF, Word, and all file types. Store centrally in the configured SharePoint folder.
        </p>
      </Upload.Dragger>

      {resumeList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '40px 0', textAlign: 'center' }}>
          <FileTextOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No resumes uploaded yet in this session.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded Resumes ({resumeList.length})
          </Text>
          {resumeList.map(({ key, file, uploadDate }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 8, border: '1px solid #f0f0f0', borderLeft: '3px solid #722ED1', padding: '10px 14px', marginBottom: 8, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <FileTextOutlined style={{ color: '#722ED1', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>Uploaded: {uploadDate} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB</div>
              </div>
              {spUrl && (
                <Tooltip title="Downloads locally and opens SharePoint — drag the file into the SP folder" overlayInnerStyle={{ fontSize: '11px', maxWidth: 260 }}>
                  <Button size="small" style={{ borderRadius: 6, fontSize: '10px', borderColor: '#722ED1', color: '#722ED1' }} onClick={() => { downloadFileFromBlob(file); window.open(spUrl, '_blank', 'noopener,noreferrer'); }}>
                    Save to SP ↗
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Download" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFileFromBlob(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
              {canDeleteResume && (
                <Tooltip title="Remove" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(key)} style={{ borderRadius: 6 }} />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
