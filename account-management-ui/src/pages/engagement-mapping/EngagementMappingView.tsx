import { Button, Card, Col, Drawer, Empty, Input, Select, Space, Tag, Tooltip, Typography, Row, Tabs, AutoComplete, DatePicker, message } from 'antd';
import { AppstoreOutlined, BarChartOutlined, DownloadOutlined, ExpandAltOutlined, FileExcelOutlined, FilterOutlined, FundProjectionScreenOutlined, PieChartOutlined, ProjectOutlined, ShrinkOutlined, TeamOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { DndContext, DragOverlay } from '@dnd-kit/core';
import { ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip as RechartTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import { exportChartAsPng } from '../../utils/exportChartAsPng';
import { getCurrentDateStamp } from '../../utils/styledExcelExport';
import ResourceDetailPanel from '../../components/ResourceDetailPanel';
import SharedResourceFilterPanel from '../../components/SharedResourceFilterPanel';
import { ResourceForecasting } from '../ResourceForecasting';
import { KanbanColumn } from './KanbanColumn';
import { ReleaseToBenchModal } from './ReleaseToBenchModal';
import { BeelineLinkModal } from './BeelineLinkModal';
import { ResourceEditModal } from './ResourceEditModal';
import { DEFAULT_UNIFIED_FILTERS } from './types';
import type { EngagementMappingState } from './useEngagementMappingState';

const { Text } = Typography;

export function EngagementMappingView(props: EngagementMappingState) {
  const {
    currentUser,
    canEdit,
    viewMode,
    setViewMode,
    allocationDrawer,
    setAllocationDrawer,
    savingAllocation,
    showFilterPanel,
    setShowFilterPanel,
    detailsModalOpen,
    setDetailsModalOpen,
    selectedDetailResource,
    setSelectedDetailResource,
    detailExpanded,
    setDetailExpanded,
    cachedResources,
    projectEngagementOptions,
    unifiedFilters,
    setUnifiedFilters,
    mainTab,
    setMainTab,
    exportingInsights,
    setExportingInsights,
    allocationChartType,
    setAllocationChartType,
    allocStages,
    allocationForm,
    setAllocationForm,
    beelineLinkModal,
    setBeelineLinkModal,
    selectedBeelineId,
    setSelectedBeelineId,
    beelineRequestOptions,
    beelineSaving,
    ensureActiveRequestOptions,
    saveBeelineLink,
    filterPanelRef,
    editModal,
    setEditModal,
    editForm,
    editSaving,
    openEditModal,
    handleSaveEdit,
    selectedSNOs,
    setSelectedSNOs,
    pendingAllocResources,
    setPendingAllocResources,
    draggingResource,
    pendingTargetStatus,
    clearSelection,
    releaseModal,
    setReleaseModal,
    releaseTargets,
    releaseComment,
    setReleaseComment,
    releaseTag,
    setReleaseTag,
    savingRelease,
    selectedBenchSkills,
    setSelectedBenchSkills,
    skillSearch,
    setSkillSearch,
    deploymentGlobalSearch,
    setDeploymentGlobalSearch,
    projectSearch,
    setProjectSearch,
    isFilterApplied,
    emRaidOptions,
    emRoleOrDomainOptions,
    emSkillOptions,
    emBeelineOptions,
    engagementOptions,
    handleBulkAllocate,
    handleSaveAllocation,
    confirmRelease,
    handleBulkUpdateStatus,
    sensors,
    handleDragStart,
    handleDragEnd,
    total,
    activeCount,
    utilizationPct,
    handleExportListTable,
    handleExportPipeline,
    roleBreakdown,
    renderCardGroups,
    renderListTable,
    projectResources,
    filteredProjectResources,
    selectedResources,
    filteredBenchResources,
    shortlistedResources,
    offeredResources,
    totalBenchTabCount,
    insightsRef,
    onNavigateToRequest,
    onNavigateToInsights,
  } = props;
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#f5f5f5', padding: '12px 24px', boxSizing: 'border-box', overflow: 'hidden' }}>
      <style>{`
        .em-full-tabs { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
        .em-full-tabs > .ant-tabs-nav { flex-shrink: 0; }
        .em-full-tabs > .ant-tabs-content-holder { flex: 1; overflow: hidden; display: flex; flex-direction: column; min-height: 0; }
        .em-full-tabs .ant-tabs-content { height: 100%; display: flex; flex-direction: column; }
        .em-full-tabs .ant-tabs-tabpane-active { height: 100%; display: flex !important; flex-direction: column; overflow: hidden; }
        .em-full-tabs .ant-tabs-tabpane:not(.ant-tabs-tabpane-active) { display: none !important; }
      `}</style>
      <div style={{ flex: 1, overflow: 'hidden', background: '#fff', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Tabs
          className="em-full-tabs"
          activeKey={mainTab}
          onChange={setMainTab}
          size="small"
          destroyInactiveTabPane
          tabBarStyle={{ fontSize: '11px', flexShrink: 0, marginBottom: 0 }}
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
                    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 4, flexShrink: 0 }}>
                        <Input.Search
                          placeholder="Search name, RA ID, skills, engagement, commentsâ€¦"
                          allowClear
                          size="small"
                          value={deploymentGlobalSearch}
                          onChange={e => setDeploymentGlobalSearch(e.target.value)}
                          onSearch={v => setDeploymentGlobalSearch(v)}
                          style={{ width: 300, borderRadius: 6 }}
                          styles={{ input: { fontSize: 12 } }}
                        />
                        <Space wrap size={8} style={{ justifyContent: 'flex-end' }}>
                          {isFilterApplied && (
                            <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#ff4d4f' }} onClick={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}>x Clear Filters</Button>
                          )}
                          <Tooltip title="Filter" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FilterOutlined />} type={showFilterPanel || isFilterApplied ? 'primary' : 'default'} size="small" onClick={() => setShowFilterPanel(!showFilterPanel)} style={{ borderRadius: '6px' }} />
                          </Tooltip>
                          <Tooltip title="Export Available Resources (Excel)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FileExcelOutlined />} size="small" disabled={!filteredBenchResources.length} onClick={() => handleExportListTable(filteredBenchResources, `Available_Resources_Export_${getCurrentDateStamp()}.xlsx`)} style={{ borderRadius: '6px', color: filteredBenchResources.length ? '#52c41a' : undefined }} />
                          </Tooltip>
                          <Tooltip title="Export all non-Joined resources (Pipeline)" overlayInnerStyle={{ fontSize: '11px' }}>
                            <Button icon={<FileExcelOutlined />} size="small" onClick={handleExportPipeline} style={{ borderRadius: '6px', color: '#722ed1' }} />
                          </Tooltip>
                        </Space>
                      </div>
                      {selectedSNOs.size > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8, flexShrink: 0 }}>
                          <Tag color="blue" style={{ fontSize: '11px', cursor: 'pointer' }} onClick={clearSelection}>
                            {selectedSNOs.size} selected - drag any to move all | click to clear
                          </Tag>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: '12px', flex: 1, minHeight: 0 }}>
                        {showFilterPanel && (
                          <SharedResourceFilterPanel
                            panelRef={filterPanelRef}
                            width={220}
                            padding={14}
                            onClearAll={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}
                            resourceNameLabel="Resource Name"
                            resourceNameValue={unifiedFilters.resourceName}
                            onResourceNameChange={(value) => setUnifiedFilters(prev => ({ ...prev, resourceName: value }))}
                            raidValue={unifiedFilters.raid}
                            onRaidChange={(value) => setUnifiedFilters(prev => ({ ...prev, raid: value }))}
                            raidOptions={emRaidOptions}
                            roleOrDomainValue={unifiedFilters.roleOrDomain}
                            onRoleOrDomainChange={(value) => setUnifiedFilters(prev => ({ ...prev, roleOrDomain: value }))}
                            roleOrDomainOptions={emRoleOrDomainOptions}
                            skillsValue={unifiedFilters.skills}
                            onSkillsChange={(value) => setUnifiedFilters(prev => ({ ...prev, skills: value }))}
                            skillOptions={emSkillOptions}
                            engagementLabel="Current Engagement"
                            engagementValue={unifiedFilters.engagement}
                            onEngagementChange={(value) => setUnifiedFilters(prev => ({ ...prev, engagement: value }))}
                            engagementOptions={engagementOptions.map(eng => ({ label: eng, value: eng }))}
                            beelineValue={unifiedFilters.beelineId}
                            onBeelineChange={(value) => setUnifiedFilters(prev => ({ ...prev, beelineId: value }))}
                            beelineOptions={emBeelineOptions}
                            showAllocationPct
                            allocationPctValue={unifiedFilters.allocationPct}
                            onAllocationPctChange={(value) => setUnifiedFilters(prev => ({ ...prev, allocationPct: value }))}
                            showWorkexRange
                            workexRange={unifiedFilters.workexRange}
                            onWorkexRangeChange={(value) => setUnifiedFilters(prev => ({ ...prev, workexRange: value }))}
                            workexMax={50}
                          />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                            <div style={{ display: 'flex', gap: 12, flex: 1, minHeight: 300 }} onClick={() => setSelectedSNOs(new Set())}>
                              <KanbanColumn id="available" title="Available" color="#faad14" bgColor="#fffbe6"
                                resources={filteredBenchResources} selectedSNOs={selectedSNOs}
                                onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                              />
                              <KanbanColumn id="shortlisted" title="Shortlisted" color="#13c2c2" bgColor="#e6fffb"
                                resources={shortlistedResources} selectedSNOs={selectedSNOs}
                                onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                onEdit={openEditModal} canEdit={canEdit}
                              />
                              <KanbanColumn id="offered" title="Offered" color="#722ed1" bgColor="#f9f0ff"
                                resources={offeredResources} selectedSNOs={selectedSNOs}
                                onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                onEdit={openEditModal} canEdit={canEdit}
                              />
                              <KanbanColumn id="selected" title="Selected" color="#1890ff" bgColor="#e6f4ff"
                                resources={selectedResources} selectedSNOs={selectedSNOs}
                                onToggleSelect={(sno) => setSelectedSNOs(prev => { const n = new Set(prev); n.has(sno) ? n.delete(sno) : n.add(sno); return n; })}
                                onViewDetails={(r) => { setSelectedDetailResource(r); setDetailsModalOpen(true); }}
                                onEdit={openEditModal} canEdit={canEdit}
                              
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
                          </div>
                        </div>
                      </div>
                      <div style={{ flexShrink: 0, marginTop: 6, fontSize: '11px', color: '#bbb', textAlign: 'center' }}>
                        Drag tiles to change status | Click to multi-select | Drag selected tile to move all
                      </div>
                    </div>
                  ),
                },
                {
                  key: 'projects',
                  label: (
                    <span style={{ fontSize: '11px' }}>
                      <ProjectOutlined /> Projects
                      {projectResources.length > 0 && <Tag color="blue" style={{ marginLeft: 6, fontSize: '10px' }}>{projectResources.length}</Tag>}
                    </span>
                  ),
                  children: (
                    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                    <>
                      {/* Search bar â€” centred, elongated, separated from toolbar */}
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10, marginTop: 4 }}>
                        <Input.Search
                          placeholder="Search by project, resource name, role, skillsâ€¦"
                          allowClear
                          value={projectSearch}
                          onChange={e => setProjectSearch(e.target.value)}
                          style={{ width: '60%', fontSize: 11 }}
                          styles={{ input: { fontSize: 11 } }}
                        />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: '12px' }}>
                        <Text style={{ fontSize: '12px', color: '#666' }}>
                          <strong>{filteredProjectResources.length}</strong>{projectSearch ? ` of ${projectResources.length}` : ''} resources on projects
                        </Text>
                        <Space wrap size={8}>
                          {selectedSNOs.size === 1 && canEdit && (
                            <>
                              <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#8c8c8c' }} onClick={clearSelection}>âœ• Clear</Button>
                           <Button size="small" type="primary" icon={<TeamOutlined />} style={{ fontSize: '11px' }} onClick={() => handleBulkAllocate(filteredProjectResources, 'Joined')}>Allocate</Button>
                            </>
                          )}
                          {selectedSNOs.size > 1 && canEdit && (
                            <>
                              <Button size="small" type="link" style={{ fontSize: '11px', padding: '0 4px', color: '#8c8c8c' }} onClick={clearSelection}>âœ• Clear ({selectedSNOs.size})</Button>
                              <Button size="small" type="primary" icon={<TeamOutlined />} style={{ fontSize: '11px' }} onClick={() => handleBulkAllocate(filteredProjectResources, 'Joined')}>Bulk Allocate ({selectedSNOs.size})</Button>
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
                            <Button icon={<FileExcelOutlined />} size="small" disabled={!filteredProjectResources.length} onClick={() => handleExportListTable(filteredProjectResources, `Projects_Export_${getCurrentDateStamp()}.xlsx`)} style={{ borderRadius: '6px', color: filteredProjectResources.length ? '#52c41a' : undefined }} />
                          </Tooltip>
                        </Space>
                      </div>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        {showFilterPanel && (
                          <SharedResourceFilterPanel
                            width={240}
                            padding={16}
                            onClearAll={() => setUnifiedFilters(DEFAULT_UNIFIED_FILTERS)}
                            resourceNameLabel="Resource Name"
                            resourceNameValue={unifiedFilters.resourceName}
                            onResourceNameChange={(value) => setUnifiedFilters(prev => ({ ...prev, resourceName: value }))}
                            raidValue={unifiedFilters.raid}
                            onRaidChange={(value) => setUnifiedFilters(prev => ({ ...prev, raid: value }))}
                            raidOptions={emRaidOptions}
                            roleOrDomainValue={unifiedFilters.roleOrDomain}
                            onRoleOrDomainChange={(value) => setUnifiedFilters(prev => ({ ...prev, roleOrDomain: value }))}
                            roleOrDomainOptions={emRoleOrDomainOptions}
                            skillsValue={unifiedFilters.skills}
                            onSkillsChange={(value) => setUnifiedFilters(prev => ({ ...prev, skills: value }))}
                            skillOptions={emSkillOptions}
                            engagementLabel="Project / Engagement"
                            engagementValue={unifiedFilters.engagement}
                            onEngagementChange={(value) => setUnifiedFilters(prev => ({ ...prev, engagement: value }))}
                            engagementOptions={engagementOptions.filter(e => e !== 'Bench').map(eng => ({ label: eng, value: eng }))}
                            beelineValue={unifiedFilters.beelineId}
                            onBeelineChange={(value) => setUnifiedFilters(prev => ({ ...prev, beelineId: value }))}
                            beelineOptions={emBeelineOptions}
                            showAllocationPct
                            allocationPctValue={unifiedFilters.allocationPct}
                            onAllocationPctChange={(value) => setUnifiedFilters(prev => ({ ...prev, allocationPct: value }))}
                            showWorkexRange
                            workexRange={unifiedFilters.workexRange}
                            onWorkexRangeChange={(value) => setUnifiedFilters(prev => ({ ...prev, workexRange: value }))}
                            workexMax={50}
                          />
                        )}
                        <div style={{ flex: 1, overflow: 'hidden' }}>
                          {viewMode === 'list' ? renderListTable(filteredProjectResources) : renderCardGroups(filteredProjectResources)}
                        </div>
                      </div>
                    </>
                    </div>
                  ),
                },
                {
                  key: 'forecasting',
                  label: <span style={{ fontSize: '11px' }}><FundProjectionScreenOutlined /> Forecasting</span>,
                  children: (
                    <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                      <ResourceForecasting resources={cachedResources || []} />
                    </div>
                  ),
                },
                {
                  key: 'insights',
                  label: <span style={{ fontSize: '11px' }}><BarChartOutlined /> Utilization Insights</span>,
                  children: (() => {
                    const CHART_COLORS = ['#1890ff','#52c41a','#faad14','#f5222d','#722ed1','#13c2c2','#eb2f96','#fa8c16','#a0d911','#096dd9'];
                    const statusColorMap: Record<string, string> = { Available: '#faad14', 'On Bench': '#faad14', Shortlisted: '#13c2c2', Offered: '#722ed1', Selected: '#1890ff', Joined: '#389e0d', Allocated: '#389e0d', 'Partially Allocated': '#096dd9', Resigned: '#f5222d', Released: '#fa541c' };

                    // Allocation status data
                    const statusMap: Record<string, number> = {};
                    (cachedResources || []).forEach(r => {
                      const s = r?.allocationStatus || 'Unknown';
                      statusMap[s] = (statusMap[s] || 0) + 1;
                    });
                    const allocData = Object.entries(statusMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

                    // Engagement data
                    const engMap: Record<string, number> = {};
                    (cachedResources || []).forEach(r => {
                      const e = r?.engagement || 'Unknown';
                      engMap[e] = (engMap[e] || 0) + 1;
                    });
                    const engData = Object.entries(engMap).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

                    const kpis = [
                      { label: 'Total', value: total, color: '#1890ff', bg: '#e6f7ff' },
                      { label: 'Active', value: activeCount, color: '#52c41a', bg: '#f6ffed' },
                      { label: 'Available', value: filteredBenchResources.length, color: '#faad14', bg: '#fffbe6' },
                      { label: 'Pipeline', value: shortlistedResources.length + offeredResources.length + selectedResources.length, color: '#13c2c2', bg: '#e6fffb' },
                      {
                        label: 'Utilization',
                        value: `${utilizationPct}%`,
                        color: utilizationPct > 100 ? '#f5222d' : utilizationPct === 100 ? '#52c41a' : '#faad14',
                        bg: '#f9f0ff',
                      },
                    ];

                    const renderPie = (data: { name: string; value: number }[], colors: Record<string, string>, fallbackColors: string[]) => (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={85} dataKey="value" paddingAngle={2}>
                            {data.map((entry, i) => <Cell key={i} fill={colors[entry.name] || fallbackColors[i % fallbackColors.length]} />)}
                          </Pie>
                          <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                          <RechartTooltip formatter={(v: number, name: string) => [`${v} (${total ? Math.round(v/total*100) : 0}%)`, name]} contentStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    );

                    const renderBar = (data: { name: string; value: number }[], colors: Record<string, string>, fallbackColors: string[]) => (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={data} margin={{ left: 0, right: 12, top: 4, bottom: 32 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <RechartTooltip formatter={(v: number, name: string) => [v, name]} contentStyle={{ fontSize: 11 }} />
                          <Bar dataKey="value" radius={[4,4,0,0]}>
                            {data.map((entry, i) => <Cell key={i} fill={colors[entry.name] || fallbackColors[i % fallbackColors.length]} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );

                    return (
                      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
                        {/* Export */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                          <Tooltip title="Export as PNG" overlayInnerStyle={{ fontSize: 11 }}>
                            <Button size="small" icon={<DownloadOutlined />} loading={exportingInsights}
                              onClick={async () => {
                                if (!insightsRef.current) return;
                                setExportingInsights(true);
                                try {
                                  await exportChartAsPng(insightsRef.current, `utilization-insights-${getCurrentDateStamp()}.png`, '#f5f6fa');
                                } finally { setExportingInsights(false); }
                              }} style={{ fontSize: 11 }} />
                          </Tooltip>
                        </div>
                        <div ref={insightsRef}>
                        {total === 0 ? (
                          <Empty description="No resource data. Upload resources in the Information tab first." style={{ marginTop: 48 }} />
                        ) : (
                          <>
                            {/* KPI strip */}
                            <Row gutter={[10, 10]} style={{ marginBottom: 14 }}>
                              {kpis.map(k => (
                                <Col key={k.label} xs={12} sm={8} md={24/kpis.length}>
                                  <div style={{ background: k.bg, border: `1px solid ${k.color}22`, borderRadius: 8, padding: '8px 12px', textAlign: 'center' }}>
                                    <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                                    <div style={{ fontSize: 10, color: '#666', marginTop: 2 }}>{k.label}</div>
                                  </div>
                                </Col>
                              ))}
                            </Row>

                            {/* Two charts side by side */}
                            <Row gutter={[12, 12]} style={{ marginBottom: 14 }}>
                              {/* Allocation Status â€” full width */}
                              <Col xs={24}>
                                <Card size="small" bodyStyle={{ padding: '10px 14px' }} style={{ borderRadius: 8, border: '1px solid #f0f0f0' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                    <Text strong style={{ fontSize: 12 }}>Breakdown by Allocation Status</Text>
                                    <Space size={4}>
                                      <Tooltip title="Pie Chart" overlayInnerStyle={{ fontSize: 10 }}>
                                        <Button size="small" type={allocationChartType === 'pie' ? 'primary' : 'default'} icon={<PieChartOutlined />} onClick={() => setAllocationChartType('pie')} style={{ borderRadius: 4 }} />
                                      </Tooltip>
                                      <Tooltip title="Bar Chart" overlayInnerStyle={{ fontSize: 10 }}>
                                        <Button size="small" type={allocationChartType === 'bar' ? 'primary' : 'default'} icon={<BarChartOutlined />} onClick={() => setAllocationChartType('bar')} style={{ borderRadius: 4 }} />
                                      </Tooltip>
                                    </Space>
                                  </div>
                                  {allocData.length === 0
                                    ? <Text type="secondary" style={{ fontSize: 11 }}>No data</Text>
                                    : allocationChartType === 'pie'
                                      ? renderPie(allocData, statusColorMap, CHART_COLORS)
                                      : renderBar(allocData, statusColorMap, CHART_COLORS)
                                  }
                                </Card>
                              </Col>
                            </Row>

                            {/* Available resources by Roles/Domains */}
                            <Card size="small" bodyStyle={{ padding: '10px 14px' }} style={{ borderRadius: 8, border: '1px solid #f0f0f0', marginBottom: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Space size={6}>
                                  <Text strong style={{ fontSize: 12 }}>Available Resources by Roles/Domains</Text>
                                  <Tag color="warning" style={{ fontSize: 10 }}>{roleBreakdown.reduce((s, [,c]) => s + c, 0)} available</Tag>
                                </Space>
                                <Text type="secondary" style={{ fontSize: 10 }}>Click a role to filter</Text>
                              </div>
                              {roleBreakdown.length === 0
                                ? <Text style={{ fontSize: 11, color: '#aaa' }}>No available resources</Text>
                                : (
                                  <Row gutter={[8, 6]}>
                                    {roleBreakdown.map(([role, count], i) => {
                                      const benchTotal = roleBreakdown.reduce((s, [,c]) => s + c, 0);
                                      const pct = benchTotal > 0 ? Math.round((count / benchTotal) * 100) : 0;
                                      const color = CHART_COLORS[i % CHART_COLORS.length];
                                      return (
                                        <Col key={role} xs={24} sm={12} md={8}>
                                          <div
                                            onClick={() => { setMainTab('bench'); setUnifiedFilters({ ...DEFAULT_UNIFIED_FILTERS, roleOrDomain: [role] }); }}
                                            style={{ cursor: 'pointer', borderRadius: 6, padding: '4px 8px', border: '1px solid #f0f0f0', transition: 'background 0.15s' }}
                                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fffbe6'; }}
                                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                                          >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                                              <Text style={{ fontSize: 11, color: '#595959', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{role}</Text>
                                              <Text style={{ fontSize: 11, color, fontWeight: 600 }}>{count} <span style={{ color: '#999', fontWeight: 400 }}>({pct}%)</span></Text>
                                            </div>
                                            <div style={{ height: 5, background: '#f0f0f0', borderRadius: 3 }}>
                                              <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.4s' }} />
                                            </div>
                                          </div>
                                        </Col>
                                      );
                                    })}
                                  </Row>
                                )
                              }
                            </Card>

                            {/* Skills available in deployment pool */}
                            {(() => {
                              const searchTerm = skillSearch.trim().toLowerCase();

                              // Full skill count from all bench resources
                              const skillCountMap = new Map<string, number>();
                              filteredBenchResources.forEach(r => {
                                if (!r.skills) return;
                                r.skills.split(',').map(s => s.trim()).filter(Boolean).forEach(skill => {
                                  skillCountMap.set(skill, (skillCountMap.get(skill) || 0) + 1);
                                });
                              });
                              const skillEntries = Array.from(skillCountMap.entries()).sort((a, b) => b[1] - a[1]);

                              // Filtered skill list (by search term on skill name)
                              const filteredSkillEntries = searchTerm
                                ? skillEntries.filter(([s]) => s.toLowerCase().includes(searchTerm))
                                : skillEntries;

                              // When search is active: count of bench resources that have ANY of the displayed skills
                              const searchMatchedResourceCount = searchTerm
                                ? filteredBenchResources.filter(r =>
                                    filteredSkillEntries.some(([s]) =>
                                      (r.skills || '').split(',').map(x => x.trim().toLowerCase()).includes(s.toLowerCase())
                                    )
                                  ).length
                                : filteredBenchResources.length;

                              // Per-skill count: when search active, only count bench resources whose skill list
                              // includes that skill AND who have at least one skill matching the search
                              const getSkillCount = (skill: string): number => {
                                if (!searchTerm) return skillCountMap.get(skill) || 0;
                                return filteredBenchResources.filter(r =>
                                  r.skills && r.skills.split(',').map(s => s.trim().toLowerCase()).includes(skill.toLowerCase())
                                ).length;
                              };

                              return (
                                <Card size="small" bodyStyle={{ padding: '10px 14px' }} style={{ borderRadius: 8, border: '1px solid #f0f0f0', marginTop: 12 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                    <Space size={6}>
                                      <Text strong style={{ fontSize: 12 }}>Skills Available in Deployment Pool</Text>
                                      <Tag color="warning" style={{ fontSize: 10 }}>
                                        {searchMatchedResourceCount} resource{searchMatchedResourceCount !== 1 ? 's' : ''}
                                        {searchTerm ? ' matched' : ''}
                                      </Tag>
                                      {selectedBenchSkills.size > 0 && (
                                        <Tag
                                          color="processing"
                                          closable
                                          onClose={() => { setSelectedBenchSkills(new Set()); }}
                                          style={{ fontSize: 10 }}
                                        >
                                          {selectedBenchSkills.size} selected
                                        </Tag>
                                      )}
                                    </Space>
                                    <Space size={6}>
                                      {selectedBenchSkills.size > 0 && (
                                        <>
                                          <Button
                                            size="small"
                                            style={{ fontSize: 11 }}
                                            onClick={() => {
                                              setSelectedBenchSkills(new Set());
                                              setUnifiedFilters(prev => ({ ...prev, skills: [] }));
                                            }}
                                          >
                                            Clear
                                          </Button>
                                          <Button
                                            size="small"
                                            type="primary"
                                            style={{ fontSize: 11 }}
                                            onClick={() => {
                                              setMainTab('bench');
                                              setUnifiedFilters({
                                                ...DEFAULT_UNIFIED_FILTERS,
                                                skills: Array.from(selectedBenchSkills),
                                              });
                                            }}
                                          >
                                            Apply ({selectedBenchSkills.size})
                                          </Button>
                                        </>
                                      )}
                                      <Text type="secondary" style={{ fontSize: 10 }}>Select skills then click Apply</Text>
                                    </Space>
                                  </div>
                                  {/* Search bar */}
                                  <Input
                                    size="small"
                                    placeholder="Search skillsâ€¦"
                                    allowClear
                                    value={skillSearch}
                                    onChange={e => setSkillSearch(e.target.value)}
                                    style={{ marginBottom: 8, fontSize: 11, borderRadius: 6 }}
                                    prefix={<span style={{ color: '#bbb', fontSize: 11 }}>ðŸ”</span>}
                                  />
                                  {filteredSkillEntries.length === 0
                                    ? <Text style={{ fontSize: 11, color: '#aaa' }}>{skillEntries.length === 0 ? 'No skills data for bench resources' : 'No matching skills'}</Text>
                                    : (
                                      <>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: selectedBenchSkills.size > 0 ? 10 : 0 }}>
                                          {filteredSkillEntries.map(([skill]) => {
                                            const isSelected = selectedBenchSkills.has(skill);
                                            const cnt = getSkillCount(skill);
                                            return (
                                              <Tag
                                                key={skill}
                                                color={isSelected ? 'gold' : 'blue'}
                                                style={{
                                                  cursor: 'pointer',
                                                  fontSize: 11,
                                                  borderRadius: 12,
                                                  padding: '2px 10px',
                                                  userSelect: 'none',
                                                  border: isSelected ? '1.5px solid #d48806' : undefined,
                                                  fontWeight: isSelected ? 600 : 400,
                                                  transition: 'all 0.15s',
                                                }}
                                                onClick={() => {
                                                  const next = new Set(selectedBenchSkills);
                                                  if (isSelected) next.delete(skill); else next.add(skill);
                                                  setSelectedBenchSkills(next);
                                                }}
                                              >
                                                {skill}
                                                <span style={{ marginLeft: 5, background: isSelected ? 'rgba(130,80,0,0.15)' : 'rgba(0,0,0,0.12)', borderRadius: 8, padding: '0 5px', fontSize: 10, fontWeight: 600 }}>{cnt}</span>
                                              </Tag>
                                            );
                                          })}
                                        </div>
                                        {/* Apply / Clear action bar â€” shown only when skills are selected */}
                                        {selectedBenchSkills.size > 0 && (
                                          <div style={{ marginBottom: 0 }} />
                                        )}
                                      </>
                                    )
                                  }
                                </Card>
                              );
                            })()}
                          </>
                        )}
                        </div>
                      </div>
                    );
                  })(),
                },
              ]}
            />
      </div>

      <Drawer
        title={
          pendingAllocResources.length === 1
            ? <span>Allocate Resource  -  {pendingAllocResources[0]?.empName}</span>
            : <span>Bulk Allocate  -  {pendingAllocResources.length} Resources</span>
        }
        placement="right"
        onClose={() => {
          setAllocationDrawer(false);
          setAllocationForm({
            engagementName: '',
            allocationPercentage: '100',
            beelineId: '',
            notes: '',
            engagementStartDate: '',
            engagementEndDate: '',
          });
          setPendingAllocResources([]);
        }}
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
            <AutoComplete
              placeholder="Type or select engagement / project name"
              value={allocationForm.engagementName}
              onChange={(v) => setAllocationForm({ ...allocationForm, engagementName: v })}
              style={{ width: '100%' }}
              options={projectEngagementOptions}
              filterOption={(input, option) => String(option?.label || option?.value || '').toLowerCase().includes(input.toLowerCase())}
              allowClear
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Allocation % for this project *</label>
            <Input
              type="number"
              min={0}
              max={200}
              placeholder="0 to 200"
              value={allocationForm.allocationPercentage}
              onChange={(e) => setAllocationForm({ ...allocationForm, allocationPercentage: e.target.value })}
              suffix="%"
            />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Engagement Start Date <span style={{ fontWeight: 400, color: '#8c8c8c' }}>(optional)</span></label>
              <DatePicker
                style={{ width: '100%', fontSize: '12px' }}
                size="middle"
                format="YYYY-MM-DD"
                value={allocationForm.engagementStartDate ? dayjs(allocationForm.engagementStartDate) : null}
                onChange={(date) => setAllocationForm({
                  ...allocationForm,
                  engagementStartDate: date ? date.format('YYYY-MM-DD') : '',
                  engagementEndDate: allocationForm.engagementEndDate && date && allocationForm.engagementEndDate < date.format('YYYY-MM-DD')
                    ? ''
                    : allocationForm.engagementEndDate,
                })}
                placeholder="Select start date"
                getPopupContainer={(trigger) => trigger.parentElement || document.body}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Engagement End Date <span style={{ fontWeight: 400, color: '#8c8c8c' }}>(optional)</span></label>
              <DatePicker
                style={{ width: '100%', fontSize: '12px' }}
                size="middle"
                format="YYYY-MM-DD"
                value={allocationForm.engagementEndDate ? dayjs(allocationForm.engagementEndDate) : null}
                onChange={(date) => {
                  const nextValue = date ? date.format('YYYY-MM-DD') : '';
                  if (allocationForm.engagementStartDate && nextValue && nextValue < allocationForm.engagementStartDate) {
                    message.warning('End date must be after start date');
                    return;
                  }
                  setAllocationForm({ ...allocationForm, engagementEndDate: nextValue });
                }}
                placeholder="Select end date"
                disabledDate={(current) => !!allocationForm.engagementStartDate && !!current && current.endOf('day').isBefore(dayjs(allocationForm.engagementStartDate))}
                getPopupContainer={(trigger) => trigger.parentElement || document.body}
              />
            </div>
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Link Beeline ID <span style={{ fontWeight: 400, color: '#8c8c8c' }}>(optional)</span></label>
            <Select
              showSearch
              allowClear
              placeholder="Select Beeline ID to link"
              value={allocationForm.beelineId || undefined}
              onChange={(v) => setAllocationForm({ ...allocationForm, beelineId: v || '' })}
              style={{ width: '100%' }}
              options={beelineRequestOptions}
              filterOption={(input, option) => String(option?.value || '').toLowerCase().includes(input.toLowerCase())}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 4 }}>Notes <span style={{ fontWeight: 400, color: '#8c8c8c' }}>(saved to resource comments)</span></label>
            <Input.TextArea
              placeholder="Add notes â€” will be auto-saved as a comment on the resource"
              value={allocationForm.notes}
              onChange={(e) => setAllocationForm({ ...allocationForm, notes: e.target.value })}
              rows={3}
            />
          </div>

          <div style={{ background: '#e6fffb', borderRadius: 6, padding: '8px 12px', border: '1px solid #87e8de' }}>
            <div style={{ fontSize: '11px', color: '#006d75' }}><strong>Initial Status:</strong> {pendingTargetStatus}</div>
            <div style={{ fontSize: '11px', color: '#666', marginTop: 4 }}>
              Workflow: {allocStages.map(s => s.label).join('  ->  ')}
            </div>
          </div>

          <Space style={{ width: '100%' }} size="small">
            <Button type="primary" loading={savingAllocation} onClick={handleSaveAllocation} style={{ flex: 1 }}>
              {pendingTargetStatus === 'Offered'
                ? 'Move to Offered'
                : pendingTargetStatus === 'Joined'
                  ? 'Update Engagement'
                  : 'Shortlist'}
            </Button>
            <Button
              onClick={() => {
                setAllocationDrawer(false);
                setAllocationForm({
                  engagementName: '',
                  allocationPercentage: '100',
                  beelineId: '',
                  notes: '',
                  engagementStartDate: '',
                  engagementEndDate: '',
                });
              }}
              style={{ flex: 1 }}
            >
              Cancel
            </Button>
          </Space>
        </Space>
      </Drawer>

      {selectedDetailResource && (
        <Drawer
          title={null}
          placement="right"
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedDetailResource(null);
            setDetailExpanded(false);
          }}
          open={detailsModalOpen}
          width={detailExpanded ? 1100 : 680}
          extra={
            <Tooltip title={detailExpanded ? 'Collapse' : 'Expand'}>
              <Button
                type="text"
                icon={detailExpanded ? <ShrinkOutlined /> : <ExpandAltOutlined />}
                onClick={() => setDetailExpanded(v => !v)}
              />
            </Tooltip>
          }
        >
          <ResourceDetailPanel
            resource={selectedDetailResource}
            currentUser={currentUser?.username}
            expanded={detailExpanded}
            onToggleExpand={() => setDetailExpanded(v => !v)}
            onNavigateToRequest={onNavigateToRequest}
            onNavigateToInsights={onNavigateToInsights ? () => { setSelectedDetailResource(null); onNavigateToInsights(); } : undefined}
          />
        </Drawer>
      )}

      <ReleaseToBenchModal
        open={releaseModal}
        saving={savingRelease}
        releaseTargets={releaseTargets}
        releaseTag={releaseTag}
        setReleaseTag={setReleaseTag}
        releaseComment={releaseComment}
        setReleaseComment={setReleaseComment}
        onCancel={() => { if (!savingRelease) setReleaseModal(false); }}
        onConfirm={confirmRelease}
      />

      <BeelineLinkModal
        open={beelineLinkModal.open}
        resource={beelineLinkModal.resource}
        onCancel={() => setBeelineLinkModal({ open: false, resource: null })}
        onSave={saveBeelineLink}
        confirmLoading={beelineSaving}
        selectedBeelineId={selectedBeelineId}
        setSelectedBeelineId={setSelectedBeelineId}
        beelineRequestOptions={beelineRequestOptions}
      />

      <ResourceEditModal
        editModal={editModal}
        form={editForm}
        onCancel={() => { setEditModal({ open: false, resource: null }); editForm.resetFields(); }}
        onSave={handleSaveEdit}
        confirmLoading={editSaving}
        projectEngagementOptions={projectEngagementOptions}
        beelineRequestOptions={beelineRequestOptions}
        ensureActiveRequestOptions={ensureActiveRequestOptions}
      />
    </div>
  );

}

