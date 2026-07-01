import type { ResourceRow } from '../../types/resource';

export type SelectOption = {
  value: string;
  label: string;
};

export type BulkUploadSkippedRow = {
  rowNum: number;
  reason: string;
  detail?: string;
};

export type BulkUploadResult = {
  totalRows: number;
  uploadedCount: number;
  newCount: number;
  updCount: number;
  skippedRows: BulkUploadSkippedRow[];
  serverOk: boolean;
};

export type BeelineLinkModalState = {
  open: boolean;
  resource: ResourceRow | null;
};

export type ResourceViewMode = 'table' | 'card';

export type FilterState = {
  sno: string;
  raId: string;
  empName: string;
  emailId: string;
  piwRole: string[];
  roleOrDomain: string[];
  totalWorkex: string;
  skills: string[];
  engagement: string;
  workexRange: [number, number];
  allocationStatus: string;
  activeState: string;
  beelineId: string;
  allocationPct: string;
};

export interface ResourceHubProps {
  onResourcesChange?: (resources: ResourceRow[]) => void;
  initialRoleFilter?: string;
  initialRaIdFilter?: string;
  initialFilterType?: string;
  initialFilterValue?: string;
  onFilterApplied?: () => void;
  onNavigateToRequest?: (beelineId: string) => void;
  onNavigateToInsights?: () => void;
  onNavigateToProcess?: (sowName: string) => void;
}
