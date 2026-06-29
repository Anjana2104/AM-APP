type RequestLike = {
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType?: string;
  updatedOn?: string;
};

type RequestUpdatePayload = {
  beelineId: string;
  description: string;
  raisedBy: string;
  processingStatus: string;
  overallStatus: string;
  accountAnchor: string;
  dateRaised: string;
  requestType: string;
  updatedOn: string;
  changedBy: string;
};

export function buildRequestUpdatePayload(
  base: RequestLike,
  overrides: Partial<RequestLike>,
  changedBy: string,
): RequestUpdatePayload {
  const merged = { ...base, ...overrides };
  return {
    beelineId: merged.beelineId,
    description: merged.description,
    raisedBy: merged.raisedBy,
    processingStatus: merged.processingStatus,
    overallStatus: merged.overallStatus,
    accountAnchor: merged.accountAnchor,
    dateRaised: merged.dateRaised,
    requestType: merged.requestType || '',
    updatedOn: merged.updatedOn || '',
    changedBy,
  };
}
