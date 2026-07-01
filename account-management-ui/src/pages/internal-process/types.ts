import type React from 'react';

export interface ProcessRow {
  key: string;
  id?: number;
  processId?: string;
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
  eprev: string;
  comments: string;
  sowFile?: File;
  accountAnchor?: string;
  createdAt?: string;
  updatedAt?: string;
  stepCompletedAt?: Record<string, string>;
}

export interface ProcRes {
  id: number;
  raId: string;
  empName: string;
  piwRole: string;
  processId: number | null;
  engagementStartDate?: string;
  engagementEndDate?: string;
}

export interface PiwResourceEntry {
  key: string;
  raidId: string;
  empName: string;
  piwRole: string;
  totalWorkex: string;
  skillType: string;
  dailyRate: number;
  manualDailyRate: string;
  resourceStartDate: string;
  resourceEndDate: string;
}

export interface SowResourceEntry {
  key: string;
  raidId: string;
  empId: string;
  empName: string;
  piwRole: string;
  totalWorkex: string;
  skill: string;
  location: string;
  overheadCategory: string;
  skillType: string;
  dailyRate: number;
  manualDailyRate: string;
  resourceStartDate: string;
  resourceEndDate: string;
}

export interface ProcessTabPanelProps {
  rows: ProcessRow[];
  setRows: React.Dispatch<React.SetStateAction<ProcessRow[]>>;
  fromServer?: boolean;
  setFromServer?: (value: boolean) => void;
  resourceRefreshKey?: number;
  initialSow?: string;
  initialFilters?: Record<string, string>;
  resetFiltersSignal?: number;
}
