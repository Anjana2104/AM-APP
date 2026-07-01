import { writeJsonSheetFile, writeMultiSheetFile } from '../../utils/xlsxExport';

type XlsxLib = any;

type LinkTarget = { id: string; label: string; module: string };

type ConfigItemExport = { label: string; color?: string };
type ConfigTypeExport = { name: string; linkedTo?: string[]; items: ConfigItemExport[] };
type AppValueExport = { key: string; value: string; description?: string };

export function downloadConfigurationTemplate(
  xlsx: XlsxLib,
  availableLinkTargets: LinkTarget[],
) {
  const template = [
    { 'Configuration Type': 'Request Priority', Value: 'High', Color: 'red', 'Linked To': '' },
    { 'Configuration Type': 'Request Priority', Value: 'Medium', Color: 'gold', 'Linked To': '' },
    { 'Configuration Type': 'Request Priority', Value: 'Low', Color: 'green', 'Linked To': '' },
    { 'Configuration Type': 'Skill Category', Value: 'Frontend', Color: 'blue', 'Linked To': 'resource_skill_field' },
    { 'Configuration Type': 'Skill Category', Value: 'Backend', Color: 'cyan', 'Linked To': 'resource_skill_field' },
  ];
  const linkTargets = availableLinkTargets.map((t) => ({
    'Link Target ID': t.id,
    Label: t.label,
    Module: t.module,
  }));
  writeMultiSheetFile(
    xlsx,
    [
      { sheetName: 'Config Template', type: 'json', rows: template, options: { columnWidths: [30, 30, 12, 40] } },
      { sheetName: 'Available Link Targets', type: 'json', rows: linkTargets, options: { columnWidths: [40, 40, 25] } },
    ],
    'Configuration_Upload_Template.xlsx',
  );
}

export function exportConfigurationsWorkbook(
  xlsx: XlsxLib,
  configs: ConfigTypeExport[],
  availableLinkTargets: LinkTarget[],
) {
  const rows: Record<string, string>[] = [];
  configs.forEach((cfg) => {
    const linkedToIds = (cfg.linkedTo || []).join('; ');
    const linkedToLabels = (cfg.linkedTo || [])
      .map((id) => availableLinkTargets.find((t) => t.id === id)?.label || id)
      .join('; ');
    cfg.items.forEach((item) => {
      rows.push({
        'Configuration Type': cfg.name,
        Value: item.label,
        Color: item.color || 'default',
        'Linked To': linkedToIds,
        'Linked To (Labels)': linkedToLabels,
      });
    });
    if (cfg.items.length === 0) {
      rows.push({
        'Configuration Type': cfg.name,
        Value: '',
        Color: '',
        'Linked To': linkedToIds,
        'Linked To (Labels)': linkedToLabels,
      });
    }
  });
  const linkTargets = availableLinkTargets.map((t) => ({
    'Link Target ID': t.id,
    Label: t.label,
    Module: t.module,
  }));
  writeMultiSheetFile(
    xlsx,
    [
      { sheetName: 'Configurations', type: 'json', rows, options: { columnWidths: [30, 30, 12, 50, 60] } },
      { sheetName: 'Available Link Targets', type: 'json', rows: linkTargets, options: { columnWidths: [40, 40, 25] } },
    ],
    'Configurations_Export.xlsx',
  );
}

export function downloadAppValuesTemplate(xlsx: XlsxLib) {
  const template = [
    { Key: 'SOW_STORAGE_URL', Value: 'https://sharepoint.com/...', Description: 'SharePoint URL for SOW documents' },
    { Key: 'REPORT_EMAIL', Value: 'reports@company.com', Description: 'Email address for report notifications' },
  ];
  writeJsonSheetFile(
    xlsx,
    template,
    'Values Template',
    'AppValues_Upload_Template.xlsx',
    { columnWidths: [25, 50, 40] },
  );
}

export function exportAppValuesWorkbook(xlsx: XlsxLib, appValues: AppValueExport[]) {
  const rows = appValues.map((v) => ({ Key: v.key, Value: v.value, Description: v.description || '' }));
  writeJsonSheetFile(
    xlsx,
    rows,
    'App Values',
    'AppValues_Export.xlsx',
    { columnWidths: [25, 50, 40] },
  );
}
