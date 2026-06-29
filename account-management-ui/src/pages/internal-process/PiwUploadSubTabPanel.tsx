import React, { useState } from 'react';
import { Alert, Button, Modal, Select, Spin, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { DownloadOutlined, ExclamationCircleOutlined, IdcardOutlined, InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as processApi from '../../api/processApi';
import * as resourceApi from '../../api/resourceApi';
import * as auditApi from '../../api/auditApi';
import { useConfig } from '../../context/ConfigContext';
import { useAuth } from '../../context/AuthContext';
import type { ResourceRow } from '../../types/resource';

const { Text } = Typography;

type ProcessRow = {
  key: string;
  id?: number;
  sno: number;
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
};

interface PiwUploadSubTabPanelProps {
  processRows: ProcessRow[];
  resources?: ResourceRow[];
  onUpdateProcessRow?: (key: string, updates: Partial<ProcessRow>) => void;
  onResourcesLinked?: () => void;
}

function todayDateStr(): string {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mmm = d.toLocaleString('en-US', { month: 'short' });
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}-${mmm}-${yy}`;
}

function downloadFile(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PiwUploadSubTabPanel({ processRows, resources = [], onUpdateProcessRow, onResourcesLinked }: PiwUploadSubTabPanelProps) {
  const { getAppValue } = useConfig();
  const { currentUser } = useAuth();
  const changedBy = currentUser?.username || currentUser?.name || 'system';
  const spUrl = getAppValue('PIW_STORAGE_URL') || '';
  const [selectedSow, setSelectedSow] = useState<string | undefined>(undefined);
  const [existingPiw, setExistingPiw] = useState<string | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [unmatchedRaids, setUnmatchedRaids] = useState<{ raidsFound: string[]; unmatched: string[]; resourceCount: number } | null>(null);
  const [uploadedList, setUploadedList] = useState<{ key: string; file: File; piwName: string; sowName: string; date: string; linkedCount: number }[]>([]);
  const [linkDiag, setLinkDiag] = useState<{ step: string; detail: string } | null>(null);

  const sowOptions = processRows.map(r => ({ value: r.key, label: r.sow }));

  const handleSowChange = (v: string | undefined) => {
    setSelectedSow(v);
    if (v) {
      const row = processRows.find(r => r.key === v);
      setExistingPiw(row?.piw?.trim() || undefined);
    } else {
      setExistingPiw(undefined);
    }
  };

  const extractRaidsFromExcel = async (file: File): Promise<{ raids: string[]; dateMap: Record<string, { startDate: string; endDate: string }> }> => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const allRaids: string[] = [];
    const dateMap: Record<string, { startDate: string; endDate: string }> = {};

    const calcName = wb.SheetNames.find(n => /calculation/i.test(n));
    const sheetToSearch = calcName ? [calcName] : wb.SheetNames;

    for (const sheetName of sheetToSearch) {
      const ws = wb.Sheets[sheetName];
      const cells = Object.keys(ws).filter(k => !k.startsWith('!'));

      const raidHeaderCell = cells.find(k => String(ws[k].v || '').trim().toUpperCase() === 'RAID');
      const seqHeaderCell = cells.find(k => String(ws[k].v || '').trim() === '#');
      if (!raidHeaderCell) continue;

      const raidCol = raidHeaderCell.replace(/\d+/, '');
      const headerRow = parseInt(raidHeaderCell.replace(/[A-Z]+/, ''), 10);
      const seqCol = seqHeaderCell ? seqHeaderCell.replace(/\d+/, '') : 'A';

      const startDateHeaderCell = cells.find(k => {
        const row = parseInt(k.replace(/[A-Z]+/, ''), 10);
        return row === headerRow && /^start\s*date$/i.test(String(ws[k].v || '').trim());
      });
      const endDateHeaderCell = cells.find(k => {
        const row = parseInt(k.replace(/[A-Z]+/, ''), 10);
        return row === headerRow && /^end\s*date$/i.test(String(ws[k].v || '').trim());
      });
      const startCol = startDateHeaderCell ? startDateHeaderCell.replace(/\d+/, '') : null;
      const endCol = endDateHeaderCell ? endDateHeaderCell.replace(/\d+/, '') : null;

      const localIso = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const parseDate = (cellKey: string): string => {
        const cell = ws[cellKey];
        if (!cell) return '';
        if (cell.v instanceof Date) return localIso(cell.v);
        if (typeof cell.v === 'number') {
          const d = XLSX.SSF.parse_date_code(cell.v);
          if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        }
        const s = String(cell.v || '').trim();
        if (!s || s === '—' || s === '-') return '';
        const parts = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (parts) return s;
        const parsed = new Date(s);
        if (!isNaN(parsed.getTime())) return localIso(parsed);
        return '';
      };

      for (let row = headerRow + 1; row <= headerRow + 500; row++) {
        const seqCellKey = `${seqCol}${row}`;
        const seqVal = ws[seqCellKey] ? Number(ws[seqCellKey].v) : NaN;
        if (!Number.isInteger(seqVal) || seqVal <= 0) break;

        const raidCellKey = `${raidCol}${row}`;
        const v = ws[raidCellKey] ? String(ws[raidCellKey].v || '').trim() : '';
        if (v && v !== '—' && v !== '-') {
          allRaids.push(v);
          const startDate = startCol ? parseDate(`${startCol}${row}`) : '';
          const endDate = endCol ? parseDate(`${endCol}${row}`) : '';
          dateMap[v] = { startDate, endDate };
        }
      }

      if (allRaids.length > 0) break;
    }

    return { raids: [...new Set(allRaids)], dateMap };
  };

  const doUpload = async (file: File, piwName: string, row: ProcessRow) => {
    setUploading(true);
    setUploadError(null);
    setUnmatchedRaids(null);
    try {
      const { resources: freshAll } = await resourceApi.getResources();
      const alreadyLinked = freshAll.filter((r: any) => {
        const pid = r.process_id != null ? Number(r.process_id) : null;
        return pid === row.id;
      }).map((r: any) => ({ raId: r.ra_id || '', empName: r.emp_name || '' }));

      await processApi.updateProcess(row.id!, {
        sow: row.sow, sno: row.sno, startDate: row.startDate, signedSow: row.signedSow,
        piw: piwName, active: row.active, salesforceId: row.salesforceId,
        promsId: row.promsId, budget: row.budget, openAirCode: row.openAirCode,
        eprev: row.eprev, comments: row.comments, accountAnchor: row.accountAnchor,
        changedBy,
      });
      try {
        await auditApi.addAuditLog({
          module: 'ra_process',
          record_id: row.id,
          record_name: row.sow,
          field: 'PIW Uploaded',
          old_value: row.piw || '',
          new_value: piwName,
          changed_by: changedBy,
        });
      } catch (error) {
        console.warn('[InternalProcess] PIW upload audit event failed (non-blocking)', error);
      }
      if (onUpdateProcessRow) onUpdateProcessRow(row.key, { piw: piwName });
      setExistingPiw(piwName);

      let linkedCount = 0;
      const unmatched: string[] = [];
      let raidsFound: string[] = [];
      if (file.name.match(/\.(xlsx|xls|xlsm)$/i)) {
        setLinkDiag({ step: 'scanning', detail: `Resource Hub: ${resources.length} resources. Scanning Calculation sheet…` });

        if (resources.length === 0) {
          setUploadError('Resource Hub has 0 resources loaded. Navigate to Resource Hub tab first to load resources, then retry the upload.');
          setLinkDiag(null);
        } else {
          const parsedRaids = await extractRaidsFromExcel(file);
          const raidDateMap = parsedRaids.dateMap ?? {};
          const raids = parsedRaids.raids ?? (parsedRaids as unknown as string[]);
          raidsFound = raids;
          setLinkDiag({ step: 'matched', detail: `Found ${raids.length} RAID(s) in Excel: [${raids.join(', ') || 'none'}]. Hub has: [${resources.map(r => r.raId).join(', ')}]` });

          if (raids.length === 0) {
            setUnmatchedRaids({ raidsFound: [], unmatched: [], resourceCount: resources.length });
          } else if (row.id) {
            const matched = raids
              .map((raid: string) => resources.find(r => r.raId?.trim().toLowerCase() === raid.toLowerCase()))
              .filter(Boolean) as ResourceRow[];
            const noMatch = raids.filter((raid: string) => !resources.find(r => r.raId?.trim().toLowerCase() === raid.toLowerCase()));
            unmatched.push(...noMatch);

            setLinkDiag({ step: 'linking', detail: `Matched: [${matched.map(r => `${r.raId}(id=${r.id})`).join(', ')}]. Not matched: [${noMatch.join(', ')}]` });

            const failedLinks: string[] = [];
            const dateResults: { raId: string; empName: string; prevStart: string; prevEnd: string; startDate: string; endDate: string; dateError?: string }[] = [];

            for (const res of matched) {
              if (!res.id) { failedLinks.push(`${res.raId}: no DB id`); continue; }
              try {
                const ok = await resourceApi.setProcessLink(res.id, row.id, changedBy);
                if (ok) linkedCount++;
                else failedLinks.push(`${res.raId}: server returned false`);
              } catch (err: any) {
                failedLinks.push(`${res.raId}: ${err.message || 'error'}`);
              }

              const dates = raidDateMap[res.raId?.trim() || ''] || raidDateMap[raids.find((r: string) => r.toLowerCase() === res.raId?.trim().toLowerCase()) || ''];
              const prevStart = res.engagementStartDate || '';
              const prevEnd = res.engagementEndDate || '';
              if (dates && (dates.startDate || dates.endDate)) {
                try {
                  await resourceApi.updateResource(res.id, {
                    engagementStartDate: dates.startDate || '',
                    engagementEndDate: dates.endDate || '',
                    changedBy,
                  });
                  dateResults.push({ raId: res.raId, empName: res.empName, prevStart, prevEnd, startDate: dates.startDate, endDate: dates.endDate });
                } catch (err: any) {
                  dateResults.push({ raId: res.raId, empName: res.empName, prevStart, prevEnd, startDate: dates.startDate, endDate: dates.endDate, dateError: err.message || 'failed' });
                }
              } else {
                dateResults.push({ raId: res.raId, empName: res.empName, prevStart, prevEnd, startDate: '', endDate: '', dateError: 'No dates found in PIW Section 1' });
              }
            }
            setLinkDiag(null);
            if (failedLinks.length > 0) setUploadError(`Failed to link ${failedLinks.length} resource(s): ${failedLinks.join('; ')}`);
            if (unmatched.length > 0) setUnmatchedRaids({ raidsFound: raids, unmatched, resourceCount: resources.length });
            onResourcesLinked?.();

            Modal.info({
              title: '🔗 Resource Linking Results',
              width: 520,
              content: (
                <div style={{ fontSize: '12px' }}>
                  <p style={{ marginBottom: 8 }}>
                    <strong>RAIDs found in Calculation sheet (Section 1):</strong>{' '}
                    {raids.length > 0 ? raids.map((r: string) => <Tag key={r} style={{ fontSize: '11px' }}>{r}</Tag>) : <span style={{ color: '#8c8c8c' }}>None</span>}
                  </p>
                  {matched.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#389e0d' }}>✅ Newly linked ({matched.length - failedLinks.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {matched.map(r => (
                          <li key={r.raId} style={{ color: failedLinks.some(f => f.startsWith(r.raId)) ? '#cf1322' : '#389e0d', marginBottom: 4 }}>
                            {r.raId} — {r.empName} &nbsp;
                            {failedLinks.some(f => f.startsWith(r.raId))
                              ? <Tag color="red" style={{ fontSize: '10px' }}>Link Failed</Tag>
                              : <Tag color="green" style={{ fontSize: '10px' }}>Linked ✓</Tag>}
                            {(() => {
                              const dr = dateResults.find(d => d.raId === r.raId);
                              if (!dr) return null;
                              const fmtD = (iso: string) => {
                                if (!iso) return '—';
                                const d = new Date(iso + 'T00:00:00');
                                return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                              };
                              if (dr.dateError) return (
                                <div style={{ color: '#cf1322', fontSize: '10px', marginTop: 3 }}>
                                  ⚠️ Dates not updated: {dr.dateError}
                                  {(dr.prevStart || dr.prevEnd) && <span style={{ color: '#8c8c8c' }}> (current: {fmtD(dr.prevStart)} → {fmtD(dr.prevEnd)})</span>}
                                </div>
                              );
                              if (dr.startDate || dr.endDate) return (
                                <div style={{ fontSize: '10px', marginTop: 3, color: '#595959' }}>
                                  {(dr.prevStart || dr.prevEnd) && (
                                    <span style={{ color: '#8c8c8c', textDecoration: 'line-through', marginRight: 6 }}>
                                      {fmtD(dr.prevStart)} → {fmtD(dr.prevEnd)}
                                    </span>
                                  )}
                                  <span style={{ color: '#389e0d' }}>
                                    📅 {fmtD(dr.startDate)} → {fmtD(dr.endDate)}
                                  </span>
                                </div>
                              );
                              return null;
                            })()}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {noMatch.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <strong style={{ color: '#d46b08' }}>⚠️ Not found in Resource Hub ({noMatch.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {noMatch.map((r: string) => <li key={r} style={{ color: '#d46b08' }}>{r} — <span style={{ color: '#8c8c8c' }}>not in Resource Hub</span></li>)}
                      </ul>
                    </div>
                  )}
                  {alreadyLinked.length > 0 && (
                    <div style={{ marginBottom: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                      <strong style={{ color: '#595959' }}>🔗 Already linked to this SOW ({alreadyLinked.length}):</strong>
                      <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                        {alreadyLinked.map(r => (
                          <li key={r.raId} style={{ color: '#595959' }}>
                            {r.raId} — {r.empName}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {raids.length === 0 && (
                    <p style={{ color: '#cf1322' }}>⚠️ No RAID column found in Calculation sheet Section 1. Ensure the file was generated by this system.</p>
                  )}
                  <p style={{ marginTop: 10, color: '#8c8c8c', marginBottom: 0 }}>
                    Resource Hub has <strong>{resources.length}</strong> resources loaded.
                  </p>
                </div>
              ),
            });
          }
        }
      }

      setUploadedList(prev => [...prev, { key: `piw_${Date.now()}`, file, piwName, sowName: row.sow, date: todayDateStr(), linkedCount }]);
      message.success(
        linkedCount > 0
          ? `PIW "${piwName}" linked to SOW "${row.sow}". ${linkedCount} resource(s) auto-linked.`
          : `PIW "${piwName}" linked to SOW "${row.sow}". No resources linked — check errors below.`,
        6,
      );
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (file: File) => {
    setUploadError(null);
    setUnmatchedRaids(null);
    setLinkDiag(null);
    if (!selectedSow) {
      setUploadError('Please select a SOW before uploading.');
      return false;
    }
    const piwName = file.name.replace(/\.[^/.]+$/, '').trim();

    const duplicate = processRows.find(
      r => r.piw?.trim().toLowerCase() === piwName.toLowerCase() && r.key !== selectedSow
    );
    if (duplicate) {
      setUploadError(`A PIW named "${piwName}" already exists on SOW "${duplicate.sow}". Please rename the file to a unique name before uploading.`);
      return false;
    }

    const row = processRows.find(r => r.key === selectedSow);
    if (!row) { setUploadError('Selected SOW not found. Please refresh and try again.'); return false; }

    if (existingPiw) {
      Modal.confirm({
        title: 'Overwrite existing PIW?',
        icon: <ExclamationCircleOutlined style={{ color: '#faad14' }} />,
        content: (
          <span>
            This SOW already has PIW <strong>"{existingPiw}"</strong> linked.<br />
            Uploading <strong>"{piwName}"</strong> will <strong>replace</strong> it.<br /><br />
            To keep the existing PIW, cancel and unlink it from the process record first.
          </span>
        ),
        okText: 'Overwrite PIW',
        okButtonProps: { danger: true },
        cancelText: 'Cancel',
        onOk: () => doUpload(file, piwName, row),
      });
    } else {
      doUpload(file, piwName, row);
    }
    return false;
  };

  return (
    <div>
      {spUrl ? (
        <div style={{ background: '#f0f5ff', border: '1px solid #d6e4ff', borderRadius: 8, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10, fontSize: '12px', color: '#1d3461' }}>
          <span style={{ flex: 1 }}>📁 After uploading here, save the PIW document to the configured SharePoint folder.</span>
          <a href={spUrl} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 600, color: '#1890ff', whiteSpace: 'nowrap' }}>
            Open SharePoint Folder ↗
          </a>
        </div>
      ) : (
        <div style={{ background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#874d00' }}>
          💡 Configure <strong>PIW_STORAGE_URL</strong> in App Configuration to link to your SharePoint PIW folder.
        </div>
      )}

      <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '12px', color: '#389e0d' }}>
        📌 The <strong>file name</strong> (without extension) will become the <strong>PIW Name</strong>. Upload <strong>.xlsm</strong> files (PIW generated by this system) — RAID IDs will be read from the <strong>Calculation</strong> sheet and matching resources will be <strong>auto-linked</strong>.
      </div>

      <div style={{ background: '#fff', border: '1px solid #f0f0f0', borderRadius: 8, padding: '12px 14px', marginBottom: existingPiw ? 8 : 16 }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#595959', marginBottom: 8 }}>Select SOW to link this PIW to</div>
        <Select
          showSearch
          placeholder="Search and select a SOW…"
          style={{ width: '100%' }}
          size="small"
          value={selectedSow}
          onChange={handleSowChange}
          options={sowOptions}
          filterOption={(input, opt) => (opt?.label as string || '').toLowerCase().includes(input.toLowerCase())}
          allowClear
        />
      </div>

      {uploadError && (
        <Alert
          type="error"
          showIcon
          closable
          onClose={() => setUploadError(null)}
          message="Upload Error"
          description={uploadError}
          style={{ marginBottom: 14, fontSize: '12px' }}
        />
      )}

      {linkDiag && (
        <div style={{ background: '#e6f4ff', border: '1px solid #91caff', borderRadius: 6, padding: '8px 12px', marginBottom: 10, fontSize: '11px', color: '#003eb3' }}>
          <Spin size="small" style={{ marginRight: 8 }} />
          {linkDiag.detail}
        </div>
      )}

      <Upload.Dragger
        multiple={false}
        beforeUpload={handleFile}
        showUploadList={false}
        accept=".xlsx,.xls,.xlsm"
        disabled={uploading || !selectedSow}
        style={{ borderRadius: 8, marginBottom: 20 }}
      >
        <p className="ant-upload-drag-icon">
          <InboxOutlined style={{ fontSize: 36, color: selectedSow ? '#1890ff' : '#d9d9d9' }} />
        </p>
        <p style={{ fontSize: '13px', fontWeight: 600, margin: '8px 0 4px', color: selectedSow ? '#262626' : '#bfbfbf' }}>
          {uploading ? 'Saving PIW record…' : selectedSow ? 'Click or drag PIW document to upload' : 'Select a SOW above first'}
        </p>
        <p style={{ fontSize: '11px', color: '#8c8c8c', margin: 0 }}>
          Supports .xlsm (recommended), .xlsx, .xls. File name = PIW Name. RAIDs in Calculation sheet auto-link resources.
        </p>
      </Upload.Dragger>

      {uploadedList.length === 0 ? (
        <div style={{ background: '#fafafa', border: '1px dashed #d9d9d9', borderRadius: 8, padding: '32px 0', textAlign: 'center' }}>
          <IdcardOutlined style={{ fontSize: 28, color: '#d9d9d9', marginBottom: 8, display: 'block' }} />
          <Text type="secondary" style={{ fontSize: '12px' }}>No PIW documents uploaded in this session.</Text>
        </div>
      ) : (
        <div>
          <Text strong style={{ fontSize: '12px', display: 'block', marginBottom: 10 }}>
            Uploaded this session ({uploadedList.length})
          </Text>
          {uploadedList.map(({ key, file, piwName, sowName, date, linkedCount }) => (
            <div key={key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: '#fff', borderRadius: 8,
              border: '1px solid #f0f0f0', borderLeft: '3px solid #1890ff',
              padding: '10px 14px', marginBottom: 8,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}>
              <IdcardOutlined style={{ color: '#1890ff', fontSize: 20, flexShrink: 0 }} />
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.name}
                </div>
                <div style={{ fontSize: '11px', color: '#8c8c8c', marginTop: 2 }}>
                  PIW: {piwName} &nbsp;·&nbsp; SOW: {sowName} &nbsp;·&nbsp; {date} &nbsp;·&nbsp; {(file.size / 1024).toFixed(1)} KB
                </div>
              </div>
              <Tag color="blue" style={{ fontSize: '10px', flexShrink: 0 }}>PIW Linked</Tag>
              {linkedCount > 0 && <Tag color="green" style={{ fontSize: '10px', flexShrink: 0 }}>{linkedCount} Resource{linkedCount !== 1 ? 's' : ''} Linked</Tag>}
              {spUrl && (
                <Tooltip title="Open SharePoint folder to save the file there" overlayInnerStyle={{ fontSize: '11px', maxWidth: 220 }}>
                  <Button
                    size="small"
                    style={{ borderRadius: 6, fontSize: '10px', borderColor: '#1890ff', color: '#1890ff' }}
                    onClick={() => {
                      downloadFile(file);
                      window.open(spUrl, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    Save to SP ↗
                  </Button>
                </Tooltip>
              )}
              <Tooltip title="Download file" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button icon={<DownloadOutlined />} size="small" onClick={() => downloadFile(file)} style={{ borderRadius: 6 }} />
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
