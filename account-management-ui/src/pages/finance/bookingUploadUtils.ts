import type { ProjectBooking } from '../../api/financeApi';

type BookingType = 'fixed' | 'anticipated';

export type SingleBookingUploadRow = {
  milestone_month: string;
  booking_month: string;
  amount: number;
  notes: string;
  booking_type: BookingType;
};

export type BulkUploadSelectedProject = {
  id?: number;
  key: string;
  code: string;
  revenue: number[];
  milestoneTypes: Record<string, 'booked' | 'anticipated'>;
};

export type BulkUploadProjectEntries = Record<string, {
  projectId: number;
  entries: Array<{
    milestone_month: string;
    booking_month: string;
    amount: number;
    notes: string;
    booking_type: BookingType;
  }>;
}>;

function parseBookingType(rawType: unknown): BookingType {
  return String(rawType || 'fixed').trim().toLowerCase() === 'anticipated' ? 'anticipated' : 'fixed';
}

export function validateSingleProjectBookingUploadRows(
  rows: Array<Record<string, any>>,
  availableForMilestone: (milestone: string) => number,
  milestoneTypes: Record<string, 'booked' | 'anticipated'>,
): { validRows: SingleBookingUploadRow[]; errors: string[] } {
  const errors: string[] = [];
  const validRows: SingleBookingUploadRow[] = [];
  const batchAccum: Record<string, number> = {};

  rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const mm = String(row['Milestone Month'] || '').trim();
    const bm = String(row['Booking Month'] || '').trim();
    const amt = parseFloat(String(row['Amount'] || '0'));
    const notes = String(row['Notes'] || '').trim();

    if (!mm || !bm) {
      errors.push(`Row ${rowNum}: Milestone Month and Booking Month are required.`);
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      errors.push(`Row ${rowNum}: Amount must be a positive number (got "${row['Amount']}").`);
      return;
    }
    const avail = availableForMilestone(mm);
    if (avail <= 0) {
      errors.push(`Row ${rowNum}: Milestone "${mm}" is fully booked or has no remaining capacity.`);
      return;
    }
    const cumulative = (batchAccum[mm] || 0) + amt;
    if (cumulative > avail) {
      errors.push(`Row ${rowNum}: Total for milestone "${mm}" (${cumulative.toLocaleString()}) exceeds available capacity ${avail.toLocaleString()}.`);
      return;
    }
    batchAccum[mm] = cumulative;
    validRows.push({
      milestone_month: mm,
      booking_month: bm,
      amount: amt,
      notes,
      booking_type: (milestoneTypes[mm] === 'anticipated' ? 'anticipated' : 'fixed'),
    });
  });

  return { validRows, errors };
}

export function validateAndGroupBulkBookings(
  rows: Array<Record<string, any>>,
  selectedRows: BulkUploadSelectedProject[],
  bookingsByProject: Record<string, ProjectBooking[]>,
  monthHeaders: string[],
): { groupedByProject: BulkUploadProjectEntries; errors: string[]; totalEntries: number } {
  const errors: string[] = [];
  const groupedByProject: BulkUploadProjectEntries = {};
  const batchAccumByProjectMilestoneType: Record<string, number> = {};

  rows.forEach((row, i) => {
    const rowNum = i + 2;
    const code = String(row['Project Code'] || '').trim();
    const mm = String(row['Milestone Month'] || '').trim();
    const bm = String(row['Booking Month'] || '').trim();
    const amt = parseFloat(String(row['Amount'] || '0'));
    const notes = String(row['Notes'] || '').trim();
    const btype = parseBookingType(row['Type']);

    if (!code || !mm || !bm) {
      errors.push(`Row ${rowNum}: Project Code, Milestone Month, Booking Month are required.`);
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      errors.push(`Row ${rowNum}: Amount must be a positive number (got "${row['Amount']}").`);
      return;
    }

    const projRow = selectedRows.find(r => (r.code || r.key) === code);
    if (!projRow) {
      errors.push(`Row ${rowNum}: Project code "${code}" not found in selected projects.`);
      return;
    }
    if (!projRow.id) {
      errors.push(`Row ${rowNum}: Project "${code}" has no ID - cannot save.`);
      return;
    }

    const existing = bookingsByProject[code] || [];
    const alreadyBooked = existing.filter(b => b.milestone_month === mm && b.booking_type === btype).reduce((s, b) => s + b.amount, 0);
    const monthIndex = monthHeaders.indexOf(mm);
    const total = monthIndex === -1 ? 0 : (projRow.revenue[monthIndex] || 0);
    const available = Math.max(0, total - alreadyBooked);
    const expectedType = (projRow.milestoneTypes[mm] || 'booked') === 'anticipated' ? 'anticipated' : 'fixed';

    if (btype !== expectedType) {
      errors.push(`Row ${rowNum}: Milestone "${mm}" in "${code}" is of type "${expectedType}", not "${btype}".`);
      return;
    }
    if (total <= 0) {
      errors.push(`Row ${rowNum}: Milestone "${mm}" has no revenue for project "${code}".`);
      return;
    }
    if (available <= 0) {
      errors.push(`Row ${rowNum}: Milestone "${mm}" is fully booked for project "${code}".`);
      return;
    }

    const accumKey = `${code}::${mm}::${btype}`;
    const cumulative = (batchAccumByProjectMilestoneType[accumKey] || 0) + amt;
    if (cumulative > available) {
      errors.push(`Row ${rowNum}: Total for milestone "${mm}" in "${code}" (${cumulative.toLocaleString()}) exceeds available ${available.toLocaleString()}.`);
      return;
    }
    batchAccumByProjectMilestoneType[accumKey] = cumulative;

    if (!groupedByProject[code]) {
      groupedByProject[code] = { projectId: projRow.id, entries: [] };
    }
    groupedByProject[code].entries.push({
      milestone_month: mm,
      booking_month: bm,
      amount: amt,
      notes,
      booking_type: btype,
    });
  });

  const totalEntries = Object.values(groupedByProject).reduce((sum, item) => sum + item.entries.length, 0);
  return { groupedByProject, errors, totalEntries };
}
