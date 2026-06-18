/**
 * sowApi.ts
 * SOW (Statement of Work) document generation service
 * Delegates to server which fills the uploaded sow_template.docx
 */

export interface SOWResource {
  raId: string;
  empId?: string;
  name: string;
  skill: string;
  resourceType?: string;
  location: string;
  experience: string;
  overheadCategory: string;
  dailyRate: number;
  resourceStartDate?: string;
  resourceEndDate?: string;
}

export interface SOWFormData {
  sowNumber: string;
  serviceProvider?: string;
  workProduct?: string;
  personnelNote?: string;
  signatoryName?: string;
  resources: SOWResource[];
}

export const generateSOW = async (data: SOWFormData): Promise<Blob> => {
  const response = await fetch('http://localhost:3001/api/sowGeneration/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error((err as any).error || 'Failed to generate SOW');
  }
  return response.blob();
};

export const downloadSOW = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.docx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
