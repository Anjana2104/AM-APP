type XlsxSheet = any;

type XlsxBasicLib = {
  utils: {
    json_to_sheet: (rows: Record<string, any>[], options?: Record<string, any>) => XlsxSheet;
    aoa_to_sheet: (rows: any[][], options?: Record<string, any>) => XlsxSheet;
    book_new: () => any;
    book_append_sheet: (workbook: any, worksheet: XlsxSheet, sheetName: string) => void;
  };
  writeFile: (workbook: any, fileName: string) => void;
};

function applyColumnWidths(worksheet: XlsxSheet, columnWidths?: number[]) {
  if (!columnWidths?.length) return;
  worksheet['!cols'] = columnWidths.map(width => ({ wch: width }));
}

export function writeJsonSheetFile(
  xlsx: XlsxBasicLib,
  rows: Record<string, any>[],
  sheetName: string,
  fileName: string,
  options?: { header?: string[]; columnWidths?: number[] },
) {
  const worksheet = xlsx.utils.json_to_sheet(rows, options?.header ? { header: options.header } : undefined);
  applyColumnWidths(worksheet, options?.columnWidths);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  xlsx.writeFile(workbook, fileName);
}

export function writeAoaSheetFile(
  xlsx: XlsxBasicLib,
  rows: any[][],
  sheetName: string,
  fileName: string,
  options?: { columnWidths?: number[] },
) {
  const worksheet = xlsx.utils.aoa_to_sheet(rows);
  applyColumnWidths(worksheet, options?.columnWidths);
  const workbook = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(workbook, worksheet, sheetName);
  xlsx.writeFile(workbook, fileName);
}

type MultiSheetConfig =
  | { sheetName: string; type: 'json'; rows: Record<string, any>[]; options?: { header?: string[]; columnWidths?: number[] } }
  | { sheetName: string; type: 'aoa'; rows: any[][]; options?: { columnWidths?: number[] } };

export function writeMultiSheetFile(
  xlsx: XlsxBasicLib,
  sheets: MultiSheetConfig[],
  fileName: string,
) {
  const workbook = xlsx.utils.book_new();
  sheets.forEach((sheet) => {
    const worksheet = sheet.type === 'json'
      ? xlsx.utils.json_to_sheet(sheet.rows, sheet.options?.header ? { header: sheet.options.header } : undefined)
      : xlsx.utils.aoa_to_sheet(sheet.rows);
    applyColumnWidths(worksheet, sheet.options?.columnWidths);
    xlsx.utils.book_append_sheet(workbook, worksheet, sheet.sheetName);
  });
  xlsx.writeFile(workbook, fileName);
}
