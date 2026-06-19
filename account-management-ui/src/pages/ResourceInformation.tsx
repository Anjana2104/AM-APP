/**
 * ResourceInformation.tsx
 * 
 * Resource Hub — Comprehensive resource management with skills, roles,
 * allocation tracking, and detailed resource profiles
 * UI Location: Account Operations > Resources > Resource Hub
 * Page ID: resources_info
 */
import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  Upload,
  Table,
  Typography,
  Space,
  Button,
  message,
  Drawer,
  Tag,
  Dropdown,
  Modal,
  Form,
  Input,
  Tooltip,
  Slider,
  Checkbox,
  Select,
  Tabs,
  Row,
  Col,
  Statistic,
  Progress,
  Spin,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  UploadOutlined,
  DownloadOutlined,
  EditOutlined,
  DeleteOutlined,
  AppstoreOutlined,
  TableOutlined,
  MoreOutlined,
  EyeOutlined,
  PlusOutlined,
  ColumnHeightOutlined,
  FilterOutlined,
  BarChartOutlined,
  CloudServerOutlined,
  SaveOutlined,
  InboxOutlined,
  FileTextOutlined,
  FileExcelOutlined,
  ExpandAltOutlined,
  ShrinkOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import * as resourceApi from '../api/resourceApi';
import * as requestApi from '../api/requestApi';
import { useConfig } from '../context/ConfigContext';
import { useAuth } from '../context/AuthContext';
import { useUserPreferences } from '../context/UserPreferencesContext';
import ResourceDetailPanel from '../components/ResourceDetailPanel';
import ResourceOverviewCharts from '../components/ResourceOverviewCharts';

const { Title, Text } = Typography;

export type { ResourceRow } from '../types/resource';
import type { ResourceRow } from '../types/resource';

type ExcelRow = Record<string, string | undefined>;

type FilterState = {
  sno: string;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string;
  roleOrDomain: string;
  totalWorkex: string;
  skills: string;
  engagement: string;
  workexRange: [number, number];
  allocationStatus: string;
  beelineId: string;
};

const DEFAULT_FILTERS: FilterState = {
  sno: '',
  raId: '',
  empName: '',
  emailId: '',
  piwRole: '',
  roleOrDomain: '',
  totalWorkex: '',
  skills: '',
  engagement: '',
  workexRange: [0, 70],
  allocationStatus: '',
  beelineId: '',
};

const COLUMN_KEYS = ['sno', 'raId', 'empName', 'emailId', 'piwRole', 'roleOrDomain', 'previousWorkex', 'doj', 'totalWorkex', 'engagement', 'allocationStatus', 'skills', 'action'] as const;

const COLUMN_LABELS: Record<string, string> = {
  sno: 'S.NO',
  raId: 'RA ID',
  empName: 'Employee Name',
  emailId: 'Email Id',
  piwRole: 'PIW Role',
  roleOrDomain: 'Role/Domain',
  previousWorkex: 'Previous Workex',
  doj: 'DOJ',
  totalWorkex: 'Total Workex',
  engagement: 'Current Engagement',
  allocationStatus: 'Allocation Status',
  skills: 'Skills',
};

