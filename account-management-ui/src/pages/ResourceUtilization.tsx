import { useState, useMemo, useEffect } from 'react';
import { Button, Space, Card, Row, Col, Tag, Upload, Tooltip, message, Segmented, Drawer, Input, Select, Collapse, Empty, Slider } from 'antd';
import { UploadOutlined, FilterOutlined, EyeOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import type { ResourceRow } from './ResourceMgmt';

interface ResourceUtilizationProps {
  resources: ResourceRow[];
  onUpdateResources: (updated: ResourceRow[]) => void;
}

interface BenchFilterState {
  resourceName: string;
  raid: string;
  skills: string;
  workexRange: [number, number];
}

export function ResourceUtilization({ resources = [], onUpdateResources }: ResourceUtilizationProps) {
  const [viewMode, setViewMode] = useState<'grouped' | 'bench'>('grouped');
  const [allocationDrawer, setAllocationDrawer] = useState(false);
  const [filterDrawer, setFilterDrawer] = useState(false);
  const [selectedResource, setSelectedResource] = useState<ResourceRow | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedDetailResource, setSelectedDetailResource] = useState<ResourceRow | null>(null);
  const [engagementFilter, setEngagementFilter] = useState('');
  const [cachedResources, setCachedResources] = useState<ResourceRow[]>(resources || []);
  const [benchFilters, setBenchFilters] = useState<BenchFilterState>({
    resourceName: '',
    raid: '',
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
    if (benchFilters.resourceName) {
      filtered = filtered.filter(r => r?.empName?.toLowerCase().includes(benchFilters.resourceName.toLowerCase()));
    }
    if (benchFilters.raid) {
      filtered = filtered.filter(r => r?.raId?.toLowerCase().includes(benchFilters.raid.toLowerCase()));
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
            <Space wrap style={{ width: '100%', gap: '12px' }}>
              <Input
                placeholder="Search by resource name..."
                style={{ width: '200px' }}
                value={benchFilters.resourceName}
                onChange={(e) => setBenchFilters({ ...benchFilters, resourceName: e.target.value })}
                allowClear
              />
              <Input
                placeholder="Search by RAID..."
                style={{ width: '150px' }}
                value={benchFilters.raid}
                onChange={(e) => setBenchFilters({ ...benchFilters, raid: e.target.value })}
                allowClear
              />
              <Input
                placeholder="Search by skills..."
                style={{ width: '150px' }}
                value={benchFilters.skills}
                onChange={(e) => setBenchFilters({ ...benchFilters, skills: e.target.value })}
                allowClear
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600 }}>Experience:</span>
                <Slider
                  range
                  min={0}
                  max={50}
                  style={{ width: '180px' }}
                  value={benchFilters.workexRange}
                  onChange={(value) => setBenchFilters({ ...benchFilters, workexRange: value as [number, number] })}
                />
                <span style={{ fontSize: '12px', minWidth: '60px' }}>{benchFilters.workexRange[0]}-{benchFilters.workexRange[1]} yrs</span>
              </div>
              <Button
                size="small"
                onClick={() => setBenchFilters({ resourceName: '', raid: '', skills: '', workexRange: [0, 50] })}
              >
                Reset
              </Button>
            </Space>
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
              <Row gutter={[16, 16]}>
                {filteredBenchResources.map(resource => {
                  if (!resource) return null;
                  const skillsArray = resource.skills ? resource.skills.split(',').map(s => s.trim()).slice(0, 2) : [];
                  return (
                    <Col key={resource.sno} xs={24} sm={12} md={8} lg={6}>
                      <Card 
                        style={{ height: '280px', borderLeft: '4px solid #ff7a45', display: 'flex', flexDirection: 'column' }} 
                        size="small"
                        hoverable
                      >
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                              <div style={{ fontSize: '14px', fontWeight: 700, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {resource.empName}
                              </div>
                              <Tooltip title="View Details">
                                <Button 
                                  type="text" 
                                  icon={<EyeOutlined />} 
                                  size="small"
                                  onClick={() => {
                                    setSelectedDetailResource(resource);
                                    setDetailsModalOpen(true);
                                  }}
                                  style={{ marginLeft: 4 }}
                                />
                              </Tooltip>
                            </div>
                            <div style={{ fontSize: '10px', color: '#666', marginBottom: 10, fontWeight: 500 }}>
                              <strong>RAID:</strong> {resource.raId}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px' }}>
                              <div>
                                <div style={{ color: '#999', marginBottom: 1 }}>PIW Role</div>
                                <div style={{ fontWeight: 600, color: '#333' }}>{resource.piwRole || '—'}</div>
                              </div>
                              <div>
                                <div style={{ color: '#999', marginBottom: 1 }}>Domain</div>
                                <div style={{ fontWeight: 600, color: '#333' }}>{resource.roleOrDomain || '—'}</div>
                              </div>
                              <div>
                                <div style={{ color: '#999', marginBottom: 1 }}>Experience</div>
                                <div style={{ fontWeight: 600, color: '#333' }}>{resource.totalWorkex || '—'} yrs</div>
                              </div>
                              {skillsArray.length > 0 && (
                                <div>
                                  <div style={{ color: '#999', marginBottom: 1 }}>Skills</div>
                                  <div style={{ fontSize: '10px', color: '#333', lineHeight: '1.4' }}>
                                    {skillsArray.map((skill, idx) => (
                                      <div key={idx}>• {skill}</div>
                                    ))}
                                    {resource.skills && resource.skills.split(',').length > 2 && (
                                      <div style={{ color: '#1890ff', cursor: 'pointer', marginTop: 2 }}>
                                        +{resource.skills.split(',').length - 2} more
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button 
                          type="primary" 
                          block 
                          size="small"
                          onClick={() => handleAllocateResource(resource)}
                          style={{ marginTop: 12 }}
                        >
                          Allocate
                        </Button>
                      </Card>
                    </Col>
                  );
                })}
              </Row>
            )}
          </div>
        )}
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
                  <Tag color="blue">{selectedDetailResource.engagement || 'Bench'}</Tag>
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
