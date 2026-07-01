/**
 * exportChartAsPng.ts
 *
 * Shared utility for exporting a DOM element (chart / panel) as a PNG file,
 * or capturing it as a data URL for use in PDF generation.
 *
 * Replaces the identical html2canvas boilerplate that was duplicated in 11+ files.
 *
 * Usage — direct download:
 *   import { exportChartAsPng } from '../../utils/exportChartAsPng';
 *   await exportChartAsPng(chartRef.current, 'my-chart-2024-07-01.png');
 *
 * Usage — PNG data URL for PDF:
 *   import { captureElementAsPng } from '../../utils/exportChartAsPng';
 *   const imgData = await captureElementAsPng(chartRef.current);
 *   pdf.addImage(imgData, 'PNG', ...);
 */

import html2canvas from 'html2canvas';

/**
 * Captures a DOM element as a PNG and triggers a browser download.
 *
 * @param element    - DOM element to capture (pass ref.current)
 * @param filename   - Download filename (should include .png extension)
 * @param background - CSS background colour for the canvas (default: '#ffffff')
 */
export async function exportChartAsPng(
  element: HTMLElement | null,
  filename: string,
  background = '#ffffff',
): Promise<void> {
  if (!element) {
    console.warn('[exportChartAsPng] element is null — export skipped');
    return;
  }
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: background,
      scale: 2,
      useCORS: true,
    });
    const link = document.createElement('a');
    link.download = filename;
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('[exportChartAsPng] PNG export failed:', err);
    throw err;
  }
}

/**
 * Captures a DOM element and returns the PNG as a base64 data URL.
 * Use this when the PNG needs to be embedded in a PDF (jsPDF addImage).
 *
 * @param element    - DOM element to capture
 * @param background - CSS background colour (default: '#ffffff')
 * @returns            base64 PNG data URL string
 */
export async function captureElementAsPng(
  element: HTMLElement | null,
  background = '#ffffff',
): Promise<string> {
  if (!element) {
    console.warn('[captureElementAsPng] element is null');
    return '';
  }
  try {
    const canvas = await html2canvas(element, {
      backgroundColor: background,
      scale: 2,
      useCORS: true,
    });
    return canvas.toDataURL('image/png');
  } catch (err) {
    console.error('[captureElementAsPng] Capture failed:', err);
    throw err;
  }
}

/**
 * Captures a DOM element and returns the raw html2canvas Canvas object.
 * Use this when you need canvas dimensions (e.g., to calculate PDF aspect ratio).
 *
 * @param element    - DOM element to capture
 * @param background - CSS background colour (default: '#ffffff')
 * @param options    - Optional additional html2canvas options (merged with defaults)
 */
export async function captureElementCanvas(
  element: HTMLElement | null,
  background = '#ffffff',
  options?: Partial<Parameters<typeof html2canvas>[1]>,
): Promise<HTMLCanvasElement | null> {
  if (!element) {
    console.warn('[captureElementCanvas] element is null');
    return null;
  }
  try {
    return await html2canvas(element, {
      backgroundColor: background,
      scale: 2,
      useCORS: true,
      ...options,
    });
  } catch (err) {
    console.error('[captureElementCanvas] Capture failed:', err);
    throw err;
  }
}

/**
 * Builds a standard dated PNG filename.
 * e.g. buildPngFilename('finance-insights') → 'finance-insights-2024-07-01.png'
 */
export function buildPngFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.png`;
}
