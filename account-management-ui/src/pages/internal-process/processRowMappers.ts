function toText(value: unknown): string {
  return String(value ?? '').trim();
}

function toNumberOrFallback(value: unknown, fallback: number): number {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toStepCompletedAtMap(value: unknown): Record<string, string> {
  if (!value) return {};
  const raw = typeof value === 'string' ? value : JSON.stringify(value);
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries = Object.entries(parsed || {})
      .filter(([, v]) => typeof v === 'string' && String(v).trim())
      .map(([k, v]) => [k, String(v)] as const);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function mapProcessApiRow(row: any, index: number) {
  return {
    key: `pr_db_${row.id || index}`,
    id: row.id,
    processId: toText(row.process_id ?? row.processId),
    sno: toNumberOrFallback(row.sno, index + 1),
    startDate: toText(row.start_date ?? row.startDate),
    sow: toText(row.sow),
    signedSow: toText(row.signed_sow ?? row.signedSow),
    piw: toText(row.piw),
    active: toText(row.active),
    salesforceId: toText(row.salesforce_id ?? row.salesforceId),
    promsId: toText(row.proms_id ?? row.promsId),
    budget: toText(row.budget),
    openAirCode: toText(row.open_air_code ?? row.openAirCode),
    eprev: toText(row.eprev),
    comments: toText(row.comments),
    accountAnchor: toText(row.account_anchor ?? row.accountAnchor),
    createdAt: toText(row.created_at ?? row.createdAt),
    updatedAt: toText(row.updated_at ?? row.updatedAt),
    stepCompletedAt: toStepCompletedAtMap(row.step_completed_at ?? row.stepCompletedAt),
  };
}

export function resequenceRows<T extends { sno: number }>(rows: T[]): T[] {
  return rows.map((row, index) => ({ ...row, sno: index + 1 }));
}

type ProcessSaveRow = {
  sow: string;
  sno: number;
  startDate: string;
  signedSow: string;
  piw: string;
  active: string;
  salesforceId: string;
  promsId: string;
  budget: string;
  openAirCode: string;
  eprev?: string;
  comments: string;
  accountAnchor?: string;
};

export function toProcessBulkSavePayload(rows: ProcessSaveRow[]) {
  return rows.map(row => ({
    sow: row.sow,
    sno: row.sno,
    startDate: row.startDate,
    signedSow: row.signedSow,
    piw: row.piw,
    active: row.active,
    salesforceId: row.salesforceId,
    promsId: row.promsId,
    budget: row.budget,
    openAirCode: row.openAirCode,
    eprev: row.eprev || '',
    comments: row.comments,
    accountAnchor: row.accountAnchor || '',
  }));
}

type ProcessExportRow = {
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
  comments: string;
};

export function toProcessExportRows(
  rows: ProcessExportRow[],
  deriveStatus: (row: ProcessExportRow) => string,
) {
  return rows.map(row => ({
    'S.No.': row.sno,
    'Start Date': row.startDate,
    SOW: row.sow,
    'Signed SOW': row.signedSow,
    PIW: row.piw,
    Active: row.active,
    'Salesforce ID': row.salesforceId,
    'PROMS ID': row.promsId,
    Budget: row.budget,
    'Open Air Code': row.openAirCode,
    Status: deriveStatus(row),
    Comments: row.comments,
  }));
}
