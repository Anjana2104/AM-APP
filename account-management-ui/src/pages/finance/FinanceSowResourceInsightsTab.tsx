import React, { useCallback, useMemo, useRef, useState } from 'react';
import { DownloadOutlined } from '@ant-design/icons';
import { Button, Card, Collapse, Empty, Input, Select, Space, Spin, Switch, Tag, Tooltip, Typography, message } from 'antd';
import { getProcessResourceHistory } from '../../api/auditApi';
import type { ResourceInsightRow } from '../../api/processApi';
import { getResources } from '../../api/resourceApi';
import ResourceHistoryTimeline, { type ResourceHistoryLinkedResource, type ResourceHistoryTimelineEntry } from '../../components/ResourceHistoryTimeline';
import { exportChartAsPng } from '../../utils/exportChartAsPng';

const { Text } = Typography;

interface FinanceSowResourceInsightsTabProps {
  rows: ResourceInsightRow[];
  loading: boolean;
}

function isProcessActive(value: string): boolean {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'yes' || normalized === 'active' || normalized === 'true' || normalized === '1';
}

export function FinanceSowResourceInsightsTab({ rows, loading }: FinanceSowResourceInsightsTabProps) {
  const [projectFilter, setProjectFilter] = useState<string | null>(null);
  const [sowSearch, setSowSearch] = useState('');
  const [resourceNameFilter, setResourceNameFilter] = useState<string[]>([]);
  const [showOnlyActiveProjects, setShowOnlyActiveProjects] = useState(true);
  const [historyBySowId, setHistoryBySowId] = useState<Record<number, ResourceHistoryTimelineEntry[]>>({});
  const [loadingHistorySowId, setLoadingHistorySowId] = useState<number | null>(null);
  const [exportingProjectName, setExportingProjectName] = useState<string | null>(null);
  const [expandedProjectKeys, setExpandedProjectKeys] = useState<string[]>([]);
  const projectSectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const normalizeProjectName = useCallback((row: ResourceInsightRow) => {
    const name = String(row.projectName || '').trim();
    return name || 'Unassigned Project';
  }, []);
  const normalizeResourceName = useCallback((row: ResourceInsightRow) => {
    const name = String(row.empName || '').trim();
    if (name) return name;
    const ra = String(row.raId || '').trim();
    return ra || 'Unknown Resource';
  }, []);

  const filtered = useMemo(() => {
    const q = sowSearch.trim().toLowerCase();
    return rows.filter((row) => {
      if (projectFilter && normalizeProjectName(row) !== projectFilter) return false;
      if (q && !String(row.sow || '').toLowerCase().includes(q)) return false;
      if (resourceNameFilter.length > 0 && !resourceNameFilter.includes(normalizeResourceName(row))) return false;
      if (showOnlyActiveProjects && String(row.projectStatus).trim().toLowerCase() !== 'active') return false;
      return true;
    });
  }, [rows, projectFilter, sowSearch, resourceNameFilter, showOnlyActiveProjects, normalizeProjectName, normalizeResourceName]);

  const projectOptions = useMemo(
    () => Array.from(new Set(
      rows
        .map((row) => normalizeProjectName(row))
        .filter(Boolean),
    ))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value })),
    [rows, normalizeProjectName],
  );

  const resourceNameOptions = useMemo(
    () => Array.from(new Set(
      rows
        .map((row) => normalizeResourceName(row))
        .filter(Boolean),
    ))
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: value, value })),
    [rows, normalizeResourceName],
  );

  const projectGroups = useMemo(() => {
    const map = new Map<string, ResourceInsightRow[]>();
    filtered.forEach((row) => {
      const key = normalizeProjectName(row);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    });
    return Array.from(map.entries());
  }, [filtered, normalizeProjectName]);

  const loadResourceHistory = async (sowId: number) => {
    if (historyBySowId[sowId] !== undefined || loadingHistorySowId === sowId) return;
    setLoadingHistorySowId(sowId);
    try {
      const [auditRaw, { resources }] = await Promise.all([
        getProcessResourceHistory(sowId),
        getResources(),
      ]);
      const pidStr = String(sowId);
      const resourceDateByRaId = new Map<string, { startDate: string; endDate: string }>();
      (resources || []).forEach((resource: any) => {
        const raId = String(resource.ra_id || resource.raId || '').trim();
        if (!raId) return;
        resourceDateByRaId.set(raId, {
          startDate: String(resource.engagement_start_date || resource.engagementStartDate || ''),
          endDate: String(resource.engagement_end_date || resource.engagementEndDate || ''),
        });
      });

      const events: ResourceHistoryTimelineEntry[] = (auditRaw || []).map((entry: any) => {
        const parts = String(entry.record_name || '').split(' - ');
        const raId = parts[0]?.trim() || '';
        const name = parts.slice(1).join(' - ').trim() || entry.record_name || '';
        const type: 'added' | 'removed' = String(entry.new_value) === pidStr ? 'added' : 'removed';
        const dt = entry.changed_at || '';
        const date = dt.slice(0, 10);
        const dates = resourceDateByRaId.get(raId);
        return {
          type,
          name,
          raId,
          date,
          by: entry.changed_by || '',
          startDate: dates?.startDate || '',
          endDate: dates?.endDate || '',
        };
      });
      events.sort((a, b) => a.date.localeCompare(b.date));
      setHistoryBySowId((prev) => ({ ...prev, [sowId]: events }));
    } catch (error) {
      console.error('[FinanceSowResourceInsightsTab] Failed to load resource history', error);
      message.error('Failed to load resource history for this SOW');
      setHistoryBySowId((prev) => ({ ...prev, [sowId]: [] }));
    } finally {
      setLoadingHistorySowId(null);
    }
  };

  const handleExportProjectPng = async (projectName: string) => {
    if (!expandedProjectKeys.includes(projectName)) {
      setExpandedProjectKeys((prev) => [...prev, projectName]);
      await new Promise((resolve) => window.setTimeout(resolve, 220));
    }
    const target = projectSectionRefs.current[projectName];
    if (!target) {
      message.error('Unable to export this project right now. Please expand it once and retry.');
      return;
    }
    setExportingProjectName(projectName);
    try {
      const safeName = (projectName || 'project')
        .replace(/[<>:"/\\|?*]+/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 80);
      await exportChartAsPng(target, `resource-insights-${safeName}-${new Date().toISOString().slice(0, 10)}.png`, '#f5f7fa');
    } catch {
      message.error('Failed to export project insights PNG');
    } finally {
      setExportingProjectName(null);
    }
  };

  return (
    <>
      <Card style={{ border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.08)', borderRadius: 8, marginTop: -8 }}>
        <Space wrap size={8} style={{ marginBottom: 8, marginTop: -6 }}>
          <Space size={6}>
            <Text style={{ fontSize: 11, color: '#595959' }}>Project Status</Text>
            <Switch
              size="small"
              checked={showOnlyActiveProjects}
              checkedChildren="Active"
              unCheckedChildren="All"
              onChange={setShowOnlyActiveProjects}
            />
          </Space>
          <Select
            size="small"
            allowClear
            placeholder="Filter by Project Name"
            value={projectFilter}
            onChange={(value) => setProjectFilter(value ?? null)}
            options={projectOptions}
            style={{ minWidth: 220, fontSize: 11 }}
          />
          <Input
            size="small"
            allowClear
            placeholder="Search SOW..."
            value={sowSearch}
            onChange={(event) => setSowSearch(event.target.value)}
            style={{ width: 180, fontSize: 11 }}
          />
          <Select
            size="small"
            mode="multiple"
            allowClear
            showSearch
            placeholder="Filter by Resource Name"
            value={resourceNameFilter}
            onChange={(values) => setResourceNameFilter(values)}
            options={resourceNameOptions}
            style={{ minWidth: 260, fontSize: 11 }}
            maxTagCount="responsive"
          />
        </Space>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>
        ) : filtered.length === 0 ? (
          <Empty description={<Text type="secondary" style={{ fontSize: 11 }}>No linked project/SOW/resource data found</Text>} />
        ) : (
          <Collapse
            size="small"
            activeKey={expandedProjectKeys}
            onChange={(activeKeys) => {
              const keys = Array.isArray(activeKeys) ? activeKeys : [activeKeys];
              setExpandedProjectKeys(keys.map(String));
            }}
            items={projectGroups.map(([projectName, projectRows]) => {
              const sowGroups = new Map<number, ResourceInsightRow[]>();
              projectRows.forEach((row) => {
                if (!sowGroups.has(row.sowId)) sowGroups.set(row.sowId, []);
                sowGroups.get(row.sowId)!.push(row);
              });
              return {
                key: projectName,
                label: (
                  <Space size={8}>
                    <Text style={{ fontSize: 12, fontWeight: 600 }}>{projectName}</Text>
                    <Tag color={String(projectRows[0]?.projectStatus).trim().toLowerCase() === 'active' ? 'success' : 'volcano'} style={{ fontSize: 10 }}>
                      {String(projectRows[0]?.projectStatus || 'Active')}
                    </Tag>
                    <Tag color="blue" style={{ fontSize: 10 }}>{Array.from(sowGroups.keys()).length} SOWs</Tag>
                    <Tag color="green" style={{ fontSize: 10 }}>{projectRows.filter((row) => isProcessActive(row.processActive)).length} Resources (Active)</Tag>
                    <Tag color="volcano" style={{ fontSize: 10 }}>{projectRows.filter((row) => !isProcessActive(row.processActive)).length} Resources (Inactive)</Tag>
                    <Tooltip title="Export to PNG">
                      <Button
                        type="text"
                        size="small"
                        icon={<DownloadOutlined style={{ fontSize: 12 }} />}
                        loading={exportingProjectName === projectName}
                        onClick={(event) => {
                          event.stopPropagation();
                          void handleExportProjectPng(projectName);
                        }}
                      />
                    </Tooltip>
                  </Space>
                ),
                children: (
                  <div ref={(node) => { projectSectionRefs.current[projectName] = node; }}>
                    <Collapse
                      size="small"
                      items={Array.from(sowGroups.entries()).map(([sowId, sowRows]) => {
                        const sow = sowRows[0];
                        const sowHasAnyActiveProcess = sowRows.some((row) => isProcessActive(row.processActive));
                        const linkedResources: ResourceHistoryLinkedResource[] = sowRows.map((row) => ({
                          key: `${row.sowId}_${row.resourceId}`,
                          empName: normalizeResourceName(row),
                          raId: row.raId,
                          engagementStartDate: row.engagementStartDate,
                          engagementEndDate: row.engagementEndDate,
                        }));
                        return {
                          key: `${sowId}`,
                          label: (
                            <Space size={8}>
                              <Text style={{ fontSize: 11 }}>{sow.sow}</Text>
                              <Tag color="processing" style={{ fontSize: 10 }}>{sow.processId || `P${sowId}`}</Tag>
                              <Tag color={sowHasAnyActiveProcess ? 'success' : 'volcano'} style={{ fontSize: 10 }}>
                                {sowHasAnyActiveProcess ? 'Active' : 'Inactive'}
                              </Tag>
                            </Space>
                          ),
                          children: (
                            <div>
                              <div style={{ marginTop: 10, background: '#fafafa', border: '1px solid #f0f0f0', borderRadius: 8, padding: 10 }}>
                                <ResourceHistoryTimeline
                                  loading={loadingHistorySowId === sowId}
                                  timelineEntries={historyBySowId[sowId] || []}
                                  linkedResources={linkedResources}
                                  emptyHistoryMessage="No link/unlink history found for this SOW."
                                />
                              </div>
                            </div>
                          ),
                        };
                      })}
                      onChange={(activeKeys) => {
                        const keys = Array.isArray(activeKeys) ? activeKeys : [activeKeys];
                        keys.forEach((key) => {
                          const id = parseInt(String(key), 10);
                          if (!Number.isNaN(id)) loadResourceHistory(id);
                        });
                      }}
                    />
                  </div>
                ),
              };
            })}
          />
        )}
      </Card>
    </>
  );
}

export default FinanceSowResourceInsightsTab;
