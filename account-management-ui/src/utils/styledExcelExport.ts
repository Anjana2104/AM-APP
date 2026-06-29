type XlsxStyleLib = {
  utils: {
    aoa_to_sheet: (aoa: any[][]) => any;
    encode_cell: (addr: { r: number; c: number }) => string;
  };
};

export function getCurrentDateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function buildStyledWorksheetFromAoa(
  xlsxStyle: XlsxStyleLib,
  aoa: any[][],
  columnWidths: number[],
) {
  const ws: any = xlsxStyle.utils.aoa_to_sheet(aoa);
  ws['!cols'] = columnWidths.map(width => ({ wch: width }));
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activeCell: 'A2', state: 'frozen' };
  ws['!sheetViews'] = [{ showGridLines: false }];

  const numCols = aoa[0]?.length ?? 0;
  const numRows = aoa.length;
  const headerFill = { patternType: 'solid' as const, fgColor: { rgb: '001529' } };
  const headerFont = { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 };
  const evenFill = { patternType: 'solid' as const, fgColor: { rgb: 'EBF3FF' } };
  const oddFill = { patternType: 'solid' as const, fgColor: { rgb: 'FFFFFF' } };
  const thinGrid = { style: 'thin' as const, color: { rgb: 'D9D9D9' } };
  const mediumNavy = { style: 'medium' as const, color: { rgb: '001529' } };

  for (let row = 0; row < numRows; row++) {
    for (let col = 0; col < numCols; col++) {
      const addr = xlsxStyle.utils.encode_cell({ r: row, c: col });
      if (!ws[addr]) ws[addr] = { t: 'z', v: '' };
      ws[addr].s = {
        fill: row === 0 ? headerFill : row % 2 === 0 ? evenFill : oddFill,
        font: row === 0 ? headerFont : { sz: 10 },
        alignment: { vertical: 'center' as const, horizontal: 'left' as const, wrapText: false },
        border: {
          top: row === 0 ? mediumNavy : thinGrid,
          bottom: row === numRows - 1 ? mediumNavy : thinGrid,
          left: col === 0 ? mediumNavy : thinGrid,
          right: col === numCols - 1 ? mediumNavy : thinGrid,
        },
      };
    }
  }

  return ws;
}
