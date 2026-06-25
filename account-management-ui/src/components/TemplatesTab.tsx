/**
 * TemplatesTab.tsx
 * 
 * Template management interface for uploading and managing PIW templates,
 * Holiday Calendar PDFs, and other configurable templates
 */

import React, { useState, useEffect } from 'react';
import {
  Upload, Button, Table, Space, message, Modal, Tag, Tooltip, Popconfirm,
  Divider, Empty, Typography, Card, Select, Input
} from 'antd';
import {
  UploadOutlined, DeleteOutlined, DownloadOutlined, InboxOutlined,
  CalendarOutlined, FileExcelOutlined, FileOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import * as templateApi from '../api/templateApi';

const { Text } = Typography;

const validateFile = (file: File, type: string): boolean => {
  const maxSize = 10 * 1024 * 1024; // 10MB
  
  if (file.size > maxSize) {
    message.error('File size must be less than 10MB');
    return false;
  }

  if (type === 'piw_template') {
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel.sheet.macroEnabled.12' // .xlsm
    ];
    const validExts = ['.xlsx', '.xls', '.xlsm'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      message.error('Please upload a valid Excel file (.xlsx, .xls, or .xlsm)');
      return false;
    }
  } else if (type === 'sow_template') {
    const validTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    const validExts = ['.doc', '.docx'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      message.error('Please upload a valid Word file (.doc or .docx)');
      return false;
    }
  } else if (type === 'holiday_calendar') {
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!['.xlsx', '.xls'].includes(ext)) {
      message.error('Please upload an Excel file (.xlsx or .xls)');
      return false;
    }
  }
  
  return true;
};

const TEMPLATE_TYPES = [
  { value: 'piw_template', label: '📋 PIW Template (.xlsm)', icon: <FileExcelOutlined /> },
  { value: 'sow_template', label: '📄 SOW Template (.docx)', icon: <FileOutlined /> },
  { value: 'holiday_calendar', label: '📅 Holiday Calendar (.xlsx)', icon: <CalendarOutlined /> },
];

interface TemplateItem {
  key?: string;
  id: string;
  type: string;
  // Support both naming conventions (camelCase from localStorage, snake_case from server)
  fileName?: string;
  file_name?: string;
  fileSize?: number;
  file_size?: number;
  uploadedAt?: string;
  uploaded_at?: string;
  uploadedBy?: string;
  uploaded_by?: string;
  mimeType?: string;
  mime_type?: string;
  description?: string;
}

