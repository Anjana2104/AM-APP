/**
 * LinkedProcessesPanel.tsx
 *
 * Shows the internal processes linked to a SOW details record and lets the
 * user link / unlink active processes.
 *
 * Rules (enforced on both client and server):
 *  - Only active processes (active === 'Yes') may be linked.
 *  - Only an active SOW record (status === 'Active') may receive links.
 *  - One process → at most one SOW; one SOW → many processes.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Badge, Button, Empty, Modal, Space, Spin, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ApartmentOutlined, LinkOutlined, MinusCircleOutlined, PlusCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import * as processApi from '../../api/processApi';

const { Text } = Typography;

// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedProcess {
  id: number;
  process_id: string;
  sow: string;
  active: string;
  finance_project_id: number | null;
  linked_resource_count?: number;
  linked_resources?: string | null;
}

interface AllProcess extends LinkedProcess {
  finance_project_name?: string | null;
  finance_project_code?: string | null;
}

interface Props {
  /** finance_projects.id of the currently viewed SOW record */
  financeProjectId: number;
  /** finance_projects.status — panel is read-only when 'Inactive' */
  sowStatus: 'Active' | 'Inactive' | string;
  /** Current user — recorded in audit log */
  changedBy?: string;
  /** When true, skip rendering the panel chrome and only render the manage modal.
   *  Use this from row-level actions to open the modal directly. */
  hidePanel?: boolean;
  /** Controlled open state for the manage modal. When provided, overrides internal state. */
  manageOpen?: boolean;
  /** Called when the manage modal requests to close (controlled mode). */
  onManageOpenChange?: (open: boolean) => void;
  /** Navigate to Internal Process page with this SOW focused. */
  onNavigateToProcess?: (sow: string) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const activeTag = (active: string) =>
  active === 'Yes'
    ? <Tag color="success" style={{ fontSize: 10 }}>Active</Tag>
    : <Tag color="default" style={{ fontSize: 10 }}>Inactive</Tag>;

// ─── Component ────────────────────────────────────────────────────────────────

