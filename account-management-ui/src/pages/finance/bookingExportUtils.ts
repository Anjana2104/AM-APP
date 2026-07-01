import * as XLSXStyle from 'xlsx-js-style';
import { getCurrentDateStamp } from '../../utils/styledExcelExport';
import type { ProjectBooking } from '../../api/financeApi';

export type BookingMilestoneRef = {
  milestoneMonth: string;
  totalAmount: number;
  alreadyBooked: number;
  available: number;
  bookingMonths?: string[];
  milestoneType?: 'booked' | 'anticipated';
};

export type BulkBookingTemplateProject = {
  code: string;
  project: string;
  milestones: Array<{
    milestoneMonth: string;
    totalAmount: number;
    alreadyBooked: number;
    available: number;
    bookingMonths: string[];
    milestoneType?: 'booked' | 'anticipated';
  }>;
};

export function downloadBookingTemplate(
  refData?: BookingMilestoneRef[],
  projectName?: string,
  projectCode?: string,
) {
  const headerStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '389e0d' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const templateRows: any[][] = [['Milestone Month', 'Booking Month', 'Type', 'Amount', 'Notes']];
  if (refData && refData.length > 0) {
    refData.filter(r => r.available > 0).forEach(r => {
      templateRows.push([r.milestoneMonth, '', r.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed', r.available, '']);
    });
  } else {
    templateRows.push(["Jan'26", "Jun'26", 'Fixed', 50000, 'PO-1234']);
    templateRows.push(["Feb'26", "Jun'26", 'Fixed', 30000, '']);
  }
  const ws: any = XLSXStyle.utils.aoa_to_sheet(templateRows);
  ['A1', 'B1', 'C1', 'D1', 'E1'].forEach(addr => { if (ws[addr]) ws[addr].s = headerStyle; });
  ws['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];

  const instrAoa = [
    ['Column', 'Description', 'Required?', 'Example'],
    ['Milestone Month', "Format: Mon'YY - must match a booked milestone with remaining capacity", 'Yes', "Jan'26"],
    ['Booking Month', 'Month the booking is officially recorded', 'Yes', "Jun'26"],
    ['Type', 'Fixed or Anticipated - pre-filled from milestone data (informational)', 'No', 'Fixed'],
    ['Amount', 'Numeric amount to book (must not exceed available capacity shown in Reference Data)', 'Yes', '50000'],
    ['Notes', 'Optional; mandatory if amount < full available capacity of that milestone', 'No', 'PO-1234'],
  ];
  const wsInstr: any = XLSXStyle.utils.aoa_to_sheet(instrAoa);
  wsInstr['!cols'] = [{ wch: 18 }, { wch: 60 }, { wch: 12 }, { wch: 12 }];

  const refHeaderStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const availStyle = { font: { bold: true }, fill: { fgColor: { rgb: 'f6ffed' } }, alignment: { horizontal: 'right' } };
  const bookedStyle = { fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };
  const zeroAvailStyle = { font: { bold: true, color: { rgb: 'cf1322' } }, fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };
  const refRows: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Type', 'Total Amount', 'Already Booked', 'Available to Book', 'Booking Month(s)', 'Status']];
  (refData || []).forEach(r => {
    refRows.push([
      projectCode || '-',
      projectName || '-',
      r.milestoneMonth,
      r.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed',
      r.totalAmount,
      r.alreadyBooked,
      r.available,
      (r.bookingMonths || []).join(', ') || '-',
      r.available <= 0 ? 'Fully Booked' : r.alreadyBooked > 0 ? 'Partially Booked' : 'Open',
    ]);
  });
  const wsRef: any = XLSXStyle.utils.aoa_to_sheet(refRows);
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'].forEach(addr => { if (wsRef[addr]) wsRef[addr].s = refHeaderStyle; });
  refRows.slice(1).forEach((row, i) => {
    const r = i + 2;
    const isZero = row[6] <= 0;
    (['E', 'F'] as const).forEach(col => { const addr = `${col}${r}`; if (wsRef[addr]) wsRef[addr].s = isZero ? bookedStyle : numStyle; });
    const gAddr = `G${r}`; if (wsRef[gAddr]) wsRef[gAddr].s = isZero ? zeroAvailStyle : availStyle;
  });
  wsRef['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Booking Template');
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instructions');
  XLSXStyle.utils.book_append_sheet(wb, wsRef, 'Reference Data');
  XLSXStyle.writeFile(wb, 'Booking_Template.xlsx');
}

export function exportBookingHistory(
  projectName: string,
  projectCode: string,
  bookings: ProjectBooking[],
) {
  const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const aoa: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Booking Month', 'Type', 'Amount', 'Notes', 'Recorded By', 'Recorded At']];
  bookings.forEach(b => {
    aoa.push([
      projectCode || '-',
      projectName || '-',
      b.milestone_month,
      b.booking_month,
      b.booking_type === 'anticipated' ? 'Anticipated' : 'Fixed',
      b.amount,
      b.notes || '',
      b.created_by || '',
      b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
    ]);
  });
  const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'].forEach(addr => { if (ws[addr]) ws[addr].s = hdrStyle; });
  aoa.slice(1).forEach((_, i) => { const addr = `F${i + 2}`; if (ws[addr]) ws[addr].s = numStyle; });
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Booking History');
  XLSXStyle.writeFile(wb, `Bookings_${(projectCode || projectName || 'export').replace(/\s+/g, '_')}_${getCurrentDateStamp()}.xlsx`);
}

export function exportBulkBookingHistory(
  projects: Array<{ name: string; code: string; bookings: ProjectBooking[] }>,
) {
  const hdrStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const aoa: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Booking Month', 'Type', 'Amount', 'Notes', 'Recorded By', 'Recorded At']];
  projects.forEach(p => {
    p.bookings.forEach(b => {
      aoa.push([
        p.code || '-',
        p.name || '-',
        b.milestone_month,
        b.booking_month,
        b.booking_type === 'anticipated' ? 'Anticipated' : 'Fixed',
        b.amount,
        b.notes || '',
        b.created_by || '',
        b.created_at ? new Date(b.created_at).toLocaleDateString() : '',
      ]);
    });
  });
  const ws: any = XLSXStyle.utils.aoa_to_sheet(aoa);
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'].forEach(addr => { if (ws[addr]) ws[addr].s = hdrStyle; });
  aoa.slice(1).forEach((_, i) => { const addr = `F${i + 2}`; if (ws[addr]) ws[addr].s = numStyle; });
  ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 30 }, { wch: 16 }, { wch: 14 }];
  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, ws, 'Booking History');
  XLSXStyle.writeFile(wb, `Bulk_Bookings_Export_${getCurrentDateStamp()}.xlsx`);
}

