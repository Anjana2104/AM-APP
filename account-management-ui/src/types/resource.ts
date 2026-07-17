/**
 * Shared resource type definitions
 */

export type ResourceRow = {
  key: string;
  id?: number;
  isActive?: boolean;
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
  skillType?: string;              // 'Commodity' | 'Specialized'
  engagementStartDate?: string;    // Engagement start date for this resource
  engagementEndDate?: string;      // Engagement end date for this resource
  sowName?: string;                // Linked SOW name (from ra_process)
  engagement?: string;
  allocationStatus?: string;
  allocationPercentage?: number | null;
  allocationEntries?: ResourceAllocationEntry[];
  beelineId?: string;
  processId?: number | null;         // Linked internal process id
  allocationRequests?: Array<{
    id: string;
    clientName: string;
    engagementName: string;
    status: 'shortlisted' | 'offered' | 'selected' | 'rejected' | 'joined';
    createdDate: string;
    notes?: string;
  }>;
};

export type ResourceAllocationEntry = {
  engagementName: string;
  allocationPercentage: number;
  engagementStartDate?: string;
  engagementEndDate?: string;
  allocationStatus?: string;
  beelineId?: string;
};
