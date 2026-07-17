/**
 * piwApi.ts
 *
 * PIW (Project Implementation Workplan) generation service.
 * Delegates to server-side ExcelJS for proper XLSM handling.
 */

export interface PIWFormData {
  clientCompanyName: string;
  projectName: string;
  sowNumber: string;
  crmOpportunityId: string;
  contractType: string;
  currency: string;
  plannedStartDate: string;
  plannedEndDate: string;
  resources: Array<{
    raId: string;
    name: string;
    resourceType: string;
    skillType?: string;
    allocationPercentage?: number;
    dailyRate: number;
    resourceStartDate?: string;
    resourceEndDate?: string;
  }>;
}

/**
 * Generate PIW using server-side ExcelJS for proper XLSM handling.
 * Server loads template, populates it, and streams back the file.
 */
export const generatePIW = async (data: PIWFormData): Promise<Blob> => {
  const response = await fetch('/api/piwGeneration/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(errorData.error || 'Failed to generate PIW');
  }

  return response.blob();
};

/** Trigger a browser download for the given PIW blob. */
export const downloadPIW = (piw: Blob, fileName: string): void => {
  const url = URL.createObjectURL(piw);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName}.xlsm`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
