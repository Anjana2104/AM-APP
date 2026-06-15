/**
 * Configuration.tsx
 * 
 * App Settings — Global dropdown configuration manager for system-wide
 * settings, custom fields, and Excel import/export of configurations
 * UI Location: Settings & Configuration > Configuration > App Settings
 * Page ID: configuration
 */
import React, { useState } from 'react';
import {
  Button, Input, Modal, Form, Tag, Space, Typography,
  Divider, Tooltip, Popconfirm, Empty, message, Upload, Select, Checkbox, Tabs,
  Table, Switch, Badge,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SettingOutlined,
  SaveOutlined, CloseOutlined, UploadOutlined, DownloadOutlined,
  LinkOutlined, AppstoreOutlined, TableOutlined, BellOutlined,
  HolderOutlined,
} from '@ant-design/icons';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as XLSX from 'xlsx';
import { useConfig, ConfigItem, AVAILABLE_LINK_TARGETS, AppValue } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import {
  NotificationTrigger,
  TriggerSource,
  getNotificationTriggers,
  getTriggerSources,
  createNotificationTrigger,
  updateNotificationTrigger,
  deleteNotificationTrigger,
  toggleNotificationTrigger,
  reorderNotificationTriggers,
} from '../api/notificationTriggerApi';
import { getUserGroups, UserGroup } from '../api/notificationApi';

const { Title, Text } = Typography;

const TAG_COLORS = [
  'default', 'blue', 'cyan', 'geekblue', 'green', 'gold',
  'lime', 'magenta', 'orange', 'purple', 'red', 'volcano',
];

