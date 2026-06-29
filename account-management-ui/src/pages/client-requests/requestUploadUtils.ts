import * as XLSX from 'xlsx';

type TypeItem = { label: string; value: string };

export interface ClientRequestUploadRow {
  id?: number;
  sno: string;
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
  isActive?: boolean;
}

export function parseClientRequestWorksheet(
  worksheet: XLSX.WorkSheet,
  options: {
    processingDefault: string;
    overallDefault: string;
    processingDisplayMap: Record<string, string>;
    overallDisplayMap: Record<string, string>;
    typeItems: TypeItem[];
    formatDateToDDMMYYYY: (value: string | number | Date | undefined) => string;
  },
): ClientRequestUploadRow[] {
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { raw: false, dateNF: 'DD/MM/YYYY' }) as Record<string, any>[];
  if (!jsonData || jsonData.length === 0) return [];

  const {
    processingDefault,
    overallDefault,
    processingDisplayMap,
    overallDisplayMap,
    typeItems,
    formatDateToDDMMYYYY,
  } = options;

  return jsonData.map((row: Record<string, any>) => {
    let processingStatus = processingDefault;
    const processingValue = row['Processing Status'] || '';
    for (const [code, display] of Object.entries(processingDisplayMap)) {
      if (display === processingValue) { processingStatus = code; break; }
    }

    let overallStatus = overallDefault;
    const overallValue = row['Overall Status'] || '';
    for (const [code, display] of Object.entries(overallDisplayMap)) {
      if (display === overallValue) { overallStatus = code; break; }
    }

    let requestType = '';
    const typeValue = (row['Request Type'] || '').toString().trim();
    const matchedType = typeItems.find(
      t => t.label.toLowerCase() === typeValue.toLowerCase() || t.value === typeValue.toLowerCase().replace(/\s+/g, '_'),
    );
    if (matchedType) requestType = matchedType.value;
    else if (typeValue) requestType = typeValue;

    return {
      sno: '',
      beelineId: String(row['Beeline ID'] || '').trim(),
      description: row['Description'] || '',
      raisedBy: row['Raised by'] || '',
      processingStatus,
      overallStatus,
      accountAnchor: row['Owner'] || row['Account Anchor'] || row['Account Anchor Assigned'] || '',
      dateRaised: formatDateToDDMMYYYY(row['Date Raised']),
      requestType,
      updatedOn: formatDateToDDMMYYYY(new Date().toISOString()),
    } as ClientRequestUploadRow;
  }).filter(r => r.beelineId);
}

export function mergeClientRequestRows(existingRows: ClientRequestUploadRow[], uploadedRows: ClientRequestUploadRow[]) {
  const existingMap = new Map(existingRows.map(r => [r.beelineId.toLowerCase(), r]));
  let newCount = 0;
  let updCount = 0;

  uploadedRows.forEach(u => {
    const key = u.beelineId.toLowerCase();
    if (existingMap.has(key)) {
      const existing = existingMap.get(key)!;
      existingMap.set(key, { ...existing, ...u, id: existing.id });
      updCount++;
    } else {
      existingMap.set(key, u);
      newCount++;
    }
  });

  const mergedRows = Array.from(existingMap.values()).map((r, i) => ({ ...r, sno: String(i + 1) }));
  return { mergedRows, newCount, updCount };
}

export function toRequestBulkSavePayload(rows: ClientRequestUploadRow[]) {
  return rows.map(r => ({
    beelineId: r.beelineId,
    sno: Number(r.sno),
    description: r.description,
    raisedBy: r.raisedBy,
    processingStatus: r.processingStatus,
    overallStatus: r.overallStatus,
    accountAnchor: r.accountAnchor,
    dateRaised: r.dateRaised,
    requestType: r.requestType || '',
    updatedOn: r.updatedOn || '',
  }));
}
