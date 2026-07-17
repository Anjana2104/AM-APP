import React, { useMemo } from 'react';
import { Alert, Empty, Spin, Tag, Typography } from 'antd';

const { Text } = Typography;

export interface ResourceHistoryTimelineEntry {
  type: 'added' | 'removed';
  name: string;
  raId: string;
  date: string;
  by: string;
  startDate: string;
  endDate: string;
}

export interface ResourceHistoryLinkedResource {
  key?: string;
  empName: string;
  raId: string;
  engagementStartDate?: string;
  engagementEndDate?: string;
}

interface ResourceHistoryTimelineProps {
  loading: boolean;
  timelineEntries: ResourceHistoryTimelineEntry[];
  linkedResources: ResourceHistoryLinkedResource[];
  emptyHistoryMessage?: string;
  emptyLinkedMessage?: string;
}

function fmtDate(value: string): string {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    const asDateOnly = new Date(`${value}T00:00:00`);
    if (Number.isNaN(asDateOnly.getTime())) return value;
    return asDateOnly.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ResourceHistoryTimeline({
  loading,
  timelineEntries,
  linkedResources,
  emptyHistoryMessage = 'No audit history found — these resources were linked before audit tracking began.',
  emptyLinkedMessage = 'No resources have been linked to this SOW yet.',
}: ResourceHistoryTimelineProps) {
  const timelineGroups = useMemo(() => {
    const dateMap = new Map<string, Map<string, ResourceHistoryTimelineEntry>>();
    timelineEntries.forEach((entry) => {
      if (!dateMap.has(entry.date)) dateMap.set(entry.date, new Map());
      const key = entry.raId || entry.name;
      dateMap.get(entry.date)!.set(key, entry);
    });
    const groups: Array<{ date: string; added: ResourceHistoryTimelineEntry[]; removed: ResourceHistoryTimelineEntry[] }> = [];
    dateMap.forEach((resourceMap, date) => {
      const added: ResourceHistoryTimelineEntry[] = [];
      const removed: ResourceHistoryTimelineEntry[] = [];
      resourceMap.forEach((entry) => (entry.type === 'added' ? added : removed).push(entry));
      groups.push({ date, added, removed });
    });
    groups.sort((a, b) => a.date.localeCompare(b.date));
    return groups;
  }, [timelineEntries]);

  const runningState = useMemo(() => {
    const active = new Set<string>();
    return timelineGroups.map((group) => {
      group.added.forEach((entry) => active.add(entry.raId || entry.name));
      group.removed.forEach((entry) => active.delete(entry.raId || entry.name));
      return active.size;
    });
  }, [timelineGroups]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>;
  }

  if (timelineGroups.length === 0) {
    return (
      <div>
        {linkedResources.length > 0 ? (
          <>
            <Alert type="info" showIcon style={{ marginBottom: 12, fontSize: '11px' }} message={<Text style={{ fontSize: '11px' }}>{emptyHistoryMessage}</Text>} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {linkedResources.map((resource, index) => (
                <Tag key={resource.key || `${resource.raId}_${index}`} style={{ fontSize: '11px', padding: '2px 8px' }}>
                  {resource.empName} <Text type="secondary" style={{ fontSize: '10px' }}>({resource.raId})</Text>
                  {(resource.engagementStartDate || resource.engagementEndDate) && (
                    <Text type="secondary" style={{ fontSize: '10px' }}>
                      {' '}[{fmtDate(resource.engagementStartDate || '')} - {fmtDate(resource.engagementEndDate || '')}]
                    </Text>
                  )}
                </Tag>
              ))}
            </div>
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '11px' }}>{emptyLinkedMessage}</Text>} />
        )}
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', paddingLeft: 20 }}>
      <div style={{ position: 'absolute', left: 7, top: 12, bottom: 12, width: 2, background: '#f0f0f0', borderRadius: 1 }} />
      {timelineGroups.map((group, groupIndex) => (
        <div key={group.date} style={{ position: 'relative', marginBottom: groupIndex < timelineGroups.length - 1 ? 20 : 0 }}>
          <div style={{ position: 'absolute', left: -13, top: 3, width: 10, height: 10, borderRadius: '50%', background: group.added.length > 0 && group.removed.length > 0 ? '#faad14' : group.added.length > 0 ? '#52c41a' : '#ff4d4f', border: '2px solid #fff', boxShadow: '0 0 0 1px #d9d9d9' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <Text style={{ fontSize: '11px', fontWeight: 600, color: '#595959' }}>{fmtDate(group.date)}</Text>
            <Tag style={{ fontSize: '10px', background: '#f5f5f5', border: '1px solid #e8e8e8', color: '#595959' }}>{runningState[groupIndex]} resource{runningState[groupIndex] !== 1 ? 's' : ''} active</Tag>
          </div>
          {group.added.length > 0 && (
            <div style={{ marginBottom: group.removed.length > 0 ? 6 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Tag color="success" style={{ fontSize: '10px', margin: 0 }}>+ {group.added.length} added</Tag>
                {group.added.map((entry, i) => (
                  <span key={`a_${i}`} style={{ fontSize: '11px', color: '#262626' }}>
                    {entry.name}
                    {entry.raId && <Text type="secondary" style={{ fontSize: '10px' }}> ({entry.raId})</Text>}
                    {(entry.startDate || entry.endDate) && (
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        {' '}[{fmtDate(entry.startDate)} - {fmtDate(entry.endDate)}]
                      </Text>
                    )}
                    {i < group.added.length - 1 && <span style={{ color: '#d9d9d9', marginRight: 4 }}>,</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {group.removed.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                <Tag color="error" style={{ fontSize: '10px', margin: 0 }}>− {group.removed.length} removed</Tag>
                {group.removed.map((entry, i) => (
                  <span key={`r_${i}`} style={{ fontSize: '11px', color: '#8c8c8c', textDecoration: 'line-through' }}>
                    {entry.name}
                    {entry.raId && <Text type="secondary" style={{ fontSize: '10px' }}> ({entry.raId})</Text>}
                    {(entry.startDate || entry.endDate) && (
                      <Text type="secondary" style={{ fontSize: '10px' }}>
                        {' '}[{fmtDate(entry.startDate)} - {fmtDate(entry.endDate)}]
                      </Text>
                    )}
                    {i < group.removed.length - 1 && <span style={{ color: '#d9d9d9', marginRight: 4 }}>,</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(group.added[0]?.by || group.removed[0]?.by) && (
            <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: 3 }}>
              by {group.added[0]?.by || group.removed[0]?.by}
            </Text>
          )}
        </div>
      ))}
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f5f5f5' }}>
        <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 6 }}>Currently linked ({linkedResources.length})</Text>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {linkedResources.length > 0 ? linkedResources.map((resource, index) => (
            <div key={resource.key || `${resource.raId}_${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '4px 10px' }}>
              <Text style={{ fontSize: '11px', color: '#389e0d', fontWeight: 500 }}>{resource.empName}</Text>
              <Text type="secondary" style={{ fontSize: '10px' }}>({resource.raId})</Text>
              {(resource.engagementStartDate || resource.engagementEndDate) && (
                <Text style={{ fontSize: '10px', color: '#1677ff', marginLeft: 4 }}>
                  📅 {resource.engagementStartDate ? fmtDate(resource.engagementStartDate) : '—'} → {resource.engagementEndDate ? fmtDate(resource.engagementEndDate) : '—'}
                </Text>
              )}
            </div>
          )) : <Text type="secondary" style={{ fontSize: '11px' }}>None</Text>}
        </div>
      </div>
    </div>
  );
}
