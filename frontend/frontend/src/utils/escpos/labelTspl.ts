export type LabelTsplItem = {
  name: string;
  barcode: string;
  barcodeType: 'CODE128' | 'DATAMATRIX';
  price?: string;
  count: number;
};

// TSPL quoted strings: backslash-escape quotes; remove command/control injection.
const quote = (value: string): string => value.replace(/[\x00-\x1f\x7f]/g, ' ').replace(/\\/g, '\\\\').replace(/"/g, '\\"');

export function buildLabelsTspl(items: LabelTsplItem[], format: '40x20' | '30x15'): string {
  const compact = format === '30x15';
  // 203 dpi ≈ 8 dots/mm: 320×160 or 240×120, with 8-dot margins.
  // Font 1 is 8×12 dots; reserve the bottom line for price.
  const width = compact ? 30 : 40;
  const height = compact ? 15 : 20;
  const maxName = compact ? 28 : 38;
  const barcodeHeight = compact ? 40 : 64;
  return items.filter(item => Number.isFinite(item.count) && item.count > 0).map(item => {
    const commands = [
      `SIZE ${width} mm, ${height} mm`,
      'GAP 2 mm, 0 mm',
      'DIRECTION 1',
      'CLS',
      `TEXT 8,8,"1",0,1,1,"${quote(item.name.slice(0, maxName))}"`,
    ];
    if (item.barcodeType === 'DATAMATRIX') {
      // TSPL DMATRIX: x,y,width,height,x-module,y-module,content (ECC200).
      const size = compact ? 56 : 80;
      commands.push(`DMATRIX 8,28,${size},${size},2,2,"${quote(item.barcode)}"`);
    } else {
      commands.push(`BARCODE 8,28,"128",${barcodeHeight},1,0,2,2,"${quote(item.barcode)}"`);
    }
    if (item.price) {
      commands.push(`TEXT 8,${compact ? 100 : 140},"1",0,1,1,"${quote(item.price.slice(0, maxName))}"`);
    }
    commands.push(`PRINT 1,${Math.floor(item.count)}`);
    return commands.join('\r\n') + '\r\n';
  }).join('');
}
