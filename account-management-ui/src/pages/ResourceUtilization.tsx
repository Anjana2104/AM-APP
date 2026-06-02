import { useState, useMemo, useEffect, useRef } from 'react';
import { Button, Space, Card, Row, Col, Tag, Upload, Tooltip, message, Typography, Drawer, Input, Select, Collapse, Empty, Slider, Table, Tabs, Statistic, Progress } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { UploadOutlined, FilterOutlined, EyeOutlined, AppstoreOutlined, UnorderedListOutlined, BarChartOutlined, TeamOutlined, ProjectOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ResourceRow } from './ResourceMgmt';

const { Text } = Typography;

interface ResourceUtilizationProps {
  resources: ResourceRow[];
  onUpdateResources: (updated: ResourceRow[]) => void;
}

interface UnifiedFilterState {
  resourceName: string;
  raid: string;
  skills: string;
  engagement: string;
  workexRange: [number, number];
}

const DEFAULT_UNIFIED_FILTERS: UnifiedFilterState = {
  resourceName: '',
  raid: '',
  skills: '',
  engagement: '',
  workexRange: [0, 100],
};

export function ResourceUtilization({ resources = [], onUpdateResources }: ResourceUtilizationProps) {
  const [viewMode, setViewMode] = useState<'list' | 'card'>('list');
  const [allocationDrawer, setAllocationDrawer] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailResource, setSelectedDetailResource] = useState<ResourceRow | null>(null);
  const [cachedResources, setCachedResources] = useState<ResourceRow[]>(resources || []);
  const [unifiedFilters, setUnifiedFilters] = useState<UnifiedFilterState>(DEFAULT_UNIFIED_FILTERS);
  const [allocationForm, setAllocationForm] = useState({
    clientName: '',
    engagementName: '',
    notes: '',
  });

  const filterPanelRef = useRef<HTMLDivElement>(null);

  const isFilterApplied = !!(
    unifiedFilters.resourceName ||
    unifiedFilters.raid ||
    unifiedFilters.skills ||
    unifiedFilters.engagement ||
    unifiedFilters.workexRange[0] !== 0 ||
    unifiedFilters.workexRange[1] !== 100
  );

  useEffect(() => {
    if (!showFilterPanel) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (filterPanelRef.current && !filterPanelRef.current.contains(target)) {
        const isInsidePopup = !!target.closest('.ant-select-dropdown, .ant-picker-dropdown, .ant-dropdown');
        if (!isInsidePopup) {
          setShowFilterPanel(false);
        }
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [showFilterPanel]);

  const closeFilterOnEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') setShowFilterPanel(false);
  };

  useEffect(() => {
    if (resources && Array.isArray(resources)) {
      setCachedResources([...resources]);
    }
  }, [resources]);

  const benchResources = useMemo(() => {
    return (cachedResources || []).filter(r => r?.engagement === 'Bench');
  }, [cachedResources]);

  const allFilteredResources = useMemo(() => {
    let filtered = cachedResources || [];
    if (unifiedFilters.resourceName) filtered = filtered.filter(r => r?.empName?.toLowerCase().includes(unifiedFilters.resourceName.toLowerCase()));
    if (unifiedFilters.raid) filtered = filtered.filter(r => r?.raId?.toLowerCase().includes(unifiedFilters.raid.toLowerCase()));
    if (unifiedFilters.skills) filtered = filtered.filter(r => r?.skills?.toLowerCase().includes(unifiedFilters.skills.toLowerCase()));
    if (unifiedFilters.engagement) filtered = filtered.filter(r => (r?.engagement || '') === unifiedFilters.engagement);
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
    { title: 'PIW Role', dataIndex: 'piwRole', key: 'piwRole', width: 120, render: (v: string) => <span style={{ fontSize: '11px' }}>{v || '—'}</span> },
    {
      title: 'Engagement',
      dataIndex: 'engagement',
      key: 'engagement',
      width: 120,
      render: (v: string) => v === 'Bench'
        ? <Tag color="warning" style={{ fontSize: '10px' }}>Bench</Tag>
        : <span style={{ fontSize: '11px' }}>{v || '—'}</span>,
    },
    { title: 'Experience', dataIndex: 'totalWorkex', key: 'totalWorkex', width: 100, render: (v: string) => <span style={{ fontSize: '11px' }}>{v || '—'} yrs</span> },
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
      width: 60,
      render: (_: any, record: ResourceRow) => (
        <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
          <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedDetailResource(record); setDetailsModalOpen(true); }} />
        </Tooltip>
      ),
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
        message.success(`✓ Matched ${matchedCount} resources to Bench`);
      } catch (error) {
        message.error('Error processing file');
        console.error(error);
      }
    };
    reader.readAsArrayBuffer(file);
    return false;
  };

  const handleAllocateResource = (resource: ResourceRow) => {
    setSelectedResource(resource);
    setAllocationDrawer(true);
  };

  const handleSaveAllocation = () => {
    if (!selectedResource || !allocationForm.clientName || !allocationForm.engagementName) {
      message.warning('Please fill in required fields');
      return;
    }

    const updated = (cachedResources || []).map(r => {
      if (r?.sno === selectedResource.sno) {
        return {
          ...r,
          allocationRequests: [
            ...(r?.allocationRequests || []),
            {
              id: `AR-${Date.now()}`,
              clientName: allocationForm.clientName,
              engagementName: allocationForm.engagementName,
              status: 'shortlisted' as const,
              createdDate: new Date().toISOString(),
              notes: allocationForm.notes,
            },
          ],
        };
      }
      return r;
    });

    setCachedResources(updated);
    onUpdateResources(updated);
    setAllocationDrawer(false);
    setAllocationForm({ clientName: '', engagementName: '', notes: '' });
    message.success('Allocation request created');
  };

  // ─── Insights data ────────────────────────────────────────────
  const total = cachedResources?.length || 0;
  const benchCount = benchResources?.length || 0;
  const activeCount = total - benchCount;
  const utilizationPct = total > 0 ? Math.round((activeCount / total) * 100) : 0;

  const engagementBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    (cachedResources || []).forEach(r => {
      const eng = r?.engagement || 'Unassigned';
      map[eng] = (map[eng] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [cachedResources]);


  // ─── Reusable card/list renderer ─────────────────────────────
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
            const skillsArr = resource.skills ? resource.skills.split(',').map(s => s.trim()).slice(0, 2) : [];
            return (
              <div key={resource.sno} style={{ background: '#fff', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: group.isBench ? '1px solid #ffe58f' : '1px solid #f0f0f0', borderLeft: group.isBench ? '4px solid #faad14' : '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                  <Text strong style={{ fontSize: '13px' }}>{resource.empName}</Text>
                  <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
                    <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedDetailResource(resource); setDetailsModalOpen(true); }} style={{ padding: 0 }} />
                  </Tooltip>
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>{resource.raId}</div>
                <div style={{ fontSize: '11px', color: '#595959', marginBottom: '4px' }}>{resource.piwRole} • {resource.totalWorkex || '—'} yrs</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: '6px' }}>
                  {skillsArr.map((skill, idx) => <Tag key={idx} color="blue" style={{ fontSize: '10px', margin: 0 }}>{skill}</Tag>)}
                  {resource.skills && resource.skills.split(',').length > 2 && (
                    <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{resource.skills.split(',').length - 2} more</Tag>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Button type="primary" size="small" onClick={() => handleAllocateResource(resource)} style={{ fontSize: '10px' }}>Allocate</Button>
                </div>
              </div>
            );
          })}
        </div>
      ),
    }));
    return items.length > 0 ? <Collapse items={items} defaultActiveKey={items.filter(i => !i.key.includes('Bench')).map(i => i.key)} /> : <Empty description="No resources found" style={{ marginTop: 48 }} />;
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
      />
    </div>
  );

  // ─── Tab data sets ─────────────────────────────────────────────
  const projectResources = useMemo(() => allFilteredResources.filter(r => r?.engagement && r.engagement !== 'Bench'), [allFilteredResources]);
  const filteredBenchResources = useMemo(() => allFilteredResources.filter(r => r?.engagement === 'Bench'), [allFilteredResources]);

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
              defaultActiveKey="projects"
              size="small"
              tabBarStyle={{ fontSize: '11px' }}
              items={[
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
                          {isFilterApplied && (
                            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>✕ Clear Filters</Button>
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
                        </Space>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {showFilterPanel && (
                          <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>Filters</span>
                              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>Clear all</Button>
                            </div>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Name</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.resourceName} onChange={e => setUnifiedFilters({ ...unifiedFilters, resourceName: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.raid} onChange={e => setUnifiedFilters({ ...unifiedFilters, raid: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.skills} onChange={e => setUnifiedFilters({ ...unifiedFilters, skills: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Project / Engagement</div>
                                <Select size="small" placeholder="All" allowClear value={unifiedFilters.engagement || undefined} onChange={(value) => setUnifiedFilters({ ...unifiedFilters, engagement: value || '' })} options={engagementOptions.filter(e => e !== 'Bench').map(eng => ({ label: eng, value: eng }))} style={{ width: '100%', fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Experience: {unifiedFilters.workexRange[0]}-{unifiedFilters.workexRange[1]} yrs</div>
                                <Slider range min={0} max={50} value={unifiedFilters.workexRange} onChange={(value) => setUnifiedFilters({ ...unifiedFilters, workexRange: value as [number, number] })} />
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
                  key: 'bench',
                  label: (
                    <span style={{ fontSize: '11px' }}>
                      <TeamOutlined /> Bench
                      {benchCount > 0 && <Tag color="warning" style={{ marginLeft: 6, fontSize: '10px' }}>{benchCount}</Tag>}
                    </span>
                  ),
                  children: (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '12px' }}>
                        <Text style={{ fontSize: '12px', color: '#666' }}>
                          Showing: <strong>{filteredBenchResources.length}</strong> bench resources
                        </Text>
                        <Space wrap size={8}>
                          {isFilterApplied && (
                            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>✕ Clear Filters</Button>
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
                          <Tooltip title="Upload Bench RAID (Excel)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Upload accept=".xlsx,.xls" beforeUpload={handleBenchUpload} showUploadList={false}>
                              <Button icon={<UploadOutlined />} size="small" style={{ borderRadius: '6px' }} />
                            </Upload>
                          </Tooltip>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {showFilterPanel && (
                          <div ref={filterPanelRef} style={{ width: '240px', flexShrink: 0, background: '#fafafa', borderRadius: '8px', padding: '16px', border: '1px solid #f0f0f0', alignSelf: 'flex-start' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>Filters</span>
                              <Button type="link" size="small" style={{ fontSize: '11px', padding: 0 }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>Clear all</Button>
                            </div>
                            <Space direction="vertical" style={{ width: '100%' }} size={8}>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Resource Name</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.resourceName} onChange={e => setUnifiedFilters({ ...unifiedFilters, resourceName: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>RA ID</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.raid} onChange={e => setUnifiedFilters({ ...unifiedFilters, raid: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Skills</div>
                                <Input size="small" placeholder="Search..." value={unifiedFilters.skills} onChange={e => setUnifiedFilters({ ...unifiedFilters, skills: e.target.value })} allowClear onKeyDown={closeFilterOnEnter} style={{ fontSize: '11px' }} />
                              </div>
                              <div>
                                <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>Experience: {unifiedFilters.workexRange[0]}-{unifiedFilters.workexRange[1]} yrs</div>
                                <Slider range min={0} max={50} value={unifiedFilters.workexRange} onChange={(value) => setUnifiedFilters({ ...unifiedFilters, workexRange: value as [number, number] })} />
                              </div>
                            </Space>
                          </div>
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          {filteredBenchResources.length === 0
                            ? <Empty description={benchCount === 0 ? 'No bench resources. Upload a RAID file to mark resources as bench.' : 'No bench resources match filters.'} style={{ marginTop: 48 }} />
                            : viewMode === 'list'
                              ? renderListTable(filteredBenchResources)
                              : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                                  {filteredBenchResources.map(resource => {
                                    if (!resource) return null;
                                    const skillsArr = resource.skills ? resource.skills.split(',').map(s => s.trim()).slice(0, 2) : [];
                                    return (
                                      <div key={resource.sno} style={{ background: '#fff', borderRadius: '8px', padding: '10px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', border: '1px solid #ffe58f', borderLeft: '4px solid #faad14' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                                          <Text strong style={{ fontSize: '13px' }}>{resource.empName}</Text>
                                          <Tooltip title="View Details" overlayInnerStyle={{ fontSize: '11px' }}>
                                            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => { setSelectedDetailResource(resource); setDetailsModalOpen(true); }} style={{ padding: 0 }} />
                                          </Tooltip>
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '4px' }}>{resource.raId}</div>
                                        <div style={{ fontSize: '11px', color: '#595959', marginBottom: '4px' }}>{resource.piwRole} • {resource.totalWorkex || '—'} yrs</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginBottom: '6px' }}>
                                          {skillsArr.map((skill, idx) => <Tag key={idx} color="blue" style={{ fontSize: '10px', margin: 0 }}>{skill}</Tag>)}
                                          {resource.skills && resource.skills.split(',').length > 2 && (
                                            <Tag style={{ fontSize: '10px', margin: 0, background: '#f5f5f5', color: '#666', border: '1px solid #d9d9d9' }}>+{resource.skills.split(',').length - 2} more</Tag>
                                          )}
                                        </div>
                                        <Button type="primary" size="small" onClick={() => handleAllocateResource(resource)} style={{ fontSize: '10px' }}>Allocate</Button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                          }
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
                          <Card style={{ borderRadius: 8 }} bodyStyle={{ padding: '16px 20px' }}>
                            <Text strong style={{ fontSize: '13px', display: 'block', marginBottom: 16 }}>Breakdown by Engagement</Text>
                            <Space direction="vertical" style={{ width: '100%' }} size={12}>
                              {engagementBreakdown.map(([eng, count]) => {
                                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                                const isBench = eng === 'Bench';
                                return (
                                  <div key={eng}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                      <Space size={6}>
                                        {isBench && <Tag color="warning" style={{ fontSize: '10px', margin: 0 }}>Bench</Tag>}
                                        <Text style={{ fontSize: '12px' }}>{eng}</Text>
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
                        </>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
        </Space>
      </div>

      <Drawer title="Allocate Resource" placement="right" onClose={() => setAllocationDrawer(false)} open={allocationDrawer} width={400}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Client Name *</label>
            <Input
              placeholder="Enter client name"
              value={allocationForm.clientName}
              onChange={(e) => setAllocationForm({ ...allocationForm, clientName: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Engagement *</label>
            <Input
              placeholder="Enter engagement name"
              value={allocationForm.engagementName}
              onChange={(e) => setAllocationForm({ ...allocationForm, engagementName: e.target.value })}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes</label>
            <Input.TextArea
              placeholder="Add notes"
              value={allocationForm.notes}
              onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div style={{ fontSize: '11px', color: '#666', backgroundColor: '#f5f5f5', padding: 8, borderRadius: 4 }}>
            <strong>Status:</strong> Shortlisted
          </div>

          <Space style={{ width: '100%' }} size="small">
            <Button type="primary" onClick={handleSaveAllocation} style={{ flex: 1 }}>Create</Button>
            <Button onClick={() => setAllocationDrawer(false)} style={{ flex: 1 }}>Cancel</Button>
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
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.piwRole || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>Domain</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.roleOrDomain || '—'}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#999', marginBottom: 4 }}>Total Experience</div>
                <div style={{ fontSize: '14px', fontWeight: 600 }}>{selectedDetailResource.totalWorkex || '—'} years</div>
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