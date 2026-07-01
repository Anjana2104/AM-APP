export const RESOURCE_COLUMN_KEYS = [
  'sno',
  'raId',
  'empName',
  'emailId',
  'piwRole',
  'roleOrDomain',
  'previousWorkex',
  'doj',
  'totalWorkex',
  'engagement',
  'allocationStatus',
  'allocationPercentage',
  'resourceStatus',
  'skills',
  'action',
] as const;

export const RESOURCE_COLUMN_LABELS: Record<string, string> = {
  sno: 'S.NO',
  raId: 'RA ID',
  empName: 'Employee Name',
  emailId: 'Email Id',
  piwRole: 'PIW Role',
  roleOrDomain: 'Role/Domain',
  previousWorkex: 'Previous Workex',
  doj: 'DOJ',
  totalWorkex: 'Total Workex',
  engagement: 'Current Engagement',
  allocationStatus: 'Allocation Status',
  allocationPercentage: 'Alloc %',
  resourceStatus: 'Resource Status',
  skills: 'Skills',
};

export const TABLE_ALLOCATION_STATUS_COLOR_MAP: Record<string, string> = {
  Available: '#faad14',
  Shortlisted: '#13c2c2',
  Offered: '#722ed1',
  Selected: '#1890ff',
  Joined: '#389e0d',
};

export const CARD_ALLOCATION_STATUS_COLOR_MAP: Record<string, string> = {
  Available: '#faad14',
  Shortlisted: '#13c2c2',
  Offered: '#722ed1',
  Selected: '#1890ff',
  Joined: '#389e0d',
  'On Bench': '#fa8c16',
  Released: '#ff4d4f',
  Resigned: '#ff4d4f',
};
