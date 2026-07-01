export interface FinanceInsightsDataRow {
  id?: number;
  project: string;
  company: string;
  code: string;
  owner: string;
  revenue: number[];
  milestoneTypes: Record<string, 'booked' | 'anticipated'>;
}

export interface BookingInsightRow {
  bookingId: number;
  projectId: number;
  projectCode: string;
  projectName: string;
  company: string;
  owner: string;
  milestoneMonth: string;
  bookingMonth: string;
  amount: number;
  bookingType: 'fixed' | 'anticipated';
  notes: string;
}

export interface MonthlyBookingBreakdownRow {
  month: string;
  amount: number;
  rows: BookingInsightRow[];
}

export interface QuarterlyBookingBreakdownRow {
  quarter: string;
  monthsLabel: string;
  amount: number;
  rows: BookingInsightRow[];
}

export interface UnbookedInsightRow {
  key: string;
  projectCode: string;
  projectName: string;
  company: string;
  owner: string;
  milestoneMonth: string;
  milestoneType: 'fixed' | 'anticipated';
  milestoneAmount: number;
  bookedAmount: number;
  unbookedAmount: number;
}

export interface BookingTotals {
  total: number;
  fixed: number;
  anticipated: number;
  projects: number;
}

export interface UnbookedByFilter {
  label: string;
  rows: UnbookedInsightRow[];
  total: number;
  color: string;
}

export interface ProjectQuarterSummary {
  total: number;
  pct: number;
  label: string;
  months: string;
}

export interface ProjectInsightsSummary {
  quarters: ProjectQuarterSummary[];
  grand: number;
}

export interface ProjectMonthlyDatum {
  label: string;
  total: number;
  pct: number;
}

export interface YearOverYearInsights {
  fy1: number;
  fy2: number;
  pct: number;
  labels: [string, string];
}