const LinkedProcessesPanel: React.FC<Props> = ({
  financeProjectId, sowStatus, changedBy,
  hidePanel = false, manageOpen: controlledOpen, onManageOpenChange, onNavigateToProcess,
}) => {
  const [linked, setLinked] = useState<LinkedProcess[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal state — controlled externally when props are provided
  const [internalOpen, setInternalOpen] = useState(false);
  const modalOpen = controlledOpen !== undefined ? controlledOpen : internalOpen;
  const setModalOpen = (v: boolean) => {
    if (controlledOpen !== undefined) {
      onManageOpenChange?.(v);
    } else {
      setInternalOpen(v);
    }
  };

  const [allProcesses, setAllProcesses] = useState<AllProcess[]>([]);
  const [modalLoading, setModalLoading] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);

  const isSowActive = sowStatus === 'Active';

  // ── Fetch linked processes ─────────────────────────────────────────────────
  const fetchLinked = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await processApi.getLinkedProcesses(financeProjectId);
      setLinked(rows);
    } finally {
      setLoading(false);
    }
  }, [financeProjectId]);

  useEffect(() => { fetchLinked(); }, [fetchLinked]);

  // ── Load all processes when modal opens ────────────────────────────────────
  const loadAllProcesses = useCallback(async () => {
    setModalLoading(true);
    try {
      const { rows } = await processApi.getProcessRows();
      setAllProcesses(rows);
    } finally {
      setModalLoading(false);
    }
  }, []);

  useEffect(() => {
    if (modalOpen) loadAllProcesses();
  }, [modalOpen, loadAllProcesses]);

  // ── Open manage-links modal (internal mode) ────────────────────────────────
  const openModal = () => setModalOpen(true);

  // ── Link action ───────────────────────────────────────────────────────────
  const handleLink = async (process: AllProcess) => {
    if (process.active !== 'Yes') {
      message.warning('Only active processes can be linked');
      return;
    }
    if (process.finance_project_id !== null && process.finance_project_id !== financeProjectId) {
      message.warning(`This process is already linked to "${process.finance_project_name || process.finance_project_code || String(process.finance_project_id)}". Linking here will reassign it.`);
    }
    setSaving(process.id);
    const result = await processApi.linkToSow(process.id, financeProjectId, changedBy);
    setSaving(null);
    if (result.ok) {
      message.success(`"${process.sow}" linked successfully`);
      await fetchLinked();
      await loadAllProcesses();
    } else {
      message.error(result.error || 'Failed to link process');
    }
  };

  // ── Unlink action ─────────────────────────────────────────────────────────
  const handleUnlink = async (process: LinkedProcess) => {
    setSaving(process.id);
    const result = await processApi.linkToSow(process.id, null, changedBy);
    setSaving(null);
    if (result.ok) {
      message.success(`"${process.sow}" unlinked`);
      setLinked(prev => prev.filter(p => p.id !== process.id));
      setAllProcesses(prev => prev.map(p => p.id === process.id ? { ...p, finance_project_id: null, finance_project_name: null } : p));
    } else {
      message.error(result.error || 'Failed to unlink process');
    }
  };

  // ── Modal table: show all processes with link/unlink action ───────────────
  const modalColumns = [
    {
      title: 'ID',
      dataIndex: 'process_id',
      width: 60,
      render: (v: string) => <Text style={{ fontSize: 11, fontFamily: 'monospace' }}>{v}</Text>,
    },
    {
      title: 'SOW Name',
      dataIndex: 'sow',
      render: (v: string) => <Text style={{ fontSize: 11 }}>{v}</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'active',
      width: 80,
      render: (v: string) => activeTag(v),
    },
    {
      title: 'Currently Linked To',
      dataIndex: 'finance_project_name',
      render: (name: string | null, row: AllProcess) => {
        if (row.finance_project_id === financeProjectId) {
          return <Tag color="blue" style={{ fontSize: 10 }}>This SOW</Tag>;
        }
        if (row.finance_project_id) {
          return <Tag color="orange" style={{ fontSize: 10 }}>{name || row.finance_project_code || `SOW #${row.finance_project_id}`}</Tag>;
        }
        return <Text type="secondary" style={{ fontSize: 11 }}>—</Text>;
      },
    },
    {
      title: 'Action',
      width: 90,
      render: (_: any, row: AllProcess) => {
        const isLinkedHere = row.finance_project_id === financeProjectId;
        const isInactive = row.active !== 'Yes';
        if (isLinkedHere) {
          return (
            <Button
              type="text"
              size="small"
              icon={<MinusCircleOutlined style={{ color: '#ff4d4f' }} />}
              loading={saving === row.id}
              onClick={() => handleUnlink(row)}
              style={{ fontSize: 11 }}
            >
              Unlink
            </Button>
          );
        }
        return (
          <Tooltip title={isInactive ? 'Cannot link inactive processes' : (isSowActive ? 'Link to this SOW' : 'SOW is inactive — cannot add links')}>
            <Button
              type="text"
              size="small"
              icon={<PlusCircleOutlined style={{ color: isInactive || !isSowActive ? '#d9d9d9' : '#52c41a' }} />}
              disabled={isInactive || !isSowActive}
              loading={saving === row.id}
              onClick={() => handleLink(row)}
              style={{ fontSize: 11 }}
            >
              Link
            </Button>
          </Tooltip>
        );
      },
    },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────

  // Shared manage modal (used both from panel button and direct row-level action)
  const manageModal = (
    <Modal
      title={
        <Space>
          <LinkOutlined style={{ color: '#1890ff' }} />
          <span style={{ fontSize: 13 }}>Manage Linked Internal Processes</span>
        </Space>
      }
      open={modalOpen}
      onCancel={() => setModalOpen(false)}
      footer={null}
      width={700}
      destroyOnClose
    >
      {!isSowActive && (
        <div style={{ background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, padding: '8px 12px', marginBottom: 12, fontSize: 11, color: '#d46b08' }}>
          This SOW record is inactive. Links cannot be added, but existing links are shown for reference.
        </div>
      )}
      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 12 }}>
        Only active internal processes can be linked. A process can be linked to only one SOW at a time.
      </Text>
      {modalLoading ? (
        <Spin style={{ display: 'block', textAlign: 'center', padding: 32 }} />
      ) : (
        <Table
          dataSource={allProcesses}
          columns={modalColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 8, showSizeChanger: false, size: 'small' }}
          style={{ fontSize: 11 }}
          rowClassName={(row) =>
            row.finance_project_id === financeProjectId ? 'linked-process-row' : ''
          }
        />
      )}
    </Modal>
  );

  // Direct mode: row dropdown clicked "Link Processes" — render only the modal, no panel chrome
  if (hidePanel) {
    return manageModal;
  }

  // Panel mode: render the full panel inside the detail drawer
  return (
    <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <Space size={6}>
          <ApartmentOutlined style={{ color: '#1890ff' }} />
          <Text style={{ fontSize: '12px', fontWeight: 600 }}>
            Linked Internal Processes
          </Text>
          <Badge count={linked.length} style={{ backgroundColor: linked.length ? '#1890ff' : '#d9d9d9', fontSize: 10 }} />
        </Space>
        <Space size={4}>
          <Tooltip title="Refresh" overlayInnerStyle={{ fontSize: 11 }}>
            <Button type="text" size="small" icon={<ReloadOutlined />} onClick={fetchLinked} loading={loading} />
          </Tooltip>
          <Tooltip
            title={!isSowActive ? 'SOW must be active to manage links' : 'Link / unlink processes'}
            overlayInnerStyle={{ fontSize: 11 }}
          >
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={openModal}
              disabled={!isSowActive}
              style={{ fontSize: 11, background: !isSowActive ? '#f0f0f0' : '#e8e8e8', border: '1px solid #d9d9d9', color: !isSowActive ? '#bfbfbf' : '#262626' }}
            >
              Manage Links
            </Button>
          </Tooltip>
        </Space>
      </div>

      {/* Linked list */}
      {loading ? (
        <Spin size="small" style={{ display: 'block', textAlign: 'center', padding: 16 }} />
      ) : linked.length === 0 ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<Text type="secondary" style={{ fontSize: 11 }}>No internal processes linked yet</Text>}
          style={{ margin: '12px 0' }}
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {linked.map(p => (
            <div
              key={p.id}
              style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 6, padding: '8px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}
            >
              <div style={{ minWidth: 0 }}>
                <Space size={8} wrap>
                  <Tag color="processing" style={{ fontSize: 10, margin: 0 }}>{p.process_id}</Tag>
                  {onNavigateToProcess ? (
                    <Button
                      type="link"
                      size="small"
                      style={{ padding: 0, height: 'auto', fontSize: 12 }}
                      onClick={() => onNavigateToProcess(p.sow)}
                    >
                      {p.sow}
                    </Button>
                  ) : (
                    <Text style={{ fontSize: 12 }}>{p.sow}</Text>
                  )}
                  {activeTag(p.active)}
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    Linked resources: {Number(p.linked_resource_count || 0)}
                  </Text>
                  {p.linked_resources ? (
                    <Tooltip
                      title={p.linked_resources}
                      overlayInnerStyle={{ fontSize: 11, maxWidth: 420 }}
                    >
                      <div style={{ fontSize: 11, color: '#595959', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 420 }}>
                        {p.linked_resources}
                      </div>
                    </Tooltip>
                  ) : null}
                </div>
              </div>
              {isSowActive && (
                <Tooltip title="Unlink this process" overlayInnerStyle={{ fontSize: 11 }}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<MinusCircleOutlined />}
                    loading={saving === p.id}
                    onClick={() => handleUnlink(p)}
                    style={{ fontSize: 11 }}
                  />
                </Tooltip>
              )}
            </div>
          ))}
        </div>
      )}

      {manageModal}
    </div>
  );
};

export default LinkedProcessesPanel;
