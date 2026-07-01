export type ExcelRow = Record<string, any>;

export type InvRow = {
  key: string;
  id?: number;
  sno: number;
  project: string;
  company: string;
  code: string;
  status: 'Active' | 'Inactive';
  comments: string;
  revenue: number[];
};
