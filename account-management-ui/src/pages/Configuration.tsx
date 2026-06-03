import React, { useState } from 'react';
import {
  Button, Input, Modal, Form, Tag, Space, Typography,
  Divider, Tooltip, Popconfirm, Empty, message, Upload, Select, Checkbox, Tabs,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined, EditOutlined, SettingOutlined,
  LockOutlined, SaveOutlined, CloseOutlined, UploadOutlined, DownloadOutlined,
  LinkOutlined, AppstoreOutlined, TableOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { useConfig, ConfigItem, AVAILABLE_LINK_TARGETS, AppValue } from '../context/ConfigContext';

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
            ]}
          />
        </div>
      </div>
    </div>
  );
}

// ── Dropdowns Tab ─────────────────────────────────────────────────────

function DropdownsTab() {
  const { configs, addConfigType, renameConfigType, deleteConfigType, bulkImportConfigs, addItem, removeItem, editItem, updateLinks } = useConfig();

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
    const template = [
      { 'Configuration Type': 'Request Priority', 'Value': 'High' },
      { 'Configuration Type': 'Request Priority', 'Value': 'Medium' },
      { 'Configuration Type': 'Request Priority', 'Value': 'Low' },
      { 'Configuration Type': 'Skill Category', 'Value': 'Frontend' },
      { 'Configuration Type': 'Skill Category', 'Value': 'Backend' },
    ];
    const ws = XLSX.utils.json_to_sheet(template);
    ws['!cols'] = [{ wch: 30 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Config Template');
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

        // Group rows by config type name
        const typeMap: Record<string, string[]> = {};
        rows.forEach(row => {
          const typeName = getField(row, 'Configuration Type', 'Config Type', 'configuration_type', 'Type', 'Name');
          const value = getField(row, 'Value', 'value', 'Label', 'label', 'Item');
          if (typeName && value) {
            if (!typeMap[typeName]) typeMap[typeName] = [];
            typeMap[typeName].push(value);
          }
        });

        if (Object.keys(typeMap).length === 0) {
          message.warning('No valid data found. Ensure columns are "Configuration Type" and "Value".');
          return;
        }

        const entries = Object.entries(typeMap).map(([name, values]) => ({ name, values }));
        const { created, added } = bulkImportConfigs(entries);

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

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

          {/* ─── Left panel: config type list ─────────────────── */}
          <div style={{ width: '300px', flexShrink: 0 }}>
            <div style={{ background: '#fafafa', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
              <div style={{ padding: '14px 16px', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text strong style={{ fontSize: '13px' }}>Configuration Types</Text>
                  <Button
                    type="primary"
                    size="small"
                    icon={<PlusOutlined />}
                    onClick={() => setNewTypeModal(true)}
                    style={{ borderRadius: '6px', fontSize: '11px' }}
                  >
                    New
                  </Button>
                </div>
                {/* Upload first, then Download Template */}
                <Space size={6}>
                  <Tooltip title="Upload configuration types from Excel">
                    <Upload accept=".xlsx,.xls" beforeUpload={handleBulkUpload} showUploadList={false}>
                      <Button size="small" icon={<UploadOutlined />} style={{ borderRadius: '6px', fontSize: '11px' }}>
                        Upload
                      </Button>
                    </Upload>
                  </Tooltip>
                  <Tooltip title="Download upload template">
                    <Button size="small" icon={<DownloadOutlined />} onClick={handleDownloadTemplate} style={{ borderRadius: '6px', fontSize: '11px' }}>
                      Template
                    </Button>
                  </Tooltip>
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
                            {cfg.builtIn && <LockOutlined style={{ fontSize: '10px', color: '#8c8c8c', marginRight: 5 }} />}
                            {cfg.name}
                          </div>
                        )}
                      </div>

                      {renamingId !== cfg.id && (
                        <Space size={2} onClick={e => e.stopPropagation()}>
                          <Tooltip title="Rename">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={e => { e.stopPropagation(); setRenamingId(cfg.id); setRenameValue(cfg.name); }}
                              style={{ color: '#595959', opacity: 0.7 }}
                            />
                          </Tooltip>
                          {!cfg.builtIn && (
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
                      <Space align="center">
                        {selectedConfig.builtIn && (
                          <Tag color="blue" style={{ fontSize: '10px' }}>Built-in</Tag>
                        )}
                        <Title level={5} style={{ margin: 0 }}>{selectedConfig.name}</Title>
                      </Space>
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
                          <Button
                            size="small"
                            type="link"
                            icon={<EditOutlined />}
                            onClick={() => setLinksModal(true)}
                            style={{ fontSize: '11px', padding: '0 4px', height: 'auto' }}
                          >
                            Manage links
                          </Button>
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
                                <Tooltip title="Edit">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<EditOutlined />}
                                    onClick={() => { setEditingItem(item); setEditLabel(item.label); setEditColor(item.color || 'default'); }}
                                    style={{ color: '#595959' }}
                                  />
                                </Tooltip>
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
                              </Space>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Divider style={{ margin: '16px 0' }} />

                  {/* Add new value */}
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

  // Sync when modal opens
  React.useEffect(() => { setChecked(currentLinks); }, [currentLinks, open]);

  // Group by module
  const byModule: Record<string, typeof AVAILABLE_LINK_TARGETS> = {};
  AVAILABLE_LINK_TARGETS.forEach(t => {
    if (!byModule[t.module]) byModule[t.module] = [];
    byModule[t.module].push(t);
  });

  return (
    <Modal
      title={<Space><LinkOutlined style={{ color: '#1890ff' }} /> Manage Links — {configName}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave(checked)}
      okText="Save Links"
      width={520}
    >
      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
        Select the app fields that should use values from this configuration. When linked, the dropdown for that field will be driven by this config.
      </Text>
      {Object.entries(byModule).map(([module, targets]) => (
        <div key={module} style={{ marginBottom: 16 }}>
          <Text strong style={{ fontSize: '12px', color: '#595959', display: 'block', marginBottom: 6 }}>
            {module}
          </Text>
          {targets.map(t => (
            <div key={t.id} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #f0f0f0', marginBottom: 4, background: checked.includes(t.id) ? '#e6f4ff' : '#fafafa' }}>
              <Checkbox
                checked={checked.includes(t.id)}
                onChange={e => {
                  if (e.target.checked) setChecked(prev => [...prev, t.id]);
                  else setChecked(prev => prev.filter(x => x !== t.id));
                }}
              >
                <Text style={{ fontSize: '12px' }}>{t.label}</Text>
              </Checkbox>
            </div>
          ))}
        </div>
      ))}
    </Modal>
  );
}

// ── Values Tab ────────────────────────────────────────────────────────

function ValuesTab() {
  const { appValues, addAppValue, setAppValue, removeAppValue } = useConfig();

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

  return (
    <div style={{ padding: '16px 0' }}>
      <div style={{ marginBottom: 16 }}>
        <Text strong style={{ fontSize: '13px' }}>Application Key-Value Settings</Text>
        <div style={{ marginTop: 2 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Store configurable values (URLs, settings, flags) used across the application.
            These are referenced by key in linked features.
          </Text>
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