export function downloadBulkBookingTemplate(projects: BulkBookingTemplateProject[]) {
  const hdrGreen = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '389e0d' } }, alignment: { horizontal: 'center' } };
  const hdrBlue = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1d6196' } }, alignment: { horizontal: 'center' } };
  const numStyle = { alignment: { horizontal: 'right' } };
  const availOk = { font: { bold: true }, fill: { fgColor: { rgb: 'f6ffed' } }, alignment: { horizontal: 'right' } };
  const availZero = { font: { bold: true, color: { rgb: 'cf1322' } }, fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };
  const bookedClr = { fill: { fgColor: { rgb: 'fff1f0' } }, alignment: { horizontal: 'right' } };

  const tplAoa: any[][] = [['Project Code', 'Milestone Month', 'Booking Month', 'Type', 'Amount', 'Notes']];
  projects.forEach(p => {
    p.milestones.filter(m => m.available > 0).forEach(m => {
      tplAoa.push([p.code, m.milestoneMonth, '', m.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed', m.available, '']);
    });
  });
  const wsTpl: any = XLSXStyle.utils.aoa_to_sheet(tplAoa);
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1'].forEach(addr => { if (wsTpl[addr]) wsTpl[addr].s = hdrGreen; });
  wsTpl['!cols'] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 30 }];

  const instrAoa = [
    ['Column', 'Description', 'Required?'],
    ['Project Code', 'Must match the code in Reference Data exactly', 'Yes'],
    ['Milestone Month', "Format: Mon'YY - must have available capacity", 'Yes'],
    ['Booking Month', 'Month the booking is recorded', 'Yes'],
    ['Type', 'Fixed or Anticipated - pre-filled from milestone data (informational)', 'No'],
    ['Amount', 'Cannot exceed available capacity for that milestone', 'Yes'],
    ['Notes', 'Optional; mandatory if amount < available capacity', 'No'],
  ];
  const wsInstr: any = XLSXStyle.utils.aoa_to_sheet(instrAoa);
  wsInstr['!cols'] = [{ wch: 18 }, { wch: 55 }, { wch: 12 }];
  ['A1', 'B1', 'C1'].forEach(addr => { if (wsInstr[addr]) wsInstr[addr].s = hdrBlue; });

  const refAoa: any[][] = [['Project Code', 'Project Name', 'Milestone Month', 'Type', 'Total Amount', 'Already Booked', 'Available to Book', 'Booking Month(s)', 'Status']];
  const refStyleMap: Array<{ row: number; isZero: boolean; isProjectRow: boolean }> = [];
  let rowIdx = 2;
  projects.forEach(p => {
    p.milestones.forEach(m => {
      refAoa.push([p.code, p.project, m.milestoneMonth, m.milestoneType === 'anticipated' ? 'Anticipated' : 'Fixed', m.totalAmount, m.alreadyBooked, m.available, (m.bookingMonths || []).join(', ') || '-', m.available <= 0 ? 'Fully Booked' : m.alreadyBooked > 0 ? 'Partially Booked' : 'Open']);
      refStyleMap.push({ row: rowIdx, isZero: m.available <= 0, isProjectRow: false });
      rowIdx++;
    });
  });
  const wsRef: any = XLSXStyle.utils.aoa_to_sheet(refAoa);
  ['A1', 'B1', 'C1', 'D1', 'E1', 'F1', 'G1', 'H1', 'I1'].forEach(addr => { if (wsRef[addr]) wsRef[addr].s = hdrBlue; });
  refStyleMap.forEach(({ row: r, isZero }) => {
    const eAddr = `E${r}`; if (wsRef[eAddr]) wsRef[eAddr].s = isZero ? bookedClr : numStyle;
    const fAddr = `F${r}`; if (wsRef[fAddr]) wsRef[fAddr].s = isZero ? bookedClr : numStyle;
    const gAddr = `G${r}`; if (wsRef[gAddr]) wsRef[gAddr].s = isZero ? availZero : availOk;
  });
  wsRef['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 22 }, { wch: 16 }];

  const wb = XLSXStyle.utils.book_new();
  XLSXStyle.utils.book_append_sheet(wb, wsTpl, 'Bulk Booking Template');
  XLSXStyle.utils.book_append_sheet(wb, wsInstr, 'Instructions');
  XLSXStyle.utils.book_append_sheet(wb, wsRef, 'Reference Data');
  XLSXStyle.writeFile(wb, `Bulk_Booking_Template_${getCurrentDateStamp()}.xlsx`);
}
