/**
 * ResourceForecasting.tsx
 *
 * Resource Forecasting — Timeline, availability heatmap, upcoming releases,
 * and availability check powered by existing resource data.
 * UI Location: Account Operations > Resources > Resource Forecasting
 * Page ID: resources_forecasting
 */
import React, { useMemo, useState, useCallback, useRef } from 'react';
import {
  Button, Tag, Typography, Tooltip, DatePicker, Space, Row, Col,
  Card, Avatar, Empty, Segmented, Input,
} from 'antd';
import {
  TeamOutlined, ClockCircleOutlined, CheckCircleOutlined, ApartmentOutlined,
  AlertOutlined, CalendarOutlined, BarChartOutlined, FileExcelOutlined,
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import { writeJsonSheetFile } from '../utils/xlsxExport';
import dayjs, { Dayjs } from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import isBetween from 'dayjs/plugin/isBetween';
import type { ResourceRow } from '../types/resource';

dayjs.extend(isoWeek);
dayjs.extend(isBetween);

const { Text, Title } = Typography;

// ── AntD-approved project palette (8 distinct colours) ───────────────────────
const PROJECT_COLORS = [
  { bg: '#e6f4ff', border: '#91caff', text: '#0958d9' }, // blue
  { bg: '#fff7e6', border: '#ffd591', text: '#d46b08' }, // orange
  { bg: '#f9f0ff', border: '#d3adf7', text: '#531dab' }, // purple
  { bg: '#fff0f6', border: '#ffadd2', text: '#c41d7f' }, // pink
  { bg: '#e6fffb', border: '#87e8de', text: '#08979c' }, // cyan
  { bg: '#fcffe6', border: '#d3f261', text: '#5b8c00' }, // lime
  { bg: '#fff2e8', border: '#ffbb96', text: '#d4380d' }, // volcano
  { bg: '#f0f5ff', border: '#adc6ff', text: '#2f54eb' }, // geekblue
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function initials(name: string) {
  return name.split(' ').map(p => p[0] || '').slice(0, 2).join('').toUpperCase();
}

function avatarColor(name: string) {
  const colors = ['#1890ff', '#52c41a', '#722ed1', '#fa8c16', '#13c2c2', '#eb2f96', '#faad14', '#1d39c4'];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

// Build weeks array starting from a date
function buildWeeks(startDate: Dayjs, count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const wStart = startDate.startOf('isoWeek').add(i, 'week');
    return {
      key: `W${wStart.isoWeek()}`,
      label: `W${wStart.isoWeek()}`,
      start: wStart,
      end: wStart.add(6, 'day'),
    };
  });
}

// Compute merged colspan bar segments for one person across weeks
function getPersonWeekBars(
  engagements: ResourceRow[],
  weeks: Array<{ key: string; start: Dayjs; end: Dayjs }>
) {
  const colorMap = new Map<string, number>();
  let cIdx = 0;

  const cells = weeks.map(w => {
    for (const eng of engagements) {
      const s = eng.engagementStartDate ? dayjs(eng.engagementStartDate) : null;
      const e = eng.engagementEndDate ? dayjs(eng.engagementEndDate) : null;
      if (s?.isValid() && e?.isValid() && s.isBefore(w.end, 'day') && e.isAfter(w.start, 'day')) {
        const key = eng.engagement || eng.beelineId || eng.raId || 'eng';
        if (!colorMap.has(key)) { colorMap.set(key, cIdx % PROJECT_COLORS.length); cIdx++; }
        return { type: 'engaged' as const, engKey: key, colorIdx: colorMap.get(key)!, label: eng.engagement || '', pct: eng.allocationPercentage };
      }
    }
    const allEnded = engagements.length > 0 && engagements.every(eng => {
      if (eng.allocationStatus === 'Available') return true;
      const e = eng.engagementEndDate ? dayjs(eng.engagementEndDate) : null;
      return e?.isValid() && e.isBefore(w.start);
    });
    return allEnded ? { type: 'available' as const } : { type: 'empty' as const };
  });

  // Merge consecutive identical cells → single colspan
  const merged: Array<{ type: 'engaged' | 'available' | 'empty'; span: number; engKey?: string; colorIdx?: number; label?: string; pct?: number | null }> = [];
  for (let i = 0; i < cells.length;) {
    const curr = cells[i] as any;
    let span = 1;
    while (i + span < cells.length) {
      const next = cells[i + span] as any;
      if (curr.type !== next.type || (curr.type === 'engaged' && curr.engKey !== next.engKey)) break;
      span++;
    }
    merged.push({ ...curr, span });
    i += span;
  }
  return merged;
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  resources: ResourceRow[];
}

// ── Main component ────────────────────────────────────────────────────────────
export function ResourceForecasting({ resources = [] }: Props) {
  const today = dayjs();

  // ── State
  const [timelineStart, setTimelineStart] = useState<Dayjs>(today.startOf('isoWeek'));
  const [timelineSearch, setTimelineSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [activeTile, setActiveTile] = useState<string | null>(null);
  const [checkDate, setCheckDate] = useState<Dayjs>(today);
  const [releaseWindow, setReleaseWindow] = useState<7 | 15 | 30>(7);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // ── All valid resources
  const filtered = useMemo(() => resources.filter(r => r && r.empName), [resources]);

  // ── Stats — allocation % drives Fully/Partially Allocated
  const stats = useMemo(() => {
    const total = filtered.length || 1;
    const available = filtered.filter(r => r.allocationStatus === 'Available').length;
    const fullyAllocated = filtered.filter(r => (r.allocationPercentage ?? 0) >= 100).length;
    const partiallyAllocated = filtered.filter(r => {
      const pct = r.allocationPercentage ?? 0;
      return pct > 0 && pct < 100;
    }).length;
    const countReleasing = (days: number) => filtered.filter(r => {
      if (!r.engagementEndDate) return false;
      const end = dayjs(r.engagementEndDate);
      return end.isValid() && end.isAfter(today) && end.isBefore(today.add(days + 1, 'day'));
    }).length;
    return { available, fullyAllocated, partiallyAllocated, total, releasing7: countReleasing(7), releasing15: countReleasing(15), releasing30: countReleasing(30) };
  }, [filtered, today]);

  // ── Timeline — exactly 60 days (9 weeks) from selected start
  const WEEK_COUNT = 9; // 9 × 7 = 63 days covers the 60-day window
  const weeks = useMemo(() => buildWeeks(timelineStart, WEEK_COUNT), [timelineStart]);
  const TODAY_COL_IDX = weeks.findIndex(w => today.isBetween(w.start, w.end, 'day', '[]'));

  // Month groups for colspan header
  const monthGroups = useMemo(() => {
    const groups: { month: string; colSpan: number }[] = [];
    for (const w of weeks) {
      const key = w.start.format('MMM YYYY');
      if (groups.length > 0 && groups[groups.length - 1].month === key) {
        groups[groups.length - 1].colSpan++;
      } else {
        groups.push({ month: key, colSpan: 1 });
      }
    }
    return groups;
  }, [weeks]);

  // Group rows by person (raId or empName) for merged timeline rows
  const groupedResources = useMemo(() => {
    const map = new Map<string, ResourceRow[]>();
    for (const r of filtered) {
      const key = r.raId || r.empName;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return Array.from(map.values());
  }, [filtered]);

  // ── Search-filtered resources + tile filter + lazy visible slice
  const searchedResources = useMemo(() => {
    let base = groupedResources;

    // Apply tile filter
    if (activeTile) {
      base = base.filter(group => {
        const rep = group[0];
        if (activeTile === 'Available Now') return rep.allocationStatus === 'Available';
        if (activeTile === 'Fully Allocated') return (rep.allocationPercentage ?? 0) >= 100;
        if (activeTile === 'Partially Allocated') { const p = rep.allocationPercentage ?? 0; return p > 0 && p < 100; }
        if (activeTile === 'Releasing (7 days)') {
          const e = rep.engagementEndDate ? dayjs(rep.engagementEndDate) : null;
          return e?.isValid() && e.isAfter(today) && e.isBefore(today.add(8, 'day'));
        }
        if (activeTile === 'Releasing (15 days)') {
          const e = rep.engagementEndDate ? dayjs(rep.engagementEndDate) : null;
          return e?.isValid() && e.isAfter(today) && e.isBefore(today.add(16, 'day'));
        }
        if (activeTile === 'Releasing (30 days)') {
          const e = rep.engagementEndDate ? dayjs(rep.engagementEndDate) : null;
          return e?.isValid() && e.isAfter(today) && e.isBefore(today.add(31, 'day'));
        }
        return true;
      });
    }

    // Apply text search
    const q = timelineSearch.trim().toLowerCase();
    if (q) {
      base = base.filter(group =>
        group.some(r =>
          r.empName.toLowerCase().includes(q) ||
          (r.raId || '').toLowerCase().includes(q) ||
          (r.roleOrDomain || r.piwRole || '').toLowerCase().includes(q)
        )
      );
    }
    return base;
  }, [groupedResources, timelineSearch, activeTile, today]);

  const handleTimelineScroll = useCallback(() => {
    const el = timelineScrollRef.current;
    if (!el) return;
    // Load 20 more when within 80px of bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      setVisibleCount(c => Math.min(c + 20, searchedResources.length));
    }
  }, [searchedResources.length]);
  const availableOnDate = useMemo(() => {
    return filtered.filter(r => {
      if (r.allocationStatus === 'Available') return true;
      if (!r.engagementEndDate) return false;
      const end = dayjs(r.engagementEndDate);
      return end.isValid() && end.isBefore(checkDate);
    });
  }, [filtered, checkDate]);

  // ── Upcoming releases (driven by releaseWindow filter)
  const upcomingReleases = useMemo(() => {
    return filtered
      .filter(r => {
        if (!r.engagementEndDate) return false;
        const end = dayjs(r.engagementEndDate);
        return end.isValid() && end.isAfter(today.subtract(1, 'day')) && end.isBefore(today.add(releaseWindow + 1, 'day'));
      })
      .sort((a, b) => dayjs(a.engagementEndDate).valueOf() - dayjs(b.engagementEndDate).valueOf());
  }, [filtered, today, releaseWindow]);

  // ── XLS export for timeline
  const handleExportTimeline = () => {
    const data = filtered.map(r => ({
      'Employee Name': r.empName,
      'RA ID': r.raId,
      'Role / Domain': r.roleOrDomain || r.piwRole || '',
      'PIW Role': r.piwRole || '',
      'Engagement': r.engagement || '',
      'Allocation Status': r.allocationStatus || '',
      'Eng. Start Date': r.engagementStartDate || '',
      'Eng. End Date': r.engagementEndDate || '',
      'Allocation %': r.allocationPercentage ?? '',
    }));
    writeJsonSheetFile(XLSX, data, 'Timeline', `resource-allocation-timeline-${today.format('YYYY-MM-DD')}.xlsx`);
  };



  const handleExportAvailability = () => {
    const data = availableOnDate.map(r => ({
      'Employee Name': r.empName,
      'RA ID': r.raId,
      'Role / Domain': r.roleOrDomain || r.piwRole || '',
      'Allocation Status': r.allocationStatus || '',
      'Engagement End Date': r.engagementEndDate || '',
    }));
    writeJsonSheetFile(XLSX, data, 'Availability', `availability-${checkDate.format('YYYY-MM-DD')}.xlsx`);
  };

  const handleExportReleases = () => {
    const data = upcomingReleases.map(r => ({
      'Employee Name': r.empName,
      'RA ID': r.raId,
      'Role / Domain': r.roleOrDomain || r.piwRole || '',
      'Engagement': r.engagement || '',
      'Allocation %': r.allocationPercentage ?? '',
      'Release Date': r.engagementEndDate || '',
    }));
    writeJsonSheetFile(XLSX, data, 'Upcoming Releases', `upcoming-releases-${today.format('YYYY-MM-DD')}.xlsx`);
  };

  // ── Stat card config
  const statCards = [
    { icon: <TeamOutlined />, color: '#595959', bg: '#f5f5f5', label: 'Total Resources', value: filtered.length, pct: 100, filterable: false },
    { icon: <CheckCircleOutlined />, color: '#13c2c2', bg: '#e6fffb', label: 'Available Now', value: stats.available, pct: Math.round(stats.available / stats.total * 100), filterable: true },
    { icon: <ApartmentOutlined />, color: '#1890ff', bg: '#e6f4ff', label: 'Fully Allocated', value: stats.fullyAllocated, pct: Math.round(stats.fullyAllocated / stats.total * 100), filterable: true },
    { icon: <ClockCircleOutlined />, color: '#722ed1', bg: '#f9f0ff', label: 'Partially Allocated', value: stats.partiallyAllocated, pct: Math.round(stats.partiallyAllocated / stats.total * 100), filterable: true },
    { icon: <AlertOutlined />, color: '#fa8c16', bg: '#fff7e6', label: 'Releasing (7 days)', value: stats.releasing7, pct: Math.round(stats.releasing7 / stats.total * 100), filterable: true },
    { icon: <AlertOutlined />, color: '#fa541c', bg: '#fff2e8', label: 'Releasing (15 days)', value: stats.releasing15, pct: Math.round(stats.releasing15 / stats.total * 100), filterable: true },
    { icon: <AlertOutlined />, color: '#ff4d4f', bg: '#fff1f0', label: 'Releasing (30 days)', value: stats.releasing30, pct: Math.round(stats.releasing30 / stats.total * 100), filterable: true },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: '#f5f7fa', padding: '16px 20px' }}>

      {/* ── Stat Cards ────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
          {statCards.map(s => {
            const isActive = activeTile === s.label;
            const isClickable = s.filterable;
            return (
              <div
                key={s.label}
                style={{ flex: '1 1 0', minWidth: 100, cursor: isClickable ? 'pointer' : 'default' }}
                onClick={() => {
                  if (!isClickable) return;
                  setActiveTile(isActive ? null : s.label);
                  setVisibleCount(10);
                }}
              >
                <Card
                  size="small"
                  styles={{ body: { padding: '10px 12px' } }}
                  style={{
                    borderRadius: 8,
                    border: isActive ? `2px solid ${s.color}` : '1px solid #f0f0f0',
                    height: '100%',
                    background: isActive ? s.bg : '#fff',
                    boxShadow: isActive ? `0 0 0 2px ${s.color}22` : undefined,
                    transition: 'all 0.2s',
                  }}
                >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: s.bg, color: s.color,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, flexShrink: 0,
                  }}>
                    {s.icon}
                  </div>
                  <Text style={{ fontSize: 11, lineHeight: '14px', color: isActive ? s.color : '#8c8c8c', fontWeight: isActive ? 600 : 400 }}>{s.label}</Text>
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
                <Text type="secondary" style={{ fontSize: 10 }}>{s.pct}% of total</Text>
                {isClickable && isActive && (
                  <div style={{ marginTop: 4, fontSize: 9, color: s.color, fontWeight: 500 }}>✓ Filtered · click to clear</div>
                )}
              </Card>
            </div>
            );
          })}
        </div>

        {/* ── Main Row: Timeline (left) + Availability/Releases (right) ── */}
        <Row gutter={[12, 12]} style={{ flex: 1 }}>

          {/* LEFT: Resource Allocation Timeline */}
          <Col xs={24} lg={16} style={{ display: 'flex', flexDirection: 'column' }}>
            <Card
              size="small"
              title={
                <Space size={6}>
                  <BarChartOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: 12 }}>Resource Allocation Timeline</Text>
                </Space>
              }
              extra={
                <Space size={6}>
                  <Input.Search
                    size="small"
                    placeholder="Search employee…"
                    allowClear
                    value={timelineSearch}
                    onChange={e => { setTimelineSearch(e.target.value); setVisibleCount(10); }}
                    className="timeline-search"
                    style={{ width: 150 }}
                  />
                  <Tooltip title="Shows 60 days from selected start date" placement="bottomRight">
                    <div style={{ fontSize: 11 }}>
                      <DatePicker
                        size="small"
                        value={timelineStart}
                        onChange={v => v && setTimelineStart(v.startOf('isoWeek'))}
                        format="DD MMM YY"
                        allowClear={false}
                        placeholder="Start date"
                        className="timeline-range-picker"
                        style={{ width: 110, fontSize: 11 }}
                        renderExtraFooter={() => (
                          <div style={{ padding: '6px 8px', fontSize: 11, color: '#8c8c8c' }}>
                            Timeline will show 60 days from this date
                          </div>
                        )}
                      />
                    </div>
                  </Tooltip>
                  <Tooltip title="Export to Excel (.xlsx)">
                    <Button
                      type="text"
                      size="small"
                      icon={<FileExcelOutlined style={{ color: '#52c41a', fontSize: 14 }} />}
                      onClick={handleExportTimeline}
                      style={{ padding: '0 4px' }}
                    />
                  </Tooltip>
                </Space>
              }
              styles={{ body: { padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' } }}
              style={{ borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', height: 500 }}
            >
              <div
                ref={timelineScrollRef}
                onScroll={handleTimelineScroll}
                style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                  <colgroup>
                    <col style={{ width: 150 }} />
                    {weeks.map(w => <col key={w.key} />)}
                  </colgroup>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 3 }}>
                    {/* Month header */}
                    <tr style={{ background: '#fafafa' }}>
                      <th style={{ padding: '4px 8px', textAlign: 'left', fontSize: 10, color: '#8c8c8c', fontWeight: 700, borderBottom: '1px solid #f0f0f0', background: '#fafafa' }}>
                        Resource ({searchedResources.length}{timelineSearch ? ` of ${groupedResources.length}` : ''})
                      </th>
                      {monthGroups.map(m => (
                        <th key={m.month} colSpan={m.colSpan} style={{
                          padding: '4px 4px', textAlign: 'left', fontSize: 10,
                          color: '#1890ff', fontWeight: 700,
                          borderBottom: '1px solid #f0f0f0', borderLeft: '1px solid #e8e8e8',
                          background: '#fafafa',
                        }}>
                          {m.month}
                        </th>
                      ))}
                    </tr>
                    {/* Week header */}
                    <tr style={{ background: '#f5f5f5' }}>
                      <th style={{ padding: '2px 8px', fontSize: 9, color: '#bfbfbf', fontWeight: 400, borderBottom: '1px solid #f0f0f0', textAlign: 'left' }} />
                      {weeks.map((w, i) => (
                        <th key={w.key} style={{
                          padding: '2px 1px', textAlign: 'center', fontSize: 9,
                          borderBottom: '1px solid #f0f0f0', borderLeft: '1px solid #e8e8e8',
                          background: i === TODAY_COL_IDX ? '#e6f4ff' : '#f5f5f5',
                          color: i === TODAY_COL_IDX ? '#1890ff' : '#595959',
                          fontWeight: i === TODAY_COL_IDX ? 700 : 500,
                          position: 'relative',
                        }}>
                          {i === TODAY_COL_IDX && (
                            <div style={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', background: '#1890ff', color: '#fff', fontSize: 7, padding: '0 2px', borderRadius: 2, whiteSpace: 'nowrap', zIndex: 1 }}>
                              Today
                            </div>
                          )}
                          <div style={{ lineHeight: '13px' }}>{w.key}</div>
                          <div style={{ fontSize: 8, fontWeight: 400, color: i === TODAY_COL_IDX ? '#4096ff' : '#8c8c8c', lineHeight: '11px', whiteSpace: 'nowrap' }}>
                            {w.start.format('D')}–{w.end.format('D')}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {searchedResources.length === 0 ? (
                      <tr>
                        <td colSpan={weeks.length + 1} style={{ padding: 40, textAlign: 'center' }}>
                          <Empty description={<Text type="secondary" style={{ fontSize: 12 }}>No resources found.</Text>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
                        </td>
                      </tr>
                    ) : (
                      searchedResources.slice(0, visibleCount).map((group, gi) => {
                        const rep = group[0];
                        const segments = getPersonWeekBars(group, weeks);
                        const rowBg = gi % 2 === 0 ? '#fff' : '#fafcff';
                        return (
                          <tr key={rep.raId || rep.empName} style={{ borderBottom: '1px solid #f0f0f0' }}>
                            {/* Resource info cell */}
                            <td style={{ padding: '4px 8px', verticalAlign: 'middle', background: rowBg, borderRight: '1px solid #e8e8e8' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Avatar size={22} style={{ background: avatarColor(rep.empName), fontSize: 9, flexShrink: 0 }}>
                                  {initials(rep.empName)}
                                </Avatar>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{rep.empName}</div>
                                  <Text type="secondary" style={{ fontSize: 9, display: 'block' }}>{rep.raId}</Text>
                                  <Text type="secondary" style={{ fontSize: 9, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{rep.roleOrDomain || rep.piwRole || ''}</Text>
                                </div>
                              </div>
                            </td>
                            {/* Colspan-merged bar segments */}
                            {segments.map((seg, si) => {
                              if (seg.type === 'engaged') {
                                const c = PROJECT_COLORS[seg.colorIdx ?? 0];
                                const barLabel = `${seg.label || ''}${seg.pct != null ? `  ${seg.pct}%` : ''}`;
                                return (
                                  <td key={si} colSpan={seg.span} style={{ padding: '3px 2px', verticalAlign: 'middle', background: rowBg, borderLeft: '1px solid #f0f0f0' }}>
                                    <Tooltip title={barLabel.trim()} overlayInnerStyle={{ fontSize: 11 }}>
                                      <div style={{
                                        background: c.bg, border: `1px solid ${c.border}`,
                                        borderRadius: 3, padding: '2px 4px',
                                        fontSize: 9, color: c.text, fontWeight: 600,
                                        overflow: 'hidden', textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap', cursor: 'default', minHeight: 18,
                                        display: 'flex', alignItems: 'center', gap: 2,
                                      }}>
                                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {seg.span > 1 ? (seg.label || '') : ''}
                                        </span>
                                        {seg.pct != null && (
                                          <span style={{ flexShrink: 0, fontWeight: 700 }}>{seg.pct}%</span>
                                        )}
                                      </div>
                                    </Tooltip>
                                  </td>
                                );
                              }
                              if (seg.type === 'available') {
                                return (
                                  <td key={si} colSpan={seg.span} style={{ padding: '3px 2px', verticalAlign: 'middle', background: rowBg, borderLeft: '1px solid #f0f0f0' }}>
                                    <div style={{
                                      background: '#f6ffed', border: '1px dashed #b7eb8f',
                                      borderRadius: 3, padding: '2px 4px', fontSize: 9,
                                      color: '#52c41a', fontWeight: 500, minHeight: 18,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                      {seg.span > 2 ? 'Available' : ''}
                                    </div>
                                  </td>
                                );
                              }
                              return <td key={si} colSpan={seg.span} style={{ background: rowBg, borderLeft: '1px solid #f0f0f0' }} />;
                            })}
                          </tr>
                        );
                      })
                    )}
                    {visibleCount < searchedResources.length && (
                      <tr>
                        <td colSpan={weeks.length + 1} style={{ padding: '6px 12px', textAlign: 'center', background: '#fafafa', borderTop: '1px solid #f0f0f0' }}>
                          <Button
                            type="link"
                            size="small"
                            style={{ fontSize: 11 }}
                            onClick={() => setVisibleCount(c => c + 20)}
                          >
                            Load more ({searchedResources.length - visibleCount} remaining)
                          </Button>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </Col>

          {/* RIGHT: Check Availability (top) + Upcoming Releases (bottom) */}
          <Col xs={24} lg={8} style={{ display: 'flex', flexDirection: 'column', gap: 10, height: 500 }}>

            {/* Check Availability */}
            <Card
              size="small"
              title={
                <Space size={6}>
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <Text strong style={{ fontSize: 12 }}>Check Availability</Text>
                </Space>
              }
              extra={
                <Space size={4}>
                  <Tooltip title="Select the start date" placement="bottom">
                    <DatePicker
                      size="small"
                      value={checkDate}
                      onChange={v => v && setCheckDate(v)}
                      className="timeline-range-picker"
                      format="DD MMM YY"
                      style={{ width: 100 }}
                      allowClear={false}
                    />
                  </Tooltip>
                  <Tooltip title="Export to Excel (.xlsx)">
                    <Button
                      type="text"
                      size="small"
                      icon={<FileExcelOutlined style={{ color: '#52c41a', fontSize: 13 }} />}
                      onClick={handleExportAvailability}
                      style={{ padding: '0 4px' }}
                    />
                  </Tooltip>
                </Space>
              }
              style={{ borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 12px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text strong style={{ fontSize: 11 }}>Available ({availableOnDate.length})</Text>
                <Tag color="green" style={{ fontSize: 10 }}>{checkDate.format('D MMM YYYY')}</Tag>
              </div>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5 }}>
                {availableOnDate.length === 0 ? (
                  <Empty description={<Text type="secondary" style={{ fontSize: 11 }}>No resources available</Text>} image={Empty.PRESENTED_IMAGE_SIMPLE} imageStyle={{ height: 28 }} />
                ) : (
                  availableOnDate.map(r => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar size={22} style={{ background: avatarColor(r.empName), fontSize: 9, flexShrink: 0 }}>
                        {initials(r.empName)}
                      </Avatar>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.empName}</div>
                        <Text type="secondary" style={{ fontSize: 10 }}>{r.roleOrDomain || r.piwRole || '—'}</Text>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Upcoming Releases */}
            <Card
              size="small"
              title={
                <Space size={6}>
                  <ClockCircleOutlined style={{ color: '#fa8c16' }} />
                  <Text strong style={{ fontSize: 12 }}>Upcoming Releases</Text>
                </Space>
              }
              extra={
                <Space size={4}>
                  <Segmented
                    size="small"
                    value={releaseWindow}
                    onChange={v => setReleaseWindow(v as 7 | 15 | 30)}
                    options={[
                      { label: '7d', value: 7 },
                      { label: '15d', value: 15 },
                      { label: '30d', value: 30 },
                    ]}
                    style={{ fontSize: 10 }}
                  />
                  {upcomingReleases.length > 0 && (
                    <Tag color="orange" style={{ fontSize: 10 }}>{upcomingReleases.length}</Tag>
                  )}
                  <Tooltip title="Export to Excel (.xlsx)">
                    <Button
                      type="text"
                      size="small"
                      icon={<FileExcelOutlined style={{ color: '#52c41a', fontSize: 14 }} />}
                      onClick={handleExportReleases}
                      style={{ padding: '0 4px' }}
                    />
                  </Tooltip>
                </Space>
              }
              style={{ borderRadius: 8, flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
              styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '10px 12px' } }}
            >
              {upcomingReleases.length === 0 ? (
                <Empty description={<Text type="secondary" style={{ fontSize: 11 }}>No releases in this window</Text>} image={Empty.PRESENTED_IMAGE_SIMPLE} imageStyle={{ height: 28 }} />
              ) : (
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {upcomingReleases.map(r => (
                    <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Avatar size={24} style={{ background: avatarColor(r.empName), fontSize: 9, flexShrink: 0 }}>
                        {initials(r.empName)}
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.empName}</div>
                        <Text type="secondary" style={{ fontSize: 10, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {r.engagement || r.beelineId || r.roleOrDomain || '—'}
                          {r.allocationPercentage != null ? ` · ${r.allocationPercentage}%` : ''}
                        </Text>
                      </div>
                      <Tag color="orange" style={{ fontSize: 10, margin: 0, flexShrink: 0 }}>
                        {r.engagementEndDate ? dayjs(r.engagementEndDate).format('D MMM') : '—'}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </Col>
        </Row>
    </div>
  );
}

export default ResourceForecasting;