export function TemplatesTab() {
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    const result = await templateApi.getTemplates();
    if (result.ok && result.data) {
      const mappedTemplates = result.data.map((t, i) => ({
        key: `${i}`,
        ...t as any
      }));
      setTemplates(mappedTemplates);
    }
    setLoading(false);
  };

  const handleUpload = (file: File) => {
    if (!selectedType) {
      message.error('Please select a template type');
      return false;
    }

    const isValidFile = validateFile(file, selectedType);
    if (!isValidFile) {
      return false;
    }

    // Check if template of this type already exists
    const existingTemplate = templates.find(t => t.type === selectedType);
    if (existingTemplate) {
      Modal.confirm({
        title: 'Replace Existing Template?',
        content: `A ${getTypeName(selectedType)} already exists. Replace it?`,
        okText: 'Replace',
        cancelText: 'Cancel',
        onOk: async () => {
          await uploadNewTemplate(file);
        }
      });
    } else {
      uploadNewTemplate(file);
    }

    return false;
  };

  const uploadNewTemplate = async (file: File) => {
    setLoading(true);
    const result = await templateApi.uploadTemplate(file, selectedType, getTypeName(selectedType));
    if (result.ok) {
      message.success(`${getTypeName(selectedType)} uploaded successfully`);
      setSelectedType('');
      await loadTemplates();
    } else {
      message.error(result.error || 'Upload failed');
    }
    setLoading(false);
  };

  const handleDownload = async (template: TemplateItem) => {
    try {
      const fileName = template.file_name || template.fileName;
      await templateApi.downloadTemplate(template.id, fileName);
      message.success('Download started');
    } catch (e: any) {
      message.error(e.message || 'Download failed');
    }
  };

  const handleDelete = async (template: TemplateItem) => {
    setLoading(true);
    const result = await templateApi.deleteTemplate(template.id);
    if (result.ok) {
      message.success(`${getTypeName(template.type)} deleted`);
      await loadTemplates();
    } else {
      message.error(result.error || 'Delete failed');
    }
    setLoading(false);
  };

  const getTypeName = (type: string) => {
    return TEMPLATE_TYPES.find(t => t.value === type)?.label.split(' ')[1] || type;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'piw_template': return <FileExcelOutlined style={{ fontSize: 16, color: '#52c41a' }} />;
      case 'holiday_calendar': return <CalendarOutlined style={{ fontSize: 16, color: '#1890ff' }} />;
      case 'sow_template': return <FileOutlined style={{ fontSize: 16, color: '#fa8c16' }} />;
      default: return <FileOutlined style={{ fontSize: 16, color: '#8c8c8c' }} />;
    }
  };

  const tableColumns = [
    {
      title: 'Template Type',
      dataIndex: 'type',
      key: 'type',
      width: 150,
      render: (type: string) => {
        const typeObj = TEMPLATE_TYPES.find(t => t.value === type);
        return (
          <Space size={4}>
            {getFileIcon(type)}
            <span style={{ fontSize: '12px' }}>{typeObj?.label.split(' ')[1] || type}</span>
          </Space>
        );
      }
    },
    {
      title: 'File Name',
      dataIndex: ['file_name', 'fileName'],
      key: 'fileName',
      render: (text: string) => <span style={{ fontSize: '12px', fontFamily: 'monospace' }}>{text}</span>
    },
    {
      title: 'Size',
      dataIndex: ['file_size', 'fileSize'],
      key: 'fileSize',
      width: 80,
      render: (size: number) => <span style={{ fontSize: '12px' }}>{formatFileSize(size)}</span>
    },
    {
      title: 'Uploaded',
      dataIndex: ['uploaded_at', 'uploadedAt'],
      key: 'uploadedAt',
      width: 120,
      render: (date: string) => <span style={{ fontSize: '12px' }}>{new Date(date).toLocaleDateString()}</span>
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_: any, template: TemplateItem) => (
        <Space size={4}>
          <Tooltip title="Download">
            <Button 
              icon={<DownloadOutlined />} 
              size="small" 
              onClick={() => handleDownload(template)}
              style={{ borderRadius: 4 }}
            />
          </Tooltip>
          <Popconfirm
            title="Delete template?"
            description={`Are you sure you want to delete ${template.file_name || template.fileName}?`}
            onConfirm={() => handleDelete(template)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true, size: 'small' }}
            cancelButtonProps={{ size: 'small' }}
          >
            <Tooltip title="Delete">
              <Button 
                icon={<DeleteOutlined />} 
                size="small" 
                danger
                style={{ borderRadius: 4 }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '0 12px' }}>
      {/* Upload Section */}
      <Card size="small" style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <Space size={6}>
            <Text strong style={{ fontSize: 12 }}>Upload Template</Text>
            <Tooltip title="Only the latest version uploaded will be used." overlayInnerStyle={{ fontSize: 11 }}>
              <InfoCircleOutlined style={{ fontSize: 12, color: '#8c8c8c', cursor: 'pointer' }} />
            </Tooltip>
          </Space>
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Template Type</div>
          <Select
            placeholder="Select template type..."
            value={selectedType}
            onChange={setSelectedType}
            options={TEMPLATE_TYPES}
            style={{ width: '100%' }}
            size="small"
          />
        </div>

        {selectedType && (
          <Upload.Dragger
            multiple={false}
            beforeUpload={handleUpload}
            showUploadList={false}
            disabled={loading}
            accept={selectedType === 'piw_template' ? '.xlsx,.xls,.xlsm' : selectedType === 'sow_template' ? '.doc,.docx' : selectedType === 'holiday_calendar' ? '.xlsx,.xls' : '*'}
            style={{ borderRadius: 6, marginBottom: 12 }}
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 32, color: '#1890ff' }} />
            </p>
            <p style={{ fontSize: '12px', fontWeight: 600, margin: '8px 0 4px' }}>
              {selectedType === 'piw_template' 
                ? 'Click or drag PIW template (.xlsm) to upload'
                : selectedType === 'sow_template'
                ? 'Click or drag SOW template (.docx) to upload'
                : selectedType === 'holiday_calendar'
                ? 'Click or drag Holiday Calendar (.xlsx) to upload'
                : 'Click or drag file to upload'
              }
            </p>
            <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
              {selectedType === 'piw_template' 
                ? 'Excel file with macro support'
                : selectedType === 'sow_template'
                ? 'Word document format'
                : selectedType === 'holiday_calendar'
                ? 'Excel format (.xlsx)'
                : 'Supported format'
              }
            </p>
          </Upload.Dragger>
        )}
      </Card>

      {/* Templates List */}
      <div>
        <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 12 }}>
          Uploaded Templates
        </Text>

        {templates.length === 0 ? (
          <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 6, padding: '40px 0', textAlign: 'center' }}>
            <FileOutlined style={{ fontSize: 24, color: '#d9d9d9', marginBottom: 8, display: 'block' }} />
            <Text type="secondary" style={{ fontSize: '12px' }}>No templates uploaded yet. Select a type and upload one above.</Text>
          </div>
        ) : (
          <div className="compact-table">
            <Table
              columns={tableColumns}
              dataSource={templates}
              rowKey="key"
              size="small"
              loading={loading}
              pagination={false}
              style={{ background: '#fff', borderRadius: 6 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

