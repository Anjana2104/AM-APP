import type { ResourceRow } from '../ResourceHub';

export interface ResourceUtilizationProps {
  resources?: ResourceRow[];
  onUpdateResources?: (updated: ResourceRow[]) => void;
  onNavigate?: (page: string, roleFilter?: string) => void;
  onNavigateToRequest?: (beelineId: string) => void;
  onNavigateToInsights?: () => void;
}

export interface UnifiedFilterState {
  resourceName: string;
  raid: string;
  skills: string[];
  engagement: string;
  roleOrDomain: string[];
  workexRange: [number, number];
  beelineId: string;
  allocationPct: string;
}

export const DEFAULT_UNIFIED_FILTERS: UnifiedFilterState = {
  resourceName: '',
  raid: '',
  skills: [],
  engagement: '',
  roleOrDomain: [],
  workexRange: [0, 100],
  beelineId: '',
  allocationPct: '',
};

export interface AllocationFormState {
  engagementName: string;
  beelineId: string;
  notes: string;
  engagementStartDate: string;
  engagementEndDate: string;
}

export interface StageOption {
  value: string;
  label: string;
  color: string;
}

export interface SelectOption {
  label: string;
  value: string;
}

export interface ResourceModalState {
  open: boolean;
  resource: ResourceRow | null;
}
