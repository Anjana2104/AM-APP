import React, { useEffect, useMemo, useRef, useState } from 'react';
import { captureElementCanvas } from '../../utils/exportChartAsPng';
import { jsPDF } from 'jspdf';
import { Alert, Button, Card, Col, Empty, Row, Select, Space, Spin, Table, Tag, Tooltip, Typography } from 'antd';
import { CheckCircleFilled, CommentOutlined, FilePdfOutlined, FileProtectOutlined, FileWordOutlined, HistoryOutlined, InfoCircleOutlined, RightOutlined, TeamOutlined } from '@ant-design/icons';
import * as auditApi from '../../api/auditApi';
import * as processApi from '../../api/processApi';
import * as resourceApi from '../../api/resourceApi';
import type { ResourceRow } from '../../types/resource';

const { Text } = Typography;

type ProcessDetailRow = {
  key: string;
  id?: number;
  startDate: string;
  sow: string;
  signedSow: string;
  piw: string;
  active: string;
  salesforceId: string;
  promsId: string;
  budget: string;
  openAirCode: string;
  eprev: string;
  comments: string;
  accountAnchor?: string;
  createdAt?: string;
  updatedAt?: string;
  stepCompletedAt?: Record<string, string>;
};

const STATUS_COLORS: Record<string, string> = {
  Completed: '#52c41a',
  'In Progress': '#1890ff',
  'Not Started': '#8c8c8c',
};

const PIPELINE_STAGES = [
  { key: 'sow', label: 'SOW', field: (r: ProcessDetailRow) => r.sow },
  { key: 'signed', label: 'Signed SOW', field: (r: ProcessDetailRow) => (r.signedSow === 'Yes' ? 'Yes' : '') },
  { key: 'piw', label: 'PIW', field: (r: ProcessDetailRow) => r.piw },
  { key: 'sf', label: 'SF Opportunity', field: (r: ProcessDetailRow) => r.salesforceId },
  { key: 'proms', label: 'PROMS / Budget', field: (r: ProcessDetailRow) => r.promsId || r.budget },
  { key: 'openair', label: 'Open Air Code', field: (r: ProcessDetailRow) => r.openAirCode },
  { key: 'eprev', label: 'Eprev', field: (r: ProcessDetailRow) => (r.eprev === 'Yes' ? 'Yes' : '') },
];
const STAGE_COLORS = ['#1890ff', '#13c2c2', '#722ed1', '#fa8c16', '#eb2f96', '#a0d911', '#52c41a'];

function deriveStatus(row: ProcessDetailRow): 'Not Started' | 'In Progress' | 'Completed' {
  if (row.openAirCode?.trim() || row.eprev?.trim() === 'Yes') return 'Completed';
  if (row.signedSow?.trim() === 'Yes' || row.piw?.trim() || row.salesforceId?.trim() || row.promsId?.trim() || row.budget?.trim()) return 'In Progress';
  return 'Not Started';
}

