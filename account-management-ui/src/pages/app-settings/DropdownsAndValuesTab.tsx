import { useEffect, useState } from 'react';
import {
  App,
  Button,
  Checkbox,
  Divider,
  Dropdown,
  Empty,
  Form,
  Input,
  Modal,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
  Upload,
} from 'antd';
import {
  AppstoreOutlined,
  CloseOutlined,
  DeleteOutlined,
  DownloadOutlined,
  EditOutlined,
  LinkOutlined,
  MoreOutlined,
  PlusOutlined,
  SaveOutlined,
  TableOutlined,
  UploadOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { AVAILABLE_LINK_TARGETS, AppValue, ConfigItem, useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import {
  downloadAppValuesTemplate,
  downloadConfigurationTemplate,
  exportAppValuesWorkbook,
  exportConfigurationsWorkbook,
} from './appSettingsExportUtils';

const { Text } = Typography;

const TAG_COLORS = [
  'default', 'blue', 'cyan', 'geekblue', 'green', 'gold',
  'lime', 'magenta', 'orange', 'purple', 'red', 'volcano',
];

export function DropdownsAndValuesTab() {
  const [section, setSection] = useState<string>('dropdowns');
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Segmented
          size="small"
          value={section}
          onChange={(v) => setSection(v as string)}
          options={[
            { label: <span style={{ fontSize: 11 }}><AppstoreOutlined /> Dropdown Types</span>, value: 'dropdowns' },
            { label: <span style={{ fontSize: 11 }}><TableOutlined /> App Values</span>, value: 'values' },
          ]}
        />
      </div>
      <Divider style={{ margin: '8px 0 0' }} />
      {section === 'dropdowns' ? <DropdownsTab /> : <ValuesTab />}
    </div>
  );
}

export function DropdownsTab() {
  const { message } = App.useApp();
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

  const selectedConfig = configs.find((c) => c.id === selectedId) ?? null;

  const handleAddItem = () => {
    const label = addItemInput.trim();
    if (!label || !selectedId) return;
    if (selectedConfig?.items.some((i) => i.label.toLowerCase() === label.toLowerCase())) {
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
    if (!name) {
      message.warning('Name cannot be empty');
      return;
    }
    renameConfigType(id, name);
    setRenamingId(null);
    message.success('Renamed successfully');
  };

  const handleDownloadTemplate = () => {
    downloadConfigurationTemplate(XLSX, AVAILABLE_LINK_TARGETS);
  };

  const handleBulkUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' });
        if (!rows.length) {
          message.warning('No data found in the file');
          return;
        }

        const getField = (row: Record<string, string>, ...keys: string[]) => {
          for (const k of Object.keys(row)) {
            if (keys.some((key) => k.trim().toLowerCase() === key.toLowerCase())) return (row[k] || '').toString().trim();
          }
          return '';
        };

        const typeMap: Record<string, { values: string[]; linkedTo: string[] }> = {};
        rows.forEach((row) => {
          const typeName = getField(row, 'Configuration Type', 'Config Type', 'configuration_type', 'Type', 'Name');
          const value = getField(row, 'Value', 'value', 'Label', 'label', 'Item');
          const linkedToRaw = getField(row, 'Linked To', 'linked_to', 'LinkedTo', 'Links');
          if (typeName) {
            if (!typeMap[typeName]) typeMap[typeName] = { values: [], linkedTo: [] };
            if (value) typeMap[typeName].values.push(value);
            if (linkedToRaw) {
              linkedToRaw.split(';').map((s) => s.trim()).filter(Boolean).forEach((id) => {
                if (AVAILABLE_LINK_TARGETS.some((t) => t.id === id) && !typeMap[typeName].linkedTo.includes(id)) {
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

        Object.entries(typeMap).forEach(([name, { linkedTo }]) => {
          if (linkedTo.length > 0) {
            setTimeout(() => {
              const found = configs.find((c) => c.name.toLowerCase() === name.toLowerCase());
              if (found) updateLinks(found.id, linkedTo);
            }, 300);
          }
        });

        if (created > 0 || added > 0) {
          message.success(`Imported: ${created} new type(s), ${added} value(s) added`);
          const firstEntry = entries[0];
          if (firstEntry) {
            setTimeout(() => {
              const found = configs.find((c) => c.name.toLowerCase() === firstEntry.name.toLowerCase());
              if (found) setSelectedId(found.id);
            }, 200);
          }
        } else {
          message.info('No new items to import (all values already exist)');
        }
      } catch (error) {
        console.error('[AppSettings][ConfigTypes] Bulk upload parse failed', error);
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
    exportConfigurationsWorkbook(XLSX, configs, AVAILABLE_LINK_TARGETS);
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{ width: '300px', flexShrink: 0 }}>
          <div style={{ background: '#fafafa', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #f0f0f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text strong style={{ fontSize: 11 }}>Dropdown Types</Text>
                <Space size={4}>
                  {canEdit && (
                    <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setNewTypeModal(true)} style={{ fontSize: 11 }}>New</Button>
                  )}
                  <Dropdown
                    trigger={['click']}
                    menu={{
                      items: [
                        ...(canEdit ? [{
                          key: 'upload',
                          label: (
                            <Upload accept=".xlsx,.xls" beforeUpload={handleBulkUpload} showUploadList={false}>
                              <Space size={6}><UploadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Upload from Excel</Text></Space>
                            </Upload>
                          ),
                        }] : []),
                        {
                          key: 'template',
                          label: <Space size={6}><DownloadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Download template</Text></Space>,
                          onClick: handleDownloadTemplate,
                        },
                        {
                          key: 'export',
                          label: <Space size={6}><DownloadOutlined style={{ fontSize: 11, color: '#52c41a' }} /><Text style={{ fontSize: 11, color: '#52c41a' }}>Export all to Excel</Text></Space>,
                          onClick: handleExportConfigs,
                        },
                        ...(canDelete ? [{
                          key: 'deleteAll',
                          danger: true,
                          label: <Text style={{ fontSize: 11 }}>Delete all</Text>,
                          onClick: () => {
                            Modal.confirm({
                              title: 'Delete all non-built-in configurations?',
                              content: 'This will permanently remove all custom configuration types and their values.',
                              okText: 'Delete All',
                              okButtonProps: { danger: true },
                              onOk: () => { clearAllConfigs(); message.success('All configurations deleted'); },
                            });
                          },
                        }] : []),
                      ],
                    }}
                  >
                    <Button size="small" icon={<MoreOutlined />} />
                  </Dropdown>
                </Space>
              </div>
            </div>

            <div style={{ padding: '8px' }}>
              {configs.map((cfg) => (
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
                        <Space size={4} onClick={(e) => e.stopPropagation()}>
                          <Input
                            size="small"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
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
                      <Space size={2} onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <Tooltip title="Rename">
                            <Button
                              type="text"
                              size="small"
                              icon={<EditOutlined />}
                              onClick={(e) => { e.stopPropagation(); setRenamingId(cfg.id); setRenameValue(cfg.name); }}
                              style={{ color: '#595959', opacity: 0.7 }}
                            />
                          </Tooltip>
                        )}
                        {canDelete && (
                          <Popconfirm
                            title="Delete this configuration?"
                            description="This will permanently remove this configuration type."
                            onConfirm={(e) => { e?.stopPropagation(); deleteConfigType(cfg.id); if (selectedId === cfg.id) setSelectedId(configs[0]?.id ?? null); }}
                            onCancel={(e) => e?.stopPropagation()}
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

        <div style={{ flex: 1 }}>
          {!selectedConfig ? (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', padding: '60px', textAlign: 'center' }}>
              <Empty description="Select a configuration type to manage its values" />
            </div>
          ) : (
            <div style={{ background: '#fff', borderRadius: '10px', border: '1px solid #e8e8e8', overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>{selectedConfig.name}</Text>
                    {selectedConfig.description && (
                      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 4 }}>
                        {selectedConfig.description}
                      </Text>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <Space wrap size={4}>
                        <LinkOutlined style={{ fontSize: '11px', color: '#8c8c8c' }} />
                        <Text type="secondary" style={{ fontSize: '11px' }}>Linked to:</Text>
                        {(selectedConfig.linkedTo ?? []).length === 0 ? (
                          <Text type="secondary" style={{ fontSize: '11px', fontStyle: 'italic' }}>None</Text>
                        ) : (
                          (selectedConfig.linkedTo ?? []).map((linkId) => {
                            const target = AVAILABLE_LINK_TARGETS.find((t) => t.id === linkId);
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
                            Manage link
                          </Button>
                        )}
                      </Space>
                    </div>
                  </div>
                </div>
              </div>

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
                              onChange={(e) => setEditLabel(e.target.value)}
                              onPressEnter={handleEditSave}
                              style={{ width: '280px', fontSize: '12px' }}
                              autoFocus
                            />
                            <Select
                              size="small"
                              value={editColor}
                              onChange={setEditColor}
                              style={{ width: '120px' }}
                              options={TAG_COLORS.map((c) => ({
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
                        onChange={(e) => setAddItemInput(e.target.value)}
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
                        options={TAG_COLORS.map((c) => ({
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

      <Modal
        title={<Text style={{ fontSize: 13 }}>Create New Dropdown Type</Text>}
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

  useEffect(() => { setChecked(currentLinks); }, [currentLinks, open]);

  const hierarchy: Record<string, Record<string, typeof AVAILABLE_LINK_TARGETS>> = {};
  AVAILABLE_LINK_TARGETS.forEach((t) => {
    if (!hierarchy[t.section]) hierarchy[t.section] = {};
    if (!hierarchy[t.section][t.module]) hierarchy[t.section][t.module] = [];
    hierarchy[t.section][t.module].push(t);
  });

  const SECTION_ORDER = ['Finance Management', 'Resources', 'Request Management', 'Internal Process'];

  return (
    <Modal
      title={<Space><LinkOutlined style={{ color: '#1890ff' }} /> Manage Link — {configName}</Space>}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave(checked)}
      okText="Save Links"
      width={560}
    >
      <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
        Select the app fields that should use values from this configuration. When linked, the dropdown for that field will be populated from this config automatically.
      </Text>
      {SECTION_ORDER.filter((s) => hierarchy[s]).map((section) => (
        <div key={section} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #e8e8e8' }}>
            <div style={{ width: 3, height: 14, borderRadius: 2, background: '#1890ff', flexShrink: 0 }} />
            <Text strong style={{ fontSize: '12px', color: '#262626' }}>{section}</Text>
          </div>
          {Object.entries(hierarchy[section]).map(([module, targets]) => (
            <div key={module} style={{ marginBottom: 8, marginLeft: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
                <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#8c8c8c', flexShrink: 0 }} />
                <Text style={{ fontSize: '11px', color: '#595959', fontWeight: 600 }}>{module}</Text>
              </div>
              {targets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    padding: '6px 10px 6px 20px',
                    borderRadius: 6,
                    border: `1px solid ${checked.includes(t.id) ? '#91caff' : '#f0f0f0'}`,
                    marginBottom: 4,
                    background: checked.includes(t.id) ? '#e6f4ff' : '#fafafa',
                    transition: 'all 0.15s',
                  }}
                >
                  <Checkbox
                    checked={checked.includes(t.id)}
                    onChange={(e) => {
                      if (e.target.checked) setChecked((prev) => [...prev, t.id]);
                      else setChecked((prev) => prev.filter((x) => x !== t.id));
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

export function ValuesTab() {
  const { message } = App.useApp();
  const { appValues, addAppValue, setAppValue, removeAppValue, clearAllValues } = useConfig();
  const [addModalOpen, setAddModalOpen] = useState(false);
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
    setAddKey('');
    setAddVal('');
    setAddDesc('');
    setAddModalOpen(false);
    message.success('Value added');
  };

  const handleEditSave = () => {
    if (!editingKey) return;
    setAppValue(editingKey, editVal.trim(), editDesc.trim());
    setEditingKey(null);
    message.success('Value updated');
  };

  const handleDownloadValuesTemplate = () => {
    downloadAppValuesTemplate(XLSX);
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
            if (keys.some((key) => k.trim().toLowerCase() === key.toLowerCase())) return (row[k] || '').toString().trim();
          }
          return '';
        };

        let count = 0;
        rows.forEach((row) => {
          const k = getField(row, 'Key', 'key').toUpperCase().replace(/\s+/g, '_');
          const v = getField(row, 'Value', 'value');
          const d = getField(row, 'Description', 'description');
          if (k && v) { addAppValue(k, v, d); count++; }
        });

        if (count > 0) message.success(`${count} value(s) imported`);
        else message.warning('No valid rows found. Ensure columns are "Key" and "Value".');
      } catch (error) {
        console.error('[AppSettings][AppValues] Bulk upload parse failed', error);
        message.error('Failed to read file. Please use the provided template.');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleExportValues = () => {
    exportAppValuesWorkbook(XLSX, appValues);
  };

  return (
    <div style={{ padding: '12px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>{appValues.length} value{appValues.length !== 1 ? 's' : ''} configured</Text>
        <Space size={4}>
          <Button type="primary" size="small" icon={<PlusOutlined />} onClick={() => setAddModalOpen(true)} style={{ fontSize: 11 }}>New</Button>
          <Dropdown
            trigger={['click']}
            menu={{
              items: [
                {
                  key: 'upload',
                  label: (
                    <Upload accept=".xlsx,.xls" beforeUpload={handleUploadValues} showUploadList={false}>
                      <Space size={6}><UploadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Upload from Excel</Text></Space>
                    </Upload>
                  ),
                },
                {
                  key: 'template',
                  label: <Space size={6}><DownloadOutlined style={{ fontSize: 11 }} /><Text style={{ fontSize: 11 }}>Download template</Text></Space>,
                  onClick: handleDownloadValuesTemplate,
                },
                {
                  key: 'export',
                  label: <Space size={6}><DownloadOutlined style={{ fontSize: 11, color: '#52c41a' }} /><Text style={{ fontSize: 11, color: '#52c41a' }}>Export all to Excel</Text></Space>,
                  onClick: handleExportValues,
                },
                {
                  key: 'deleteAll',
                  danger: true,
                  label: <Text style={{ fontSize: 11 }}>Delete all</Text>,
                  onClick: () => {
                    Modal.confirm({
                      title: 'Delete all application values?',
                      content: 'This will permanently remove all key-value settings.',
                      okText: 'Delete All',
                      okButtonProps: { danger: true },
                      onOk: () => { clearAllValues(); message.success('All values deleted'); },
                    });
                  },
                },
              ],
            }}
          >
            <Button size="small" icon={<MoreOutlined />} />
          </Dropdown>
        </Space>
      </div>

      {appValues.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No values yet. Click New to add one." style={{ margin: '24px 0' }} />
      ) : (
        <div style={{ marginBottom: 8 }}>
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
                      <Input value={editVal} onChange={(e) => setEditVal(e.target.value)} size="small" style={{ fontSize: '12px' }} autoFocus />
                    </div>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: 4 }}>Description (optional)</div>
                    <Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} size="small" style={{ fontSize: '12px' }} placeholder="What is this value used for?" />
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

      <Modal
        open={addModalOpen}
        title={<Text style={{ fontSize: 13 }}>Add New App Value</Text>}
        onCancel={() => { setAddModalOpen(false); setAddKey(''); setAddVal(''); setAddDesc(''); }}
        onOk={handleAdd}
        okText="Add"
        okButtonProps={{ disabled: !addKey.trim() || !addVal.trim() }}
        width={440}
        destroyOnClose
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <div>
            <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Key <span style={{ color: '#f5222d' }}>*</span></Text>
            <Input
              placeholder="e.g. MY_SETTING"
              value={addKey}
              onChange={(e) => setAddKey(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
              size="small"
              style={{ fontFamily: 'monospace', fontSize: 11 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Value <span style={{ color: '#f5222d' }}>*</span></Text>
            <Input
              placeholder="e.g. https://... or any setting value"
              value={addVal}
              onChange={(e) => setAddVal(e.target.value)}
              onPressEnter={handleAdd}
              size="small"
              style={{ fontSize: 11 }}
            />
          </div>
          <div>
            <Text style={{ fontSize: 11, color: '#8c8c8c', display: 'block', marginBottom: 4 }}>Description <span style={{ color: '#8c8c8c' }}>(optional)</span></Text>
            <Input
              placeholder="What is this value used for?"
              value={addDesc}
              onChange={(e) => setAddDesc(e.target.value)}
              size="small"
              style={{ fontSize: 11 }}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default DropdownsAndValuesTab;
