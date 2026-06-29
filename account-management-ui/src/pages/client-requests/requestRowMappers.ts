export interface ClientRequestRowShape {
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

export function mapApiRequestRow(raw: any, index: number): ClientRequestRowShape {
  const hasSnakeActive = raw.is_active !== undefined;
  const hasCamelActive = raw.isActive !== undefined;
  const activeValue = hasSnakeActive ? raw.is_active !== 0 : (hasCamelActive ? !!raw.isActive : true);

  return {
    id: raw.id,
    sno: String(raw.sno || index + 1),
    beelineId: String(raw.beeline_id || raw.beelineId || ''),
    description: String(raw.description || ''),
    raisedBy: String(raw.raised_by || raw.raisedBy || ''),
    processingStatus: String(raw.processing_status || raw.processingStatus || ''),
    overallStatus: String(raw.overall_status || raw.overallStatus || ''),
    accountAnchor: String(raw.account_anchor || raw.accountAnchor || ''),
    dateRaised: String(raw.date_raised || raw.dateRaised || ''),
    requestType: String(raw.request_type || raw.requestType || ''),
    updatedOn: String(raw.updated_on || raw.updatedOn || ''),
    isActive: activeValue,
  };
}

export function toCreateRequestPayload(row: ClientRequestRowShape) {
  return {
    beelineId: row.beelineId,
    sno: Number(row.sno),
    description: row.description,
    raisedBy: row.raisedBy,
    processingStatus: row.processingStatus,
    overallStatus: row.overallStatus,
    accountAnchor: row.accountAnchor,
    dateRaised: row.dateRaised,
    requestType: row.requestType || '',
    updatedOn: row.updatedOn || '',
  };
}
