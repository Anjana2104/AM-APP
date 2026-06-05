import { useState, useMemo, useEffect, useRef } from 'react';
import { Button, Space, Card, Row, Col, Tag, Upload, Tooltip, message, Typography, Drawer, Input, Select, Collapse, Empty, Slider, Table, Tabs, Statistic, Progress, Checkbox } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined, DownloadOutlined, FilterOutlined, EyeOutlined, AppstoreOutlined, UnorderedListOutlined, BarChartOutlined, TeamOutlined, ProjectOutlined, FileExcelOutlined } from '@ant-design/icons';
import { DndContext, DragOverlay, useDroppable, useDraggable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import * as XLSX from 'xlsx';
import * as XLSXStyle from 'xlsx-js-style';
import html2canvas from 'html2canvas';
import * as configApi from '../api/configApi';
import type { ResourceRow } from './ResourceMgmt';
import * as resourceApi from '../api/resourceApi';

const { Text } = Typography;

interface ResourceUtilizationProps {
  resources: ResourceRow[];
  onUpdateResources: (updated: ResourceRow[]) => void;
  onNavigate?: (page: string, roleFilter?: string) => void;
}

interface UnifiedFilterState {
  resourceName: string;
  raid: string;
  skills: string;
  engagement: string;
  roleOrDomain: string;
  workexRange: [number, number];
}

const DEFAULT_UNIFIED_FILTERS: UnifiedFilterState = {
  resourceName: '',
  raid: '',
  skills: '',
  engagement: '',
  roleOrDomain: '',
  workexRange: [0, 100],
};

// â”€â”€â”€ Kanban Tile (draggable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface KanbanTileProps {
  resource: ResourceRow;
  isSelected: boolean;
  onToggleSelect: (sno: string) => void;
  onViewDetails: (resource: ResourceRow) => void;
  columnColor: string;
}
function KanbanTile({ resource, isSelected, onToggleSelect, onViewDetails, columnColor }: KanbanTileProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: resource.sno, data: { resource } });
  const skillsArr = resource.skills ? resource.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
  return (
    <div
      ref={setNodeRef} {...listeners} {...attributes}
      onClick={(e) => { e.stopPropagation(); if ((e.target as HTMLElement).closest('button')) return; onToggleSelect(resource.sno); }}
      style={{
        background: isSelected ? '#e6f4ff' : '#fff',
        border: `1px solid ${isSelected ? '#1890ff' : '#ebebeb'}`,
        borderLeft: `3px solid ${isSelected ? '#1890ff' : columnColor}`,
        borderRadius: 6, padding: '5px 8px', cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.35 : 1, marginBottom: 5,
        boxShadow: isSelected ? '0 0 0 2px #91caff40' : '0 1px 2px rgba(0,0,0,0.05)',
        transition: 'opacity 0.15s, box-shadow 0.15s', userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 1 }}>
        <Typography.Text strong style={{ fontSize: '11px', lineHeight: '15px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, marginRight: 3 }}>
          {resource.empName}
        </Typography.Text>
        <button onClick={(e) => { e.stopPropagation(); onViewDetails(resource); }}
          style={{ background: 'none', border: 'none', padding: '0 2px', cursor: 'pointer', color: '#8c8c8c', fontSize: 10, lineHeight: 1, flexShrink: 0 }} title="View details">
          <EyeOutlined />
        </button>
      </div>
      <div style={{ fontSize: '9px', color: '#8c8c8c', lineHeight: 1.5 }}>
        {resource.raId}{(resource.roleOrDomain || resource.piwRole) ? `  |  ${resource.roleOrDomain || resource.piwRole}` : ''}{resource.totalWorkex ? `  |  ${resource.totalWorkex}y` : ''}
      </div>
      {resource.engagement && resource.engagement !== 'Bench' && (
        <div style={{ fontSize: '9px', color: '#1890ff', fontStyle: 'italic', lineHeight: 1.4 }}>{resource.engagement}</div>
      )}
      {skillsArr.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
          {skillsArr.slice(0, 2).map((s: string, i: number) => (
            <span key={i} style={{ fontSize: '8px', padding: '0 4px', lineHeight: '14px', borderRadius: 3, background: '#e6f0ff', color: '#1890ff', border: '1px solid #bcd4ff' }}>{s}</span>
          ))}
          {skillsArr.length > 2 && (
            <span style={{ fontSize: '8px', padding: '0 4px', lineHeight: '14px', borderRadius: 3, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{skillsArr.length - 2}</span>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Kanban Column (droppable) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
interface KanbanColumnCompProps {
  id: string; title: string; color: string; bgColor: string;
  resources: ResourceRow[]; selectedSNOs: Set<string>;
  onToggleSelect: (sno: string) => void;
  onViewDetails: (resource: ResourceRow) => void;
  headerAction?: React.ReactNode;
}
function KanbanColumnComp({ id, title, color, bgColor, resources, selectedSNOs, onToggleSelect, onViewDetails, headerAction }: KanbanColumnCompProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div style={{
      flex: 1, minWidth: 0, background: isOver ? bgColor : '#f8f9fa',
      border: `2px ${isOver ? 'solid' : 'dashed'} ${isOver ? color : '#e0e0e0'}`,
      borderRadius: 10, display: 'flex', flexDirection: 'column', transition: 'all 0.2s ease', overflow: 'hidden',
    }}>
      <div style={{ padding: '8px 10px', borderBottom: `1px solid ${color}30`, background: `${color}18`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>{title}</span>
          <span style={{ marginLeft: 'auto', fontSize: '11px', fontWeight: 600, color, background: `${color}25`, padding: '0 7px', borderRadius: 10, border: `1px solid ${color}40` }}>{resources.length}</span>
          {headerAction && <span style={{ marginLeft: 4 }}>{headerAction}</span>}
        </div>
      </div>
      <div ref={setNodeRef} style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', minHeight: 60, scrollbarWidth: 'thin', scrollbarColor: '#e0e0e0 transparent' }}>
        {resources.length === 0
          ? <div style={{ textAlign: 'center', paddingTop: 24, color: '#ccc', fontSize: '11px', pointerEvents: 'none' }}>{isOver ? 'Drop here' : 'No resources'}</div>
          : resources.map(r => <KanbanTile key={r.sno} resource={r} isSelected={selectedSNOs.has(r.sno)} onToggleSelect={onToggleSelect} onViewDetails={onViewDetails} columnColor={color} />)
        }
      </div>
    </div>
  );
}

export function EngagementMapping({ resources = [], onUpdateResources, onNavigate }: ResourceUtilizationProps) {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('card');
  const [allocationDrawer, setAllocationDrawer] = useState(false);
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailResource, setSelectedDetailResource] = useState<ResourceRow | null>(null);
  const [cachedResources, setCachedResources] = useState<ResourceRow[]>(resources || []);
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedFilterState>(DEFAULT_UNIFIED_FILTERS);
  const [mainTab, setMainTab] = useState<string>('bench');
  const [exportingInsights, setExportingInsights] = useState(false);
  const [allocStages, setAllocStages] = useState<Array<{ value: string; label: string; color: string }>>([
    { value: 'Shortlisted', label: 'Shortlisted', color: 'cyan' },
    { value: 'Offered',     label: 'Offered',     color: 'orange' },
    { value: 'Selected',    label: 'Selected',    color: 'green' },
    { value: 'Joined',      label: 'Joined',      color: 'success' },
  ]);
  const insightsRef = useRef<HTMLDivElement>(null);
  const [allocationForm, setAllocationForm] = useState({
    clientName: '',
    engagementName: '',
    notes: '',
  });

  const filterPanelRef = useRef<HTMLDivElement>(null);

  // Multi-select & bulk allocation state
  const [selectedSNOs, setSelectedSNOs] = useState<Set<string>>(new Set());
  const [pendingAllocResources, setPendingAllocResources] = useState<ResourceRow[]>([]);
  const [draggingResource, setDraggingResource] = useState<ResourceRow | null>(null);
  const [pendingTargetStatus, setPendingTargetStatus] = useState<string>('Shortlisted');
  const clearSelection = () => setSelectedSNOs(new Set());

  // Clear selection on tab switch
  useEffect(() => { clearSelection(); }, [mainTab]);

  // Load from DB on mount if no data passed via props
  useEffect(() => {
    if (resources && resources.length > 0) return;
    resourceApi.getResources().then(({ resources: apiRows, fromServer: online }) => {
      if (online && apiRows.length > 0) {
        const mapped: ResourceRow[] = apiRows.map((r: any, i: number) => ({
          key: String(r.ra_id || r.raId || i),
          id: r.id,
          sno: String(r.sno || i + 1),
          raId: String(r.ra_id || r.raId || ''),
          empName: String(r.emp_name || r.empName || ''),
          emailId: String(r.email_id || r.emailId || ''),
          piwRole: String(r.piw_role || r.piwRole || ''),
          roleOrDomain: String(r.role_or_domain || r.roleOrDomain || ''),
          previousWorkex: String(r.previous_workex || r.previousWorkex || ''),
          doj: String(r.doj || ''),
          totalWorkex: String(r.total_workex || r.totalWorkex || ''),
          skills: String(r.skills || ''),
          engagement: String(r.engagement || ''),
          allocationStatus: String(r.allocation_status || r.allocationStatus || ''),
        }));
        setCachedResources(mapped);
        onUpdateResources(mapped);
      }
    });
  }, []);

  const isFilterApplied = !!(
    unifiedFilters.resourceName ||
    unifiedFilters.raid ||
    unifiedFilters.skills ||
    unifiedFilters.engagement ||
    unifiedFilters.roleOrDomain ||
    unifiedFilters.workexRange[0] !== 0 ||
    unifiedFilters.workexRange[1] !== 100
  );

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Don't close if clicking inside any filter panel
      const insidePanel = Array.from(document.querySelectorAll('[data-filter-panel]'))
        .some(el => el.contains(target));
      if (insidePanel) return;
      // Don't close if clicking inside ant design portals
      const isInsidePopup = !!target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown, .ant-tooltip');
      if (!isInsidePopup) {
        setShowFilterPanel(false);
      }
    };
    // Use capture:false and a slight delay so the toggle button click doesn't immediately reopen
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleMouseDown);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [showFilterPanel]);

  const closeFilterOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilterPanel(false);
  };

  useEffect(() => {
    if (resources && Array.isArray(resources)) {
      setCachedResources([...resources]);
    }
  }, [resources]);

  // Load allocation stages from config
  useEffect(() => {
    configApi.getConfigTypes().then(({ configTypes }) => {
      const allocType = configTypes.find((t: any) => t.typeId === 'resource_allocation_status');
      if (allocType && allocType.items?.length > 0) {
        setAllocStages(allocType.items.map((item: any) => ({
          value: item.label,
          label: item.label,
          color: item.color || 'default',
        })));
      }
    });
  }, []);

  const benchResources = useMemo(() => {
    return (cachedResources || []).filter(r => r?.engagement === 'Bench');
  }, [cachedResources]);

  const allFilteredResources = useMemo(() => {
    let filtered = cachedResources || [];
    if (unifiedFilters.resourceName) filtered = filtered.filter(r => r?.empName?.toLowerCase().includes(unifiedFilters.resourceName.toLowerCase()));
    if (unifiedFilters.raid) filtered = filtered.filter(r => r?.raId?.toLowerCase().includes(unifiedFilters.raid.toLowerCase()));
    if (unifiedFilters.skills) filtered = filtered.filter(r => r?.skills?.toLowerCase().includes(unifiedFilters.skills.toLowerCase()));
    if (unifiedFilters.engagement) filtered = filtered.filter(r => (r?.engagement || '') === unifiedFilters.engagement);
    if (unifiedFilters.roleOrDomain) filtered = filtered.filter(r => (r?.roleOrDomain || '').toLowerCase().includes(unifiedFilters.roleOrDomain.toLowerCase()));
    filtered = filtered.filter(r => {
      const workex = parseInt(r?.totalWorkex || '0', 10);
      return workex >= unifiedFilters.workexRange[0] && workex <= unifiedFilters.workexRange[1];
    });
    return filtered;
  }, [cachedResources, unifiedFilters]);

  const engagementOptions = useMemo(() => {
    const set = new Set((cachedResources || [])
      .filter(r => r?.engagement)
      .map(r => r.engagement as string));
    return Array.from(set).sort();
  }, [cachedResources]);


  const listColumns: ColumnsType<ResourceRow> = [
    { title: 'Name', dataIndex: 'empName', key: 'empName', width: 150, render: (v: string) => <Text strong style={{ fontSize: '12px' }}>{v}</Text> },
    { title: 'RA ID', dataIndex: 'raId', key: 'raId', width: 100, render: (v: string) => <span style={{ fontSize: '11px' }}>{v}</span> },
    { title: 'Role/Domain', dataIndex: 'roleOrDomain', key: 'roleOrDomain', width: 130, render: (v: string) => <span style={{ fontSize: '11px' }}>{v || ' - '}</span> },
    {
      title: 'Engagement',
      dataIndex: 'engagement',
      key: 'engagement',
      width: 120,
      render: (v: string) => v === 'Bench'
        ? <Tag color="warning" style={{ fontSize: '10px' }}>Bench</Tag>
        : <span style={{ fontSize: '11px' }}>{v || ' - '}</span>,
    },
    {
      title: 'Status',
      dataIndex: 'allocationStatus',
      key: 'allocationStatus',
      width: 110,
      render: (v: string) => {
        if (!v) return <span style={{ fontSize: '10px', color: '#aaa' }}> - </span>;
        const colorMap: Record<string, string> = { Shortlisted: 'cyan', Offered: 'orange', Selected: 'green', Joined: 'success' };
        return <Tag color={colorMap[v] || 'default'} style={{ fontSize: '10px' }}>{v}</Tag>;
      },
    },
    { title: 'Experience', dataIndex: 'totalWorkex', key: 'totalWorkex', width: 90, render: (v: string) => <span style={{ fontSize: '11px' }}>{v || ' - '} yrs</span> },
    {
      title: 'Skills',
      dataIndex: 'skills',
      key: 'skills',
      render: (v: string) => {
        if (!v) return null;
        const arr = v.split(',').map(s => s.trim());
        return (
          <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
            {arr.slice(0, 2).map((s, i) => <Tag key={i} color="blue" style={{ fontSize: '10px', margin: 0 }}>{s}</Tag>)}
            {arr.length > 2 && <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{arr.length - 2}</Tag>}
          </span>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      render: (_: any, record: ResourceRow) => {
        const status = record.allocationStatus || '';
        return (
          <Space size={4} wrap>
            <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedDetailResource(record); setDetailsModalOpen(true); }} />
            </Tooltip>
            {!status && record.engagement === 'Bench' && (
              <Button type="primary" size="small" style={{ fontSize: '10px' }} onClick={() => handleAllocateResource(record)}>Allocate</Button>
            )}
            {status === 'Shortlisted' && (
              <>
                <Button type="primary" size="small" style={{ fontSize: '10px', background: '#fa8c16', borderColor: '#fa8c16' }} onClick={() => handleUpdateStatus(record, 'Offered')}>Mark Offered</Button>
                <Button size="small" danger style={{ fontSize: '10px' }} onClick={() => handleUpdateStatus(record, '')}>Release</Button>
              </>
            )}
            {status === 'Offered' && (
              <>
                <Button type="primary" size="small" style={{ fontSize: '10px', background: '#722ed1', borderColor: '#722ed1' }} onClick={() => handleUpdateStatus(record, 'Selected')}>Mark Selected</Button>
                <Button size="small" danger style={{ fontSize: '10px' }} onClick={() => handleUpdateStatus(record, '')}>Release</Button>
              </>
            )}
            {status === 'Selected' && (
              <>
                <Button type="primary" size="small" style={{ fontSize: '10px' }} onClick={() => handleUpdateStatus(record, 'Joined')}>Mark Joined</Button>
                <Button size="small" danger style={{ fontSize: '10px' }} onClick={() => handleUpdateStatus(record, '')}>Release</Button>
              </>
            )}
          </Space>
        );
      },
    },
  ];

  const handleBenchUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet) as any[];

        if (!rows || rows.length === 0) {
          message.warning('No data found in file');
          return false;
        }

        const raidColumn = Object.keys(rows[0])[0];
        const uploadedRAIDs = rows.map(row => String(row[raidColumn] || '').trim()).filter(Boolean);

        const updated = (cachedResources || []).map(resource => {
          if (uploadedRAIDs.includes(resource?.raId || '')) {
            return { ...resource, engagement: 'Bench' };
          }
          return resource;
        });

        const matchedCount = uploadedRAIDs.filter(raid =>
          (cachedResources || []).some(r => r?.raId === raid)
        ).length;

        setCachedResources(updated);
        onUpdateResources(updated);

        // Persist bench status to DB for matched resources
        const benchedResources = updated.filter(r => uploadedRAIDs.includes(r?.raId || ''));
        if (benchedResources.length > 0) {
          resourceApi.bulkSave(benchedResources.map(r => ({
            raId: r.raId, sno: Number(r.sno), empName: r.empName, emailId: r.emailId,
            piwRole: r.piwRole, roleOrDomain: r.roleOrDomain, previousWorkex: r.previousWorkex,
            doj: r.doj, totalWorkex: r.totalWorkex, engagement: 'Bench', skills: r.skills,
          }))).catch(() => {/* server offline  -  in-memory update still applied */});
        }

        message.success(` Matched ${matchedCount} resources to Bench`);
      } catch (error) {
        message.error('Error processing file');
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleAllocateResource = (resource: ResourceRow) => {
    setPendingTargetStatus('Shortlisted');
    setPendingAllocResources([resource]);
    setAllocationDrawer(true);
  };

  const handleBulkAllocate = (resourcePool: ResourceRow[]) => {
    const toAlloc = resourcePool.filter(r => selectedSNOs.has(r.sno));
    if (!toAlloc.length) { message.warning('Select at least one resource first'); return; }
    setPendingTargetStatus('Shortlisted');
    setPendingAllocResources(toAlloc);
    setAllocationDrawer(true);
  };

  const handleSaveAllocation = async () => {
    if (!pendingAllocResources.length || !allocationForm.engagementName) {
      message.warning('Please enter an engagement name');
      return;
    }
    setSavingAllocation(true);
    let successCount = 0;
    try {
      const updatedAll = [...cachedResources];
      for (const res of pendingAllocResources) {
        const payload = {
          raId: res.raId, empName: res.empName, emailId: res.emailId,
          piwRole: res.piwRole, roleOrDomain: res.roleOrDomain,
          previousWorkex: res.previousWorkex, doj: res.doj,
          totalWorkex: res.totalWorkex, skills: res.skills,
          engagement: allocationForm.engagementName,
          allocationStatus: pendingTargetStatus,
        };
        try {
          if (res.id) {
            await resourceApi.updateResource(res.id, payload);
          } else {
            // Fallback: upsert via bulkSave (keyed by raId)
            await resourceApi.bulkSave([{ ...payload, sno: Number(res.sno) || 0 }]);
          }
        } catch {
          // Server offline  -  local state still updated below
        }
        // Always update local state regardless of server response
        const idx = updatedAll.findIndex(r => r.id === res.id || r.raId === res.raId);
        if (idx >= 0) updatedAll[idx] = { ...updatedAll[idx], engagement: allocationForm.engagementName, allocationStatus: pendingTargetStatus };
        successCount++;
      }
      setCachedResources(updatedAll);
      onUpdateResources(updatedAll);
      const names = pendingAllocResources.length === 1
        ? pendingAllocResources[0].empName
        : `${successCount} resources`;
      message.success({ content: `${names} marked as ${pendingTargetStatus} for ${allocationForm.engagementName}`, duration: 5 });
      setAllocationDrawer(false);
      setAllocationForm({ clientName: '', engagementName: '', notes: '' });
      setPendingAllocResources([]);
      clearSelection();
    } catch (err) {
      message.error('Failed to update resource(s)');
    } finally {
      setSavingAllocation(false);
    }
  };

  const handleUpdateStatus = async (resource: ResourceRow, newStatus: string, opts?: { engagement?: string }) => {
    const payload: any = {
      raId: resource.raId, empName: resource.empName, emailId: resource.emailId,
      piwRole: resource.piwRole, roleOrDomain: resource.roleOrDomain,
      previousWorkex: resource.previousWorkex, doj: resource.doj,
      totalWorkex: resource.totalWorkex, skills: resource.skills,
      engagement: opts?.engagement !== undefined ? opts.engagement : resource.engagement || '',
      allocationStatus: newStatus,
    };
    if (newStatus === '' || newStatus === 'Available') { payload.engagement = 'Bench'; payload.allocationStatus = 'Available'; }
    try {
      if (resource.id) {
        await resourceApi.updateResource(resource.id, payload);
      } else {
        await resourceApi.bulkSave([{ ...payload, sno: Number(resource.sno) || 0 }]);
      }
    } catch {
      // Server offline  -  local state still updated below
    }
    // Always update local state
    const updated = (cachedResources || []).map(r =>
      (r.id && r.id === resource.id) || r.raId === resource.raId ? { ...r, ...payload } : r
    );
    setCachedResources(updated);
    onUpdateResources(updated);
    if (newStatus === '') message.success({ content: `${resource.empName} released back to bench`, duration: 4 });
    else if (newStatus === 'Selected') message.success({ content: `${resource.empName} marked as Selected  -  now visible in the Projects tab under "Selected  -  Pending Joining"`, duration: 5 });
    else message.success(`${resource.empName} marked as ${newStatus}`);
  };

  const handleBulkUpdateStatus = async (resources2: ResourceRow[], newStatus: string, opts?: { engagement?: string }) => {
    const bulkPayloads = resources2.map(r => {
      const eng = opts?.engagement !== undefined ? opts.engagement : ((newStatus === '' || newStatus === 'Available') ? 'Bench' : (r.engagement || ''));
      return { raId: r.raId, sno: Number(r.sno) || 0, empName: r.empName, emailId: r.emailId, piwRole: r.piwRole, roleOrDomain: r.roleOrDomain, previousWorkex: r.previousWorkex, doj: r.doj, totalWorkex: r.totalWorkex, skills: r.skills, engagement: eng, allocationStatus: newStatus };
    });
    const effectiveStatus = newStatus === '' ? 'Available' : newStatus;
    const bulkPayloadsFixed = bulkPayloads.map(p => ({ ...p, allocationStatus: effectiveStatus }));
    try { await resourceApi.bulkSave(bulkPayloadsFixed); } catch { /* offline  -  local state still updated */ }
    const raIdSet = new Set(resources2.map(r => r.raId));
    const updated = (cachedResources || []).map(r => {
      if (!raIdSet.has(r.raId)) return r;
      const pay = bulkPayloads.find(p => p.raId === r.raId)!;
      const effStatus = newStatus === '' ? 'Available' : newStatus;
      return { ...r, engagement: pay.engagement, allocationStatus: effStatus };
    });
    setCachedResources(updated);
    onUpdateResources(updated);
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (event: DragStartEvent) => {
    setDraggingResource((event.active.data.current as any)?.resource ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingResource(null);
    const { active, over } = event;
    if (!over) return;
    const resource = (active.data.current as any)?.resource as ResourceRow;
    if (!resource) return;
    const targetCol = String(over.id);
    const currentStatus = resource.allocationStatus || '';
    const isAvailable = (!currentStatus || currentStatus === 'Available') && resource.engagement === 'Bench';
    const currentCol = isAvailable ? 'available' : currentStatus.toLowerCase();
    if (currentCol === targetCol) return;

    // If dragged tile is selected, move all selected; otherwise just the one tile
    const allPipeline = [...filteredBenchResources, ...shortlistedResources, ...offeredResources, ...selectedResources];
    const resourcesToMove = selectedSNOs.has(resource.sno)
      ? allPipeline.filter(r => selectedSNOs.has(r.sno))
      : [resource];

    if (targetCol === 'available') {
      handleBulkUpdateStatus(resourcesToMove, 'Available');
      message.info({ content: resourcesToMove.length === 1 ? `${resourcesToMove[0].empName} returned to bench` : `${resourcesToMove.length} resources returned to bench`, duration: 3 });
    } else if (targetCol === 'shortlisted') {
      if (currentStatus === 'Offered') {
        handleBulkUpdateStatus(resourcesToMove, 'Shortlisted');
        message.success({ content: `Moved back to Shortlisted`, duration: 3 });
      } else {
        setPendingTargetStatus('Shortlisted');
        setPendingAllocResources(resourcesToMove);
        setAllocationDrawer(true);
      }
    } else if (targetCol === 'offered') {
      if (isAvailable) {
        setPendingTargetStatus('Offered');
        setPendingAllocResources(resourcesToMove);
        setAllocationDrawer(true);
      } else {
        handleBulkUpdateStatus(resourcesToMove, 'Offered');
        message.success({ content: resourcesToMove.length === 1 ? `${resourcesToMove[0].empName} moved to Offered` : `${resourcesToMove.length} resources moved to Offered`, duration: 3 });
      }
    } else if (targetCol === 'selected') {
      // 4th column = Joined -> Projects
      handleBulkUpdateStatus(resourcesToMove, 'Joined');
      message.success({ content: resourcesToMove.length === 1 ? `${resourcesToMove[0].empName} marked as Joined - moved to Projects` : `${resourcesToMove.length} resources marked as Joined`, duration: 4 });
    } else if (targetCol === 'projects') {
      // Drag to "Move to Projects" column  -  mark Joined and set engagement
      handleBulkUpdateStatus(resourcesToMove, 'Joined');
      message.success({ content: resourcesToMove.length === 1 ? `${resourcesToMove[0].empName} marked as Joined  -  moved to Projects` : `${resourcesToMove.length} resources marked as Joined`, duration: 4 });
    }
    clearSelection();
  };

  // â”€â”€â”€ Insights data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const total = cachedResources?.length || 0;
  const benchCount = benchResources?.length || 0;
  const activeCount = total - benchCount;
  const utilizationPct = total > 0 ? Math.round((activeCount / total) * 100) : 0;

  const handleExportListTable = (data: ResourceRow[], filename: string) => {
    if (!data.length) { message.warning('No data to export'); return; }
    const headers = ['Name', 'RA ID', 'PIW Role', 'Role/Domain', 'Engagement', 'Allocation Status', 'Experience', 'Skills'];
    const aoa: any[][] = [headers];
    data.forEach(r => {
      aoa.push([r.empName, r.raId, r.piwRole || '', r.roleOrDomain || '', r.engagement || '', r.allocationStatus || '', r.totalWorkex || '', r.skills || '']);
    });
    const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 28 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 40 }];
    ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
    ws['!sheetViews'] = [{ showGridLines: false }];
    const numCols = headers.length, numRows = aoa.length;
    const hFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
    const hFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
    const eFill = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
    const wFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
    const tG = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
    const mN = { style: 'medium' as const, color: { rgb: '001529' } };
    const statusColors: Record<string, string> = { Shortlisted: 'E6FFFB', Offered: 'F9F0FF', Selected: 'F6FFED', Available: 'FFFBE6' };
    for (let R = 0; R < numRows; R++) {
      const rowStatus = R > 0 ? String(aoa[R][5] || '') : '';
      const statusFill = statusColors[rowStatus] ? { patternType: 'solid' as const, fgColor: { rgb: statusColors[rowStatus] } } : null;
      for (let C = 0; C < numCols; C++) {
        const addr = XLSXStyle.utils.encode_cell({ r: R, c: C });
        if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
        ws[addr].s = {
          fill: R === 0 ? hFill : (statusFill && C === 5) ? statusFill : R % 2 === 0 ? eFill : wFill,
          font: R === 0 ? hFont : { sz: 10 },
          alignment: { vertical: 'center' as const, horizontal: 'left' as 'left', wrapText: false },
          border: { top: R === 0 ? mN : tG, bottom: R === numRows - 1 ? mN : tG, left: C === 0 ? mN : tG, right: C === numCols - 1 ? mN : tG },
        };
      }
    }
    const wb = XLSXStyle.utils.book_new();
    XLSXStyle.utils.book_append_sheet(wb, ws, 'Resources');
    XLSXStyle.writeFile(wb, filename);
    message.success('Export downloaded');
  };

  // Export all pipeline resources (non-Joined, has allocationStatus)
  const handleExportPipeline = () => {
    const pipelineData = (cachedResources || []).filter(r => r.allocationStatus && r.allocationStatus !== 'Joined');
    handleExportListTable(pipelineData, `Pipeline_Export_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const engagementBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    (cachedResources || []).forEach(r => {
      const eng = r?.engagement || 'Unassigned';
      map[eng] = (map[eng] || 0) + 1;
    });
    // Bench always first, rest sorted by count descending
    const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const benchIdx = entries.findIndex(([eng]) => eng === 'Bench');
    if (benchIdx > 0) {
      const [benchEntry] = entries.splice(benchIdx, 1);
      entries.unshift(benchEntry);
    }
    return entries;
  }, [cachedResources]);

  // Bench resources breakdown by Role/Domain for insights
  const roleBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    (cachedResources || []).filter(r => (r?.engagement || '').toLowerCase() === 'bench').forEach(r => {
      const role = r?.roleOrDomain || 'Unassigned';
      map[role] = (map[role] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [cachedResources]);

  const downloadEngagementTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([['RA ID', 'Current Engagement']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Engagement Template');
    XLSX.writeFile(wb, 'Engagement_Update_Template.xlsx');
  };

  const handleEngagementUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);
        if (!rows.length) { message.warning('No data found in file'); return; }

        // Map RA ID  ->  engagement from file
        const engMap: Record<string, string> = {};
        rows.forEach(r => {
          const raId = String(r['RA ID'] || r['ra_id'] || r['raId'] || '').trim();
          const eng = String(r['Current Engagement'] || r['engagement'] || '').trim();
          if (raId && eng) engMap[raId.toLowerCase()] = eng;
        });

        let matched = 0;
        const updated = cachedResources.map(r => {
          const key = (r?.raId || '').toLowerCase();
          if (engMap[key]) {
            matched++;
            return { ...r, engagement: engMap[key] };
          }
          return r;
        });

        if (!matched) { message.warning('No matching RA IDs found'); return; }

        // Persist to DB
        await resourceApi.bulkSave(updated.map(r => ({
          raId: r.raId, sno: Number(r.sno), empName: r.empName, emailId: r.emailId,
          piwRole: r.piwRole, roleOrDomain: r.roleOrDomain, previousWorkex: r.previousWorkex,
          doj: r.doj, totalWorkex: r.totalWorkex, engagement: r.engagement || '', skills: r.skills,
        })));

        setCachedResources(updated);
        onUpdateResources(updated);
        message.success(`Updated engagement for ${matched} resource(s)`);
      } catch (err) {
        message.error('Failed to parse file');
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };


  // â”€â”€â”€ Reusable card/list renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const renderAllocCard = (resource: ResourceRow) => {
    if (!resource) return null;
    const status = resource.allocationStatus || '';
    const stageConfig = allocStages.find(s => s.value === status);
    const isAvailable = !status && resource.engagement === 'Bench';
    const skillsArr = resource.skills ? resource.skills.split(',').map(s => s.trim()) : [];
    const isChecked = selectedSNOs.has(resource.sno);
    const borderColor = isChecked ? '#1890ff' : isAvailable ? '#faad14' : status === 'Shortlisted' ? '#13c2c2' : status === 'Offered' ? '#722ed1' : status === 'Selected' ? '#52c41a' : '#d9d9d9';
    const bgTint = isChecked ? '#e6f4ff' : isAvailable ? '#fffbe6' : status === 'Shortlisted' ? '#e6fffb' : status === 'Offered' ? '#f9f0ff' : status === 'Selected' ? '#f6ffed' : '#fff';
    const toggleCheck = () => setSelectedSNOs(prev => { const next = new Set(prev); if (next.has(resource.sno)) next.delete(resource.sno); else next.add(resource.sno); return next; });
    return (
      <div key={resource.sno} style={{ background: bgTint, borderRadius: '8px', padding: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: `1px solid ${borderColor}40`, borderLeft: `4px solid ${borderColor}`, display: 'flex', flexDirection: 'column', minHeight: '140px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flex: 1, minWidth: 0, marginRight: 4 }}>
            {isAvailable && <Checkbox checked={isChecked} onChange={toggleCheck} style={{ marginTop: 2, flexShrink: 0 }} />}
            <Text strong style={{ fontSize: '12px', lineHeight: '16px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.empName}</Text>
          </div>
          <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedDetailResource(resource); setDetailsModalOpen(true); }} style={{ padding: 0, flexShrink: 0 }} />
          </Tooltip>
        </div>
        <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: '2px' }}>{resource.raId}</div>
        <div style={{ fontSize: '10px', color: '#595959', marginBottom: '4px' }}>{resource.roleOrDomain || resource.piwRole}{resource.totalWorkex ? `  ·  ${resource.totalWorkex} yrs` : ''}</div>
        {status && (
          <div style={{ marginBottom: '4px' }}>
            <Tag color={stageConfig?.color || 'default'} style={{ fontSize: '9px', padding: '0 4px', margin: 0 }}>{status}</Tag>
            {resource.engagement && resource.engagement !== 'Bench' && (
              <span style={{ fontSize: '10px', color: '#666', marginLeft: 4 }}>{resource.engagement}</span>
            )}
          </div>
        )}
        {/* Skills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, overflow: 'hidden' }}>
          {skillsArr.slice(0, 2).map((skill, idx) => (
            <Tag key={idx} color="blue" style={{ fontSize: '9px', margin: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill}</Tag>
          ))}
          {skillsArr.length > 2 && (
            <Tooltip title={skillsArr.slice(2).join(', ')} overlayInnerStyle={{ fontSize: '11px' }}>
              <Tag style={{ fontSize: '9px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9', cursor: 'pointer' }}>+{skillsArr.length - 2} more</Tag>
            </Tooltip>
          )}
        </div>
        {/* Spacer pushes buttons to bottom */}
        <div style={{ flex: 1 }} />
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: 6 }}>
          {isAvailable && (
            <Button type="primary" size="small" onClick={() => handleAllocateResource(resource)} style={{ fontSize: '10px' }}>Allocate</Button>
          )}
          {status === 'Shortlisted' && (
            <>
              <Button type="primary" size="small" onClick={() => handleUpdateStatus(resource, 'Offered')} style={{ fontSize: '10px', background: '#fa8c16', borderColor: '#fa8c16' }}>Mark Offered</Button>
              <Button size="small" danger onClick={() => handleUpdateStatus(resource, '')} style={{ fontSize: '10px' }}>Release</Button>
            </>
          )}
          {status === 'Offered' && (
            <>
              <Button type="primary" size="small" onClick={() => handleUpdateStatus(resource, 'Selected')} style={{ fontSize: '10px', background: '#722ed1', borderColor: '#722ed1' }}>Mark Selected</Button>
              <Button size="small" danger onClick={() => handleUpdateStatus(resource, '')} style={{ fontSize: '10px' }}>Release</Button>
            </>
          )}
          {status === 'Selected' && (
            <>
              <Button type="primary" size="small" onClick={() => handleUpdateStatus(resource, 'Joined')} style={{ fontSize: '10px' }}>Mark Joined</Button>
              <Button size="small" danger onClick={() => handleUpdateStatus(resource, '')} style={{ fontSize: '10px' }}>Release</Button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderAllocSection = (resources2: ResourceRow[], title: string, color: string, tagColor: string, emptyMsg: string) => {
    const label = (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Tag color={tagColor} style={{ fontSize: '11px', margin: 0 }}>{title} ({resources2.length})</Tag>
      </div>
    );
    const content = resources2.length === 0
      ? <Text type="secondary" style={{ fontSize: '12px' }}>{emptyMsg || `No ${title.toLowerCase()} resources`}</Text>
      : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {resources2.map(r => renderAllocCard(r))}
        </div>;
    return (
      <div style={{ marginBottom: 12 }}>
        <Collapse
          items={[{ key: 'section', label, children: content }]}
          defaultActiveKey={[]}
          style={{ background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 8 }}
        />
      </div>
    );
  };

  const renderCardGroups = (data: ResourceRow[]) => {
    const groups: Record<string, ResourceRow[]> = {};
    const benchGroup: ResourceRow[] = [];
    data.forEach(resource => {
      if (!resource) return;
      if (resource.engagement === 'Bench') benchGroup.push(resource);
      else { const eng = resource.engagement || 'Unassigned'; if (!groups[eng]) groups[eng] = []; groups[eng].push(resource); }
    });
    const items = [
      ...Object.entries(groups).map(([eng, res]) => ({ key: eng, isBench: false, resources: res })),
      ...(benchGroup.length > 0 ? [{ key: 'Bench', isBench: true, resources: benchGroup }] : []),
    ].map(group => ({
      key: group.key,
      label: (
        <span>
          {group.isBench ? <Tag color="warning" style={{ fontSize: '10px', marginRight: 6 }}>Bench</Tag> : null}
          {group.key}
          <span style={{ marginLeft: 8, color: '#888', fontSize: '12px' }}>({group.resources.length})</span>
        </span>
      ),
      children: (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
          {group.resources.map(resource => {
            if (!resource) return null;
            const skillsArr = resource.skills ? resource.skills.split(',').map(s => s.trim()) : [];
            const isChecked = selectedSNOs.has(resource.sno);
            const toggleCheck = () => setSelectedSNOs(prev => { const next = new Set(prev); if (next.has(resource.sno)) next.delete(resource.sno); else next.add(resource.sno); return next; });
            return (
              <div key={resource.sno} style={{ background: isChecked ? '#e6f4ff' : '#fff', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: isChecked ? '2px solid #1890ff' : (group.isBench ? '1px solid #ffe58f' : '1px solid #f0f0f0'), borderLeft: isChecked ? '4px solid #1890ff' : (group.isBench ? '4px solid #faad14' : '1px solid #f0f0f0'), display: 'flex', flexDirection: 'column', minHeight: '140px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flex: 1, minWidth: 0, marginRight: 4 }}>
                    <Checkbox checked={isChecked} onChange={toggleCheck} style={{ marginTop: 2, flexShrink: 0 }} />
                    <Text strong style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resource.empName}</Text>
                  </div>
                  <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedDetailResource(resource); setDetailsModalOpen(true); }} style={{ padding: 0, flexShrink: 0 }} />
                  </Tooltip>
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '2px' }}>{resource.raId}</div>
                <div style={{ fontSize: '11px', color: '#595959', marginBottom: '4px' }}>{resource.roleOrDomain || resource.piwRole}  ·  {resource.totalWorkex || ' - '} yrs</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, overflow: 'hidden' }}>
                  {skillsArr.slice(0, 2).map((skill, idx) => <Tag key={idx} color="blue" style={{ fontSize: '10px', margin: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{skill}</Tag>)}
                  {skillsArr.length > 2 && (
                    <Tooltip title={skillsArr.slice(2).join(', ')}><Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9', cursor: 'pointer' }}>+{skillsArr.length - 2} more</Tag></Tooltip>
                  )}
                </div>
                <div style={{ flex: 1 }} />
                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: 6 }}>
                  <Button type="primary" size="small" onClick={() => handleAllocateResource(resource)} style={{ fontSize: '10px' }}>Allocate</Button>
                </div>
              </div>
            );
          })}
        </div>
      ),
    }));
    return items.length > 0 ? <Collapse items={items} defaultActiveKey={[]} /> : <Empty description="No resources found" style={{ marginTop: 48 }} />;
  };

  const renderListTable = (data: ResourceRow[]) => (
    <div className="compact-table">
      <Table<ResourceRow>
        dataSource={data}
        columns={listColumns}
        rowKey="sno"
        size="small"
        pagination={{ pageSize: 15, showSizeChanger: false }}
        scroll={{ x: 'max-content', y: 420 }}
        locale={{ emptyText: 'No resources match your filters' }}
        rowClassName={(record) => record.engagement === 'Bench' ? 'bench-row' : ''}
        rowSelection={{
          type: 'checkbox',
          selectedRowKeys: Array.from(selectedSNOs),
          onChange: (selectedRowKeys) => setSelectedSNOs(new Set(selectedRowKeys as string[])),
        }}
      />
    </div>
  );

  // â”€â”€â”€ Tab data sets â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Pipeline stages: Shortlisted + Offered are shown in Bench tab, Selected in Projects tab
  const pipelineStages = new Set(['Shortlisted', 'Offered']);
  const projectResources = useMemo(() =>
    allFilteredResources.filter(r => r?.engagement && r.engagement !== 'Bench' && !pipelineStages.has(r?.allocationStatus || '')),
    [allFilteredResources]
  );
  const selectedResources = useMemo(() =>
    allFilteredResources.filter(r => r?.allocationStatus === 'DISABLED_NO_SELECTED_STAGE'),
    [allFilteredResources]
  );
  const filteredBenchResources = useMemo(() =>
    allFilteredResources.filter(r => r?.engagement === 'Bench' && (!r?.allocationStatus || r?.allocationStatus === 'Available')),
    [allFilteredResources]
  );
  const shortlistedResources = useMemo(() =>
    allFilteredResources.filter(r => r?.allocationStatus === 'Shortlisted'),
    [allFilteredResources]
  );
  const offeredResources = useMemo(() =>
    allFilteredResources.filter(r => r?.allocationStatus === 'Offered'),
    [allFilteredResources]
  );
  const totalBenchTabCount = filteredBenchResources.length + shortlistedResources.length + offeredResources.length + selectedResources.length;

  return (
    <div style={{ background: '#f5f5f5', padding: '12px 24px' }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={6}>
          <div>
            <Typography.Title level={4} style={{ marginBottom: 2 }}>Engagement Mapping</Typography.Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>Resource allocation across projects, bench status, and utilization insights</Text>
          </div>
          <div style={{ background: '#fff', borderRadius: '8px', padding: '16px' }}>
            <Tabs
              activeKey={mainTab}
              onChange={setMainTab}
              size="small"
              tabBarStyle={{ fontSize: '11px' }}
              items={[
                {
                  key: 'bench',
                  label: (
                    <span style={{ fontSize: '11px' }}>
                      <TeamOutlined /> Deployment Pool
                      {totalBenchTabCount > 0 && <Tag color="warning" style={{ marginLeft: 6, fontSize: '10px' }}>{totalBenchTabCount}</Tag>}
                    </span>
                  ),
                  children: (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '10px' }}>
                        <Space size={8}>
                          <Text style={{ fontSize: '12px', color: '#666' }}>
                            <strong>{filteredBenchResources.length}</strong> available  |  <strong>{shortlistedResources.length}</strong> shortlisted  |  <strong>{offeredResources.length}</strong> offered  |  <strong>{selectedResources.length}</strong> selected
                          </Text>
                          {selectedSNOs.size > 0 && (
                            <Tag color="blue" style={{ fontSize: '11px', cursor: 'pointer' }} onClick={clearSelection}>
                              {selectedSNOs.size} selected - drag any to move all | click to clear
                            </Tag>
                          )}
                        </Space>
                        <Space wrap size={8}>
                          {isFilterApplied && (
                            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>x Clear Filters</Button>
                          )}
                          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Tooltip title="Upload Bench RAID (Excel)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Upload accept=".xlsx,.xls" beforeUpload={handleBenchUpload} showUploadList={false}>
                              <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                            </Upload>
                          </Tooltip>
                          <Tooltip title="Export Bench (Excel)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FileExcelOutlined />} size="small" disabled={!filteredBenchResources.length} onClick={() => handleExportListTable(filteredBenchResources, `Bench_Export_${new Date().toISOString().slice(0,10)}.xlsx`)} style={{ borderRadius: '6px', color: filteredBenchResources.length ? '#52c41a' : undefined }} />
                          </Tooltip>
                          <Tooltip title="Export Pipeline (Shortlisted/Offered/Selected)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FileExcelOutlined />} size="small" onClick={handleExportPipeline} style={{ borderRadius: '6px', color: '#722ed1' }}>Pipeline</Button>
                          </Tooltip>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {showFilterPanel && (
                          <div ref={filterPanelRef} data-filter-panel="true" style={{ width: '220px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '14px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>Filters</span>
                              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>Clear all</Button>
                            </div>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Name</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.resourceName} onChange={e => setUnifiedFilters(prev => ({ ...prev, resourceName: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.raid} onChange={e => setUnifiedFilters(prev => ({ ...prev, raid: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.skills} onChange={e => setUnifiedFilters(prev => ({ ...prev, skills: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Role / Domain</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.roleOrDomain} onChange={e => setUnifiedFilters(prev => ({ ...prev, roleOrDomain: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Experience: {unifiedFilters.workexRange[0]}-{unifiedFilters.workexRange[1]} yrs</div>
                                <Slider range min={0} max={50} value={unifiedFilters.workexRange} onChange={(value) => setUnifiedFilters(prev => ({ ...prev, workexRange: value as [number, number] }))} />
                              </div>
                            </Space>
                          </div>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                          {totalBenchTabCount === 0 ? (
                            <Empty description="No bench resources. Upload a RAID file or mark resources as bench." style={{ marginTop: 48 }} />
                          ) : (
                            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                              <div style={{ display: 'flex', gap: 12, height: 'calc(100vh - 220px)', minHeight: 420 }} onClick={() => setSelectedSNOs(new Set())}>
                                <KanbanColumnComp id="available" title="Available" color="#faad14" bgColor="#fffbe6"
                                  resources={filteredBenchResources} selectedSNOs={selectedSNOs}
                                  onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                  onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                />
                                <KanbanColumnComp id="shortlisted" title="Shortlisted" color="#13c2c2" bgColor="#e6fffb"
                                  resources={shortlistedResources} selectedSNOs={selectedSNOs}
                                  onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                  onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                />
                                <KanbanColumnComp id="offered" title="Offered" color="#722ed1" bgColor="#f9f0ff"
                                  resources={offeredResources} selectedSNOs={selectedSNOs}
                                  onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                  onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                />
                                <KanbanColumnComp id="selected" title="Joined → Projects" color="#52c41a" bgColor="#f6ffed"
                                  resources={selectedResources} selectedSNOs={selectedSNOs}
                                  onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                  onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                
                                   headerAction={selectedResources.length > 0 ? (
                                     <Tooltip title="Mark all as Joined" overlayInnerStyle={{ fontSize: '11px' }}>
                                       <Button size="small" type="primary" style={{ fontSize: '9px', padding: '0 6px', height: 18, lineHeight: '18px', background: '#389e0d', borderColor: '#389e0d' }}
                                         onClick={(e) => { e.stopPropagation(); handleBulkUpdateStatus(selectedResources, 'Joined'); message.success({ content: `${selectedResources.length} marked Joined`, duration: 4 }); }}
                                       >Mark All Joined</Button>
                                     </Tooltip>
                                   ) : undefined}/>
                              </div>
                              <DragOverlay>
                                {draggingResource && (
                                  <div style={{ background: '#fff', borderRadius: 6, padding: '6px 10px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', minWidth: 160, border: '2px solid #1890ff', opacity: 0.96 }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600, color: '#333' }}>{draggingResource.empName}</div>
                                    <div style={{ fontSize: '9px', color: '#8c8c8c' }}>{draggingResource.raId}  |  {draggingResource.roleOrDomain || draggingResource.piwRole}</div>
                                    {selectedSNOs.has(draggingResource.sno) && selectedSNOs.size > 1 && (
                                      <div style={{ fontSize: '9px', color: '#1890ff', marginTop: 2 }}>+{selectedSNOs.size - 1} more moving</div>
                                    )}
                                  </div>
                                )}
                              </DragOverlay>
                            </DndContext>
                          )}
                        </div>
                      </div>
                      <div style={{ marginTop: 8, fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
                        Drag tiles to change status | Click to multi-select | Drag selected tile to move all
                      </div>
                    </>
                  ),
                },
                {
                  key: 'projects',
                  label: <span style={{ fontSize: '11px' }}><ProjectOutlined /> Projects</span>,
                  children: (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '12px' }}>
                        <Text style={{ fontSize: '12px', color: '#666' }}>
                          Showing: <strong>{projectResources.length}</strong> resources on projects
                        </Text>
                        <Space wrap size={8}>
                          {selectedSNOs.size > 0 && (
                            <>
                              <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#8c8c8c' }} onClick={clearSelection}>x Clear ({selectedSNOs.size})</Button>
                              <Button size="small" type="primary" style={{ fontSize: '11px' }} onClick={() => handleBulkAllocate(projectResources)}>Bulk Allocate ({selectedSNOs.size})</Button>
                            </>
                          )}
                          {isFilterApplied && (
                            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>x Clear Filters</Button>
                          )}
                          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Tooltip title="List View" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<UnorderedListOutlined />} type={viewMode === 'list' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('list')} style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Tooltip title="Card View" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<AppstoreOutlined />} type={viewMode === 'card' ? 'primary' : 'default'} size="small" onClick={() => setViewMode('card')} style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Tooltip title="Export Formatted Excel" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FileExcelOutlined />} size="small" disabled={!projectResources.length} onClick={() => handleExportListTable(projectResources, `Projects_Export_${new Date().toISOString().slice(0,10)}.xlsx`)} style={{ borderRadius: '6px', color: projectResources.length ? '#52c41a' : undefined }} />
                          </Tooltip>
                          <Tooltip title="Download Engagement Update Template" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<DownloadOutlined />} size="small" onClick={downloadEngagementTemplate} style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Tooltip title="Upload Engagement Updates (RA ID + Current Engagement)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Upload accept=".xlsx,.xls" beforeUpload={handleEngagementUpload} showUploadList={false}>
                              <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                            </Upload>
                          </Tooltip>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {showFilterPanel && (
                          <div data-filter-panel="true" style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>Filters</span>
                              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>Clear all</Button>
                            </div>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Name</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.resourceName} onChange={e => setUnifiedFilters(prev => ({ ...prev, resourceName: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.raid} onChange={e => setUnifiedFilters(prev => ({ ...prev, raid: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.skills} onChange={e => setUnifiedFilters(prev => ({ ...prev, skills: e.target.value }))} allowClear style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Project / Engagement</div>
                                <Select size="small" placeholder="All" allowClear value={unifiedFilters.engagement || undefined} onChange={(value) => setUnifiedFilters(prev => ({ ...prev, engagement: value || '' }))} options={engagementOptions.filter(e => e !== 'Bench').map(eng => ({ label: eng, value: eng }))} style={{ width: '100%', fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Experience: {unifiedFilters.workexRange[0]}-{unifiedFilters.workexRange[1]} yrs</div>
                                <Slider range min={0} max={50} value={unifiedFilters.workexRange} onChange={(value) => setUnifiedFilters(prev => ({ ...prev, workexRange: value as [number, number] }))} />
                              </div>
                            </Space>
                          </div>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          {viewMode === 'list' ? renderListTable(projectResources) : renderCardGroups(projectResources)}
                        </div>
                      </div>
                    </>
                  ),
                },
                {
                  key: 'insights',
                  label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Utilization Insights</span>,
                  children: (
                    <div>
                      {/* Insights toolbar */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                        <Tooltip title="Export Insights as PNG" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button
                            size="small"
                            icon={<DownloadOutlined />}
                            loading={exportingInsights}
                            onClick={async () => {
                              if (!insightsRef.current) return;
                              setExportingInsights(true);
                              try {
                                const canvas = await html2canvas(insightsRef.current, { scale: 2, useCORS: true, backgroundColor: '#f5f6fa' });
                                const link = document.createElement('a');
                                link.download = `utilization-insights-${new Date().toISOString().slice(0, 10)}.png`;
                                link.href = canvas.toDataURL('image/png');
                                link.click();
                              } finally {
                                setExportingInsights(false);
                              }
                            }}
                            style={{ fontSize: '11px' }}
                          >
                            Export PNG
                          </Button>
                        </Tooltip>
                      </div>
                      <div ref={insightsRef}>
                      {total === 0 ? (
                        <Empty description="No resource data. Upload resources in the Information tab first." style={{ marginTop: 48 }} />
                      ) : (
                        <>
                          {/* Summary KPIs */}
                          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
                            <Col xs={24} sm={12} md={6}>
                              <Card style={{ borderRadius: 8, textAlign: 'center', border: '1px solid #e6f7ff' }}>
                                <Statistic title={<span style={{ fontSize: '12px', color: '#666' }}>Total Resources</span>} value={total} valueStyle={{ color: '#1890ff', fontSize: '28px', fontWeight: 700 }} />
                              </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                              <Card style={{ borderRadius: 8, textAlign: 'center', border: '1px solid #f6ffed' }}>
                                <Statistic title={<span style={{ fontSize: '12px', color: '#666' }}>On Projects</span>} value={activeCount} valueStyle={{ color: '#52c41a', fontSize: '28px', fontWeight: 700 }} />
                              </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                              <Card style={{ borderRadius: 8, textAlign: 'center', border: '1px solid #fffbe6' }}>
                                <Statistic title={<span style={{ fontSize: '12px', color: '#666' }}>On Bench</span>} value={benchCount} valueStyle={{ color: '#faad14', fontSize: '28px', fontWeight: 700 }} />
                              </Card>
                            </Col>
                            <Col xs={24} sm={12} md={6}>
                              <Card style={{ borderRadius: 8, textAlign: 'center', border: '1px solid #f9f0ff' }}>
                                <Statistic title={<span style={{ fontSize: '12px', color: '#666' }}>Utilization %</span>} value={utilizationPct} suffix="%" valueStyle={{ color: utilizationPct >= 80 ? '#52c41a' : utilizationPct >= 60 ? '#faad14' : '#f5222d', fontSize: '28px', fontWeight: 700 }} />
                              </Card>
                            </Col>
                          </Row>

                          {/* Utilization bar */}
                          <Card style={{ borderRadius: 8, marginBottom: 16 }} bodyStyle={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <Text strong style={{ fontSize: '13px' }}>Overall Utilization</Text>
                              <Text style={{ fontSize: '12px', color: '#666' }}>{activeCount} of {total} resources active</Text>
                            </div>
                            <Progress
                              percent={utilizationPct}
                              strokeColor={utilizationPct >= 80 ? '#52c41a' : utilizationPct >= 60 ? '#faad14' : '#f5222d'}
                              trailColor="#fff1f0"
                              strokeWidth={12}
                              format={pct => <span style={{ fontSize: '12px' }}>{pct}%</span>}
                            />
                          </Card>

                          {/* Breakdown by engagement */}
                          <Card style={{ borderRadius: 8, marginBottom: 16 }} bodyStyle={{ padding: '16px 20px' }}>
                            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 16 }}>Breakdown by Engagement</Text>
                            <Space direction="vertical" style={{ width: '100%' }} size={12}>
                              {engagementBreakdown.map(([eng, count]) => {
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                const isBench = eng === 'Bench';
                                return (
                                  <div key={eng}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <Space size={6}>
                                        {isBench
                                          ? <Tag color="warning" style={{ fontSize: '10px', margin: 0 }}>Bench</Tag>
                                          : <Text style={{ fontSize: '12px' }}>{eng}</Text>
                                        }
                                      </Space>
                                      <Text style={{ fontSize: '12px', color: '#666' }}>{count} ({pct}%)</Text>
                                    </div>
                                    <Progress
                                      percent={pct}
                                      size="small"
                                      strokeColor={isBench ? '#faad14' : '#1890ff'}
                                      showInfo={false}
                                      style={{ margin: 0 }}
                                    />
                                  </div>
                                );
                              })}
                            </Space>
                          </Card>

                          {/* Role-wise breakdown with navigation */}
                          <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: '16px 20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                              <Space size={8}>
                                <Text strong style={{ fontSize: '13px' }}>Bench Resources by Role/Domain</Text>
                                <Tag color="warning" style={{ fontSize: '10px' }}>{roleBreakdown.reduce((s, [, c]) => s + c, 0)} on bench</Tag>
                              </Space>
                              <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>Click a role to view filtered resources</Text>
                            </div>
                            {roleBreakdown.length === 0 ? (
                              <Text style={{ fontSize: '12px', color: '#aaa' }}>No bench resources</Text>
                            ) : (
                            <Space direction="vertical" style={{ width: '100%' }} size={10}>
                              {roleBreakdown.map(([role, count], i) => {
                                const benchTotal = roleBreakdown.reduce((s, [, c]) => s + c, 0);
                                const pct = benchTotal > 0 ? Math.round((count / benchTotal) * 100) : 0;
                                const COLORS = ['#faad14', '#f5222d', '#eb2f96', '#722ed1', '#1890ff', '#13c2c2', '#52c41a', '#fa8c16'];
                                const color = COLORS[i % COLORS.length];
                                return (
                                  <div key={role}
                                    onClick={() => {
                                      setMainTab('bench');
                                      setUnifiedFilters({ ...DEFAULT_UNIFIED_FILTERS, roleOrDomain: role });
                                    }}
                                    style={{ cursor: 'pointer', borderRadius: 6, padding: '4px 6px', transition: 'background 0.15s' }}
                                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fffbe6'; }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <Text style={{ fontSize: '12px', color: '#d48806' }}>{role}</Text>
                                      <Text style={{ fontSize: '12px', color: '#666' }}>{count} ({pct}%)</Text>
                                    </div>
                                    <Progress percent={pct} size="small" strokeColor={color} showInfo={false} style={{ margin: 0 }} />
                                  </div>
                                );
                              })}
                            </Space>
                            )}
                          </Card>
                        </>
                      )}
                      </div>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Space>
      </div>

      <Drawer
        title={
          pendingAllocResources.length === 1
            ? <span>Allocate Resource  -  {pendingAllocResources[0]?.empName}</span>
            : <span>Bulk Allocate  -  {pendingAllocResources.length} Resources</span>
        }
        placement="right"
        onClose={() => { setAllocationDrawer(false); setAllocationForm({ clientName: '', engagementName: '', notes: '' }); setPendingAllocResources([]); }}
        open={allocationDrawer}
        width={420}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {pendingAllocResources.length === 1 ? (
            <div style={{ background: '#f0f5ff', borderRadius: 8, padding: '10px 14px', border: '1px solid #adc6ff' }}>
              <div style={{ fontSize: '12px', fontWeight: 600 }}>{pendingAllocResources[0].empName}</div>
              <div style={{ fontSize: '11px', color: '#666' }}>{pendingAllocResources[0].raId}  |  {pendingAllocResources[0].roleOrDomain || pendingAllocResources[0].piwRole}</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: 2 }}>Current: {pendingAllocResources[0].engagement || ' - '}</div>
            </div>
          ) : (
            <div style={{ background: '#f0f5ff', borderRadius: 8, padding: '10px 14px', border: '1px solid #adc6ff', maxHeight: 140, overflowY: 'auto' }}>
              <div style={{ fontSize: '12px', fontWeight: 600, marginBottom: 6 }}>Allocating {pendingAllocResources.length} resources:</div>
              {pendingAllocResources.map(r => (
                <div key={r.sno} style={{ fontSize: '11px', color: '#444', padding: '2px 0', borderBottom: '1px solid #e6eeff' }}>
                  {r.empName} <span style={{ color: '#999', marginLeft: 4 }}>{r.raId}</span>
                </div>
              ))}
            </div>
          )}

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Engagement / Project Name *</label>
            <Input
              placeholder="Enter engagement or project name"
              value={allocationForm.engagementName}
              onChange={(e) => setAllocationForm({ ...allocationForm, engagementName: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Client Name</label>
            <Input
              placeholder="Enter client name (optional)"
              value={allocationForm.clientName}
              onChange={(e) => setAllocationForm({ ...allocationForm, clientName: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
            <Input.TextArea
              placeholder="Add notes"
              value={allocationForm.notes}
              onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
              rows={2}
            />
          </div>

          <div style={{ background: '#e6fffb', borderRadius: 6, padding: '8px 12px', border: '1px solid #87e8de' }}>
            <div style={{ fontSize: '11px', color: '#006d75' }}><strong>Initial Status:</strong> {pendingTargetStatus}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>
              Workflow: {allocStages.map(s => s.label).join('  ->  ')}
            </div>
          </div>

          <Space style={{ width: '100%' }} size="small">
            <Button type="primary" loading={savingAllocation} onClick={handleSaveAllocation} style={{ flex: 1 }}>{pendingTargetStatus === 'Offered' ? 'Move to Offered' : 'Shortlist'}</Button>
            <Button onClick={() => { setAllocationDrawer(false); setAllocationForm({ clientName: '', engagementName: '', notes: '' }); }} style={{ flex: 1 }}>Cancel</Button>
          </Space>
        </Space>
      </Drawer>

      {selectedDetailResource && (
        <Drawer
          title="Resource Details"
          placement="right"
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedDetailResource(null);
          }}
          open={detailsModalOpen}
          width={500}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>Employee Name</div>
              <div style={{ fontSize: '16px', fontWeight: 700 }}>{selectedDetailResource.empName}</div>
            </div>

            <div>
              <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>RAID ID</div>
              <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.raId}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>PIW Role</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.piwRole || ' - '}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>Domain</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.roleOrDomain || ' - '}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>Total Experience</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.totalWorkex || ' - '} years</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>Status</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                  <Tag color={selectedDetailResource.engagement === 'Bench' ? 'warning' : 'blue'}>{selectedDetailResource.engagement || 'Bench'}</Tag>
                </div>
              </div>
            </div>

            {selectedDetailResource.skills && (
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 8 }}>Skills</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {selectedDetailResource.skills.split(',').map((skill, idx) => (
                    <Tag key={idx} color="default">{skill.trim()}</Tag>
                  ))}
                </div>
              </div>
            )}

            <Button
              type="primary"
              block
              size="large"
              onClick={() => {
                handleAllocateResource(selectedDetailResource);
                setDetailsModalOpen(false);
                setSelectedDetailResource(null);
              }}
            >
              Allocate This Resource
            </Button>
          </Space>
        </Drawer>
      )}
    </div>
  );
}
