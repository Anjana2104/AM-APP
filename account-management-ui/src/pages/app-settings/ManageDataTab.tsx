/**
 * src/pages/app-settings/ManageDataTab.tsx
 *
 * Manage Data — Centralised page-wise data management hub.
 * Provides per-module backup (Excel) and delete-all operations with
 * double-confirmation. Reuses all existing API clients.
 *
 * UI Location: Settings & Configuration > App Settings > Manage Data
 * Page ID: configuration
 */
import { useState } from 'react';
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  Input,
  Modal,
  Row,
  Space,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import {
  DatabaseOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  FileExcelOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as financeApi from '../../api/financeApi';
import * as invoiceApi from '../../api/invoiceApi';
import * as resourceApi from '../../api/resourceApi';
import * as requestApi from '../../api/requestApi';
import * as processApi from '../../api/processApi';
import * as configApi from '../../api/configApi';
import * as notificationApi from '../../api/notificationApi';
import * as notificationTriggerApi from '../../api/notificationTriggerApi';
import * as stakeholderApi from '../../api/stakeholderNetworkApi';
import { clearModuleArtifact } from '../../utils/moduleCleanupApi';
import { writeJsonSheetFile } from '../../utils/xlsxExport';
import { useAuth } from '../../context/AuthContext';
import { useConfig } from '../../context/ConfigContext';

const { Text } = Typography;

// ── Types ────────────────────────────────────────────────────────────────────

interface DataSection {
  key: string;
  category: string;
  categoryColor: string;
  label: string;
  description: string;
  pageId: string;
  fetchForBackup: () => Promise<Record<string, unknown>[]>;
  onDelete: (changedBy: string) => Promise<boolean>;
  deleteLabel?: string;
}

// ── DeleteConfirmModal ────────────────────────────────────────────────────────

interface DeleteConfirmProps {
  open: boolean;
  section: DataSection | null;
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
}

function DeleteConfirmModal({ open, section, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  const [typed, setTyped] = useState('');
  const isValid = typed.trim() === 'DELETE';

  const handleCancel = () => {
    setTyped('');
    onCancel();
  };

  const handleConfirm = () => {
    setTyped('');
    onConfirm();
  };

  return (
    <Modal
      open={open}
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
          <Text strong style={{ fontSize: 13 }}>Confirm Data Deletion</Text>
        </Space>
      }
      onCancel={handleCancel}
      footer={[
        <Button key="cancel" size="small" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          size="small"
          danger
          type="primary"
          disabled={!isValid}
          loading={loading}
          onClick={handleConfirm}
        >
          Delete All Data
        </Button>,
      ]}
      width={480}
      destroyOnClose
    >
      {section && (
        <>
          <Alert
            type="error"
            showIcon
            message="This action is irreversible"
            description={
              <span>
                All <strong>{section.label}</strong> data will be permanently deleted from the
                database. This cannot be undone. Consider downloading a backup first.
              </span>
            }
            style={{ marginBottom: 16 }}
          />
          <Text style={{ fontSize: 12 }}>
            Type <strong>DELETE</strong> to confirm:
          </Text>
          <Input
            value={typed}
            onChange={e => setTyped(e.target.value)}
            placeholder="Type DELETE to confirm"
            style={{ marginTop: 8 }}
            size="small"
            status={typed && !isValid ? 'error' : undefined}
            autoFocus
          />
        </>
      )}
    </Modal>
  );
}

// ── ManageDataTab ─────────────────────────────────────────────────────────────

export function ManageDataTab() {
  const { message } = App.useApp();
  const { hasPermission, currentUser } = useAuth();
  const { clearAllConfigs, clearAllValues } = useConfig();

  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ open: boolean; section: DataSection | null }>({
    open: false,
    section: null,
  });

  const changedBy = currentUser?.username ?? 'system';

  const fetchAllNotificationsForCurrentUser = async () => {
    const userId = currentUser?.id;
    if (!userId) {
      throw new Error('Current user session is missing. Please re-login and retry notifications backup.');
    }
    const pageSize = 100;
    let offset = 0;
    const allRows: Record<string, unknown>[] = [];
    while (true) {
      const page = await notificationApi.getNotifications(userId, { limit: pageSize, offset, unreadOnly: false });
      const rows = (page.notifications || []) as unknown as Record<string, unknown>[];
      allRows.push(...rows);
      if (!page.has_more || rows.length === 0) break;
      offset += pageSize;
    }
    return allRows;
  };

  // ── Section definitions ────────────────────────────────────────────────────

  const sections: DataSection[] = [
    {
      key: 'finance-projects',
      category: 'Finance Management',
      categoryColor: 'blue',
      label: 'SOW Details (Finance Projects)',
      description: 'All finance project records including milestones and revenue data',
      pageId: 'executive_revenue',
      fetchForBackup: async () => {
        const { projects } = await financeApi.getProjects();
        return projects as unknown as Record<string, unknown>[];
      },
      onDelete: async (by) => financeApi.clearAll(by),
    },
    {
      key: 'finance-bookings',
      category: 'Finance Management',
      categoryColor: 'blue',
      label: 'Finance Bookings',
      description: 'All booking records across all finance projects',
      pageId: 'executive_revenue',
      fetchForBackup: async () => [{ note: 'Use Finance Management page to export bookings per project' }],
      onDelete: async (by) => financeApi.deleteAllBookings(by),
      deleteLabel: 'Delete All Bookings',
    },
    {
      key: 'invoice-projects',
      category: 'Invoice Management',
      categoryColor: 'purple',
      label: 'Invoice Details',
      description: 'All invoice project records and invoice amounts',
      pageId: 'executive_invoicing',
      fetchForBackup: async () => {
        const { projects } = await invoiceApi.getInvoiceProjects();
        return projects as unknown as Record<string, unknown>[];
      },
      onDelete: async (by) => invoiceApi.clearAllInvoices(by),
    },
    {
      key: 'resources',
      category: 'Resource Information',
      categoryColor: 'green',
      label: 'Resource Records',
      description: 'All resource records including skills, engagements, and allocation data',
      pageId: 'resources_info',
      fetchForBackup: async () => {
        const { resources } = await resourceApi.getResources();
        return resources as unknown as Record<string, unknown>[];
      },
      onDelete: async () => resourceApi.clearAll(),
    },
    {
      key: 'resources-audit',
      category: 'Resource Information',
      categoryColor: 'green',
      label: 'Resource Audit History',
      description: 'All audit log entries for the Resources module',
      pageId: 'resources_info',
      fetchForBackup: async () => [{ note: 'Audit data not available via export API — use DB backup' }],
      onDelete: async () => clearModuleArtifact('resources', 'audit', 'ManageDataTab'),
      deleteLabel: 'Delete Audit History',
    },
    {
      key: 'resources-comments',
      category: 'Resource Information',
      categoryColor: 'green',
      label: 'Resource Comments',
      description: 'All comments across all resource records',
      pageId: 'resources_info',
      fetchForBackup: async () => [{ note: 'Comments data not available via export API — use DB backup' }],
      onDelete: async () => clearModuleArtifact('resources', 'comments', 'ManageDataTab'),
      deleteLabel: 'Delete All Comments',
    },
    {
      key: 'requests',
      category: 'Client Requests',
      categoryColor: 'orange',
      label: 'Client Requests',
      description: 'All client request records',
      pageId: 'clientmgmt_requests',
      fetchForBackup: async () => {
        const { requests } = await requestApi.getRequests();
        return requests as unknown as Record<string, unknown>[];
      },
      onDelete: async (by) => requestApi.clearAll(by),
    },
    {
      key: 'requests-audit',
      category: 'Client Requests',
      categoryColor: 'orange',
      label: 'Request Audit History',
      description: 'All audit log entries for Client Requests',
      pageId: 'clientmgmt_requests',
      fetchForBackup: async () => [{ note: 'Audit data not available via export API — use DB backup' }],
      onDelete: async () => clearModuleArtifact('requests', 'audit', 'ManageDataTab'),
      deleteLabel: 'Delete Audit History',
    },
    {
      key: 'requests-comments',
      category: 'Client Requests',
      categoryColor: 'orange',
      label: 'Request Comments',
      description: 'All comments across all client request records',
      pageId: 'clientmgmt_requests',
      fetchForBackup: async () => [{ note: 'Comments data not available via export API — use DB backup' }],
      onDelete: async () => clearModuleArtifact('requests', 'comments', 'ManageDataTab'),
      deleteLabel: 'Delete All Comments',
    },
    {
      key: 'process',
      category: 'Internal Process',
      categoryColor: 'geekblue',
      label: 'Internal Process Records (SOW / PIW)',
      description: 'All internal process records including SOW, PIW, and allocation data',
      pageId: 'clientmgmt_connects',
      fetchForBackup: async () => {
        const { rows } = await processApi.getProcessRows();
        return rows as Record<string, unknown>[];
      },
      onDelete: async (by) => processApi.clearAll(by),
    },
    {
      key: 'process-audit',
      category: 'Internal Process',
      categoryColor: 'geekblue',
      label: 'Process Audit History',
      description: 'All audit log entries for Internal Process',
      pageId: 'clientmgmt_connects',
      fetchForBackup: async () => [{ note: 'Audit data not available via export API — use DB backup' }],
      onDelete: async () => clearModuleArtifact('process', 'audit', 'ManageDataTab'),
      deleteLabel: 'Delete Audit History',
    },
    {
      key: 'process-comments',
      category: 'Internal Process',
      categoryColor: 'geekblue',
      label: 'Process Comments',
      description: 'All comments across all process records',
      pageId: 'clientmgmt_connects',
      fetchForBackup: async () => [{ note: 'Comments data not available via export API — use DB backup' }],
      onDelete: async () => clearModuleArtifact('process', 'comments', 'ManageDataTab'),
      deleteLabel: 'Delete All Comments',
    },
    {
      key: 'stakeholders-client',
      category: 'Stakeholders',
      categoryColor: 'cyan',
      label: 'Client Stakeholder Hierarchy',
      description: 'All client stakeholder network and hierarchy records',
      pageId: 'information_teamhierarchy',
      fetchForBackup: async () => {
        const { stakeholders } = await stakeholderApi.getStakeholderNetworkRecords('client');
        return stakeholders as unknown as Record<string, unknown>[];
      },
      onDelete: async (by) => {
        const result = await stakeholderApi.bulkSaveStakeholderNetworkRecords('client', [], by);
        return result.ok;
      },
    },
    {
      key: 'stakeholders-ra',
      category: 'Stakeholders',
      categoryColor: 'cyan',
      label: 'RA Stakeholder Hierarchy',
      description: 'All RA / internal stakeholder network and hierarchy records',
      pageId: 'information_teamhierarchy',
      fetchForBackup: async () => {
        const { stakeholders } = await stakeholderApi.getStakeholderNetworkRecords('ra');
        return stakeholders as unknown as Record<string, unknown>[];
      },
      onDelete: async (by) => {
        const result = await stakeholderApi.bulkSaveStakeholderNetworkRecords('ra', [], by);
        return result.ok;
      },
    },
    {
      key: 'notifications-history',
      category: 'App Notifications',
      categoryColor: 'magenta',
      label: 'Notifications History',
      description: 'All notifications visible to the current user session',
      pageId: 'configuration',
      fetchForBackup: fetchAllNotificationsForCurrentUser,
      onDelete: async () => {
        const userId = currentUser?.id;
        if (!userId) throw new Error('Current user session is missing. Please re-login and retry.');
        const rows = await fetchAllNotificationsForCurrentUser();
        for (const row of rows) {
          const id = Number(row.id || 0);
          if (!id) continue;
          const result = await notificationApi.deleteNotification(id);
          if (!result.ok) {
            console.error('[ManageDataTab] Failed to delete notification', { id, error: result.error });
            return false;
          }
        }
        return true;
      },
      deleteLabel: 'Delete Visible Notifications',
    },
    {
      key: 'notifications-triggers',
      category: 'App Notifications',
      categoryColor: 'magenta',
      label: 'Notification Triggers',
      description: 'All configured notification automation triggers',
      pageId: 'configuration',
      fetchForBackup: async () => {
        const triggers = await notificationTriggerApi.getNotificationTriggers();
        return triggers as unknown as Record<string, unknown>[];
      },
      onDelete: async () => {
        const triggers = await notificationTriggerApi.getNotificationTriggers();
        for (const trigger of triggers) {
          const result = await notificationTriggerApi.deleteNotificationTrigger(trigger.id);
          if (!result.ok) {
            console.error('[ManageDataTab] Failed to delete notification trigger', { id: trigger.id, error: result.error });
            return false;
          }
        }
        return true;
      },
    },
    {
      key: 'config-types',
      category: 'App Settings',
      categoryColor: 'default',
      label: 'App Configurations (Dropdown Types)',
      description: 'All custom dropdown type configurations and their values',
      pageId: 'configuration',
      fetchForBackup: async () => {
        const { configTypes } = await configApi.getConfigTypes();
        return configTypes as Record<string, unknown>[];
      },
      onDelete: async () => {
        clearAllConfigs();
        return true;
      },
    },
    {
      key: 'config-values',
      category: 'App Settings',
      categoryColor: 'default',
      label: 'App Values (Key-Value Store)',
      description: 'All application key-value settings and configuration entries',
      pageId: 'configuration',
      fetchForBackup: async () => {
        const { values } = await configApi.getValues();
        return values as Record<string, unknown>[];
      },
      onDelete: async () => {
        clearAllValues();
        return true;
      },
    },
  ];

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleBackup = async (section: DataSection) => {
    const key = `backup-${section.key}`;
    setLoadingKey(key);
    try {
      const rows = await section.fetchForBackup();
      const safeRows = rows.length > 0 ? rows : [{ note: 'No data found' }];
      const fileName = `backup_${section.key}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      writeJsonSheetFile(XLSX, safeRows, section.label.slice(0, 31), fileName);
      message.success(`Backup downloaded: ${fileName}`);
    } catch (error) {
      console.error(`[ManageDataTab] Backup failed for: ${section.label}`, error);
      message.error(`Backup failed for "${section.label}". Check the console for details.`);
    } finally {
      setLoadingKey(null);
    }
  };

  const handleDeleteClick = (section: DataSection) => {
    if (!hasPermission(section.pageId, 'delete')) {
      message.warning('You do not have permission to delete data for this module');
      return;
    }
    setDeleteModal({ open: true, section });
  };

  const handleDeleteConfirm = async () => {
    const { section } = deleteModal;
    if (!section) return;
    const key = `delete-${section.key}`;
    setLoadingKey(key);
    try {
      const ok = await section.onDelete(changedBy);
      if (ok) {
        message.success(`All "${section.label}" data deleted successfully`);
      } else {
        message.error(`Failed to delete "${section.label}" data. Server returned failure.`);
        console.error(`[ManageDataTab] Delete returned false for: ${section.label}`);
      }
    } catch (error) {
      console.error(`[ManageDataTab] Delete failed for: ${section.label}`, error);
      message.error(`Delete failed for "${section.label}". Check the console for details.`);
    } finally {
      setLoadingKey(null);
      setDeleteModal({ open: false, section: null });
    }
  };

  const handleDeleteCancel = () => setDeleteModal({ open: false, section: null });

  // ── Group sections by category ─────────────────────────────────────────────

  const grouped = sections.reduce<Record<string, DataSection[]>>((acc, sec) => {
    if (!acc[sec.category]) acc[sec.category] = [];
    acc[sec.category].push(sec);
    return acc;
  }, {});

  const isAnyDeleting = loadingKey?.startsWith('delete-') ?? false;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '12px 0' }}>
      <Alert
        type="warning"
        showIcon
        icon={<ExclamationCircleOutlined />}
        message="All delete operations are permanent and cannot be undone"
        description="Always download a backup before deleting. Delete operations remove records directly from the database — there is no recycle bin. A double-confirmation (type DELETE) is required."
        style={{ marginBottom: 20, fontSize: 12 }}
      />

      {Object.entries(grouped).map(([category, items]) => (
        <div key={category} style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <DatabaseOutlined style={{ color: '#595959' }} />
            <Text strong style={{ fontSize: 13 }}>{category}</Text>
            <Tag style={{ fontSize: 10, margin: 0 }}>
              {items.length} module{items.length !== 1 ? 's' : ''}
            </Tag>
          </div>

          <Row gutter={[12, 12]}>
            {items.map(section => {
              const canDelete = hasPermission(section.pageId, 'delete');
              const isBackingUp = loadingKey === `backup-${section.key}`;
              const isDeleting = loadingKey === `delete-${section.key}`;

              return (
                <Col key={section.key} xs={24} sm={24} md={12} lg={8}>
                  <Card
                    size="small"
                    style={{
                      border: '1px solid #e8e8e8',
                      borderRadius: 8,
                      height: '100%',
                    }}
                    styles={{ body: { padding: '12px 16px' } }}
                  >
                    <div style={{ marginBottom: 6 }}>
                      <Tag color={section.categoryColor} style={{ fontSize: 10, marginBottom: 6 }}>
                        {section.category}
                      </Tag>
                      <Text strong style={{ fontSize: 12, display: 'block' }}>
                        {section.label}
                      </Text>
                      <Text type="secondary" style={{ fontSize: 11, marginTop: 2, display: 'block' }}>
                        {section.description}
                      </Text>
                    </div>

                    <Space size={6} style={{ marginTop: 10 }}>
                      <Tooltip title="Download a backup Excel file of this module's data">
                        <Button
                          size="small"
                          icon={<FileExcelOutlined />}
                          loading={isBackingUp}
                          disabled={isDeleting}
                          onClick={() => handleBackup(section)}
                          style={{ fontSize: 11 }}
                        >
                          Backup
                        </Button>
                      </Tooltip>
                      <Tooltip
                        title={
                          !canDelete
                            ? 'You do not have delete permission for this module'
                            : 'Permanently delete all data — type DELETE to confirm'
                        }
                      >
                        <Button
                          size="small"
                          danger
                          icon={<DeleteOutlined />}
                          loading={isDeleting}
                          disabled={!canDelete || isBackingUp}
                          onClick={() => handleDeleteClick(section)}
                          style={{ fontSize: 11 }}
                        >
                          {section.deleteLabel ?? 'Delete All Data'}
                        </Button>
                      </Tooltip>
                    </Space>
                  </Card>
                </Col>
              );
            })}
          </Row>
        </div>
      ))}

      <DeleteConfirmModal
        open={deleteModal.open}
        section={deleteModal.section}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={isAnyDeleting}
      />
    </div>
  );
}

export default ManageDataTab;