function formatDateUtcOnly(value: string | undefined): string {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

interface ProcessDetailViewPanelProps {
  rows: ProcessDetailRow[];
  initialSow?: string;
}

export default function ProcessDetailViewPanel({ rows, initialSow }: ProcessDetailViewPanelProps) {
  const [selectedSow, setSelectedSow] = useState<string | null>(initialSow || null);
  const [linkedResources, setLinkedResources] = useState<ResourceRow[]>([]);
  const [timelineEntries, setTimelineEntries] = useState<Array<{ type: 'added' | 'removed'; name: string; raId: string; date: string; by: string }>>([]);
  const [processComments, setProcessComments] = useState<Array<{ id: number; author: string; body: string; created_at: string }>>([]);
  const [auditEntries, setAuditEntries] = useState<Array<{ id: number; field: string; old_value: string; new_value: string; changed_by: string; changed_at: string }>>([]);
  const [loadingRes, setLoadingRes] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [exportingPdf, setExportingPdf] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const selectedRow = useMemo(() => rows.find(r => r.sow === selectedSow) || null, [rows, selectedSow]);

  useEffect(() => {
    if (!selectedRow?.id) {
      setLinkedResources([]);
      setTimelineEntries([]);
      setProcessComments([]);
      setAuditEntries([]);
      return;
    }
    setLoadingRes(true);
    const pid = selectedRow.id;
    Promise.all([
      resourceApi.getResources(),
      auditApi.getProcessResourceHistory(pid),
      processApi.getComments(pid).then(comments => ({ comments })).catch(() => ({ comments: [] })),
      fetch(`/api/audit/process-combined/${pid}`).then(r => r.json()).catch(() => ({ entries: [] })),
    ]).then(([{ resources: all }, auditRaw, commentsData, auditData]) => {
      const linked = (all as any[])
        .filter(r => r.process_id === pid || r.processId === pid)
        .map((r: any) => ({
          key: String(r.id || r.ra_id || r.raId),
          id: r.id,
          sno: String(r.sno || ''),
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
          engagementStartDate: String(r.engagement_start_date || r.engagementStartDate || ''),
          engagementEndDate: String(r.engagement_end_date || r.engagementEndDate || ''),
        }));
      setLinkedResources(linked as ResourceRow[]);

      const pidStr = String(pid);
      const events = (auditRaw || []).map((e: any) => {
        const parts = String(e.record_name || '').split(' - ');
        const raId = parts[0]?.trim() || '';
        const name = parts.slice(1).join(' - ').trim() || e.record_name || '';
        const type: 'added' | 'removed' = String(e.new_value) === pidStr ? 'added' : 'removed';
        const dt = e.changed_at || '';
        const date = dt.slice(0, 10);
        return { type, name, raId, date, by: e.changed_by || '' };
      });
      events.sort((a, b) => a.date.localeCompare(b.date));
      setTimelineEntries(events);
      setProcessComments((commentsData as any).comments || []);
      setAuditEntries((auditData as any).entries || []);
    }).finally(() => setLoadingRes(false));
  }, [selectedRow?.id, refreshKey]);

  const timelineGroups = useMemo(() => {
    const dateMap = new Map<string, Map<string, typeof timelineEntries[0]>>();
    timelineEntries.forEach(e => {
      if (!dateMap.has(e.date)) dateMap.set(e.date, new Map());
      const key = e.raId || e.name;
      dateMap.get(e.date)!.set(key, e);
    });
    const groups: { date: string; added: typeof timelineEntries; removed: typeof timelineEntries }[] = [];
    dateMap.forEach((resourceMap, date) => {
      const added: typeof timelineEntries = [];
      const removed: typeof timelineEntries = [];
      resourceMap.forEach(e => (e.type === 'added' ? added : removed).push(e));
      groups.push({ date, added, removed });
    });
    groups.sort((a, b) => a.date.localeCompare(b.date));
    return groups;
  }, [timelineEntries]);

  const runningState = useMemo(() => {
    const active = new Set<string>();
    return timelineGroups.map(g => {
      g.added.forEach(e => active.add(e.raId || e.name));
      g.removed.forEach(e => active.delete(e.raId || e.name));
      return active.size;
    });
  }, [timelineGroups]);

  const fmtDate = (iso: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleExportPdf = async () => {
    if (!detailRef.current || !selectedRow) return;
    setExportingPdf(true);
    try {
      const canvas = await captureElementCanvas(detailRef.current, '#f5f5f5', {
        scrollY: -window.scrollY,
        windowWidth: detailRef.current.scrollWidth,
        windowHeight: detailRef.current.scrollHeight,
      });
      if (!canvas) throw new Error('Canvas capture failed');
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      let yPos = margin;
      let heightLeft = imgH;
      pdf.addImage(imgData, 'PNG', margin, yPos, imgW, imgH);
      heightLeft -= (pageH - margin * 2);
      while (heightLeft > 0) {
        yPos = heightLeft - imgH + margin;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, yPos, imgW, imgH);
        heightLeft -= (pageH - margin * 2);
      }
      pdf.save(`${selectedRow.sow.replace(/[^a-zA-Z0-9]/g, '_')}_DetailView.pdf`);
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportWord = () => {
    if (!selectedRow) return;
    const timelineHtml = timelineGroups.length > 0
      ? timelineGroups.map((g, gi) => `
          <p style="margin:6px 0 2px"><b>${fmtDate(g.date)}</b> &mdash; ${runningState[gi]} resource${runningState[gi] !== 1 ? 's' : ''} active</p>
          ${g.added.length > 0 ? `<p style="color:green;margin:2px 0">+ Added: ${g.added.map(e => `${e.name}${e.raId ? ` (${e.raId})` : ''}`).join(', ')}</p>` : ''}
          ${g.removed.length > 0 ? `<p style="color:red;margin:2px 0">&minus; Removed: ${g.removed.map(e => `${e.name}${e.raId ? ` (${e.raId})` : ''}`).join(', ')}</p>` : ''}
        `).join('')
      : '<p><i>No resource history recorded.</i></p>';
    const currentHtml = linkedResources.length > 0
      ? linkedResources.map(r => `<li>${r.empName} (${r.raId})</li>`).join('')
      : '<li><i>None</i></li>';
    const commentsHtml = processComments.length > 0
      ? `<table><tr><th>Author</th><th>Comment</th><th>Date</th></tr>${processComments.map(c => `<tr><td>${c.author || '—'}</td><td>${c.body}</td><td>${fmtDate(c.created_at)}</td></tr>`).join('')}</table>`
      : '<p><i>No comments found.</i></p>';
    const auditHtml = auditEntries.length > 0
      ? `<table><tr><th>Source</th><th>Field</th><th>Resource / Old Value</th><th>New Value</th><th>Changed By</th><th>Date</th></tr>${auditEntries.map(e => `<tr><td>${(e as any).source || 'Process'}</td><td>${e.field}</td><td>${(e as any).source === 'Resource Link' ? (e.new_value || '—') : ((e as any).source === 'Resource Date' ? ((e as any).record_name || '—') : (e.old_value || '—'))}</td><td>${(e as any).source === 'Resource Link' ? '' : (e.new_value || '—')}</td><td>${e.changed_by || '—'}</td><td>${fmtDate(e.changed_at)}</td></tr>`).join('')}</table>`
      : '<p><i>No audit log entries found.</i></p>';
    const html = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'>
      <head><meta charset="utf-8"><title>${selectedRow.sow}</title>
      <style>body{font-family:Calibri,sans-serif;font-size:11pt;} h2{font-size:14pt;} h3{font-size:12pt;} table{border-collapse:collapse;width:100%;margin-bottom:10pt;} td,th{border:1px solid #ccc;padding:4px 8px;font-size:10pt;} th{background:#f0f0f0;font-weight:bold;}</style>
      </head><body>
      <h2>${selectedRow.sow}</h2>
      <p><b>Status:</b> ${deriveStatus(selectedRow)} &nbsp; <b>Active:</b> ${selectedRow.active}</p>
      <h3>SOW Details</h3>
      <table>
        <tr><th>Field</th><th>Value</th></tr>
        <tr><td>Start Date</td><td>${selectedRow.startDate || '—'}</td></tr>
        <tr><td>Signed SOW</td><td>${selectedRow.signedSow || '—'}</td></tr>
        <tr><td>PIW</td><td>${selectedRow.piw || '—'}</td></tr>
        <tr><td>Salesforce ID</td><td>${selectedRow.salesforceId || '—'}</td></tr>
        <tr><td>PROMS ID</td><td>${selectedRow.promsId || '—'}</td></tr>
        <tr><td>Budget (INR)</td><td>${selectedRow.budget || '—'}</td></tr>
        <tr><td>Open Air Code</td><td>${selectedRow.openAirCode || '—'}</td></tr>
        <tr><td>Eprev</td><td>${selectedRow.eprev || '—'}</td></tr>
        <tr><td>Account Anchor</td><td>${selectedRow.accountAnchor || '—'}</td></tr>
        <tr><td>Comments</td><td>${selectedRow.comments || '—'}</td></tr>
      </table>
      <h3>Resource History</h3>
      ${timelineHtml}
      <h3>Currently Linked Resources</h3>
      <ul>${currentHtml}</ul>
      <h3>Comments (${processComments.length})</h3>
      ${commentsHtml}
      <h3>Audit Log (${auditEntries.length})</h3>
      ${auditHtml}
      </body></html>`;
    const blob = new Blob([html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedRow.sow.replace(/[^a-zA-Z0-9]/g, '_')}_DetailView.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stepCompletedAt = selectedRow?.stepCompletedAt || {};
  const lastUpdatedDate = selectedRow ? formatDateUtcOnly(selectedRow.updatedAt || selectedRow.createdAt || '') : '';
  const getStepCompletedTimestamp = (key: string) => {
    const keyAliases: Record<string, string[]> = {
      signed_sow: ['signed_sow', 'signedSow'],
      salesforce_id: ['salesforce_id', 'salesforceId', 'sf'],
      proms_id: ['proms_id', 'proms', 'promsId'],
      budget: ['budget'],
      open_air_code: ['open_air_code', 'openAirCode'],
      piw: ['piw'],
      eprev: ['eprev'],
      sow: ['sow'],
    };
    return (keyAliases[key] || [key]).map(k => stepCompletedAt[k]).find(Boolean) || (selectedRow?.updatedAt || selectedRow?.createdAt || '');
  };

  const DetailItem = ({ label, value, completionKey }: { label: string; value: string; completionKey?: string }) => (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
      <Text type="secondary" style={{ fontSize: '11px', minWidth: 120, flexShrink: 0 }}>{label}</Text>
      <div>
        <Text style={{ fontSize: '11px', fontWeight: 500, wordBreak: 'break-word', display: 'block' }}>{value || '—'}</Text>
        {completionKey && getStepCompletedTimestamp(completionKey) && (
          <Text type="secondary" italic style={{ fontSize: '10px', color: '#722ed1' }}>on {formatDateUtcOnly(getStepCompletedTimestamp(completionKey))}</Text>
        )}
      </div>
    </div>
  );

  if (rows.length === 0) {
    return (
      <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '60px 0', textAlign: 'center' }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '12px' }}>No process records yet.</Text>} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap' }}>Search SOW:</Text>
        <Select
          showSearch
          allowClear
          style={{ width: 380 }}
          size="small"
          placeholder="Type to search SOW name…"
          value={selectedSow || undefined}
          onChange={v => { setSelectedSow(v || null); setRefreshKey(k => k + 1); }}
          options={rows.map(r => ({ value: r.sow, label: r.sow }))}
          filterOption={(input, opt) => String(opt?.label || '').toLowerCase().includes(input.toLowerCase())}
        />
        {selectedRow && (
          <Tooltip title="Refresh history">
            <Button size="small" icon={<HistoryOutlined />} onClick={() => setRefreshKey(k => k + 1)} loading={loadingRes} />
          </Tooltip>
        )}
        {selectedRow && (
          <Tooltip title="Export Word">
            <Button size="small" icon={<FileWordOutlined style={{ color: '#1677ff' }} />} onClick={handleExportWord} />
          </Tooltip>
        )}
        {selectedRow && (
          <Tooltip title="Export PDF">
            <Button size="small" icon={<FilePdfOutlined style={{ color: '#cf1322' }} />} onClick={handleExportPdf} loading={exportingPdf} />
          </Tooltip>
        )}
      </div>

      {!selectedSow && (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '50px 0', textAlign: 'center' }}>
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '12px' }}>Select a SOW to view its details and resource history.</Text>} />
        </div>
      )}

      {selectedRow && (
        <div ref={detailRef} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card
            size="small"
            title={<Space size={6}><FileProtectOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>{selectedRow.sow}</Text></Space>}
            extra={<Tag color={STATUS_COLORS[deriveStatus(selectedRow)]} style={{ fontSize: '11px' }}>{deriveStatus(selectedRow)}</Tag>}
            style={{ borderRadius: 10 }}
          >
            <Row gutter={[16, 0]}>
              <Col span={12}>
                <DetailItem label="Start Date" value={selectedRow.startDate} />
                <DetailItem label="Active" value={selectedRow.active} />
                <DetailItem label="Signed SOW" value={selectedRow.signedSow} completionKey="signed_sow" />
                <DetailItem label="PIW" value={selectedRow.piw} completionKey="piw" />
                <DetailItem label="Account Anchor" value={selectedRow.accountAnchor || ''} />
              </Col>
              <Col span={12}>
                <DetailItem label="Salesforce ID" value={selectedRow.salesforceId} completionKey="salesforce_id" />
                <DetailItem label="PROMS ID" value={selectedRow.promsId} completionKey="proms_id" />
                <DetailItem label="Budget (INR)" value={selectedRow.budget} completionKey="budget" />
                <DetailItem label="Open Air Code" value={selectedRow.openAirCode} completionKey="open_air_code" />
                <DetailItem label="Eprev" value={selectedRow.eprev || ''} completionKey="eprev" />
              </Col>
            </Row>
            {lastUpdatedDate && (
              <div style={{ marginTop: 8, borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                <Text type="secondary" italic style={{ fontSize: '10px', color: '#722ed1' }}>Last Updated: {lastUpdatedDate}</Text>
              </div>
            )}
            {selectedRow.comments && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                <Text type="secondary" style={{ fontSize: '11px' }}>Comments: </Text>
                <Text style={{ fontSize: '11px' }}>{selectedRow.comments}</Text>
              </div>
            )}
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
              <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 8 }}>Pipeline Progress</Text>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {PIPELINE_STAGES.map((stage, idx) => {
                  const done = !!stage.field(selectedRow);
                  return (
                    <div key={stage.key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Tag style={{ fontSize: '10px', margin: 0, background: done ? `${STAGE_COLORS[idx]}20` : '#f5f5f5', color: done ? STAGE_COLORS[idx] : '#bfbfbf', border: `1px solid ${done ? `${STAGE_COLORS[idx]}60` : '#e8e8e8'}` }} icon={done ? <CheckCircleFilled style={{ fontSize: 9 }} /> : undefined}>
                        {stage.label}
                      </Tag>
                      {idx < PIPELINE_STAGES.length - 1 && <RightOutlined style={{ fontSize: 9, color: '#d9d9d9' }} />}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card
            size="small"
            title={<Space size={6}><TeamOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>Resource History</Text><Tag style={{ fontSize: '10px' }}>{linkedResources.length} currently linked</Tag></Space>}
            style={{ borderRadius: 10 }}
          >
            {loadingRes ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin size="small" /></div>
            ) : timelineGroups.length === 0 ? (
              <div>
                {linkedResources.length > 0 ? (
                  <>
                    <Alert type="info" showIcon style={{ marginBottom: 12, fontSize: '11px' }} message={<Text style={{ fontSize: '11px' }}>No audit history found — these resources were linked before audit tracking began.</Text>} />
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {linkedResources.map(r => (
                        <Tag key={r.key} style={{ fontSize: '11px', padding: '2px 8px' }}>
                          {r.empName} <Text type="secondary" style={{ fontSize: '10px' }}>({r.raId})</Text>
                        </Tag>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '11px' }}>No resources have been linked to this SOW yet.</Text>} />
                )}
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                <div style={{ position: 'absolute', left: 7, top: 12, bottom: 12, width: 2, background: '#f0f0f0', borderRadius: 1 }} />
                {timelineGroups.map((group, gi) => (
                  <div key={group.date} style={{ position: 'relative', marginBottom: gi < timelineGroups.length - 1 ? 20 : 0 }}>
                    <div style={{ position: 'absolute', left: -13, top: 3, width: 10, height: 10, borderRadius: '50%', background: group.added.length > 0 && group.removed.length > 0 ? '#faad14' : group.added.length > 0 ? '#52c41a' : '#ff4d4f', border: '2px solid #fff', boxShadow: '0 0 0 1px #d9d9d9' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Text style={{ fontSize: '11px', fontWeight: 600, color: '#595959' }}>{fmtDate(group.date)}</Text>
                      <Tag style={{ fontSize: '10px', background: '#f5f5f5', border: '1px solid #e8e8e8', color: '#595959' }}>{runningState[gi]} resource{runningState[gi] !== 1 ? 's' : ''} active</Tag>
                    </div>
                    {group.added.length > 0 && (
                      <div style={{ marginBottom: group.removed.length > 0 ? 6 : 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          <Tag color="success" style={{ fontSize: '10px', margin: 0 }}>+ {group.added.length} added</Tag>
                          {group.added.map((e, i) => (
                            <span key={i} style={{ fontSize: '11px', color: '#262626' }}>
                              {e.name}
                              {e.raId && <Text type="secondary" style={{ fontSize: '10px' }}> ({e.raId})</Text>}
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
                          {group.removed.map((e, i) => (
                            <span key={i} style={{ fontSize: '11px', color: '#8c8c8c', textDecoration: 'line-through' }}>
                              {e.name}
                              {e.raId && <Text type="secondary" style={{ fontSize: '10px' }}> ({e.raId})</Text>}
                              {i < group.removed.length - 1 && <span style={{ color: '#d9d9d9', marginRight: 4 }}>,</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {group.added[0]?.by && <Text type="secondary" style={{ fontSize: '10px', display: 'block', marginTop: 3 }}>by {group.added[0]?.by || group.removed[0]?.by}</Text>}
                  </div>
                ))}
                <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid #f5f5f5' }}>
                  <Text type="secondary" style={{ fontSize: '11px', display: 'block', marginBottom: 6 }}>Currently linked ({linkedResources.length})</Text>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {linkedResources.length > 0 ? linkedResources.map(r => (
                      <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, padding: '4px 10px' }}>
                        <Text style={{ fontSize: '11px', color: '#389e0d', fontWeight: 500 }}>{r.empName}</Text>
                        <Text type="secondary" style={{ fontSize: '10px' }}>({r.raId})</Text>
                        {(r.engagementStartDate || r.engagementEndDate) && (
                          <Text style={{ fontSize: '10px', color: '#1677ff', marginLeft: 4 }}>
                            📅 {r.engagementStartDate ? fmtDate(r.engagementStartDate) : '—'} → {r.engagementEndDate ? fmtDate(r.engagementEndDate) : '—'}
                          </Text>
                        )}
                      </div>
                    )) : <Text type="secondary" style={{ fontSize: '11px' }}>None</Text>}
                  </div>
                </div>
              </div>
            )}
          </Card>

          <Card
            size="small"
            title={<Space size={6}><CommentOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>Comments</Text><Tag style={{ fontSize: '10px' }}>{processComments.length}</Tag></Space>}
            style={{ borderRadius: 10 }}
          >
            {loadingRes ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
            ) : processComments.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '11px' }}>No comments for this SOW.</Text>} />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {processComments.map(c => (
                  <div key={c.id} style={{ background: '#fafafa', borderRadius: 8, padding: '8px 12px', border: '1px solid #f0f0f0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Text style={{ fontSize: '11px', fontWeight: 600, color: '#1677ff' }}>{c.author || 'Unknown'}</Text>
                      <Text type="secondary" style={{ fontSize: '10px' }}>{fmtDate(c.created_at)}</Text>
                    </div>
                    <Text style={{ fontSize: '11px', whiteSpace: 'pre-wrap' }}>{c.body}</Text>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card
            size="small"
            title={<Space size={6}><InfoCircleOutlined style={{ color: '#1677ff' }} /><Text style={{ fontSize: '12px', fontWeight: 600 }}>Audit Log</Text><Tag style={{ fontSize: '10px' }}>{auditEntries.length}</Tag></Space>}
            style={{ borderRadius: 10 }}
          >
            {loadingRes ? (
              <div style={{ textAlign: 'center', padding: 16 }}><Spin size="small" /></div>
            ) : auditEntries.length === 0 ? (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<Text type="secondary" style={{ fontSize: '11px' }}>No audit log entries for this SOW.</Text>} />
            ) : (
              <Table
                size="small"
                pagination={false}
                dataSource={auditEntries.map((e, i) => ({ ...e, key: i }))}
                scroll={{ y: 300 }}
                columns={[
                  { title: 'Source', dataIndex: 'source', key: 'source', width: 110, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => {
                    const colorMap: Record<string, string> = { Process: 'blue', 'Resource Link': 'purple', 'Resource Date': 'cyan' };
                    return <Tag color={colorMap[v] || 'default'} style={{ fontSize: '10px', lineHeight: '16px' }}>{v || 'Process'}</Tag>;
                  } },
                  { title: 'Field', dataIndex: 'field', key: 'field', width: 140, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => <Text style={{ fontSize: '11px', fontWeight: 500 }}>{v}</Text> },
                  { title: 'Resource / Old Value', dataIndex: 'record_name', key: 'rname', width: 160, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string, row: any) => {
                    const fmtVal = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? fmtDate(s) : (s || '—'));
                    if (row.source === 'Resource Link') return <Text style={{ fontSize: '11px', color: '#722ed1' }}>{row.new_value || '—'}</Text>;
                    if (row.source === 'Resource Date') return <Text style={{ fontSize: '11px', color: '#08979c' }}>{v || '—'}</Text>;
                    return <Text style={{ fontSize: '11px', color: '#cf1322' }}>{fmtVal(row.old_value)}</Text>;
                  } },
                  { title: 'New Value', dataIndex: 'new_value', key: 'new', width: 160, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string, row: any) => {
                    const fmtVal = (s: string) => (/^\d{4}-\d{2}-\d{2}/.test(s) ? fmtDate(s) : (s || '—'));
                    if (row.source === 'Resource Link') return null;
                    return <Text style={{ fontSize: '11px', color: '#389e0d' }}>{fmtVal(v)}</Text>;
                  } },
                  { title: 'Changed By', dataIndex: 'changed_by', key: 'by', width: 110, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => <Text style={{ fontSize: '11px' }}>{v || '—'}</Text> },
                  { title: 'Date', dataIndex: 'changed_at', key: 'date', width: 120, onHeaderCell: () => ({ style: { fontSize: '11px' } }), render: (v: string) => <Text style={{ fontSize: '11px' }}>{fmtDate(v)}</Text> },
                ]}
              />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
