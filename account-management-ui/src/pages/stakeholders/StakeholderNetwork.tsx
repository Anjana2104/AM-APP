/**
 * StakeholderNetwork.tsx
 *
 * Stakeholder Network — client/internal stakeholder hierarchy management.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Dropdown,
  Form,
  Input,
  Modal,
  Popconfirm,
  Popover,
  Row,
  Select,
  Segmented,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
  Typography,
  Col,
  message,
} from 'antd';
import {
  ExpandAltOutlined,
  CaretLeftOutlined,
  DeleteOutlined,
  ExportOutlined,
  DownloadOutlined,
  EditOutlined,
  FilterOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
  InfoCircleOutlined,
  MailOutlined,
  PhoneOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  TeamOutlined,
  UploadOutlined,
  UserOutlined,
  ZoomInOutlined,
  ZoomOutOutlined,
} from '@ant-design/icons';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { useAuth } from '../../context/AuthContext';
import * as stakeholderNetworkApi from '../../api/stakeholderNetworkApi';
import * as resourceApi from '../../api/resourceApi';
import { writeJsonSheetFile } from '../../utils/xlsxExport';
import { mapResourceApiRowToPayload } from '../resource/resourceRowMappers';
import '../../style.css';
import {
  buildUploadedRowsMerged,
  computeTreeLayoutPositions,
  DEPT_COLORS,
  initials,
  parseTeamTypeValue,
  relationshipStyle,
  searchableStakeholderText,
  toTeamTypeLabel,
  withSortOrder,
  type RelationshipStrength,
  type Stakeholder,
  type StakeholderFilters,
  type TeamType,
} from './stakeholderNetworkUtils';
import { StakeholderFilterPanel, TeamTypeQuickTags } from './StakeholderFilterPanel';
import StakeholderCommentsPanel from './StakeholderCommentsPanel';

const { Text } = Typography;
function StakeholderNetworkSection() {
  const title = 'Stakeholder Network';
  const emptyText = 'No stakeholders yet. Upload or add the first stakeholder.';
  const addButtonLabel = 'Add Stakeholder';
  const templateFileName = 'Stakeholder_Network_Template.xlsx';
  const templateSample = [
    {
      'Team Type': 'Client',
      Name: 'Jane Doe',
      'Title / Role': 'VP Engineering',
      Department: 'Engineering',
      'Reporting Manager Name': '',
      Email: 'jane.doe@client.com',
      'Phone Number': '+1 555 0123',
      Responsibility: 'Overall tech strategy',
    },
    {
      'Team Type': 'Internal Team',
      Name: 'Priya Sharma',
      'Title / Role': 'Account Manager',
      Department: 'Management',
      'Reporting Manager Name': '',
      Email: 'priya@ra.com',
      'Phone Number': '+91 9876543210',
      Responsibility: 'Account oversight',
    },
  ];
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(15);
  const [viewMode, setViewMode] = useState<'diagram' | 'table'>('diagram');
  const [searchText, setSearchText] = useState('');
  const [filtersPanelOpen, setFiltersPanelOpen] = useState(false);
  const [filters, setFilters] = useState<StakeholderFilters>({
    teamTypes: ['client'],
    name: '',
    title: '',
    department: '',
    reportingTo: '',
    responsibility: '',
  });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [detailsPanelClosed, setDetailsPanelClosed] = useState(false);
  const [centerManagerId, setCenterManagerId] = useState<string | null>(null);
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [zoomScale, setZoomScale] = useState(0.7);
  const [diagramModalOpen, setDiagramModalOpen] = useState(false);
  const [detailPanelExpandedOpen, setDetailPanelExpandedOpen] = useState(false);
  const [resourceOptions, setResourceOptions] = useState<Array<{ value: number; label: string }>>([]);
  const [form] = Form.useForm();
  const networkPanelsHeight = '100%';
  const { currentUser, hasPermission } = useAuth();
  const canEdit = hasPermission('information_teamhierarchy', 'edit');
  const canDelete = hasPermission('information_teamhierarchy', 'delete');
  const changedBy = currentUser?.username || 'system';
  const diagramRef = useRef<HTMLDivElement | null>(null);
  const diagramCanvasRef = useRef<HTMLDivElement | null>(null);
  const expandedDiagramCanvasRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const stakeholderById = useMemo(() => {
    const map: Record<string, Stakeholder> = {};
    stakeholders.forEach(row => {
      map[row.id] = row;
    });
    return map;
  }, [stakeholders]);
  const normalizedSearch = useMemo(() => searchText.trim().toLowerCase(), [searchText]);
  const normalizeFilterText = (value: string) => value.trim().toLowerCase();
  const buildDistinctOptions = (values: Array<string | null | undefined>) => {
    const seen = new Set<string>();
    const options: Array<{ label: string; value: string }> = [];
    values.forEach(raw => {
      const value = String(raw || '').trim();
      if (!value) return;
      const key = value.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      options.push({ label: value, value });
    });
    return options.sort((a, b) => a.label.localeCompare(b.label));
  };
  const teamScopedStakeholders = useMemo(
    () => (filters.teamTypes.length ? stakeholders.filter(row => filters.teamTypes.includes(row.teamType)) : stakeholders),
    [stakeholders, filters.teamTypes]
  );
  const nameOptions = useMemo(() => buildDistinctOptions(teamScopedStakeholders.map(row => row.name)), [teamScopedStakeholders]);
  const titleOptions = useMemo(() => buildDistinctOptions(teamScopedStakeholders.map(row => row.title)), [teamScopedStakeholders]);
  const departmentOptions = useMemo(
    () => buildDistinctOptions(teamScopedStakeholders.map(row => row.department)),
    [teamScopedStakeholders]
  );
  const responsibilityOptions = useMemo(
    () => buildDistinctOptions(teamScopedStakeholders.map(row => row.responsibility)),
    [teamScopedStakeholders]
  );
  const quickTeamTypeFilters = useMemo(
    () => ([
      { teamType: 'client' as TeamType, label: 'Client', count: stakeholders.filter(row => row.teamType === 'client').length },
      { teamType: 'ra' as TeamType, label: 'Internal Team', count: stakeholders.filter(row => row.teamType === 'ra').length },
    ].filter(tag => tag.count > 0)),
    [stakeholders]
  );
  const managerOptions = useMemo(
    () => [
      { label: '— Top level (no manager)', value: '__top__' },
      ...[...teamScopedStakeholders]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(row => ({ label: `${row.name} (${toTeamTypeLabel(row.teamType)})`, value: row.id })),
    ],
    [teamScopedStakeholders]
  );
  const fieldFilteredStakeholders = useMemo(() => {
    const nameFilter = normalizeFilterText(filters.name);
    const titleFilter = normalizeFilterText(filters.title);
    const departmentFilter = normalizeFilterText(filters.department);
    const responsibilityFilter = normalizeFilterText(filters.responsibility);
    return stakeholders.filter(row => {
      if (filters.teamTypes.length && !filters.teamTypes.includes(row.teamType)) return false;
      if (nameFilter && normalizeFilterText(String(row.name || '')) !== nameFilter) return false;
      if (titleFilter && normalizeFilterText(String(row.title || '')) !== titleFilter) return false;
      if (departmentFilter && normalizeFilterText(String(row.department || '')) !== departmentFilter) return false;
      if (filters.reportingTo === '__top__' && row.reportingTo) return false;
      if (filters.reportingTo && filters.reportingTo !== '__top__' && String(row.reportingTo || '') !== filters.reportingTo) return false;
      if (responsibilityFilter && normalizeFilterText(String(row.responsibility || '')) !== responsibilityFilter) return false;
      return true;
    });
  }, [stakeholders, filters]);
  const filteredStakeholders = useMemo(() => {
    if (!normalizedSearch) return fieldFilteredStakeholders;
    return fieldFilteredStakeholders.filter(row => searchableStakeholderText(row).includes(normalizedSearch));
  }, [fieldFilteredStakeholders, normalizedSearch]);
  const selectedTeamTypeForSeeding = filters.teamTypes.length === 1 ? filters.teamTypes[0] : null;
  const headNodesOfSelectedType = useMemo(() => {
    if (!selectedTeamTypeForSeeding) return [] as Stakeholder[];
    const typeRows = stakeholders.filter(row => row.teamType === selectedTeamTypeForSeeding);
    return typeRows.filter(row => !row.reportingTo);
  }, [selectedTeamTypeForSeeding, stakeholders]);
  const selectedStakeholder = useMemo(
    () => stakeholders.find(row => row.id === selectedNodeId) || null,
    [stakeholders, selectedNodeId]
  );
  const displayedStakeholders = useMemo(() => filteredStakeholders, [filteredStakeholders]);
  const visibleStakeholders = useMemo(() => {
    const sourceRows = fieldFilteredStakeholders;
    if (!normalizedSearch) {
      const byId: Record<string, Stakeholder> = {};
      sourceRows.forEach(row => {
        byId[row.id] = row;
      });
      const rootsForTraversal = sourceRows.filter(row => !row.reportingTo || !byId[row.reportingTo]);
      const childrenByParent: Record<string, Stakeholder[]> = {};
      sourceRows.forEach(row => {
        const key = row.reportingTo || '__root__';
        if (!childrenByParent[key]) childrenByParent[key] = [];
        childrenByParent[key].push(row);
      });
      const visited = new Set<string>();
      const ordered: Stakeholder[] = [];
      const walk = (node: Stakeholder) => {
        if (visited.has(node.id)) return;
        visited.add(node.id);
        ordered.push(node);
        (childrenByParent[node.id] || []).forEach(walk);
      };
      rootsForTraversal.forEach(walk);
      sourceRows.forEach(row => {
        if (!visited.has(row.id)) ordered.push(row);
      });
      return ordered;
    }

    const byId: Record<string, Stakeholder> = {};
    sourceRows.forEach(row => {
      byId[row.id] = row;
    });
    const reportsByManager: Record<string, Stakeholder[]> = {};
    sourceRows.forEach(row => {
      if (!row.reportingTo) return;
      if (!reportsByManager[row.reportingTo]) reportsByManager[row.reportingTo] = [];
      reportsByManager[row.reportingTo].push(row);
    });

    const matched = sourceRows.filter(row => searchableStakeholderText(row).includes(normalizedSearch));
    if (!matched.length) return [];

    const includedIds = new Set<string>();
    const includeAncestors = (id: string) => {
      let cursor = byId[id];
      let guard = 0;
      while (cursor && guard < 200) {
        includedIds.add(cursor.id);
        if (!cursor.reportingTo || !byId[cursor.reportingTo]) break;
        cursor = byId[cursor.reportingTo];
        guard += 1;
      }
    };
    const includeDescendants = (id: string, path = new Set<string>()) => {
      if (path.has(id)) return;
      const nextPath = new Set(path);
      nextPath.add(id);
      (reportsByManager[id] || []).forEach(child => {
        includedIds.add(child.id);
        includeDescendants(child.id, nextPath);
      });
    };
    matched.forEach(row => {
      includedIds.add(row.id);
      includeAncestors(row.id);
      includeDescendants(row.id);
    });

    const scopedRows = sourceRows.filter(row => includedIds.has(row.id));
    const scopedById: Record<string, Stakeholder> = {};
    scopedRows.forEach(row => {
      scopedById[row.id] = row;
    });
    const rootsForTraversal = scopedRows.filter(row => !row.reportingTo || !scopedById[row.reportingTo]);
    const childrenByParent: Record<string, Stakeholder[]> = {};
    scopedRows.forEach(row => {
      const key = row.reportingTo || '__root__';
      if (!childrenByParent[key]) childrenByParent[key] = [];
      childrenByParent[key].push(row);
    });
    const visited = new Set<string>();
    const ordered: Stakeholder[] = [];
    const walk = (node: Stakeholder) => {
      if (visited.has(node.id)) return;
      visited.add(node.id);
      ordered.push(node);
      (childrenByParent[node.id] || []).forEach(walk);
    };
    rootsForTraversal.forEach(walk);
    scopedRows.forEach(row => {
      if (!visited.has(row.id)) ordered.push(row);
    });
    return ordered;
  }, [fieldFilteredStakeholders, normalizedSearch]);
  const directReportCountById = useMemo(() => {
    const counts: Record<string, number> = {};
    visibleStakeholders.forEach(row => {
      if (!row.reportingTo) return;
      counts[row.reportingTo] = (counts[row.reportingTo] || 0) + 1;
    });
    return counts;
  }, [visibleStakeholders]);
  const visibleById = useMemo(() => {
    const map: Record<string, Stakeholder> = {};
    visibleStakeholders.forEach(row => {
      map[row.id] = row;
    });
    return map;
  }, [visibleStakeholders]);
  const reportsByManagerId = useMemo(() => {
    const map: Record<string, Stakeholder[]> = {};
    visibleStakeholders.forEach(row => {
      if (!row.reportingTo) return;
      if (!map[row.reportingTo]) map[row.reportingTo] = [];
      map[row.reportingTo].push(row);
    });
    return map;
  }, [visibleStakeholders]);
  const managerNodeIds = useMemo(
    () => new Set(Object.keys(directReportCountById).filter(id => directReportCountById[id] > 0)),
    [directReportCountById]
  );
  const centerStakeholder = useMemo(() => {
    if (!visibleStakeholders.length) return null;
    const currentCenter = centerManagerId ? visibleById[centerManagerId] : undefined;
    if (currentCenter && managerNodeIds.has(currentCenter.id)) return currentCenter;
    const firstManager = visibleStakeholders.find(row => managerNodeIds.has(row.id));
    return firstManager || visibleStakeholders[0];
  }, [centerManagerId, visibleStakeholders, managerNodeIds, visibleById]);
  const detailStakeholder = useMemo(() => {
    if (detailsPanelClosed) return null;
    if (selectedStakeholder && visibleStakeholders.some(row => row.id === selectedStakeholder.id)) return selectedStakeholder;
    return centerStakeholder;
  }, [selectedStakeholder, visibleStakeholders, centerStakeholder, detailsPanelClosed]);
  useEffect(() => {
    if (centerStakeholder && centerManagerId !== centerStakeholder.id) {
      setCenterManagerId(centerStakeholder.id);
    }
    if (!centerStakeholder && centerManagerId) {
      setCenterManagerId(null);
    }
  }, [centerStakeholder, centerManagerId]);
  const connectedIdsFor = (id: string): string[] => {
    const ids: string[] = [];
    const node = visibleById[id];
    if (!node) return ids;
    if (node.reportingTo && visibleById[node.reportingTo]) ids.push(node.reportingTo);
    (reportsByManagerId[id] || []).forEach(child => ids.push(child.id));
    return ids;
  };
  const descendantIdsFor = (id: string): string[] => {
    const ids: string[] = [];
    const walk = (parentId: string) => {
      (reportsByManagerId[parentId] || []).forEach(child => {
        ids.push(child.id);
        walk(child.id);
      });
    };
    walk(id);
    return ids;
  };
  useEffect(() => {
    if (!centerStakeholder) {
      setExpandedNodeIds(new Set());
      return;
    }
    if (normalizedSearch && visibleStakeholders.length) {
      setExpandedNodeIds(new Set(visibleStakeholders.map(row => row.id)));
      return;
    }
    const heads = headNodesOfSelectedType
      .map(node => node.id)
      .filter(id => visibleById[id]);
    const fallbackRoots = visibleStakeholders.filter(row => !row.reportingTo || !visibleById[row.reportingTo]).map(row => row.id);
    const seedIds = Array.from(new Set((heads.length ? heads : fallbackRoots).filter(Boolean)));
    setExpandedNodeIds(new Set(seedIds.length ? seedIds : [centerStakeholder.id]));
  }, [centerStakeholder, headNodesOfSelectedType, visibleById, visibleStakeholders, normalizedSearch]);
  useEffect(() => {
    if (!normalizedSearch || !filteredStakeholders.length) return;
    setSelectedNodeId(filteredStakeholders[0].id);
  }, [normalizedSearch, filteredStakeholders]);
  useEffect(() => {
    const heads = headNodesOfSelectedType.map(node => node.id).filter(id => visibleById[id]);
    setNodePositions(computeTreeLayoutPositions(expandedNodeIds, visibleById, reportsByManagerId, heads));
  }, [expandedNodeIds, visibleById, reportsByManagerId, headNodesOfSelectedType]);
  const graphNodes = useMemo(() => {
    const palette = [
      { color: '#1677ff', bg: '#e6f4ff' },
      { color: '#52c41a', bg: '#f6ffed' },
      { color: '#eb2f96', bg: '#fff0f6' },
      { color: '#13c2c2', bg: '#e6fffb' },
      { color: '#2f54eb', bg: '#f0f5ff' },
      { color: '#fa8c16', bg: '#fff7e6' },
      { color: '#722ed1', bg: '#f9f0ff' },
      { color: '#389e0d', bg: '#f6ffed' },
    ];
    return Array.from(expandedNodeIds)
      .map((id, idx) => {
        const node = visibleById[id];
        const pos = nodePositions[id];
        if (!node || !pos) return null;
        return { node, x: pos.x, y: pos.y, tone: palette[idx % palette.length] };
      })
      .filter(Boolean) as Array<{ node: Stakeholder; x: number; y: number; tone: { color: string; bg: string } }>;
  }, [expandedNodeIds, visibleById, nodePositions]);
  const graphEdges = useMemo(() => {
    const edges: Array<{ from: string; to: string; strength: RelationshipStrength }> = [];
    const ids = new Set(expandedNodeIds);
    Array.from(ids).forEach(id => {
      const node = visibleById[id];
      if (!node) return;
      if (node.reportingTo && ids.has(node.reportingTo)) {
        edges.push({ from: node.reportingTo, to: node.id, strength: 'strong' });
      }
    });
    return edges;
  }, [expandedNodeIds, visibleById]);
  const graphBounds = useMemo(() => {
    const points = Object.values(nodePositions);
    if (!points.length) {
      return { minX: 0, minY: 0, width: 760, height: 430 };
    }
    const padX = 130;
    const padY = 95;
    const minX = Math.min(...points.map(p => p.x)) - padX;
    const maxX = Math.max(...points.map(p => p.x)) + padX;
    const minY = Math.min(...points.map(p => p.y)) - padY;
    const maxY = Math.max(...points.map(p => p.y)) + padY;
    return {
      minX,
      minY,
      width: Math.max(760, maxX - minX),
      height: Math.max(430, maxY - minY),
    };
  }, [nodePositions]);
  const detailRelations = useMemo(() => {
    if (!detailStakeholder) return [] as Stakeholder[];
    const rows = visibleStakeholders;
    const manager = detailStakeholder.reportingTo ? rows.find(row => row.id === detailStakeholder.reportingTo) : undefined;
    const reports = rows.filter(row => row.reportingTo === detailStakeholder.id);
    return [manager, ...reports].filter(Boolean) as Stakeholder[];
  }, [detailStakeholder, visibleStakeholders]);
  const loadRows = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [clientRes, internalRes] = await Promise.all([
        stakeholderNetworkApi.getStakeholderNetworkRecords('client'),
        stakeholderNetworkApi.getStakeholderNetworkRecords('ra'),
      ]);
      const normalized = [
        ...withSortOrder(clientRes.stakeholders || [], 'client'),
        ...withSortOrder(internalRes.stakeholders || [], 'ra'),
      ];
      setStakeholders(normalized);
      if (!selectedNodeId || !normalized.some(row => row.id === selectedNodeId)) {
        setSelectedNodeId(normalized[0]?.id || null);
      }
    } catch (err: any) {
      console.error('[StakeholderNetwork] Failed to load stakeholders', err);
      setLoadError(err?.message || `Failed to load ${title} hierarchy`);
      setStakeholders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  useEffect(() => {
    const loadResourceOptions = async () => {
      try {
        const response = await resourceApi.getResources();
        const options = (response.resources || []).map(mapResourceApiRowToPayload)
          .filter(row => Number.isFinite(Number(row.id)))
          .map(row => ({
            value: Number(row.id),
            label: `${row.raId} - ${row.empName}`,
          }))
          .sort((a, b) => a.label.localeCompare(b.label));
        setResourceOptions(options);
      } catch (error) {
        console.error('[StakeholderNetwork] Failed to load resource options for escalation linking', error);
        setResourceOptions([]);
      }
    };
    loadResourceOptions();
  }, []);

  const persistRows = async (nextRows: Stakeholder[], successMessage: string) => {
    setSaving(true);
    try {
      const clientRows = withSortOrder(nextRows.filter(row => row.teamType === 'client'), 'client');
      const internalRows = withSortOrder(nextRows.filter(row => row.teamType === 'ra'), 'ra');
      await Promise.all([
        stakeholderNetworkApi.bulkSaveStakeholderNetworkRecords('client', clientRows, changedBy),
        stakeholderNetworkApi.bulkSaveStakeholderNetworkRecords('ra', internalRows, changedBy),
      ]);
      const payload = [...clientRows, ...internalRows];
      setStakeholders(payload);
      if (!selectedNodeId || !payload.some(row => row.id === selectedNodeId)) {
        setSelectedNodeId(payload[0]?.id || null);
      }
      message.success(successMessage);
      return true;
    } catch (err: any) {
      console.error('[StakeholderNetwork] Failed to persist stakeholders', { error: err, changedBy });
      message.error(err?.message || `Failed to save ${title} hierarchy`);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    writeJsonSheetFile(
      XLSX as any,
      templateSample,
      `${title} Team`,
      templateFileName,
      {
        header: ['Team Type', 'Name', 'Title / Role', 'Department', 'Reporting Manager Name', 'Email', 'Phone Number', 'Responsibility'],
        columnWidths: [16, 24, 24, 18, 26, 30, 18, 32],
      }
    );
  };

  const handleExportData = () => {
    try {
      const rows = stakeholders.map((row, index) => ({
        'S.No.': index + 1,
        'Team Type': toTeamTypeLabel(row.teamType),
        Name: row.name,
        'Title / Role': row.title,
        Department: row.department,
        'Reporting Team Type': toTeamTypeLabel(stakeholders.find(s => s.id === row.reportingTo)?.teamType || row.teamType),
        'Reporting Manager Name': stakeholders.find(s => s.id === row.reportingTo)?.name || '',
        Email: row.email,
        'Phone Number': row.phone || '',
        Responsibility: row.responsibility,
      }));
      writeJsonSheetFile(
        XLSX as any,
        rows,
        `${title} Hierarchy`,
        `${title.replace(/\s+/g, '_')}_Hierarchy_Data.xlsx`,
        {
          header: ['S.No.', 'Team Type', 'Name', 'Title / Role', 'Department', 'Reporting Team Type', 'Reporting Manager Name', 'Email', 'Phone Number', 'Responsibility'],
          columnWidths: [8, 14, 24, 24, 18, 18, 26, 30, 18, 32],
        }
      );
      message.success('Hierarchy data exported');
    } catch (err: any) {
      console.error('[StakeholderNetwork] Failed to export stakeholder data', err);
      message.error(err?.message || 'Failed to export hierarchy data');
    }
  };

  const handleExportDiagram = async (useExpanded = false) => {
    const target = useExpanded ? expandedDiagramCanvasRef.current : diagramCanvasRef.current;
    if (!target) {
      message.error('Diagram is not available for export');
      return;
    }
    try {
      const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: 2, useCORS: true });
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `${title.replace(/\s+/g, '_')}.png`;
      link.click();
      message.success(`${title} exported`);
    } catch (err: any) {
      console.error('[StakeholderNetwork] Failed to export stakeholder diagram', err);
      message.error(err?.message || `Failed to export ${title}`);
    }
  };

  const zoomIn = () => setZoomScale(prev => Math.min(1.8, Number((prev + 0.1).toFixed(2))));
  const zoomOut = () => setZoomScale(prev => Math.max(0.7, Number((prev - 0.1).toFixed(2))));
  const zoomReset = () => setZoomScale(0.7);
  const expandAllNodes = () => {
    if (!visibleStakeholders.length) {
      message.info('No stakeholders available to expand');
      return;
    }
    setExpandedNodeIds(new Set(visibleStakeholders.map(row => row.id)));
    if (!selectedNodeId) {
      setSelectedNodeId(visibleStakeholders[0].id);
    }
  };
  const openDetailsPanel = () => {
    setDetailsPanelClosed(false);
    if (!selectedNodeId && visibleStakeholders.length) {
      setSelectedNodeId(visibleStakeholders[0].id);
    }
  };
  const handleNodeClick = (id: string) => {
    setSelectedNodeId(id);
    if (managerNodeIds.has(id)) {
      const descendants = descendantIdsFor(id);
      const hasVisibleDescendants = descendants.some(descId => expandedNodeIds.has(descId));
      if (hasVisibleDescendants) {
        setExpandedNodeIds(prev => {
          const next = new Set(prev);
          descendants.forEach(descId => next.delete(descId));
          return next;
        });
        return;
      }
    }
    const existing = new Set(expandedNodeIds);
    const neighborIds = connectedIdsFor(id);
    const newNodeIds = neighborIds.filter(nextId => !existing.has(nextId));
    if (!newNodeIds.length) return;
    setExpandedNodeIds(prev => {
      const next = new Set(prev);
      next.add(id);
      newNodeIds.forEach(newId => next.add(newId));
      return next;
    });
  };
  const clearFilters = () => {
    setFilters({
      teamTypes: ['client'],
      name: '',
      title: '',
      department: '',
      reportingTo: '',
      responsibility: '',
    });
  };
  const toggleQuickTeamTypeFilter = (teamType: TeamType) => {
    setFilters(prev => {
      const isActive = prev.teamTypes.length === 1 && prev.teamTypes[0] === teamType;
      return { ...prev, teamTypes: isActive ? [] : [teamType] };
    });
  };
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (normalizeFilterText(filters.name)) count += 1;
    if (normalizeFilterText(filters.title)) count += 1;
    if (normalizeFilterText(filters.department)) count += 1;
    if (filters.reportingTo) count += 1;
    if (normalizeFilterText(filters.responsibility)) count += 1;
    return count;
  }, [filters]);

  const handleUpload = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) {
        message.error('No sheet found in uploaded file');
        return false;
      }

      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!rows.length) {
        message.warning('Uploaded sheet is empty');
        return false;
      }

      const uploaded = buildUploadedRowsMerged(rows, stakeholders);
      if (!uploaded.length) {
        message.warning('No valid stakeholder rows found in uploaded file');
        return false;
      }

      await persistRows([...stakeholders, ...uploaded], `${uploaded.length} row(s) uploaded and saved`);
    } catch (err: any) {
      console.error('[StakeholderNetwork] Failed to process stakeholder upload', err);
      message.error(err?.message || 'Failed to process uploaded file');
    }
    return false;
  };

  const handleUploadInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await handleUpload(file);
    event.target.value = '';
  };

  const openUploadPicker = () => {
    if (!canEdit) {
      message.warning('You do not have permission to upload');
      return;
    }
    uploadInputRef.current?.click();
  };

  const handleDeleteAll = () => {
    if (!canDelete) {
      message.warning('You do not have permission to delete');
      return;
    }
    Modal.confirm({
      title: 'Delete all hierarchy records?',
      content: 'This will remove all stakeholders in this view.',
      okText: 'Delete All',
      okButtonProps: { danger: true, size: 'small' },
      cancelButtonProps: { size: 'small' },
      onOk: async () => {
        const ok = await persistRows([], 'All stakeholders deleted');
        if (ok) {
          setSelectedNodeId(null);
        }
      },
    });
  };

  const moreActionsItems = [
    ...(canEdit ? [{ key: 'add', icon: <PlusOutlined />, label: <span style={{ fontSize: '11px' }}>Add New</span> }] : []),
    ...(canEdit ? [{ key: 'upload', icon: <UploadOutlined />, label: <span style={{ fontSize: '11px' }}>Upload</span> }] : []),
    { key: 'download_template', icon: <DownloadOutlined />, label: <span style={{ fontSize: '11px' }}>Download Template</span> },
    ...(canDelete
      ? [{
        key: 'delete_all',
        icon: <DeleteOutlined />,
        label: <span style={{ fontSize: '11px', color: '#cf1322' }}>Delete All</span>,
      }]
      : []),
  ];

  const handleMoreActionsClick = (key: string) => {
    if (key === 'add') {
      handleAdd();
      return;
    }
    if (key === 'upload') {
      openUploadPicker();
      return;
    }
    if (key === 'download_template') {
      handleDownloadTemplate();
      return;
    }
    if (key === 'delete_all') {
      handleDeleteAll();
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({ teamType: 'client' });
    setModalOpen(true);
  };

  const handleEdit = (record: Stakeholder) => {
    setEditingId(record.id);
    form.setFieldsValue({ ...record, reportingTo: record.reportingTo || undefined });
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    const next = stakeholders
      .filter(row => row.id !== id)
      .map(row => (row.reportingTo === id ? { ...row, reportingTo: null } : row));
    await persistRows(next, 'Stakeholder deleted and saved');
  };

  const handleSave = () => {
    form.validateFields().then(async values => {
      const nextTeamType = parseTeamTypeValue(values.teamType);
      const id = editingId || `${nextTeamType}_${Date.now()}`;
      const next = editingId
        ? stakeholders.map(row => row.id === editingId ? { ...row, ...values, teamType: nextTeamType, reportingTo: values.reportingTo || null } : row)
        : [...stakeholders, {
          id,
          teamType: nextTeamType,
          name: values.name,
          title: values.title,
          department: values.department,
          reportingTo: values.reportingTo || null,
          responsibility: values.responsibility || '',
          email: values.email || '',
          phone: values.phone || '',
          sortOrder: stakeholders.length,
        }];

      const ok = await persistRows(next, editingId ? 'Stakeholder updated and saved' : 'Stakeholder added and saved');
      if (ok) {
        setModalOpen(false);
        setEditingId(null);
        form.resetFields();
      }
    });
  };

  const hStyle = { fontSize: '11px', fontWeight: 700 as const };
  const tableColumns = [
    {
      title: 'S.No.',
      width: 55,
      render: (_: any, __: any, index: number) => ((tablePage - 1) * tablePageSize) + index + 1,
      onHeaderCell: () => ({ style: hStyle }),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => <span style={{ fontWeight: 600, fontSize: '11px' }}>{v}</span>,
    },
    {
      title: 'Team',
      dataIndex: 'teamType',
      key: 'teamType',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: TeamType) => (
        <Tag color={v === 'client' ? 'blue' : 'green'} style={{ fontSize: '10px' }}>
          {toTeamTypeLabel(v)}
        </Tag>
      ),
    },
    {
      title: 'Title / Role',
      dataIndex: 'title',
      key: 'title',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => <span style={{ fontSize: '11px' }}>{v}</span>,
    },
    {
      title: 'Department',
      dataIndex: 'department',
      key: 'department',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => <Tag color={DEPT_COLORS[v] || '#8c8c8c'} style={{ fontSize: '11px' }}>{v}</Tag>,
    },
    {
      title: 'Reports To',
      dataIndex: 'reportingTo',
      key: 'reportingTo',
      onHeaderCell: () => ({ style: hStyle }),
      render: (id: string | null) => {
        const mgr = stakeholders.find(row => row.id === id);
        return mgr
          ? <span style={{ fontSize: '11px', color: '#1890ff' }}>{mgr.name}</span>
          : <span style={{ fontSize: '11px', color: '#8c8c8c' }}>— (Top level)</span>;
      },
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span>,
    },
    {
      title: 'Responsibility',
      dataIndex: 'responsibility',
      key: 'responsibility',
      onHeaderCell: () => ({ style: hStyle }),
      render: (v: string) => <span style={{ fontSize: '11px', color: '#595959' }}>{v || '—'}</span>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      onHeaderCell: () => ({ style: hStyle }),
      render: (_: any, record: Stakeholder) => (
        <Space size={4}>
          {canEdit && (
            <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} style={{ borderRadius: 6 }} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm title="Remove this stakeholder?" onConfirm={() => handleDelete(record.id)} okText="Yes" cancelText="No">
              <Tooltip title="Delete" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DeleteOutlined />} size="small" danger style={{ borderRadius: 6 }} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];
  const filterPanelContent = (
    <StakeholderFilterPanel
      filters={filters}
      setFilters={setFilters}
      nameOptions={nameOptions}
      titleOptions={titleOptions}
      departmentOptions={departmentOptions}
      managerOptions={managerOptions}
      responsibilityOptions={responsibilityOptions}
      activeFilterCount={activeFilterCount}
      onClear={clearFilters}
    />
  );

  const renderNetworkCanvas = (canvasRef: React.RefObject<HTMLDivElement | null>) => {
    const scaledWidth = Math.max(760, Math.ceil(graphBounds.width * zoomScale));
    const scaledHeight = Math.max(430, Math.ceil(graphBounds.height * zoomScale));
    return (
    <div
      ref={canvasRef}
      style={{
        width: scaledWidth + 20,
        height: scaledHeight + 24,
        margin: '0 auto',
        padding: '8px 10px 16px',
        boxSizing: 'content-box',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: graphBounds.width,
          height: graphBounds.height,
          transform: `scale(${zoomScale})`,
          transformOrigin: 'top left',
        }}
      >
        <svg width={graphBounds.width} height={graphBounds.height} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          {graphEdges.map((edge, idx) => {
            const from = nodePositions[edge.from];
            const to = nodePositions[edge.to];
            if (!from || !to) return null;
            const style = relationshipStyle(edge.strength);
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const distance = Math.hypot(dx, dy) || 1;
            const fromOffset = 30;
            const toOffset = 30;
            const x1 = (from.x - graphBounds.minX) + ((dx / distance) * fromOffset);
            const y1 = (from.y - graphBounds.minY) + ((dy / distance) * fromOffset);
            const x2 = (to.x - graphBounds.minX) - ((dx / distance) * toOffset);
            const y2 = (to.y - graphBounds.minY) - ((dy / distance) * toOffset);
            return (
              <line
                key={`line_${edge.from}_${edge.to}_${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={style.stroke}
                strokeWidth={style.strokeWidth}
                strokeDasharray={style.strokeDasharray}
                strokeLinecap="round"
              />
            );
          })}
        </svg>

        {graphNodes.length ? (
          <>
            {graphNodes.map(rel => {
                const nodeColor = rel.tone?.color || '#1677ff';
                const nodeBg = rel.tone?.bg || '#e6f4ff';
                const isManagerNode = (directReportCountById[rel.node.id] || 0) > 0;
                const isHeadNode = !rel.node.reportingTo;
                const isSelected = detailStakeholder?.id === rel.node.id;
                const showDepartment = isHeadNode || isManagerNode;
              return (
                <div
                  key={`node_${rel.node.id}`}
                  style={{
                    position: 'absolute',
                    left: rel.x - graphBounds.minX,
                    top: rel.y - graphBounds.minY,
                    transform: 'translate(-50%, -50%)',
                    textAlign: 'center',
                    width: 190,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleNodeClick(rel.node.id)}
                    style={{
                      width: isSelected ? 54 : 48,
                      height: isSelected ? 54 : 48,
                      borderRadius: '50%',
                      border: isSelected
                        ? `3px solid ${nodeColor}`
                        : isManagerNode ? `3px solid ${nodeColor}` : `2px solid ${nodeColor}66`,
                      background: nodeBg,
                      color: nodeColor,
                      fontSize: isSelected ? '22px' : '20px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: isSelected
                        ? `0 0 0 3px ${nodeBg}`
                        : isManagerNode ? `0 0 0 2px ${nodeBg}` : 'none',
                      position: 'relative',
                    }}
                  >
                    {initials(rel.node.name).slice(0, 1)}
                    {isManagerNode && (
                      <span
                        style={{
                          position: 'absolute',
                          right: -3,
                          top: -3,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: nodeColor,
                          border: '2px solid #fff',
                        }}
                      />
                    )}
                  </button>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: '12px',
                      lineHeight: 1.25,
                      color: '#1f1f1f',
                      background: '#ffffff',
                      border: '1px solid #eef2f8',
                      borderRadius: 8,
                      padding: '4px 8px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    <div style={{ fontWeight: isSelected ? 800 : 700, overflowWrap: 'anywhere' }}>{rel.node.name}</div>
                    <div style={{ marginTop: 2, fontSize: '10px', color: '#6b778c', overflowWrap: 'anywhere' }}>{rel.node.title || 'Stakeholder'}</div>
                    {showDepartment && (
                      <div style={{ marginTop: 2, fontSize: '10px', color: '#2f54eb', fontWeight: 600, overflowWrap: 'anywhere' }}>
                        {rel.node.department || 'Other'}
                      </div>
                    )}
                  </div>
                </div>
              );
              })}
          </>
        ) : (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Text type="secondary" style={{ fontSize: '11px' }}>No stakeholder available for network rendering.</Text>
          </div>
        )}
      </div>
    </div>
  );
  };

  return (
    <div style={{ background: '#ffffff', borderRadius: 12, padding: '10px 12px', border: '1px solid #e6ebf2', height: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <input
        ref={uploadInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleUploadInputChange}
      />
      {!!loadError && (
        <Alert type="error" showIcon style={{ marginBottom: 12 }} message={<span style={{ fontSize: '11px' }}>{loadError}</span>} />
      )}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin />
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Segmented
                value={viewMode}
                onChange={value => setViewMode(value as 'diagram' | 'table')}
                options={[
                  { label: <span style={{ fontSize: '11px' }}>Network View</span>, value: 'diagram' },
                  { label: <span style={{ fontSize: '11px' }}>Directory View</span>, value: 'table' },
                ]}
                style={{ background: '#eef3ff', borderRadius: 8 }}
              />
              <Tooltip
                title={<span style={{ fontSize: '11px' }}>Search supports name, role, department, email, phone and auto-opens connected graph paths.</span>}
                overlayInnerStyle={{ fontSize: '11px', maxWidth: 320 }}
              >
                <InfoCircleOutlined style={{ color: '#91a0b5', fontSize: '13px' }} />
              </Tooltip>
            </div>
            <Space size={8} wrap>
              <Input
                size="middle"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                prefix={<SearchOutlined style={{ color: '#8c8c8c' }} />}
                placeholder="Search stakeholders..."
                style={{ width: 280, fontSize: '11px', borderRadius: 8 }}
              />
              <Dropdown
                menu={{ items: moreActionsItems, onClick: ({ key }) => handleMoreActionsClick(String(key)) }}
                trigger={['click']}
              >
                <Tooltip title="More Actions" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button size="middle" style={{ borderRadius: 8, fontSize: '16px', lineHeight: 1, width: 38, padding: 0 }}>⋮</Button>
                </Tooltip>
              </Dropdown>
            </Space>
          </div>

          {viewMode === 'table' ? (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 14 }}>
                <Tooltip title="Export" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<ExportOutlined />} size="small" onClick={handleExportData} style={{ borderRadius: 6 }} />
                </Tooltip>
              </div>

              {displayedStakeholders.length === 0 ? (
                <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
                  <TeamOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 10, display: 'block' }} />
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {stakeholders.length === 0 ? emptyText : 'No stakeholders match current filters or search.'}
                  </Text>
                </div>
              ) : (
                <div className="compact-table">
                  <Table
                    dataSource={displayedStakeholders}
                    columns={tableColumns}
                    rowKey="id"
                    size="small"
                    pagination={{
                      current: tablePage,
                      pageSize: tablePageSize,
                      showSizeChanger: false,
                      onChange: (page, pageSize) => {
                        setTablePage(page);
                        setTablePageSize(pageSize);
                      },
                    }}
                    scroll={{ x: 'max-content' }}
                    style={{ background: '#fff', borderRadius: 8 }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                <Row gutter={10} align="stretch" wrap={false} style={{ height: networkPanelsHeight }}>
                  <Col flex="auto" style={{ minWidth: 0 }}>
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                    <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', border: '1px solid #e6ebf2', borderRadius: 10, background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <TeamTypeQuickTags
                          filters={filters}
                          teamTypeTags={quickTeamTypeFilters}
                          onToggle={toggleQuickTeamTypeFilter}
                        />
                        <Popover
                          trigger="click"
                          placement="bottomLeft"
                          open={filtersPanelOpen}
                          onOpenChange={open => setFiltersPanelOpen(open)}
                          content={filterPanelContent}
                        >
                          <Button
                            size="small"
                            icon={<FilterOutlined />}
                            style={{ borderRadius: 10, fontSize: '11px', fontWeight: 600 }}
                          >
                            {activeFilterCount ? `Filters (${activeFilterCount})` : 'Filters'}
                          </Button>
                        </Popover>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Tooltip title="Zoom In" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button icon={<ZoomInOutlined />} size="small" onClick={zoomIn} style={{ borderRadius: 6 }} />
                        </Tooltip>
                        <Tooltip title="Zoom Out" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button icon={<ZoomOutOutlined />} size="small" onClick={zoomOut} style={{ borderRadius: 6 }} />
                        </Tooltip>
                        <Tooltip title="Expand Diagram" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button icon={<FullscreenOutlined />} size="small" onClick={() => setDiagramModalOpen(true)} style={{ borderRadius: 6 }} />
                        </Tooltip>
                        <Tooltip title="Reset View" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button
                            type="default"
                            icon={<ReloadOutlined />}
                            size="small"
                            onClick={zoomReset}
                            style={{ borderRadius: 6, color: '#2f54eb', fontSize: '11px', fontWeight: 600 }}
                          >
                            Reset View
                          </Button>
                        </Tooltip>
                        <Tooltip title="Expand all visible nodes" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button
                            type="default"
                            size="small"
                            onClick={expandAllNodes}
                            style={{ borderRadius: 6, fontSize: '11px' }}
                          >
                            Expand All
                          </Button>
                        </Tooltip>
                        <Tooltip title="Export" overlayInnerStyle={{ fontSize: '11px' }}>
                          <Button
                            icon={<ExportOutlined />}
                            size="small"
                            onClick={() => handleExportDiagram(false)}
                            style={{ borderRadius: 6 }}
                          />
                        </Tooltip>
                        {detailsPanelClosed && (
                          <Tooltip title="Open Selected Member panel" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button
                              type="default"
                              size="small"
                              icon={<CaretLeftOutlined />}
                              onClick={openDetailsPanel}
                              style={{ borderRadius: 6, fontSize: '11px' }}
                            >
                              Selected Member
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                    <Card
                      ref={diagramRef}
                      size="small"
                      bodyStyle={{ padding: 12, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                      style={{ flex: 1, minHeight: 0, height: 0, borderRadius: 10, borderColor: '#e6ebf2', display: 'flex', flexDirection: 'column' }}
                    >
                      <div
                        style={{
                          overflow: 'hidden',
                          border: 'none',
                          borderRadius: 10,
                          background: '#ffffff',
                          height: '100%',
                          minHeight: 0,
                          padding: '12px 10px',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>{renderNetworkCanvas(diagramCanvasRef)}</div>
                      </div>
                    </Card>
                    </div>
                  </Col>

                  {!detailsPanelClosed && (
                    <Col
                      flex="0 0 360px"
                      style={{ minWidth: 360, maxWidth: 360 }}
                    >
                      <Card
                        size="small"
                        bodyStyle={{ padding: '8px 10px', height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}
                        style={{ borderRadius: 10, borderColor: '#e6ebf2', height: '100%', display: 'flex', flexDirection: 'column' }}
                      >
                      <div style={{ height: '100%', minHeight: 0, overflowY: 'auto' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginBottom: 6 }}>
                          {detailStakeholder && (
                            <Tooltip title="Expand panel" overlayInnerStyle={{ fontSize: '11px' }}>
                              <Button
                                type="text"
                                size="small"
                                icon={<ExpandAltOutlined />}
                                onClick={() => setDetailPanelExpandedOpen(true)}
                                style={{ borderRadius: 6, color: '#2f54eb', fontSize: '11px' }}
                              />
                            </Tooltip>
                          )}
                          {canEdit && detailStakeholder && (
                            <Tooltip title="Edit" overlayInnerStyle={{ fontSize: '11px' }}>
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={() => handleEdit(detailStakeholder)}
                                style={{ borderRadius: 6, color: '#1677ff' }}
                              />
                            </Tooltip>
                          )}
                          <Tooltip title="Close" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button
                              type="text"
                              size="small"
                              icon={<span style={{ fontSize: '14px', lineHeight: 1 }}>×</span>}
                              onClick={() => {
                                setSelectedNodeId(null);
                                setDetailsPanelClosed(true);
                                setDetailPanelExpandedOpen(false);
                              }}
                              style={{ borderRadius: 6, color: '#595959' }}
                            />
                          </Tooltip>
                        </div>

                        {detailStakeholder ? (
                            <div style={{ marginTop: 2 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                                <div
                                  style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: '50%',
                                    border: '2px solid #5b8ff9',
                                    color: '#2f54eb',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '21px',
                                    fontWeight: 700,
                                    background: '#f4f8ff',
                                  }}
                                >
                                  {initials(detailStakeholder.name).slice(0, 1)}
                                </div>
                                <div>
                                  <div style={{ marginBottom: 2, fontSize: '16px', lineHeight: 1.15, fontWeight: 700 }}>{detailStakeholder.name}</div>
                                  <div style={{ fontSize: '12px', color: '#6b778c', lineHeight: 1.15 }}>{detailStakeholder.title || 'Stakeholder'}</div>
                                </div>
                              </div>

                              <Space size={6} style={{ marginBottom: 10 }} wrap>
                                <Tag style={{ margin: 0, fontSize: '10px', borderRadius: 12, color: '#1677ff', background: '#e6f4ff', borderColor: '#bae0ff', padding: '2px 10px' }}>
                                  {toTeamTypeLabel(detailStakeholder.teamType)}
                                </Tag>
                                <Tag style={{ margin: 0, fontSize: '10px', borderRadius: 12, color: '#722ed1', background: '#f9f0ff', borderColor: '#efdbff', padding: '2px 10px' }}>
                                  {detailStakeholder.department || 'Other'}
                                </Tag>
                              </Space>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11px', color: '#3a4a63', marginBottom: 10, flexWrap: 'wrap' }}>
                                <span><MailOutlined style={{ marginRight: 4 }} />{detailStakeholder.email || '—'}</span>
                                <span><PhoneOutlined style={{ marginRight: 4 }} />{detailStakeholder.phone || '—'}</span>
                              </div>

                              <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0 10px' }} />

                              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: 8 }}>About</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', rowGap: 6, columnGap: 8, fontSize: '11px', marginBottom: 10 }}>
                                <span style={{ color: '#6b778c' }}>Department</span>
                                <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{detailStakeholder.department || 'Other'}</span>
                                <span style={{ color: '#6b778c' }}>Reports To</span>
                                <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{stakeholders.find(s => s.id === detailStakeholder.reportingTo)?.name || 'Top level'}</span>
                                <span style={{ color: '#6b778c' }}>Responsibility</span>
                                <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{detailStakeholder.responsibility || '—'}</span>
                              </div>

                              <div style={{ borderTop: '1px solid #f0f0f0', margin: '10px 0 8px' }} />
                              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>
                                Key Relationships ({detailRelations.length})
                              </div>
                              <div style={{ maxHeight: 170, overflowY: 'auto' }}>
                                {detailRelations.map(rel => (
                                  <div key={rel.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10px', marginBottom: 6 }}>
                                    <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{rel.name}</span>
                                    <span style={{ color: '#8c8c8c' }}>→</span>
                                    <span style={{ color: '#595959' }}>{rel.title || 'Stakeholder'}</span>
                                  </div>
                                ))}
                              </div>
                              <div style={{ borderTop: '1px solid #f0f0f0', margin: '10px 0 8px' }} />
                              <StakeholderCommentsPanel
                                stakeholder={detailStakeholder}
                                stakeholders={stakeholders}
                                resourceOptions={resourceOptions}
                                canEdit={canEdit}
                                changedBy={changedBy}
                              />
                            </div>
                        ) : (
                          <div>
                            <Text type="secondary" style={{ fontSize: '11px' }}>Click a node in the diagram to view details.</Text>
                          </div>
                        )}
                      </div>
                      </Card>
                    </Col>
                  )}
                </Row>
            </div>
          )}
        </div>
      )}

      <Modal
        title={<span style={{ fontSize: '11px' }}>{title} Diagram View</span>}
        open={diagramModalOpen}
        onCancel={() => setDiagramModalOpen(false)}
        footer={null}
        width="94vw"
        style={{ top: 18 }}
        destroyOnClose={false}
      >
        <div
          style={{
            border: '1px solid #e6ebf2',
            borderRadius: 10,
            background: '#ffffff',
            height: '75vh',
            overflow: 'hidden',
            padding: '12px',
          }}
        >
          <div style={{ display: 'flex', gap: 8, height: '100%' }}>
            <div
              style={{
                border: '1px solid #e6ebf2',
                borderRadius: 10,
                background: '#ffffff',
                height: '100%',
                padding: '10px 12px 12px',
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  position: 'sticky',
                  top: 0,
                  zIndex: 2,
                  background: '#ffffff',
                  borderBottom: '1px solid #eef2f8',
                  padding: '0 0 8px',
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Tooltip title="Zoom In" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<ZoomInOutlined />} size="small" onClick={zoomIn} style={{ borderRadius: 6 }} />
                </Tooltip>
                <Tooltip title="Zoom Out" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<ZoomOutOutlined />} size="small" onClick={zoomOut} style={{ borderRadius: 6 }} />
                </Tooltip>
                <Tooltip title="Export" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<ExportOutlined />} size="small" onClick={() => handleExportDiagram(true)} style={{ borderRadius: 6 }} />
                </Tooltip>
                <Tooltip title="Reset View" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button
                    type="text"
                    icon={<ReloadOutlined />}
                    size="small"
                    onClick={zoomReset}
                    style={{ borderRadius: 6, color: '#2f54eb', fontSize: '11px', fontWeight: 600 }}
                  >
                    Reset View
                  </Button>
                </Tooltip>
                <Tooltip title="Expand all visible nodes" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button
                    type="default"
                    size="small"
                    onClick={expandAllNodes}
                    style={{ borderRadius: 6, fontSize: '11px' }}
                  >
                    Expand All
                  </Button>
                </Tooltip>
                <div style={{ flex: 1 }} />
                <Tooltip title="Close Expanded View" overlayInnerStyle={{ fontSize: '11px' }}>
                  <Button icon={<FullscreenExitOutlined />} size="small" onClick={() => setDiagramModalOpen(false)} style={{ borderRadius: 6 }} />
                </Tooltip>
              </div>
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  height: 0,
                  overflowY: 'auto',
                  overflowX: 'auto',
                  paddingRight: 2,
                }}
              >
                {renderNetworkCanvas(expandedDiagramCanvasRef)}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={<span style={{ fontSize: '12px' }}>{detailStakeholder ? `${detailStakeholder.name} — Detail View` : 'Stakeholder Detail View'}</span>}
        open={detailPanelExpandedOpen && !!detailStakeholder}
        onCancel={() => setDetailPanelExpandedOpen(false)}
        footer={null}
        width="92vw"
        style={{ top: 16 }}
        destroyOnClose={false}
      >
        {detailStakeholder && (
          <div style={{ maxHeight: '78vh', overflow: 'auto', paddingRight: 2 }}>
            <div style={{ marginTop: 2 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    border: '2px solid #5b8ff9',
                    color: '#2f54eb',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '21px',
                    fontWeight: 700,
                    background: '#f4f8ff',
                  }}
                >
                  {initials(detailStakeholder.name).slice(0, 1)}
                </div>
                <div>
                  <div style={{ marginBottom: 2, fontSize: '16px', lineHeight: 1.15, fontWeight: 700 }}>{detailStakeholder.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b778c', lineHeight: 1.15 }}>{detailStakeholder.title || 'Stakeholder'}</div>
                </div>
              </div>

              <Space size={6} style={{ marginBottom: 10 }} wrap>
                <Tag style={{ margin: 0, fontSize: '10px', borderRadius: 12, color: '#1677ff', background: '#e6f4ff', borderColor: '#bae0ff', padding: '2px 10px' }}>
                  {toTeamTypeLabel(detailStakeholder.teamType)}
                </Tag>
                <Tag style={{ margin: 0, fontSize: '10px', borderRadius: 12, color: '#722ed1', background: '#f9f0ff', borderColor: '#efdbff', padding: '2px 10px' }}>
                  {detailStakeholder.department || 'Other'}
                </Tag>
              </Space>

              <div style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: '11px', color: '#3a4a63', marginBottom: 10, flexWrap: 'wrap' }}>
                <span><MailOutlined style={{ marginRight: 4 }} />{detailStakeholder.email || '—'}</span>
                <span><PhoneOutlined style={{ marginRight: 4 }} />{detailStakeholder.phone || '—'}</span>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', margin: '8px 0 10px' }} />
              <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: 8 }}>About</div>
              <div style={{ display: 'grid', gridTemplateColumns: '108px 1fr', rowGap: 6, columnGap: 8, fontSize: '11px', marginBottom: 10 }}>
                <span style={{ color: '#6b778c' }}>Department</span>
                <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{detailStakeholder.department || 'Other'}</span>
                <span style={{ color: '#6b778c' }}>Reports To</span>
                <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{stakeholders.find(s => s.id === detailStakeholder.reportingTo)?.name || 'Top level'}</span>
                <span style={{ color: '#6b778c' }}>Responsibility</span>
                <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{detailStakeholder.responsibility || '—'}</span>
              </div>

              <div style={{ borderTop: '1px solid #f0f0f0', margin: '10px 0 8px' }} />
              <div style={{ fontSize: '11px', fontWeight: 700, marginBottom: 6 }}>
                Key Relationships ({detailRelations.length})
              </div>
              <div style={{ maxHeight: 170, overflowY: 'auto' }}>
                {detailRelations.map(rel => (
                  <div key={`expanded_rel_${rel.id}`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '10px', marginBottom: 6 }}>
                    <span style={{ color: '#1f1f1f', fontWeight: 600 }}>{rel.name}</span>
                    <span style={{ color: '#8c8c8c' }}>→</span>
                    <span style={{ color: '#595959' }}>{rel.title || 'Stakeholder'}</span>
                  </div>
                ))}
              </div>
              <div style={{ borderTop: '1px solid #f0f0f0', margin: '10px 0 8px' }} />
              <StakeholderCommentsPanel
                stakeholder={detailStakeholder}
                stakeholders={stakeholders}
                resourceOptions={resourceOptions}
                canEdit={canEdit}
                changedBy={changedBy}
              />
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={<span style={{ fontSize: '11px' }}>{editingId ? 'Edit Stakeholder' : addButtonLabel}</span>}
        open={modalOpen}
        onOk={handleSave}
        confirmLoading={saving}
        onCancel={() => {
          setModalOpen(false);
          setEditingId(null);
          form.resetFields();
        }}
        okText="Save"
        width={460}
        okButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
        cancelButtonProps={{ size: 'small', style: { borderRadius: 6 } }}
      >
        <Form form={form} layout="vertical" size="small" style={{ marginTop: 8 }}>
          <Form.Item name="teamType" label={<span style={{ fontSize: '11px' }}>Team Type</span>} rules={[{ required: true, message: 'Select team type' }]} style={{ marginBottom: 10 }}>
            <Select
              style={{ fontSize: '11px' }}
              options={[
                { label: 'Client', value: 'client' },
                { label: 'Internal Team', value: 'ra' },
              ]}
            />
          </Form.Item>
          <Form.Item name="name" label={<span style={{ fontSize: '11px' }}>Full Name</span>} rules={[{ required: true, message: 'Enter name' }]} style={{ marginBottom: 10 }}>
            <Input prefix={<UserOutlined style={{ color: '#bfbfbf' }} />} placeholder="e.g. John Smith" style={{ fontSize: '11px' }} />
          </Form.Item>
          <Form.Item name="title" label={<span style={{ fontSize: '11px' }}>Title / Role</span>} rules={[{ required: true, message: 'Enter title' }]} style={{ marginBottom: 10 }}>
            <Input placeholder="e.g. Director of Engineering" style={{ fontSize: '11px' }} />
          </Form.Item>
          <Form.Item name="department" label={<span style={{ fontSize: '11px' }}>Department</span>} rules={[{ required: true, message: 'Enter department' }]} style={{ marginBottom: 10 }}>
            <Input placeholder="e.g. Engineering, Data Science, DevOps..." style={{ fontSize: '11px' }} />
          </Form.Item>
          <Form.Item name="reportingTo" label={<span style={{ fontSize: '11px' }}>Reporting Manager</span>} style={{ marginBottom: 10 }}>
            <Select
              placeholder="— Top level (no manager)"
              allowClear
              style={{ fontSize: '11px' }}
              options={stakeholders
                .filter(row => row.id !== editingId)
                .map(row => ({ label: `${row.name} (${toTeamTypeLabel(row.teamType)})`, value: row.id }))}
            />
          </Form.Item>
          <Form.Item name="email" label={<span style={{ fontSize: '11px' }}>Email</span>} style={{ marginBottom: 10 }}>
            <Input placeholder="e.g. person@company.com" style={{ fontSize: '11px' }} />
          </Form.Item>
          <Form.Item name="phone" label={<span style={{ fontSize: '11px' }}>Phone Number</span>} style={{ marginBottom: 10 }}>
            <Input placeholder="e.g. +1 555 0123" style={{ fontSize: '11px' }} />
          </Form.Item>
          <Form.Item name="responsibility" label={<span style={{ fontSize: '11px' }}>Responsibility / Notes</span>} style={{ marginBottom: 6 }}>
            <Input.TextArea rows={2} placeholder="Key responsibilities or notes..." style={{ fontSize: '11px' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export function StakeholderNetwork() {
  return (
    <div style={{ padding: '12px 20px 10px', maxWidth: 1360, margin: '0 auto', height: 'calc(100vh - 40px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <StakeholderNetworkSection />
    </div>
  );
}
