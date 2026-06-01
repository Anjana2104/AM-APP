import { useState, useMemo, useEffect } from 'react';
import { Button, Space, Card, Row, Col, Tag, Upload, Tooltip, message, Segmented, Drawer, Input, Select, Collapse, Empty, Slider, FilterOutlined } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ResourceRow } from './ResourceMgmt';

interface ResourceUtilizationProps {
  resources: ResourceRow[];
  onUpdateResources: (updated: ResourceRow[]) => void;
}

interface BenchFilterState {
  piwRole: string;
  domain: string;
  skills: string;
  workexRange: [number, number];
}

export function ResourceUtilization({ resources = [], onUpdateResources }: ResourceUtilizationProps) {
  const [viewMode, setViewMode] = useState<'grouped' | 'bench'>('grouped');
  const [allocationDrawer, setAllocationDrawer] = useState(false);
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [engagementFilter, setEngagementFilter] = useState('');
  const [cachedResources, setCachedResources] = useState<ResourceRow[]>(resources || []);
  const [benchFilters, setBenchFilters] = useState<BenchFilterState>({
    piwRole: '',
    domain: '',
    skills: '',
    workexRange: [0, 100],
  });
  const [allocationForm, setAllocationForm] = useState({
    clientName: '',
    engagementName: '',
    notes: '',
  });

  useEffect(() => {
    if (resources && Array.isArray(resources)) {
      setCachedResources([...resources]);
    }
  }, [resources]);

  const benchResources = useMemo(() => {
    return (cachedResources || []).filter(r => r?.engagement === 'Bench');
  }, [cachedResources]);

  const filteredBenchResources = useMemo(() => {
    let filtered = (cachedResources || []).filter(r => r?.engagement === 'Bench');
    if (benchFilters.piwRole) {
      filtered = filtered.filter(r => r?.piwRole?.toLowerCase().includes(benchFilters.piwRole.toLowerCase()));
    }
    if (benchFilters.domain) {
      filtered = filtered.filter(r => r?.roleOrDomain?.toLowerCase().includes(benchFilters.domain.toLowerCase()));
    }
    if (benchFilters.skills) {
      filtered = filtered.filter(r => r?.skills?.toLowerCase().includes(benchFilters.skills.toLowerCase()));
    }
    filtered = filtered.filter(r => {
      const workex = parseInt(r?.totalWorkex || '0', 10);
      return workex >= benchFilters.workexRange[0] && workex <= benchFilters.workexRange[1];
    });
    return filtered;
  }, [cachedResources, benchFilters]);

  const engagementGroups = useMemo(() => {
    const groups: Record<string, ResourceRow[]> = {};
    const nonBench = (cachedResources || []).filter(r => r?.engagement !== 'Bench');
    nonBench.forEach(resource => {
      if (!resource) return;
      const eng = resource.engagement || 'Unassigned';
      if (!groups[eng]) groups[eng] = [];
      groups[eng].push(resource);
    });
    if (engagementFilter) {
      const filtered: Record<string, ResourceRow[]> = {};
      Object.entries(groups).forEach(([eng, res]) => {
        if (eng.toLowerCase().includes(engagementFilter.toLowerCase())) {
          filtered[eng] = res;
        }
      });
      return filtered;
    }
    return groups;
  }, [cachedResources, engagementFilter]);

  const engagementOptions = useMemo(() => {
    const set = new Set((cachedResources || [])
      .filter(r => r?.engagement && r.engagement !== 'Bench')
      .map(r => r.engagement as string));
    return Array.from(set).sort();
  }, [cachedResources]);

  const filterOptions = useMemo(() => {
    const bench = (cachedResources || []).filter(r => r?.engagement === 'Bench');
    return {
      piwRoles: bench.length > 0 
        ? Array.from(new Set(bench.map(r => r?.piwRole).filter(Boolean))).sort() as string[]
        : [],
      domains: bench.length > 0 
        ? Array.from(new Set(bench.map(r => r?.roleOrDomain).filter(Boolean))).sort() as string[]
        : [],
    };
  }, [cachedResources]);

  const collapsibleItems = useMemo(() => {
    return Object.entries(engagementGroups || {}).map(([engagement, groupResources]) => ({
      key: engagement,
      label: `${engagement} (${groupResources?.length || 0})`,
      children: (
        <Space direction="vertical" style={{ width: '100%' }}>
          {(groupResources || []).map(resource => {
            if (!resource) return null;
            return (
              <Card key={resource.sno} style={{ marginBottom: 12, borderLeft: '4px solid #1890ff' }} size="small">
                <Row gutter={[16, 8]}>
                  <Col xs={24} sm={16}>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600 }}>{resource.empName}</div>
                      <div style={{ fontSize: '12px', color: '#666' }}>{resource.raId} • {resource.piwRole}</div>
                    </div>
                    <Tag color="blue">{resource.engagement || 'Unassigned'}</Tag>
                  </Col>
                </Row>
              </Card>
            );
          })}
        </Space>
      ),
    }));
  }, [engagementGroups]);

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space wrap style={{ gap: '12px' }}>
            <Upload accept=".xlsx,.xls" beforeUpload={handleBenchUpload} showUploadList={false}>
              <Button icon={<UploadOutlined />} size="small">Upload Bench RAID</Button>
            </Upload>

            <Segmented
              value={viewMode}
              onChange={(value) => setViewMode(value as 'grouped' | 'bench')}
              options={[
                { label: '🔗 Engagement Mapping', value: 'grouped' },
                { label: '🏢 Bench View', value: 'bench' },
              ]}
            />

            {viewMode === 'bench' && (
              <Button icon={<FilterOutlined />} onClick={() => setFilterDrawer(true)} size="small" />
            )}
          </Space>

          <div style={{ fontSize: '12px', color: '#666' }}>
            <strong>Total:</strong> {cachedResources?.length || 0} | <strong>Bench:</strong> {benchResources?.length || 0}
          </div>

          {viewMode === 'grouped' && (
            <Select
              placeholder="Filter by engagement..."
              allowClear
              value={engagementFilter || undefined}
              onChange={(value) => setEngagementFilter(value || '')}
              options={(engagementOptions || []).map(eng => ({ label: eng, value: eng }))}
              style={{ width: '100%', maxWidth: '300px' }}
            />
          )}
        </Space>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
        {viewMode === 'grouped' ? (
          collapsibleItems.length > 0 ? (
            <Collapse items={collapsibleItems} defaultActiveKey={[]} />
          ) : (
            <Empty description="No resources found" style={{ marginTop: 48 }} />
          )
        ) : (
          <div>
            {filteredBenchResources.length === 0 ? (
              <Empty description={benchResources.length === 0 ? "No bench resources" : "No matches"} style={{ marginTop: 48 }} />
            ) : (
              <div>
                {filteredBenchResources.map(resource => {
                  if (!resource) return null;
                  return (
                    <Card key={resource.sno} style={{ marginBottom: 16, borderLeft: '4px solid #ff7a45' }} size="small">
                      <Row gutter={[16, 12]}>
                        <Col xs={24}>
                          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: 4 }}>{resource.empName}</div>
                          <div style={{ fontSize: '12px', color: '#666' }}>RAID: <strong>{resource.raId}</strong></div>
                        </Col>
                        <Col xs={24}>
                          <Row gutter={[12, 12]}>
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '11px', color: '#999' }}>PIW Role</div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{resource.piwRole || '—'}</div>
                            </Col>
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '11px', color: '#999' }}>Domain</div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{resource.roleOrDomain || '—'}</div>
                            </Col>
                            <Col xs={12} sm={6}>
                              <div style={{ fontSize: '11px', color: '#999' }}>Experience</div>
                              <div style={{ fontSize: '13px', fontWeight: 600 }}>{resource.totalWorkex || '—'} yrs</div>
                            </Col>
                          </Row>
                        </Col>
                        <Col xs={24}>
                          <Button type="primary" block onClick={() => handleAllocateResource(resource)}>
                            Allocate
                          </Button>
                        </Col>
                      </Row>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <Drawer title="Filter Bench" placement="right" onClose={() => setFilterDrawer(false)} open={filterDrawer} width={350}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8 }}>PIW Role</label>
            <Select
              placeholder="Select..."
              allowClear
              value={benchFilters.piwRole || undefined}
              onChange={(value) => setBenchFilters({ ...benchFilters, piwRole: value || '' })}
              options={(filterOptions?.piwRoles || []).map(role => ({ label: role, value: role }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8 }}>Domain</label>
            <Select
              placeholder="Select..."
              allowClear
              value={benchFilters.domain || undefined}
              onChange={(value) => setBenchFilters({ ...benchFilters, domain: value || '' })}
              options={(filterOptions?.domains || []).map(domain => ({ label: domain, value: domain }))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8 }}>Skills</label>
            <Input
              placeholder="Search..."
              value={benchFilters.skills}
              onChange={(e) => setBenchFilters({ ...benchFilters, skills: e.target.value })}
              allowClear
            />
          </div>

          <div>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: 8 }}>Experience: {benchFilters.workexRange[0]}-{benchFilters.workexRange[1]} yrs</label>
            <Slider range min={0} max={50} value={benchFilters.workexRange} onChange={(value) => setBenchFilters({ ...benchFilters, workexRange: value as [number, number] })} />
          </div>

          <Button onClick={() => setBenchFilters({ piwRole: '', domain: '', skills: '', workexRange: [0, 100] })} style={{ width: '100%' }}>
            Reset
          </Button>
        </Space>
      </Drawer>

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
    </div>
  );
}