// ─── Helper ──────────────────────────────────────────────────────────────────
function downloadFileFromBlob(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStr() {
  return new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Resumes Tab ─────────────────────────────────────────────────────────────
function ResumesTab() {
  const { getAppValue } = useConfig();
  const { hasPermission, currentUser } = useAuth();
  const spUrl = getAppValue('RESUME_STORAGE_URL') || '';
  const [resumeList, setResumeList] = useState<{ key: string; file: File; uploadDate: string }[]>([]);

  const downloadTemplate = () => {
    // Empty template with just headers
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Employee ID', 'Role', 'Skills', 'Total Experience', 'Email'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Resume Template');
    XLSX.writeFile(wb, 'Resume_Template.xlsx');
  };

  const handleFile = (file: File) => {
    setResumeList(prev => [...prev, { key: `res_${Date.now()}`, file, uploadDate: todayStr() }]);
    if (spUrl) {
      message.success(
        <span><strong>{file.name}</strong> added. Use <em>Save to SP ↗</em> to store in SharePoint.</span>,
        5,
      );
    } else {
      message.success(`${file.name} uploaded`);
    }
    return false;
  };

  const handleDelete = (key: string) => {
    // Permission guard at function level
    if (!canDeleteResume) {
      message.error('You do not have permission to remove resumes.');
      return;
    }
    setResumeList(prev => prev.filter(r => r.key !== key));
    message.success('Resume removed');
  };

  return (
    <div style={{ padding: '16px 0' }}>
      {/* SP banner */}
      {spUrl && (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 Resumes should also be saved to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>Open SharePoint Folder ↗</a>
        </div>
      )}
      {!spUrl && (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure the <strong>RESUME_STORAGE_URL</strong> in App Configuration to link to your SharePoint folder for centralized resume storage.
        </div>
      )}

      {/* Template download */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button icon={<DownloadOutlined />} size="small" onClick={downloadTemplate} style={{ fontSize: '11px', borderRadius: 6 }}>
          Download Template
        </Button>
      </div>

      {/* Upload dragger */}
      <Upload.Dragger multiple beforeUpload={handleFile} showUploadList={false} style={{ borderRadius: 8, marginBottom: 20 }}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: '#722ED1' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px' }}>Click or drag resume files to upload</p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports PDF, Word, and all file types. Store centrally in the configured SharePoint folder.
        </p>
      </Upload.Dragger>

      {/* List */}
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
                  <Button size="small" style={{ borderRadius: 6, fontSize: '10px', borderColor: '#722ED1', color: '#722ED1' }}
                    onClick={() => { downloadFileFromBlob(file); window.open(spUrl, '_blank', 'noopener,noreferrer'); }}>
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

const ResourceMgmt: React.FC<{ onResourcesChange?: (resources: ResourceRow[]) => void; initialRoleFilter?: string; initialRaIdFilter?: string; initialFilterType?: string; initialFilterValue?: string; onFilterApplied?: () => void; onNavigateToRequest?: (beelineId: string) => void; onNavigateToInsights?: () => void; onNavigateToProcess?: (sowName: string) => void }> = ({ onResourcesChange, initialRoleFilter, initialRaIdFilter, initialFilterType, initialFilterValue, onFilterApplied, onNavigateToRequest, onNavigateToInsights, onNavigateToProcess }) => {
  const { hasPermission, currentUser } = useAuth();
  const { preferencesLoaded, getColumnVisibility, saveColumnVisibility } = useUserPreferences();
  const canEdit = hasPermission('resources_info', 'edit');
  const canDelete = hasPermission('resources_info', 'delete');

  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fromServer, setFromServer] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load from API on mount — DB is the single source of truth
  useEffect(() => {
    setLoading(true);
    resourceApi.getResources().then(({ resources: apiRows, fromServer: online }) => {
      if (online) {
        const mapped: ResourceRow[] = apiRows.map((r, i) => ({
          key: String((r as any).ra_id || r.raId || i),
          id: (r as any).id,
          sno: String(r.sno || i + 1),
          raId: String((r as any).ra_id || r.raId || ''),
          empName: String((r as any).emp_name || r.empName || ''),
          emailId: String((r as any).email_id || r.emailId || ''),
          piwRole: String((r as any).piw_role || r.piwRole || ''),
          roleOrDomain: String((r as any).role_or_domain || r.roleOrDomain || ''),
          previousWorkex: String((r as any).previous_workex || r.previousWorkex || ''),
          doj: String((r as any).doj || r.doj || ''),
          totalWorkex: String((r as any).total_workex || r.totalWorkex || ''),
          skills: String((r as any).skills || r.skills || ''),
          engagement: String((r as any).engagement || r.engagement || ''),
          allocationStatus: String((r as any).allocation_status ?? r.allocationStatus ?? ''),
          beelineId: String((r as any).beeline_id || (r as any).beelineId || ''),
          engagementStartDate: String((r as any).engagement_start_date || r.engagementStartDate || ''),
          engagementEndDate: String((r as any).engagement_end_date || r.engagementEndDate || ''),
          sowName: String((r as any).sow_name || r.sowName || ''),
        }));
        setResources(mapped);
        onResourcesChange?.(mapped);
        setFromServer(true);
      }
    }).finally(() => setLoading(false));
  }, []);

  // Notify parent (no localStorage)
  const handleResourcesChange = (newResources: ResourceRow[]) => {
    setResources(newResources);
    onResourcesChange?.(newResources);
  };
  const [detailDrawer, setDetailDrawer] = useState(false);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'card'>('card');
  const [editDrawer, setEditDrawer] = useState(false);
  const [editingResource, setEditingResource] = useState<ResourceRow | null>(null);
  const [form] = Form.useForm();
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnDrawer, setColumnDrawer] = useState(false);
  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(
    new Set(COLUMN_KEYS)
  );

  // Apply saved user preferences once loaded
  useEffect(() => {
    if (!preferencesLoaded) return;
    const vis = getColumnVisibility('resources');
    const savedKeys = Object.entries(vis).filter(([,v]) => v).map(([k]) => k);
    setVisibleColumnsState(new Set(['sno', 'action', ...savedKeys]));
  }, [preferencesLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const setVisibleColumns = (newSet: Set<string>) => {
    setVisibleColumnsState(newSet);
    const vis: Record<string, boolean> = {};
    ['raId','empName','emailId','piwRole','roleOrDomain','previousWorkex','doj','totalWorkex','engagement','allocationStatus','skills']
      .forEach(k => { vis[k] = newSet.has(k); });
    saveColumnVisibility('resources', vis);
  };
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  // ── Beeline Link Modal ────────────────────────────────────────────────────
  const [beelineLinkModal, setBeelineLinkModal] = useState<{ open: boolean; resource: ResourceRow | null }>({ open: false, resource: null });
  const [selectedBeelineId, setSelectedBeelineId] = useState<string>('');
  const [savingBeeline, setSavingBeeline] = useState(false);
  const [beelineRequestOptions, setBeelineRequestOptions] = useState<{ value: string; label: string }[]>([]);

  const openBeelineLinkModal = (resource: ResourceRow) => {
    setSelectedBeelineId(resource.beelineId || '');
    setBeelineLinkModal({ open: true, resource });
    requestApi.getActiveRequests().then(activeReqs => {
      setBeelineRequestOptions(activeReqs.filter(r => r.beelineId).map(r => ({ value: r.beelineId, label: r.beelineId })));
    });
  };

  const handleSaveBeelineLink = async () => {
    const resource = beelineLinkModal.resource;
    if (!resource?.id) return;
    setSavingBeeline(true);
    const ok = await resourceApi.setBeelineLink(resource.id, selectedBeelineId, currentUser?.username || 'system');
    setSavingBeeline(false);
    if (ok) {
      setResources(prev => prev.map(r => r.key === resource.key ? { ...r, beelineId: selectedBeelineId } : r));
      if (selectedResource?.key === resource.key) {
        setSelectedResource(prev => prev ? { ...prev, beelineId: selectedBeelineId } : prev);
      }
      message.success(selectedBeelineId ? `Linked to ${selectedBeelineId}` : 'Beeline link removed');
      setBeelineLinkModal({ open: false, resource: null });
    } else {
      message.error('Failed to save beeline link');
    }
  };
  // ── End Beeline Link Modal ────────────────────────────────────────────────

  const { getConfig, getConfigByLink } = useConfig();
  const engagementOptions = useMemo(() => {
    const cfg = getConfigByLink('engagement_field');
    return cfg ? cfg.items.map(i => ({ label: i.label, value: i.value })) : [];
  }, [getConfigByLink]);

  const allocationStatusOptions = useMemo(() => {
    const cfg = getConfigByLink('allocation_status_field');
    return cfg ? cfg.items.map(i => ({ label: i.label, value: i.value })) : [];
  }, [getConfigByLink]);

  // Apply incoming role filter from navigation
  useEffect(() => {
    if (initialRoleFilter) {
      setFilters(f => ({ ...f, roleOrDomain: initialRoleFilter }));
      setViewMode('table');
      setShowFilterPanel(true);
      onFilterApplied?.();
    }
  }, [initialRoleFilter]);

  // Apply incoming RA ID filter from navigation (e.g. from Resource Insights)
  useEffect(() => {
    if (initialRaIdFilter) {
      setFilters(f => ({ ...f, raId: initialRaIdFilter }));
      setViewMode('table');
      setShowFilterPanel(true);
      onFilterApplied?.();
    }
  }, [initialRaIdFilter]);

  // Apply chart-click filter (piwRole, engagement, skills, expBucket, roleOrDomain)
  useEffect(() => {
    if (!initialFilterType || !initialFilterValue) return;
    if (initialFilterType === 'expBucket') {
      const EXP_BUCKETS = [
        { label: '0–3 Yrs', min: 0, max: 3 },
        { label: '3–5 Yrs', min: 3, max: 5 },
        { label: '5–8 Yrs', min: 5, max: 8 },
        { label: '8–10 Yrs', min: 8, max: 10 },
        { label: '10+ Yrs', min: 10, max: Infinity },
      ];
      const bucket = EXP_BUCKETS.find(b => b.label === initialFilterValue);
      if (bucket) setFilters(f => ({ ...f, workexRange: [bucket.min, bucket.max === Infinity ? 70 : bucket.max] }));
    } else {
      const fieldMap: Record<string, string> = { piwRole: 'piwRole', roleOrDomain: 'roleOrDomain', engagement: 'engagement', skills: 'skills' };
      const field = fieldMap[initialFilterType];
      if (field) setFilters(f => ({ ...f, [field]: initialFilterValue }));
    }
    setViewMode('table');
    setShowFilterPanel(true);
    onFilterApplied?.();
  }, [initialFilterType, initialFilterValue]);

  const filterPanelRef = useRef<HTMLDivElement>(null);
  const isFilterApplied = filters.empName !== '' || filters.raId !== '' || filters.piwRole !== '' || filters.roleOrDomain !== '' || filters.skills !== '' || filters.engagement !== '' || filters.allocationStatus !== '' || filters.workexRange[0] !== 0 || filters.workexRange[1] !== 70 || !!globalSearch || !!filters.beelineId;

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      // Ignore clicks inside Ant Design portals (Select dropdowns, Tooltip popups, etc.)
      const isInsideAntPopup = !!(target as Element)?.closest?.('.ant-select-dropdown, .ant-picker-dropdown, .ant-tooltip, .ant-popover, .ant-dropdown');
      if (filterPanelRef.current && !filterPanelRef.current.contains(target) && !isInsideAntPopup) {
        setShowFilterPanel(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const closeFilterOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilterPanel(false);
  };

  const REQUIRED_UPLOAD_HEADERS = ['S.NO', 'RA ID', 'Employee Name', 'Email', 'PIW Role', 'Role/Domain', 'Previous Workex', 'DOJ', 'Total Workex', 'Current Engagement', 'Skills'];

  const handleUpload = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        if (!data) { message.error('Failed to read file'); return; }
        const workbook = XLSX.read(data, { type: 'binary' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];

        // ── Template validation ──────────────────────────────────────────
        // Read raw header row (first row of the sheet)
        const headerRow: string[] = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0] as string[] || [];
        const uploadedHeaders = headerRow.map((h: string) => String(h || '').trim());
        const missingHeaders = REQUIRED_UPLOAD_HEADERS.filter(h => !uploadedHeaders.includes(h));
        if (missingHeaders.length > 0) {
          Modal.error({
            title: 'Invalid Template',
            content: (
              <div>
                <p style={{ marginBottom: 8 }}>The uploaded file does not match the required template. Missing columns:</p>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {missingHeaders.map(h => <li key={h} style={{ color: '#f5222d', fontSize: '13px' }}>{h}</li>)}
                </ul>
                <p style={{ marginTop: 12, color: '#8c8c8c', fontSize: '12px' }}>
                  Please download the template using the <strong>Download Template</strong> button and fill data in the correct format.
                </p>
              </div>
            ),
            okText: 'OK',
          });
          return;
        }
        // ────────────────────────────────────────────────────────────────

        const jsonData: ExcelRow[] = XLSX.utils.sheet_to_json(worksheet);
        if (!jsonData.length) { message.error('No data found in file'); return; }

        const totalRows = jsonData.length;
        const skippedRows: { rowNum: number; reason: string; detail?: string }[] = [];

        // First pass: detect duplicates within the file itself
        const raIdCountInFile = new Map<string, number[]>();
        jsonData.forEach((row, idx) => {
          const raId = String(row['RA ID'] || row['Ra ID'] || '').trim().toLowerCase();
          if (raId) {
            const arr = raIdCountInFile.get(raId) || [];
            arr.push(idx + 2);
            raIdCountInFile.set(raId, arr);
          }
        });

        const uploaded: ResourceRow[] = [];
        const seenRaIds = new Set<string>();
        jsonData.forEach((row, idx) => {
          const rowNum = idx + 2; // +2: 1-based + header row
          const raId = String(row['RA ID'] || row['Ra ID'] || '').trim();
          const empName = String(row['Employee Name'] || row['Emp Name'] || '').trim();
          const totalWorkexRaw = String(row['Total Workex'] || row['Total Experience'] || '').trim();

          if (!raId) {
            skippedRows.push({ rowNum, reason: 'Missing RA ID', detail: empName ? `Employee: ${empName}` : undefined });
            return;
          }
          if (!empName) {
            skippedRows.push({ rowNum, reason: 'Missing Employee Name', detail: `RA ID: ${raId}` });
            return;
          }
          // Duplicate RA ID within the file
          if (seenRaIds.has(raId.toLowerCase())) {
            const dupeRows = raIdCountInFile.get(raId.toLowerCase()) || [];
            skippedRows.push({ rowNum, reason: 'Duplicate RA ID in file', detail: `RA ID: ${raId} — also appears at row(s): ${dupeRows.filter(r => r !== rowNum).join(', ')}` });
            return;
          }
          seenRaIds.add(raId.toLowerCase());
          // Validate Total Workex
          if (totalWorkexRaw) {
            const parsed = parseFloat(totalWorkexRaw.replace(/[^\d.-]/g, ''));
            if (!isNaN(parsed) && parsed > 70) {
              skippedRows.push({ rowNum, reason: `Invalid Total Workex (${parsed} years > 70 years max)`, detail: `RA ID: ${raId}, Employee: ${empName}` });
              return;
            }
          }

          uploaded.push({
            key: String(raId),
            sno: String(row['S.NO'] || idx + 1),
            raId,
            empName,
            emailId: String(row['Email'] || row['Email Id'] || row['Email ID'] || '').trim(),
            piwRole: String(row['PIW Role'] || row['Role'] || '').trim(),
            roleOrDomain: String(row['Role/Domain'] || row['Domain'] || '').trim(),
            previousWorkex: String(row['Previous Workex'] || row['Prev Workex'] || '').trim(),
            doj: String(row['DOJ'] || row['Date of Joining'] || '').trim(),
            totalWorkex: totalWorkexRaw,
            skills: String(row['Skills'] || '').trim(),
            engagement: String(row['Current Engagement'] || row['Engagement'] || '').trim(),
            allocationStatus: (() => {
              const eng = String(row['Current Engagement'] || row['Engagement'] || '').trim();
              return eng && eng.toLowerCase() !== 'bench' ? 'Joined' : 'Available';
            })(),
          });
        });

        // Build merged list using current resources snapshot (read from state via functional update)
        const currentResources = await new Promise<ResourceRow[]>(resolve => {
          setResources(prev => { resolve(prev); return prev; });
        });

        const existingMap = new Map(currentResources.map(r => [r.raId.toLowerCase(), r]));
        let newCount = 0, updCount = 0;
        uploaded.forEach(u => {
          const key = u.raId.toLowerCase();
          if (existingMap.has(key)) {
            const existing = existingMap.get(key)!;
            existingMap.set(key, { ...existing, ...u, allocationStatus: existing.allocationStatus || u.allocationStatus });
            updCount++;
          } else {
            existingMap.set(key, u);
            newCount++;
          }
        });
        const mergedRows = Array.from(existingMap.values()).map((r, i) => ({ ...r, sno: String(i + 1) }));

        // 1. Update UI state
        setResources(mergedRows);
        onResourcesChange?.(mergedRows);

        // 2. Save to database
        const loadingKey = message.loading('Saving to database...', 0);
        let serverOk = false;
        try {
          const result = await resourceApi.bulkSave(mergedRows.map(r => ({
            raId: r.raId, sno: Number(r.sno), empName: r.empName, emailId: r.emailId,
            piwRole: r.piwRole, roleOrDomain: r.roleOrDomain, previousWorkex: r.previousWorkex,
            doj: r.doj, totalWorkex: r.totalWorkex, engagement: r.engagement || '', skills: r.skills,
            allocationStatus: r.allocationStatus || '',
          })), currentUser?.username || 'system');
          (loadingKey as any)();
          serverOk = !!result.ok;
          if (!result.ok) {
            message.warning(`Loaded locally — server offline, changes not persisted`);
          }
        } catch {
          (loadingKey as any)();
          message.warning(`Loaded locally (server unreachable). Re-upload when server is available.`);
        }

        // 3. Show result summary (with skipped rows if any)
        if (skippedRows.length > 0) {
          Modal.warning({
            title: `Upload Result: ${uploaded.length} of ${totalRows} rows processed`,
            width: 560,
            content: (
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
            ),
          });
        } else if (serverOk) {
          message.success(`Upload complete: ${newCount} new, ${updCount} updated (total ${mergedRows.length} records)`);
        }
      } catch (error) {
        message.error(error instanceof Error ? error.message : 'Error parsing file');
      }
    };
    reader.onerror = () => message.error('Failed to read file');
    reader.readAsBinaryString(file);
    return false;
  }, [onResourcesChange]);

  const downloadTemplate = useCallback(() => {
    try {
      const template = [
        {
          'S.NO': '1',
          'RA ID': 'RA001',
          'Employee Name': 'John Doe',
          'Email': 'john.doe@example.com',
          'PIW Role': 'Developer',
          'Role/Domain': 'Full Stack',
          'Previous Workex': '2 years',
          'DOJ': '2024-01-15',
          'Total Workex': '5 years',
          'Current Engagement': 'Full-time',
          'Skills': 'JavaScript, React, Node.js',
        },
      ];

      const worksheet = XLSX.utils.json_to_sheet(template);
      worksheet['!cols'] = [
        { wch: 8 },
        { wch: 12 },
        { wch: 20 },
        { wch: 25 },
        { wch: 15 },
        { wch: 20 },
        { wch: 15 },
        { wch: 15 },
        { wch: 15 },
        { wch: 18 },
        { wch: 40 },
      ];

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Resources');
      XLSX.writeFile(workbook, 'Resource_Template.xlsx');
      message.success('Template downloaded successfully');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Download error';
      message.error(`Error: ${errorMsg}`);
    }
  }, []);

  const handleAddNew = useCallback(() => {
    form.resetFields();
    setEditingResource(null);
    setEditDrawer(true);
  }, [form]);

  const handleEdit = useCallback((resource: ResourceRow | null) => {
    if (!resource) return;

    // Permission guard at function level
    if (!canEdit) {
      message.error('You do not have permission to edit resources.');
      return;
    }

    setEditingResource(resource);
    form.setFieldsValue({
      sno: resource.sno || '',
      raId: resource.raId || '',
      empName: resource.empName || '',
      emailId: resource.emailId || '',
      piwRole: resource.piwRole || '',
      roleOrDomain: resource.roleOrDomain || '',
      previousWorkex: resource.previousWorkex || '',
      doj: resource.doj || '',
      totalWorkex: resource.totalWorkex || '',
      skills: resource.skills || '',
      engagement: resource.engagement || '',
      engagementStartDate: resource.engagementStartDate || '',
      engagementEndDate: resource.engagementEndDate || '',
    });
    setEditDrawer(true);
  }, [form, canEdit]);

  const handleSaveEdit = useCallback(
    async (values: any) => {
      try {
        if (!values || typeof values !== 'object') {
          message.error('Invalid form data');
          return;
        }

        const newEngagement = String(values.engagement || '').trim();
        const isEdit = !!(editingResource && editingResource.key);

        if (isEdit) {
          // EDIT: compute new allocationStatus — bench→Available, else preserve existing
          const newAllocStatus = newEngagement.toLowerCase() === 'bench'
            ? 'Available'
            : (editingResource!.allocationStatus || 'Joined');

          const updatedRow: ResourceRow = {
            ...editingResource!,
            raId: String(values.raId || ''),
            empName: String(values.empName || ''),
            emailId: String(values.emailId || ''),
            piwRole: String(values.piwRole || ''),
            roleOrDomain: String(values.roleOrDomain || ''),
            previousWorkex: String(values.previousWorkex || ''),
            doj: String(values.doj || ''),
            totalWorkex: String(values.totalWorkex || ''),
            skills: String(values.skills || ''),
            engagement: newEngagement,
            allocationStatus: newAllocStatus,
            engagementStartDate: newAllocStatus === 'Available' ? '' : String(values.engagementStartDate || ''),
            engagementEndDate: newAllocStatus === 'Available' ? '' : String(values.engagementEndDate || ''),
          };

          setResources(prev => {
            const updated = prev.map(r => r.key === editingResource!.key ? updatedRow : r);
            onResourcesChange?.(updated);
            return updated;
          });

          // Use PUT /:id so the server applies bench→Available logic correctly
          if (updatedRow.id) {
            await resourceApi.updateResource(updatedRow.id, {
              raId: updatedRow.raId, empName: updatedRow.empName, emailId: updatedRow.emailId,
              piwRole: updatedRow.piwRole, roleOrDomain: updatedRow.roleOrDomain,
              previousWorkex: updatedRow.previousWorkex, doj: updatedRow.doj,
              totalWorkex: updatedRow.totalWorkex, engagement: updatedRow.engagement,
              skills: updatedRow.skills,
              engagementStartDate: updatedRow.engagementStartDate,
              engagementEndDate: updatedRow.engagementEndDate,
              changedBy: currentUser?.username || 'system',
            });
          }
        } else {
          // ADD NEW: compute allocationStatus from engagement
          const newAllocStatus = newEngagement.toLowerCase() === 'bench' ? 'Available' : 'Joined';
          const newKey = String(Date.now());

          const newRow: ResourceRow = {
            key: newKey, sno: '',
            raId: String(values.raId || ''),
            empName: String(values.empName || ''),
            emailId: String(values.emailId || ''),
            piwRole: String(values.piwRole || ''),
            roleOrDomain: String(values.roleOrDomain || ''),
            previousWorkex: String(values.previousWorkex || ''),
            doj: String(values.doj || ''),
            totalWorkex: String(values.totalWorkex || ''),
            skills: String(values.skills || ''),
            engagement: newEngagement,
            allocationStatus: newAllocStatus,
          };

          let updatedList: ResourceRow[] = [];
          setResources(prev => {
            updatedList = [...prev, { ...newRow, sno: String(prev.length + 1) }];
            onResourcesChange?.(updatedList);
            return updatedList;
          });

          // Use bulkSave for INSERT — it will set allocation_status based on engagement
          await resourceApi.bulkSave([{
            raId: newRow.raId, sno: 0, empName: newRow.empName, emailId: newRow.emailId,
            piwRole: newRow.piwRole, roleOrDomain: newRow.roleOrDomain,
            previousWorkex: newRow.previousWorkex, doj: newRow.doj,
            totalWorkex: newRow.totalWorkex, engagement: newRow.engagement,
            skills: newRow.skills, allocationStatus: newAllocStatus,
          }], currentUser?.username || 'system');
        }

        message.success(isEdit ? 'Resource updated successfully' : 'Resource added successfully');
        setEditDrawer(false);
        form.resetFields();
        setEditingResource(null);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Save error';
        message.error(`Error: ${errorMsg}`);
      }
    },
    [editingResource, form, onResourcesChange]
  );

  const handleDelete = useCallback((resource: ResourceRow | null) => {
    if (!resource || !resource.key) return;

    // Permission guard — enforced at function level regardless of UI state
    if (!canDelete) {
      message.error('You do not have permission to delete resources.');
      return;
    }

    Modal.confirm({
      title: 'Delete Resource',
      content: `Are you sure you want to delete ${resource.empName || 'this resource'}?`,
      okText: 'Yes',
      cancelText: 'No',
      okButtonProps: { danger: true },
      onOk() {
        if (resource.id) resourceApi.deleteResource(resource.id);
        setResources(prev => {
          const updated = prev.filter(r => r.key !== resource.key);
          onResourcesChange?.(updated);
          return updated;
        });
        message.success('Resource deleted successfully');
        setDetailDrawer(false);
        setEditDrawer(false);
      },
    });
  }, [onResourcesChange, canDelete]);

  const getFilteredResources = useCallback((): ResourceRow[] => {
    return resources.filter((r) => {
      if (!r) return false;

      // Global search — matches any text field
      if (globalSearch) {
        const q = globalSearch.toLowerCase();
        const haystack = [r.empName, r.raId, r.emailId, r.piwRole, r.roleOrDomain, r.skills, r.engagement, r.allocationStatus, r.beelineId, r.sno]
          .map(v => String(v || '').toLowerCase()).join(' ');
        if (!haystack.includes(q)) return false;
      }

      // Filter by S.NO
      const sno = String(r.sno || '').toLowerCase();
      const filterSno = String(filters.sno || '').toLowerCase();
      if (filterSno && !sno.includes(filterSno)) {
        return false;
      }

      // Filter by RA ID
      const raId = String(r.raId || '').toLowerCase();
      const filterRaId = String(filters.raId || '').toLowerCase();
      if (filterRaId && !raId.includes(filterRaId)) {
        return false;
      }

      // Filter by Employee Name
      const empName = String(r.empName || '').toLowerCase();
      const filterEmpName = String(filters.empName || '').toLowerCase();
      if (filterEmpName && !empName.includes(filterEmpName)) {
        return false;
      }

      // Filter by Email ID
      const emailId = String(r.emailId || '').toLowerCase();
      const filterEmailId = String(filters.emailId || '').toLowerCase();
      if (filterEmailId && !emailId.includes(filterEmailId)) {
        return false;
      }

      // Filter by PIW Role
      if (filters.piwRole) {
        const piwRole = String(r.piwRole || '').toLowerCase();
        const filterPiwRole = String(filters.piwRole || '').toLowerCase();
        if (!piwRole.includes(filterPiwRole)) {
          return false;
        }
      }

      // Filter by Role/Domain
      if (filters.roleOrDomain) {
        const roleOrDomain = String(r.roleOrDomain || '').toLowerCase();
        const filterRoleOrDomain = String(filters.roleOrDomain || '').toLowerCase();
        if (!roleOrDomain.includes(filterRoleOrDomain)) {
          return false;
        }
      }

      // Filter by Allocation Status
      if (filters.allocationStatus) {
        const as = String(r.allocationStatus || '').toLowerCase();
        if (!as.includes(filters.allocationStatus.toLowerCase())) return false;
      }

      // Filter by Total Workex (range)
      const totalWorkex = parseFloat(String(r.totalWorkex || '0').replace(/[^\d.-]/g, ''));
      if (!isNaN(totalWorkex)) {
        if (totalWorkex < filters.workexRange[0] || totalWorkex > filters.workexRange[1]) {
          return false;
        }
      }

      // Filter by Skills
      const skills = String(r.skills || '').toLowerCase();
      const filterSkills = String(filters.skills || '').toLowerCase();
      if (filterSkills && !skills.includes(filterSkills)) {
        return false;
      }

      // Filter by Engagement
      if (filters.engagement) {
        const engagement = String(r.engagement || '').toLowerCase();
        const filterEngagement = String(filters.engagement || '').toLowerCase();
        if (!engagement.includes(filterEngagement)) {
          return false;
        }
      }

      // Filter by Beeline ID
      if (filters.beelineId) {
        if ((r.beelineId || '') !== filters.beelineId) return false;
      }

      return true;
    });
  }, [resources, filters, globalSearch]);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setGlobalSearch('');
  }, []);

  const handleClearAll = async () => {
    // Permission guard at function level
    if (!canDelete) {
      message.error('You do not have permission to delete resources.');
      return;
    }
    await resourceApi.clearAll();
    setResources([]);
    onResourcesChange?.([]);
    setFromServer(false);
    message.success('All resource data cleared');
  };

  const handleClearAllAudit = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/resources/all-audit', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      message.success('All resource audit history deleted');
    } catch { message.error('Failed to delete audit history'); }
  };

  const handleClearAllComments = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/resources/all-comments', { method: 'DELETE' });
      if (!res.ok) throw new Error();
      message.success('All resource comments deleted');
    } catch { message.error('Failed to delete comments'); }
  };

  const handleExportExcel = () => {
    const data = getFilteredResources();
    if (!data.length) { message.warning('No data to export'); return; }
    const headers = ['S.NO', 'RA ID', 'Employee Name', 'Email', 'PIW Role', 'Role/Domain', 'Previous Workex', 'DOJ', 'Total Workex', 'Current Engagement', 'Eng. Start Date', 'Eng. End Date', 'Allocation Status', 'Skills', 'Beeline ID', 'Linked SOW'];
    const aoa: any[][] = [headers];
    data.forEach(r => {
      aoa.push([r.sno, r.raId, r.empName, r.emailId, r.piwRole, r.roleOrDomain, r.previousWorkex, r.doj, r.totalWorkex, r.engagement || '', r.engagementStartDate || '', r.engagementEndDate || '', r.allocationStatus || '', r.skills, r.beelineId || '', r.sowName || '']);
    });
    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 6 }, { wch: 10 }, { wch: 28 }, { wch: 30 }, { wch: 18 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 36 }, { wch: 18 }, { wch: 30 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
    ws['!sheetViews'] = [{ showGridLines: false }];
    const numCols = headers.length, numRows = aoa.length;
    const hFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
    const hFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const eFill = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
    const wFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
    const tG = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
    const mN = { style: 'medium' as const, color: { rgb: '001529' } };
    for (let R = 0; R < numRows; R++) {
      for (let C = 0; C < numCols; C++) {
        const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
        ws[addr].s = {
          fill: R === 0 ? hFill : R % 2 === 0 ? eFill : wFill,
          font: R === 0 ? hFont : { sz: 10 },
          alignment: { vertical: 'center' as const, horizontal: 'left' as 'left', wrapText: false },
          border: { top: R === 0 ? mN : tG, bottom: R === numRows - 1 ? mN : tG, left: C === 0 ? mN : tG, right: C === numCols - 1 ? mN : tG },
        };
      }
    }
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Resources');
    XLSXStyle.writeFile(wb, `Resources_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Export downloaded');
  };

  const handleExportBeelineMapping = () => {
    const linked = resources.filter(r => r.beelineId);
    if (!linked.length) { message.warning('No Beeline-Resource links to export'); return; }
    const headers = ['Beeline ID', 'RA ID', 'Employee Name', 'Email', 'PIW Role', 'Role/Domain', 'Engagement', 'Allocation Status', 'Skills'];
    const aoa: any[][] = [headers];
    [...linked].sort((a, b) => (a.beelineId || '').localeCompare(b.beelineId || '')).forEach(r => {
      aoa.push([r.beelineId, r.raId, r.empName, r.emailId, r.piwRole, r.roleOrDomain, r.engagement || '', r.allocationStatus || '', r.skills]);
    });
    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 26 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 30 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
    ws['!sheetViews'] = [{ showGridLines: false }];
    const numCols = headers.length, numRows = aoa.length;
    const hFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
    const hFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const eFill = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
    const wFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
    const tG = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
    const mN = { style: 'medium' as const, color: { rgb: '001529' } };
    for (let R = 0; R < numRows; R++) {
      for (let C = 0; C < numCols; C++) {
        const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
        ws[addr].s = {
          fill: R === 0 ? hFill : R % 2 === 0 ? eFill : wFill,
          font: R === 0 ? hFont : { sz: 10 },
          alignment: { vertical: 'center' as const, horizontal: 'left' as 'left', wrapText: false },
          border: { top: R === 0 ? mN : tG, bottom: R === numRows - 1 ? mN : tG, left: C === 0 ? mN : tG, right: C === numCols - 1 ? mN : tG },
        };
      }
    }
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Beeline Resource Mapping');
    XLSXStyle.writeFile(wb, `Beeline_Resource_Mapping_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Beeline-Resource mapping downloaded');
  };

  // ── Deployment Pool template download & upload ─────────────────────────
  const downloadDeploymentPoolTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['RA ID', 'Current Engagement', 'Allocation Status'],
      ['RA001', 'Project Alpha', 'Joined'],
      ['RA002', 'Bench', ''],
    ]);
    ws['!cols'] = [{ wch: 14 }, { wch: 32 }, { wch: 20 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deployment Pool Update');
    XLSX.writeFile(wb, 'Deployment_Pool_Update_Template.xlsx');
    message.success('Deployment Pool template downloaded');
  };

  const handleDeploymentPoolUpload = (file: File): boolean => {
    const VALID_STATUSES = ['Shortlisted', 'Offered', 'Selected', 'Joined', ''];
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const headerRow: string[] = (XLSX.utils.sheet_to_json(ws, { header: 1 })[0] as string[]) || [];
        const uploadedHeaders = headerRow.map(h => String(h || '').trim());
        const required = ['RA ID', 'Current Engagement', 'Allocation Status'];
        const missing = required.filter(h => !uploadedHeaders.includes(h));
        if (missing.length > 0) {
          Modal.error({
            title: 'Invalid Template',
            content: <div><p>Missing required columns:</p><ul style={{ margin: 0, paddingLeft: 18 }}>{missing.map(h => <li key={h} style={{ color: '#f5222d' }}>{h}</li>)}</ul></div>,
          });
          return;
        }
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (!rows.length) { message.warning('No data found in file'); return; }
        const resourceMap = new Map(resources.map(r => [r.raId.toLowerCase(), r]));
        const updatedResources = [...resources];
        let updatedCount = 0;
        const notFoundRAIDs: string[] = [];
        rows.forEach(row => {
          const raId = String(row['RA ID'] || '').trim();
          const engagement = String(row['Current Engagement'] || '').trim();
          const allocStatus = String(row['Allocation Status'] || '').trim();
          if (!raId) return;
          const existing = resourceMap.get(raId.toLowerCase());
          if (!existing) { notFoundRAIDs.push(raId); return; }
          const idx = updatedResources.findIndex(r => r.raId.toLowerCase() === raId.toLowerCase());
          if (idx >= 0) {
            updatedResources[idx] = { ...updatedResources[idx], ...(engagement ? { engagement } : {}), ...(allocStatus ? { allocationStatus: allocStatus } : {}) };
            updatedCount++;
          }
        });
        if (notFoundRAIDs.length > 0) {
          Modal.warning({ title: `${updatedCount} updated, ${notFoundRAIDs.length} RA IDs not found`, content: <div>{notFoundRAIDs.map(id => <Tag key={id} color="red">{id}</Tag>)}</div> });
        }
        if (updatedCount === 0) { message.warning('No matching RA IDs found'); return; }
        await resourceApi.bulkSave(updatedResources.map(r => ({
          raId: r.raId, sno: Number(r.sno), empName: r.empName, emailId: r.emailId,
          piwRole: r.piwRole, roleOrDomain: r.roleOrDomain, previousWorkex: r.previousWorkex,
          doj: r.doj, totalWorkex: r.totalWorkex, engagement: r.engagement || '',
          skills: r.skills, allocationStatus: r.allocationStatus || '',
        })), currentUser?.username || 'system').catch(() => {});
        setResources(updatedResources);
        onResourcesChange?.(updatedResources);
        if (notFoundRAIDs.length === 0) message.success(`Updated ${updatedCount} resource(s)`);
      } catch { message.error('Failed to parse file'); }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const getUniqueValues = useCallback(
    (key: keyof ResourceRow): string[] => {
      const values = new Set<string>();
      resources.forEach((r) => {
        if (r && r[key]) {
          const val = String(r[key]);
          if (val && val.trim()) {
            values.add(val);
          }
        }
      });
      return Array.from(values).sort();
    },
    [resources]
  );

  const columns: ColumnsType<ResourceRow> = useMemo(
    () => [
      {
        title: 'S.NO',
        key: 'sno',
        width: 60,
        fixed: 'left' as const,
        render: (_: unknown, __: ResourceRow, index: number) => (
          <Tag color="blue" style={{ fontSize: '12px', fontWeight: 600 }}>
            {index + 1}
          </Tag>
        ),
      },
      {
        title: 'RA ID',
        dataIndex: 'raId',
        key: 'raId',
        width: 100,
        fixed: 'left' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.raId || '').localeCompare(b.raId || ''),
        render: (value) => (
          <div style={{ fontWeight: 600, color: '#001529' }}>
            {String(value || '')}
          </div>
        ),
      },
      {
        title: 'Emp Name',
        dataIndex: 'empName',
        key: 'empName',
        width: 150,
        fixed: 'left' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.empName || '').localeCompare(b.empName || ''),
        render: (value) => (
          <div style={{ fontWeight: 600, color: '#001529' }}>
            {String(value || '')}
          </div>
        ),
      },
      {
        title: 'Email Id',
        dataIndex: 'emailId',
        key: 'emailId',
        width: 200,
        ellipsis: true,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.emailId || '').localeCompare(b.emailId || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'PIW Role',
        dataIndex: 'piwRole',
        key: 'piwRole',
        width: 120,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.piwRole || '').localeCompare(b.piwRole || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Role/Domain',
        dataIndex: 'roleOrDomain',
        key: 'roleOrDomain',
        width: 150,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.roleOrDomain || '').localeCompare(b.roleOrDomain || ''),
        render: (value) => <Tag color="cyan">{String(value || '')}</Tag>,
      },
      {
        title: 'Previous Workex',
        dataIndex: 'previousWorkex',
        key: 'previousWorkex',
        width: 130,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.previousWorkex || '').localeCompare(b.previousWorkex || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'DOJ',
        dataIndex: 'doj',
        key: 'doj',
        width: 120,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.doj || '').localeCompare(b.doj || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Total Workex',
        dataIndex: 'totalWorkex',
        key: 'totalWorkex',
        width: 120,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.totalWorkex || '').localeCompare(b.totalWorkex || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Current Engagement',
        dataIndex: 'engagement',
        key: 'engagement',
        width: 120,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.engagement || '').localeCompare(b.engagement || ''),
        render: (value) => <span>{String(value || '')}</span>,
      },
      {
        title: 'Allocation Status',
        dataIndex: 'allocationStatus',
        key: 'allocationStatus',
        width: 130,
        align: 'center' as const,
        sorter: (a: ResourceRow, b: ResourceRow) => (a.allocationStatus || '').localeCompare(b.allocationStatus || ''),
        render: (value) => {
          const v = String(value || '');
          if (!v) return <span style={{ color: '#bbb', fontSize: '11px' }}>—</span>;
          const colorMap: Record<string, string> = { Available: '#faad14', Shortlisted: '#13c2c2', Offered: '#722ed1', Selected: '#1890ff', Joined: '#389e0d' };
          return <Tag color={colorMap[v] || 'default'} style={{ fontSize: '10px', margin: 0 }}>{v}</Tag>;
        },
      },
      {
        title: 'Skills',
        dataIndex: 'skills',
        key: 'skills',
        width: 120,
        render: (value) => {
          const skillsArr = String(value || '').split(',').filter(s => s.trim());
          return (
            <Tooltip title={String(value || '')} placement="topLeft">
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                {skillsArr.slice(0, 2).map((s, i) => <Tag key={i} color="blue" style={{ fontSize: '10px', margin: 0 }}>{s.trim()}</Tag>)}
                {skillsArr.length > 2 && <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{skillsArr.length - 2}</Tag>}
              </span>
            </Tooltip>
          );
        },
      },
      {
        title: 'Action',
        key: 'action',
        width: 100,
        fixed: 'right' as const,
        render: (_, record) => {
          if (!record) return null;
          return (
            <Space size="small">
              {canEdit && (
              <Button
                type="text"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
                style={{ color: '#1890FF' }}
                title="Edit"
              />
              )}
              {canDelete && (
              <Button
                type="text"
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record)}
                style={{ color: '#ff4d4f' }}
                title="Delete"
              />
              )}
            </Space>
          );
        },
      },
    ],
    [handleEdit, handleDelete]
  );

  const displayColumns = useMemo(
    () => columns.filter((col) => !col.key || visibleColumns.has(col.key as string)),
    [columns, visibleColumns]
  );

  const filteredResources = getFilteredResources();
  const filteredCount = filteredResources.length;

  // ── Insights computations ──────────────────────────────────────
  const [activeTab, setActiveTab] = useState<string>('resources');

  const handleInsightClick = (type: 'piwRole' | 'roleOrDomain' | 'engagement' | 'skills' | 'expBucket', name: string) => {
    if (type === 'expBucket') {
      const EXP_BUCKETS = [
        { label: '0–3 Yrs', min: 0, max: 3 },
        { label: '3–5 Yrs', min: 3, max: 5 },
        { label: '5–8 Yrs', min: 5, max: 8 },
        { label: '8–10 Yrs', min: 8, max: 10 },
        { label: '10+ Yrs', min: 10, max: Infinity },
      ];
      const bucket = EXP_BUCKETS.find(b => b.label === name);
      if (bucket) setFilters(prev => ({ ...prev, workexRange: [bucket.min, bucket.max === Infinity ? 70 : bucket.max] }));
    } else {
      setFilters(prev => ({ ...prev, [type]: name }));
    }
    setActiveTab('resources');
  };


  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '0' }}>
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              size="small"
              style={{ padding: '0 16px' }}
              tabBarStyle={{ marginBottom: 0, fontSize: '12px' }}
              items={[
                {
                  key: 'resources',
                  label: (
                    <span style={{ fontSize: '12px' }}>
                      Resources
                      {resources.length > 0 && <Tag color="blue" style={{ marginLeft: 6, fontSize: '10px', lineHeight: '16px', padding: '0 5px' }}>{resources.length}</Tag>}
                    </span>
                  ),
                  children: (
                    <div style={{ padding: '16px 0 16px 0' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '16px' }}>
                        <Space>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Showing: <strong>{filteredCount}</strong>{filteredCount !== resources.length ? ` / ${resources.length}` : ''}
                          </Text>
                          {fromServer && (
                            <Tooltip title="Data loaded from database">
                              <CloudServerOutlined style={{ color: '#52c41a', fontSize: 14 }} />
                            </Tooltip>
                          )}
                        </Space>
                        <Input.Search
                          placeholder="Search name, RA ID, role, skills, Beeline ID…"
                          allowClear
                          size="small"
                          value={globalSearch}
                          onChange={e => setGlobalSearch(e.target.value)}
                          onSearch={v => setGlobalSearch(v)}
                          style={{ width: 300, borderRadius: 6 }}
                          styles={{ input: { fontSize: 12 } }}
                        />
              <Space wrap size={8}>
                {isFilterApplied && (
                  <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={handleClearFilters}>✕ Clear Filters</Button>
                )}
                <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: '6px' }} />
                </Tooltip>
                <Tooltip title="Card View" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('card')} style={{ borderRadius: '6px' }} />
                </Tooltip>
                <Tooltip title="Table View" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<TableOutlined />} type={viewMode === 'table' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('table')} style={{ borderRadius: '6px' }} />
                </Tooltip>
                {viewMode === 'table' && (
                  <Tooltip title="Column Settings" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button icon={<ColumnHeightOutlined />} size="small" onClick={() => setColumnDrawer(true)} style={{ borderRadius: '6px' }} />
                  </Tooltip>
                )}
                <Tooltip title="Export Formatted Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<FileExcelOutlined />} size="small" onClick={handleExportExcel} disabled={!resources.length} style={{ borderRadius: '6px', color: resources.length ? '#52c41a' : undefined }} />
                </Tooltip>
                <Dropdown trigger={['click']} menu={{ items: [
                  ...(canEdit ? [{ key: 'add', label: <span style={{ fontSize: '11px' }}>Add New Resource</span>, icon: <PlusOutlined style={{ fontSize: '11px' }} />, onClick: handleAddNew }] : []),
                  { type: 'divider' as const },
                  { key: 'dlTemplate', label: <span style={{ fontSize: '11px' }}>Download Resource Template</span>, icon: <DownloadOutlined style={{ fontSize: '11px' }} />, onClick: downloadTemplate },
                  ...(canEdit ? [{ key: 'ulResource', label: <span style={{ fontSize: '11px' }}>Upload Resource Information</span>, icon: <UploadOutlined style={{ fontSize: '11px' }} />, onClick: () => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls'; inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleUpload(f); }; inp.click(); } }] : []),
                  { type: 'divider' as const },
                  { key: 'dlPool', label: <span style={{ fontSize: '11px' }}>Download Deployment Pool Template</span>, icon: <DownloadOutlined style={{ fontSize: '11px' }} />, onClick: downloadDeploymentPoolTemplate },
                  ...(canEdit ? [{ key: 'ulPool', label: <span style={{ fontSize: '11px' }}>Upload Deployment Pool Tracker</span>, icon: <UploadOutlined style={{ fontSize: '11px' }} />, onClick: () => { const inp = document.createElement('input'); inp.type='file'; inp.accept='.xlsx,.xls'; inp.onchange = (ev) => { const f = (ev.target as HTMLInputElement).files?.[0]; if (f) handleDeploymentPoolUpload(f); }; inp.click(); } }] : []),
                  { key: 'dlBeelineMapping', label: <span style={{ fontSize: '11px' }}>Download Beeline-Resource Mapping</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: handleExportBeelineMapping },
                  ...(canEdit && canDelete && resources.length > 0 ? [{ type: 'divider' as const }] : []),
                  ...(canDelete && resources.length > 0 ? [{
                    key: 'deleteAll',
                    label: <span style={{ fontSize: '11px' }}>Delete All Resources</span>,
                    icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                    danger: true,
                    onClick: () => {
                      Modal.confirm({
                        title: 'Delete all resource data?',
                        content: 'This will permanently remove all resources from the database.',
                        okText: 'Yes, delete all',
                        cancelText: 'Cancel',
                        okButtonProps: { danger: true, size: 'small' },
                        onOk: handleClearAll,
                      });
                    },
                  }] : []),
                  ...(canDelete ? [{ type: 'divider' as const }] : []),
                  ...(canDelete ? [{
                    key: 'deleteAllAudit',
                    label: <span style={{ fontSize: '11px' }}>Delete All Audit History</span>,
                    icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                    danger: true,
                    onClick: () => Modal.confirm({
                      title: 'Delete all resource audit history?',
                      content: 'This will permanently remove all audit log entries for resources.',
                      okText: 'Yes, delete all', cancelText: 'Cancel',
                      okButtonProps: { danger: true, size: 'small' },
                      onOk: handleClearAllAudit,
                    }),
                  }, {
                    key: 'deleteAllComments',
                    label: <span style={{ fontSize: '11px' }}>Delete All Comments</span>,
                    icon: <DeleteOutlined style={{ fontSize: '11px' }} />,
                    danger: true,
                    onClick: () => Modal.confirm({
                      title: 'Delete all resource comments?',
                      content: 'This will permanently remove all comments across all resource records.',
                      okText: 'Yes, delete all', cancelText: 'Cancel',
                      okButtonProps: { danger: true, size: 'small' },
                      onOk: handleClearAllComments,
                    }),
                  }] : []),
                ]}}>
                  <Button icon={<MoreOutlined />} size="small" style={{ borderRadius: '6px' }} />
                </Dropdown>
              </Space>
            </div>

            {resources.length === 0 ? (
              <div style={{ background: '#f5f5f5', borderRadius: '8px', padding: 60, textAlign: 'center' }}>
                {loading
                  ? <Spin tip="Loading from database..." />
                  : <Text type="secondary">No resources yet. Upload a file or add a new employee to get started.</Text>
                }
              </div>
            ) : viewMode === 'table' ? (
              <div style={{ display: 'flex', gap: '12px' }}>
                {showFilterPanel && (
                  <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <Text strong style={{ fontSize: '12px' }}>Filters</Text>
                      <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={handleClearFilters}>Clear all</Button>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Employee Name</div>
                        <Input size="small" placeholder="Search..." value={filters.empName} onChange={e => setFilters({ ...filters, empName: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                        <Input size="small" placeholder="Search..." value={filters.raId} onChange={e => setFilters({ ...filters, raId: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>PIW Role</div>
                        <Input size="small" placeholder="Search..." value={filters.piwRole} onChange={e => setFilters({ ...filters, piwRole: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Role/Domain</div>
                        <Input size="small" placeholder="Search..." value={filters.roleOrDomain} onChange={e => setFilters({ ...filters, roleOrDomain: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                        <Input size="small" placeholder="Search..." value={filters.skills} onChange={e => setFilters({ ...filters, skills: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Engagement</div>
                        <Select size="small" placeholder="All" allowClear value={filters.engagement || undefined} onChange={(v) => setFilters({ ...filters, engagement: v || '' })} style={{ width: '100%', fontSize: '11px' }} options={engagementOptions} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Allocation Status</div>
                        <Select size="small" placeholder="All" allowClear value={filters.allocationStatus || undefined} onChange={(v) => setFilters({ ...filters, allocationStatus: v || '' })} style={{ width: '100%', fontSize: '11px' }} options={allocationStatusOptions} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline ID</div>
                        <Select
                          size="small"
                          placeholder="All"
                          allowClear
                          showSearch
                          value={filters.beelineId || undefined}
                          onChange={(v) => setFilters({ ...filters, beelineId: v || '' })}
                          style={{ width: '100%', fontSize: '11px' }}
                          options={Array.from(new Set(resources.map(r => r.beelineId).filter(Boolean))).map(id => ({ value: id, label: id }))}
                          notFoundContent={<span style={{ fontSize: '11px' }}>No Beeline IDs linked</span>}
                        />
                      </div>
                    </Space>
                  </div>
                )}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div className="compact-table">
                    <Table<ResourceRow>
                      dataSource={filteredResources}
                      columns={displayColumns}
                      pagination={{ pageSize: 15, showSizeChanger: false }}
                      scroll={{ x: 'max-content', y: 420 }}
                      size="small"
                      style={{ background: '#fff', borderRadius: '8px' }}
                      locale={{ emptyText: 'No resources match your filters' }}
                      onRow={(record) => ({
                        onClick: (e) => {
                          const target = e.target as HTMLElement;
                          if (target.closest('button, .ant-tag, .ant-checkbox-wrapper')) return;
                          setSelectedResource(record);
                          setDetailDrawer(true);
                        },
                        style: { cursor: 'pointer' },
                      })}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: '12px' }}>
                {showFilterPanel && (
                  <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <Text strong style={{ fontSize: '12px' }}>Filters</Text>
                      <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={handleClearFilters}>Clear all</Button>
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size={8}>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Employee Name</div>
                        <Input size="small" placeholder="Search..." value={filters.empName} onChange={e => setFilters({ ...filters, empName: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                        <Input size="small" placeholder="Search..." value={filters.raId} onChange={e => setFilters({ ...filters, raId: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>PIW Role</div>
                        <Input size="small" placeholder="Search..." value={filters.piwRole} onChange={e => setFilters({ ...filters, piwRole: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Role/Domain</div>
                        <Input size="small" placeholder="Search..." value={filters.roleOrDomain} onChange={e => setFilters({ ...filters, roleOrDomain: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                        <Input size="small" placeholder="Search..." value={filters.skills} onChange={e => setFilters({ ...filters, skills: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Engagement</div>
                        <Select size="small" placeholder="All" allowClear value={filters.engagement || undefined} onChange={(v) => setFilters({ ...filters, engagement: v || '' })} style={{ width: '100%', fontSize: '11px' }} options={engagementOptions} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Allocation Status</div>
                        <Select size="small" placeholder="All" allowClear value={filters.allocationStatus || undefined} onChange={(v) => setFilters({ ...filters, allocationStatus: v || '' })} style={{ width: '100%', fontSize: '11px' }} options={allocationStatusOptions} />
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Beeline ID</div>
                        <Select
                          size="small"
                          placeholder="All"
                          allowClear
                          showSearch
                          value={filters.beelineId || undefined}
                          onChange={(v) => setFilters({ ...filters, beelineId: v || '' })}
                          style={{ width: '100%', fontSize: '11px' }}
                          options={Array.from(new Set(resources.map(r => r.beelineId).filter(Boolean))).map(id => ({ value: id, label: id }))}
                          notFoundContent={<span style={{ fontSize: '11px' }}>No Beeline IDs linked</span>}
                        />
                      </div>
                    </Space>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                    {filteredResources.map((resource) => {
                      if (!resource) return null;
                      const isBench = resource.engagement === 'Bench';
                      const statusColorMap: Record<string, string> = { Available: '#faad14', Shortlisted: '#13c2c2', Offered: '#722ed1', Selected: '#1890ff', Joined: '#389e0d', 'On Bench': '#fa8c16', Released: '#ff4d4f', Resigned: '#ff4d4f' };
                      const statusColor = resource.allocationStatus ? (statusColorMap[resource.allocationStatus] || '#8c8c8c') : '#8c8c8c';
                      return (
                        <div key={resource.key || 'unknown'} style={{
                          background: '#fff',
                          borderRadius: '8px',
                          padding: '10px 10px 8px',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          border: '1px solid #f0f0f0',
                          borderLeft: isBench ? '3px solid #faad14' : '3px solid #e8eaf0',
                          cursor: 'pointer',
                        }}
                          onClick={(e) => {
                            // Don't open if click was on the ellipsis dropdown
                            const target = e.target as HTMLElement;
                            if (target.closest('.ant-dropdown-trigger') || target.closest('.ant-dropdown')) return;
                            setSelectedResource(resource); setDetailDrawer(true);
                          }}
                        >
                          {/* Row 1: Name + RA ID inline + ellipsis */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, marginBottom: 6 }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                                <Text strong style={{ fontSize: '12px', lineHeight: '16px' }}>{String(resource.empName || 'N/A')}</Text>
                                <Text type="secondary" style={{ fontSize: '10px', whiteSpace: 'nowrap' }}>{String(resource.raId || '')}</Text>
                              </div>
                            </div>
                            <Dropdown menu={{ items: [
                              { key: 'view', label: <span style={{ fontSize: '11px' }}>View</span>, icon: <EyeOutlined style={{ fontSize: '11px' }} />, onClick: () => { setSelectedResource(resource); setDetailDrawer(true); } },
                              ...(canEdit ? [{ key: 'edit', label: <span style={{ fontSize: '11px' }}>Edit</span>, icon: <EditOutlined style={{ fontSize: '11px' }} />, onClick: () => handleEdit(resource) }] : []),
                              { key: 'beelineLink', label: <span style={{ fontSize: '11px' }}>Link to Beeline Request</span>, icon: <LinkOutlined style={{ fontSize: '11px' }} />, onClick: () => openBeelineLinkModal(resource) },
                              ...(canDelete ? [{ type: 'divider' as const }, { key: 'delete', label: <span style={{ fontSize: '11px' }}>Delete</span>, icon: <DeleteOutlined style={{ fontSize: '11px' }} />, danger: true, onClick: () => handleDelete(resource) }] : []),
                            ]}} trigger={['click']}>
                              <Button type="text" size="small" icon={<MoreOutlined />} style={{ padding: 0, height: 18, minWidth: 18, flexShrink: 0 }} />
                            </Dropdown>
                          </div>
                          {/* Row 2: Role tag + allocation status tag */}
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', marginBottom: 5 }}>
                            {resource.roleOrDomain && (
                              <Tag color="cyan" style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px' }}>
                                {String(resource.roleOrDomain)}
                              </Tag>
                            )}
                            {resource.allocationStatus && (
                              <Tag style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px', background: `${statusColor}15`, color: statusColor, border: `1px solid ${statusColor}40` }}>
                                {resource.allocationStatus}
                              </Tag>
                            )}
                          </div>
                          {/* Row 3: Experience + Engagement */}
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {resource.totalWorkex && (
                              <Text type="secondary" style={{ fontSize: '10px' }}>
                                {String(resource.totalWorkex)} exp
                              </Text>
                            )}
                            {resource.engagement && resource.engagement !== 'undefined' && (
                              <Text type="secondary" style={{ fontSize: '10px', borderLeft: resource.totalWorkex ? '1px solid #d9d9d9' : 'none', paddingLeft: resource.totalWorkex ? 8 : 0 }}>
                                {String(resource.engagement)}
                              </Text>
                            )}
                          </div>
                          {/* Row 4: Beeline badge */}
                          {resource.beelineId && (
                            <div style={{ marginTop: 4 }}>
                              <Tag icon={<LinkOutlined />} color="blue" style={{ fontSize: '10px', margin: 0, lineHeight: '16px', padding: '0 5px', cursor: 'pointer' }}
                                onClick={(e) => { e.stopPropagation(); onNavigateToRequest?.(resource.beelineId!); }}>
                                {resource.beelineId}
                              </Tag>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredResources.length === 0 && (
                      <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40 }}>
                        <Text type="secondary">No resources match your filters</Text>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
                    </div>
                  ),
                },
                {
                  key: 'resumes',
                  label: <span style={{ fontSize: '12px' }}><FileTextOutlined /> Resumes</span>,
                  children: <ResumesTab />,
                },

              ]}
            />
          </div>
        </Space>
      </div>

      <Drawer
        title={editingResource ? `Edit - ${editingResource.empName || 'Resource'}` : 'Add New Employee'}
        placement="right"
        onClose={() => {
          setEditDrawer(false);
          form.resetFields();
          setEditingResource(null);
        }}
        open={editDrawer}
        width={500}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSaveEdit}
          autoComplete="off"
        >
          {editingResource && (
            <Form.Item label="S.NO" name="sno">
              <Input disabled />
            </Form.Item>
          )}

          <Form.Item
            label="RA ID"
            name="raId"
            rules={[{ required: true, message: 'RA ID is required' }]}
          >
            <Input placeholder="e.g., RA001" disabled={!!editingResource} style={editingResource ? { color: '#595959', background: '#f5f5f5' } : {}} />
          </Form.Item>

          <Form.Item
            label="Employee Name"
            name="empName"
            rules={[{ required: true, message: 'Employee name is required' }]}
          >
            <Input placeholder="Full name" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="emailId"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Invalid email format' },
            ]}
          >
            <Input placeholder="email@example.com" type="email" />
          </Form.Item>

          <Form.Item
            label="PIW Role"
            name="piwRole"
            rules={[{ required: true, message: 'PIW Role is required' }]}
          >
            <Input placeholder="e.g., Developer, Manager" />
          </Form.Item>

          <Form.Item
            label="Role/Domain"
            name="roleOrDomain"
            rules={[{ required: true, message: 'Role/Domain is required' }]}
          >
            <Input placeholder="e.g., Full Stack, Backend" />
          </Form.Item>

          <Form.Item
            label="Previous Experience"
            name="previousWorkex"
            rules={[{ required: true, message: 'Previous experience is required' }]}
          >
            <Input placeholder="e.g., 2 years" />
          </Form.Item>

          <Form.Item
            label="Date of Joining"
            name="doj"
            rules={[{ required: true, message: 'DOJ is required' }]}
          >
            <Input placeholder="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            label="Total Experience"
            name="totalWorkex"
            rules={[{ required: true, message: 'Total experience is required' }]}
          >
            <Input placeholder="e.g., 5 years" />
          </Form.Item>

          <Form.Item
            label="Current Engagement"
            name="engagement"
          >
            <Select
              showSearch
              placeholder="Select engagement or project"
              disabled={!!editingResource}
              options={engagementOptions}
              filterOption={(input, option) => String(option?.label || '').toLowerCase().includes(input.toLowerCase())}
              allowClear
            />
          </Form.Item>

          <Form.Item label="Engagement Start Date" name="engagementStartDate">
            <Input
              type="date"
              placeholder="YYYY-MM-DD"
              style={{ fontSize: '12px' }}
              disabled={editingResource?.allocationStatus?.toLowerCase() === 'available'}
            />
          </Form.Item>

          <Form.Item
            label="Engagement End Date"
            name="engagementEndDate"
            dependencies={['engagementStartDate']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const start = getFieldValue('engagementStartDate');
                  if (!value || !start || value >= start) return Promise.resolve();
                  return Promise.reject(new Error('End date must be after start date'));
                },
              }),
            ]}
          >
            <Input
              type="date"
              placeholder="YYYY-MM-DD"
              style={{ fontSize: '12px' }}
              disabled={editingResource?.allocationStatus?.toLowerCase() === 'available'}
            />
          </Form.Item>

          <Form.Item
            label="Skills (comma-separated)"
            name="skills"
            rules={[{ required: true, message: 'Skills are required' }]}
          >
            <Input.TextArea rows={4} placeholder="e.g., Java, Spring Boot, React" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block>
              {editingResource ? 'Update' : 'Add'}
            </Button>
          </Form.Item>
        </Form>
      </Drawer>

      <Drawer
        title={null}
        placement="right"
        onClose={() => { setDetailDrawer(false); setDetailExpanded(false); }}
        open={detailDrawer && !!selectedResource}
        width={detailExpanded ? 1100 : 680}
        extra={
          selectedResource && (
            <Space>
              <Tooltip title={detailExpanded ? 'Collapse' : 'Expand'}>
                <Button
                  type="text"
                  icon={detailExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
                  onClick={() => setDetailExpanded(v => !v)}
                />
              </Tooltip>
              {canEdit && (
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => {
                  handleEdit(selectedResource);
                  setDetailDrawer(false);
                }}
                title="Edit"
              />
              )}
              {canDelete && (
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(selectedResource)}
                title="Delete"
              />
              )}
            </Space>
          )
        }
      >
        {selectedResource && (
          <ResourceDetailPanel
            resource={selectedResource}
            currentUser={currentUser?.username}
            expanded={detailExpanded}
            onToggleExpand={() => setDetailExpanded(v => !v)}
            onNavigateToRequest={(beelineId) => { onNavigateToRequest?.(beelineId); setDetailDrawer(false); }}
            onNavigateToInsights={onNavigateToInsights ? () => { setDetailDrawer(false); onNavigateToInsights(); } : undefined}
            onNavigateToProcess={onNavigateToProcess ? (sow) => { setDetailDrawer(false); onNavigateToProcess(sow); } : undefined}
          />
        )}
      </Drawer>

      <Drawer
        title="Column Visibility"
        placement="right"
        onClose={() => setColumnDrawer(false)}
        open={columnDrawer}
        width={300}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {Object.entries(COLUMN_LABELS)
            .filter(([key]) => key !== 'action')
            .map(([key, label]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Checkbox
                  checked={visibleColumns.has(key)}
                  onChange={(e) => {
                    const newVisible = new Set(visibleColumns);
                    if (e.target.checked) {
                      newVisible.add(key);
                    } else {
                      newVisible.delete(key);
                    }
                    setVisibleColumns(newVisible);
                  }}
                />
                <label style={{ marginBottom: 0, cursor: 'pointer' }}>
                  {label}
                </label>
              </div>
            ))}
        </Space>
      </Drawer>

      {/* ── Beeline Link Modal ────────────────────────────────────── */}
      <Modal
        title={
          <span style={{ fontSize: '13px' }}>
            <LinkOutlined style={{ marginRight: 6, color: '#1890ff' }} />
            Link Resource to Beeline Request
          </span>
        }
        open={beelineLinkModal.open}
        onCancel={() => setBeelineLinkModal({ open: false, resource: null })}
        onOk={handleSaveBeelineLink}
        okText="Save"
        confirmLoading={savingBeeline}
        width={420}
        destroyOnClose
      >
        {beelineLinkModal.resource && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div style={{ background: '#fafafa', borderRadius: 6, padding: '8px 12px', border: '1px solid #f0f0f0' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{beelineLinkModal.resource.empName}</div>
              <div style={{ fontSize: '11px', color: '#8c8c8c' }}>{beelineLinkModal.resource.raId}</div>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: '#595959', marginBottom: 6 }}>Select Beeline ID to link (clear to unlink)</div>
              <Select
                showSearch
                allowClear
                size="small"
                placeholder="Select Beeline ID"
                style={{ width: '100%' }}
                value={selectedBeelineId || undefined}
                onChange={(v) => setSelectedBeelineId(v || '')}
                options={beelineRequestOptions}
                filterOption={(input, option) => (option?.value as string || '').toLowerCase().includes(input.toLowerCase())}
                notFoundContent={<span style={{ fontSize: '11px', color: '#8c8c8c' }}>No requests found</span>}
              />
            </div>
            {beelineLinkModal.resource.beelineId && (
              <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                Currently linked: <Tag color="blue" style={{ fontSize: '10px' }}>{beelineLinkModal.resource.beelineId}</Tag>
              </div>
            )}
          </Space>
        )}
      </Modal>

    </div>
  );
};

export default ResourceMgmt;
