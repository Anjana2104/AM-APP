/**
 * piwApi.ts
 * 
 * PIW (Project Implementation Workplan) generation service
 * Delegates to server-side generation for proper XLSM handling with ExcelJS
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
 * Generate PIW using server-side ExcelJS for proper XLSM handling
 * Server loads template, updates it, and streams back the file
 */
export const generatePIW = async (data: PIWFormData): Promise<Blob> => {
  try {
    
    const response = await fetch('http://localhost:3001/api/piwGeneration/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to generate PIW');
    }

    const blob = await response.blob();
    return blob;
  } catch (e: any) {
    throw e;
  }
};

/**
 * Download PIW blob as file
 */
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
