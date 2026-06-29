import React, { useState } from 'react';
import { Alert, Button, Drawer, Input, InputNumber, message, Popconfirm, Select, Space, Spin, Table, Tabs, Tag, Tooltip, Typography, Upload } from 'antd';
import { CalendarOutlined, DeleteOutlined, DownloadOutlined, FileExcelOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';
import * as financeApi from '../../api/financeApi';
import { downloadBulkBookingTemplate, downloadBookingTemplate, exportBookingHistory, exportBulkBookingHistory } from './bookingExportUtils';

const { Text } = Typography;

export type BookingDrawerRow = {
  id?: number;
  key: string;
  project: string;
  company: string;
  code: string;
  revenue: number[];
  milestoneTypes: Record<string, 'booked' | 'anticipated'>;
};

interface BulkBookingDrawerProps {
  open: boolean;
  rows: BookingDrawerRow[];
  selectedRowKeys: React.Key[];
  setSelectedRowKeys: React.Dispatch<React.SetStateAction<React.Key[]>>;
  monthHeaders: string[];
  fmtRev: (v: number) => string;
  canEdit: boolean;
  currentUsername: string;
  bulkAllUploadErrors: string[] | null;
  setBulkAllUploadErrors: React.Dispatch<React.SetStateAction<string[] | null>>;
  bulkAllSaving: boolean;
  onBulkAllProjectsUpload: (file: File, selectedRows: BookingDrawerRow[]) => Promise<boolean>;
  refreshToken?: number;
  onClose: () => void;
}

export default function BulkBookingDrawer({
  open,
  rows,
  selectedRowKeys,
  setSelectedRowKeys,
  monthHeaders,
  fmtRev,
  canEdit,
  currentUsername,
  bulkAllUploadErrors,
  setBulkAllUploadErrors,
  bulkAllSaving,
  onBulkAllProjectsUpload,
  refreshToken,
  onClose,
}: BulkBookingDrawerProps) {
  const [activeKey, setActiveKey] = useState('');
  const selectedRows = rows.filter(r => selectedRowKeys.includes(r.key));

  const normalizeMilestoneType = (type: unknown): 'booked' | 'anticipated' =>
    String(type || '').trim().toLowerCase() === 'anticipated' ? 'anticipated' : 'booked';

  const fetchLatestMilestoneTypesByRowKey = async (
    targetRows: BookingDrawerRow[],
  ): Promise<Record<string, Record<string, 'booked' | 'anticipated'>>> => {
    const latestByRowKey: Record<string, Record<string, 'booked' | 'anticipated'>> = {};
    try {
      const { projects, fromServer } = await financeApi.getProjects();
      if (!fromServer) return latestByRowKey;

      const byId = new Map<number, financeApi.FinanceProject>();
      const byCode = new Map<string, financeApi.FinanceProject>();
      projects.forEach(p => {
        if (typeof p.id === 'number') byId.set(p.id, p);
        if (p.code) byCode.set(p.code.trim().toLowerCase(), p);
      });

      targetRows.forEach(r => {
        const matched = (typeof r.id === 'number' ? byId.get(r.id) : undefined)
          || (r.code ? byCode.get(r.code.trim().toLowerCase()) : undefined);
        if (!matched?.milestoneTypes) return;
        latestByRowKey[r.key] = Object.fromEntries(
          Object.entries(matched.milestoneTypes).map(([month, rawType]) => [
            month,
            normalizeMilestoneType(rawType),
          ]),
        );
      });
    } catch (error: any) {
      message.warning(`Could not refresh latest milestone types; using current values. (${error?.message || 'Unknown error'})`);
    }
    return latestByRowKey;
  };

  return (
    <Drawer
      title={
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <Space>
            <CalendarOutlined style={{ color: '#52c41a' }} />
            <span style={{ fontSize: '13px', fontWeight: 600 }}>Manage Bookings</span>
            <Tag style={{ fontSize: '10px' }}>{selectedRowKeys.length} project{selectedRowKeys.length !== 1 ? 's' : ''}</Tag>
          </Space>
          <Space size={6} style={{ marginRight: 32 }}>
            {canEdit && (
              <Tooltip title="Upload bookings for all selected projects (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                <Upload
                  accept=".xlsx,.xls"
                  showUploadList={false}
                  beforeUpload={f => onBulkAllProjectsUpload(f as File, selectedRows)}
                >
                  <Button
                    size="small"
                    loading={bulkAllSaving}
                    icon={<UploadOutlined style={{ fontSize: '12px' }} />}
                    style={{ fontSize: '11px' }}
                  >
                    Upload All
                  </Button>
                </Upload>
              </Tooltip>
            )}
            <Tooltip title="Download combined template for all selected projects" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                size="small"
                icon={<DownloadOutlined style={{ fontSize: '12px' }} />}
                style={{ fontSize: '11px' }}
                onClick={async () => {
                  const latestTypesByRowKey = await fetchLatestMilestoneTypesByRowKey(selectedRows);
                  const bookingsByRowKey: Record<string, financeApi.ProjectBooking[]> = {};
                  await Promise.all(
                    selectedRows.map(async r => {
                      if (!r.id) {
                        bookingsByRowKey[r.key] = [];
                        return;
                      }
                      bookingsByRowKey[r.key] = await financeApi.getBookings(r.id);
                    }),
                  );
                  const projData = selectedRows.map(r => {
                    const bks = bookingsByRowKey[r.key] || [];
                    const milestoneTypes = latestTypesByRowKey[r.key] || r.milestoneTypes;
                    const bookedPer: Record<string, number> = {};
                    bks.forEach(b => { bookedPer[b.milestone_month] = (bookedPer[b.milestone_month] || 0) + b.amount; });
                    const bookedMonthsPerMs: Record<string, string[]> = {};
                    bks.forEach(b => { (bookedMonthsPerMs[b.milestone_month] = bookedMonthsPerMs[b.milestone_month] || []).push(b.booking_month); });
                    const milestones = monthHeaders
                      .filter(m => (r.revenue[monthHeaders.indexOf(m)] || 0) > 0)
                      .map(m => ({
                        milestoneMonth: m,
                        totalAmount: r.revenue[monthHeaders.indexOf(m)] || 0,
                        alreadyBooked: bookedPer[m] || 0,
                        available: Math.max(0, (r.revenue[monthHeaders.indexOf(m)] || 0) - (bookedPer[m] || 0)),
                        bookingMonths: [...new Set(bookedMonthsPerMs[m] || [])],
                        milestoneType: normalizeMilestoneType(milestoneTypes[m]),
                      }));
                    return { code: r.code || r.key, project: r.project, milestones };
                  });
                  downloadBulkBookingTemplate(projData);
                }}
              >
                Template (All)
              </Button>
            </Tooltip>
            <Tooltip title="Export all booking history (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button
                size="small"
                icon={<FileExcelOutlined style={{ fontSize: '12px', color: '#52c41a' }} />}
                style={{ fontSize: '11px' }}
                onClick={async () => {
                  const bookingsByRowKey: Record<string, financeApi.ProjectBooking[]> = {};
                  await Promise.all(
                    selectedRows.map(async r => {
                      if (!r.id) {
                        bookingsByRowKey[r.key] = [];
                        return;
                      }
                      bookingsByRowKey[r.key] = await financeApi.getBookings(r.id);
                    }),
                  );
                  const projData = selectedRows.map(r => ({
                    name: r.project,
                    code: r.code || r.key,
                    bookings: bookingsByRowKey[r.key] || [],
                  }));
                  exportBulkBookingHistory(projData);
                }}
              >
                Export All
              </Button>
            </Tooltip>
            <Button
              type="link"
              size="small"
              style={{ fontSize: '11px', color: '#595959' }}
              onClick={() => { setSelectedRowKeys([]); setBulkAllUploadErrors(null); onClose(); }}
            >
              Clear &amp; close
            </Button>
          </Space>
        </div>
      }
      placement="right"
      width="75vw"
      open={open}
      onClose={() => { setBulkAllUploadErrors(null); onClose(); }}
      mask={false}
      style={{ boxShadow: '-4px 0 20px rgba(0,0,0,0.13)' }}
      bodyStyle={{ padding: 0, overflowY: 'hidden', background: '#f5f5f5' }}
      headerStyle={{ borderBottom: '1px solid #f0f0f0', padding: '10px 16px' }}
    >
      {open && selectedRows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          {bulkAllUploadErrors && (
            <Alert
              type="error"
              showIcon
              closable
              onClose={() => setBulkAllUploadErrors(null)}
              message={<span style={{ fontSize: '11px', fontWeight: 600 }}>Bulk upload failed — {bulkAllUploadErrors.length} error{bulkAllUploadErrors.length !== 1 ? 's' : ''}</span>}
              description={
                <ul style={{ margin: 0, paddingLeft: 16, maxHeight: 120, overflowY: 'auto' }}>
                  {bulkAllUploadErrors.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}
                </ul>
              }
              style={{ margin: '8px 12px 0', fontSize: '11px' }}
            />
          )}
          <Tabs
            activeKey={activeKey || selectedRows[0].key}
            onChange={setActiveKey}
            tabPosition="left"
            size="small"
            style={{ flex: 1, minHeight: 0 }}
            tabBarStyle={{ width: 180, background: '#fafafa', borderRight: '1px solid #f0f0f0', paddingTop: 8 }}
            items={selectedRows.map(r => ({
              key: r.key,
              label: (
                <div style={{ maxWidth: 155, overflow: 'hidden' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.project}
                  </div>
                  <div style={{ fontSize: '10px', color: '#8c8c8c' }}>{r.code || r.company}</div>
                </div>
              ),
              children: (
                <div style={{ padding: 14, height: 'calc(100vh - 110px)', overflowY: 'auto' }}>
                  <BulkBookingProjectPanel
                    row={r}
                    monthHeaders={monthHeaders}
                    fmtRev={fmtRev}
                    canEdit={canEdit}
                    currentUsername={currentUsername}
                    refreshToken={refreshToken}
                  />
                </div>
              ),
            }))}
          />
        </div>
      )}
    </Drawer>
  );
}

interface BulkBookingProjectPanelProps {
  row: BookingDrawerRow;
  monthHeaders: string[];
  fmtRev: (v: number) => string;
  canEdit: boolean;
  currentUsername: string;
  refreshToken?: number;
}
function BulkBookingProjectPanel({ row, monthHeaders, fmtRev, canEdit, currentUsername, refreshToken }: BulkBookingProjectPanelProps) {
  const [bookings, setBookings] = useState<financeApi.ProjectBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bkMilestoneMonths, setBkMilestoneMonths] = useState<string[]>([]);
  const [bkBookingMonth, setBkBookingMonth] = useState<string | undefined>(undefined);
  const [bkAmount, setBkAmount] = useState<number | null>(null);
  const [bkAmountEdited, setBkAmountEdited] = useState(false);
  const [bkNotes, setBkNotes] = useState('');
  const [bkSaving, setBkSaving] = useState(false);
  const [bkBreakdown, setBkBreakdown] = useState<Record<string, { amount: number | null; notes: string }>>({});
  const [bkHistoryFilter, setBkHistoryFilter] = useState('');
  const [bkFilterMilestone, setBkFilterMilestone] = useState<string | undefined>(undefined);
  const [bkFilterBookedIn, setBkFilterBookedIn] = useState<string | undefined>(undefined);
  const [bkUploadErrors, setBkUploadErrors] = useState<string[] | null>(null);

  React.useEffect(() => {
    if (!row.id) return;
    setBookingsLoading(true);
    financeApi.getBookings(row.id).then(b => {
      setBookings(b);
      setBookingsLoading(false);
    }).catch((error: any) => {
      setBookingsLoading(false);
      console.error('[BulkBookingDrawer] Failed to load booking history', error);
      message.error(`Failed to load booking history. ${error?.message || ''}`.trim());
    });
  }, [row.id, refreshToken]);

  const bookedPerMs: Record<string, number> = {};
  bookings.forEach(b => {
    bookedPerMs[b.milestone_month] = (bookedPerMs[b.milestone_month] || 0) + b.amount;
  });
  const availableForMs = (m: string) => Math.max(0, (row.revenue[monthHeaders.indexOf(m)] || 0) - (bookedPerMs[m] || 0));

  const allBookedMonths = monthHeaders.filter(m => (row.revenue[monthHeaders.indexOf(m)] || 0) > 0);
  const selectableMonths = allBookedMonths.filter(m => availableForMs(m) > 0);
  const fullyBookedMonths = allBookedMonths.filter(m => availableForMs(m) <= 0);
  const selectedMsType: 'fixed' | 'anticipated' | 'mixed' | null =
    bkMilestoneMonths.length === 0 ? null :
    bkMilestoneMonths.every(m => row.milestoneTypes[m] === 'anticipated') ? 'anticipated' :
    bkMilestoneMonths.every(m => row.milestoneTypes[m] !== 'anticipated') ? 'fixed' :
    'mixed';

  const allMonthLabels = [...new Set([
    ...monthHeaders,
    ...Array.from({ length: 12 }, (_, i) => {
      const d = new Date(); d.setMonth(d.getMonth() + i);
      const mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
      return `${mo}'${String(d.getFullYear()).slice(2)}`;
    }),
  ])];

  const calcTotal = bkMilestoneMonths.reduce((sum, m) => sum + availableForMs(m), 0);
  const amountEdited = bkAmountEdited && bkAmount !== null && bkAmount !== calcTotal;
  const exceedsMax = bkAmount !== null && bkMilestoneMonths.length > 0 && bkAmount > calcTotal;
  const breakdownTotal = amountEdited ? bkMilestoneMonths.reduce((s, m) => s + (bkBreakdown[m]?.amount || 0), 0) : 0;
  const breakdownMatchesTotal = !amountEdited || Math.abs(breakdownTotal - (bkAmount || 0)) < 0.01;
  const breakdownRowsValid = !amountEdited || bkMilestoneMonths.every(m => {
    const bd = bkBreakdown[m];
    if (!bd || bd.amount === null || bd.amount <= 0) return false;
    if (bd.amount > availableForMs(m)) return false;
    if (bd.amount < availableForMs(m) && !bd.notes.trim()) return false;
    return true;
  });
  const isValid = bkMilestoneMonths.length > 0 && !!bkBookingMonth && bkAmount !== null && bkAmount > 0 && !exceedsMax &&
    (!amountEdited || (breakdownMatchesTotal && breakdownRowsValid));

  const msToSortKey = (s: string) => {
    const MONTHS: Record<string, number> = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
    const m = s.match(/^([A-Za-z]{3})'(\d{2})$/);
    if (!m) return 0;
    return (2000 + parseInt(m[2], 10)) * 100 + (MONTHS[m[1]] || 0);
  };

  const histMilestoneOpts = [...new Set(bookings.map(b => b.milestone_month))].sort((a, b) => msToSortKey(b) - msToSortKey(a));
  const histBookedInOpts = [...new Set(bookings.map(b => b.booking_month))].sort((a, b) => msToSortKey(b) - msToSortKey(a));

  const filteredBookings = bookings.filter(b => {
    if (bkFilterMilestone && b.milestone_month !== bkFilterMilestone) return false;
    if (bkFilterBookedIn && b.booking_month !== bkFilterBookedIn) return false;
    if (bkHistoryFilter.trim()) {
      const q = bkHistoryFilter.toLowerCase();
      return b.milestone_month.toLowerCase().includes(q) || b.booking_month.toLowerCase().includes(q) ||
        (b.notes || '').toLowerCase().includes(q) || (b.created_by || '').toLowerCase().includes(q);
    }
    return true;
  }).sort((a, b) => {
    const d = msToSortKey(b.milestone_month) - msToSortKey(a.milestone_month);
    return d !== 0 ? d : msToSortKey(b.booking_month) - msToSortKey(a.booking_month);
  });

  const resolveTemplateMilestoneTypes = async (): Promise<Record<string, 'booked' | 'anticipated'>> => {
    const normalize = (type: unknown): 'booked' | 'anticipated' =>
      String(type || '').trim().toLowerCase() === 'anticipated' ? 'anticipated' : 'booked';
    try {
      const { projects, fromServer } = await financeApi.getProjects();
      if (!fromServer) return row.milestoneTypes;
      const matched = projects.find(p =>
        (typeof row.id === 'number' && p.id === row.id)
        || (row.code && p.code && p.code.trim().toLowerCase() === row.code.trim().toLowerCase()),
      );
      if (!matched?.milestoneTypes) return row.milestoneTypes;
      return Object.fromEntries(
        Object.entries(matched.milestoneTypes).map(([month, rawType]) => [month, normalize(rawType)]),
      );
    } catch (error: any) {
      message.warning(`Could not refresh latest milestone types; using current values. (${error?.message || 'Unknown error'})`);
      return row.milestoneTypes;
    }
  };

  const handleBulkBookingUpload = async (file: File) => {
    setBkUploadErrors(null);
    try {
      const uint8 = new Uint8Array(await file.arrayBuffer());
      const wb = XLSX.read(uint8, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      if (!ws) { setBkUploadErrors(['No sheet found in the uploaded file.']); return false; }
      const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });
      if (!json.length) { setBkUploadErrors(['The uploaded sheet is empty.']); return false; }
      const required = ['Milestone Month', 'Booking Month', 'Amount'];
      const missing = required.filter(h => !Object.keys(json[0]).includes(h));
      if (missing.length) { setBkUploadErrors([`Missing required columns: ${missing.join(', ')}. Please use the correct template.`]); return false; }
      const errors: string[] = [];
      const valid: Array<{ milestone_month: string; booking_month: string; amount: number; notes: string; booking_type: 'fixed' | 'anticipated' }> = [];
      json.forEach((r, i) => {
        const mm = String(r['Milestone Month'] || '').trim();
        const bm = String(r['Booking Month'] || '').trim();
        const amt = parseFloat(String(r['Amount'] || '0'));
        const notes = String(r['Notes'] || '').trim();
        if (!mm || !bm) { errors.push(`Row ${i + 2}: Milestone Month and Booking Month are required.`); return; }
        if (isNaN(amt) || amt <= 0) { errors.push(`Row ${i + 2}: Amount must be a positive number (got "${r['Amount']}").`); return; }
        const avail = availableForMs(mm);
        if (avail <= 0) { errors.push(`Row ${i + 2}: Milestone "${mm}" is fully booked or has no remaining capacity.`); return; }
        if (amt > avail) { errors.push(`Row ${i + 2}: Amount ${amt.toLocaleString()} exceeds available ${avail.toLocaleString()} for "${mm}".`); return; }
        valid.push({ milestone_month: mm, booking_month: bm, amount: amt, notes, booking_type: (row.milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed') });
      });
      if (errors.length) { setBkUploadErrors(errors); return false; }
      if (!valid.length) { setBkUploadErrors(['No valid rows found to import.']); return false; }
      setBkSaving(true);
      const result = await financeApi.addBookingsBatch(row.id!, valid.map(v => ({ ...v, created_by: currentUsername })));
      setBkSaving(false);
      if (result.ok) {
        message.success(`${valid.length} booking entr${valid.length === 1 ? 'y' : 'ies'} imported successfully.`);
        financeApi.getBookings(row.id!).then(setBookings);
      } else {
        setBkUploadErrors([`Server error: ${result.error || 'Failed to save.'}`, 'No data was written. Please fix the errors and retry.']);
      }
    } catch (e: any) {
      setBkUploadErrors([`Failed to read file: ${e.message || 'Unknown error'}`, 'Please ensure the file is a valid .xlsx file.']);
    }
    return false;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {canEdit && (
        <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 600, color: '#434343', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PlusOutlined style={{ color: '#52c41a', fontSize: '10px' }} />Add Booking Entry
            {fullyBookedMonths.length > 0 && (
              <Tooltip title={`Fully booked: ${fullyBookedMonths.join(', ')}`} overlayInnerStyle={{ fontSize: '11px' }}>
                <Tag color="red" style={{ fontSize: '10px', cursor: 'default' }}>{fullyBookedMonths.length} fully booked</Tag>
              </Tooltip>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Milestone(s)</div>
              <Select mode="multiple" size="small" placeholder={selectableMonths.length === 0 ? 'All milestones fully booked' : 'Select milestones…'}
                value={bkMilestoneMonths} disabled={selectableMonths.length === 0}
                onChange={vals => {
                  setBkMilestoneMonths(vals);
                  const nb: Record<string, { amount: number | null; notes: string }> = {};
                  vals.forEach((m: string) => { nb[m] = bkBreakdown[m] ?? { amount: availableForMs(m), notes: '' }; });
                  setBkBreakdown(nb);
                  setBkAmount(vals.reduce((s: number, m: string) => s + availableForMs(m), 0) || null);
                  setBkAmountEdited(false);
                }}
                style={{ width: '100%', fontSize: '11px' }} maxTagCount="responsive"
                options={selectableMonths.map(m => ({ value: m, label: `${m} — avail. ${fmtRev(availableForMs(m))} / ${fmtRev(row.revenue[monthHeaders.indexOf(m)] || 0)}` }))}
              />
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Type</div>
              <div style={{ fontSize: '11px', padding: '1px 8px', background: '#f5f5f5', border: '1px solid #d9d9d9', borderRadius: 4, color: selectedMsType === 'anticipated' ? '#d46b08' : selectedMsType === 'mixed' ? '#722ed1' : selectedMsType === 'fixed' ? '#389e0d' : '#bfbfbf', fontWeight: 500, height: 24, display: 'flex', alignItems: 'center' }}>
                {selectedMsType === 'anticipated' ? 'Anticipated' : selectedMsType === 'mixed' ? 'Mixed (Fixed & Anticipated)' : selectedMsType === 'fixed' ? 'Fixed' : '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Booking Month</div>
              <Select size="small" placeholder="Month…" value={bkBookingMonth} onChange={v => setBkBookingMonth(v)}
                style={{ width: '100%', fontSize: '11px' }} showSearch
                options={allMonthLabels.map(m => ({ value: m, label: m }))} />
            </div>
            <div>
              <div style={{ fontSize: '10px', marginBottom: 2, color: exceedsMax ? '#ff4d4f' : amountEdited ? '#fa8c16' : '#8c8c8c' }}>
                Total Amount{bkMilestoneMonths.length > 0 ? (amountEdited ? ` (max ${fmtRev(calcTotal)})` : ' ✓ auto') : ''}
              </div>
              <InputNumber size="small" value={bkAmount}
                onChange={v => {
                  setBkAmount(v); const edited = v !== null && v !== calcTotal; setBkAmountEdited(edited);
                  if (!edited) { const rb: Record<string, { amount: number | null; notes: string }> = {}; bkMilestoneMonths.forEach(m => { rb[m] = { amount: availableForMs(m), notes: '' }; }); setBkBreakdown(rb); }
                }}
                style={{ width: '100%', fontSize: '11px' }} min={0} max={calcTotal || undefined}
                formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} status={exceedsMax ? 'error' : undefined} />
            </div>
            {!amountEdited && (
              <div style={{ gridColumn: '1 / -1' }}>
                <div style={{ fontSize: '10px', color: '#8c8c8c', marginBottom: 2 }}>Notes (optional)</div>
                <Input size="small" placeholder="e.g. PO reference" value={bkNotes} onChange={e => setBkNotes(e.target.value)} style={{ fontSize: '11px' }} />
              </div>
            )}
          </div>
          {amountEdited && bkMilestoneMonths.length > 0 && (
            <div style={{ marginTop: 10, border: '1px dashed #faad14', borderRadius: 6, padding: '8px 10px', background: '#fffbe6' }}>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#d48806', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Milestone Breakdown</span>
                <span style={{ color: breakdownMatchesTotal ? '#52c41a' : '#ff4d4f', fontWeight: 700 }}>
                  Allocated: {fmtRev(breakdownTotal)} / {fmtRev(bkAmount || 0)}
                </span>
              </div>
              {bkMilestoneMonths.map(m => {
                const bd = bkBreakdown[m] ?? { amount: availableForMs(m), notes: '' };
                const isPartial = bd.amount !== null && bd.amount < availableForMs(m);
                const exceeds = bd.amount !== null && bd.amount > availableForMs(m);
                return (
                  <div key={m} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '4px 8px', alignItems: 'center', marginBottom: 6 }}>
                    <Tag color="blue" style={{ fontSize: '10px', margin: 0, whiteSpace: 'nowrap' }}>{m}</Tag>
                    <div>
                      <div style={{ fontSize: '9px', color: exceeds ? '#ff4d4f' : '#8c8c8c', marginBottom: 1 }}>Amount (avail. {fmtRev(availableForMs(m))})</div>
                      <InputNumber size="small" value={bd.amount} min={0} max={availableForMs(m)}
                        onChange={v => setBkBreakdown(prev => ({ ...prev, [m]: { ...prev[m], amount: v } }))}
                        formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        style={{ width: '100%', fontSize: '11px' }} status={exceeds ? 'error' : undefined} />
                    </div>
                    <div>
                      <div style={{ fontSize: '9px', color: isPartial && !bd.notes.trim() ? '#ff4d4f' : '#8c8c8c', marginBottom: 1, fontWeight: isPartial ? 600 : 400 }}>
                        {isPartial ? 'Reason * (partial)' : 'Notes (optional)'}
                      </div>
                      <Input size="small" placeholder={isPartial ? 'Why partial?' : 'optional'} value={bd.notes}
                        onChange={e => setBkBreakdown(prev => ({ ...prev, [m]: { ...prev[m], notes: e.target.value } }))}
                        status={isPartial && !bd.notes.trim() ? 'error' : undefined} style={{ fontSize: '11px' }} />
                    </div>
                  </div>
                );
              })}
              {!breakdownMatchesTotal && <div style={{ fontSize: '10px', color: '#ff4d4f' }}>⚠ Breakdown total must equal {fmtRev(bkAmount || 0)}</div>}
            </div>
          )}
          <Button size="small" loading={bkSaving} disabled={!isValid} icon={<PlusOutlined />} style={{ fontSize: '11px', marginTop: 8 }}
            onClick={async () => {
              if (!row.id || !bkMilestoneMonths.length || !bkBookingMonth || !bkAmount) return;
              setBkSaving(true);
              const entries = bkMilestoneMonths.map(mm => ({
                milestone_month: mm,
                booking_month: bkBookingMonth!,
                amount: amountEdited ? (bkBreakdown[mm]?.amount ?? availableForMs(mm)) : availableForMs(mm),
                notes: amountEdited ? (bkBreakdown[mm]?.notes || bkNotes) : bkNotes,
                created_by: currentUsername,
                booking_type: (row.milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed') as 'fixed' | 'anticipated',
              }));
              const result = await financeApi.addBookingsBatch(row.id!, entries);
              setBkSaving(false);
              if (result.ok) {
                message.success('Booking recorded');
                setBkMilestoneMonths([]); setBkBookingMonth(undefined); setBkAmount(null); setBkAmountEdited(false); setBkNotes(''); setBkBreakdown({});
                financeApi.getBookings(row.id).then(setBookings);
              } else { message.error(`Failed to save: ${result.error || 'Unknown error'}`); }
            }}>Record Booking</Button>
        </div>
      )}

      <div style={{ background: '#fff', border: '1px solid #e8e8e8', borderRadius: 8, padding: '10px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#434343' }}>
            Booking History
            {bookings.length > 0 && <Tag style={{ fontSize: '10px', marginLeft: 6 }}>{filteredBookings.length}{filteredBookings.length !== bookings.length ? `/${bookings.length}` : ''}</Tag>}
          </span>
          <Space size={4}>
            {(bkFilterMilestone || bkFilterBookedIn || bkHistoryFilter) && (
              <Button type="link" size="small" style={{ fontSize: '10px', padding: 0, color: '#ff4d4f' }}
                onClick={() => { setBkFilterMilestone(undefined); setBkFilterBookedIn(undefined); setBkHistoryFilter(''); }}>
                Clear filters
              </Button>
            )}
            {canEdit && (
              <Tooltip title="Upload bookings (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                <Upload accept=".xlsx,.xls" showUploadList={false} beforeUpload={f => handleBulkBookingUpload(f as File)}>
                  <Button type="text" size="small" icon={<UploadOutlined style={{ fontSize: '12px', color: '#595959' }} />} />
                </Upload>
              </Tooltip>
            )}
            <Tooltip title="Download booking template" overlayInnerStyle={{ fontSize: '11px' }}>
              <Button type="text" size="small" icon={<DownloadOutlined style={{ fontSize: '12px', color: '#595959' }} />}
                onClick={async () => {
                  const milestoneTypes = await resolveTemplateMilestoneTypes();
                  downloadBookingTemplate(
                    allBookedMonths.map(m => ({ milestoneMonth: m, totalAmount: row.revenue[monthHeaders.indexOf(m)] || 0, alreadyBooked: bookedPerMs[m] || 0, available: availableForMs(m), bookingMonths: [...new Set(bookings.filter(b => b.milestone_month === m).map(b => b.booking_month))], milestoneType: milestoneTypes[m] || 'booked' })),
                    row.project,
                    row.code,
                  );
                }} />
            </Tooltip>
            {bookings.length > 0 && (
              <Tooltip title="Export booking history (.xlsx)" overlayInnerStyle={{ fontSize: '11px' }}>
                <Button type="text" size="small" icon={<FileExcelOutlined style={{ fontSize: '12px', color: '#52c41a' }} />}
                  onClick={() => exportBookingHistory(row.project, row.code || '', filteredBookings.length > 0 ? filteredBookings : bookings)} />
              </Tooltip>
            )}
          </Space>
        </div>
        {bkUploadErrors && (
          <Alert type="error" showIcon style={{ fontSize: '11px', marginBottom: 6 }} message="Upload failed"
            description={<ul style={{ margin: 0, paddingLeft: 16 }}>{bkUploadErrors.map((e, i) => <li key={i} style={{ fontSize: '11px' }}>{e}</li>)}</ul>}
            closable onClose={() => setBkUploadErrors(null)} />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 6px', marginBottom: 8 }}>
          <Select size="small" allowClear placeholder="Milestone…" value={bkFilterMilestone} onChange={v => setBkFilterMilestone(v)}
            style={{ fontSize: '11px' }} options={histMilestoneOpts.map(m => ({ value: m, label: m }))} popupMatchSelectWidth={false} />
          <Select size="small" allowClear placeholder="Booked In…" value={bkFilterBookedIn} onChange={v => setBkFilterBookedIn(v)}
            style={{ fontSize: '11px' }} options={histBookedInOpts.map(m => ({ value: m, label: m }))} popupMatchSelectWidth={false} />
          <Input size="small" allowClear placeholder="Search…" value={bkHistoryFilter} onChange={e => setBkHistoryFilter(e.target.value)}
            style={{ fontSize: '11px' }} prefix={<span style={{ color: '#bbb', fontSize: '10px' }}>⌕</span>} />
        </div>
        {bookingsLoading ? (
          <div style={{ textAlign: 'center', padding: 20 }}><Spin size="small" /></div>
        ) : bookings.length === 0 ? (
          <Text type="secondary" style={{ fontSize: '12px' }}>No bookings recorded yet.</Text>
        ) : filteredBookings.length === 0 ? (
          <Text type="secondary" style={{ fontSize: '12px' }}>No results match the current filters.</Text>
        ) : (
          <Table size="small" dataSource={filteredBookings} rowKey="id"
            pagination={{ pageSize: 10, size: 'small', showSizeChanger: false, hideOnSinglePage: true }}
            scroll={{ x: 'max-content' }}
            columns={[
              { title: 'Milestone', dataIndex: 'milestone_month', key: 'mm', width: 85, render: (v: string) => <Tag color="blue" style={{ fontSize: '10px', margin: 0 }}>{v}</Tag> },
              { title: 'Booked In', dataIndex: 'booking_month', key: 'bm', width: 85, render: (v: string) => <Tag color="green" style={{ fontSize: '10px', margin: 0 }}>{v}</Tag> },
              { title: 'Type', dataIndex: 'booking_type', key: 'btype', width: 88, render: (v: string) => <Tag color={v === 'anticipated' ? 'orange' : 'blue'} style={{ fontSize: '10px', margin: 0 }}>{v === 'anticipated' ? 'Anticipated' : 'Fixed'}</Tag> },
              { title: 'Amount', dataIndex: 'amount', key: 'amt', width: 95, render: (v: number) => <Text style={{ fontSize: '11px', fontWeight: 600 }}>{fmtRev(v)}</Text> },
              { title: 'Notes', dataIndex: 'notes', key: 'notes', ellipsis: true, render: (v: string) => <Tooltip title={v} overlayInnerStyle={{ fontSize: '11px' }}><Text style={{ fontSize: '11px', color: '#8c8c8c' }}>{v || '—'}</Text></Tooltip> },
              { title: 'By', dataIndex: 'created_by', key: 'by', width: 70, render: (v: string) => <Text style={{ fontSize: '10px', color: '#595959' }}>{v}</Text> },
              ...(canEdit ? [{
                title: '', key: 'del', width: 30,
                render: (_: any, rec: financeApi.ProjectBooking) => (
                  <Popconfirm title="Delete this booking?" onConfirm={async () => { await financeApi.deleteBooking(row.id!, rec.id, currentUsername); financeApi.getBookings(row.id!).then(setBookings); }}
                    okText="Delete" okButtonProps={{ danger: true, size: 'small' }} cancelButtonProps={{ size: 'small' }}>
                    <Button type="text" size="small" danger icon={<DeleteOutlined style={{ fontSize: '10px' }} />} />
                  </Popconfirm>
                ),
              }] : []),
            ]}
          />
        )}
      </div>
    </div>
  );
}
