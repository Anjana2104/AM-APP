/** Shared ResourceRow type — imported by ResourceInformation, ResourceDetailPanel, EngagementMapping etc. */

export type ResourceRow = {
  key: string;
  id?: number;
  sno: string;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string;
  roleOrDomain: string;
  previousWorkex: string;
  doj: string;
  totalWorkex: string;
  skills: string;
  engagement?: string;
  allocationStatus?: string;
  beelineId?: string;
  allocationRequests?: Array<{
    id: string;
    clientName: string;
    engagementName: string;
    status: 'shortlisted' | 'offered' | 'selected' | 'rejected' | 'joined';
    createdDate: string;
    notes?: string;
  }>;
};