export function Configuration() {
  return (
    <div style={{ background: '#f5f5f5', minHeight: '100vh', padding: '24px' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '20px' }}>
          <Space align="center" style={{ marginBottom: 2 }}>
            <SettingOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
            <Title level={4} style={{ margin: 0 }}>Configuration</Title>
          </Space>
          <div style={{ marginLeft: 2, marginTop: 2 }}>
            <Text strong style={{ fontSize: '13px', color: '#595959', display: 'block' }}>
              Manage Dropdown Values
            </Text>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Configure dropdowns and application key-value settings used across all modules.
            </Text>
          </div>
        </div>
        <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8' }}>
          <Tabs
            defaultActiveKey="dropdowns"
            size="small"
            style={{ padding: '0 16px' }}
            items={[
              {
                key: 'dropdowns',
                label: <span><AppstoreOutlined /> Dropdowns</span>,
                children: <DropdownsTab />,
              },
              {
                key: 'values',
                label: <span><TableOutlined /> Values</span>,
                children: <ValuesTab />,
              },
              {
                key: 'triggers',
                label: <span><BellOutlined /> Notification Triggers</span>,
                children: <NotificationTriggersTab />,
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// ── Dropdowns Tab ─────────────────────────────────────────────────────

function DropdownsTab() {
  const { configs, addConfigType, renameConfigType, deleteConfigType, bulkImportConfigs, addItem, removeItem, editItem, updateLinks, clearAllConfigs } = useConfig();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('configuration', 'edit');
  const canDelete = hasPermission('configuration', 'delete');

  const [selectedId, setSelectedId] = useState<string | null>(configs[0]?.id ?? null);
  const [newTypeModal, setNewTypeModal] = useState(false);
  const [newTypeForm] = Form.useForm();
  const [linksModal, setLinksModal] = useState(false);

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const [addItemInput, setAddItemInput] = useState('');
  const [addItemColor, setAddItemColor] = useState('default');

  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editColor, setEditColor] = useState('default');

  const selectedConfig = configs.find(c => c.id === selectedId) ?? null;

  const handleAddItem = () => {
    const label = addItemInput.trim();
    if (!label || !selectedId) return;
    if (selectedConfig?.items.some(i => i.label.toLowerCase() === label.toLowerCase())) {
      message.warning('An item with this label already exists');
      return;
    }
    addItem(selectedId, label, addItemColor);
    setAddItemInput('');
    setAddItemColor('default');
    message.success('Value added');
  };

  const handleEditSave = () => {
    if (!editingItem || !selectedId) return;
    editItem(selectedId, editingItem.value, editLabel.trim(), editColor);
    setEditingItem(null);
    message.success('Value updated');
  };

  const handleCreateType = (values: { name: string; description: string }) => {
    addConfigType(values.name.trim(), values.description?.trim() ?? '');
    newTypeForm.resetFields();
    setNewTypeModal(false);
    message.success(`Configuration "${values.name}" created`);
  };

  const handleRenameSave = (id: string) => {
    const name = renameValue.trim();
    if (!name) { message.warning('Name cannot be empty'); return; }
    renameConfigType(id, name);
    setRenamingId(null);
    message.success('Renamed successfully');
  };

  const handleDownloadTemplate = () => {
    // Sheet 1: template rows (Linked To uses semicolon-separated IDs)
    const template = [
      { 'Configuration Type': 'Request Priority', 'Value': 'High', 'Color': 'red', 'Linked To': '' },
      { 'Configuration Type': 'Request Priority', 'Value': 'Medium', 'Color': 'gold', 'Linked To': '' },
      { 'Configuration Type': 'Request Priority', 'Value': 'Low', 'Color': 'green', 'Linked To': '' },
      { 'Configuration Type': 'Skill Category', 'Value': 'Frontend', 'Color': 'blue', 'Linked To': 'resource_skill_field' },
      { 'Configuration Type': 'Skill Category', 'Value': 'Backend', 'Color': 'cyan', 'Linked To': 'resource_skill_field' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 40 }];

    // Sheet 2: available link target IDs
    const linkTargets = AVAILABLE_LINK_TARGETS.map(t => ({
      'Link Target ID': t.id,
      'Label': t.label,
      'Module': t.module,
    }));
    const ws2 = XLSX.utils.json_to_sheet(linkTargets);
    ws2['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Config Template');
    XLSX.utils.book_append_sheet(wb, ws2, 'Available Link Targets');
    XLSX.writeFile(wb, 'Configuration_Upload_Template.xlsx');
  };

  const handleBulkUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { message.warning('No data found in the file'); return; }

        // Robust header matching (trim + case-insensitive)
        const getField = (row: Record<string, string>, ...keys: string[]) => {
          for (const k of Object.keys(row)) {
            if (keys.some(key => k.trim().toLowerCase() === key.toLowerCase())) return (row[k] || '').toString().trim();
          }
          return '';
        };

        // Group rows by config type name, also capture linked_to per type
        const typeMap: Record<string, { values: string[]; linkedTo: string[] }> = {};
        rows.forEach(row => {
          const typeName = getField(row, 'Configuration Type', 'Config Type', 'configuration_type', 'Type', 'Name');
          const value = getField(row, 'Value', 'value', 'Label', 'label', 'Item');
          const linkedToRaw = getField(row, 'Linked To', 'linked_to', 'LinkedTo', 'Links');
          if (typeName) {
            if (!typeMap[typeName]) typeMap[typeName] = { values: [], linkedTo: [] };
            if (value) typeMap[typeName].values.push(value);
            // Parse semicolon-separated link IDs; only add valid ones
            if (linkedToRaw) {
              linkedToRaw.split(';').map(s => s.trim()).filter(Boolean).forEach(id => {
                if (AVAILABLE_LINK_TARGETS.some(t => t.id === id) && !typeMap[typeName].linkedTo.includes(id)) {
                  typeMap[typeName].linkedTo.push(id);
                }
              });
            }
          }
        });

        if (Object.keys(typeMap).length === 0) {
          message.warning('No valid data found. Ensure columns are "Configuration Type" and "Value".');
          return;
        }

        const entries = Object.entries(typeMap).map(([name, { values }]) => ({ name, values }));
        const { created, added } = bulkImportConfigs(entries);

        // Apply linked_to for entries that specify it
        Object.entries(typeMap).forEach(([name, { linkedTo }]) => {
          if (linkedTo.length > 0) {
            setTimeout(() => {
              const found = configs.find(c => c.name.toLowerCase() === name.toLowerCase());
              if (found) updateLinks(found.id, linkedTo);
            }, 300);
          }
        });

        if (created > 0 || added > 0) {
          message.success(`Imported: ${created} new type(s), ${added} value(s) added`);
          // Select the first imported type if nothing selected or newly created
          const firstEntry = entries[0];
          if (firstEntry) {
            setTimeout(() => {
              const found = configs.find(c => c.name.toLowerCase() === firstEntry.name.toLowerCase());
              if (found) setSelectedId(found.id);
            }, 200);
          }
        } else {
          message.info('No new items to import (all values already exist)');
        }
      } catch {
        message.error('Failed to read file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleLinksSave = (checkedValues: string[]) => {
    if (!selectedId) return;
    updateLinks(selectedId, checkedValues);
    setLinksModal(false);
    message.success('Links updated');
  };

  const handleExportConfigs = () => {
    const rows: Record<string, string>[] = [];
    configs.forEach(cfg => {
      const linkedToLabels = (cfg.linkedTo ?? [])
        .map(id => AVAILABLE_LINK_TARGETS.find(t => t.id === id)?.label ?? id)
        .join('; ');
      const linkedToIds = (cfg.linkedTo ?? []).join(';');
      cfg.items.forEach(item => {
        rows.push({
          'Configuration Type': cfg.name,
          'Value': item.label,
          'Color': item.color || 'default',
          'Linked To': linkedToIds,
          'Linked To (Labels)': linkedToLabels,
        });
      });
      if (cfg.items.length === 0) {
        rows.push({
          'Configuration Type': cfg.name,
          'Value': '',
          'Color': '',
          'Linked To': linkedToIds,
          'Linked To (Labels)': linkedToLabels,
        });
      }
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }, { wch: 12 }, { wch: 50 }, { wch: 60 }];

    // Sheet 2: available link target reference
    const linkTargets = AVAILABLE_LINK_TARGETS.map(t => ({
      'Link Target ID': t.id,
      'Label': t.label,
      'Module': t.module,
    }));
    const ws2 = XLSX.utils.json_to_sheet(linkTargets);
    ws2['!cols'] = [{ wch: 40 }, { wch: 40 }, { wch: 25 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Configurations');
    XLSX.utils.book_append_sheet(wb, ws2, 'Available Link Targets');
    XLSX.writeFile(wb, 'Configurations_Export.xlsx');
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

          {/* ─── Left panel: config type list ─────────────────── */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <div style={{ background: '#fafafa', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '13px' }}>Configuration Types</Text>
                  {canEdit && (
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setNewTypeModal(true)}
                    style={{ borderRadius: '6px', fontSize: '11px' }}
                  >
                    New
                  </Button>
                  )}
                </div>
                {/* Icon-only toolbar — labels visible on hover */}
                <Space size={4}>
                  {canEdit && (
                  <Tooltip title="Upload from Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Upload accept=".xlsx,.xls" beforeUpload={handleBulkUpload} showUploadList={false}>
                      <Button size="small" icon={<UploadOutlined />} style={{ borderRadius: '6px' }} />
                    </Upload>
                  </Tooltip>
                  )}
                  <Tooltip title="Download template" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ borderRadius: '6px' }} />
                  </Tooltip>
                  <Tooltip title="Export all to Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button size="small" icon={<DownloadOutlined />} onClick={handleExportConfigs} style={{ borderRadius: '6px', color: '#52c41a', borderColor: '#52c41a' }} />
                  </Tooltip>
                  {canDelete && (
                  <Popconfirm
                    title="Delete all non-built-in configurations?"
                    description="This will permanently remove all custom configuration types and their values."
                    onConfirm={() => { clearAllConfigs(); message.success('All configurations deleted'); }}
                    okText="Delete All"
                    okButtonProps={{ danger: true, size: 'small' }}
                    cancelButtonProps={{ size: 'small' }}
                  >
                    <Tooltip title="Delete all" overlayInnerStyle={{ fontSize: '11px' }}>
                      <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: '6px' }} />
                    </Tooltip>
                  </Popconfirm>
                  )}
                </Space>
              </div>

              <div style={{ padding: '8px' }}>
                {configs.map(cfg => (
                  <div
                    key={cfg.id}
                    onClick={() => { if (renamingId !== cfg.id) setSelectedId(cfg.id); }}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: selectedId === cfg.id ? '#e6f4ff' : 'transparent',
                      border: selectedId === cfg.id ? '1px solid #91caff' : '1px solid transparent',
                      marginBottom: '4px',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {renamingId === cfg.id ? (
                          <Space size={4} onClick={e => e.stopPropagation()}>
                            <Input
                              size="small"
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onPressEnter={() => handleRenameSave(cfg.id)}
                              style={{ fontSize: '11px', width: '140px' }}
                              autoFocus
                            />
                            <Button size="small" type="primary" icon={<SaveOutlined />} onClick={() => handleRenameSave(cfg.id)} style={{ padding: '0 6px' }} />
                            <Button size="small" icon={<CloseOutlined />} onClick={() => setRenamingId(null)} style={{ padding: '0 6px' }} />
                          </Space>
                        ) : (
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {cfg.name}
                          </div>
                        )}
                      </div>

                      {renamingId !== cfg.id && (
                        <Space size={2} onClick={e => e.stopPropagation()}>
                          {canEdit && (
                          <Tooltip title="Rename">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={e => { e.stopPropagation(); setRenamingId(cfg.id); setRenameValue(cfg.name); }}
                              style={{ color: '#595959', opacity: 0.7 }}
                            />
                          </Tooltip>
                          )}
                          {canDelete && (
                          <Popconfirm
                              title="Delete this configuration?"
                              description="This will permanently remove this configuration type."
                              onConfirm={e => { e?.stopPropagation(); deleteConfigType(cfg.id); if (selectedId === cfg.id) setSelectedId(configs[0]?.id ?? null); }}
                              onCancel={e => e?.stopPropagation()}
                              okText="Delete"
                              okButtonProps={{ danger: true }}
                            >
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} style={{ opacity: 0.6 }} />
                            </Popconfirm>
                          )}
                        </Space>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Right panel: selected config detail ──────────── */}
          <div style={{ flex: 1 }}>
            {!selectedConfig ? (
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '60px', textAlign: 'center' }}>
                <Empty description="Select a configuration type to manage its values" />
              </div>
            ) : (
              <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>

                {/* Config header */}
                <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <Title level={5} style={{ margin: 0 }}>{selectedConfig.name}</Title>
                      {selectedConfig.description && (
                        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                          {selectedConfig.description}
                        </Text>
                      )}
                      {/* Linked fields display */}
                      <div style={{ marginTop: 8 }}>
                        <Space wrap size={4}>
                          <LinkOutlined style={{ fontSize: '11px', color: '#8c8c8c' }} />
                          <Text type="secondary" style={{ fontSize: '11px' }}>Linked to:</Text>
                          {(selectedConfig.linkedTo ?? []).length === 0 ? (
                            <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>None</Text>
                          ) : (
                            (selectedConfig.linkedTo ?? []).map(linkId => {
                              const target = AVAILABLE_LINK_TARGETS.find(t => t.id === linkId);
                              return target ? (
                                <Tag key={linkId} color="geekblue" style={{ fontSize: '11px' }}>
                                  {target.module} → {target.label}
                                </Tag>
                              ) : null;
                            })
                          )}
                          {canEdit && (
                          <Button
                            size="small"
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => setLinksModal(true)}
                            style={{ fontSize: '11px', padding: '0 4px', height: 'auto' }}
                          >
                            Manage links
                          </Button>
                          )}
                        </Space>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items list */}
                <div style={{ padding: '20px' }}>
                  <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text strong style={{ fontSize: '13px' }}>
                      Values <span style={{ fontWeight: 400, color: '#8c8c8c', fontSize: '12px' }}>({selectedConfig.items.length} total)</span>
                    </Text>
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Changes apply instantly across the app
                    </Text>
                  </div>

                  {selectedConfig.items.length === 0 ? (
                    <Empty description="No values yet. Add the first one below." image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  ) : (
                    <div style={{ marginBottom: '16px' }}>
                      {selectedConfig.items.map((item, idx) => (
                        <div
                          key={item.value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '10px 14px',
                            borderRadius: '8px',
                            border: '1px solid #f0f0f0',
                            marginBottom: '6px',
                            background: editingItem?.value === item.value ? '#f0f7ff' : '#fafafa',
                            transition: 'background 0.15s',
                          }}
                        >
                          <div style={{ width: '28px', color: '#bfbfbf', fontSize: '11px', flexShrink: 0 }}>
                            {idx + 1}.
                          </div>

                          {editingItem?.value === item.value ? (
                            <Space style={{ flex: 1 }} size={8}>
                              <Input
                                size="small"
                                value={editLabel}
                                onChange={e => setEditLabel(e.target.value)}
                                onPressEnter={handleEditSave}
                                style={{ width: '280px', fontSize: '12px' }}
                                autoFocus
                              />
                              <Select
                                size="small"
                                value={editColor}
                                onChange={setEditColor}
                                style={{ width: '120px' }}
                                options={TAG_COLORS.map(c => ({
                                  value: c,
                                  label: <Tag color={c} style={{ fontSize: '10px', margin: 0 }}>{c}</Tag>,
                                }))}
                              />
                              <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleEditSave} style={{ borderRadius: '6px' }} />
                              <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingItem(null)} style={{ borderRadius: '6px' }} />
                            </Space>
                          ) : (
                            <>
                              <div style={{ flex: 1 }}>
                                <Tag color={item.color || 'default'} style={{ fontSize: '12px', padding: '2px 10px' }}>
                                  {item.label}
                                </Tag>
                              </div>
                              <Space size={4}>
                                {canEdit && (
                                <Tooltip title="Edit">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => { setEditingItem(item); setEditLabel(item.label); setEditColor(item.color || 'default'); }}
                                    style={{ color: '#595959' }}
                                  />
                                </Tooltip>
                                )}
                                {canDelete && (
                                <Popconfirm
                                  title="Remove this value?"
                                  description="Existing records using this value will keep it, but it won't appear in dropdowns."
                                  onConfirm={() => { removeItem(selectedConfig.id, item.value); message.success('Value removed'); }}
                                  okText="Remove"
                                  okButtonProps={{ danger: true }}
                                >
                                  <Tooltip title="Delete">
                                    <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                                  </Tooltip>
                                </Popconfirm>
                                )}
                              </Space>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Divider style={{ margin: '16px 0' }} />

                  {/* Add new value */}
                  {canEdit && (
                  <div style={{ background: '#f9f9f9', borderRadius: '8px', padding: '14px 16px', border: '1px dashed #d9d9d9' }}>
                    <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
                      <PlusOutlined style={{ marginRight: 6, color: '#1890ff' }} />
                      Add New Value
                    </Text>
                    <Space size={8} wrap>
                      <Input
                        placeholder="Enter value label..."
                        value={addItemInput}
                        onChange={e => setAddItemInput(e.target.value)}
                        onPressEnter={handleAddItem}
                        style={{ width: '280px', fontSize: '12px' }}
                        size="small"
                      />
                      <Select
                        size="small"
                        value={addItemColor}
                        onChange={setAddItemColor}
                        style={{ width: '130px' }}
                        placeholder="Color"
                        options={TAG_COLORS.map(c => ({
                          value: c,
                          label: <Tag color={c} style={{ fontSize: '10px', margin: 0 }}>{c}</Tag>,
                        }))}
                      />
                      <Button
                        type="primary"
                        size="small"
                        icon={<PlusOutlined />}
                        onClick={handleAddItem}
                        disabled={!addItemInput.trim()}
                        style={{ borderRadius: '6px' }}
                      >
                        Add
                      </Button>
                    </Space>
                    {addItemInput.trim() && (
                      <div style={{ marginTop: 8 }}>
                        <Text type="secondary" style={{ fontSize: '11px' }}>
                          Preview: <Tag color={addItemColor} style={{ fontSize: '11px' }}>{addItemInput}</Tag>
                        </Text>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

      {/* ─── New Config Type Modal ────────────────────────────── */}
      <Modal
        title={<Space><SettingOutlined style={{ color: '#1890ff' }} /> Create New Configuration</Space>}
        open={newTypeModal}
        onCancel={() => { setNewTypeModal(false); newTypeForm.resetFields(); }}
        footer={null}
        width={480}
      >
        <Form form={newTypeForm} layout="vertical" onFinish={handleCreateType} style={{ marginTop: 16 }}>
          <Form.Item
            name="name"
            label="Configuration Name"
            rules={[{ required: true, message: 'Please enter a name' }]}
          >
            <Input placeholder="e.g. Request Priority, Skill Category..." />
          </Form.Item>
          <Form.Item name="description" label="Description (optional)">
            <Input.TextArea rows={2} placeholder="Describe where this configuration is used..." />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setNewTypeModal(false); newTypeForm.resetFields(); }}>Cancel</Button>
              <Button type="primary" htmlType="submit">Create Configuration</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* ─── Manage Links Modal ───────────────────────────────── */}
      {selectedConfig && (
        <LinksModal
          open={linksModal}
          configName={selectedConfig.name}
          currentLinks={selectedConfig.linkedTo ?? []}
          onSave={handleLinksSave}
          onCancel={() => setLinksModal(false)}
        />
      )}
    </div>
  );
}

interface LinksModalProps {
  open: boolean;
  configName: string;
  currentLinks: string[];
  onSave: (links: string[]) => void;
  onCancel: () => void;
}

function LinksModal({ open, configName, currentLinks, onSave, onCancel }: LinksModalProps) {
  const [checked, setChecked] = useState<string[]>(currentLinks);

  React.useEffect(() => { setChecked(currentLinks); }, [currentLinks, open]);

  // Build section → module → targets hierarchy
  const hierarchy: Record<string, Record<string, typeof AVAILABLE_LINK_TARGETS>> = {};
  AVAILABLE_LINK_TARGETS.forEach(t => {
    if (!hierarchy[t.section]) hierarchy[t.section] = {};
    if (!hierarchy[t.section][t.module]) hierarchy[t.section][t.module] = [];
    hierarchy[t.section][t.module].push(t);
  });

  const SECTION_ORDER = ['Finance Management', 'Resources', 'Request Management', 'Internal Process'];

  return (
    <Modal
      title={<Space><LinkOutlined style={{ color: '#1890ff' }} /> Manage Links — {configName}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave(checked)}
      okText="Save Links"
      width={560}
    >
      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
        Select the app fields that should use values from this configuration. When linked, the dropdown for that field will be populated from this config automatically.
      </Text>
      {SECTION_ORDER.filter(s => hierarchy[s]).map(section => (
        <div key={section} style={{ marginBottom: 16 }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e8e8e8' }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#1890ff', flexShrink: 0 }} />
            <Text strong style={{ fontSize: '12px', color: '#262626' }}>{section}</Text>
          </div>
          {Object.entries(hierarchy[section]).map(([module, targets]) => (
            <div key={module} style={{ marginBottom: 8, marginLeft: 12 }}>
              {/* Module sub-header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#8c8c8c', flexShrink: 0 }} />
                <Text style={{ fontSize: '11px', color: '#595959', fontWeight: 600 }}>{module}</Text>
              </div>
              {/* Target checkboxes */}
              {targets.map(t => (
                <div key={t.id} style={{
                  padding: '6px 10px 6px 20px',
                  borderRadius: 6,
                  border: `1px solid ${checked.includes(t.id) ? '#91caff' : '#f0f0f0'}`,
                  marginBottom: 4,
                  background: checked.includes(t.id) ? '#e6f4ff' : '#fafafa',
                  transition: 'all 0.15s',
                }}>
                  <Checkbox
                    checked={checked.includes(t.id)}
                    onChange={e => {
                      if (e.target.checked) setChecked(prev => [...prev, t.id]);
                      else setChecked(prev => prev.filter(x => x !== t.id));
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{t.label}</span>
                    {t.description && (
                      <span style={{ fontSize: '10px', color: '#8c8c8c', marginLeft: 6 }}>— {t.description}</span>
                    )}
                  </Checkbox>
                </div>
              ))}
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}

// ── Values Tab ────────────────────────────────────────────────────────

function ValuesTab() {
  const { appValues, addAppValue, setAppValue, removeAppValue, clearAllValues } = useConfig();

  const [addKey, setAddKey] = useState('');
  const [addVal, setAddVal] = useState('');
  const [addDesc, setAddDesc] = useState('');

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editVal, setEditVal] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const handleAdd = () => {
    const k = addKey.trim().toUpperCase().replace(/\s+/g, '_');
    if (!k) { message.warning('Key is required'); return; }
    if (!addVal.trim()) { message.warning('Value is required'); return; }
    addAppValue(k, addVal.trim(), addDesc.trim());
    setAddKey(''); setAddVal(''); setAddDesc('');
    message.success('Value added');
  };

  const handleEditSave = () => {
    if (!editingKey) return;
    setAppValue(editingKey, editVal.trim(), editDesc.trim());
    setEditingKey(null);
    message.success('Value updated');
  };

  const handleDownloadValuesTemplate = () => {
    const template = [
      { Key: 'SOW_STORAGE_URL', Value: 'https://sharepoint.com/...', Description: 'SharePoint URL for SOW documents' },
      { Key: 'REPORT_EMAIL', Value: 'reports@company.com', Description: 'Email address for report notifications' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Values Template');
    XLSX.writeFile(wb, 'AppValues_Upload_Template.xlsx');
  };

  const handleUploadValues = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) { message.warning('No data found in the file'); return; }

        const getField = (row: Record<string, string>, ...keys: string[]) => {
          for (const k of Object.keys(row)) {
            if (keys.some(key => k.trim().toLowerCase() === key.toLowerCase())) return (row[k] || '').toString().trim();
          }
          return '';
        };

        let count = 0;
        rows.forEach(row => {
          const k = getField(row, 'Key', 'key').toUpperCase().replace(/\s+/g, '_');
          const v = getField(row, 'Value', 'value');
          const d = getField(row, 'Description', 'description');
          if (k && v) { addAppValue(k, v, d); count++; }
        });

        if (count > 0) message.success(`${count} value(s) imported`);
        else message.warning('No valid rows found. Ensure columns are "Key" and "Value".');
      } catch {
        message.error('Failed to read file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleExportValues = () => {
    const rows = appValues.map(v => ({ Key: v.key, Value: v.value, Description: v.description || '' }));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [{ wch: 25 }, { wch: 50 }, { wch: 40 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'App Values');
    XLSX.writeFile(wb, 'AppValues_Export.xlsx');
  };

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <Text strong style={{ fontSize: '13px' }}>Application Key-Value Settings</Text>
            <div style={{ marginTop: 2 }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Store configurable values (URLs, settings, flags) used across the application.
                These are referenced by key in linked features.
              </Text>
            </div>
          </div>
          <Space size={4}>
            <Tooltip title="Upload from Excel" overlayInnerStyle={{ fontSize: '11px' }}>
              <Upload accept=".xlsx,.xls" beforeUpload={handleUploadValues} showUploadList={false}>
                <Button size="small" icon={<UploadOutlined />} style={{ borderRadius: '6px' }} />
              </Upload>
            </Tooltip>
            <Tooltip title="Download template" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadValuesTemplate} style={{ borderRadius: '6px' }} />
            </Tooltip>
            <Tooltip title="Export all to Excel" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button size="small" icon={<DownloadOutlined />} onClick={handleExportValues} style={{ borderRadius: '6px', color: '#52c41a', borderColor: '#52c41a' }} />
            </Tooltip>
            <Popconfirm
              title="Delete all application values?"
              description="This will permanently remove all key-value settings."
              onConfirm={() => { clearAllValues(); message.success('All values deleted'); }}
              okText="Delete All"
              okButtonProps={{ danger: true, size: 'small' }}
              cancelButtonProps={{ size: 'small' }}
            >
              <Tooltip title="Delete all" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button size="small" danger icon={<DeleteOutlined />} style={{ borderRadius: '6px' }} />
              </Tooltip>
            </Popconfirm>
          </Space>
        </div>
      </div>

      {/* Values list */}
      {appValues.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No values yet. Add one below." style={{ margin: '24px 0' }} />
      ) : (
        <div style={{ marginBottom: 16 }}>
          {appValues.map((item: AppValue) => (
            <div key={item.key} style={{
              background: editingKey === item.key ? '#f0f7ff' : '#fafafa',
              border: '1px solid #f0f0f0',
              borderRadius: 8,
              padding: '12px 16px',
              marginBottom: 8,
              transition: 'background 0.15s',
            }}>
              {editingKey === item.key ? (
                <div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 8 }}>
                    <div style={{ flex: '0 0 160px' }}>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Key</div>
                      <Input value={item.key} disabled size="small" style={{ fontFamily: 'monospace', fontSize: '11px' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Value</div>
                      <Input
                        value={editVal}
                        onChange={e => setEditVal(e.target.value)}
                        size="small"
                        style={{ fontSize: '12px' }}
                        autoFocus
                      />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Description (optional)</div>
                    <Input
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      size="small"
                      style={{ fontSize: '12px' }}
                      placeholder="What is this value used for?"
                    />
                  </div>
                  <Space size={6}>
                    <Button size="small" type="primary" icon={<SaveOutlined />} onClick={handleEditSave} style={{ borderRadius: 6 }}>Save</Button>
                    <Button size="small" icon={<CloseOutlined />} onClick={() => setEditingKey(null)} style={{ borderRadius: 6 }}>Cancel</Button>
                  </Space>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: '11px', margin: 0 }}>{item.key}</Tag>
                    </div>
                    <div style={{ fontSize: '12px', color: '#262626', wordBreak: 'break-all', marginBottom: item.description ? 4 : 0 }}>
                      {item.value.startsWith('http') ? (
                        <a href={item.value} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff', fontSize: '12px' }}>
                          {item.value}
                        </a>
                      ) : item.value}
                    </div>
                    {item.description && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>{item.description}</Text>
                    )}
                  </div>
                  <Space size={4}>
                    <Tooltip title="Edit">
                      <Button type="text" size="small" icon={<EditOutlined />}
                        onClick={() => { setEditingKey(item.key); setEditVal(item.value); setEditDesc(item.description || ''); }}
                        style={{ color: '#595959' }} />
                    </Tooltip>
                    <Popconfirm
                      title="Remove this value?"
                      description="Any features that reference this key will lose their configured value."
                      onConfirm={() => { removeAppValue(item.key); message.success('Value removed'); }}
                      okText="Remove" okButtonProps={{ danger: true }}
                    >
                      <Tooltip title="Delete">
                        <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                      </Tooltip>
                    </Popconfirm>
                  </Space>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Divider style={{ margin: '16px 0' }} />

      {/* Add new value */}
      <div style={{ background: '#f9f9f9', borderRadius: 8, padding: '14px 16px', border: '1px dashed #d9d9d9' }}>
        <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
          <PlusOutlined style={{ marginRight: 6, color: '#1890ff' }} />
          Add New Value
        </Text>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          <div style={{ flex: '0 0 160px' }}>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Key</div>
            <Input
              placeholder="e.g. MY_SETTING"
              value={addKey}
              onChange={e => setAddKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              size="small"
              style={{ fontFamily: 'monospace', fontSize: '11px' }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Value</div>
            <Input
              placeholder="e.g. https://... or any setting value"
              value={addVal}
              onChange={e => setAddVal(e.target.value)}
              onPressEnter={handleAdd}
              size="small"
              style={{ fontSize: '12px' }}
            />
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Description (optional)</div>
          <Input
            placeholder="What is this value used for?"
            value={addDesc}
            onChange={e => setAddDesc(e.target.value)}
            size="small"
            style={{ fontSize: '12px' }}
          />
        </div>
        <Button
          type="primary" size="small" icon={<PlusOutlined />}
          onClick={handleAdd}
          disabled={!addKey.trim() || !addVal.trim()}
          style={{ borderRadius: 6 }}
        >
          Add
        </Button>
      </div>
    </div>
  );
}

// ── Notification Triggers Tab ──────────────────────────────────────────

// Drag-handle row wrapper for the triggers table
function SortableTriggerRow({ id, children, ...rest }: React.HTMLAttributes<HTMLTableRowElement> & { id: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      {...rest}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        background: isDragging ? '#e6f4ff' : undefined,
        cursor: 'default',
      }}
    >
      {children}
    </tr>
  );
}

// Special field pseudo-values — kept in sync with server/config/triggerSources.js
// This set is only used for UI decisions (hide field_value target type, auto-fill template)
const SPECIAL_FIELD_VALUES = new Set(['__any__', '__revenue__', '__invoice_amounts__', '__bulk_insert__', '__delete_all__', '__record_delete__']);

const NOTIFY_TARGET_TYPES = [
  { label: 'New value is the user (field_value)', value: 'field_value' },
  { label: 'Notify a User Group', value: 'group' },
  { label: 'Broadcast (all users)', value: 'broadcast' },
];

const NOTIFICATION_TYPES = [
  { label: 'Task', value: 'task' },
  { label: 'Info', value: 'info' },
  { label: 'Alert', value: 'alert' },
];

function NotificationTriggersTab() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('configuration', 'edit');
  const canDelete = hasPermission('configuration', 'delete');

  const [triggers, setTriggers] = React.useState<NotificationTrigger[]>([]);
  const [groups, setGroups] = React.useState<UserGroup[]>([]);
  const [triggerSources, setTriggerSources] = React.useState<TriggerSource[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [editingTrigger, setEditingTrigger] = React.useState<NotificationTrigger | null>(null);
  const [form] = Form.useForm();

  const selectedSource = Form.useWatch('source_table', form);
  const selectedFieldRaw = Form.useWatch('trigger_field', form);
  const selectedFields: string[] = Array.isArray(selectedFieldRaw)
    ? selectedFieldRaw
    : (selectedFieldRaw ? [selectedFieldRaw] : []);
  const isSpecialField = selectedFields.some(f => SPECIAL_FIELD_VALUES.has(f));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [data, grps, sources] = await Promise.all([
        getNotificationTriggers(),
        getUserGroups(),
        getTriggerSources(),
      ]);
      setTriggers(data);
      setGroups(grps);
      setTriggerSources(sources);
    } catch (_) {
      message.error('Failed to load triggers');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  // dnd-kit sensors — require 5px of movement before drag starts (avoids accidental drags)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = triggers.findIndex(t => t.id === active.id);
    const newIndex = triggers.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(triggers, oldIndex, newIndex);
    setTriggers(reordered); // optimistic update
    await reorderNotificationTriggers(reordered.map(t => t.id));
  };

  const openCreate = () => {
    setEditingTrigger(null);
    form.resetFields();
    form.setFieldsValue({
      source_table: triggerSources[0]?.value || '',
      trigger_field: [],
      notify_target_type: 'field_value',
      notification_type: 'task',
      is_active: true,
      message_template: 'The {field} of "{record_name}" was changed from "{old_value}" to "{new_value}" by {changed_by}.',
    });    setModalOpen(true);
  };

  const openEdit = (t: NotificationTrigger) => {
    setEditingTrigger(t);
    form.setFieldsValue({
      name: t.name,
      source_table: t.source_table,
      trigger_field: t.trigger_field ? t.trigger_field.split(',').map(f => f.trim()).filter(Boolean) : [],
      message_template: t.message_template,
      notify_target_type: t.notify_target_type,
      notify_target_value: t.notify_target_value,
      notification_type: t.notification_type,
      is_active: !!t.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const vals = await form.validateFields();
      const fields: string[] = Array.isArray(vals.trigger_field) ? vals.trigger_field : [vals.trigger_field];
      const triggerLabel = fields
        .map(f => sourceFields.find(sf => sf.value === f)?.label || f)
        .join(', ');
      const payload = {
        name: vals.name,
        source_table: vals.source_table,
        trigger_field: fields.join(','),
        trigger_label: triggerLabel,
        message_template: vals.message_template || '',
        notify_target_type: vals.notify_target_type,
        notify_target_value: vals.notify_target_value || '',
        notification_type: vals.notification_type || 'task',
        is_active: vals.is_active ? 1 : 0,
      };

      if (editingTrigger) {
        const res = await updateNotificationTrigger(editingTrigger.id, payload);
        if (res.ok) { message.success('Trigger updated'); setModalOpen(false); load(); }
        else message.error(res.error || 'Update failed');
      } else {
        const res = await createNotificationTrigger(payload as any);
        if (res.ok) { message.success('Trigger created'); setModalOpen(false); load(); }
        else message.error(res.error || 'Create failed');
      }
    } catch (_) {}
  };

  const handleDelete = async (id: number) => {
    const res = await deleteNotificationTrigger(id);
    if (res.ok) { message.success('Deleted'); load(); }
    else message.error(res.error || 'Delete failed');
  };

  const handleDuplicate = async (t: NotificationTrigger) => {
    const res = await createNotificationTrigger({
      name: `${t.name} (copy)`,
      source_table: t.source_table,
      trigger_field: t.trigger_field,
      trigger_label: t.trigger_label,
      message_template: t.message_template,
      notify_target_type: t.notify_target_type,
      notify_target_value: t.notify_target_value,
      notification_type: t.notification_type,
      is_active: 0,
    } as any);
    if (res.ok) { message.success('Trigger duplicated (inactive)'); load(); }
    else message.error(res.error || 'Duplicate failed');
  };

  const handleToggle = async (id: number) => {
    await toggleNotificationTrigger(id);
    load();
  };

  const sourceFields = triggerSources.find(s => s.value === selectedSource)?.fields || [];
  const groupOptions = groups.map(g => ({ label: g.name, value: String(g.id) }));

  const columns = [
    ...(canEdit ? [{
      title: '',
      key: 'drag',
      width: 32,
      render: () => (
        <HolderOutlined
          style={{ cursor: 'grab', color: '#bbb', fontSize: '14px', padding: '4px' }}
          className="drag-handle"
        />
      ),
    }] : []),
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: '13px' }}>{v}</span>,
    },
    {
      title: 'Source',
      dataIndex: 'source_table',
      key: 'source_table',
      render: (v: string) => {
        const s = triggerSources.find(x => x.value === v);
        return <Tag color="blue" style={{ fontSize: '11px' }}>{s?.label || v}</Tag>;
      },
    },
    {
      title: 'Field',
      dataIndex: 'trigger_field',
      key: 'trigger_field',
      render: (v: string, row: NotificationTrigger) => {
        const fields = v ? v.split(',').map(f => f.trim()).filter(Boolean) : [];
        const src = triggerSources.find(s => s.value === row.source_table);
        return (
          <Space size={2} wrap>
            {fields.map(f => {
              if (f === '__any__') return <Tag key={f} color="volcano" style={{ fontSize: '11px' }}>★ Any field</Tag>;
              if (SPECIAL_FIELD_VALUES.has(f)) {
                const fi = src?.fields.find(fi => fi.value === f);
                return <Tag key={f} color="geekblue" style={{ fontSize: '11px' }}>{fi?.label || f}</Tag>;
              }
              const fi = src?.fields.find(fi => fi.value === f);
              return <Tag key={f} color="cyan" style={{ fontSize: '11px' }}>{fi?.label || f}</Tag>;
            })}
          </Space>
        );
      },
    },
    {
      title: 'Notify',
      dataIndex: 'notify_target_type',
      key: 'notify_target_type',
      render: (v: string, row: NotificationTrigger) => {
        if (v === 'field_value') return <Tag color="green" style={{ fontSize: '11px' }}>New value → User</Tag>;
        if (v === 'group') {
          const grp = groups.find(g => String(g.id) === String(row.notify_target_value));
          return <Tag color="purple" style={{ fontSize: '11px' }}>Group: {grp ? grp.name : row.notify_target_value}</Tag>;
        }
        return <Tag color="orange" style={{ fontSize: '11px' }}>Broadcast</Tag>;
      },
    },
    {
      title: 'Type',
      dataIndex: 'notification_type',
      key: 'notification_type',
      render: (v: string) => <Tag style={{ fontSize: '11px' }}>{v}</Tag>,
    },
    {
      title: 'Active',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (v: number, row: NotificationTrigger) =>
        canEdit ? (
          <Switch
            size="small"
            checked={!!v}
            onChange={() => handleToggle(row.id)}
          />
        ) : (
          <Badge status={v ? 'success' : 'default'} text={v ? 'On' : 'Off'} />
        ),
    },
    ...(canEdit || canDelete ? [{
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, row: NotificationTrigger) => (
        <Space size={4}>
          {canEdit && (
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
          )}
          {canEdit && (
            <Tooltip title="Duplicate">
              <Button size="small" icon={<PlusOutlined />} onClick={() => handleDuplicate(row)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm
              title="Delete this trigger?"
              onConfirm={() => handleDelete(row.id)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Tooltip title="Delete">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    }] : []),
  ];

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <Typography.Text strong style={{ fontSize: '13px' }}>Notification Triggers</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: '12px', marginLeft: 8 }}>
            Automatically send notifications when specific fields change
          </Typography.Text>
        </div>
        {canEdit && (
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreate}>
            Add Trigger
          </Button>
        )}
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={triggers.map(t => t.id)} strategy={verticalListSortingStrategy}>
          <Table
            dataSource={triggers}
            columns={columns}
            rowKey="id"
            loading={loading}
            size="small"
            pagination={false}
            locale={{ emptyText: <Empty description="No triggers configured yet" imageStyle={{ height: 40 }} /> }}
            components={{
              body: {
                row: ({ children, ...props }: any) => {
                  const id = props['data-row-key'] ? Number(props['data-row-key']) : 0;
                  return canEdit
                    ? <SortableTriggerRow id={id} {...props}>{children}</SortableTriggerRow>
                    : <tr {...props}>{children}</tr>;
                },
              },
            }}
          />
        </SortableContext>
      </DndContext>

      <Modal
        open={modalOpen}
        title={editingTrigger ? 'Edit Trigger' : 'New Notification Trigger'}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        okText="Save"
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 12 }}>
          <Form.Item
            name="name"
            label="Trigger Name"
            rules={[{ required: true, message: 'Name is required' }]}
          >
            <Input placeholder="e.g. SOW Owner Assignment" />
          </Form.Item>

          <Form.Item
            name="source_table"
            label="Source (Table)"
            rules={[{ required: true }]}
          >
            <Select
              options={triggerSources.map(s => ({ label: s.label, value: s.value }))}
              onChange={() => form.setFieldValue('trigger_field', undefined)}
            />
          </Form.Item>

          <Form.Item
            name="trigger_field"
            label="When these field(s) change"
            rules={[{ required: true, message: 'Select at least one field' }]}
          >
            <Select
              mode="multiple"
              options={sourceFields.map(f => ({ label: f.label, value: f.value }))}
              placeholder="Select one or more fields"
              disabled={sourceFields.length === 0}
              allowClear
              onChange={(vals: string[]) => {
                const hasSpecial = vals.some(v => SPECIAL_FIELD_VALUES.has(v));
                if (hasSpecial || vals.length > 1) {
                  form.setFieldsValue({
                    message_template: 'For record "{record_name}", {changes}. Updated by {changed_by}.',
                    notify_target_type: form.getFieldValue('notify_target_type') === 'field_value'
                      ? 'group'
                      : form.getFieldValue('notify_target_type'),
                  });
                } else {
                  form.setFieldsValue({
                    message_template: 'The {field} of "{record_name}" was changed from "{old_value}" to "{new_value}" by {changed_by}.',
                  });
                }
              }}
            />
          </Form.Item>

          <Form.Item name="notify_target_type" label="Notify Who?" rules={[{ required: true }]}>
            <Select
              options={NOTIFY_TARGET_TYPES.filter(t => {
                if (t.value !== 'field_value') return true;
                return !isSpecialField && selectedFields.length === 1;
              })}
            />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.notify_target_type !== curr.notify_target_type}
          >
            {({ getFieldValue }) =>
              getFieldValue('notify_target_type') === 'group' ? (
                <Form.Item
                  name="notify_target_value"
                  label="User Group"
                  rules={[{ required: true, message: 'Select a group to notify' }]}
                >
                  <Select
                    options={groupOptions}
                    placeholder="Select a group"
                    showSearch
                    filterOption={(input, opt) =>
                      (opt?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                    }
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item name="notification_type" label="Notification Type">
            <Select options={NOTIFICATION_TYPES} />
          </Form.Item>

          <Form.Item
            name="message_template"
            label="Message Template"
            extra={isSpecialField
              ? 'Available: {changes} (all changed fields summary), {record_name}, {changed_by}'
              : 'Available: {field}, {old_value}, {new_value}, {record_name}, {changed_by}'}
          >
            <Input.TextArea
              rows={3}
              placeholder={isSpecialField
                ? '"{record_name}" was updated by {changed_by}: {changes}'
                : "The {field} of '{record_name}' was changed from '{old_value}' to '{new_value}' by {changed_by}."}
            />
          </Form.Item>

          <Form.Item name="is_active" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}