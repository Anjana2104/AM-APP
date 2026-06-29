import dayjs from 'dayjs';
import type { ResourcePayload } from '../../api/resourceApi';
import { mapResourceApiRowToPayload } from '../resource/resourceRowMappers';

type ConfigItem = { label: string; value: string; color?: string };

export function buildRequestConfigMappings(
  typeItems: ConfigItem[],
  processingStatusItems: ConfigItem[],
  overallStatusItems: ConfigItem[],
) {
  const requestTypeOptions = typeItems.map(i => ({ label: i.label, value: i.value }));
  const requestTypeLabel: Record<string, string> = Object.fromEntries(typeItems.map(i => [i.value, i.label]));
  const requestTypeColor: Record<string, string> = Object.fromEntries(typeItems.map(i => [i.value, i.color ?? 'default']));

  const processingStatusOptions = processingStatusItems.map(i => ({ label: i.label, value: i.value }));
  const overallStatusOptions = overallStatusItems.map(i => ({ label: i.label, value: i.value }));
  const processingStatusDisplayMap: Record<string, string> = Object.fromEntries(processingStatusItems.map(i => [i.value, i.label]));
  const overallStatusDisplayMap: Record<string, string> = Object.fromEntries(overallStatusItems.map(i => [i.value, i.label]));

  return {
    REQUEST_TYPE_OPTIONS: requestTypeOptions,
    REQUEST_TYPE_LABEL: requestTypeLabel,
    REQUEST_TYPE_COLOR: requestTypeColor,
    PROCESSING_STATUS_OPTIONS: processingStatusOptions,
    OVERALL_STATUS_OPTIONS: overallStatusOptions,
    PROCESSING_STATUS_DISPLAY_MAP: processingStatusDisplayMap,
    OVERALL_STATUS_DISPLAY_MAP: overallStatusDisplayMap,
  };
}

export function formatDateToDDMMYYYY(dateString: string | number | Date | undefined): string {
  if (!dateString && dateString !== 0) return '';
  if (typeof dateString === 'number') {
    const excelEpoch = new Date(1899, 11, 30);
    const d = new Date(excelEpoch.getTime() + dateString * 86400000);
    return dayjs(d).format('DD/MM/YYYY');
  }
  if (dateString instanceof Date) {
    return dayjs(dateString).format('DD/MM/YYYY');
  }
  const s = String(dateString).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [d, m, y] = s.split('/');
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`;
  }
  const parsed = dayjs(s);
  if (parsed.isValid()) return parsed.format('DD/MM/YYYY');
  return s;
}

export function formatDateReadable(dateString: string | undefined): string {
  if (!dateString) return '';
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
  if (ddmmyyyy) {
    const parsed = dayjs(`${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`);
    if (parsed.isValid()) return parsed.format('DD MMM YYYY');
  }
  const parsed = dayjs(dateString);
  if (parsed.isValid()) return parsed.format('DD MMM YYYY');
  return dateString;
}

export function formatDateTimeUtc(dateString: string | undefined): string {
  if (!dateString) return '';
  const ddmmyyyy = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateString);
  if (ddmmyyyy) {
    const dt = new Date(Date.UTC(
      Number(ddmmyyyy[3]),
      Number(ddmmyyyy[2]) - 1,
      Number(ddmmyyyy[1]),
      0,
      0,
      0,
    ));
    if (!Number.isNaN(dt.getTime())) {
      const datePart = dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
      const timePart = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
      return `${datePart}, ${timePart} UTC`;
    }
  }
  const parsed = new Date(dateString);
  if (!Number.isNaN(parsed.getTime())) {
    const datePart = parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
    const timePart = parsed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    return `${datePart}, ${timePart} UTC`;
  }
  return dateString;
}

export function mapResourceApiRow(r: any): ResourcePayload {
  return mapResourceApiRowToPayload(r);
}
